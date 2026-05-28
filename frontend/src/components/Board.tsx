import { useMemo } from 'react'
import type { GameState, Player, QuantumBranchPositions } from '../store/gameStore'
import Triangle from './Triangle'
import Checker from './Checker'

interface BoardProps {
  gameState: GameState
  selectedPoint: number | 'bar' | null
  onSelectPoint: (p: number | 'bar') => void
  onMoveToPoint: (p: number | 'off') => void
  ghostBranches?: {
    branchA: QuantumBranchPositions
    branchB: QuantumBranchPositions
    quantumPlayer: Player
  }
}

// Visual layout:
// Top row (orientation=down), left-to-right: 12..17 | 18..23
// Bottom row (orientation=up), left-to-right: 11..6 | 5..0
const TOP_ROW = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
const BOTTOM_ROW = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]

function BarZone({
  gameState,
  selectedPoint,
  onSelectBar,
}: {
  gameState: GameState
  selectedPoint: number | 'bar' | null
  onSelectBar: () => void
}) {
  const { bar, current_player } = gameState
  const whiteBar = bar.white
  const blackBar = bar.black

  return (
    <div className="flex flex-col justify-center items-center gap-2 w-12 bg-amber-800 rounded">
      {/* Black's bar checkers (top) */}
      <div
        className={['flex flex-col items-center gap-0.5', current_player === 'black' && blackBar > 0 ? 'cursor-pointer' : ''].join(' ')}
        onClick={current_player === 'black' && blackBar > 0 ? onSelectBar : undefined}
      >
        {Array.from({ length: blackBar }).map((_, i) => (
          <Checker key={i} player="black" size="sm"
            isSelected={i === blackBar - 1 && selectedPoint === 'bar' && current_player === 'black'}
          />
        ))}
      </div>

      <div className="h-4" />

      {/* White's bar checkers (bottom) */}
      <div
        className={['flex flex-col-reverse items-center gap-0.5', current_player === 'white' && whiteBar > 0 ? 'cursor-pointer' : ''].join(' ')}
        onClick={current_player === 'white' && whiteBar > 0 ? onSelectBar : undefined}
      >
        {Array.from({ length: whiteBar }).map((_, i) => (
          <Checker key={i} player="white" size="sm"
            isSelected={i === whiteBar - 1 && selectedPoint === 'bar' && current_player === 'white'}
          />
        ))}
      </div>
    </div>
  )
}

function BearOffZone({
  player,
  count,
  isValidDest,
  onMove,
}: {
  player: Player
  count: number
  isValidDest: boolean
  onMove: () => void
}) {
  return (
    <div
      className={[
        'flex flex-col items-center justify-end gap-0.5 p-2 rounded-lg h-full',
        'border-2 transition-all duration-150 min-w-[3rem]',
        isValidDest
          ? 'border-green-400 bg-green-900/30 cursor-pointer highlight-pulse'
          : 'border-stone-600 bg-stone-800/40',
      ].join(' ')}
      onClick={isValidDest ? onMove : undefined}
    >
      <div className="text-xs text-stone-400 mb-1">{player === 'white' ? '⬜' : '⬛'} Off</div>
      <div className="flex flex-col gap-0.5">
        {Array.from({ length: Math.min(count, 8) }).map((_, i) => (
          <div
            key={i}
            className={[
              'w-6 h-2 rounded-full border',
              player === 'white'
                ? 'bg-amber-100 border-amber-400'
                : 'bg-stone-700 border-stone-500',
            ].join(' ')}
          />
        ))}
        {count > 8 && <div className="text-xs text-stone-300 text-center">{count}</div>}
      </div>
    </div>
  )
}

export default function Board({ gameState, selectedPoint, onSelectPoint, onMoveToPoint, ghostBranches }: BoardProps) {
  const { board, current_player, valid_moves } = gameState

  const validDests = useMemo<Set<number | 'off'>>(() => {
    if (selectedPoint === null) return new Set()
    return new Set(
      valid_moves
        .filter(m => String(m.from_pos) === String(selectedPoint))
        .map(m => m.to_pos)
    )
  }, [selectedPoint, valid_moves])

  const canBearOffWhite = validDests.has('off') && current_player === 'white'
  const canBearOffBlack = validDests.has('off') && current_player === 'black'

  function getGhostCounts(i: number) {
    if (!ghostBranches) return { ghostA: undefined, ghostB: undefined }
    const qp = ghostBranches.quantumPlayer
    const ptA = ghostBranches.branchA.board[i]
    const ptB = ghostBranches.branchB.board[i]
    return {
      ghostA: ptA.player === qp && ptA.count > 0 ? ptA.count : undefined,
      ghostB: ptB.player === qp && ptB.count > 0 ? ptB.count : undefined,
    }
  }

  function renderRow(indices: number[], orientation: 'up' | 'down') {
    const left = indices.slice(0, 6)
    const right = indices.slice(6, 12)

    return (
      <div className="flex flex-1 h-full">
        {left.map(i => {
          const { ghostA, ghostB } = getGhostCounts(i)
          return (
            <Triangle
              key={i}
              index={i}
              pointState={board[i]}
              orientation={orientation}
              isHighlighted={validDests.has(i)}
              isSelected={selectedPoint === i}
              onSelect={() => onSelectPoint(i)}
              onMove={() => onMoveToPoint(i)}
              selectedPoint={selectedPoint}
              currentPlayer={current_player}
              ghostA={ghostA}
              ghostB={ghostB}
            />
          )
        })}
        {/* Bar placeholder */}
        <div className="w-12" />
        {right.map(i => {
          const { ghostA, ghostB } = getGhostCounts(i)
          return (
            <Triangle
              key={i}
              index={i}
              pointState={board[i]}
              orientation={orientation}
              isHighlighted={validDests.has(i)}
              isSelected={selectedPoint === i}
              onSelect={() => onSelectPoint(i)}
              onMove={() => onMoveToPoint(i)}
              selectedPoint={selectedPoint}
              currentPlayer={current_player}
              ghostA={ghostA}
              ghostB={ghostB}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex gap-3 items-stretch w-full" style={{ minWidth: '620px' }}>
      {/* Bear off zone for BLACK (left side) */}
      <BearOffZone
        player="black"
        count={gameState.off.black}
        isValidDest={canBearOffBlack}
        onMove={() => onMoveToPoint('off')}
      />

      {/* Main board */}
      <div
        className="flex-1 rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #7c4f2a 0%, #5c3310 100%)',
          padding: '8px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,200,100,0.2)',
        }}
      >
        <div
          className="h-full flex flex-col rounded-xl overflow-hidden"
          style={{ background: '#2d1b0e', minHeight: '480px' }}
        >
          {/* Top row (points 12-23) */}
          <div className="relative flex h-[46%]" style={{ minHeight: '220px' }}>
            {renderRow(TOP_ROW, 'down')}
            <div className="absolute left-1/2 -translate-x-1/2 h-full" style={{ width: '48px' }}>
              <BarZone
                gameState={gameState}
                selectedPoint={selectedPoint}
                onSelectBar={() => onSelectPoint('bar')}
              />
            </div>
          </div>

          {/* Center divider */}
          <div className="flex items-center justify-center h-[8%] bg-stone-900/50">
            <div className="h-px flex-1 bg-amber-900/50" />
            <div className="px-4 text-amber-700/60 text-xs font-mono tracking-widest">
              {ghostBranches ? '⚛ QUANTUM ⚛' : '◆ BACKGAMMON ◆'}
            </div>
            <div className="h-px flex-1 bg-amber-900/50" />
          </div>

          {/* Bottom row (points 11-0) */}
          <div className="relative flex h-[46%]" style={{ minHeight: '220px' }}>
            {renderRow(BOTTOM_ROW, 'up')}
            <div className="absolute left-1/2 -translate-x-1/2 h-full" style={{ width: '48px' }}>
              <BarZone
                gameState={gameState}
                selectedPoint={selectedPoint}
                onSelectBar={() => onSelectPoint('bar')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bear off zone for WHITE */}
      <BearOffZone
        player="white"
        count={gameState.off.white}
        isValidDest={canBearOffWhite}
        onMove={() => onMoveToPoint('off')}
      />
    </div>
  )
}
