import type { GameState } from '../store/gameStore'

interface TopBarProps {
  gameState: GameState
  onRestart: () => void
}

export default function TopBar({ gameState, onRestart }: TopBarProps) {
  const { mode, off } = gameState

  return (
    <div className="flex items-center justify-between px-5 py-2.5 bg-stone-950 border-b border-stone-800/70">
      <div className="flex items-center gap-2">
        <span className="text-amber-200 font-bold tracking-wide">🎲 Backgammon</span>
        <span className="text-stone-600">·</span>
        <span className="text-stone-500 text-sm capitalize">{mode}</span>
      </div>

      <div className="flex items-center gap-3 text-xs text-stone-500">
        <span>⬜ {off.white}/15</span>
        <span>⬛ {off.black}/15</span>
      </div>

      <button
        onClick={onRestart}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-900
          bg-gradient-to-b from-amber-300 to-amber-500 border border-amber-600
          hover:from-amber-200 hover:to-amber-400 transition-all"
      >
        ← Lobby
      </button>
    </div>
  )
}
