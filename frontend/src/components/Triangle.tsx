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
  ghostA?: number  // Ghost checker count for quantum Branch A
  ghostB?: number  // Ghost checker count for quantum Branch B
}

const TRIANGLE_COLORS = ['bg-red-700', 'bg-stone-200']
const MAX_STACK = 6
const STEP = 22

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
  ghostA,
  ghostB,
}: TriangleProps) {
  const colorIndex = index % 2
  const baseColor = TRIANGLE_COLORS[colorIndex]

  const clipUp = 'polygon(0% 0%, 50% 100%, 100% 0%)'
  const clipDown = 'polygon(0% 100%, 50% 0%, 100% 100%)'
  const clip = orientation === 'up' ? clipUp : clipDown

  const isOwnChecker = pointState.player === currentPlayer && pointState.count > 0

  function handleClick() {
    if (isHighlighted && selectedPoint !== null) {
      onMove()
    } else if (isOwnChecker) {
      onSelect()
    }
  }

  const visible = Math.min(pointState.count, MAX_STACK)
  const showBadge = pointState.count > MAX_STACK

  const hasGhost = (ghostA !== undefined && ghostA > 0) || (ghostB !== undefined && ghostB > 0)

  return (
    <div
      className={[
        'relative w-full h-full',
        isHighlighted || isOwnChecker ? 'cursor-pointer' : 'cursor-default',
      ].join(' ')}
      onClick={handleClick}
    >
      {/* Triangle fill */}
      <div
        className={[
          'absolute inset-0 transition-colors duration-150',
          isHighlighted ? 'bg-green-500 opacity-80' : `${baseColor} opacity-90`,
        ].join(' ')}
        style={{ clipPath: clip }}
      />

      {/* Highlight pulse */}
      {isHighlighted && (
        <div
          className="absolute inset-0 highlight-pulse opacity-30"
          style={{ clipPath: clip, backgroundColor: '#4ade80' }}
        />
      )}

      {/* Point label */}
      <div
        className={[
          'absolute text-[10px] font-mono text-stone-500 opacity-40',
          orientation === 'up'
            ? 'top-1 left-1/2 -translate-x-1/2'
            : 'bottom-1 left-1/2 -translate-x-1/2',
        ].join(' ')}
      >
        {index}
      </div>

      {/* Stacked checkers */}
      {pointState.count > 0 && pointState.player && (
        <>
          {Array.from({ length: visible }).map((_, i) => {
            const isTopmost = i === visible - 1
            const offset = i * STEP
            const posStyle: React.CSSProperties =
              orientation === 'up'
                ? { bottom: `${6 + offset}px`, zIndex: i }
                : { top: `${6 + offset}px`, zIndex: i }

            return (
              <div
                key={i}
                className="absolute left-1/2 -translate-x-1/2"
                style={posStyle}
              >
                <Checker
                  player={pointState.player!}
                  isSelected={isTopmost && isSelected}
                  badge={isTopmost && showBadge ? pointState.count : undefined}
                />
              </div>
            )
          })}
        </>
      )}

      {/* Quantum ghost badges */}
      {hasGhost && (
        <div
          className={[
            'absolute left-1/2 -translate-x-1/2 flex gap-0.5 pointer-events-none',
            orientation === 'up' ? 'top-1' : 'bottom-1',
          ].join(' ')}
          style={{ zIndex: 20 }}
        >
          {ghostA !== undefined && ghostA > 0 && (
            <div className="w-5 h-5 rounded-full bg-cyan-500/70 border border-cyan-300 flex items-center justify-center text-[9px] font-bold text-white shadow-lg">
              {ghostA}
            </div>
          )}
          {ghostB !== undefined && ghostB > 0 && (
            <div className="w-5 h-5 rounded-full bg-orange-500/70 border border-orange-300 flex items-center justify-center text-[9px] font-bold text-white shadow-lg">
              {ghostB}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
