import type { GameState, Player } from '../store/gameStore'
import { getValidMoves } from './rules'

function opponent(player: Player): Player {
  return player === 'white' ? 'black' : 'white'
}

function selectDie(
  remaining: number[],
  fromPos: number | 'bar',
  toPos: number | 'off',
  player: Player,
): number {
  if (toPos === 'off') {
    const dist = typeof fromPos === 'number'
      ? (player === 'white' ? fromPos + 1 : 24 - fromPos)
      : 0
    for (const d of remaining) if (d === dist) return d
    const larger = remaining.filter(d => d > dist).sort((a, b) => a - b)
    if (larger.length) return larger[0]
    return remaining[0]
  }
  if (fromPos === 'bar') {
    const die = player === 'white' ? 24 - (toPos as number) : (toPos as number) + 1
    if (remaining.includes(die)) return die
    return remaining[0]
  }
  const needed = Math.abs((toPos as number) - (fromPos as number))
  for (const d of remaining) if (d === needed) return d
  return remaining[0]
}

export function advanceTurn(state: GameState): GameState {
  return {
    ...state,
    current_player: opponent(state.current_player),
    dice: { values: [], remaining: [] },
    phase: 'waiting_roll',
    valid_moves: [],
  }
}

export function applyMove(
  state: GameState,
  fromPos: number | 'bar',
  toPos: number | 'off',
): GameState {
  // Deep copy via JSON so we never mutate the stored state
  state = JSON.parse(JSON.stringify(state)) as GameState
  const player = state.current_player
  const opp = opponent(player)

  const die = selectDie(state.dice.remaining, fromPos, toPos, player)

  // Remove checker from source
  if (fromPos === 'bar') {
    state.bar[player]--
  } else {
    const src = state.board[fromPos]
    src.count--
    if (src.count === 0) src.player = null
  }

  // Apply to destination
  if (toPos === 'off') {
    state.off[player]++
  } else {
    const dest = state.board[toPos]
    if ((state.mode === 'short' || state.mode === 'quantum') && dest.player === opp && dest.count === 1) {
      state.bar[opp]++
      dest.count = 0
      dest.player = null
    }
    dest.count++
    dest.player = player
  }

  // Consume die
  const idx = state.dice.remaining.indexOf(die)
  state.dice.remaining.splice(idx, 1)

  // Check win
  if (state.off[player] === 15) {
    return { ...state, phase: 'game_over', winner: player, valid_moves: [] }
  }

  // Recompute valid moves
  state.valid_moves = getValidMoves(state)

  // Advance turn if no dice left or no valid moves remain
  if (!state.dice.remaining.length || !state.valid_moves.length) {
    return advanceTurn(state)
  }

  return state
}

// Spy mode: apply a move that may be illegal (ignores direction/distance/blocking rules).
// Consumes the smallest remaining die. Does NOT advance the turn — the challenge
// window must close first (handled by gameStore.closeChallengeWindow).
export function applySpyMove(
  state: GameState,
  fromPos: number | 'bar',
  toPos: number,
): GameState {
  state = JSON.parse(JSON.stringify(state)) as GameState
  const player = state.current_player
  const opp = opponent(player)

  // Consume smallest remaining die
  const die = Math.min(...state.dice.remaining)
  const dieIdx = state.dice.remaining.indexOf(die)
  state.dice.remaining.splice(dieIdx, 1)

  // Remove from source
  if (fromPos === 'bar') {
    state.bar[player]--
  } else {
    const src = state.board[fromPos]
    src.count--
    if (src.count === 0) src.player = null
  }

  // Place at destination
  const dest = state.board[toPos]
  if (dest.player === opp && dest.count === 1) {
    // Hit a blot — send opponent to bar
    state.bar[opp]++
    dest.count = 0
    dest.player = null
    dest.count++
    dest.player = player
  } else if (dest.player === opp && dest.count >= 2) {
    // Doubly-blocked point — piece physically can't land; hold on bar temporarily
    state.bar[player]++
  } else {
    dest.count++
    dest.player = player
  }

  // Check win (unlikely but possible)
  if (state.off[player] === 15) {
    return { ...state, phase: 'game_over', winner: player, valid_moves: [] }
  }

  state.valid_moves = getValidMoves(state)
  return state
}
