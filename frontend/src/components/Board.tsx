import { useMemo } from 'react'
import type { GameState, Player, PointState, QuantumBranchPositions, SpyCtx } from '../store/gameStore'
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
  spyCtx?: SpyCtx | null
  flipped?: boolean
}

// Standard layout (white's perspective):
//   Top row  (orientation=down): points 12..23 left-to-right
//   Bottom row (orientation=up): points 11..0  left-to-right
// Flipped layout (black's perspective, 180° rotation):
//   Top row  (orientation=down): points 0..11  left-to-right
//   Bottom row (orientation=up): points 23..12 left-to-right
const TOP_ROW_NORMAL    = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
const BOTTOM_ROW_NORMAL = [11, 10,  9,  8,  7,  6,  5,  4,  3,  2,  1,  0]
const TOP_ROW_FLIPPED    = [ 0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11]
const BOTTOM_ROW_FLIPPED = [23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12]

// ── Bar Zone ──────────────────────────────────────────────────────────────────

function BarZone({
  gameState, selectedPoint, onSelectBar, flipped = false,
}: {
  gameState: GameState
  selectedPoint: number | 'bar' | null
  onSelectBar: () => void
  flipped?: boolean
}) {
  const { bar, current_player } = gameState
  // When flipped: white's checkers appear at top, black's at bottom (board rotated 180°)
  const topPlayer:    'white' | 'black' = flipped ? 'white' : 'black'
  const bottomPlayer: 'white' | 'black' = flipped ? 'black' : 'white'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: 48,
        position: 'relative',
        background: 'linear-gradient(90deg, #1c0a04 0%, #2e1208 20%, #240e06 50%, #2e1208 80%, #1c0a04 100%)',
        boxShadow: 'inset 3px 0 6px rgba(0,0,0,0.6), inset -3px 0 6px rgba(0,0,0,0.6)',
      }}
    >
      <div style={{
        position: 'absolute',
        top: 0, bottom: 0,
        left: '50%', width: 1,
        transform: 'translateX(-50%)',
        background: 'linear-gradient(180deg, transparent 0%, rgba(200,140,40,0.25) 20%, rgba(200,140,40,0.25) 80%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Top-half bar checkers */}
      <div
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: current_player === topPlayer && bar[topPlayer] > 0 ? 'pointer' : 'default' }}
        onClick={current_player === topPlayer && bar[topPlayer] > 0 ? onSelectBar : undefined}
      >
        {Array.from({ length: bar[topPlayer] }).map((_, i) => (
          <Checker
            key={i}
            player={topPlayer}
            size="sm"
            isSelected={i === bar[topPlayer] - 1 && selectedPoint === 'bar' && current_player === topPlayer}
          />
        ))}
      </div>

      <div style={{ height: 8 }} />

      {/* Bottom-half bar checkers */}
      <div
        style={{ display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: 3, cursor: current_player === bottomPlayer && bar[bottomPlayer] > 0 ? 'pointer' : 'default' }}
        onClick={current_player === bottomPlayer && bar[bottomPlayer] > 0 ? onSelectBar : undefined}
      >
        {Array.from({ length: bar[bottomPlayer] }).map((_, i) => (
          <Checker
            key={i}
            player={bottomPlayer}
            size="sm"
            isSelected={i === bar[bottomPlayer] - 1 && selectedPoint === 'bar' && current_player === bottomPlayer}
          />
        ))}
      </div>
    </div>
  )
}

// ── Bear-Off Tray ─────────────────────────────────────────────────────────────

function BearOffZone({
  player, count, isValidDest, onMove,
}: {
  player: Player
  count: number
  isValidDest: boolean
  onMove: () => void
}) {
  const isWhite = player === 'white'
  const pipsToShow = Math.min(count, 10)

  return (
    <div
      className={isValidDest ? 'tray-glow' : ''}
      onClick={isValidDest ? onMove : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 6,
        minWidth: 52,
        padding: '10px 7px 12px',
        borderRadius: 12,
        cursor: isValidDest ? 'pointer' : 'default',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        // Inset tray look
        background: isValidDest
          ? 'linear-gradient(180deg, #0c2e18, #0f3a20)'
          : 'linear-gradient(180deg, #0a1e10, #0c2814)',
        border: isValidDest
          ? '1.5px solid rgba(74,222,128,0.55)'
          : '1px solid rgba(200,150,50,0.14)',
        boxShadow: isValidDest
          ? '0 0 0 0'  // overridden by tray-glow CSS animation
          : 'inset 0 2px 10px rgba(0,0,0,0.45), inset 0 0 3px rgba(0,0,0,0.3)',
      }}
    >
      {/* Player icon + count */}
      <div style={{ textAlign: 'center', lineHeight: 1 }}>
        <div style={{ fontSize: 11, marginBottom: 3 }}>{isWhite ? '⬜' : '⬛'}</div>
        <div style={{
          fontSize: 13,
          fontWeight: 700,
          fontFamily: 'monospace',
          color: isValidDest ? '#86efac' : 'rgba(210,175,100,0.55)',
          lineHeight: 1,
        }}>
          {count}<span style={{ fontSize: 9, opacity: 0.6 }}>/15</span>
        </div>
      </div>

      {/* Stacked checker slivers */}
      {pipsToShow > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2.5, alignItems: 'center', width: '100%' }}>
          {Array.from({ length: pipsToShow }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 34,
                height: 7,
                borderRadius: 4,
                background: isWhite
                  ? 'radial-gradient(ellipse at 40% 40%, #f5e8c0 0%, #d4a83a 60%, #a87018 100%)'
                  : 'radial-gradient(ellipse at 40% 40%, #4a2e18 0%, #1e0e06 60%, #0c0502 100%)',
                boxShadow: isWhite
                  ? '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,252,220,0.35)'
                  : '0 1px 2px rgba(0,0,0,0.65), inset 0 1px 0 rgba(140,80,30,0.2)',
              }}
            />
          ))}
          {count > 10 && (
            <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(210,175,100,0.45)', lineHeight: 1 }}>
              +{count - 10}
            </div>
          )}
        </div>
      )}

      {/* Empty tray hint when no checkers borne off */}
      {count === 0 && (
        <div style={{
          width: 34, height: 7, borderRadius: 4,
          border: '1px dashed rgba(200,150,50,0.18)',
          opacity: 0.4,
        }} />
      )}
    </div>
  )
}

// ── Main Board ────────────────────────────────────────────────────────────────

export default function Board({
  gameState, selectedPoint, onSelectPoint, onMoveToPoint, ghostBranches, spyCtx, flipped = false,
}: BoardProps) {
  const { board, current_player, valid_moves } = gameState
  const TOP_ROW    = flipped ? TOP_ROW_FLIPPED    : TOP_ROW_NORMAL
  const BOTTOM_ROW = flipped ? BOTTOM_ROW_FLIPPED : BOTTOM_ROW_NORMAL

  if (!board || board.length < 24) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 400, borderRadius: 16,
        border: '1px solid rgba(80,60,20,0.3)',
        background: 'rgba(15,10,5,0.5)',
      }}>
        <span style={{ color: '#f59e0b', fontSize: 15, opacity: 0.7 }}>Connecting…</span>
      </div>
    )
  }

  const locked = spyCtx?.challengeWindowOpen ?? false

  const validDests = useMemo<Set<number | 'off'>>(() => {
    if (selectedPoint === null) return new Set()
    return new Set(
      valid_moves
        .filter(m => String(m.from_pos) === String(selectedPoint))
        .map(m => m.to_pos)
    )
  }, [selectedPoint, valid_moves])

  const spyDests = useMemo<Set<number>>(() => {
    if (selectedPoint === null) return new Set()
    if (!spyCtx || spyCtx.tokensRemaining[current_player] <= 0) return new Set()
    if (spyCtx.challengeWindowOpen) return new Set()
    const all = new Set<number>()
    for (let i = 0; i < 24; i++) {
      if (!validDests.has(i)) all.add(i)
    }
    return all
  }, [selectedPoint, spyCtx, current_player, validDests])

  const canBearOffWhite = validDests.has('off') && current_player === 'white'
  const canBearOffBlack = validDests.has('off') && current_player === 'black'

  function getQuantumPointData(i: number): { displayPt: PointState; ghostA: number; ghostB: number } {
    if (!ghostBranches) return { displayPt: board[i], ghostA: 0, ghostB: 0 }
    const qp = ghostBranches.quantumPlayer
    const countA = ghostBranches.branchA.board[i].player === qp ? ghostBranches.branchA.board[i].count : 0
    const countB = ghostBranches.branchB.board[i].player === qp ? ghostBranches.branchB.board[i].count : 0
    const certain = Math.min(countA, countB)
    const basePt = board[i]
    const displayPt: PointState = basePt.player === qp
      ? (certain > 0 ? { count: certain, player: qp } : { count: 0, player: null })
      : basePt
    return { displayPt, ghostA: countA - certain, ghostB: countB - certain }
  }

  function renderRow(indices: number[], orientation: 'up' | 'down') {
    const left  = indices.slice(0, 6)
    const right = indices.slice(6, 12)

    return (
      <div style={{ display: 'flex', flex: 1, height: '100%' }}>
        {left.map(i => {
          const { displayPt, ghostA, ghostB } = getQuantumPointData(i)
          return (
            <Triangle
              key={i} index={i}
              pointState={displayPt}
              orientation={orientation}
              isHighlighted={validDests.has(i)}
              isSpyHighlighted={spyDests.has(i)}
              isSelected={selectedPoint === i}
              onSelect={() => onSelectPoint(i)}
              onMove={() => onMoveToPoint(i)}
              selectedPoint={selectedPoint}
              currentPlayer={current_player}
              ghostA={ghostA > 0 ? ghostA : undefined}
              ghostB={ghostB > 0 ? ghostB : undefined}
              ghostPlayer={ghostBranches?.quantumPlayer}
              locked={locked}
            />
          )
        })}

        {/* Bar column spacer */}
        <div style={{ width: 48, flexShrink: 0 }} />

        {right.map(i => {
          const { displayPt, ghostA, ghostB } = getQuantumPointData(i)
          return (
            <Triangle
              key={i} index={i}
              pointState={displayPt}
              orientation={orientation}
              isHighlighted={validDests.has(i)}
              isSpyHighlighted={spyDests.has(i)}
              isSelected={selectedPoint === i}
              onSelect={() => onSelectPoint(i)}
              onMove={() => onMoveToPoint(i)}
              selectedPoint={selectedPoint}
              currentPlayer={current_player}
              ghostA={ghostA > 0 ? ghostA : undefined}
              ghostB={ghostB > 0 ? ghostB : undefined}
              ghostPlayer={ghostBranches?.quantumPlayer}
              locked={locked}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', width: '100%', minWidth: 640 }}>

      {/* ── Bear-off tray: left side (black normal / white flipped) ─── */}
      <BearOffZone
        player={flipped ? 'white' : 'black'}
        count={flipped ? gameState.off.white : gameState.off.black}
        isValidDest={flipped ? canBearOffWhite : canBearOffBlack}
        onMove={() => onMoveToPoint('off')}
      />

      {/* ── Main board ───────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          borderRadius: 18,
          overflow: 'hidden',
          // Rich walnut wood frame
          background: 'linear-gradient(145deg, #6e3e20 0%, #4e2610 35%, #3a1a08 65%, #5c3418 100%)',
          padding: 12,
          boxShadow: [
            '0 14px 48px rgba(0,0,0,0.85)',
            '0 4px 14px rgba(0,0,0,0.6)',
            'inset 0 1px 0 rgba(255,210,120,0.22)',
            'inset 0 -1px 0 rgba(0,0,0,0.55)',
            'inset 2px 0 4px rgba(0,0,0,0.25)',
            'inset -2px 0 4px rgba(0,0,0,0.25)',
          ].join(', '),
        }}
      >
        {/* Inner bevel — thin bright ring just inside the wood */}
        <div
          style={{
            height: '100%',
            borderRadius: 10,
            overflow: 'hidden',
            boxShadow: 'inset 0 0 0 1px rgba(255,200,90,0.12), inset 0 0 0 2px rgba(0,0,0,0.4)',
            minHeight: 480,
            display: 'flex',
            flexDirection: 'column',
            // Deep green felt with subtle radial centre-lightening
            background: 'radial-gradient(ellipse 90% 55% at 50% 50%, #15502a 0%, #0e3e1e 55%, #09301580 100%), linear-gradient(180deg, #0d3d20 0%, #0a3018 100%)',
          }}
        >
          {/* ── Top row (points 12–23) ──────────────────────────────── */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              height: '46%',
              minHeight: 220,
            }}
          >
            {renderRow(TOP_ROW, 'down')}
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', height: '100%', width: 48 }}>
              <BarZone
                gameState={gameState}
                selectedPoint={selectedPoint}
                onSelectBar={() => onSelectPoint('bar')}
                flipped={flipped}
              />
            </div>
          </div>

          {/* ── Centre rail ─────────────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              height: '8%',
              background: 'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.06) 50%, rgba(0,0,0,0.18) 100%)',
              position: 'relative',
            }}
          >
            {/* Full-width decorative line */}
            <div style={{
              position: 'absolute', inset: '0 0 0 0',
              display: 'flex', alignItems: 'center', padding: '0 12px',
              gap: 8,
            }}>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(200,155,60,0.3) 40%, rgba(200,155,60,0.3) 60%, transparent)' }} />
              <div style={{
                fontSize: 9,
                letterSpacing: '0.22em',
                fontFamily: 'Georgia, serif',
                color: ghostBranches ? 'rgba(103,232,249,0.4)' : 'rgba(200,155,60,0.38)',
                fontWeight: 600,
                userSelect: 'none',
                whiteSpace: 'nowrap',
              }}>
                {ghostBranches ? '⚛ QUANTUM ⚛' : '◆  BACKGAMMON  ◆'}
              </div>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(200,155,60,0.3) 0%, rgba(200,155,60,0.3) 60%, transparent)' }} />
            </div>
          </div>

          {/* ── Bottom row (points 11–0) ─────────────────────────────── */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              height: '46%',
              minHeight: 220,
            }}
          >
            {renderRow(BOTTOM_ROW, 'up')}
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', height: '100%', width: 48 }}>
              <BarZone
                gameState={gameState}
                selectedPoint={selectedPoint}
                onSelectBar={() => onSelectPoint('bar')}
                flipped={flipped}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bear-off tray: right side (white normal / black flipped) ── */}
      <BearOffZone
        player={flipped ? 'black' : 'white'}
        count={flipped ? gameState.off.black : gameState.off.white}
        isValidDest={flipped ? canBearOffBlack : canBearOffWhite}
        onMove={() => onMoveToPoint('off')}
      />
    </div>
  )
}
