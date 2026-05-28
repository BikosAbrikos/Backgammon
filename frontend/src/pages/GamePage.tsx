import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import type { GameState, OnlineContext, Player, QuantumCtx, SpyCtx } from '../store/gameStore'
import { useAuthStore } from '../store/authStore'
import type { AuthUser } from '../store/authStore'
import Board from '../components/Board'
import Dice from '../components/Dice'
import TopBar from '../components/TopBar'
import { botChooseMove, botShouldChallenge, botChooseSpyMove, delay } from '../engine/bot'
import type { BotLevel } from '../engine/bot'
import { rollDice as localRollDice } from '../engine/dice'
import { getValidMoves } from '../engine/rules'
import { applyMove, applySpyMove, advanceTurn } from '../engine/moves'

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

function CollapseOverlay({ branch, onDone }: { branch: 'A' | 'B' | null; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200)
    return () => clearTimeout(t)
  }, [onDone])

  const isA = branch === 'A'
  return (
    <div className="fixed inset-0 flex items-center justify-center z-40 bg-black/70 pointer-events-none">
      <div className="text-center px-8 py-6 rounded-2xl border border-stone-700/50"
        style={{ background: 'linear-gradient(135deg,#0a0a0a,#1a1a1a)' }}>
        <div className="text-6xl mb-3 animate-pulse">⚛️</div>
        <div className="text-2xl font-bold text-white mb-3">Quantum Collapse!</div>
        {branch && (
          <>
            <div className={['text-lg font-bold', isA ? 'text-cyan-400' : 'text-orange-400'].join(' ')}>
              ✅ Branch {branch} survived!
            </div>
            <div className="text-stone-500 text-sm mt-1">
              ❌ Branch {isA ? 'B' : 'A'} was cancelled
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Quantum moves panel ───────────────────────────────────────────────────────

function formatMove(m: { from_pos: number | 'bar'; to_pos: number | 'off'; die_value: number }): string {
  const from = m.from_pos === 'bar' ? 'Bar' : `Pt ${m.from_pos}`
  const to = m.to_pos === 'off' ? 'Off' : `Pt ${m.to_pos}`
  return `${from} → ${to}`
}

function QuantumMovesPanel({ ctx }: { ctx: import('../store/gameStore').QuantumCtx }) {
  return (
    <div className="flex flex-col gap-4 w-52 bg-stone-950/80 border border-stone-800/60 rounded-xl p-4 text-xs shrink-0">

      {/* Header */}
      <div className="text-center">
        <div className="text-base font-bold text-stone-200">⚛️ Superposition</div>
        <div className="text-stone-500 text-[10px] mt-0.5">Opponent sees both branches</div>
      </div>

      {/* Branch A — player's moves */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 font-semibold text-cyan-400">
          <div className="w-3 h-3 rounded-full bg-cyan-400/70 border border-cyan-300 shrink-0" />
          Branch A — Your moves
        </div>
        {ctx.branchAMoves.length === 0
          ? <div className="text-stone-600 pl-4">Playing…</div>
          : ctx.branchAMoves.map((m, i) => (
            <div key={i} className="pl-4 text-stone-300 font-mono">
              {i + 1}. {formatMove(m)} <span className="text-stone-600">🎲{m.die_value}</span>
            </div>
          ))
        }
      </div>

      <div className="border-t border-stone-800" />

      {/* Branch B — system's random moves */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 font-semibold text-orange-400">
          <div className="w-3 h-3 rounded-full bg-orange-400/70 border border-orange-300 shrink-0" />
          Branch B — System
        </div>
        {ctx.branchBMoves.length === 0
          ? <div className="text-stone-600 pl-4">Generating…</div>
          : ctx.branchBMoves.map((m, i) => (
            <div key={i} className="pl-4 text-stone-300 font-mono">
              {i + 1}. {formatMove(m)} <span className="text-stone-600">🎲{m.die_value}</span>
            </div>
          ))
        }
      </div>

      <div className="border-t border-stone-800" />

      {/* Legend */}
      <div className="flex flex-col gap-1.5 text-[10px] text-stone-500">
        <div className="font-semibold text-stone-400 text-xs">What you see on the board:</div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-amber-100 border-2 border-cyan-400 shrink-0 opacity-50" />
          <span><span className="text-cyan-400 font-semibold">Cyan</span> ghost = Branch A position</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-amber-100 border-2 border-orange-400 shrink-0 opacity-50" />
          <span><span className="text-orange-400 font-semibold">Orange</span> ghost = Branch B position</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-amber-50 border-2 border-amber-300 shrink-0" />
          <span><span className="text-stone-300 font-semibold">Solid</span> = same in both, guaranteed</span>
        </div>
        <div className="mt-1 text-stone-600 leading-relaxed">
          After your opponent moves, one branch collapses at random — 50 / 50.
        </div>
      </div>
    </div>
  )
}

// ── Spy Mode UI ───────────────────────────────────────────────────────────────

function SpyTokenBar({ spyCtx, gameState }: { spyCtx: SpyCtx; gameState: GameState }) {
  const players: Player[] = ['white', 'black']
  const isSpy = gameState.mode === 'spy'
  if (!isSpy) return null
  return (
    <div className="flex items-center justify-center gap-6 px-4 py-1.5 rounded-lg border border-red-900/40 bg-red-950/20 text-xs">
      {players.map(p => (
        <div key={p} className="flex items-center gap-1.5">
          <span>{p === 'white' ? '⬜' : '⬛'}</span>
          <span className="text-stone-400">{p === 'white' ? 'White' : 'Black'}:</span>
          {Array.from({ length: 3 }).map((_, i) => (
            <span key={i} className={i < spyCtx.tokensRemaining[p] ? 'text-red-400' : 'text-stone-700'}>
              🕵️
            </span>
          ))}
          <span className={spyCtx.tokensRemaining[p] > 0 ? 'text-red-300 font-bold' : 'text-stone-600'}>
            ×{spyCtx.tokensRemaining[p]}
          </span>
        </div>
      ))}
    </div>
  )
}

function ChallengeWindow({ spyCtx, currentPlayer, isBot, onChallenge, onClose }: {
  spyCtx: SpyCtx
  currentPlayer: Player
  isBot: boolean
  onChallenge: () => void
  onClose: () => void
}) {
  const [remaining, setRemaining] = useState(5)
  useEffect(() => {
    if (!spyCtx.challengeExpires) return
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((spyCtx.challengeExpires! - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) { clearInterval(tick); onClose() }
    }, 100)
    return () => clearInterval(tick)
  }, [spyCtx.challengeExpires, onClose])

  const mover = spyCtx.lastMove?.mover
  const challenger = mover === 'white' ? 'black' : 'white'
  const isMover = currentPlayer === mover

  // Bot games: challenger is the human (not bot color)
  if (isBot && !isMover) return null  // bot challenges automatically, human only shown if they're the challenger

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center pb-24 pointer-events-none">
      <div className="flex flex-col items-center gap-3 px-8 py-5 rounded-2xl border border-red-700/60 pointer-events-auto"
        style={{ background: 'linear-gradient(135deg,#1a0505,#2d0a0a)' }}>
        <div className="text-sm text-stone-400">
          <span className={mover === 'white' ? 'text-amber-200 font-bold' : 'text-stone-300 font-bold'}>
            {mover === 'white' ? 'White' : 'Black'}
          </span> just moved
          {isMover
            ? ' — waiting for opponent to challenge…'
            : ` — do you want to challenge this move?`
          }
        </div>

        {/* Countdown bar */}
        <div className="w-64 h-2 rounded-full bg-stone-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-red-500 transition-all"
            style={{ width: `${(remaining / 5) * 100}%` }}
          />
        </div>
        <div className="text-xs text-stone-500">{remaining}s remaining</div>

        {!isMover && (
          <div className="flex gap-3">
            <button
              onClick={onChallenge}
              className="px-6 py-2.5 rounded-xl font-bold text-white text-sm border border-red-500
                bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700
                active:scale-95 transition-all shadow-lg shadow-red-900/50"
            >
              ⚡ Challenge!
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl font-semibold text-stone-400 text-sm border border-stone-700
                bg-stone-900/50 hover:border-stone-500 hover:text-stone-200 transition-colors"
            >
              Skip
            </button>
          </div>
        )}

        {isMover && (
          <div className="text-xs text-red-400/60 italic">
            {challenger === 'white' ? 'White' : 'Black'} can challenge your move
          </div>
        )}
      </div>
    </div>
  )
}

function SpyResultToast({ result, onDone }: { result: 'caught' | 'missed'; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className={[
        'px-6 py-3 rounded-xl border font-bold text-sm text-center shadow-2xl',
        result === 'caught'
          ? 'border-red-500/60 bg-red-950/90 text-red-300'
          : 'border-green-600/60 bg-green-950/90 text-green-300',
      ].join(' ')}>
        {result === 'caught'
          ? '🚨 Illegal move caught! Piece sent to bar.'
          : '✅ Legal move — challenge failed!'}
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
    building: '⚛️ Quantum — Play your moves (system auto-generates Branch B)',
    opponent: '⚛️ Superposition active — ghost branches visible on board',
  }
  const colors: Record<QuantumCtx['phase'], string> = {
    building: 'bg-cyan-900/40 border-cyan-500/40 text-cyan-300',
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
    botLevel, botColor, onlineCtx, chatMessages, eloChange, quantumCtx, collapsedBranch,
    spyCtx, spyResult,
    rollDice, selectPoint, moveTo, clearSelection,
    setBotThinking, applyBotState, applyBotSpyMove, setOnlineGame, receiveOnlineState,
    setEloChange, addChat, reset, clearCollapsedBranch,
    challenge, closeChallengeWindow, clearSpyResult,
    setSpyCtxOnline, setQuantumCtxOnline, setCollapsedBranchOnline, setSpyResultOnline,
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
          // Quantum: server signals the start of the building phase
          if (msg.quantum_phase === 'building') {
            setQuantumCtxOnline({
              phase: 'building',
              quantumPlayer: msg.quantum_player,
              preQuantumState: msg.state,
              branchA: null,
              branchB: null,
              branchAMoves: [],
              branchBMoves: [],
            })
          }
          // Spy: sync token counts from server on regular game_state updates
          if (msg.state?.mode === 'spy' && msg.spy_tokens) {
            setSpyCtxOnline({
              tokensRemaining: msg.spy_tokens,
              lastMove: null,
              challengeWindowOpen: false,
              challengeExpires: null,
            })
          }

        } else if (msg.type === 'spy_state') {
          // A spy move was made — challenge window opens for the opponent
          receiveOnlineState(msg.state)
          setSpyCtxOnline({
            tokensRemaining: msg.spy_tokens,
            lastMove: { mover: msg.last_mover, dest: -1, wasIllegal: false },
            challengeWindowOpen: true,
            challengeExpires: Date.now() + 5000,
          })

        } else if (msg.type === 'spy_result') {
          // Challenge was resolved (caught / missed / timeout)
          receiveOnlineState(msg.state)
          setSpyCtxOnline({
            tokensRemaining: msg.spy_tokens,
            lastMove: null,
            challengeWindowOpen: false,
            challengeExpires: null,
          })
          if (msg.result === 'caught' || msg.result === 'missed') {
            setSpyResultOnline(msg.result)
          }

        } else if (msg.type === 'quantum_branches') {
          // Branch A done — opponent plays on pre-quantum board; ghost overlays active
          receiveOnlineState(msg.state)
          setQuantumCtxOnline({
            phase: 'opponent',
            quantumPlayer: msg.quantum_player,
            preQuantumState: msg.state,
            branchA: msg.branch_a,
            branchB: msg.branch_b,
            branchAMoves: msg.branch_a_moves ?? [],
            branchBMoves: msg.branch_b_moves ?? [],
          })

        } else if (msg.type === 'quantum_collapse') {
          // Random branch selected — show collapse overlay
          receiveOnlineState(msg.state)
          setQuantumCtxOnline(null)
          setCollapsedBranchOnline(msg.branch)
          setShowCollapse(true)

        } else if (msg.type === 'game_over') {
          if (msg.state) receiveOnlineState(msg.state)
          if (msg.elo_change) setEloChange(msg.elo_change)

        } else if (msg.type === 'chat') {
          // Tag own messages as 'you' (server echoes back to sender too)
          addChat({ from: msg.from === user?.username ? 'you' : msg.from, text: msg.text, ts: Date.now() })

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
  // Fires on: current_player change (normal turns), phase change (spy continuation),
  // and challengeWindowOpen change (spy: continue after window closes).

  useEffect(() => {
    if (gameType !== 'bot' || !botColor || !botLevel || !gameState) return

    const shouldStartTurn = gameState.phase === 'waiting_roll' && gameState.current_player === botColor
    // Spy continuation: challenge window just closed, dice still remain
    const isSpyContinuation = gameState.mode === 'spy' && !spyCtx?.challengeWindowOpen &&
      gameState.phase === 'moving' && gameState.current_player === botColor && gameState.valid_moves.length > 0

    if (!shouldStartTurn && !isSpyContinuation) return

    let cancelled = false
    setBotThinking(true)

    async function runBot() {
      let state = gameState!

      if (shouldStartTurn) {
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
      }

      // Spy mode: attempt one illegal move at the start of the move sequence
      if (state.mode === 'spy') {
        const currentSpyCtx = useGameStore.getState().spyCtx
        if (currentSpyCtx && currentSpyCtx.tokensRemaining[botColor!] > 0) {
          const spyDest = botChooseSpyMove(state, botLevel!)
          if (spyDest !== null) {
            const move = botChooseMove(state, botLevel!)
            if (move) {
              await delay(500 + Math.random() * 600)
              if (cancelled) return
              const spyState = applySpyMove(state, move.from_pos, spyDest)
              applyBotSpyMove(spyState, botColor!, spyDest, true)
              setBotThinking(false)
              return  // human challenge window will handle the rest
            }
          }
        }
      }

      // Legal moves
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
  }, [gameState?.current_player, gameState?.phase, spyCtx?.challengeWindowOpen, gameType, botColor])

  // ── Bot spy challenge automation ──────────────────────────────────────────

  useEffect(() => {
    if (gameType !== 'bot' || !spyCtx?.challengeWindowOpen || !botColor || !botLevel) return
    const mover = spyCtx.lastMove?.mover
    if (mover === botColor) return  // bot made the move; human decides
    const timer = setTimeout(() => {
      if (botShouldChallenge(spyCtx, botLevel)) {
        challenge()
      } else {
        closeChallengeWindow()
      }
    }, 500 + Math.random() * 500)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spyCtx?.challengeWindowOpen, gameType, botColor, botLevel])

  // ── Quantum collapse visual feedback ──────────────────────────────────────

  // For local/bot quantum: detect collapse via phase transition
  // For online quantum: collapse is triggered directly in the WS handler above
  const prevPhaseRef = useRef<QuantumCtx['phase'] | null>(null)
  useEffect(() => {
    const onl = gameType === 'online' || !!roomId
    if (onl) return  // online collapse is handled in WS handler
    const prev = prevPhaseRef.current
    const cur = quantumCtx?.phase ?? null
    if (prev === 'opponent' && cur === null) {
      setShowCollapse(true)
    }
    prevPhaseRef.current = cur
  }, [quantumCtx?.phase, gameType, roomId])

  // ── Online roll / move / challenge proxies ────────────────────────────────

  const onlineRoll = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'roll_dice' }))
  }, [])

  const onlineMove = useCallback((to: number | 'off') => {
    wsRef.current?.send(JSON.stringify({ type: 'make_move', from_pos: selectedPoint, to_pos: to }))
    clearSelection()
  }, [selectedPoint])

  const sendChat = useCallback((text: string) => {
    // Don't add locally — server echoes back to all players including sender
    wsRef.current?.send(JSON.stringify({ type: 'chat', text }))
  }, [])

  // Spy challenge: online sends WS, local/bot uses store action
  const handleChallenge = useCallback(() => {
    if (gameType === 'online' || !!roomId) {
      wsRef.current?.send(JSON.stringify({ type: 'spy_challenge' }))
    } else {
      challenge()
    }
  }, [gameType, roomId, challenge])

  const handleCloseChallenge = useCallback(() => {
    if (gameType === 'online' || !!roomId) {
      wsRef.current?.send(JSON.stringify({ type: 'spy_skip' }))
    } else {
      closeChallengeWindow()
    }
  }, [gameType, roomId, closeChallengeWindow])

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
    if (quantumCtx?.phase === 'building') return 'Play normally — Branch B will be auto-generated'
    if (quantumCtx?.phase === 'opponent') return 'Superposition active — opponent sees ghost branches'
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

          {/* Spy token bar */}
          {spyCtx && <SpyTokenBar spyCtx={spyCtx} gameState={gameState} />}

          {/* Status line */}
          <div className="text-sm text-stone-400 h-5">
            {isBotThinking && <span className="text-amber-400">Bot is thinking…</span>}
            {!isBotThinking && status && (
              <span className={[
                quantumCtx?.phase === 'building' ? 'text-cyan-400' :
                quantumCtx?.phase === 'opponent' ? 'text-purple-400' :
                hasBar && gameState.phase === 'moving' ? 'text-red-400 font-semibold' :
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
              spyCtx={spyCtx}
            />
          </div>

          {/* Dice */}
          <Dice
            dice={gameState.dice}
            onRoll={effectiveRoll}
            canRoll={canRoll && !isBotThinking && quantumCtx?.phase !== 'building' && !spyCtx?.challengeWindowOpen}
            isRolling={isRolling}
          />
        </div>

        {/* Right-side panels */}
        <div className="flex flex-col gap-4">
          {/* Chat (online only) */}
          {isOnline && (
            <ChatPanel messages={chatMessages} onSend={sendChat} />
          )}
          {/* Quantum moves panel (shown during opponent's turn in superposition) */}
          {quantumCtx?.phase === 'opponent' && (
            <QuantumMovesPanel ctx={quantumCtx} />
          )}
        </div>
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
        <CollapseOverlay
          branch={collapsedBranch}
          onDone={() => { setShowCollapse(false); clearCollapsedBranch() }}
        />
      )}

      {spyCtx?.challengeWindowOpen && (
        <ChallengeWindow
          spyCtx={spyCtx}
          currentPlayer={isOnline && onlineCtx ? onlineCtx.myColor : gameState.current_player}
          isBot={gameType === 'bot'}
          onChallenge={handleChallenge}
          onClose={handleCloseChallenge}
        />
      )}

      {spyResult && (
        <SpyResultToast result={spyResult} onDone={() => { clearSpyResult(); setSpyResultOnline(null) }} />
      )}
    </div>
  )
}
