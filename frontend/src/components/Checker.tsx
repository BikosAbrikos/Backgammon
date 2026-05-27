import type { Player } from '../store/gameStore'

interface CheckerProps {
  player: Player
  isSelected?: boolean
  badge?: number
  size?: 'sm' | 'md'
}

export default function Checker({ player, isSelected, badge, size = 'md' }: CheckerProps) {
  const isWhite = player === 'white'
  const dim = size === 'sm' ? 'w-6 h-6' : 'w-8 h-8'

  return (
    <div
      className={[
        dim,
        'rounded-full flex items-center justify-center select-none relative flex-shrink-0',
        'border-2 transition-transform duration-100',
        isWhite
          ? 'bg-amber-50 border-amber-300 shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.8)]'
          : 'bg-stone-900 border-stone-600 shadow-[0_2px_4px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.08)]',
        isSelected ? 'ring-2 ring-yellow-300 ring-offset-1 scale-110' : '',
      ].join(' ')}
    >
      {badge !== undefined && (
        <span className={[
          'text-xs font-bold leading-none',
          isWhite ? 'text-amber-800' : 'text-amber-200',
        ].join(' ')}>
          {badge}
        </span>
      )}
    </div>
  )
}
