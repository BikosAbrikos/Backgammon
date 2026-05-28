from .state import GameMode, GameState, Player, Phase, PointState, DiceState


def create_initial_board(mode: GameMode) -> list[PointState]:
    board = [PointState(count=0, player=None) for _ in range(24)]

    if mode in (GameMode.SHORT, GameMode.QUANTUM, GameMode.SPY):
        # Standard Western backgammon spread
        # WHITE (moves 23→0): home board is 0-5
        board[23] = PointState(count=2, player=Player.WHITE)
        board[12] = PointState(count=5, player=Player.WHITE)
        board[7] = PointState(count=3, player=Player.WHITE)
        board[5] = PointState(count=5, player=Player.WHITE)
        # BLACK (moves 0→23): home board is 18-23
        board[0] = PointState(count=2, player=Player.BLACK)
        board[11] = PointState(count=5, player=Player.BLACK)
        board[16] = PointState(count=3, player=Player.BLACK)
        board[18] = PointState(count=5, player=Player.BLACK)
    else:
        # Long Backgammon: all checkers stacked at starting points
        # WHITE at 23, BLACK at 0, moving in opposite directions
        board[23] = PointState(count=15, player=Player.WHITE)
        board[0] = PointState(count=15, player=Player.BLACK)

    return board


def create_initial_state(mode: GameMode) -> GameState:
    board = create_initial_board(mode)
    return GameState(
        mode=mode,
        board=board,
        bar={"white": 0, "black": 0},
        off={"white": 0, "black": 0},
        current_player=Player.WHITE,
        dice=DiceState(values=[], remaining=[]),
        phase=Phase.WAITING_ROLL,
        winner=None,
        valid_moves=[],
    )
