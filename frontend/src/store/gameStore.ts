import { create } from 'zustand'
import axios from 'axios'
import { rollDice as localRollDice } from '../engine/dice'
import { getValidMoves } from '../engine/rules'
import { applyMove, advanceTurn } from '../engine/moves'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const api = axios.create({ baseURL: API_BASE })

export type Player = 'white' | 'black'
export type GameMode = 'long' | 'short'
export type Phase = 'waiting_roll' | 'moving' | 'game_over'

export interface PointState {
  count: number
  player: Player | null
}

export interface DiceState {
  values: number[]
  remaining: number[]
}

export interface MoveOption {
  from_pos: number | 'bar'
  to_pos: number | 'off'
  die_value: number
}

export interface GameState {
  mode: GameMode
  board: PointState[]
  bar: Record<Player, number>
  off: Record<Player, number>
  current_player: Player
  dice: DiceState
  phase: Phase
  winner: Player | null
  valid_moves: MoveOption[]
}

interface GameStore {
  gameState: GameState | null
  selectedPoint: number | 'bar' | null
  isRolling: boolean
  startGame: (mode: GameMode) => Promise<void>
  rollDice: () => void
  selectPoint: (point: number | 'bar') => void
  clearSelection: () => void
  moveTo: (to: number | 'off') => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  selectedPoint: null,
  isRolling: false,

  // Backend only used here — gets the authoritative initial board layout
  startGame: async (mode) => {
    const { data } = await api.post<GameState>('/game/new', { mode })
    set({ gameState: data, selectedPoint: null })
  },

  // Dice rolled locally — instant, no network round-trip
  rollDice: () => {
    const { gameState } = get()
    if (!gameState || gameState.phase !== 'waiting_roll') return

    const dice = localRollDice()
    let next: GameState = { ...gameState, dice, phase: 'moving' }
    next.valid_moves = getValidMoves(next)
    if (!next.valid_moves.length) {
      next = advanceTurn(next)
    }

    // Show dice immediately so the rolling animation plays against real values
    set({ isRolling: true, gameState: next, selectedPoint: null })
    setTimeout(() => set({ isRolling: false }), 520)
  },

  selectPoint: (point) => {
    const { gameState, selectedPoint } = get()
    if (!gameState || gameState.phase !== 'moving') return

    if (selectedPoint === point) {
      set({ selectedPoint: null })
      return
    }

    if (selectedPoint !== null) {
      const validDests = gameState.valid_moves
        .filter(m => String(m.from_pos) === String(selectedPoint))
        .map(m => m.to_pos)
      if (validDests.some(d => String(d) === String(point))) {
        get().moveTo(point as number)
        return
      }
    }

    if (point === 'bar') {
      if (gameState.bar[gameState.current_player] > 0) {
        const hasBarMoves = gameState.valid_moves.some(m => m.from_pos === 'bar')
        if (hasBarMoves) set({ selectedPoint: 'bar' })
      }
    } else {
      const p = gameState.board[point as number]
      if (p.player === gameState.current_player && p.count > 0) {
        const hasMoves = gameState.valid_moves.some(m => m.from_pos === point)
        if (hasMoves) set({ selectedPoint: point })
      }
    }
  },

  clearSelection: () => set({ selectedPoint: null }),

  // Move applied locally — instant, no network round-trip
  moveTo: (to) => {
    const { selectedPoint, gameState } = get()
    if (selectedPoint === null || !gameState) return
    const next = applyMove(gameState, selectedPoint, to)
    set({ gameState: next, selectedPoint: null })
  },
}))
