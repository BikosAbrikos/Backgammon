import copy
from .state import GameState, GameMode, MoveRequest, Player, Phase
from .rules import get_valid_moves, _opponent


def _advance_turn(state: GameState) -> GameState:
    opp = _opponent(state.current_player)
    state.current_player = opp
    state.dice.values = []
    state.dice.remaining = []
    state.phase = Phase.WAITING_ROLL
    state.valid_moves = []
    return state


def _select_die(remaining: list[int], from_pos, to_pos, player: Player) -> int:
    """Pick the die to consume for this move."""
    if to_pos == "off":
        if player == Player.WHITE:
            dist = (from_pos + 1) if isinstance(from_pos, int) else 0
        else:
            dist = (24 - from_pos) if isinstance(from_pos, int) else 0
        # Prefer exact match first
        for d in remaining:
            if d == dist:
                return d
        # Overshoot: smallest die larger than dist
        larger = sorted([d for d in remaining if d > dist])
        if larger:
            return larger[0]
        return remaining[0]
    else:
        needed = abs(int(to_pos) - (int(from_pos) if from_pos != "bar" else 0))
        for d in remaining:
            if d == needed:
                return d
        return remaining[0]


def apply_move(state: GameState, from_pos, to_pos) -> GameState:
    state = copy.deepcopy(state)
    player = state.current_player
    opp = _opponent(player)

    # Find which die to consume
    die = _select_die(state.dice.remaining, from_pos, to_pos, player)

    # Remove checker from source
    if from_pos == "bar":
        state.bar[player.value] -= 1
    else:
        src = state.board[int(from_pos)]
        src.count -= 1
        if src.count == 0:
            src.player = None

    # Handle destination
    if to_pos == "off":
        state.off[player.value] += 1
    else:
        dest_idx = int(to_pos)
        dest = state.board[dest_idx]
        if (state.mode == GameMode.SHORT
                and dest.player == opp
                and dest.count == 1):
            # Hit the blot — send opponent to bar
            state.bar[opp.value] += 1
            dest.count = 0
            dest.player = None
        dest.count += 1
        dest.player = player

    # Consume die
    idx = state.dice.remaining.index(die)
    state.dice.remaining.pop(idx)

    # Check win condition
    if state.off[player.value] == 15:
        state.phase = Phase.GAME_OVER
        state.winner = player
        state.valid_moves = []
        return state

    # Recompute valid moves for remaining dice
    state.valid_moves = get_valid_moves(state)

    # Advance turn if no dice left or no valid moves
    if not state.dice.remaining or not state.valid_moves:
        state = _advance_turn(state)

    return state
