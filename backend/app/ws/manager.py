from __future__ import annotations
import asyncio
import json
import random
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import WebSocket


class PlayerConn:
    def __init__(self, ws: WebSocket, user_id: str, username: str, elo: int, color: str):
        self.ws = ws
        self.user_id = user_id
        self.username = username
        self.elo = elo
        self.color = color
        self.connected = True


class GameRoom:
    def __init__(self, room_id: str, mode: str, game_type: str):
        self.room_id = room_id
        self.mode = mode
        self.game_type = game_type  # ranked | private
        self.state = None
        self.players: dict[str, PlayerConn] = {}   # color → conn
        self.spectators: list[WebSocket] = []
        self.started_at: datetime | None = None
        self.disconnect_task: asyncio.Task | None = None

        # Spy mode state
        self.spy_tokens: dict = {'white': 3, 'black': 3}
        self.spy_window_open: bool = False
        self.spy_last_mover: str | None = None
        self.spy_last_dest: int | None = None
        self.spy_was_illegal: bool = False
        self.spy_close_task: asyncio.Task | None = None

        # Quantum mode state
        self.quantum_phase: str | None = None          # 'building' | 'opponent'
        self.quantum_player: str | None = None         # 'white' | 'black'
        self.quantum_pre_state = None                  # GameState snapshot after dice roll
        self.quantum_branch_a: dict | None = None      # Branch A final positions
        self.quantum_branch_b: dict | None = None      # Branch B final positions
        self.quantum_branch_a_moves: list = []         # Moves made in Branch A
        self.quantum_branch_b_moves: list = []         # Moves auto-generated for Branch B

    def players_info(self) -> dict:
        return {
            color: {"username": c.username, "elo": c.elo}
            for color, c in self.players.items()
        }

    async def broadcast(self, msg: dict) -> None:
        text = json.dumps(msg, default=str)
        dead: list[str] = []
        for color, conn in self.players.items():
            if conn.connected:
                try:
                    await conn.ws.send_text(text)
                except Exception:
                    conn.connected = False
                    dead.append(color)
        for ws in list(self.spectators):
            try:
                await ws.send_text(text)
            except Exception:
                self.spectators.remove(ws)


class QueueEntry:
    def __init__(self, ws: WebSocket, user_id: str, username: str, elo: int, mode: str):
        self.ws = ws
        self.user_id = user_id
        self.username = username
        self.elo = elo
        self.mode = mode
        self.joined_at = datetime.now(timezone.utc)


class ConnectionManager:
    def __init__(self):
        self.queue: list[QueueEntry] = []
        self.rooms: dict[str, GameRoom] = {}     # room_id → room
        self._code_map: dict[str, str] = {}       # code → room_id
        self._loop_task: asyncio.Task | None = None

    def start_matchmaking(self):
        if not self._loop_task or self._loop_task.done():
            self._loop_task = asyncio.create_task(self._matchmaking_loop())

    async def _matchmaking_loop(self):
        while True:
            await asyncio.sleep(2)
            await self._try_match()

    async def _try_match(self):
        if len(self.queue) < 2:
            return

        now = datetime.now(timezone.utc)
        matched: tuple[int, int] | None = None

        for i, a in enumerate(self.queue):
            wait = (now - a.joined_at).total_seconds()
            window = min(150 + int(wait / 15) * 50, 600)  # expand elo window every 15s
            for j, b in enumerate(self.queue):
                if i >= j:
                    continue
                if a.mode != b.mode:
                    continue
                if wait < 90 and abs(a.elo - b.elo) > window:
                    continue
                matched = (i, j)
                break
            if matched:
                break

        if not matched:
            return

        i, j = matched
        a, b = self.queue[i], self.queue[j]
        self.queue = [e for k, e in enumerate(self.queue) if k not in (i, j)]

        room_id = str(uuid.uuid4())
        room = GameRoom(room_id, a.mode, "ranked")
        self.rooms[room_id] = room

        white_e, black_e = (a, b) if random.random() < 0.5 else (b, a)
        room.players["white"] = PlayerConn(white_e.ws, white_e.user_id, white_e.username, white_e.elo, "white")
        room.players["black"] = PlayerConn(black_e.ws, black_e.user_id, black_e.username, black_e.elo, "black")
        room.started_at = now

        try:
            await white_e.ws.send_text(json.dumps({
                "type": "match_found",
                "room_id": room_id,
                "color": "white",
                "opponent": {"username": black_e.username, "elo": black_e.elo},
            }))
            await black_e.ws.send_text(json.dumps({
                "type": "match_found",
                "room_id": room_id,
                "color": "black",
                "opponent": {"username": white_e.username, "elo": white_e.elo},
            }))
        except Exception:
            pass  # player disconnected before match confirmed

    def create_private_room(self, code: str, creator_id: str, username: str, elo: int, mode: str) -> str:
        room_id = str(uuid.uuid4())
        room = GameRoom(room_id, mode, "private")
        self.rooms[room_id] = room
        self._code_map[code.upper()] = room_id
        return room_id

    def get_room(self, room_id: str) -> GameRoom | None:
        return self.rooms.get(room_id)

    async def join_queue(self, entry: QueueEntry):
        self.queue.append(entry)
        try:
            await entry.ws.send_text(json.dumps({"type": "queue_joined"}))
        except Exception:
            pass

    async def leave_queue(self, ws: WebSocket):
        self.queue = [e for e in self.queue if e.ws is not ws]

    async def cleanup_room(self, room_id: str):
        room = self.rooms.pop(room_id, None)
        if room:
            for code, rid in list(self._code_map.items()):
                if rid == room_id:
                    del self._code_map[code]


manager = ConnectionManager()
