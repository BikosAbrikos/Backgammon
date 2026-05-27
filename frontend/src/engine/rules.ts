import type { GameState, GameMode, Player, MoveOption, PointState } from '../store/gameStore'

function direction(player: Player): number {
  return player === 'white' ? -1 : 1
}

function pointIsBlocked(point: PointState, player: Player, mode: GameMode): boolean {
  if (!point.player || point.player === player) return false
  return mode === 'short' ? point.count >= 2 : point.count >= 1
}

function canBearOff(state: GameState, player: Player): boolean {
  if (state.bar[player] > 0) return false
  const home = player === 'white'
    ? new Set([0, 1, 2, 3, 4, 5])
    : new Set([18, 19, 20, 21, 22, 23])
  for (let i = 0; i < 24; i++) {
    if (state.board[i].player === player && !home.has(i)) return false
  }
  return true
}

function bearOffMoves(state: GameState, player: Player, die: number): MoveOption[] {
  const moves: MoveOption[] = []
  const homeRange = player === 'white' ? [0, 1, 2, 3, 4, 5] : [18, 19, 20, 21, 22, 23]
  const homePoints = homeRange.filter(i => state.board[i].player === player)
  if (!homePoints.length) return moves

  if (player === 'white') {
    for (const idx of homePoints) {
      if (die === idx + 1) moves.push({ from_pos: idx, to_pos: 'off', die_value: die })
    }
    if (!homePoints.some(i => i + 1 === die)) {
      const highest = Math.max(...homePoints)
      if (die > highest + 1) moves.push({ from_pos: highest, to_pos: 'off', die_value: die })
    }
  } else {
    for (const idx of homePoints) {
      if (die === 24 - idx) moves.push({ from_pos: idx, to_pos: 'off', die_value: die })
    }
    if (!homePoints.some(i => 24 - i === die)) {
      const lowest = Math.min(...homePoints)
      if (die > 24 - lowest) moves.push({ from_pos: lowest, to_pos: 'off', die_value: die })
    }
  }
  return moves
}

export function getValidMoves(state: GameState): MoveOption[] {
  const player = state.current_player
  const mode = state.mode
  const moves: MoveOption[] = []
  const seen = new Set<string>()

  function add(m: MoveOption) {
    const key = `${m.from_pos}:${m.to_pos}:${m.die_value}`
    if (!seen.has(key)) { seen.add(key); moves.push(m) }
  }

  const uniqueDice = [...new Set(state.dice.remaining)]

  for (const die of uniqueDice) {
    // Bar re-entry has priority
    if (state.bar[player] > 0) {
      const dest = player === 'white' ? 24 - die : die - 1
      if (dest >= 0 && dest <= 23 && !pointIsBlocked(state.board[dest], player, mode)) {
        add({ from_pos: 'bar', to_pos: dest, die_value: die })
      }
      continue
    }

    // Bearing off
    if (canBearOff(state, player)) {
      const bearOffs = bearOffMoves(state, player, die)
      for (const m of bearOffs) add(m)
      if (!bearOffs.length) {
        // Die can't bear off — allow repositioning within home board
        const dir = direction(player)
        const homeSet = player === 'white'
          ? new Set([0, 1, 2, 3, 4, 5])
          : new Set([18, 19, 20, 21, 22, 23])
        for (const idx of homeSet) {
          const point = state.board[idx]
          if (point.player !== player || point.count === 0) continue
          const dest = idx + dir * die
          if (homeSet.has(dest) && !pointIsBlocked(state.board[dest], player, mode)) {
            add({ from_pos: idx, to_pos: dest, die_value: die })
          }
        }
      }
      continue
    }

    // Normal moves
    const dir = direction(player)
    for (let idx = 0; idx < 24; idx++) {
      const point = state.board[idx]
      if (point.player !== player || point.count === 0) continue
      const dest = idx + dir * die
      if (dest >= 0 && dest <= 23 && !pointIsBlocked(state.board[dest], player, mode)) {
        add({ from_pos: idx, to_pos: dest, die_value: die })
      }
    }
  }

  return moves
}
