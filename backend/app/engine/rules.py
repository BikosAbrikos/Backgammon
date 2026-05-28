from .state import GameState, GameMode, MoveOption, Player, PointState


def _opponent(player: Player) -> Player:
    return Player.BLACK if player == Player.WHITE else Player.WHITE


def _direction(player: Player) -> int:
    return -1 if player == Player.WHITE else 1


def _point_is_blocked(point: PointState, player: Player, mode: GameMode) -> bool:
    """Return True if the destination point is blocked for the given player."""
    if point.player is None or point.player == player:
        return False
    if mode in (GameMode.SHORT, GameMode.QUANTUM, GameMode.SPY):
        return point.count >= 2
    else:
        return point.count >= 1


def _can_bear_off(state: GameState, player: Player) -> bool:
    """True if all checkers are in the home board (no checkers on bar or outside home)."""
    if state.bar[player.value] > 0:
        return False
    home = range(0, 6) if player == Player.WHITE else range(18, 24)
    for i, point in enumerate(state.board):
        if point.player == player and i not in home:
            return False
    return True


def _bear_off_moves(state: GameState, player: Player, die: int) -> list[MoveOption]:
    """Generate bearing off moves for a given die value."""
    moves: list[MoveOption] = []
    home = range(0, 6) if player == Player.WHITE else range(18, 24)
    home_points = [i for i in home if state.board[i].player == player]

    if not home_points:
        return moves

    if player == Player.WHITE:
        # WHITE bears off from low indices; distance = index + 1 (point 0 needs die=1)
        for idx in home_points:
            dist = idx + 1
            if die == dist:
                moves.append(MoveOption(from_pos=idx, to_pos="off", die_value=die))

        # Overshoot: use die if no exact match and die > all distances
        exact_exists = any((i + 1) == die for i in home_points)
        if not exact_exists:
            # Can bear off highest occupied point if die is larger than its distance
            highest = max(home_points)
            if die > highest + 1:
                moves.append(MoveOption(from_pos=highest, to_pos="off", die_value=die))
    else:
        # BLACK bears off from high indices; distance = 24 - index (point 23 needs die=1)
        for idx in home_points:
            dist = 24 - idx
            if die == dist:
                moves.append(MoveOption(from_pos=idx, to_pos="off", die_value=die))

        exact_exists = any((24 - i) == die for i in home_points)
        if not exact_exists:
            lowest = min(home_points)
            if die > 24 - lowest:
                moves.append(MoveOption(from_pos=lowest, to_pos="off", die_value=die))

    return moves


def get_valid_moves(state: GameState) -> list[MoveOption]:
    player = state.current_player
    mode = state.mode
    moves: list[MoveOption] = []
    seen: set[tuple] = set()

    def add(m: MoveOption) -> None:
        key = (m.from_pos, m.to_pos, m.die_value)
        if key not in seen:
            seen.add(key)
            moves.append(m)

    unique_dice = list(dict.fromkeys(state.dice.remaining))

    for die in unique_dice:
        # Bar re-entry takes priority
        if state.bar[player.value] > 0:
            if player == Player.WHITE:
                dest = 24 - die  # WHITE enters BLACK's home board (indices 18-23)
            else:
                dest = die - 1  # BLACK enters WHITE's home board (indices 0-5)
            if 0 <= dest <= 23 and not _point_is_blocked(state.board[dest], player, mode):
                add(MoveOption(from_pos="bar", to_pos=dest, die_value=die))
            continue

        # Bearing off
        if _can_bear_off(state, player):
            bear_offs = _bear_off_moves(state, player, die)
            for m in bear_offs:
                add(m)
            # If this die can't bear off, allow moving within home board
            if not bear_offs:
                direction = _direction(player)
                home = range(0, 6) if player == Player.WHITE else range(18, 24)
                for idx in home:
                    point = state.board[idx]
                    if point.player != player or point.count == 0:
                        continue
                    dest = idx + direction * die
                    if dest in home and not _point_is_blocked(state.board[dest], player, mode):
                        add(MoveOption(from_pos=idx, to_pos=dest, die_value=die))
            continue

        # Normal moves
        direction = _direction(player)
        for idx, point in enumerate(state.board):
            if point.player != player or point.count == 0:
                continue
            dest = idx + direction * die
            if 0 <= dest <= 23 and not _point_is_blocked(state.board[dest], player, mode):
                add(MoveOption(from_pos=idx, to_pos=dest, die_value=die))

    return moves
