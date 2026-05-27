import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const AVATARS: Record<string, string> = {
  default: '🎲', knight: '♞', crown: '👑', dice: '🎯',
  dragon: '🐉', fox: '🦊', owl: '🦉', rocket: '🚀',
}

export default function NavBar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <nav
      className="sticky top-0 z-50 flex items-center justify-between px-5 py-3 border-b border-amber-900/30"
      style={{ background: 'rgba(10,6,2,0.95)', backdropFilter: 'blur(8px)' }}
    >
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 select-none">
        <span className="text-2xl">🎲</span>
        <span className="text-amber-200 font-bold tracking-wider text-lg">
          Backgammon<span className="text-amber-500">Pro</span>
        </span>
      </Link>

      {/* Nav links */}
      <div className="hidden sm:flex items-center gap-6">
        <NavLink to="/leaderboard">Leaderboard</NavLink>
        {user && <NavLink to="/lobby">Play</NavLink>}
        {user && <NavLink to="/friends">Friends</NavLink>}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <Link
              to={`/profile/${user.username}`}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-800/60 hover:bg-stone-700/60 transition-colors"
            >
              <span>{AVATARS[user.avatar] ?? '🎲'}</span>
              <div className="text-right hidden sm:block">
                <div className="text-amber-200 text-sm font-semibold leading-tight">{user.username}</div>
                <div className="text-amber-500 text-xs leading-tight">{user.elo} Elo</div>
              </div>
            </Link>
            <button
              onClick={handleLogout}
              className="text-stone-500 hover:text-stone-300 text-sm transition-colors"
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            to="/auth"
            className="px-4 py-1.5 rounded-lg font-semibold text-stone-900 text-sm
              bg-gradient-to-b from-amber-300 to-amber-500 border border-amber-600
              hover:from-amber-200 hover:to-amber-400 transition-all"
          >
            Sign In
          </Link>
        )}
      </div>
    </nav>
  )
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="text-stone-400 hover:text-amber-300 text-sm font-medium transition-colors"
    >
      {children}
    </Link>
  )
}
