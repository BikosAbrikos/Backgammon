from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from ..database import get_db
from ..models import User, Game
from ..schemas import UserPublic, GameRecord

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/leaderboard", response_model=list[UserPublic])
async def leaderboard(limit: int = Query(50, le=100), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.elo.desc()).limit(limit))
    return [UserPublic.model_validate(u) for u in result.scalars()]


@router.get("/{username}", response_model=UserPublic)
async def get_profile(username: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserPublic.model_validate(user)


@router.get("/{username}/history", response_model=list[GameRecord])
async def get_history(
    username: str,
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db),
):
    user_result = await db.execute(select(User).where(User.username == username))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    offset = (page - 1) * 20
    result = await db.execute(
        select(Game)
        .where(or_(Game.white_id == user.id, Game.black_id == user.id))
        .order_by(Game.created_at.desc())
        .offset(offset)
        .limit(20)
    )
    return [GameRecord.model_validate(g) for g in result.scalars()]
