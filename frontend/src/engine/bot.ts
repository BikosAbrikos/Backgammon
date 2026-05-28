import type { GameState, MoveOption, Player } from '../store/gameStore'
import { getValidMoves } from './rules'
import { applyMove } from './moves'

export type BotLevel = 'beginner' | 'medium' | 'advanced'

function pipCount(state: GameState, player: Player): number {
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

// Evaluates the full board state for the given player (higher = better for that player)
function scoreState(state: GameState, forPlayer: Player): number {
  const opp = forPlayer === 'white' ? 'black' : 'white'
  let score = 0

  // Pip count advantage is the primary metric
  score += pipCount(state, opp) - pipCount(state, forPlayer)

  // Bar penalties / bonuses
  score -= state.bar[forPlayer] * 8
  score += state.bar[opp] * 5

  // Bearing off bonus
  score += state.off[forPlayer] * 6

  // Scan board for primes, blots, points
  let primeLen = 0, maxPrime = 0
  for (let i = 0; i < 24; i++) {
    const pt = state.board[i]

    // Count consecutive blocked points (prime)
    if (pt.player === forPlayer && pt.count >= 2) {
      primeLen++
      if (primeLen > maxPrime) maxPrime = primeLen
    } else {
      primeLen = 0
    }

    // Exposed blots
    if (pt.player === forPlayer && pt.count === 1) {
      const inOppHome = forPlayer === 'white' ? i >= 18 : i <= 5
      score -= inOppHome ? 6 : 2
    }

    // Points made in home board (very strong)
    if (pt.player === forPlayer && pt.count >= 2) {
      const inHome = forPlayer === 'white' ? i <= 5 : i >= 18
      if (inHome) score += 2
    }
  }

  score += maxPrime * 5

  return score
}

export function botChooseMove(state: GameState, level: BotLevel): MoveOption | null {
  const moves = getValidMoves(state)
  if (!moves.length) return null

  if (level === 'beginner') return moves[Math.floor(Math.random() * moves.length)]

  if (level === 'medium') {
    return moves.reduce((best, m) =>
      mediumScore(m, state) > mediumScore(best, state) ? m : best, moves[0])
  }

  // Advanced: score the resulting board state after each move
  const forPlayer = state.current_player
  let bestScore = -Infinity
  let bestMove = moves[0]
  for (const m of moves) {
    const after = applyMove(state, m.from_pos, m.to_pos)
    const s = scoreState(after, forPlayer)
    if (s > bestScore) { bestScore = s; bestMove = m }
  }
  return bestMove
}

export function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
