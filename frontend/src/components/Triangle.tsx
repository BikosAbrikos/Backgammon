import type { PointState, Player } from '../store/gameStore'
import Checker from './Checker'

interface TriangleProps {
  index: number
  pointState: PointState
  orientation: 'up' | 'down'
  isHighlighted: boolean
  isSelected: boolean
  onSelect: () => void
  onMove: () => void
  selectedPoint: number | 'bar' | null
  currentPlayer: Player
}

const TRIANGLE_COLORS = ['bg-red-700', 'bg-stone-200']

export default function Triangle({
  index,
  pointState,
  orientation,
  isHighlighted,
  isSelected,
  onSelect,
  onMove,
  selectedPoint,
  currentPlayer,
}: TriangleProps) {
  const colorIndex = index % 2
  const baseColor = TRIANGLE_COLORS[colorIndex]
  const highlightColor = 'bg-green-500'

  const clipUp = 'polygon(0% 0%, 50% 100%, 100% 0%)'
  const clipDown = 'polygon(0% 100%, 50% 0%, 100% 100%)'
  const clip = orientation === 'up' ? clipUp : clipDown

  const isOwnChecker = pointState.player === currentPlayer && pointState.count > 0
  const isClickable = isHighlighted || isOwnChecker || isSelected

  function handleClick() {
    if (isHighlighted && selectedPoint !== null) {
      onMove()
    } else if (isOwnChecker) {
      onSelect()
    }
  }

  const checkers = pointState.count > 0 && pointState.player ? (
    <Checker
      player={pointState.player}
      count={pointState.count}
      isSelected={isSelected}
      onClick={isOwnChecker ? onSelect : undefined}
    />
  ) : null

  const checkerContainer =
    orientation === 'up'
      ? 'absolute bottom-0 left-0 right-0 flex flex-col items-center gap-0.5 pb-1'
      : 'absolute top-0 left-0 right-0 flex flex-col-reverse items-center gap-0.5 pt-1'

  return (
    <div
      className={[
        'relative w-full h-full cursor-pointer',
        isClickable ? 'cursor-pointer' : 'cursor-default',
      ].join(' ')}
      onClick={handleClick}
    >
      {/* Triangle shape */}
      <div
        className={[
          'absolute inset-0 transition-colors duration-150',
          isHighlighted ? highlightColor : baseColor,
          isHighlighted ? 'opacity-80' : 'opacity-90',
        ].join(' ')}
        style={{ clipPath: clip }}
      />

      {/* Highlight pulse overlay */}
      {isHighlighted && (
        <div
          className="absolute inset-0 highlight-pulse opacity-30 rounded"
          style={{ clipPath: clip, backgroundColor: '#4ade80' }}
        />
      )}

      {/* Point number label */}
      <div
        className={[
          'absolute text-xs font-mono text-stone-500 opacity-50',
          orientation === 'up' ? 'top-1 left-1/2 -translate-x-1/2' : 'bottom-1 left-1/2 -translate-x-1/2',
        ].join(' ')}
      >
        {index}
      </div>

      {/* Checkers */}
      <div className={checkerContainer}>
        {checkers}
      </div>
    </div>
  )
}
