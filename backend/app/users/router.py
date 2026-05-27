from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
import uuid
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
    games = result.scalars().all()

    enriched = []
    for g in games:
        is_white = g.white_id == user.id
        opponent_id = g.black_id if is_white else g.white_id
        elo_change = g.elo_change_white if is_white else g.elo_change_black
        result_str = "win" if g.winner_id == user.id else "loss"

        opponent_username = None
        if opponent_id:
            opp_result = await db.execute(select(User).where(User.id == opponent_id))
            opp = opp_result.scalar_one_or_none()
            if opp:
                opponent_username = opp.username

        enriched.append(GameRecord(
            id=g.id,
            mode=g.mode,
            type=g.type,
            opponent_username=opponent_username,
            bot_level=g.bot_level,
            result=result_str,
            elo_change=elo_change,
            created_at=g.created_at,
        ))

    return enriched
