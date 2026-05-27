import type { DiceState } from '../store/gameStore'

export function rollDice(): DiceState {
  const d1 = Math.ceil(Math.random() * 6)
  const d2 = Math.ceil(Math.random() * 6)
  return {
    values: [d1, d2],
    remaining: d1 === d2 ? [d1, d1, d1, d1] : [d1, d2],
  }
}
