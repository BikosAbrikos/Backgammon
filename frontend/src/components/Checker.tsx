import type { Player } from '../store/gameStore'

interface CheckerProps {
  player: Player
  count: number
  isSelected?: boolean
  onClick?: () => void
  size?: 'sm' | 'md'
}

export default function Checker({ player, count, isSelected, onClick, size = 'md' }: CheckerProps) {
  const isWhite = player === 'white'
  const dim = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-9 h-9 text-sm'

  return (
    <div
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      className={[
        dim,
        'rounded-full flex items-center justify-center font-bold cursor-pointer',
        'border-2 transition-all duration-150 select-none relative',
        isWhite
          ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-[0_2px_6px_rgba(0,0,0,0.5)]'
          : 'bg-stone-800 border-stone-500 text-amber-100 shadow-[0_2px_6px_rgba(0,0,0,0.7)]',
        isSelected
          ? 'ring-2 ring-yellow-300 ring-offset-1 scale-110 checker-selected'
          : 'hover:scale-105',
        onClick ? 'cursor-pointer' : 'cursor-default',
      ].join(' ')}
    >
      {count > 1 && <span>{count}</span>}
      {isSelected && (
        <div className="absolute inset-0 rounded-full bg-yellow-300 opacity-20 pointer-events-none" />
      )}
    </div>
  )
}
