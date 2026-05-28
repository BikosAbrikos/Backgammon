import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
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
  beginner: 'Beginner', medium: 'Medium', advanced: 'Advanced',
}

// ── Pip count helper ──────────────────────────────────────────────────────────

function calcPip(state: GameState, player: Player): number {
  let count = state.bar[player] * 25
  for (let i = 0; i < 24; i++) {
    if (state.board[i].player === player) {
      const dist = player === 'white' ? i + 1 : 24 - i
      count += dist * state.board[i].count
    }
  }
  return count
}

// ── Player panel ──────────────────────────────────────────────────────────────

function PlayerCard({
  name, elo, avatar, color, isActive, isYou, pip, winStreak,
}: {
  name: string; elo?: number; avatar?: string; color: 'white' | 'black'
  isActive: boolean; isYou?: boolean; pip?: number; winStreak?: number
}) {
  return (
    <div className={[
      'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300 min-w-[160px]',
      isActive
        ? 'border-amber-500/60 bg-amber-900/20 shadow-[0_0_16px_rgba(245,158,11,0.18)]'
        : 'border-stone-800/50 bg-stone-900/20 opacity-55',
    ].join(' ')}>
      {/* Avatar */}
      <div className={[
        'text-2xl w-10 h-10 flex items-center justify-center rounded-lg border shrink-0',
        isActive ? 'border-amber-600/40 bg-amber-950/40' : 'border-stone-800/40 bg-stone-950/30',
      ].join(' ')}>
        {avatar ? AVATARS[avatar] ?? '🎲' : color === 'white' ? '⬜' : '⬛'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-bold text-amber-100 truncate max-w-[100px]">{name}</span>
          {isYou && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-400 font-bold uppercase tracking-wide shrink-0">
              YOU
            </span>
          )}
          {winStreak !== undefined && winStreak >= 3 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-900/50 text-orange-400 font-bold shrink-0">
              🔥{winStreak}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {elo !== undefined && (
            <span className="text-[11px] text-amber-600 font-mono">{elo} ELO</span>
          )}
          {pip !== undefined && (
            <span className={[
              'text-[11px] font-mono font-semibold',
              isActive ? 'text-stone-300' : 'text-stone-600',
            ].join(' ')}>
              {pip}pip
            </span>
          )}
        </div>
      </div>

      {/* Active indicator */}
      {isActive && (
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
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
  const whitePip = calcPip(gameState, 'white')
  const blackPip = calcPip(gameState, 'black')

  if (gameType === 'online' && onlineCtx) {
    const myColor = onlineCtx.myColor
    const oppColor = myColor === 'white' ? 'black' : 'white'
    const opp = onlineCtx.opponent
    const myPip  = myColor === 'white' ? whitePip : blackPip
    const oppPip = oppColor === 'white' ? whitePip : blackPip

    return (
      <div className="flex items-center gap-3 justify-center flex-wrap">
        <PlayerCard
          name={user?.username ?? 'You'}
          elo={user?.elo}
          avatar={user?.avatar}
          color={myColor}
          isActive={current === myColor}
          isYou
          pip={myPip}
          winStreak={user?.win_streak}
        />
        <div className="flex flex-col items-center gap-1">
          <span className="text-stone-600 font-bold text-sm">vs</span>
        </div>
        <PlayerCard
          name={opp.username}
          elo={opp.elo}
          color={oppColor}
          isActive={current === oppColor}
          pip={oppPip}
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
          pip={playerColor === 'white' ? whitePip : blackPip}
          winStreak={user?.win_streak}
        />
        <div className="flex flex-col items-center gap-1">
          <span className="text-stone-600 font-bold text-sm">vs</span>
        </div>
        <PlayerCard
          name={`${BOT_LEVEL_LABEL[botLevel]} Bot`}
          color={botColor ?? 'black'}
          isActive={current === botColor}
          pip={(botColor ?? 'black') === 'white' ? whitePip : blackPip}
        />
      </div>
    )
  }

  // Local 2P
  return (
    <div className="flex items-center gap-3 justify-center flex-wrap">
      <PlayerCard name="White" color="white" isActive={current === 'white'} pip={whitePip} />
      <span className="text-stone-600 font-bold text-sm">vs</span>
      <PlayerCard name="Black" color="black" isActive={current === 'black'} pip={blackPip} />
    </div>
  )
}

// ── Turn status banner ────────────────────────────────────────────────────────

function TurnBanner({
  isMyTurn, opponentName, isBotThinking, quantumPhase, hasBar, selectedPoint, phase,
}: {
  isMyTurn: boolean
  opponentName: string
  isBotThinking: boolean
  quantumPhase?: 'building' | 'opponent' | null
  hasBar: boolean
  selectedPoint: number | 'bar' | null
  phase: string
}) {
  if (isBotThinking) return (
    <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-stone-900/50 border border-stone-800/40 text-amber-400 text-sm">
      <span className="animate-pulse">●</span> Bot is thinking…
    </div>
  )

  if (quantumPhase === 'building') return (
    <div className="px-4 py-1.5 rounded-lg bg-cyan-900/30 border border-cyan-600/30 text-cyan-300 text-sm font-semibold">
      ⚛️ Make your moves — first half → Branch A, second half → Branch B
    </div>
  )
  if (quantumPhase === 'opponent') return (
    <div className="px-4 py-1.5 rounded-lg bg-purple-900/30 border border-purple-600/30 text-purple-300 text-sm">
      ⚛️ Superposition active — ghost branches visible on board
    </div>
  )

  if (hasBar && phase === 'moving') return (
    <div className="px-4 py-1.5 rounded-lg bg-red-900/30 border border-red-700/40 text-red-300 text-sm font-semibold">
      ⚠️ Must re-enter from the bar first
    </div>
  )

  if (!isMyTurn) return (
    <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-stone-900/40 border border-stone-800/40 text-stone-500 text-sm">
      <span className="w-1.5 h-1.5 rounded-full bg-stone-600 animate-pulse inline-block" />
      Waiting for {opponentName}…
    </div>
  )

  if (phase === 'waiting_roll') return (
    <div className="px-4 py-1.5 rounded-lg bg-amber-900/20 border border-amber-700/30 text-amber-300 text-sm font-semibold">
      🎲 Your turn — roll the dice
    </div>
  )

  if (selectedPoint !== null) return (
    <div className="px-4 py-1.5 rounded-lg bg-green-900/20 border border-green-700/30 text-green-300 text-sm">
      ✓ Select a highlighted point to move
    </div>
  )

  return (
    <div className="px-4 py-1.5 rounded-lg bg-amber-900/20 border border-amber-700/30 text-amber-300 text-sm">
      Select a checker to move
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
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/80">
      <div className="flex flex-col items-center gap-5 p-10 rounded-2xl border border-amber-600/40 text-center shadow-2xl"
        style={{ background: 'linear-gradient(135deg,#1c0f04,#2a1508)' }}>
        <div className="text-7xl">{isMe === true ? '🏆' : isMe === false ? '😔' : winner === 'white' ? '⬜' : '⬛'}</div>
        <div>
          <h2 className="text-3xl font-bold text-amber-200 mb-2">
            {isMe === true ? 'Victory!' : isMe === false ? 'Defeated' : `${winner === 'white' ? 'White' : 'Black'} Wins!`}
          </h2>
          {delta !== null && (
            <p className={['text-xl font-bold font-mono', delta >= 0 ? 'text-green-400' : 'text-red-400'].join(' ')}>
              {delta >= 0 ? '+' : ''}{delta} ELO
            </p>
          )}
          {delta === null && eloChange && myColor && (
            <p className="text-stone-500 text-sm mt-1">Calculating ELO…</p>
          )}
        </div>
        <button onClick={onRestart}
          className="px-10 py-3 rounded-xl font-bold text-stone-900 text-lg
            bg-gradient-to-b from-amber-300 to-amber-500 border border-amber-600
            hover:from-amber-200 hover:to-amber-400 active:scale-95 transition-all shadow-lg">
          Back to Lobby
        </button>
      </div>
    </div>
  )
}

// ── Quantum collapse overlay ──────────────────────────────────────────────────

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

function QuantumMovesPanel({ ctx }: { ctx: QuantumCtx }) {
  return (
    <div className="flex flex-col gap-4 w-52 bg-stone-950/80 border border-stone-800/60 rounded-xl p-4 text-xs shrink-0">
      <div className="text-center">
        <div className="text-base font-bold text-stone-200">⚛️ Superposition</div>
        <div className="text-stone-500 text-[10px] mt-0.5">Opponent sees both branches</div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 font-semibold text-cyan-400">
          <div className="w-3 h-3 rounded-full bg-cyan-400/70 border border-cyan-300 shrink-0" />
          Branch A — First move
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
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 font-semibold text-orange-400">
          <div className="w-3 h-3 rounded-full bg-orange-400/70 border border-orange-300 shrink-0" />
          Branch B — Full turn
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
      <div className="flex flex-col gap-1.5 text-[10px] text-stone-500">
        <div className="font-semibold text-stone-400 text-xs">Board legend:</div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-amber-100 border-2 border-cyan-400 shrink-0 opacity-50" />
          <span><span className="text-cyan-400 font-semibold">Cyan</span> ghost = Branch A</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-amber-100 border-2 border-orange-400 shrink-0 opacity-50" />
          <span><span className="text-orange-400 font-semibold">Orange</span> ghost = Branch B</span>
        </div>
        <div className="mt-1 text-stone-600 leading-relaxed">
          50 / 50 collapse on opponent's next roll.
        </div>
      </div>
    </div>
  )
}

// ── Spy Mode UI ───────────────────────────────────────────────────────────────

function SpyTokenBar({ spyCtx, gameState }: { spyCtx: SpyCtx; gameState: GameState }) {
  if (gameState.mode !== 'spy') return null
  const players: Player[] = ['white', 'black']
  return (
    <div className="flex items-center justify-center gap-6 px-4 py-1.5 rounded-lg border border-red-900/40 bg-red-950/20 text-xs">
      {players.map(p => (
        <div key={p} className="flex items-center gap-1.5">
          <span>{p === 'white' ? '⬜' : '⬛'}</span>
          <span className="text-stone-500">{p === 'white' ? 'White' : 'Black'}:</span>
          {Array.from({ length: 3 }).map((_, i) => (
            <span key={i} className={i < spyCtx.tokensRemaining[p] ? 'text-red-400' : 'text-stone-700'}>🕵️</span>
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
  const [remaining, setRemaining] = useState(7)
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
  if (isBot && !isMover) return null

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center pb-24 pointer-events-none">
      <div className="flex flex-col items-center gap-3 px-8 py-5 rounded-2xl border border-red-700/50 pointer-events-auto shadow-2xl"
        style={{ background: 'linear-gradient(135deg,#1a0505,#2d0a0a)' }}>
        <div className="text-sm text-stone-400">
          <span className={mover === 'white' ? 'text-amber-200 font-bold' : 'text-stone-300 font-bold'}>
            {mover === 'white' ? 'White' : 'Black'}
          </span>
          {isMover ? ' just moved — waiting for opponent…' : ' just moved — do you want to challenge?'}
        </div>
        <div className="w-64 h-2 rounded-full bg-stone-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(remaining / 7) * 100}%`,
              background: remaining > 3 ? '#ef4444' : remaining > 1 ? '#f97316' : '#dc2626',
            }}
          />
        </div>
        <div className="text-xs text-stone-500">{remaining}s remaining</div>
        {!isMover && (
          <div className="flex gap-3">
            <button onClick={onChallenge}
              className="px-6 py-2.5 rounded-xl font-bold text-white text-sm border border-red-500
                bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700
                active:scale-95 transition-all shadow-lg shadow-red-900/50">
              ⚡ Challenge
            </button>
            <button onClick={onClose}
              className="px-4 py-2.5 rounded-xl font-semibold text-stone-400 text-sm border border-stone-700
                bg-stone-900/50 hover:border-stone-500 hover:text-stone-200 transition-colors">
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
        {result === 'caught' ? '🚨 Illegal move caught — piece to bar!' : '✅ Legal move — challenge failed!'}
      </div>
    </div>
  )
}

// ── Chat sidebar ──────────────────────────────────────────────────────────────

const QUICK = ['gg', 'nice!', 'brb', 'gl hf']

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
    <div className="flex flex-col w-52 bg-stone-900/60 rounded-xl border border-stone-800/50 overflow-hidden">
      <div className="px-3 py-2 border-b border-stone-800/50 text-[10px] text-stone-500 font-bold uppercase tracking-widest">
        Chat
      </div>
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 min-h-0" style={{ maxHeight: '220px' }}>
        {messages.length === 0 && (
          <div className="text-[10px] text-stone-700 italic text-center py-4">No messages yet</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="text-xs">
            <span className={m.from === 'you' ? 'text-amber-400 font-semibold' : 'text-stone-500 font-semibold'}>
              {m.from}:{' '}
            </span>
            <span className="text-stone-300">{m.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-1 p-1.5 flex-wrap border-t border-stone-800/30">
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

// ── Side panel (online) ───────────────────────────────────────────────────────

function SidePanel({
  isOnline, messages, onSend, onResign, quantumCtx,
}: {
  isOnline: boolean
  messages: { from: string; text: string; ts: number }[]
  onSend: (text: string) => void
  onResign: () => void
  quantumCtx: QuantumCtx | null
}) {
  const [confirmResign, setConfirmResign] = useState(false)

  return (
    <div className="flex flex-col gap-3 shrink-0">
      {isOnline && <ChatPanel messages={messages} onSend={onSend} />}

      {quantumCtx?.phase === 'opponent' && <QuantumMovesPanel ctx={quantumCtx} />}

      {isOnline && (
        <div className="flex flex-col gap-2">
          {!confirmResign ? (
            <button
              onClick={() => setConfirmResign(true)}
              className="w-full px-4 py-2 rounded-lg text-xs font-semibold text-stone-500 border border-stone-800/60
                bg-stone-900/40 hover:border-red-800/60 hover:text-red-400 transition-colors"
            >
              Resign
            </button>
          ) : (
            <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-red-800/50 bg-red-950/20">
              <div className="text-xs text-red-300 text-center font-semibold">Resign this game?</div>
              <div className="flex gap-2">
                <button
                  onClick={onResign}
                  className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white border border-red-600
                    bg-gradient-to-b from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmResign(false)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-stone-400 border border-stone-700
                    bg-stone-900/50 hover:text-stone-200 transition-colors"
                >
                  No
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main GamePage ─────────────────────────────────────────────────────────────

export default function GamePage() {
  const { roomId } = useParams<{ roomId?: string }>()
  const { search } = useLocation()
  const inviteCode = new URLSearchParams(search).get('code')
  const navigate = useNavigate()
  const { token, user } = useAuthStore()
  const {
    gameState, gameType, selectedPoint, isRolling, isBotThinking,
    botLevel, botColor, onlineCtx, chatMessages, eloChange, quantumCtx, collapsedBranch,
    spyCtx, spyResult, pendingFlush,
    rollDice, selectPoint, moveTo, clearSelection,
    setBotThinking, applyBotState, applyBotSpyMove, setOnlineGame, receiveOnlineState,
    updateOnlineOpponent,
    setEloChange, addChat, reset, clearCollapsedBranch,
    challenge, closeChallengeWindow, clearSpyResult,
    setSpyCtxOnline, setQuantumCtxOnline, setCollapsedBranchOnline, setSpyResultOnline,
    clearOnlinePending,
  } = useGameStore()

  const wsRef = useRef<WebSocket | null>(null)
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [opponentLeft, setOpponentLeft] = useState(false)
  const [showCollapse, setShowCollapse] = useState(false)

  useEffect(() => {
    return () => { reset() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Flush batch moves when pendingFlush is set ────────────────────────────

  useEffect(() => {
    if (!pendingFlush || pendingFlush.length === 0) return
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'batch_moves', moves: pendingFlush }))
    }
    clearOnlinePending()
  }, [pendingFlush])

  // ── Online WS management ──────────────────────────────────────────────────

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
          // Private room: creator already has myColor set but opponent starts as "Waiting…".
          // When the second player joins, the backend sends a game_state with players info —
          // update the opponent card without resetting the rest of the game store.
          if (msg.players && onlineCtx?.opponent?.username === 'Waiting…') {
            const oppColor = onlineCtx.myColor === 'white' ? 'black' : 'white'
            const opp = msg.players[oppColor]
            if (opp && opp.username !== 'Waiting…') updateOnlineOpponent(opp)
          }
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
          if (msg.state?.mode === 'spy' && msg.spy_tokens) {
            setSpyCtxOnline({
              tokensRemaining: msg.spy_tokens,
              lastMove: null,
              challengeWindowOpen: false,
              challengeExpires: null,
            })
          }

        } else if (msg.type === 'spy_state') {
          receiveOnlineState(msg.state)
          setSpyCtxOnline({
            tokensRemaining: msg.spy_tokens,
            lastMove: { mover: msg.last_mover, dest: -1, wasIllegal: false },
            challengeWindowOpen: true,
            challengeExpires: Date.now() + 7000,
          })

        } else if (msg.type === 'spy_result') {
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
          if (msg.state) receiveOnlineState(msg.state)
          setQuantumCtxOnline(null)
          setCollapsedBranchOnline(msg.branch)
          setShowCollapse(true)

        } else if (msg.type === 'game_over') {
          if (msg.state) receiveOnlineState(msg.state)
          if (msg.elo_change) setEloChange(msg.elo_change)

        } else if (msg.type === 'chat') {
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

    const pingId = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 20_000)

    return () => {
      cancelled = true
      clearInterval(pingId)
      wsRef.current?.close()
    }
  }, [roomId, token])

  // ── Bot automation ────────────────────────────────────────────────────────

  useEffect(() => {
    if (gameType !== 'bot' || !botColor || !botLevel || !gameState) return

    const shouldStartTurn = gameState.phase === 'waiting_roll' && gameState.current_player === botColor
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
              return
            }
          }
        }
      }

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
  }, [gameState?.current_player, spyCtx?.challengeWindowOpen, gameType, botColor])

  // ── Bot spy challenge automation ──────────────────────────────────────────

  useEffect(() => {
    if (gameType !== 'bot' || !spyCtx?.challengeWindowOpen || !botColor || !botLevel) return
    const mover = spyCtx.lastMove?.mover
    if (mover === botColor) return
    const timer = setTimeout(() => {
      if (botShouldChallenge(botLevel)) challenge()
      else closeChallengeWindow()
    }, 500 + Math.random() * 500)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spyCtx?.challengeWindowOpen, gameType, botColor, botLevel])

  // ── Quantum collapse visual feedback ──────────────────────────────────────

  const prevPhaseRef = useRef<QuantumCtx['phase'] | null>(null)
  useEffect(() => {
    const onl = gameType === 'online' || !!roomId
    if (onl) return
    const prev = prevPhaseRef.current
    const cur = quantumCtx?.phase ?? null
    if (prev === 'opponent' && cur === null) setShowCollapse(true)
    prevPhaseRef.current = cur
  }, [quantumCtx?.phase, gameType, roomId])

  // ── Online proxies ────────────────────────────────────────────────────────

  const onlineRoll = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'roll_dice' }))
  }, [])

  // Used only for spy/quantum online (short/long use moveTo with local batch)
  const onlineMove = useCallback((to: number | 'off') => {
    wsRef.current?.send(JSON.stringify({ type: 'make_move', from_pos: selectedPoint, to_pos: to }))
    clearSelection()
  }, [selectedPoint])

  const sendChat = useCallback((text: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'chat', text }))
  }, [])

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

  const handleResign = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'resign' }))
  }, [])

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (!gameState && !roomId) {
    navigate('/lobby')
    return null
  }

  if (!gameState || ((gameType === 'online' || !!roomId) && gameState.board.length === 0)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-5 p-10 rounded-2xl border border-stone-800/50"
          style={{ background: 'linear-gradient(135deg,#110a03,#1c0f05)' }}>
          <div className="text-4xl animate-pulse">⌛</div>
          <p className="text-amber-300 font-semibold text-lg">Waiting for opponent…</p>
          {inviteCode && (
            <>
              <p className="text-stone-500 text-sm">Share this code with a friend:</p>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-mono font-black tracking-[0.2em] text-amber-200 select-all">
                  {inviteCode}
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(inviteCode)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-stone-700 text-stone-400 hover:text-amber-300 hover:border-amber-700 transition-colors"
                >
                  Copy
                </button>
              </div>
              <p className="text-stone-600 text-xs">
                Link: <span className="text-stone-500 select-all">{window.location.origin}/join/{inviteCode}</span>
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  const isOnline = gameType === 'online' || !!roomId
  const myColor = onlineCtx?.myColor ?? null
  const isMyTurn = isOnline
    ? gameState.current_player === myColor
    : true
  const canRoll = gameState.phase === 'waiting_roll' && (isOnline ? isMyTurn : true)
  const hasBar = gameState.bar[gameState.current_player] > 0

  // Board is flipped for black player in online games
  const boardFlipped = isOnline && myColor === 'black'

  // Spy/quantum online still use per-move WS; short/long use moveTo (batched locally)
  const useDirectWs = isOnline && (gameState.mode === 'spy' || gameState.mode === 'quantum')
  const effectiveRoll = isOnline ? onlineRoll : rollDice
  const effectiveMove = useDirectWs ? onlineMove : moveTo

  const ghostBranches = quantumCtx?.phase === 'opponent' && quantumCtx.branchA && quantumCtx.branchB
    ? { branchA: quantumCtx.branchA, branchB: quantumCtx.branchB, quantumPlayer: quantumCtx.quantumPlayer }
    : undefined

  function handleRestart() {
    reset()
    navigate('/lobby')
  }

  // Whether board interaction should be blocked (opponent's turn in online)
  const boardBlocked =
    (isOnline && !isMyTurn) ||
    (gameType === 'bot' && !!botColor && gameState.current_player === botColor)

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar gameState={gameState} onRestart={handleRestart} />

      {/* Connection banners */}
      {isOnline && wsStatus === 'connecting' && (
        <div className="text-center py-1.5 bg-amber-900/30 text-amber-300 text-xs">
          Connecting to game server…
        </div>
      )}
      {wsStatus === 'disconnected' && isOnline && (
        <div className="text-center py-1.5 bg-red-900/30 text-red-300 text-xs">
          Connection lost — reconnecting…
        </div>
      )}
      {opponentLeft && (
        <div className="text-center py-1.5 bg-red-900/30 text-red-300 text-xs">
          Opponent disconnected — waiting 30s for reconnect
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row items-start justify-center gap-6 p-4 lg:p-6">

        {/* ── Centre column ─────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-4 w-full max-w-[880px]">

          {/* Player panel */}
          <PlayerPanel
            gameType={gameType}
            gameState={gameState}
            onlineCtx={onlineCtx}
            botLevel={botLevel}
            botColor={botColor}
            user={user}
          />

          {/* Mode-specific status bars */}
          {spyCtx && <SpyTokenBar spyCtx={spyCtx} gameState={gameState} />}

          {/* Turn status banner */}
          <TurnBanner
            isMyTurn={isMyTurn || !isOnline}
            opponentName={onlineCtx?.opponent.username ?? (botLevel ? 'Bot' : 'Opponent')}
            isBotThinking={isBotThinking}
            quantumPhase={quantumCtx?.phase}
            hasBar={hasBar}
            selectedPoint={selectedPoint}
            phase={gameState.phase}
          />

          {/* Board + overlay wrapper */}
          <div className="w-full overflow-x-auto pb-2 relative">
            <Board
              gameState={gameState}
              selectedPoint={selectedPoint}
              onSelectPoint={selectPoint}
              onMoveToPoint={effectiveMove}
              ghostBranches={ghostBranches}
              spyCtx={spyCtx}
              flipped={boardFlipped}
            />

            {/* Dim overlay when it's not your turn (online games) */}
            {boardBlocked && (
              <div
                className="absolute inset-0 rounded-[18px] pointer-events-none"
                style={{
                  background: 'rgba(0,0,0,0.28)',
                  backdropFilter: 'brightness(0.85)',
                }}
              />
            )}
          </div>

          {/* Dice */}
          <Dice
            dice={gameState.dice}
            onRoll={effectiveRoll}
            canRoll={canRoll && !isBotThinking && quantumCtx?.phase !== 'building' && !spyCtx?.challengeWindowOpen}
            isRolling={isRolling}
          />
        </div>

        {/* ── Right column (online panels) ──────────────────────────────── */}
        <div className="lg:mt-[96px]">
          <SidePanel
            isOnline={isOnline}
            messages={chatMessages}
            onSend={sendChat}
            onResign={handleResign}
            quantumCtx={quantumCtx}
          />
        </div>
      </div>

      {/* Overlays */}
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

      {spyCtx?.challengeWindowOpen && spyCtx.lastMove && (
        <ChallengeWindow
          spyCtx={spyCtx}
          currentPlayer={
            isOnline && onlineCtx ? onlineCtx.myColor
            : gameType === 'local' ? (spyCtx.lastMove.mover === 'white' ? 'black' : 'white')
            : gameType === 'bot' && spyCtx.lastMove.mover === botColor
              ? (botColor === 'black' ? 'white' : 'black')
              : gameState.current_player
          }
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
