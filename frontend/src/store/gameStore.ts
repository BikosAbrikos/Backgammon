import { create } from 'zustand'
import axios from 'axios'
import { rollDice as localRollDice } from '../engine/dice'
import { getValidMoves } from '../engine/rules'
import { applyMove, advanceTurn } from '../engine/moves'
import type { BotLevel } from '../engine/bot'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const api = axios.create({ baseURL: API_BASE })

export type Player = 'white' | 'black'
export type GameMode = 'long' | 'short'
export type Phase = 'waiting_roll' | 'moving' | 'game_over'
export type GameType = 'local' | 'bot' | 'online'

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

export interface ChatMessage {
  from: string
  text: string
  ts: number
}

export interface OnlineContext {
  roomId: string
  myColor: Player
  opponent: { username: string; elo: number }
}

interface GameStore {
  gameState: GameState | null
  gameType: GameType
  selectedPoint: number | 'bar' | null
  isRolling: boolean

  // Bot config
  botLevel: BotLevel | null
  botColor: Player | null
  isBotThinking: boolean

  // Online config
  onlineCtx: OnlineContext | null
  chatMessages: ChatMessage[]
  eloChange: { white: number; black: number } | null

  // Starters
  startLocalGame: (mode: GameMode) => Promise<void>
  startBotGame: (mode: GameMode, level: BotLevel, botColor: Player) => Promise<void>
  setOnlineGame: (state: GameState, ctx: OnlineContext) => void
  receiveOnlineState: (state: GameState) => void
  setEloChange: (change: { white: number; black: number }) => void

  // Gameplay (local + bot)
  rollDice: () => void
  selectPoint: (point: number | 'bar') => void
  moveTo: (to: number | 'off') => void
  clearSelection: () => void

  // Bot automation (called from GamePage useEffect)
  setBotThinking: (v: boolean) => void
  applyBotState: (state: GameState) => void

  // Chat
  addChat: (msg: ChatMessage) => void

  reset: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  gameType: 'local',
  selectedPoint: null,
  isRolling: false,
  botLevel: null,
  botColor: null,
  isBotThinking: false,
  onlineCtx: null,
  chatMessages: [],
  eloChange: null,

  startLocalGame: async (mode) => {
    const { data } = await api.post<GameState>('/game/new', { mode })
    set({
      gameState: data,
      gameType: 'local',
      selectedPoint: null,
      botLevel: null,
      botColor: null,
      onlineCtx: null,
      chatMessages: [],
      eloChange: null,
    })
  },

  startBotGame: async (mode, level, botColor) => {
    const { data } = await api.post<GameState>('/game/new', { mode })
    set({
      gameState: data,
      gameType: 'bot',
      botLevel: level,
      botColor,
      selectedPoint: null,
      onlineCtx: null,
      chatMessages: [],
      eloChange: null,
    })
  },

  setOnlineGame: (state, ctx) => {
    set({
      gameState: state,
      gameType: 'online',
      onlineCtx: ctx,
      selectedPoint: null,
      botLevel: null,
      botColor: null,
      chatMessages: [],
      eloChange: null,
    })
  },

  receiveOnlineState: (state) => set({ gameState: state }),

  setEloChange: (change) => set({ eloChange: change }),

  rollDice: () => {
    const { gameState, gameType } = get()
    if (!gameState || gameState.phase !== 'waiting_roll') return
    if (gameType === 'online') return // online rolls go through WS

    const dice = localRollDice()
    let next: GameState = { ...gameState, dice, phase: 'moving' }
    next.valid_moves = getValidMoves(next)
    if (!next.valid_moves.length) next = advanceTurn(next)

    set({ isRolling: true, gameState: next, selectedPoint: null })
    setTimeout(() => set({ isRolling: false }), 520)
  },

  selectPoint: (point) => {
    const { gameState, selectedPoint, gameType, onlineCtx } = get()
    if (!gameState || gameState.phase !== 'moving') return
    if (gameType === 'online' && onlineCtx && gameState.current_player !== onlineCtx.myColor) return

    if (selectedPoint === point) { set({ selectedPoint: null }); return }

    if (selectedPoint !== null) {
      const dests = gameState.valid_moves
        .filter(m => String(m.from_pos) === String(selectedPoint))
        .map(m => m.to_pos)
      if (dests.some(d => String(d) === String(point))) {
        get().moveTo(point as number)
        return
      }
    }

    if (point === 'bar') {
      if (gameState.bar[gameState.current_player] > 0 &&
        gameState.valid_moves.some(m => m.from_pos === 'bar')) {
        set({ selectedPoint: 'bar' })
      }
    } else {
      const p = gameState.board[point as number]
      if (p.player === gameState.current_player && p.count > 0 &&
        gameState.valid_moves.some(m => m.from_pos === point)) {
        set({ selectedPoint: point })
      }
    }
  },

  moveTo: (to) => {
    const { selectedPoint, gameState, gameType } = get()
    if (selectedPoint === null || !gameState) return
    if (gameType === 'online') return // online moves go through WS

    const next = applyMove(gameState, selectedPoint, to)
    set({ gameState: next, selectedPoint: null })
  },

  clearSelection: () => set({ selectedPoint: null }),
  setBotThinking: (v) => set({ isBotThinking: v }),
  applyBotState: (state) => set({ gameState: state }),
  addChat: (msg) => set(s => ({ chatMessages: [...s.chatMessages.slice(-99), msg] })),

  reset: () => set({
    gameState: null, selectedPoint: null, isRolling: false,
    botLevel: null, botColor: null, isBotThinking: false,
    onlineCtx: null, chatMessages: [], eloChange: null,
  }),
}))
