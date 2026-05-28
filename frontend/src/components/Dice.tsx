import type { DiceState } from '../store/gameStore'

// Pip grid positions (% of die face, x then y)
const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]],
}

function DieFace({ value, used }: { value: number; used: boolean }) {
  const pips = PIP_LAYOUTS[value] ?? []

  return (
    <div
      style={{
        position: 'relative',
        width: 52,
        height: 52,
        borderRadius: 11,
        flexShrink: 0,
        transition: 'all 0.28s ease',
        // Active die: warm ivory  |  Used die: faded dark
        background: used
          ? 'linear-gradient(145deg, #2a1e14 0%, #1e1408 100%)'
          : 'linear-gradient(145deg, #fdf6e0 0%, #f0d898 45%, #e0bc60 100%)',
        border: used
          ? '1.5px solid rgba(100,70,30,0.35)'
          : '1.5px solid rgba(200,160,60,0.6)',
        boxShadow: used
          ? 'inset 0 1px 3px rgba(0,0,0,0.6)'
          : [
              '0 0 0 1px rgba(0,0,0,0.55)',
              '0 5px 14px rgba(0,0,0,0.55)',
              'inset 0 1px 0 rgba(255,255,240,0.85)',
              'inset 0 -1px 0 rgba(160,100,0,0.4)',
            ].join(', '),
        opacity: used ? 0.38 : 1,
      }}
    >
      {pips.map(([x, y], i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 8,
            height: 8,
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            left: `${x}%`,
            top: `${y}%`,
            background: used
              ? 'rgba(180,130,60,0.4)'
              : 'radial-gradient(circle at 35% 35%, #3a2808, #1a1004)',
            boxShadow: used ? 'none' : 'inset 0 1px 2px rgba(0,0,0,0.5)',
          }}
        />
      ))}
    </div>
  )
}

interface DiceProps {
  dice: DiceState
  onRoll: () => void
  canRoll: boolean
  isRolling: boolean
}

export default function Dice({ dice, onRoll, canRoll, isRolling }: DiceProps) {
  const { values, remaining } = dice
  const hasRolled  = values.length > 0
  const isDouble   = values.length === 2 && values[0] === values[1]
  const usedCount  = hasRolled ? (isDouble ? 4 : 2) - remaining.length : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>

      {/* Rolled dice */}
      {hasRolled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {values.map((v, i) => {
            const used = isDouble ? i < usedCount / 2 : i < usedCount
            return (
              <div key={i} className={isRolling ? 'dice-rolling' : ''}>
                <DieFace value={v} used={used} />
              </div>
            )
          })}
          {isDouble && remaining.length > 0 && (
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#f59e0b',
              fontFamily: 'monospace',
              marginLeft: 2,
            }}>
              ×{remaining.length}
            </div>
          )}
        </div>
      )}

      {/* Roll button */}
      {canRoll && (
        <button
          onClick={onRoll}
          style={{
            padding: '10px 28px',
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: '0.05em',
            fontFamily: 'Georgia, serif',
            cursor: 'pointer',
            transition: 'all 0.14s ease',
            // Matches the warm ivory dice
            background: 'linear-gradient(180deg, #f5e098 0%, #d4a030 55%, #b87c18 100%)',
            border: '1.5px solid rgba(140,90,10,0.8)',
            color: '#3a1e04',
            boxShadow: '0 4px 14px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,252,200,0.75)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(180deg, #fdedb0 0%, #e0b040 55%, #c88c28 100%)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(180deg, #f5e098 0%, #d4a030 55%, #b87c18 100%)'
          }}
        >
          Roll Dice
        </button>
      )}
    </div>
  )
}
