from __future__ import annotations
from pydantic import BaseModel, field_validator
from datetime import datetime
import uuid
from typing import Optional


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if not (3 <= len(v) <= 32):
            raise ValueError("Username must be 3–32 characters")
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username may only contain letters, digits, - and _")
        return v

    @field_validator("password")
    @classmethod
    def password_valid(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str


class UserPublic(BaseModel):
    id: uuid.UUID
    username: str
    elo: int
    games_played: int
    games_won: int
    win_streak: int
    avatar: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    user: UserPublic


# ── Games ─────────────────────────────────────────────────────────────────────

class GameRecord(BaseModel):
    id: uuid.UUID
    mode: str
    type: str
    opponent_username: Optional[str] = None
    bot_level: Optional[str] = None
    result: str          # 'win' | 'loss'
    elo_change: int      # signed: positive = gained, negative = lost
    created_at: datetime

    model_config = {"from_attributes": False}


# ── Friends ───────────────────────────────────────────────────────────────────

class FriendRecord(BaseModel):
    id: uuid.UUID
    requester_id: uuid.UUID
    requestee_id: uuid.UUID
    status: str
    direction: str = "sent"   # 'sent' | 'received' — overwritten by router
    created_at: datetime
    # Enriched fields added by router
    username: Optional[str] = None
    elo: Optional[int] = None
    avatar: Optional[str] = None

    model_config = {"from_attributes": True}


class FriendRequestBody(BaseModel):
    username: str


# ── Rooms ─────────────────────────────────────────────────────────────────────

class CreateRoomRequest(BaseModel):
    mode: str


class RoomResponse(BaseModel):
    room_ws_id: str
    code: str
    expires_at: datetime


class JoinRoomResponse(BaseModel):
    room_ws_id: str
    mode: str
