import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import create_tables
from .auth.router import router as auth_router
from .users.router import router as users_router
from .friends.router import router as friends_router
from .rooms.router import router as rooms_router
from .ws.router import router as ws_router
from .ws.manager import manager

FRONTEND_URL = os.getenv("FRONTEND_URL", "*")
ALLOWED_ORIGINS = [FRONTEND_URL] if FRONTEND_URL != "*" else ["*"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    manager.start_matchmaking()
    yield


app = FastAPI(title="Backgammon Pro API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(friends_router)
app.include_router(rooms_router)
app.include_router(ws_router)


@app.get("/health")
def health():
    return {"status": "ok"}


# ── Legacy single-player endpoint (still used by local/bot frontend games) ───

from .engine.state import GameState, NewGameRequest
from .engine.setup import create_initial_state
from .engine.rules import get_valid_moves

_current_game: GameState | None = None


@app.post("/game/new", response_model=GameState)
def new_game(request: NewGameRequest):
    global _current_game
    state = create_initial_state(request.mode)
    state.valid_moves = get_valid_moves(state)
    _current_game = state
    return _current_game
