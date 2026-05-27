import { useState, useEffect, useRef } from 'react'
import type { GameMode } from '../store/gameStore'
import { useGameStore } from '../store/gameStore'
import Board from '../components/Board'
import Dice from '../components/Dice'
import TopBar from '../components/TopBar'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

function WakeUpScreen({ elapsed }: { elapsed: number }) {
  const dots = '.'.repeat((Math.floor(elapsed / 0.6) % 4))

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: '#0e0804' }}
    >
      <div className="flex flex-col items-center gap-6 text-center px-6">
        {/* Dice spinner */}
        <div className="text-6xl" style={{ animation: 'diceRoll 1.2s ease-in-out infinite' }}>
          🎲
        </div>

        <div>
          <h1 className="text-2xl font-bold text-amber-200 mb-2">
            Waking up the server{dots}
          </h1>
          <p className="text-stone-500 text-sm">
            First visit takes ~30 seconds — hang tight
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-64 h-1.5 bg-stone-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-1000"
            style={{ width: `${Math.min((elapsed / 45) * 100, 95)}%` }}
          />
        </div>

        <p className="text-stone-600 text-xs">{Math.round(elapsed)}s</p>
      </div>
    </div>
  )
}

function ModeSelector({ onSelect }: { onSelect: (mode: GameMode) => void }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(10, 6, 2, 0.95)' }}
    >
      <div
        className="flex flex-col items-center gap-8 p-10 rounded-2xl border border-amber-800/40"
        style={{ background: 'linear-gradient(135deg, #1c0f04 0%, #2a1508 100%)' }}
      >
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
              transition-all duration-200 w-52"
          >
            <div className="text-4xl">🎯</div>
            <div className="text-amber-200 font-bold text-lg">Short</div>
            <div className="text-stone-400 text-xs text-center leading-relaxed">
              Classic backgammon.<br />Hitting, bar, re-entry.
            </div>
          </button>

          <button
            onClick={() => onSelect('long')}
            className="flex flex-col items-center gap-3 p-8 rounded-xl border border-stone-600/50
              bg-stone-800/20 hover:bg-stone-700/40 hover:border-stone-400
              transition-all duration-200 w-52"
          >
            <div className="text-4xl">🏛️</div>
            <div className="text-amber-200 font-bold text-lg">Long</div>
            <div className="text-stone-400 text-xs text-center leading-relaxed">
              Narde-style. Stacked start,<br />no hitting.
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
      style={{ background: 'rgba(0,0,0,0.80)' }}>
      <div
        className="flex flex-col items-center gap-6 p-10 rounded-2xl border border-amber-600/50 text-center"
        style={{ background: 'linear-gradient(135deg, #1c0f04 0%, #2a1508 100%)' }}
      >
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
            bg-gradient-to-b from-amber-300 to-amber-500 border border-amber-600
            shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:from-amber-200 hover:to-amber-400
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
  const [serverReady, setServerReady] = useState(false)
  const [showModeSelector, setShowModeSelector] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const startTime = useRef(Date.now())

  // Wake up the server on mount, poll until it responds
  useEffect(() => {
    let cancelled = false

    const timer = setInterval(() => {
      if (!cancelled) setElapsed((Date.now() - startTime.current) / 1000)
    }, 500)

    async function ping() {
      while (!cancelled) {
        try {
          const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(8000) })
          if (res.ok && !cancelled) {
            setServerReady(true)
            setShowModeSelector(true)
            clearInterval(timer)
            return
          }
        } catch {
          // still sleeping
        }
        await new Promise(r => setTimeout(r, 3000))
      }
    }

    ping()
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

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

  if (!serverReady) {
    return <WakeUpScreen elapsed={elapsed} />
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

        <div className="w-full max-w-4xl">
          <Board
            gameState={gameState}
            selectedPoint={selectedPoint}
            onSelectPoint={selectPoint}
            onMoveToPoint={moveTo}
          />
        </div>

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
