import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function AuthPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuthStore()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (tab === 'login') {
        await login(email, password)
      } else {
        await register(username, email, password)
      }
      navigate('/lobby')
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="text-3xl font-black text-amber-200">
            🎲 BackgammonPro
          </Link>
          <p className="text-stone-500 text-sm mt-2">Your ranked game awaits</p>
        </div>

        <div className="rounded-2xl border border-stone-800/60 overflow-hidden"
          style={{ background: 'linear-gradient(135deg,#140a03,#1e0e05)' }}>
          {/* Tab bar */}
          <div className="flex border-b border-stone-800/60">
            {(['login', 'register'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError('') }}
                className={[
                  'flex-1 py-3.5 text-sm font-semibold transition-colors',
                  tab === t
                    ? 'text-amber-300 border-b-2 border-amber-500 bg-amber-900/10'
                    : 'text-stone-500 hover:text-stone-300',
                ].join(' ')}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
            {tab === 'register' && (
              <Field label="Username" type="text" value={username}
                onChange={setUsername} placeholder="your_handle" required minLength={3} maxLength={32} />
            )}
            <Field label="Email" type="email" value={email}
              onChange={setEmail} placeholder="you@example.com" required />
            <Field label="Password" type="password" value={password}
              onChange={setPassword} placeholder="••••••••" required minLength={6} />

            {error && (
              <div className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 py-3 rounded-xl font-bold text-stone-900
                bg-gradient-to-b from-amber-300 to-amber-500 border border-amber-600
                hover:from-amber-200 hover:to-amber-400 disabled:opacity-50
                active:scale-95 transition-all"
            >
              {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-stone-600 text-xs mt-6">
          By continuing you agree to fair play. No bots, no cheating.
        </p>
      </div>
    </div>
  )
}

function Field({
  label, type, value, onChange, placeholder, required, minLength, maxLength,
}: {
  label: string; type: string; value: string; onChange: (v: string) => void
  placeholder?: string; required?: boolean; minLength?: number; maxLength?: number
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-stone-400 text-xs font-semibold uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        className="w-full px-3 py-2.5 rounded-lg bg-stone-900/60 border border-stone-700
          text-stone-100 placeholder-stone-600 text-sm
          focus:outline-none focus:border-amber-600 transition-colors"
      />
    </div>
  )
}
