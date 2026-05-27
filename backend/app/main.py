from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .engine.state import GameState, NewGameRequest, MoveRequest, Phase
from .engine.setup import create_initial_state
from .engine.dice import roll_dice
from .engine.moves import apply_move, _advance_turn
from .engine.rules import get_valid_moves

app = FastAPI(title="Backgammon API")


@app.get("/health")
def health():
    return {"status": "ok"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

current_game: GameState | None = None


@app.post("/game/new", response_model=GameState)
def new_game(request: NewGameRequest):
    global current_game
    state = create_initial_state(request.mode)
    state.valid_moves = get_valid_moves(state)
    current_game = state
    return current_game


@app.post("/game/roll", response_model=GameState)
def roll():
    global current_game
    if current_game is None:
        raise HTTPException(status_code=404, detail="No active game")
    if current_game.phase != Phase.WAITING_ROLL:
        raise HTTPException(status_code=400, detail="Not in roll phase")
    current_game.dice = roll_dice()
    current_game.phase = Phase.MOVING
    current_game.valid_moves = get_valid_moves(current_game)
    if not current_game.valid_moves:
        current_game = _advance_turn(current_game)
    return current_game


@app.post("/game/move", response_model=GameState)
def make_move(request: MoveRequest):
    global current_game
    if current_game is None:
        raise HTTPException(status_code=404, detail="No active game")
    if current_game.phase != Phase.MOVING:
        raise HTTPException(status_code=400, detail="Not in moving phase")
    valid = get_valid_moves(current_game)
    is_valid = any(
        str(m.from_pos) == str(request.from_pos) and str(m.to_pos) == str(request.to_pos)
        for m in valid
    )
    if not is_valid:
        raise HTTPException(status_code=400, detail="Illegal move")
    current_game = apply_move(current_game, request.from_pos, request.to_pos)
    return current_game


@app.get("/game/state", response_model=GameState)
def get_state():
    if current_game is None:
        raise HTTPException(status_code=404, detail="No active game")
    return current_game
