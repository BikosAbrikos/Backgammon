import type { GameMode, GameState, Player } from '../store/gameStore'

interface TopBarProps {
  gameState: GameState
  onRestart: () => void
  onSwitchMode: (mode: GameMode) => void
}

const PLAYER_LABEL: Record<Player, string> = {
  white: 'White',
  black: 'Black',
}

export default function TopBar({ gameState, onRestart, onSwitchMode }: TopBarProps) {
  const { current_player, mode, phase, off } = gameState
  const isGameOver = phase === 'game_over'

  return (
    <div className="flex items-center justify-between px-6 py-3 bg-stone-900 border-b border-stone-700">
      <div className="flex items-center gap-3">
        <span className="text-amber-200 font-bold text-lg tracking-wide">Backgammon</span>
        <span className="text-stone-500 text-sm">|</span>
        <span className="text-stone-400 text-sm capitalize">{mode}</span>
      </div>

      <div className="flex items-center gap-4">
        {!isGameOver && (
          <div className="flex items-center gap-2">
            <div
              className={[
                'w-4 h-4 rounded-full border-2',
                current_player === 'white'
                  ? 'bg-amber-50 border-amber-400'
                  : 'bg-stone-800 border-stone-400',
              ].join(' ')}
            />
            <span className="text-amber-100 text-sm font-semibold">
              {PLAYER_LABEL[current_player]}'s turn
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-stone-400">
          <span>⬜ {off.white}/15</span>
          <span>⬛ {off.black}/15</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onSwitchMode(mode === 'short' ? 'long' : 'short')}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-300
            bg-stone-700 border border-stone-600
            hover:bg-stone-600 transition-colors"
        >
          Switch to {mode === 'short' ? 'Long' : 'Short'}
        </button>
        <button
          onClick={onRestart}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-900
            bg-gradient-to-b from-amber-300 to-amber-500
            border border-amber-600
            hover:from-amber-200 hover:to-amber-400 transition-all"
        >
          Restart
        </button>
      </div>
    </div>
  )
}
