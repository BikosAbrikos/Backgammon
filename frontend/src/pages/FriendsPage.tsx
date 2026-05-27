import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

interface FriendEntry {
  id: string
  username: string
  elo: number
  avatar: string
  status: 'accepted' | 'pending'
  direction: 'sent' | 'received'
}

const AVATAR_ICONS: Record<string, string> = {
  default: '🎲', knight: '♞', crown: '👑', dice: '🎯',
  dragon: '🐉', fox: '🦊', owl: '🦉', rocket: '🚀',
}

export default function FriendsPage() {
  const { token } = useAuthStore()
  const [friends, setFriends] = useState<FriendEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [addInput, setAddInput] = useState('')
  const [addError, setAddError] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addSuccess, setAddSuccess] = useState(false)

  const headers = { Authorization: `Bearer ${token}` }

  const refresh = useCallback(() => {
    setLoading(true)
    axios.get(`${API_BASE}/friends/list`, { headers })
      .then(r => setFriends(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => { refresh() }, [refresh])

  async function sendRequest() {
    const name = addInput.trim()
    if (!name) return
    setAddLoading(true); setAddError(''); setAddSuccess(false)
    try {
      await axios.post(`${API_BASE}/friends/request`, { username: name }, { headers })
      setAddInput('')
      setAddSuccess(true)
      refresh()
    } catch (e: any) {
      setAddError(e?.response?.data?.detail ?? 'Failed to send request')
    } finally {
      setAddLoading(false)
    }
  }

  async function accept(id: string) {
    await axios.post(`${API_BASE}/friends/accept/${id}`, {}, { headers })
    refresh()
  }

  async function remove(id: string) {
    await axios.delete(`${API_BASE}/friends/${id}`, { headers })
    refresh()
  }

  const accepted = friends.filter(f => f.status === 'accepted')
  const incoming = friends.filter(f => f.status === 'pending' && f.direction === 'received')
  const outgoing = friends.filter(f => f.status === 'pending' && f.direction === 'sent')

  return (
    <div className="flex-1 flex flex-col items-center px-6 py-12 gap-8 max-w-xl mx-auto w-full">
      <div className="text-center">
        <h1 className="text-3xl font-black text-amber-100">👥 Friends</h1>
        <p className="text-stone-500 mt-1 text-sm">Add friends and challenge them to a game</p>
      </div>

      {/* Add friend */}
      <div className="w-full rounded-2xl border border-stone-800/60 p-5 flex flex-col gap-3"
        style={{ background: 'linear-gradient(135deg,#140a03,#1e0e05)' }}>
        <label className="text-stone-400 text-xs font-semibold uppercase tracking-wider">
          Add by Username
        </label>
        <div className="flex gap-2">
          <input
            value={addInput}
            onChange={e => { setAddInput(e.target.value); setAddError(''); setAddSuccess(false) }}
            onKeyDown={e => e.key === 'Enter' && sendRequest()}
            placeholder="username"
            className="flex-1 px-3 py-2.5 rounded-lg bg-stone-900/60 border border-stone-700
              text-stone-100 placeholder-stone-600 text-sm focus:outline-none focus:border-amber-600"
          />
          <button
            onClick={sendRequest}
            disabled={addLoading || !addInput.trim()}
            className="px-4 py-2.5 rounded-lg font-semibold text-stone-900 text-sm
              bg-gradient-to-b from-amber-300 to-amber-500 border border-amber-600
              hover:from-amber-200 hover:to-amber-400 disabled:opacity-50 transition-all">
            {addLoading ? '…' : 'Add'}
          </button>
        </div>
        {addError && <p className="text-red-400 text-xs">{addError}</p>}
        {addSuccess && <p className="text-green-400 text-xs">Friend request sent!</p>}
      </div>

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <Section title={`Pending Requests (${incoming.length})`}>
          {incoming.map(f => (
            <FriendRow key={f.id} f={f}>
              <button onClick={() => accept(f.id)}
                className="text-xs px-3 py-1.5 rounded-lg bg-green-900/40 border border-green-700/50
                  text-green-400 hover:bg-green-900/60 transition-colors font-semibold">
                Accept
              </button>
              <button onClick={() => remove(f.id)}
                className="text-xs px-3 py-1.5 rounded-lg bg-stone-800/60 border border-stone-700/50
                  text-stone-500 hover:text-stone-300 transition-colors">
                Decline
              </button>
            </FriendRow>
          ))}
        </Section>
      )}

      {/* Friends list */}
      <Section title={`Friends (${accepted.length})`}>
        {loading && (
          <div className="text-stone-600 text-sm text-center py-4">Loading…</div>
        )}
        {!loading && accepted.length === 0 && (
          <div className="text-stone-600 text-sm text-center py-4">
            No friends yet. Add someone above!
          </div>
        )}
        {accepted.map(f => (
          <FriendRow key={f.id} f={f}>
            <button onClick={() => remove(f.id)}
              className="text-xs text-stone-600 hover:text-red-400 transition-colors">
              Remove
            </button>
          </FriendRow>
        ))}
      </Section>

      {/* Outgoing requests */}
      {outgoing.length > 0 && (
        <Section title="Sent Requests">
          {outgoing.map(f => (
            <FriendRow key={f.id} f={f}>
              <span className="text-xs text-stone-600">Pending…</span>
              <button onClick={() => remove(f.id)}
                className="text-xs text-stone-600 hover:text-red-400 transition-colors">
                Cancel
              </button>
            </FriendRow>
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="w-full">
      <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

function FriendRow({ f, children }: { f: FriendEntry; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-stone-800/40 bg-stone-900/20">
      <span className="text-2xl select-none">{AVATAR_ICONS[f.avatar] ?? '🎲'}</span>
      <Link to={`/profile/${f.username}`} className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-amber-100 hover:text-amber-300 transition-colors truncate">
          {f.username}
        </div>
        <div className="text-xs text-stone-600">{f.elo} Elo</div>
      </Link>
      <div className="flex items-center gap-2 shrink-0">{children}</div>
    </div>
  )
}
