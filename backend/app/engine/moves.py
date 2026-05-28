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
    elif from_pos == "bar":
        # Bar re-entry die: WHITE enters at 24-die, BLACK enters at die-1
        if player == Player.WHITE:
            die = 24 - int(to_pos)
        else:
            die = int(to_pos) + 1
        if die in remaining:
            return die
        return remaining[0]
    else:
        needed = abs(int(to_pos) - int(from_pos))
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
        if (state.mode in (GameMode.SHORT, GameMode.QUANTUM, GameMode.SPY)
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


def apply_spy_move(state: GameState, from_pos, to_pos) -> GameState:
    """Move a checker to any position without rule validation (spy illegal move)."""
    state = copy.deepcopy(state)
    player = state.current_player

    # Remove from source
    if from_pos == "bar":
        state.bar[player.value] -= 1
    else:
        src = state.board[int(from_pos)]
        src.count -= 1
        if src.count == 0:
            src.player = None

    # Place at destination without legality checks
    dest_idx = int(to_pos)
    dest = state.board[dest_idx]
    dest.count += 1
    dest.player = player

    # Consume a die (first available)
    if state.dice.remaining:
        state.dice.remaining.pop(0)

    state.valid_moves = get_valid_moves(state)
    # Do NOT auto-advance turn — spy moves have a challenge window
    return state


def extract_board_positions(state: GameState) -> dict:
    """Serialize board/bar/off positions for quantum branch storage."""
    return {
        "board": [
            {"count": p.count, "player": p.player.value if p.player else None}
            for p in state.board
        ],
        "bar": dict(state.bar),
        "off": dict(state.off),
    }


def generate_random_branch(pre_state: GameState) -> dict:
    """Generate a random complete move sequence from pre_state for Branch B."""
    import random as _rnd
    state = copy.deepcopy(pre_state)
    moves: list[dict] = []
    safety = 0
    while state.phase.value == "moving" and state.valid_moves and safety < 20:
        m = _rnd.choice(state.valid_moves)
        moves.append({"from_pos": m.from_pos, "to_pos": m.to_pos, "die_value": m.die_value})
        state = apply_move(state, m.from_pos, m.to_pos)
        safety += 1
    return {"positions": extract_board_positions(state), "moves": moves}


def collapse_quantum(current: GameState, branch: dict, quantum_player_str: str) -> GameState:
    """Merge the quantum player's pieces from the chosen branch into the current board."""
    state = copy.deepcopy(current)
    qp_str = quantum_player_str
    opp_str = "black" if qp_str == "white" else "white"
    qp = Player(qp_str)
    opp = Player(opp_str)

    # Remove quantum player's pieces from current board
    for pt in state.board:
        if pt.player == qp:
            pt.count = 0
            pt.player = None
    state.bar[qp_str] = 0
    state.off[qp_str] = 0

    # Place them from the chosen branch
    for i, bp in enumerate(branch["board"]):
        if bp["player"] == qp_str and bp["count"] > 0:
            dest = state.board[i]
            # Quantum hit: if opponent has single blot here, send to bar
            if dest.player == opp and dest.count == 1:
                state.bar[opp_str] += 1
                dest.count = 0
                dest.player = None
            # Only place if not blocked by 2+ opponent pieces
            if not (dest.player == opp and dest.count >= 2):
                dest.count = bp["count"]
                dest.player = qp
    state.bar[qp_str] = branch["bar"][qp_str]
    state.off[qp_str] = branch["off"][qp_str]

    state.valid_moves = get_valid_moves(state)
    return state
