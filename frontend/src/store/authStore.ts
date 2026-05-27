import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export interface AuthUser {
  id: string
  username: string
  elo: number
  games_played: number
  games_won: number
  win_streak: number
  avatar: string
  created_at: string
}

interface AuthStore {
  user: AuthUser | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
  refreshMe: () => Promise<void>
  updateAvatar: (avatar: string) => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,

      login: async (email, password) => {
        const { data } = await axios.post(`${API_BASE}/auth/login`, { email, password })
        set({ token: data.access_token, user: data.user })
      },

      register: async (username, email, password) => {
        const { data } = await axios.post(`${API_BASE}/auth/register`, { username, email, password })
        set({ token: data.access_token, user: data.user })
      },

      logout: () => set({ user: null, token: null }),

      refreshMe: async () => {
        const { token } = get()
        if (!token) return
        try {
          const { data } = await axios.get(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          set({ user: data })
        } catch {
          set({ user: null, token: null })
        }
      },

      updateAvatar: async (avatar) => {
        const { token } = get()
        if (!token) return
        const { data } = await axios.patch(
          `${API_BASE}/auth/avatar`,
          { avatar },
          { headers: { Authorization: `Bearer ${token}` } },
        )
        set({ user: data })
      },
    }),
    { name: 'bgpro-auth' },
  ),
)

export function authHeader(token: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}
