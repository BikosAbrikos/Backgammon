import { create } from 'zustand'
import axios from 'axios'

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
  rollDice: () => Promise<void>
  selectPoint: (point: number | 'bar') => void
  clearSelection: () => void
  moveTo: (to: number | 'off') => Promise<void>
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  selectedPoint: null,
  isRolling: false,

  startGame: async (mode) => {
    const { data } = await api.post<GameState>('/game/new', { mode })
    set({ gameState: data, selectedPoint: null })
  },

  rollDice: async () => {
    set({ isRolling: true })
    try {
      const { data } = await api.post<GameState>('/game/roll')
      set({ gameState: data, selectedPoint: null })
    } finally {
      setTimeout(() => set({ isRolling: false }), 520)
    }
  },

  selectPoint: (point) => {
    const { gameState, selectedPoint } = get()
    if (!gameState || gameState.phase !== 'moving') return

    // Deselect if clicking the same point
    if (selectedPoint === point) {
      set({ selectedPoint: null })
      return
    }

    // Check if clicking a valid destination
    if (selectedPoint !== null) {
      const validDests = gameState.valid_moves
        .filter(m => String(m.from_pos) === String(selectedPoint))
        .map(m => m.to_pos)
      if (validDests.some(d => String(d) === String(point))) {
        get().moveTo(point as number)
        return
      }
    }

    // Select own checker
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

  moveTo: async (to) => {
    const { selectedPoint, gameState } = get()
    if (selectedPoint === null || !gameState) return
    set({ selectedPoint: null })
    const { data } = await api.post<GameState>('/game/move', {
      from_pos: selectedPoint,
      to_pos: to,
    })
    set({ gameState: data })
  },
}))
