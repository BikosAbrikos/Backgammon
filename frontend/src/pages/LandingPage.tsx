import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import type { AuthUser } from '../store/authStore'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const FEATURES = [
  { icon: '🏆', title: 'Ranked Matches', desc: 'Compete in Elo-rated games. Climb the global leaderboard.' },
  { icon: '🤖', title: 'AI Practice', desc: 'Three difficulty levels. Train your strategy anytime.' },
  { icon: '🔗', title: 'Private Rooms', desc: 'Challenge a friend with a code or shareable link.' },
  { icon: '👥', title: 'Social Play', desc: 'Add friends, track history, and build your profile.' },
]

const STEPS = [
  { n: '1', title: 'Create Account', desc: 'Free to join in seconds' },
  { n: '2', title: 'Choose Opponent', desc: 'Ranked, bot, or invite a friend' },
  { n: '3', title: 'Climb the Ranks', desc: 'Win games, earn Elo, top the leaderboard' },
]

function MiniBoard() {
  return (
    <div className="relative w-72 h-44 rounded-xl overflow-hidden shadow-2xl border border-amber-900/40"
      style={{ background: 'linear-gradient(180deg,#7c4f2a,#4a2e12)' }}>
      <div className="absolute inset-2 rounded-lg flex" style={{ background: '#1e0e05' }}>
        {[...Array(12)].map((_, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div
              className="w-full"
              style={{
                height: '45%',
                clipPath: i % 2 === 0 ? 'polygon(10% 0%,50% 90%,90% 0%)' : 'polygon(10% 0%,50% 90%,90% 0%)',
                background: i % 2 === 0 ? '#b91c1c' : '#d4cfc8',
                opacity: 0.7,
              }}
            />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-8 h-full bg-amber-800/50" />
      </div>
    </div>
  )
}

export default function LandingPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [topPlayers, setTopPlayers] = useState<AuthUser[]>([])

  useEffect(() => {
    axios.get(`${API_BASE}/users/leaderboard?limit=5`).then(r => setTopPlayers(r.data)).catch(() => {})
  }, [])

  const ctaTarget = user ? '/lobby' : '/auth'

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="flex flex-col-reverse md:flex-row items-center justify-center gap-12 px-8 py-20 max-w-5xl mx-auto w-full">
        <div className="flex-1 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-700/50 bg-amber-900/20 text-amber-400 text-xs font-semibold mb-5 tracking-wider">
            🎲 FREE TO PLAY · RANKED · GLOBAL
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-amber-100 leading-tight mb-4">
            Backgammon<br />
            <span className="text-amber-500">Reimagined.</span>
          </h1>
          <p className="text-stone-400 text-lg mb-8 max-w-md">
            The world's oldest strategy game — now online. Play ranked matches, challenge an AI, or invite a friend.
          </p>
          <div className="flex gap-4 justify-center md:justify-start">
            <button
              onClick={() => navigate(ctaTarget)}
              className="px-8 py-3 rounded-xl font-bold text-stone-900 text-lg
                bg-gradient-to-b from-amber-300 to-amber-500 border border-amber-600
                shadow-[0_4px_20px_rgba(245,158,11,0.3)]
                hover:from-amber-200 hover:to-amber-400 transition-all active:scale-95"
            >
              Play Now
            </button>
            <Link
              to="/leaderboard"
              className="px-8 py-3 rounded-xl font-bold text-amber-300 text-lg
                border border-amber-700/50 hover:border-amber-500 hover:bg-amber-900/20 transition-all"
            >
              Leaderboard
            </Link>
          </div>
        </div>
        <div className="flex items-center justify-center">
          <MiniBoard />
        </div>
      </section>

      {/* Feature strip */}
      <section className="border-y border-amber-900/20 py-12 px-6" style={{ background: 'rgba(255,200,50,0.02)' }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {FEATURES.map(f => (
            <div key={f.title} className="flex flex-col items-center text-center gap-3 p-5 rounded-xl border border-stone-800/50 hover:border-amber-800/50 transition-colors">
              <span className="text-4xl">{f.icon}</span>
              <h3 className="text-amber-200 font-bold">{f.title}</h3>
              <p className="text-stone-500 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Leaderboard preview */}
      <section className="py-16 px-6 max-w-2xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-amber-200 text-center mb-8">
          🏆 Top Players
        </h2>
        <div className="rounded-2xl border border-stone-800/60 overflow-hidden">
          <div className="grid grid-cols-[2rem_1fr_auto] gap-x-4 px-5 py-3 text-xs text-stone-500 border-b border-stone-800/60 font-mono uppercase tracking-wider">
            <span>#</span><span>Player</span><span>Elo</span>
          </div>
          {topPlayers.length === 0 && (
            <div className="px-5 py-8 text-stone-600 text-center text-sm">No players yet — be the first!</div>
          )}
          {topPlayers.map((p, i) => (
            <Link
              key={p.id}
              to={`/profile/${p.username}`}
              className="grid grid-cols-[2rem_1fr_auto] gap-x-4 px-5 py-3.5 items-center hover:bg-stone-800/20 transition-colors border-b border-stone-900/40 last:border-0"
            >
              <span className="text-stone-500 font-mono text-sm">{i + 1}</span>
              <span className="text-amber-100 font-semibold">
                {p.username}
                {p.win_streak >= 3 && <span className="ml-2 text-xs">🔥</span>}
              </span>
              <span className="text-amber-400 font-mono font-bold">{p.elo}</span>
            </Link>
          ))}
        </div>
        <div className="text-center mt-4">
          <Link to="/leaderboard" className="text-amber-600 hover:text-amber-400 text-sm transition-colors">
            View full leaderboard →
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-6 border-t border-amber-900/20" style={{ background: 'rgba(255,200,50,0.015)' }}>
        <h2 className="text-2xl font-bold text-amber-200 text-center mb-12">How It Works</h2>
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row gap-8">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex-1 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-900/40 border border-amber-700/50 flex items-center justify-center text-amber-400 font-black text-xl">
                {s.n}
              </div>
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute translate-x-full mt-6 text-stone-700 text-2xl select-none">→</div>
              )}
              <h3 className="text-amber-100 font-bold">{s.title}</h3>
              <p className="text-stone-500 text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA bottom */}
      <section className="py-20 px-6 text-center">
        <h2 className="text-3xl font-bold text-amber-100 mb-3">Ready to roll?</h2>
        <p className="text-stone-500 mb-8">Join thousands of players. No download needed.</p>
        <button
          onClick={() => navigate(ctaTarget)}
          className="px-10 py-3.5 rounded-xl font-bold text-stone-900 text-lg
            bg-gradient-to-b from-amber-300 to-amber-500 border border-amber-600
            shadow-[0_4px_20px_rgba(245,158,11,0.25)]
            hover:from-amber-200 hover:to-amber-400 transition-all active:scale-95"
        >
          {user ? 'Go to Lobby' : 'Create Free Account'}
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-900 py-6 px-6 flex justify-between items-center text-stone-700 text-xs">
        <span>© 2025 BackgammonPro</span>
        <span>Short & Long (Narde) · Two player · Fully open source</span>
      </footer>
    </div>
  )
}
