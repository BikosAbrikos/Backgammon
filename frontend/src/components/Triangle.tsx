import type { PointState, Player } from '../store/gameStore'
import Checker from './Checker'

interface TriangleProps {
  index: number
  pointState: PointState
  orientation: 'up' | 'down'
  isHighlighted: boolean
  isSpyHighlighted?: boolean  // Spy mode: illegal destination (red)
  isSelected: boolean
  onSelect: () => void
  onMove: () => void
  selectedPoint: number | 'bar' | null
  currentPlayer: Player
  ghostA?: number   // Ghost checker count for quantum Branch A
  ghostB?: number   // Ghost checker count for quantum Branch B
  ghostPlayer?: Player  // Which player's pieces are ghosts
  locked?: boolean  // Board locked during challenge window
}

const TRIANGLE_COLORS = ['bg-red-700', 'bg-stone-200']
const MAX_STACK = 6
const STEP = 22

export default function Triangle({
  index,
  pointState,
  orientation,
  isHighlighted,
  isSpyHighlighted,
  isSelected,
  onSelect,
  onMove,
  selectedPoint,
  currentPlayer,
  ghostA,
  ghostB,
  ghostPlayer,
  locked,
}: TriangleProps) {
  const colorIndex = index % 2
  const baseColor = TRIANGLE_COLORS[colorIndex]

  const clipUp = 'polygon(0% 0%, 50% 100%, 100% 0%)'
  const clipDown = 'polygon(0% 100%, 50% 0%, 100% 100%)'
  const clip = orientation === 'up' ? clipUp : clipDown

  const isOwnChecker = pointState.player === currentPlayer && pointState.count > 0

  function handleClick() {
    if (locked) return
    if ((isHighlighted || isSpyHighlighted) && selectedPoint !== null) {
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
        locked ? 'cursor-not-allowed' : (isHighlighted || isSpyHighlighted || isOwnChecker ? 'cursor-pointer' : 'cursor-default'),
      ].join(' ')}
      onClick={handleClick}
    >
      {/* Triangle fill */}
      <div
        className={[
          'absolute inset-0 transition-colors duration-150',
          isHighlighted ? 'bg-green-500 opacity-80'
            : isSpyHighlighted ? 'bg-red-600 opacity-70'
            : `${baseColor} opacity-90`,
        ].join(' ')}
        style={{ clipPath: clip }}
      />

      {/* Highlight pulse — green for legal, red for spy */}
      {isHighlighted && (
        <div
          className="absolute inset-0 highlight-pulse opacity-30"
          style={{ clipPath: clip, backgroundColor: '#4ade80' }}
        />
      )}
      {isSpyHighlighted && (
        <div
          className="absolute inset-0 highlight-pulse opacity-20"
          style={{ clipPath: clip, backgroundColor: '#dc2626' }}
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

      {/* Quantum ghost checkers — stacked above certain pieces, per-branch tints */}
      {hasGhost && ghostPlayer && (() => {
        const isWhiteGhost = ghostPlayer === 'white'
        // Start stacking ghosts above whatever certain checkers are already rendered
        const certainShown = Math.min(pointState.count, MAX_STACK)
        const maxLevels = Math.max(ghostA ?? 0, ghostB ?? 0)
        const levels = Math.min(maxLevels, MAX_STACK - certainShown)
        if (levels <= 0) return null
        return (
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 15 }}>
            {Array.from({ length: levels }).map((_, lvl) => {
              const offset = (certainShown + lvl) * STEP
              const posStyle: React.CSSProperties = orientation === 'up'
                ? { bottom: `${6 + offset}px` }
                : { top: `${6 + offset}px` }
              const showA = (ghostA ?? 0) > lvl
              const showB = (ghostB ?? 0) > lvl
              return (
                // Full-width row centered — side-by-side when both branches present
                <div
                  key={lvl}
                  className="absolute left-0 right-0 flex justify-center gap-1"
                  style={{ ...posStyle, zIndex: certainShown + lvl }}
                >
                  {showA && (
                    <div
                      className={[
                        'w-8 h-8 rounded-full border-2 flex-shrink-0',
                        isWhiteGhost ? 'bg-amber-100 border-cyan-400' : 'bg-stone-800 border-cyan-400',
                      ].join(' ')}
                      style={{ opacity: 0.5, boxShadow: '0 0 10px 3px rgba(34,211,238,0.65)' }}
                    />
                  )}
                  {showB && (
                    <div
                      className={[
                        'w-8 h-8 rounded-full border-2 flex-shrink-0',
                        isWhiteGhost ? 'bg-amber-100 border-orange-400' : 'bg-stone-800 border-orange-400',
                      ].join(' ')}
                      style={{ opacity: 0.5, boxShadow: '0 0 10px 3px rgba(251,146,60,0.65)' }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}
    </div>
  )
}
