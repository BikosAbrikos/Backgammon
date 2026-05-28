from __future__ import annotations
import asyncio
import copy
import json
import random
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from ..database import AsyncSessionLocal
from ..models import User, Game
from ..engine.state import GameState, GameMode, Phase, Player
from ..engine.setup import create_initial_state
from ..engine.dice import roll_dice
from ..engine.rules import get_valid_moves
from ..engine.moves import apply_move, _advance_turn, apply_spy_move, generate_random_branch, extract_board_positions, collapse_quantum
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
        for c, conn in room.players.items():
            result = await db.execute(select(User).where(User.id == conn.user_id))
            u = result.scalar_one_or_none()
            if u:
                delta = elo_changes.get(c, 0)
                u.elo = max(100, u.elo + delta)
                u.games_played += 1
                if c == winner_color:
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
            if data.get("type") == "ping":
                try:
                    await websocket.send_text(json.dumps({"type": "pong"}))
                except Exception:
                    pass
                continue

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
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=10)
        data = json.loads(raw)
        if data.get("type") == "auth":
            user = await _user_from_token(data.get("token", ""))

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

            if color is None and room.game_type == "private" and len(room.players) < 2:
                color = "black" if "white" in room.players else "white"
                room.players[color] = PlayerConn(websocket, str(user.id), user.username, user.elo, color)

            if len(room.players) == 2 and room.state is None:
                # Use SHORT rules internally for QUANTUM/SPY modes
                engine_mode = GameMode(room.mode) if room.mode in ("short", "long") else GameMode.SHORT
                # But keep the actual mode in state
                room.state = create_initial_state(engine_mode)
                # Override mode so frontend knows what it is
                room.state.mode = GameMode(room.mode)
                room.state.valid_moves = get_valid_moves(room.state)

        if color is None:
            room.spectators.append(websocket)

        await websocket.send_text(json.dumps({
            "type": "game_state",
            "state": room.state.model_dump() if room.state else None,
            "players": room.players_info(),
            "your_color": color,
        }, default=str))

        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            msg = data.get("type")

            # ── Keep-alive ────────────────────────────────────────────────
            if msg == "ping":
                try:
                    await websocket.send_text(json.dumps({"type": "pong"}))
                except Exception:
                    pass
                continue

            # ── Chat ──────────────────────────────────────────────────────
            if msg == "chat":
                await room.broadcast({
                    "type": "chat",
                    "from": room.players[color].username if color else "spectator",
                    "text": str(data.get("text", ""))[:200],
                })
                continue

            if color is None or room.state is None:
                continue

            state = room.state

            # ── Roll Dice ─────────────────────────────────────────────────
            if msg == "roll_dice":
                if state.phase != Phase.WAITING_ROLL or state.current_player.value != color:
                    continue

                # Quantum collapse: quantum player rolling while opponent was playing
                if room.quantum_phase == "opponent" and color == room.quantum_player:
                    use_a = random.random() < 0.5
                    chosen = room.quantum_branch_a if use_a else room.quantum_branch_b
                    state = collapse_quantum(state, chosen, room.quantum_player)
                    room.quantum_phase = None
                    room.quantum_player = None
                    room.quantum_pre_state = None
                    room.quantum_branch_a = None
                    room.quantum_branch_b = None

                state.dice = roll_dice()
                state.phase = Phase.MOVING
                state.valid_moves = get_valid_moves(state)
                if not state.valid_moves:
                    state = _advance_turn(state)

                # Begin quantum building phase
                if state.mode == GameMode.QUANTUM and state.phase == Phase.MOVING:
                    room.quantum_phase = "building"
                    room.quantum_player = color
                    room.quantum_pre_state = copy.deepcopy(state)
                    room.quantum_branch_a_moves = []
                    room.state = state
                    await room.broadcast({
                        "type": "game_state",
                        "state": state.model_dump(),
                        "players": room.players_info(),
                        "quantum_phase": "building",
                        "quantum_player": color,
                    })
                    continue

                room.state = state
                await room.broadcast({
                    "type": "game_state",
                    "state": state.model_dump(),
                    "players": room.players_info(),
                })

            # ── Make Move ─────────────────────────────────────────────────
            elif msg == "make_move":
                if state.phase != Phase.MOVING or state.current_player.value != color:
                    continue
                from_pos = data.get("from_pos")
                to_pos = data.get("to_pos")

                # In spy mode, ALL moves go through spy_move handler
                if state.mode == GameMode.SPY:
                    # Redirect to spy_move logic inline
                    valid = get_valid_moves(state)
                    is_legal = any(
                        str(m.from_pos) == str(from_pos) and str(m.to_pos) == str(to_pos)
                        for m in valid
                    )
                    has_tokens = room.spy_tokens.get(color, 0) > 0

                    if not is_legal and not has_tokens:
                        await websocket.send_text(json.dumps({"type": "error", "message": "No spy tokens remaining"}))
                        continue

                    if is_legal:
                        next_state = apply_move(state, from_pos, to_pos)
                    else:
                        next_state = apply_spy_move(state, from_pos, to_pos)

                    room.state = next_state
                    room.spy_window_open = True
                    room.spy_last_mover = color
                    room.spy_last_dest = int(to_pos) if isinstance(to_pos, (int, str)) and str(to_pos).lstrip('-').isdigit() else None
                    room.spy_was_illegal = not is_legal

                    # Cancel previous close task if any
                    if room.spy_close_task and not room.spy_close_task.done():
                        room.spy_close_task.cancel()

                    async def _spy_timeout(r=room, mover=color):
                        await asyncio.sleep(7)
                        if r.spy_window_open and r.spy_last_mover == mover:
                            r.spy_window_open = False
                            s = r.state
                            if not s.dice.remaining or not s.valid_moves:
                                s = _advance_turn(s)
                                r.state = s
                            await r.broadcast({
                                "type": "spy_result",
                                "state": s.model_dump(),
                                "players": r.players_info(),
                                "spy_tokens": r.spy_tokens,
                                "result": "timeout",
                            })

                    room.spy_close_task = asyncio.create_task(_spy_timeout())

                    await room.broadcast({
                        "type": "spy_state",
                        "state": next_state.model_dump(),
                        "players": room.players_info(),
                        "spy_tokens": room.spy_tokens,
                        "challenge_window": True,
                        "last_mover": color,
                    })
                    continue

                # Validate move
                valid = get_valid_moves(state)
                ok = any(str(m.from_pos) == str(from_pos) and str(m.to_pos) == str(to_pos) for m in valid)
                if not ok:
                    await websocket.send_text(json.dumps({"type": "error", "message": "Illegal move"}))
                    continue

                state = apply_move(state, from_pos, to_pos)

                # Quantum building phase:
                # 2 dice  → Branch A = move 1,     Branch B = move 2
                # 4 dice  → Branch A = moves 1-2,  Branch B = moves 3-4
                # During the first half, quantum_branch_b_moves stores all moves
                # as a running list; once Branch A is captured it resets to []
                # so it only accumulates second-half moves going forward.
                if room.quantum_phase == "building":
                    initial_dice = len(room.quantum_pre_state.dice.remaining)
                    half_point   = max(1, initial_dice // 2)
                    this_move    = {"from_pos": from_pos, "to_pos": to_pos, "die_value": 0}

                    if room.quantum_branch_a is None:
                        # First half: accumulate moves in quantum_branch_b_moves (temp)
                        room.quantum_branch_b_moves.append(this_move)
                        half_reached = len(room.quantum_branch_b_moves) >= half_point

                        if half_reached or state.phase == Phase.WAITING_ROLL:
                            # Capture Branch A
                            room.quantum_branch_a = extract_board_positions(state)
                            room.quantum_branch_a_moves = list(room.quantum_branch_b_moves)

                            if state.phase == Phase.WAITING_ROLL:
                                # Turn ended early — both branches identical
                                room.quantum_branch_b = room.quantum_branch_a
                                room.quantum_branch_b_moves = []
                                room.quantum_phase = "opponent"
                                opp_state = copy.deepcopy(room.quantum_pre_state)
                                opp_state = _advance_turn(opp_state)
                                opp_state.mode = state.mode
                                room.state = opp_state
                                await room.broadcast({
                                    "type": "quantum_branches",
                                    "state": opp_state.model_dump(),
                                    "players": room.players_info(),
                                    "quantum_player": room.quantum_player,
                                    "branch_a": room.quantum_branch_a,
                                    "branch_b": room.quantum_branch_b,
                                    "branch_a_moves": room.quantum_branch_a_moves,
                                    "branch_b_moves": [],
                                })
                                continue

                            # Branch A captured, switch to second-half tracking
                            room.quantum_branch_b_moves = []  # reset: only second-half from here
                            room.state = state
                            await room.broadcast({
                                "type": "game_state",
                                "state": state.model_dump(),
                                "players": room.players_info(),
                            })
                            continue

                        # Still in first half, need more moves
                        room.state = state
                        await room.broadcast({
                            "type": "game_state",
                            "state": state.model_dump(),
                            "players": room.players_info(),
                        })
                        continue

                    else:
                        # Second half: accumulate second-half moves only
                        room.quantum_branch_b_moves.append(this_move)

                        if state.phase == Phase.WAITING_ROLL:
                            # All dice used — Branch B complete
                            room.quantum_branch_b = extract_board_positions(state)
                            room.quantum_phase = "opponent"
                            opp_state = copy.deepcopy(room.quantum_pre_state)
                            opp_state = _advance_turn(opp_state)
                            opp_state.mode = state.mode
                            room.state = opp_state
                            await room.broadcast({
                                "type": "quantum_branches",
                                "state": opp_state.model_dump(),
                                "players": room.players_info(),
                                "quantum_player": room.quantum_player,
                                "branch_a": room.quantum_branch_a,
                                "branch_b": room.quantum_branch_b,
                                "branch_a_moves": room.quantum_branch_a_moves,
                                "branch_b_moves": room.quantum_branch_b_moves,
                            })
                            continue

                        # Still making second-half moves
                        room.state = state
                        await room.broadcast({
                            "type": "game_state",
                            "state": state.model_dump(),
                            "players": room.players_info(),
                        })
                        continue

                room.state = state

                if state.phase == Phase.GAME_OVER:
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

            # ── Batch Moves (short/long) ──────────────────────────────
            elif msg == "batch_moves":
                if state.phase != Phase.MOVING or state.current_player.value != color:
                    continue
                moves_list = data.get("moves", [])
                error_sent = False
                for mv in moves_list:
                    from_pos = mv.get("from_pos")
                    to_pos   = mv.get("to_pos")
                    valid    = get_valid_moves(state)
                    ok = any(str(m.from_pos) == str(from_pos) and str(m.to_pos) == str(to_pos) for m in valid)
                    if not ok:
                        await websocket.send_text(json.dumps({"type": "error", "message": f"Illegal move in batch: {from_pos}->{to_pos}"}))
                        error_sent = True
                        break
                    state = apply_move(state, from_pos, to_pos)
                    if state.phase == Phase.GAME_OVER:
                        break
                if error_sent:
                    continue
                room.state = state
                if state.phase == Phase.GAME_OVER:
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

            # ── Spy Challenge ─────────────────────────────────────────────
            elif msg == "spy_challenge":
                if not room.spy_window_open:
                    continue
                if color == room.spy_last_mover:
                    continue  # Mover can't challenge their own move

                if room.spy_close_task and not room.spy_close_task.done():
                    room.spy_close_task.cancel()
                room.spy_window_open = False

                state = room.state
                if room.spy_was_illegal:
                    # Caught! Undo: send piece from dest back to mover's bar
                    mover_color = room.spy_last_mover
                    dest_idx = room.spy_last_dest
                    if dest_idx is not None:
                        dest_pt = state.board[dest_idx]
                        if dest_pt.player and dest_pt.player.value == mover_color and dest_pt.count > 0:
                            dest_pt.count -= 1
                            if dest_pt.count == 0:
                                dest_pt.player = None
                            state.bar[mover_color] += 1
                    # Deduct spy token
                    room.spy_tokens[mover_color] = max(0, room.spy_tokens.get(mover_color, 0) - 1)
                    state = _advance_turn(state)
                    result_str = "caught"
                else:
                    # False challenge — move was legal, it stands
                    if not state.dice.remaining or not state.valid_moves:
                        state = _advance_turn(state)
                    result_str = "missed"

                room.state = state
                await room.broadcast({
                    "type": "spy_result",
                    "state": state.model_dump(),
                    "players": room.players_info(),
                    "spy_tokens": room.spy_tokens,
                    "result": result_str,
                })

            # ── Spy Skip ─────────────────────────────────────────────────
            elif msg == "spy_skip":
                if not room.spy_window_open:
                    continue
                if color == room.spy_last_mover:
                    continue  # Only the opponent can skip/decline

                if room.spy_close_task and not room.spy_close_task.done():
                    room.spy_close_task.cancel()
                room.spy_window_open = False

                state = room.state
                if not state.dice.remaining or not state.valid_moves:
                    state = _advance_turn(state)
                room.state = state

                await room.broadcast({
                    "type": "spy_result",
                    "state": state.model_dump(),
                    "players": room.players_info(),
                    "spy_tokens": room.spy_tokens,
                    "result": "timeout",
                })

            # ── Resign ───────────────────────────────────────────────────
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
                        elo_changes = {winner_color: d, color: -d}
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
