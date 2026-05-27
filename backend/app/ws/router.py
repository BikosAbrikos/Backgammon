from __future__ import annotations
import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from ..database import AsyncSessionLocal
from ..models import User, Game
from ..engine.state import GameState
from ..engine.setup import create_initial_state
from ..engine.dice import roll_dice
from ..engine.rules import get_valid_moves
from ..engine.moves import apply_move, _advance_turn
from ..auth.utils import decode_token
from .manager import manager, QueueEntry, PlayerConn

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _user_from_token(token: str) -> User | None:
    user_id = decode_token(token)
    if not user_id:
        return None
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()


def _elo_delta(winner_elo: int, loser_elo: int, games_played: int) -> int:
    k = 32 if games_played < 30 else 16
    expected = 1 / (1 + 10 ** ((loser_elo - winner_elo) / 400))
    return max(1, round(k * (1 - expected)))


async def _save_ranked_result(room, winner_color: str, elo_changes: dict):
    white = room.players.get("white")
    black = room.players.get("black")

    async with AsyncSessionLocal() as db:
        game = Game(
            mode=room.mode,
            type="ranked",
            white_id=white.user_id if white else None,
            black_id=black.user_id if black else None,
            winner_id=white.user_id if winner_color == "white" else (black.user_id if black else None),
            elo_change_white=elo_changes.get("white", 0),
            elo_change_black=elo_changes.get("black", 0),
        )
        db.add(game)

        for color, conn in room.players.items():
            result = await db.execute(select(User).where(User.id == conn.user_id))
            u = result.scalar_one_or_none()
            if u:
                delta = elo_changes.get(color, 0)
                u.elo = max(100, u.elo + delta)
                u.games_played += 1
                if color == winner_color:
                    u.games_won += 1
                    u.win_streak += 1
                else:
                    u.win_streak = 0

        await db.commit()


# ── Matchmaking WS ────────────────────────────────────────────────────────────

@router.websocket("/ws/matchmaking")
async def matchmaking_ws(websocket: WebSocket):
    await websocket.accept()
    entry: QueueEntry | None = None
    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)

            if data.get("type") == "join_queue":
                user = await _user_from_token(data.get("token", ""))
                if not user:
                    await websocket.send_text(json.dumps({"type": "error", "message": "Invalid token"}))
                    continue
                mode = data.get("mode", "short")
                entry = QueueEntry(websocket, str(user.id), user.username, user.elo, mode)
                await manager.join_queue(entry)

            elif data.get("type") == "leave_queue":
                await manager.leave_queue(websocket)
                entry = None

    except WebSocketDisconnect:
        if entry:
            await manager.leave_queue(websocket)


# ── Game WS ───────────────────────────────────────────────────────────────────

@router.websocket("/ws/game/{room_id}")
async def game_ws(websocket: WebSocket, room_id: str):
    await websocket.accept()

    room = manager.get_room(room_id)
    if not room:
        await websocket.send_text(json.dumps({"type": "error", "message": "Room not found"}))
        await websocket.close()
        return

    color: str | None = None
    user: User | None = None

    try:
        # First message must be auth
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=10)
        data = json.loads(raw)
        if data.get("type") == "auth":
            user = await _user_from_token(data.get("token", ""))

        # Determine role: player or spectator
        if user:
            for c, conn in room.players.items():
                if conn.user_id == str(user.id):
                    color = c
                    conn.ws = websocket
                    conn.connected = True
                    if room.disconnect_task:
                        room.disconnect_task.cancel()
                        room.disconnect_task = None
                    break

            # New player joining private room (second seat)
            if color is None and room.game_type == "private" and len(room.players) < 2:
                color = "black" if "white" in room.players else "white"
                room.players[color] = PlayerConn(websocket, str(user.id), user.username, user.elo, color)

            # Start game once both seats are filled
            if len(room.players) == 2 and room.state is None:
                room.state = create_initial_state(room.mode)
                room.state.valid_moves = get_valid_moves(room.state)

        if color is None:
            room.spectators.append(websocket)

        # Send current state
        await websocket.send_text(json.dumps({
            "type": "game_state",
            "state": room.state.model_dump() if room.state else None,
            "players": room.players_info(),
            "your_color": color,
        }, default=str))

        # Main message loop
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            msg = data.get("type")

            # Chat — anyone
            if msg == "chat":
                await room.broadcast({
                    "type": "chat",
                    "from": room.players[color].username if color else "spectator",
                    "text": str(data.get("text", ""))[:200],
                })
                continue

            # Game actions — players only
            if color is None or room.state is None:
                continue

            state = room.state

            if msg == "roll_dice":
                if state.phase != "waiting_roll" or state.current_player.value != color:
                    continue
                state.dice = roll_dice()
                state.phase = "moving"
                state.valid_moves = get_valid_moves(state)
                if not state.valid_moves:
                    state = _advance_turn(state)
                room.state = state
                await room.broadcast({
                    "type": "game_state",
                    "state": state.model_dump(),
                    "players": room.players_info(),
                })

            elif msg == "make_move":
                if state.phase != "moving" or state.current_player.value != color:
                    continue
                from_pos = data.get("from_pos")
                to_pos = data.get("to_pos")
                valid = get_valid_moves(state)
                ok = any(str(m.from_pos) == str(from_pos) and str(m.to_pos) == str(to_pos) for m in valid)
                if not ok:
                    await websocket.send_text(json.dumps({"type": "error", "message": "Illegal move"}))
                    continue
                state = apply_move(state, from_pos, to_pos)
                room.state = state

                if state.phase == "game_over":
                    winner_color = state.winner.value if state.winner else None
                    elo_changes: dict = {}
                    if room.game_type == "ranked" and winner_color:
                        wc = room.players.get("white")
                        bc = room.players.get("black")
                        if wc and bc:
                            if winner_color == "white":
                                d = _elo_delta(wc.elo, bc.elo, 0)
                                elo_changes = {"white": d, "black": -d}
                            else:
                                d = _elo_delta(bc.elo, wc.elo, 0)
                                elo_changes = {"white": -d, "black": d}
                            asyncio.create_task(_save_ranked_result(room, winner_color, elo_changes))

                    await room.broadcast({
                        "type": "game_over",
                        "state": state.model_dump(),
                        "players": room.players_info(),
                        "winner": winner_color,
                        "elo_change": elo_changes,
                    })
                else:
                    await room.broadcast({
                        "type": "game_state",
                        "state": state.model_dump(),
                        "players": room.players_info(),
                    })

            elif msg == "resign":
                winner_color = "black" if color == "white" else "white"
                elo_changes: dict = {}
                if room.game_type == "ranked":
                    wc = room.players.get("white")
                    bc = room.players.get("black")
                    if wc and bc:
                        d = _elo_delta(
                            (bc if color == "white" else wc).elo,
                            (wc if color == "white" else bc).elo,
                            0,
                        )
                        elo_changes = {
                            winner_color: d,
                            color: -d,
                        }
                        asyncio.create_task(_save_ranked_result(room, winner_color, elo_changes))
                await room.broadcast({
                    "type": "game_over",
                    "winner": winner_color,
                    "resigned": color,
                    "elo_change": elo_changes,
                })

    except WebSocketDisconnect:
        if color and color in room.players:
            room.players[color].connected = False
            await room.broadcast({"type": "opponent_left", "reconnect_secs": 30})

            async def _cleanup():
                await asyncio.sleep(30)
                if not room.players.get(color, None) or not room.players[color].connected:
                    await manager.cleanup_room(room_id)

            room.disconnect_task = asyncio.create_task(_cleanup())
        elif websocket in room.spectators:
            room.spectators.remove(websocket)
