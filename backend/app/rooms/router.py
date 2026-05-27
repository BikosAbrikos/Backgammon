import random
import string
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import Room
from ..schemas import CreateRoomRequest, RoomResponse, JoinRoomResponse
from ..auth.deps import get_current_user
from ..models import User
from ..ws.manager import manager

router = APIRouter(prefix="/rooms", tags=["rooms"])


def _gen_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


@router.post("/create", response_model=RoomResponse)
async def create_room(
    req: CreateRoomRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if req.mode not in ("short", "long"):
        raise HTTPException(status_code=400, detail="mode must be 'short' or 'long'")

    # Generate unique code
    code = _gen_code()
    for _ in range(10):
        existing = await db.execute(select(Room).where(Room.code == code))
        if not existing.scalar_one_or_none():
            break
        code = _gen_code()

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    room_ws_id = manager.create_private_room(code, str(user.id), user.username, user.elo, req.mode)

    room = Room(
        code=code,
        creator_id=user.id,
        mode=req.mode,
        expires_at=expires_at,
        room_ws_id=room_ws_id,
    )
    db.add(room)
    await db.commit()
    await db.refresh(room)

    return RoomResponse(room_ws_id=room_ws_id, code=code, expires_at=expires_at)


@router.post("/join/{code}", response_model=JoinRoomResponse)
async def join_room(
    code: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Room).where(Room.code == code.upper()))
    room_record = result.scalar_one_or_none()
    if not room_record:
        raise HTTPException(status_code=404, detail="Room not found")
    if room_record.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Room has expired")

    ws_room = manager.get_room(room_record.room_ws_id)
    if not ws_room:
        raise HTTPException(status_code=410, detail="Room is no longer available")

    return JoinRoomResponse(room_ws_id=room_record.room_ws_id, mode=room_record.mode)
