import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

interface Profile {
  id: string
  username: string
  elo: number
  games_played: number
  games_won: number
  win_streak: number
  avatar: string
  created_at: string
}

interface GameRecord {
  id: string
  mode: string
  type: string
  opponent_username: string | null
  bot_level: string | null
  result: 'win' | 'loss' | 'draw'
  elo_change: number
  created_at: string
}

const AVATAR_ICONS: Record<string, string> = {
  default: '🎲', knight: '♞', crown: '👑', dice: '🎯',
  dragon: '🐉', fox: '🦊', owl: '🦉', rocket: '🚀',
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { user: me } = useAuthStore()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [history, setHistory] = useState<GameRecord[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [histLoading, setHistLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    setLoading(true)
    setNotFound(false)
    axios.get(`${API_BASE}/users/${username}`)
      .then(r => setProfile(r.data))
      .catch(e => { if (e?.response?.status === 404) setNotFound(true) })
      .finally(() => setLoading(false))
  }, [username])

  useEffect(() => {
    if (!profile) return
    setHistLoading(true)
    axios.get(`${API_BASE}/users/${username}/history?page=${page}`)
      .then(r => {
        if (page === 1) setHistory(r.data)
        else setHistory(prev => [...prev, ...r.data])
        setHasMore(r.data.length === 20)
      })
      .catch(() => {})
      .finally(() => setHistLoading(false))
  }, [profile, page])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-stone-600">Loading…</div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
        <div className="text-5xl">🤷</div>
        <h2 className="text-xl font-bold text-amber-200">Player not found</h2>
        <Link to="/leaderboard" className="text-amber-600 hover:text-amber-400 text-sm">
          ← Back to leaderboard
        </Link>
      </div>
    )
  }

  const winRate = profile.games_played > 0
    ? Math.round((profile.games_won / profile.games_played) * 100)
    : 0
  const losses = profile.games_played - profile.games_won
  const isMe = me?.username === profile.username

  return (
    <div className="flex-1 flex flex-col items-center px-6 py-12 gap-8 max-w-2xl mx-auto w-full">
      {/* Profile card */}
      <div className="w-full rounded-2xl border border-stone-800/60 p-8 flex flex-col sm:flex-row items-center gap-6"
        style={{ background: 'linear-gradient(135deg,#140a03,#1e0e05)' }}>
        <div className="text-7xl select-none">
          {AVATAR_ICONS[profile.avatar] ?? '🎲'}
        </div>
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <h1 className="text-3xl font-black text-amber-100">{profile.username}</h1>
            {profile.win_streak >= 3 && (
              <span className="text-lg">🔥 {profile.win_streak}</span>
            )}
          </div>
          <p className="text-amber-400 font-bold text-xl mt-1">{profile.elo} Elo</p>
          {isMe && (
            <Link to="/lobby" className="inline-block mt-3 text-xs text-amber-600 hover:text-amber-400 underline">
              Edit Avatar →
            </Link>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <Stat label="Played" value={profile.games_played} />
          <Stat label="Won" value={profile.games_won} />
          <Stat label="Win %" value={`${winRate}%`} />
        </div>
      </div>

      {/* Match history */}
      <div className="w-full">
        <h2 className="text-xl font-bold text-amber-200 mb-4">Match History</h2>

        {history.length === 0 && !histLoading && (
          <div className="text-stone-600 text-center py-8 text-sm">No games played yet.</div>
        )}

        <div className="flex flex-col gap-2">
          {history.map(g => (
            <div key={g.id}
              className="flex items-center gap-4 px-4 py-3 rounded-xl border border-stone-800/40 bg-stone-900/20">
              <div className={['w-2 h-10 rounded-full shrink-0',
                g.result === 'win' ? 'bg-green-500' : 'bg-red-500'].join(' ')} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-stone-200">
                  {g.result === 'win' ? 'Win' : 'Loss'}{' '}
                  <span className="text-stone-500 font-normal">vs{' '}
                    {g.opponent_username
                      ? <Link to={`/profile/${g.opponent_username}`}
                          className="text-amber-400 hover:text-amber-300">{g.opponent_username}</Link>
                      : <span className="text-stone-500">🤖 Bot ({g.bot_level})</span>
                    }
                  </span>
                </div>
                <div className="text-xs text-stone-600 mt-0.5">
                  {g.mode} · {g.type} · {new Date(g.created_at).toLocaleDateString()}
                </div>
              </div>
              {g.elo_change !== 0 && (
                <span className={['text-sm font-mono font-bold shrink-0',
                  g.elo_change > 0 ? 'text-green-400' : 'text-red-400'].join(' ')}>
                  {g.elo_change > 0 ? '+' : ''}{g.elo_change}
                </span>
              )}
            </div>
          ))}
        </div>

        {hasMore && (
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={histLoading}
            className="mt-4 w-full py-2.5 rounded-xl border border-stone-700 text-stone-500
              hover:border-stone-500 hover:text-stone-300 transition-colors text-sm disabled:opacity-50">
            {histLoading ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xl font-bold text-amber-300">{value}</div>
      <div className="text-xs text-stone-500 mt-0.5">{label}</div>
    </div>
  )
}
