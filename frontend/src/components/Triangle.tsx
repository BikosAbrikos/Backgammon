import type { PointState, Player } from '../store/gameStore'
import Checker from './Checker'

interface TriangleProps {
  index: number
  pointState: PointState
  orientation: 'up' | 'down'
  isHighlighted: boolean
  isSpyHighlighted?: boolean
  isSelected: boolean
  onSelect: () => void
  onMove: () => void
  selectedPoint: number | 'bar' | null
  currentPlayer: Player
  ghostA?: number
  ghostB?: number
  ghostPlayer?: Player
  locked?: boolean
}

const MAX_STACK = 6
const STEP = 22

// Palette ─────────────────────────────────────────────────────────────────────
// Even index = dark wine/burgundy   |   Odd index = warm cream/tan
const DARK_BASE  = '#a01e2a'
const DARK_MID   = '#7a1220'
const DARK_TIP   = '#4e0a16'
const LIGHT_BASE = '#e2c07a'
const LIGHT_MID  = '#c89040'
const LIGHT_TIP  = '#a06820'

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
  const isDark = index % 2 === 0

  // clip paths ─────────────────────────────────────────────────────────────────
  // 'up'   → base at TOP,    tip at BOTTOM  (bottom row)
  // 'down' → base at BOTTOM, tip at TOP     (top row)
  const clipUp   = 'polygon(0% 0%, 50% 100%, 100% 0%)'
  const clipDown = 'polygon(0% 100%, 50% 0%, 100% 100%)'
  const clip = orientation === 'up' ? clipUp : clipDown

  // gradient direction: bright at base, dark at tip
  const gradDir = orientation === 'up' ? 'to bottom' : 'to top'

  const triangleGrad = isDark
    ? `linear-gradient(${gradDir}, ${DARK_BASE} 0%, ${DARK_MID} 52%, ${DARK_TIP} 100%)`
    : `linear-gradient(${gradDir}, ${LIGHT_BASE} 0%, ${LIGHT_MID} 52%, ${LIGHT_TIP} 100%)`

  // highlight overlay — subtle tint, NOT a full color takeover
  const highlightOverlay = `linear-gradient(${gradDir}, rgba(74,222,128,0.42) 0%, rgba(34,197,94,0.16) 60%, rgba(22,163,74,0.06) 100%)`
  const spyOverlay       = `linear-gradient(${gradDir}, rgba(239,68,68,0.42) 0%, rgba(185,28,28,0.16) 60%, rgba(153,27,27,0.06) 100%)`

  const isOwnChecker = pointState.player === currentPlayer && pointState.count > 0

  function handleClick() {
    if (locked) return
    if ((isHighlighted || isSpyHighlighted) && selectedPoint !== null) {
      onMove()
    } else if (isOwnChecker) {
      onSelect()
    }
  }

  const visible   = Math.min(pointState.count, MAX_STACK)
  const showBadge = pointState.count > MAX_STACK
  const hasGhost  = (ghostA !== undefined && ghostA > 0) || (ghostB !== undefined && ghostB > 0)

  // Tip indicator dot position  (tip is at the pointed end of each triangle)
  // orientation='up'  → tip at BOTTOM
  // orientation='down'→ tip at TOP
  const tipPos: React.CSSProperties = orientation === 'up'
    ? { position: 'absolute', bottom: 4, left: '50%', zIndex: 20, pointerEvents: 'none' }
    : { position: 'absolute', top: 4, left: '50%', zIndex: 20, pointerEvents: 'none' }

  // Point-number label position — at the BASE of the triangle (opposite of tip)
  const labelPos: React.CSSProperties = orientation === 'up'
    ? { position: 'absolute', top: 3, left: '50%', transform: 'translateX(-50%)' }
    : { position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)' }

  return (
    <div
      className={[
        'relative w-full h-full',
        locked
          ? 'cursor-not-allowed'
          : (isHighlighted || isSpyHighlighted || isOwnChecker)
            ? 'cursor-pointer'
            : 'cursor-default',
      ].join(' ')}
      onClick={handleClick}
    >
      {/* ── Base triangle fill ─────────────────────────────────────────── */}
      <div
        className="absolute inset-0"
        style={{ clipPath: clip, background: triangleGrad }}
      />

      {/* Thin inner edge on the triangle — gives depth */}
      <div
        className="absolute inset-0"
        style={{
          clipPath: clip,
          background: isDark
            ? `linear-gradient(${gradDir}, rgba(255,180,150,0.06) 0%, transparent 35%)`
            : `linear-gradient(${gradDir}, rgba(255,255,220,0.12) 0%, transparent 35%)`,
          pointerEvents: 'none',
        }}
      />

      {/* ── Highlight overlays ─────────────────────────────────────────── */}
      {isHighlighted && (
        <div
          className="absolute inset-0"
          style={{ clipPath: clip, background: highlightOverlay, pointerEvents: 'none' }}
        />
      )}
      {isSpyHighlighted && (
        <div
          className="absolute inset-0"
          style={{ clipPath: clip, background: spyOverlay, pointerEvents: 'none' }}
        />
      )}

      {/* ── Tip indicator dot (valid move destination) ────────────────── */}
      {isHighlighted && (
        <div
          className="tip-pulse"
          style={{
            ...tipPos,
            width: 13,
            height: 13,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #a7f3c0, #22c55e)',
            boxShadow: '0 0 8px 3px rgba(74,222,128,0.75)',
          }}
        />
      )}
      {isSpyHighlighted && (
        <div
          className="spy-tip-pulse"
          style={{
            ...tipPos,
            width: 13,
            height: 13,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #fca5a5, #ef4444)',
            boxShadow: '0 0 8px 3px rgba(239,68,68,0.72)',
          }}
        />
      )}

      {/* ── Point number label at triangle base ───────────────────────── */}
      <div
        style={{
          ...labelPos,
          fontSize: 9,
          fontFamily: 'monospace',
          color: isDark ? 'rgba(255,210,190,0.32)' : 'rgba(50,25,5,0.32)',
          userSelect: 'none',
          pointerEvents: 'none',
          lineHeight: 1,
        }}
      >
        {index}
      </div>

      {/* ── Stacked checkers ───────────────────────────────────────────── */}
      {pointState.count > 0 && pointState.player && (
        <>
          {Array.from({ length: visible }).map((_, i) => {
            const isTopmost  = i === visible - 1
            const offset     = i * STEP
            const posStyle: React.CSSProperties = orientation === 'up'
              ? { bottom: 5 + offset, zIndex: i }
              : { top: 5 + offset, zIndex: i }

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

      {/* ── Quantum ghost checkers ─────────────────────────────────────── */}
      {hasGhost && ghostPlayer && (() => {
        const isWhiteGhost = ghostPlayer === 'white'
        const certainShown = Math.min(pointState.count, MAX_STACK)
        const maxLevels    = Math.max(ghostA ?? 0, ghostB ?? 0)
        const levels       = Math.min(maxLevels, MAX_STACK - certainShown)
        if (levels <= 0) return null

        return (
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 15 }}>
            {Array.from({ length: levels }).map((_, lvl) => {
              const offset   = (certainShown + lvl) * STEP
              const posStyle: React.CSSProperties = orientation === 'up'
                ? { bottom: 5 + offset }
                : { top: 5 + offset }
              const showA = (ghostA ?? 0) > lvl
              const showB = (ghostB ?? 0) > lvl

              return (
                <div
                  key={lvl}
                  className="absolute left-0 right-0 flex justify-center gap-1"
                  style={{ ...posStyle, zIndex: certainShown + lvl }}
                >
                  {showA && (
                    <div style={{
                      width: 30, height: 30,
                      borderRadius: '50%',
                      border: '2px solid #22d3ee',
                      background: isWhiteGhost
                        ? 'radial-gradient(circle at 36% 28%, #fffff8, #f3e8c0, #c8a030)'
                        : 'radial-gradient(circle at 36% 28%, #5c3a22, #1e0e06)',
                      opacity: 0.5,
                      boxShadow: '0 0 10px 3px rgba(34,211,238,0.65)',
                      flexShrink: 0,
                    }} />
                  )}
                  {showB && (
                    <div style={{
                      width: 30, height: 30,
                      borderRadius: '50%',
                      border: '2px solid #fb923c',
                      background: isWhiteGhost
                        ? 'radial-gradient(circle at 36% 28%, #fffff8, #f3e8c0, #c8a030)'
                        : 'radial-gradient(circle at 36% 28%, #5c3a22, #1e0e06)',
                      opacity: 0.5,
                      boxShadow: '0 0 10px 3px rgba(251,146,60,0.65)',
                      flexShrink: 0,
                    }} />
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
