import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import type { AuthUser } from '../store/authStore'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<AuthUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get(`${API_BASE}/users/leaderboard?limit=50`)
      .then(r => setPlayers(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex-1 flex flex-col items-center px-6 py-12 gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-black text-amber-100">🏆 Leaderboard</h1>
        <p className="text-stone-500 mt-2 text-sm">Top players ranked by Elo rating</p>
      </div>

      <div className="w-full max-w-2xl rounded-2xl border border-stone-800/60 overflow-hidden">
        <div className="grid grid-cols-[2.5rem_1fr_auto_auto] gap-x-4 px-5 py-3
          text-xs text-stone-500 border-b border-stone-800/60 font-mono uppercase tracking-wider"
          style={{ background: 'rgba(0,0,0,0.3)' }}>
          <span>#</span>
          <span>Player</span>
          <span className="text-right">Win Rate</span>
          <span className="text-right">Elo</span>
        </div>

        {loading && (
          <div className="px-5 py-12 text-stone-600 text-center text-sm">Loading…</div>
        )}

        {!loading && players.length === 0 && (
          <div className="px-5 py-12 text-stone-600 text-center text-sm">
            No players yet — be the first to climb the ranks!
          </div>
        )}

        {players.map((p, i) => {
          const winRate = p.games_played > 0 ? Math.round((p.games_won / p.games_played) * 100) : 0
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null

          return (
            <Link
              key={p.id}
              to={`/profile/${p.username}`}
              className="grid grid-cols-[2.5rem_1fr_auto_auto] gap-x-4 px-5 py-4 items-center
                hover:bg-stone-800/20 transition-colors border-b border-stone-900/40 last:border-0"
            >
              <span className="font-mono text-sm">
                {medal ?? <span className="text-stone-600">{i + 1}</span>}
              </span>

              <div className="flex items-center gap-2 min-w-0">
                <span className="text-amber-100 font-semibold truncate">
                  {p.username}
                </span>
                {p.win_streak >= 3 && (
                  <span className="text-xs shrink-0">🔥 {p.win_streak}</span>
                )}
              </div>

              <span className="text-stone-500 text-sm font-mono text-right">
                {p.games_played > 0 ? `${winRate}%` : '—'}
              </span>

              <span className="text-amber-400 font-mono font-bold text-right">{p.elo}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
