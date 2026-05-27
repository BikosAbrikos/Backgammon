import type { DiceState } from '../store/gameStore'

const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 20], [75, 20], [25, 50], [75, 50], [25, 80], [75, 80]],
}

function DieFace({ value, used }: { value: number; used: boolean }) {
  const pips = PIP_LAYOUTS[value] || []
  return (
    <div
      className={[
        'relative w-14 h-14 rounded-xl border-2 transition-all duration-300',
        used
          ? 'bg-stone-600 border-stone-500 opacity-40'
          : 'bg-amber-50 border-amber-300 shadow-[0_4px_12px_rgba(0,0,0,0.5)]',
      ].join(' ')}
    >
      {pips.map(([x, y], i) => (
        <div
          key={i}
          className={[
            'absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2',
            used ? 'bg-stone-400' : 'bg-stone-800',
          ].join(' ')}
          style={{ left: `${x}%`, top: `${y}%` }}
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
  const hasRolled = values.length > 0

  const isDouble = values.length === 2 && values[0] === values[1]
  const usedCount = hasRolled
    ? (isDouble ? 4 : 2) - remaining.length
    : 0

  return (
    <div className="flex flex-col items-center gap-3">
      {hasRolled && (
        <div className="flex gap-3 items-center">
          {values.map((v, i) => {
            const used = isDouble ? i * 2 < usedCount * 2 && usedCount > i : i < usedCount
            return (
              <div key={i} className={isRolling ? 'dice-rolling' : ''}>
                <DieFace value={v} used={used} />
              </div>
            )
          })}
          {isDouble && remaining.length > 0 && (
            <div className="text-amber-300 text-sm font-bold ml-1">
              ×{remaining.length}
            </div>
          )}
        </div>
      )}

      {canRoll && (
        <button
          onClick={onRoll}
          className="px-6 py-2.5 rounded-xl font-bold text-stone-900 tracking-wide
            bg-gradient-to-b from-amber-300 to-amber-500
            border border-amber-600
            shadow-[0_4px_12px_rgba(0,0,0,0.4)]
            hover:from-amber-200 hover:to-amber-400
            active:scale-95 transition-all duration-150"
        >
          Roll Dice
        </button>
      )}
    </div>
  )
}
