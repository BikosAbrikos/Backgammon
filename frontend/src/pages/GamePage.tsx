import { useState } from 'react'
import type { GameMode } from '../store/gameStore'
import { useGameStore } from '../store/gameStore'
import Board from '../components/Board'
import Dice from '../components/Dice'
import TopBar from '../components/TopBar'

function ModeSelector({ onSelect }: { onSelect: (mode: GameMode) => void }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(10, 6, 2, 0.92)' }}>
      <div className="flex flex-col items-center gap-8 p-10 rounded-2xl border border-amber-800/40"
        style={{ background: 'linear-gradient(135deg, #1c0f04 0%, #2a1508 100%)' }}>
        <div>
          <h1 className="text-4xl font-bold text-amber-200 text-center tracking-wide mb-2">
            Backgammon
          </h1>
          <p className="text-stone-400 text-center text-sm">Choose your game mode</p>
        </div>

        <div className="flex gap-6">
          <button
            onClick={() => onSelect('short')}
            className="flex flex-col items-center gap-3 p-8 rounded-xl border border-amber-700/50
              bg-amber-900/20 hover:bg-amber-900/40 hover:border-amber-500
              transition-all duration-200 group w-52"
          >
            <div className="text-4xl">🎯</div>
            <div className="text-amber-200 font-bold text-lg">Short</div>
            <div className="text-stone-400 text-xs text-center leading-relaxed">
              Classic Western backgammon.<br />
              Hitting, bar system, re-entry.
            </div>
          </button>

          <button
            onClick={() => onSelect('long')}
            className="flex flex-col items-center gap-3 p-8 rounded-xl border border-stone-600/50
              bg-stone-800/20 hover:bg-stone-700/40 hover:border-stone-400
              transition-all duration-200 group w-52"
          >
            <div className="text-4xl">🏛️</div>
            <div className="text-amber-200 font-bold text-lg">Long</div>
            <div className="text-stone-400 text-xs text-center leading-relaxed">
              Narde-style. Stacked start,<br />
              no hitting, blocked points.
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

function WinnerOverlay({ winner, onRestart }: { winner: 'white' | 'black'; onRestart: () => void }) {
  const isWhite = winner === 'white'
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="flex flex-col items-center gap-6 p-10 rounded-2xl border border-amber-600/50 text-center"
        style={{ background: 'linear-gradient(135deg, #1c0f04 0%, #2a1508 100%)' }}>
        <div className="text-6xl">{isWhite ? '⬜' : '⬛'}</div>
        <div>
          <h2 className="text-3xl font-bold text-amber-200 mb-2">
            {isWhite ? 'White' : 'Black'} Wins!
          </h2>
          <p className="text-stone-400 text-sm">All 15 checkers borne off.</p>
        </div>
        <button
          onClick={onRestart}
          className="px-8 py-3 rounded-xl font-bold text-stone-900 text-lg
            bg-gradient-to-b from-amber-300 to-amber-500
            border border-amber-600
            shadow-[0_4px_12px_rgba(0,0,0,0.4)]
            hover:from-amber-200 hover:to-amber-400
            active:scale-95 transition-all"
        >
          Play Again
        </button>
      </div>
    </div>
  )
}

export default function GamePage() {
  const { gameState, selectedPoint, isRolling, startGame, rollDice, selectPoint, moveTo } = useGameStore()
  const [showModeSelector, setShowModeSelector] = useState(true)

  async function handleSelectMode(mode: GameMode) {
    await startGame(mode)
    setShowModeSelector(false)
  }

  async function handleRestart() {
    setShowModeSelector(true)
  }

  async function handleSwitchMode(mode: GameMode) {
    await startGame(mode)
  }

  if (showModeSelector || !gameState) {
    return <ModeSelector onSelect={handleSelectMode} />
  }

  const canRoll = gameState.phase === 'waiting_roll'
  const hasBarCheckers = gameState.bar[gameState.current_player] > 0

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        gameState={gameState}
        onRestart={handleRestart}
        onSwitchMode={handleSwitchMode}
      />

      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
        {/* Status message */}
        <div className="text-sm text-stone-400 h-5">
          {hasBarCheckers && gameState.phase === 'moving' && (
            <span className="text-red-400 font-semibold">
              You must re-enter from the bar first!
            </span>
          )}
          {gameState.phase === 'waiting_roll' && (
            <span className="text-amber-300">
              {gameState.current_player === 'white' ? 'White' : 'Black'} — roll the dice to move
            </span>
          )}
          {gameState.phase === 'moving' && !hasBarCheckers && selectedPoint === null && (
            <span className="text-stone-400">Select a checker to move</span>
          )}
          {selectedPoint !== null && (
            <span className="text-green-400">Click a highlighted point to move</span>
          )}
        </div>

        {/* Board */}
        <div className="w-full max-w-4xl">
          <Board
            gameState={gameState}
            selectedPoint={selectedPoint}
            onSelectPoint={selectPoint}
            onMoveToPoint={moveTo}
          />
        </div>

        {/* Dice area */}
        <Dice
          dice={gameState.dice}
          onRoll={rollDice}
          canRoll={canRoll}
          isRolling={isRolling}
        />
      </div>

      {gameState.phase === 'game_over' && gameState.winner && (
        <WinnerOverlay winner={gameState.winner} onRestart={handleRestart} />
      )}
    </div>
  )
}
