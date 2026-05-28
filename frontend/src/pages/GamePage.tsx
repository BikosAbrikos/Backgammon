import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import type { GameState, OnlineContext, Player, QuantumCtx } from '../store/gameStore'
import { useAuthStore } from '../store/authStore'
import type { AuthUser } from '../store/authStore'
import Board from '../components/Board'
import Dice from '../components/Dice'
import TopBar from '../components/TopBar'
import { botChooseMove, delay } from '../engine/bot'
import type { BotLevel } from '../engine/bot'
import { rollDice as localRollDice } from '../engine/dice'
import { getValidMoves } from '../engine/rules'
import { applyMove, advanceTurn } from '../engine/moves'

const WS_BASE = (import.meta.env.VITE_WS_URL ?? (import.meta.env.VITE_API_URL ?? '').replace('https://', 'wss://').replace('http://', 'ws://'))

const AVATARS: Record<string, string> = {
  default: '🎲', knight: '♞', crown: '👑', dice: '🎯',
  dragon: '🐉', fox: '🦊', owl: '🦉', rocket: '🚀',
}

const BOT_LEVEL_LABEL: Record<string, string> = {
  beginner: '🌱 Beginner', medium: '⚔️ Medium', advanced: '🔥 Advanced',
}

// ── Player panel ──────────────────────────────────────────────────────────────

function PlayerCard({
  name, elo, avatar, color, isActive, isYou,
}: {
  name: string; elo?: number; avatar?: string; color: 'white' | 'black'
  isActive: boolean; isYou?: boolean
}) {
  return (
    <div className={[
      'flex items-center gap-2 px-4 py-2 rounded-xl border transition-all duration-300',
      isActive
        ? 'border-amber-500/60 bg-amber-900/20 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
        : 'border-stone-800/50 bg-stone-900/20 opacity-60',
    ].join(' ')}>
      <span className="text-2xl">{avatar ? AVATARS[avatar] ?? '🎲' : color === 'white' ? '⬜' : '⬛'}</span>
      <div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-amber-100">{name}</span>
          {isYou && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-400 font-semibold">YOU</span>}
        </div>
        {elo !== undefined && (
          <div className="text-xs text-amber-500 font-mono">{elo} Elo</div>
        )}
      </div>
      {isActive && (
        <div className="ml-1 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      )}
    </div>
  )
}

function PlayerPanel({
  gameType, gameState, onlineCtx, botLevel, botColor, user,
}: {
  gameType: string
  gameState: GameState
  onlineCtx: OnlineContext | null
  botLevel: BotLevel | null
  botColor: Player | null
  user: AuthUser | null
}) {
  const current = gameState.current_player

  if (gameType === 'online' && onlineCtx) {
    const myColor = onlineCtx.myColor
    const oppColor = myColor === 'white' ? 'black' : 'white'
    const opp = onlineCtx.opponent

    return (
      <div className="flex items-center gap-3 justify-center flex-wrap">
        <PlayerCard
          name={user?.username ?? 'You'}
          elo={user?.elo}
          avatar={user?.avatar}
          color={myColor}
          isActive={current === myColor}
          isYou
        />
        <span className="text-stone-600 font-bold text-lg">⚔️</span>
        <PlayerCard
          name={opp.username}
          elo={opp.elo}
          color={oppColor}
          isActive={current === oppColor}
        />
      </div>
    )
  }

  if (gameType === 'bot' && botLevel) {
    const playerColor = botColor === 'black' ? 'white' : 'black'
    return (
      <div className="flex items-center gap-3 justify-center flex-wrap">
        <PlayerCard
          name={user?.username ?? 'You'}
          elo={user?.elo}
          avatar={user?.avatar}
          color={playerColor}
          isActive={current === playerColor}
          isYou
        />
        <span className="text-stone-600 font-bold text-lg">⚔️</span>
        <PlayerCard
          name={`Bot — ${BOT_LEVEL_LABEL[botLevel]}`}
          color={botColor ?? 'black'}
          isActive={current === botColor}
        />
      </div>
    )
  }

  // Local
  return (
    <div className="flex items-center gap-3 justify-center flex-wrap">
      <PlayerCard name="White" color="white" isActive={current === 'white'} />
      <span className="text-stone-600 font-bold text-lg">⚔️</span>
      <PlayerCard name="Black" color="black" isActive={current === 'black'} />
    </div>
  )
}

// ── Winner overlay ────────────────────────────────────────────────────────────

function WinnerOverlay({ winner, eloChange, myColor, onRestart }: {
  winner: 'white' | 'black'; eloChange: { white: number; black: number } | null
  myColor?: 'white' | 'black' | null; onRestart: () => void
}) {
  const isMe = myColor && myColor === winner
  const delta = myColor && eloChange ? eloChange[myColor] : null
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/75">
      <div className="flex flex-col items-center gap-5 p-10 rounded-2xl border border-amber-600/50 text-center"
        style={{ background: 'linear-gradient(135deg,#1c0f04,#2a1508)' }}>
        <div className="text-6xl">{winner === 'white' ? '⬜' : '⬛'}</div>
        <div>
          <h2 className="text-3xl font-bold text-amber-200 mb-1">
            {isMe === true ? 'You Won!' : isMe === false ? 'You Lost' : `${winner === 'white' ? 'White' : 'Black'} Wins!`}
          </h2>
          {delta !== null && (
            <p className={['text-lg font-semibold', delta >= 0 ? 'text-green-400' : 'text-red-400'].join(' ')}>
              {delta >= 0 ? '+' : ''}{delta} Elo
            </p>
          )}
        </div>
        <button onClick={onRestart}
          className="px-8 py-3 rounded-xl font-bold text-stone-900 text-lg
            bg-gradient-to-b from-amber-300 to-amber-500 border border-amber-600
            hover:from-amber-200 hover:to-amber-400 active:scale-95 transition-all">
          Back to Lobby
        </button>
      </div>
    </div>
  )
}

// ── Quantum collapse animation ─────────────────────────────────────────────────

function CollapseOverlay({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1500)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="fixed inset-0 flex items-center justify-center z-40 bg-black/60 pointer-events-none">
      <div className="text-center">
        <div className="text-6xl mb-3 animate-pulse">⚛️</div>
        <div className="text-2xl font-bold text-cyan-300">Quantum Collapse!</div>
        <div className="text-stone-400 text-sm mt-1">One branch becomes reality…</div>
      </div>
    </div>
  )
}

// ── Chat sidebar ──────────────────────────────────────────────────────────────

const QUICK = ['gg', 'nice move!', 'brb', 'good luck']

function ChatPanel({ messages, onSend }: {
  messages: { from: string; text: string; ts: number }[]
  onSend: (text: string) => void
}) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function send(text: string) {
    const t = text.trim()
    if (t) { onSend(t); setInput('') }
  }

  return (
    <div className="flex flex-col w-56 bg-stone-900/60 rounded-xl border border-stone-800/50 overflow-hidden">
      <div className="px-3 py-2 border-b border-stone-800/50 text-xs text-stone-500 font-semibold uppercase tracking-wider">Chat</div>
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 min-h-0" style={{ maxHeight: '300px' }}>
        {messages.map((m, i) => (
          <div key={i} className="text-xs">
            <span className="text-amber-400 font-semibold">{m.from}: </span>
            <span className="text-stone-300">{m.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-1 p-1 flex-wrap border-t border-stone-800/30">
        {QUICK.map(q => (
          <button key={q} onClick={() => send(q)}
            className="text-[10px] px-2 py-0.5 rounded bg-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-700 transition-colors">
            {q}
          </button>
        ))}
      </div>
      <form onSubmit={e => { e.preventDefault(); send(input) }} className="flex gap-1 p-2 border-t border-stone-800/30">
        <input value={input} onChange={e => setInput(e.target.value)}
          placeholder="Message…" maxLength={200}
          className="flex-1 min-w-0 px-2 py-1 rounded bg-stone-800/80 border border-stone-700 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-700" />
        <button type="submit" className="text-amber-500 hover:text-amber-300 text-sm px-1">↵</button>
      </form>
    </div>
  )
}

// ── Quantum status bar ────────────────────────────────────────────────────────

function QuantumStatusBar({ ctx }: { ctx: QuantumCtx }) {
  const labels: Record<QuantumCtx['phase'], string> = {
    building_a: '⚛️ Quantum — Building Branch A (🔵 cyan)',
    building_b: '⚛️ Quantum — Building Branch B (🟠 orange)',
    opponent: '⚛️ Quantum Superposition — waiting for collapse…',
  }
  const colors: Record<QuantumCtx['phase'], string> = {
    building_a: 'bg-cyan-900/40 border-cyan-500/40 text-cyan-300',
    building_b: 'bg-orange-900/40 border-orange-500/40 text-orange-300',
    opponent: 'bg-purple-900/40 border-purple-500/40 text-purple-300',
  }
  return (
    <div className={['px-4 py-1.5 rounded-lg border text-xs font-semibold text-center', colors[ctx.phase]].join(' ')}>
      {labels[ctx.phase]}
    </div>
  )
}

// ── Main GamePage ─────────────────────────────────────────────────────────────

export default function GamePage() {
  const { roomId } = useParams<{ roomId?: string }>()
  const navigate = useNavigate()
  const { token, user } = useAuthStore()
  const {
    gameState, gameType, selectedPoint, isRolling, isBotThinking,
    botLevel, botColor, onlineCtx, chatMessages, eloChange, quantumCtx,
    rollDice, selectPoint, moveTo, clearSelection,
    setBotThinking, applyBotState, setOnlineGame, receiveOnlineState,
    setEloChange, addChat, reset,
  } = useGameStore()

  const wsRef = useRef<WebSocket | null>(null)
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [opponentLeft, setOpponentLeft] = useState(false)
  const [showCollapse, setShowCollapse] = useState(false)

  // ── Online WS management ───────────────────────────────────────────────────

  useEffect(() => {
    if (!roomId) return
    if (!token) { navigate('/auth'); return }

    let cancelled = false
    let attempts = 0

    function connect() {
      if (cancelled) return
      const ws = new WebSocket(`${WS_BASE}/ws/game/${roomId}`)
      wsRef.current = ws

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', token }))
        setWsStatus('connected')
        setOpponentLeft(false)
      }

      ws.onmessage = e => {
        const msg = JSON.parse(e.data)
        if (msg.type === 'game_state') {
          receiveOnlineState(msg.state)
          if (msg.your_color && onlineCtx?.myColor !== msg.your_color) {
            setOnlineGame(msg.state, {
              roomId: roomId!,
              myColor: msg.your_color,
              opponent: msg.players?.[msg.your_color === 'white' ? 'black' : 'white'] ?? { username: 'Opponent', elo: 0 },
            })
          }
        } else if (msg.type === 'game_over') {
          if (msg.state) receiveOnlineState(msg.state)
          if (msg.elo_change) setEloChange(msg.elo_change)
        } else if (msg.type === 'chat') {
          addChat({ from: msg.from, text: msg.text, ts: Date.now() })
        } else if (msg.type === 'opponent_left') {
          setOpponentLeft(true)
        }
      }

      ws.onclose = () => {
        setWsStatus('disconnected')
        if (!cancelled && attempts < 5) {
          attempts++
          setTimeout(connect, 3000)
        }
      }

      ws.onerror = () => ws.close()
    }

    connect()
    return () => { cancelled = true; wsRef.current?.close() }
  }, [roomId, token])

  // ── Bot automation ────────────────────────────────────────────────────────
  // NOTE: gameState?.phase intentionally excluded from deps — including it would
  // cancel the bot mid-turn when it updates the phase to 'moving' via applyBotState.

  useEffect(() => {
    if (gameType !== 'bot' || !botColor || !botLevel || !gameState) return
    if (gameState.phase !== 'waiting_roll' || gameState.current_player !== botColor) return

    let cancelled = false
    setBotThinking(true)

    async function runBot() {
      let state = gameState!

      await delay(600 + Math.random() * 400)
      if (cancelled) return

      const dice = localRollDice()
      state = { ...state, dice, phase: 'moving' }
      state.valid_moves = getValidMoves(state)
      if (!state.valid_moves.length) {
        applyBotState(advanceTurn(state))
        setBotThinking(false)
        return
      }
      applyBotState(state)

      while (!cancelled && state.phase === 'moving' && state.current_player === botColor && state.valid_moves.length) {
        await delay(500 + Math.random() * 600)
        if (cancelled) return
        const move = botChooseMove(state, botLevel!)
        if (!move) break
        state = applyMove(state, move.from_pos, move.to_pos)
        if (!cancelled) applyBotState(state)
      }

      if (!cancelled) setBotThinking(false)
    }

    runBot()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.current_player, gameType, botColor])

  // ── Quantum collapse visual feedback ──────────────────────────────────────

  const prevPhaseRef = useRef<QuantumCtx['phase'] | null>(null)
  useEffect(() => {
    const prev = prevPhaseRef.current
    const cur = quantumCtx?.phase ?? null
    // Show collapse overlay when quantum transitions from 'opponent' to null (collapsed)
    if (prev === 'opponent' && cur === null) {
      setShowCollapse(true)
    }
    prevPhaseRef.current = cur
  }, [quantumCtx?.phase])

  // ── Online roll / move proxies ─────────────────────────────────────────────

  const onlineRoll = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'roll_dice' }))
  }, [])

  const onlineMove = useCallback((to: number | 'off') => {
    wsRef.current?.send(JSON.stringify({ type: 'make_move', from_pos: selectedPoint, to_pos: to }))
    clearSelection()
  }, [selectedPoint])

  const sendChat = useCallback((text: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'chat', text }))
    addChat({ from: 'you', text, ts: Date.now() })
  }, [onlineCtx])

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (!gameState && !roomId) {
    navigate('/lobby')
    return null
  }

  if (!gameState) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-amber-400 text-lg animate-pulse">Connecting to game…</div>
      </div>
    )
  }

  const isOnline = gameType === 'online' || !!roomId
  const canRoll = gameState.phase === 'waiting_roll' && (
    isOnline ? gameState.current_player === onlineCtx?.myColor : true
  )
  const isBotTurn = gameType === 'bot' && gameState.current_player === botColor
  const hasBar = gameState.bar[gameState.current_player] > 0

  const effectiveRoll = isOnline ? onlineRoll : rollDice
  const effectiveMove = isOnline ? onlineMove : moveTo


  // Ghost branches to pass to Board during opponent's turn
  const ghostBranches = quantumCtx?.phase === 'opponent' &&
    quantumCtx.branchA && quantumCtx.branchB
    ? {
        branchA: quantumCtx.branchA,
        branchB: quantumCtx.branchB,
        quantumPlayer: quantumCtx.quantumPlayer,
      }
    : undefined

  function handleRestart() {
    reset()
    navigate('/lobby')
  }

  // Status line text
  function statusText() {
    if (!gameState || isBotThinking) return null
    if (quantumCtx?.phase === 'building_a') return 'Make your moves for Branch A, then use all dice'
    if (quantumCtx?.phase === 'building_b') return 'Make your moves for Branch B, then use all dice'
    if (quantumCtx?.phase === 'opponent') return 'Quantum superposition active — awaiting collapse'
    if (hasBar && gameState.phase === 'moving') return 'Must re-enter from bar first!'
    if (gameState.phase === 'waiting_roll' && !isBotTurn) {
      if (isOnline && onlineCtx) {
        return gameState.current_player === onlineCtx.myColor
          ? 'Your turn — roll the dice'
          : `Waiting for ${onlineCtx.opponent.username}…`
      }
      return `${gameState.current_player === 'white' ? 'White' : 'Black'} — roll to move`
    }
    if (gameState.phase === 'moving' && !hasBar && selectedPoint === null) return 'Select a checker to move'
    if (selectedPoint !== null) return 'Click a highlighted point to move'
    return null
  }

  const status = statusText()

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar gameState={gameState} onRestart={handleRestart} />

      {/* WS banners */}
      {isOnline && wsStatus === 'connecting' && (
        <div className="text-center py-2 bg-amber-900/30 text-amber-300 text-sm">
          Connecting to game server…
        </div>
      )}
      {opponentLeft && (
        <div className="text-center py-2 bg-red-900/30 text-red-300 text-sm">
          Opponent disconnected — waiting 30s for reconnect
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-6 p-4 lg:p-6">
        <div className="flex flex-col items-center gap-4 w-full max-w-[860px]">

          {/* Player panel */}
          <PlayerPanel
            gameType={gameType}
            gameState={gameState}
            onlineCtx={onlineCtx}
            botLevel={botLevel}
            botColor={botColor}
            user={user}
          />

          {/* Quantum status bar */}
          {quantumCtx && <QuantumStatusBar ctx={quantumCtx} />}

          {/* Status line */}
          <div className="text-sm text-stone-400 h-5">
            {isBotThinking && <span className="text-amber-400">Bot is thinking…</span>}
            {!isBotThinking && status && (
              <span className={[
                quantumCtx?.phase === 'building_a' ? 'text-cyan-400' :
                quantumCtx?.phase === 'building_b' ? 'text-orange-400' :
                quantumCtx?.phase === 'opponent' ? 'text-purple-400' :
                hasBar && gameState?.phase === 'moving' ? 'text-red-400 font-semibold' :
                selectedPoint !== null ? 'text-green-400' :
                'text-amber-300',
              ].join('')}>
                {status}
              </span>
            )}
          </div>

          {/* Board — constrained width, scrollable on small screens */}
          <div className="w-full overflow-x-auto pb-2">
            <Board
              gameState={gameState}
              selectedPoint={selectedPoint}
              onSelectPoint={selectPoint}
              onMoveToPoint={effectiveMove}
              ghostBranches={ghostBranches}
            />
          </div>

          {/* Dice */}
          <Dice
            dice={gameState.dice}
            onRoll={effectiveRoll}
            canRoll={canRoll && !isBotThinking && !quantumCtx}
            isRolling={isRolling}
          />
        </div>

        {/* Chat (online only) */}
        {isOnline && (
          <ChatPanel messages={chatMessages} onSend={sendChat} />
        )}
      </div>

      {gameState.phase === 'game_over' && gameState.winner && (
        <WinnerOverlay
          winner={gameState.winner}
          eloChange={eloChange}
          myColor={onlineCtx?.myColor}
          onRestart={handleRestart}
        />
      )}

      {showCollapse && (
        <CollapseOverlay onDone={() => setShowCollapse(false)} />
      )}
    </div>
  )
}
