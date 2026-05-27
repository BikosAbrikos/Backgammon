import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import { useGameStore } from '../store/gameStore'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export default function JoinPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { token } = useAuthStore()
  const { setOnlineGame } = useGameStore()
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      navigate(`/auth?redirect=/join/${code}`)
      return
    }
    if (!code) { navigate('/lobby'); return }

    axios.post(`${API_BASE}/rooms/join/${code.toUpperCase()}`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(({ data }) => {
      setOnlineGame(
        { mode: data.mode, board: [], bar: { white: 0, black: 0 }, off: { white: 0, black: 0 },
          current_player: 'white', dice: { values: [], remaining: [] },
          phase: 'waiting_roll', winner: null, valid_moves: [] },
        { roomId: data.room_ws_id, myColor: 'black', opponent: { username: 'Host', elo: 0 } }
      )
      navigate(`/game/${data.room_ws_id}`)
    }).catch(e => {
      setError(e?.response?.data?.detail ?? 'Room not found or expired')
    })
  }, [code, token])

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-6">
        <div className="text-5xl">😕</div>
        <h2 className="text-2xl font-bold text-amber-200">Couldn't join room</h2>
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={() => navigate('/lobby')}
          className="px-6 py-2.5 rounded-xl font-bold text-stone-900
            bg-gradient-to-b from-amber-300 to-amber-500 border border-amber-600
            hover:from-amber-200 hover:to-amber-400 transition-all">
          Back to Lobby
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center flex flex-col items-center gap-4">
        <div className="text-4xl animate-pulse">🔗</div>
        <p className="text-amber-300 font-semibold">Joining room…</p>
      </div>
    </div>
  )
}
