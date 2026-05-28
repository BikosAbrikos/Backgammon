import { useState, useEffect, useCallback } from 'react'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const STATUS_MESSAGES = [
  'Waking up the server…',
  'Server is warming up…',
  'Still starting up…',
  'Almost ready…',
  'Hang tight just a moment…',
]

// ── Animated dice face ────────────────────────────────────────────────────────

const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[30, 30], [50, 50], [70, 70]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 22], [70, 22], [30, 50], [70, 50], [30, 78], [70, 78]],
}

function AnimatedDie({ value }: { value: number }) {
  const pips = PIP_LAYOUTS[value] ?? []
  return (
    <div
      className="dice-float"
      style={{
        width: 76,
        height: 76,
        borderRadius: 17,
        position: 'relative',
        background: 'linear-gradient(145deg, #fdf8e8 0%, #f0d898 45%, #ddb848 100%)',
        border: '2px solid rgba(210,165,55,0.7)',
        boxShadow: [
          '0 0 0 1px rgba(0,0,0,0.65)',
          '0 12px 32px rgba(0,0,0,0.75)',
          '0 4px 10px rgba(0,0,0,0.5)',
          'inset 0 1px 0 rgba(255,255,240,0.9)',
          'inset 0 -2px 4px rgba(150,100,10,0.35)',
        ].join(', '),
        transition: 'all 0.12s ease',
      }}
    >
      {pips.map(([x, y], i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 11,
            height: 11,
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            left: `${x}%`,
            top: `${y}%`,
            background: 'radial-gradient(circle at 35% 35%, #3c2610, #1a1004)',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.55)',
          }}
        />
      ))}
    </div>
  )
}

// ── Checker dot ───────────────────────────────────────────────────────────────

function CheckerDot({ color }: { color: 'white' | 'black' }) {
  const isWhite = color === 'white'
  return (
    <div
      className={isWhite ? 'checker-ping-white' : 'checker-ping-black'}
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: isWhite
          ? 'radial-gradient(circle at 36% 30%, #fffff8, #f3e8c0 45%, #d4a838 80%, #a87018 100%)'
          : 'radial-gradient(circle at 36% 30%, #5c3a22, #1e0e06 50%, #0c0502 100%)',
        boxShadow: isWhite
          ? '0 0 0 1.5px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(100,58,0,0.3), 0 3px 9px rgba(0,0,0,0.5)'
          : '0 0 0 1.5px rgba(90,50,14,0.85), inset 0 1px 4px rgba(150,90,35,0.18), 0 3px 9px rgba(0,0,0,0.7)',
        position: 'relative',
      }}
    >
      {/* Inner concentric ring */}
      <div style={{
        position: 'absolute',
        inset: 5,
        borderRadius: '50%',
        border: isWhite
          ? '1px solid rgba(255,252,230,0.6)'
          : '1px solid rgba(160,88,30,0.28)',
        pointerEvents: 'none',
      }} />
    </div>
  )
}

// ── Loading Screen ────────────────────────────────────────────────────────────

interface Props {
  onReady: () => void
}

export default function LoadingScreen({ onReady }: Props) {
  const [msgIdx, setMsgIdx]         = useState(0)
  const [dots, setDots]             = useState('.')
  const [elapsed, setElapsed]       = useState(0)
  const [diceVal, setDiceVal]       = useState(1)
  const [fadingOut, setFadingOut]   = useState(false)
  const [gaveUp, setGaveUp]         = useState(false)

  // Animated dots
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 500)
    return () => clearInterval(t)
  }, [])

  // Cycle status messages every ~9 seconds
  useEffect(() => {
    const t = setInterval(() =>
      setMsgIdx(i => Math.min(i + 1, STATUS_MESSAGES.length - 1)), 9000)
    return () => clearInterval(t)
  }, [])

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Dice face cycling
  useEffect(() => {
    const t = setInterval(() => setDiceVal(v => (v % 6) + 1), 650)
    return () => clearInterval(t)
  }, [])

  // Give-up timer (50s)
  useEffect(() => {
    const t = setTimeout(() => setGaveUp(true), 50_000)
    return () => clearTimeout(t)
  }, [])

  const triggerReady = useCallback(() => {
    setFadingOut(true)
    setTimeout(onReady, 550)
  }, [onReady])

  // Health-check polling
  useEffect(() => {
    let cancelled = false

    async function check() {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 6000)
      try {
        const res = await fetch(`${API_BASE}/health`, { signal: controller.signal })
        clearTimeout(timeout)
        if (res.ok && !cancelled) triggerReady()
      } catch {
        clearTimeout(timeout)
      }
    }

    // First attempt immediately
    check()
    const interval = setInterval(check, 4500)
    return () => { cancelled = true; clearInterval(interval) }
  }, [triggerReady])

  // Progress bar: grows from 0% to 90% over 40 seconds, then stays
  const progress = Math.min((elapsed / 40) * 90, 90)

  return (
    <div
      className="load-screen-in"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 36,
        // Match the app background with a subtle inner glow
        background: 'radial-gradient(ellipse 70% 55% at 50% 42%, #1e1008 0%, #0e0806 50%, #0a0602 100%)',
        opacity: fadingOut ? 0 : 1,
        transition: 'opacity 0.55s ease',
      }}
    >
      {/* ── Branding ───────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', userSelect: 'none' }}>
        <div style={{ fontSize: 46, lineHeight: 1, marginBottom: 12 }}>🎲</div>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: 30,
          fontWeight: 900,
          letterSpacing: '0.1em',
          color: '#f0d898',
          textShadow: '0 0 40px rgba(220,160,40,0.28)',
        }}>
          BACKGAMMON
        </div>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: 13,
          letterSpacing: '0.35em',
          color: 'rgba(210,165,80,0.5)',
          marginTop: 4,
        }}>
          PRO
        </div>
      </div>

      {/* ── Animated dice + flanking checkers ─────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <CheckerDot color="black" />
        <AnimatedDie value={diceVal} />
        <CheckerDot color="white" />
      </div>

      {/* ── Status section ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>

        {/* Status text */}
        {!gaveUp ? (
          <p style={{
            fontFamily: 'Georgia, serif',
            fontSize: 15,
            color: 'rgba(220,180,90,0.8)',
            minWidth: 240,
            lineHeight: 1,
            margin: 0,
          }}>
            {STATUS_MESSAGES[msgIdx]}{dots}
          </p>
        ) : (
          <p style={{
            fontFamily: 'Georgia, serif',
            fontSize: 14,
            color: 'rgba(220,100,80,0.8)',
            maxWidth: 260,
            lineHeight: 1.5,
            margin: 0,
          }}>
            Server is taking longer than expected.
          </p>
        )}

        {/* Progress bar */}
        <div style={{
          width: 220,
          height: 3,
          borderRadius: 2,
          background: 'rgba(255,200,80,0.1)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            borderRadius: 2,
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #a07020, #d4a838, #f0c860)',
            transition: 'width 1s linear',
            boxShadow: '0 0 8px rgba(210,160,50,0.55)',
          }} />
        </div>

        {/* Hint text — appears after 10 s */}
        {elapsed >= 10 && !gaveUp && (
          <p style={{
            fontSize: 11,
            color: 'rgba(180,140,60,0.38)',
            fontFamily: 'Georgia, serif',
            margin: 0,
            maxWidth: 240,
            lineHeight: 1.6,
          }}>
            Free servers sleep when idle.<br />First load typically takes 20–40 s.
          </p>
        )}

        {/* Retry button — appears after give-up */}
        {gaveUp && (
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 6,
              padding: '8px 22px',
              borderRadius: 10,
              fontFamily: 'Georgia, serif',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              color: '#3a1e04',
              background: 'linear-gradient(180deg, #f0d898 0%, #c89030 100%)',
              border: '1.5px solid rgba(140,90,10,0.7)',
              boxShadow: '0 3px 10px rgba(0,0,0,0.4)',
            }}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
