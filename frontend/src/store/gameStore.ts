import { create } from 'zustand'
import axios from 'axios'
import { rollDice as localRollDice } from '../engine/dice'
import { getValidMoves } from '../engine/rules'
import { applyMove, advanceTurn } from '../engine/moves'
import type { BotLevel } from '../engine/bot'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const api = axios.create({ baseURL: API_BASE })

export type Player = 'white' | 'black'
export type GameMode = 'long' | 'short' | 'quantum'
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

// ── Quantum Backgammon ─────────────────────────────────────────────────────────

export interface QuantumBranchPositions {
  board: PointState[]
  bar: Record<Player, number>
  off: Record<Player, number>
}

export interface QuantumCtx {
  phase: 'building_a' | 'building_b' | 'opponent'
  quantumPlayer: Player
  /** Board state the moment quantum mode was entered (dice already rolled, no moves yet) */
  preQuantumState: GameState
  branchA: QuantumBranchPositions | null
  branchB: QuantumBranchPositions | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function collapseQuantumState(
  currentState: GameState,
  branch: QuantumBranchPositions,
  quantumPlayer: Player,
): GameState {
  const opp: Player = quantumPlayer === 'white' ? 'black' : 'white'
  const newBoard = currentState.board.map(pt => ({ ...pt }))
  const newBar = { ...currentState.bar }
  const newOff = { ...currentState.off }

  // Remove quantum player's checkers from current board
  for (let i = 0; i < 24; i++) {
    if (newBoard[i].player === quantumPlayer) {
      newBoard[i] = { count: 0, player: null }
    }
  }
  newBar[quantumPlayer] = 0
  newOff[quantumPlayer] = 0

  // Place quantum player's checkers from chosen branch
  for (let i = 0; i < 24; i++) {
    const bp = branch.board[i]
    if (bp.player === quantumPlayer && bp.count > 0) {
      // If opponent has a single checker here, send it to bar (quantum hit)
      if (newBoard[i].player === opp && newBoard[i].count === 1) {
        newBar[opp]++
        newBoard[i] = { count: 0, player: null }
      }
      // Only place if the point isn't blocked by 2+ opponent checkers
      if (!(newBoard[i].player === opp && newBoard[i].count >= 2)) {
        newBoard[i] = { count: bp.count, player: quantumPlayer }
      }
    }
  }
  newBar[quantumPlayer] = branch.bar[quantumPlayer]
  newOff[quantumPlayer] = branch.off[quantumPlayer]

  const next = { ...currentState, board: newBoard, bar: newBar, off: newOff }
  next.valid_moves = getValidMoves(next)
  return next
}

function extractBranchPositions(state: GameState): QuantumBranchPositions {
  return {
    board: state.board.map(pt => ({ ...pt })),
    bar: { ...state.bar },
    off: { ...state.off },
  }
}

// ── Store ──────────────────────────────────────────────────────────────────────

interface GameStore {
  gameState: GameState | null
  gameType: GameType
  selectedPoint: number | 'bar' | null
  isRolling: boolean

  botLevel: BotLevel | null
  botColor: Player | null
  isBotThinking: boolean

  onlineCtx: OnlineContext | null
  chatMessages: ChatMessage[]
  eloChange: { white: number; black: number } | null

  quantumCtx: QuantumCtx | null

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

  // Quantum
  enterQuantumMode: () => void

  // Bot automation
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
  quantumCtx: null,

  startLocalGame: async (mode) => {
    const backendMode = mode === 'quantum' ? 'short' : mode
    const { data } = await api.post<GameState>('/game/new', { mode: backendMode })
    set({
      gameState: { ...data, mode },
      gameType: 'local',
      selectedPoint: null,
      botLevel: null,
      botColor: null,
      onlineCtx: null,
      chatMessages: [],
      eloChange: null,
      quantumCtx: null,
    })
  },

  startBotGame: async (mode, level, botColor) => {
    const backendMode = mode === 'quantum' ? 'short' : mode
    const { data } = await api.post<GameState>('/game/new', { mode: backendMode })
    set({
      gameState: { ...data, mode },
      gameType: 'bot',
      botLevel: level,
      botColor,
      selectedPoint: null,
      onlineCtx: null,
      chatMessages: [],
      eloChange: null,
      quantumCtx: null,
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
      quantumCtx: null,
    })
  },

  receiveOnlineState: (state) => set({ gameState: state }),
  setEloChange: (change) => set({ eloChange: change }),

  rollDice: () => {
    const { gameState, gameType, quantumCtx } = get()
    if (!gameState || gameState.phase !== 'waiting_roll') return
    if (gameType === 'online') return

    let currentState = gameState

    // Quantum collapse: triggers when the quantum player rolls their next turn
    if (
      quantumCtx?.phase === 'opponent' &&
      currentState.current_player === quantumCtx.quantumPlayer &&
      quantumCtx.branchA && quantumCtx.branchB
    ) {
      const chosen = Math.random() < 0.5 ? quantumCtx.branchA : quantumCtx.branchB
      currentState = collapseQuantumState(currentState, chosen, quantumCtx.quantumPlayer)
      set({ quantumCtx: null })
    }

    const dice = localRollDice()
    let next: GameState = { ...currentState, dice, phase: 'moving' }
    next.valid_moves = getValidMoves(next)
    if (!next.valid_moves.length) next = advanceTurn(next)

    // Auto-enter quantum mode when this is a quantum game and the player has moves
    let autoQuantumCtx: QuantumCtx | null = null
    if (next.mode === 'quantum' && next.phase === 'moving') {
      autoQuantumCtx = {
        phase: 'building_a',
        quantumPlayer: next.current_player,
        preQuantumState: next,
        branchA: null,
        branchB: null,
      }
    }

    set({ isRolling: true, gameState: next, selectedPoint: null, quantumCtx: autoQuantumCtx })
    setTimeout(() => set({ isRolling: false }), 520)
  },

  selectPoint: (point) => {
    const { gameState, selectedPoint, gameType, onlineCtx, botColor } = get()
    if (!gameState || gameState.phase !== 'moving') return

    // Security: block interacting with opponent's turn
    if (gameType === 'online' && onlineCtx && gameState.current_player !== onlineCtx.myColor) return
    if (gameType === 'bot' && botColor && gameState.current_player === botColor) return

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
    const { selectedPoint, gameState, gameType, botColor, quantumCtx } = get()
    if (selectedPoint === null || !gameState) return
    if (gameType === 'online') return
    if (gameType === 'bot' && botColor && gameState.current_player === botColor) return

    const next = applyMove(gameState, selectedPoint, to)

    // ── Quantum branch handling ────────────────────────────────────────────────
    if (quantumCtx?.phase === 'building_a' && next.phase === 'waiting_roll') {
      // Branch A complete — save positions and start Branch B from pre-quantum state
      const branchA = extractBranchPositions(next)
      const branchBStart: GameState = { ...quantumCtx.preQuantumState }
      set({
        gameState: branchBStart,
        selectedPoint: null,
        quantumCtx: { ...quantumCtx, phase: 'building_b', branchA },
      })
      return
    }

    if (quantumCtx?.phase === 'building_b' && next.phase === 'waiting_roll') {
      // Branch B complete — commit quantum state, advance turn to opponent
      const branchB = extractBranchPositions(next)
      const opponentTurn = advanceTurn(quantumCtx.preQuantumState)
      set({
        gameState: opponentTurn,
        selectedPoint: null,
        quantumCtx: { ...quantumCtx, phase: 'opponent', branchB },
      })
      return
    }

    set({ gameState: next, selectedPoint: null })
  },

  enterQuantumMode: () => {
    const { gameState, quantumCtx } = get()
    if (!gameState || gameState.phase !== 'moving') return
    if (quantumCtx !== null) return // Already in quantum mode

    // Only allow at the very start of the moving phase (no dice consumed yet)
    const expectedDice = gameState.dice.values.length === 2 &&
      gameState.dice.values[0] === gameState.dice.values[1] ? 4 : 2
    if (gameState.dice.remaining.length !== expectedDice) return

    set({
      quantumCtx: {
        phase: 'building_a',
        quantumPlayer: gameState.current_player,
        preQuantumState: gameState,
        branchA: null,
        branchB: null,
      },
    })
  },

  clearSelection: () => set({ selectedPoint: null }),
  setBotThinking: (v) => set({ isBotThinking: v }),
  applyBotState: (state) => set({ gameState: state }),
  addChat: (msg) => set(s => ({ chatMessages: [...s.chatMessages.slice(-99), msg] })),

  reset: () => set({
    gameState: null, selectedPoint: null, isRolling: false,
    botLevel: null, botColor: null, isBotThinking: false,
    onlineCtx: null, chatMessages: [], eloChange: null, quantumCtx: null,
  }),
}))
