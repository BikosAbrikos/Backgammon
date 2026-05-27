from __future__ import annotations
from enum import Enum
from typing import Optional, Union
from pydantic import BaseModel


class Player(str, Enum):
    WHITE = "white"
    BLACK = "black"


class GameMode(str, Enum):
    LONG = "long"
    SHORT = "short"


class Phase(str, Enum):
    WAITING_ROLL = "waiting_roll"
    MOVING = "moving"
    GAME_OVER = "game_over"


class PointState(BaseModel):
    count: int
    player: Optional[Player] = None


class DiceState(BaseModel):
    values: list[int] = []
    remaining: list[int] = []


class MoveOption(BaseModel):
    from_pos: Union[int, str]
    to_pos: Union[int, str]
    die_value: int


class GameState(BaseModel):
    mode: GameMode
    board: list[PointState]
    bar: dict[str, int]
    off: dict[str, int]
    current_player: Player
    dice: DiceState
    phase: Phase
    winner: Optional[Player] = None
    valid_moves: list[MoveOption] = []


class NewGameRequest(BaseModel):
    mode: GameMode


class MoveRequest(BaseModel):
    from_pos: Union[int, str]
    to_pos: Union[int, str]
