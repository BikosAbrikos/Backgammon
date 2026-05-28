import type { GameState } from '../store/gameStore'

const MODE_LABEL: Record<string, string> = {
  short: 'Short', long: 'Long', quantum: 'Quantum', spy: 'Spy',
}
const MODE_ICON: Record<string, string> = {
  short: '🎲', long: '♟', quantum: '⚛️', spy: '🕵️',
}

interface TopBarProps {
  gameState: GameState
  onRestart: () => void
}

export default function TopBar({ gameState, onRestart }: TopBarProps) {
  const { mode } = gameState

  return (
    <div className="flex items-center justify-between px-5 py-2.5 bg-stone-950/95 border-b border-stone-800/60 backdrop-blur-sm sticky top-0 z-20">
      {/* Left: brand + mode */}
      <div className="flex items-center gap-2.5">
        <span className="text-amber-200 font-bold tracking-wide text-sm">Backgammon</span>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-stone-900 border border-stone-800/60">
          <span className="text-sm leading-none">{MODE_ICON[mode] ?? '🎲'}</span>
          <span className="text-stone-400 text-xs font-semibold">{MODE_LABEL[mode] ?? mode}</span>
        </div>
      </div>

      {/* Right: lobby button */}
      <button
        onClick={onRestart}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-900
          bg-gradient-to-b from-amber-300 to-amber-500 border border-amber-600
          hover:from-amber-200 hover:to-amber-400 active:scale-95 transition-all"
      >
        ← Lobby
      </button>
    </div>
  )
}
