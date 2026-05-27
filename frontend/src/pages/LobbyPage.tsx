import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import { useGameStore } from '../store/gameStore'
import type { GameMode } from '../store/gameStore'
import type { BotLevel } from '../engine/bot'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const WS_BASE = import.meta.env.VITE_WS_URL ?? API_BASE.replace('https://', 'wss://').replace('http://', 'ws://')

// ── Small modals ──────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-stone-700/50 p-7 flex flex-col gap-5"
        style={{ background: 'linear-gradient(135deg,#140a03,#1e0e05)' }}>
        <div className="flex justify-between items-center">
          <h3 className="text-amber-200 font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300 text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModeSelect({ label, value, onChange }: { label: string; value: GameMode; onChange: (m: GameMode) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-stone-400 text-xs font-semibold uppercase tracking-wider">{label}</label>
      <div className="flex gap-2">
        {(['short', 'long'] as GameMode[]).map(m => (
          <button key={m} onClick={() => onChange(m)}
            className={['flex-1 py-2 rounded-lg border text-sm font-semibold transition-colors',
              value === m
                ? 'border-amber-500 bg-amber-900/30 text-amber-300'
                : 'border-stone-700 text-stone-500 hover:border-stone-500'].join(' ')}>
            {m === 'short' ? '🎯 Short' : '🏛️ Long'}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Matchmaking modal ─────────────────────────────────────────────────────────

function MatchmakingModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<GameMode>('short')
  const [status, setStatus] = useState<'idle' | 'searching' | 'found'>('idle')
  const [seconds, setSeconds] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)
  const { token } = useAuthStore()
  const { setOnlineGame } = useGameStore()
  const navigate = useNavigate()

  function startSearch() {
    const ws = new WebSocket(`${WS_BASE}/ws/matchmaking`)
    wsRef.current = ws
    setStatus('searching')
    setSeconds(0)

    ws.onopen = () => ws.send(JSON.stringify({ type: 'join_queue', mode, token }))
    ws.onmessage = e => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'match_found') {
        setStatus('found')
        // Brief pause then navigate
        setTimeout(() => {
          setOnlineGame(
            { mode, board: [], bar: { white: 0, black: 0 }, off: { white: 0, black: 0 },
              current_player: 'white', dice: { values: [], remaining: [] },
              phase: 'waiting_roll', winner: null, valid_moves: [] },
            { roomId: msg.room_id, myColor: msg.color, opponent: msg.opponent }
          )
          ws.close()
          navigate(`/game/${msg.room_id}`)
        }, 800)
      }
    }
  }

  function stopSearch() {
    if (wsRef.current) { wsRef.current.send(JSON.stringify({ type: 'leave_queue' })); wsRef.current.close() }
    setStatus('idle')
  }

  useEffect(() => {
    if (status !== 'searching') return
    const t = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [status])

  useEffect(() => () => { wsRef.current?.close() }, [])

  return (
    <Modal title="🏆 Ranked Match" onClose={() => { stopSearch(); onClose() }}>
      {status === 'idle' && (
        <>
          <ModeSelect label="Game Mode" value={mode} onChange={setMode} />
          <button onClick={startSearch}
            className="py-3 rounded-xl font-bold text-stone-900 bg-gradient-to-b from-amber-300 to-amber-500 border border-amber-600 hover:from-amber-200 hover:to-amber-400 transition-all">
            Find Match
          </button>
        </>
      )}
      {status === 'searching' && (
        <div className="text-center py-4 flex flex-col gap-4">
          <div className="text-4xl animate-pulse">🔍</div>
          <p className="text-amber-200 font-semibold">Searching for opponent…</p>
          <p className="text-stone-500 text-sm">{seconds}s — Elo window expanding every 15s</p>
          <button onClick={stopSearch} className="text-stone-500 hover:text-stone-300 text-sm underline">Cancel</button>
        </div>
      )}
      {status === 'found' && (
        <div className="text-center py-4">
          <div className="text-4xl mb-2">✅</div>
          <p className="text-green-400 font-semibold">Match found! Loading…</p>
        </div>
      )}
    </Modal>
  )
}

// ── Bot modal ─────────────────────────────────────────────────────────────────

function BotModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<GameMode>('short')
  const [level, setLevel] = useState<BotLevel>('medium')
  const { startBotGame } = useGameStore()
  const navigate = useNavigate()

  async function start() {
    await startBotGame(mode, level, 'black')
    navigate('/game')
    onClose()
  }

  return (
    <Modal title="🤖 vs Bot" onClose={onClose}>
      <ModeSelect label="Game Mode" value={mode} onChange={setMode} />
      <div className="flex flex-col gap-1.5">
        <label className="text-stone-400 text-xs font-semibold uppercase tracking-wider">Difficulty</label>
        <div className="flex gap-2">
          {(['beginner', 'medium', 'advanced'] as BotLevel[]).map(l => (
            <button key={l} onClick={() => setLevel(l)}
              className={['flex-1 py-2 rounded-lg border text-xs font-semibold transition-colors',
                level === l
                  ? 'border-amber-500 bg-amber-900/30 text-amber-300'
                  : 'border-stone-700 text-stone-500 hover:border-stone-500'].join(' ')}>
              {l === 'beginner' ? '🌱' : l === 'medium' ? '⚔️' : '🔥'} {l}
            </button>
          ))}
        </div>
      </div>
      <button onClick={start}
        className="py-3 rounded-xl font-bold text-stone-900 bg-gradient-to-b from-amber-300 to-amber-500 border border-amber-600 hover:from-amber-200 hover:to-amber-400 transition-all">
        Start Game
      </button>
    </Modal>
  )
}

// ── Private room modal ────────────────────────────────────────────────────────

function PrivateModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<GameMode>('short')
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [code, setCode] = useState('')
  const [created, setCreated] = useState<{ code: string; link: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { token } = useAuthStore()
  const { setOnlineGame } = useGameStore()
  const navigate = useNavigate()

  async function create() {
    setLoading(true); setError('')
    try {
      const { data } = await axios.post(`${API_BASE}/rooms/create`, { mode },
        { headers: { Authorization: `Bearer ${token}` } })
      const link = `${window.location.origin}/join/${data.code}`
      setCreated({ code: data.code, link })
      setOnlineGame(
        { mode, board: [], bar: { white: 0, black: 0 }, off: { white: 0, black: 0 },
          current_player: 'white', dice: { values: [], remaining: [] },
          phase: 'waiting_roll', winner: null, valid_moves: [] },
        { roomId: data.room_ws_id, myColor: 'white', opponent: { username: 'Waiting…', elo: 0 } }
      )
      navigate(`/game/${data.room_ws_id}`)
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to create room')
    } finally {
      setLoading(false)
    }
  }

  async function join() {
    setLoading(true); setError('')
    try {
      const { data } = await axios.post(`${API_BASE}/rooms/join/${code.trim().toUpperCase()}`,
        {}, { headers: { Authorization: `Bearer ${token}` } })
      setOnlineGame(
        { mode: data.mode, board: [], bar: { white: 0, black: 0 }, off: { white: 0, black: 0 },
          current_player: 'white', dice: { values: [], remaining: [] },
          phase: 'waiting_roll', winner: null, valid_moves: [] },
        { roomId: data.room_ws_id, myColor: 'black', opponent: { username: 'Host', elo: 0 } }
      )
      navigate(`/game/${data.room_ws_id}`)
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Room not found or expired')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="🔗 Private Room" onClose={onClose}>
      <div className="flex gap-2">
        {(['create', 'join'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={['flex-1 py-2 rounded-lg border text-sm font-semibold transition-colors',
              tab === t ? 'border-amber-500 bg-amber-900/30 text-amber-300' : 'border-stone-700 text-stone-500 hover:border-stone-500'].join(' ')}>
            {t === 'create' ? '+ Create' : '→ Join'}
          </button>
        ))}
      </div>

      {tab === 'create' && (
        <>
          <ModeSelect label="Game Mode" value={mode} onChange={setMode} />
          <button onClick={create} disabled={loading}
            className="py-3 rounded-xl font-bold text-stone-900 bg-gradient-to-b from-amber-300 to-amber-500 border border-amber-600 hover:from-amber-200 hover:to-amber-400 transition-all disabled:opacity-50">
            {loading ? 'Creating…' : 'Create Room'}
          </button>
        </>
      )}

      {tab === 'join' && (
        <>
          <input value={code} onChange={e => setCode(e.target.value)}
            placeholder="Enter 6-char code"
            className="w-full px-3 py-2.5 rounded-lg bg-stone-900/60 border border-stone-700 text-amber-200 placeholder-stone-600 text-center font-mono tracking-widest uppercase focus:outline-none focus:border-amber-600" />
          <button onClick={join} disabled={loading || code.trim().length !== 6}
            className="py-3 rounded-xl font-bold text-stone-900 bg-gradient-to-b from-amber-300 to-amber-500 border border-amber-600 hover:from-amber-200 hover:to-amber-400 transition-all disabled:opacity-50">
            {loading ? 'Joining…' : 'Join Room'}
          </button>
        </>
      )}

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
    </Modal>
  )
}

// ── Lobby page ────────────────────────────────────────────────────────────────

type ModalType = 'ranked' | 'bot' | 'private' | null

export default function LobbyPage() {
  const [modal, setModal] = useState<ModalType>(null)
  const { user } = useAuthStore()
  const { startLocalGame } = useGameStore()
  const navigate = useNavigate()

  async function playLocal() {
    await startLocalGame('short')
    navigate('/game')
  }

  const CARDS = [
    { id: 'ranked' as ModalType, icon: '🏆', title: 'Ranked Match', desc: 'Get matched by Elo. Win to climb.', accent: 'amber' },
    { id: 'bot' as ModalType, icon: '🤖', title: 'vs Bot', desc: 'Beginner, Medium, or Advanced AI.', accent: 'stone' },
    { id: 'private' as ModalType, icon: '🔗', title: 'Private Room', desc: 'Invite a friend with a code or link.', accent: 'stone' },
    { id: null, icon: '🎮', title: 'Local 2-Player', desc: 'Pass & play on one device.', accent: 'stone', action: playLocal },
  ]

  return (
    <div className="flex-1 flex flex-col items-center px-6 py-16 gap-10">
      {user && (
        <div className="text-center">
          <h1 className="text-3xl font-black text-amber-100">
            Welcome back, <span className="text-amber-400">{user.username}</span>
          </h1>
          <p className="text-stone-500 mt-1">
            Elo: <span className="text-amber-400 font-bold">{user.elo}</span>
            {user.win_streak >= 3 && <span className="ml-2">🔥 {user.win_streak}-game streak!</span>}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">
        {CARDS.map(card => (
          <button
            key={card.title}
            onClick={card.action ?? (() => setModal(card.id))}
            className={[
              'flex flex-col items-start gap-3 p-7 rounded-2xl border text-left',
              'transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]',
              card.accent === 'amber'
                ? 'border-amber-700/60 bg-amber-900/15 hover:border-amber-500 hover:bg-amber-900/25'
                : 'border-stone-700/50 bg-stone-900/30 hover:border-stone-500 hover:bg-stone-800/30',
            ].join(' ')}
          >
            <span className="text-4xl">{card.icon}</span>
            <div>
              <div className="text-amber-100 font-bold text-lg">{card.title}</div>
              <div className="text-stone-500 text-sm mt-0.5">{card.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {modal === 'ranked' && <MatchmakingModal onClose={() => setModal(null)} />}
      {modal === 'bot' && <BotModal onClose={() => setModal(null)} />}
      {modal === 'private' && <PrivateModal onClose={() => setModal(null)} />}
    </div>
  )
}
