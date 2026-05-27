from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from ..database import get_db
from ..models import User, Friend
from ..schemas import FriendRecord, FriendRequestBody
from ..auth.deps import get_current_user
import uuid

router = APIRouter(prefix="/friends", tags=["friends"])


async def _enrich(f: Friend, db: AsyncSession, viewer_id: uuid.UUID) -> FriendRecord:
    other_id = f.requestee_id if f.requester_id == viewer_id else f.requester_id
    result = await db.execute(select(User).where(User.id == other_id))
    other = result.scalar_one_or_none()
    rec = FriendRecord.model_validate(f)
    if other:
        rec.username = other.username
        rec.elo = other.elo
        rec.avatar = other.avatar
    return rec


@router.get("/list", response_model=list[FriendRecord])
async def list_friends(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Friend).where(
            or_(Friend.requester_id == user.id, Friend.requestee_id == user.id)
        )
    )
    friends = result.scalars().all()
    return [await _enrich(f, db, user.id) for f in friends]


@router.post("/request", response_model=FriendRecord)
async def send_request(
    body: FriendRequestBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.username == user.username:
        raise HTTPException(status_code=400, detail="Cannot friend yourself")

    target_result = await db.execute(select(User).where(User.username == body.username))
    target = target_result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.execute(
        select(Friend).where(
            or_(
                and_(Friend.requester_id == user.id, Friend.requestee_id == target.id),
                and_(Friend.requester_id == target.id, Friend.requestee_id == user.id),
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Friend relation already exists")

    f = Friend(requester_id=user.id, requestee_id=target.id)
    db.add(f)
    await db.commit()
    await db.refresh(f)
    return await _enrich(f, db, user.id)


@router.post("/accept/{friend_id}", response_model=FriendRecord)
async def accept_request(
    friend_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Friend).where(Friend.id == friend_id))
    f = result.scalar_one_or_none()
    if not f or f.requestee_id != user.id:
        raise HTTPException(status_code=404, detail="Friend request not found")
    if f.status != "pending":
        raise HTTPException(status_code=400, detail="Already responded")
    f.status = "accepted"
    await db.commit()
    await db.refresh(f)
    return await _enrich(f, db, user.id)


@router.delete("/{friend_id}")
async def remove_friend(
    friend_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Friend).where(Friend.id == friend_id))
    f = result.scalar_one_or_none()
    if not f or (f.requester_id != user.id and f.requestee_id != user.id):
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(f)
    await db.commit()
    return {"ok": True}
