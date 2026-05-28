import type { Player } from '../store/gameStore'

interface CheckerProps {
  player: Player
  isSelected?: boolean
  badge?: number
  size?: 'sm' | 'md'
}

export default function Checker({ player, isSelected, badge, size = 'md' }: CheckerProps) {
  const isWhite = player === 'white'
  const isSmall = size === 'sm'
  const d = isSmall ? 22 : 34

  // Outer body — radial gradient for 3-D depth
  const body: React.CSSProperties = isWhite
    ? {
        background: 'radial-gradient(circle at 36% 28%, #fffff8 0%, #f3e8c0 38%, #d4a83a 72%, #a87818 100%)',
        boxShadow: isSelected
          ? '0 0 0 2px #0a0604, 0 0 0 4.5px #ffe44a, 0 0 18px 6px rgba(255,220,0,0.45), 0 3px 10px rgba(0,0,0,0.65)'
          : '0 0 0 1.5px rgba(0,0,0,0.5), inset 0 -2px 5px rgba(100,58,0,0.32), 0 3px 9px rgba(0,0,0,0.55)',
      }
    : {
        background: 'radial-gradient(circle at 36% 28%, #5c3a22 0%, #1e0e06 48%, #0c0502 100%)',
        boxShadow: isSelected
          ? '0 0 0 2px #0a0604, 0 0 0 4.5px #ffe44a, 0 0 18px 6px rgba(255,220,0,0.45), 0 3px 10px rgba(0,0,0,0.8)'
          : '0 0 0 1.5px rgba(90,50,14,0.85), inset 0 1px 4px rgba(150,90,35,0.18), 0 3px 9px rgba(0,0,0,0.75)',
      }

  // Concentric inner ring — mimics a real checker's engraved ring
  const ringInset = isSmall ? 3 : 5
  const innerRing: React.CSSProperties = {
    position: 'absolute',
    inset: ringInset,
    borderRadius: '50%',
    border: isWhite
      ? '1px solid rgba(255,252,230,0.6)'
      : '1px solid rgba(160,88,30,0.28)',
    pointerEvents: 'none',
  }

  return (
    <div
      className={isSelected ? (isWhite ? 'checker-selected-white' : 'checker-selected-black') : ''}
      style={{
        width: d,
        height: d,
        borderRadius: '50%',
        flexShrink: 0,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        transition: 'transform 0.1s ease',
        transform: isSelected ? 'scale(1.14)' : 'scale(1)',
        ...body,
      }}
    >
      <div style={innerRing} />
      {badge !== undefined && (
        <span style={{
          fontSize: 10,
          fontWeight: 800,
          lineHeight: 1,
          position: 'relative',
          zIndex: 1,
          color: isWhite ? '#7a4400' : '#f0c060',
        }}>
          {badge}
        </span>
      )}
    </div>
  )
}
