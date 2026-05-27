import type { GameState, MoveOption } from '../store/gameStore'
import { getValidMoves } from './rules'

export type BotLevel = 'beginner' | 'medium' | 'advanced'

function pipCount(state: GameState, player: 'white' | 'black'): number {
  let pips = 0
  for (let i = 0; i < 24; i++) {
    const pt = state.board[i]
    if (pt.player !== player) continue
    pips += pt.count * (player === 'white' ? i + 1 : 24 - i)
  }
  pips += state.bar[player] * 25
  return pips
}

function mediumScore(move: MoveOption, state: GameState): number {
  const player = state.current_player
  const opp = player === 'white' ? 'black' : 'white'
  let score = 0

  if (move.to_pos === 'off') return 4

  const dest = typeof move.to_pos === 'number' ? state.board[move.to_pos] : null
  if (dest) {
    if (dest.player === opp && dest.count === 1 && state.mode === 'short') score += 5
    if (dest.player === player && dest.count >= 1) score += 3
  }

  if (typeof move.from_pos === 'number') {
    const src = state.board[move.from_pos]
    if (src.count === 1) {
      const dangerous = player === 'white' ? move.from_pos > 17 : move.from_pos < 6
      if (dangerous) score -= 3
    }
  }
  return score
}

function advancedScore(move: MoveOption, state: GameState): number {
  const player = state.current_player
  const opp = player === 'white' ? 'black' : 'white'

  if (move.to_pos === 'off') return pipCount(state, opp) - pipCount(state, player) + 15

  let score = pipCount(state, opp) - pipCount(state, player)
  const destIdx = typeof move.to_pos === 'number' ? move.to_pos : -1
  if (destIdx >= 0) {
    const dest = state.board[destIdx]
    if (dest.player === opp && dest.count === 1 && state.mode === 'short') score += 6
    if (dest.player === player && dest.count >= 1) {
      // Bonus for creating/extending primes
      let run = 1
      let k = destIdx + 1
      while (k < 24 && state.board[k].player === player && state.board[k].count >= 2) { run++; k++ }
      k = destIdx - 1
      while (k >= 0 && state.board[k].player === player && state.board[k].count >= 2) { run++; k-- }
      if (run >= 3) score += run * 3
    }
    // Penalise blots left in dangerous zone
    if (typeof move.from_pos === 'number' && state.board[move.from_pos].count === 1) {
      const danger = player === 'white' ? destIdx > 17 : destIdx < 6
      if (danger) score -= 5
    }
  }
  return score
}

export function botChooseMove(state: GameState, level: BotLevel): MoveOption | null {
  const moves = getValidMoves(state)
  if (!moves.length) return null

  if (level === 'beginner') return moves[Math.floor(Math.random() * moves.length)]

  const scorer = level === 'medium' ? mediumScore : advancedScore
  return moves.reduce((best, m) => scorer(m, state) > scorer(best, state) ? m : best, moves[0])
}

export function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
