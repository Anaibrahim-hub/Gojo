'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react'
import { useAuth } from './auth-context'
import { auth } from './firebase'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''
const STORAGE_KEY = 'gojo_favorites'

interface FavoritesContextValue {
  favorites: Set<number>
  toggleFavorite: (id: number) => void
  isFavorite: (id: number) => boolean
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

function loadLocal(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

async function apiFetch(path: string, options?: RequestInit): Promise<Response | null> {
  if (!WORKER_URL) return null
  const token = await auth.currentUser?.getIdToken()
  if (!token) return null
  return fetch(`${WORKER_URL}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options?.headers },
  })
}

async function fetchRemote(): Promise<Set<number> | null> {
  try {
    const res = await apiFetch('/favorites')
    if (!res || !res.ok) return null
    const data = await res.json() as { ids: number[] }
    return new Set(data.ids)
  } catch {
    return null
  }
}

async function pushRemote(ids: Set<number>): Promise<void> {
  try {
    await apiFetch('/favorites', {
      method: 'PUT',
      body: JSON.stringify({ ids: [...ids] }),
    })
  } catch {
    // non-fatal — optimistic update already applied locally
  }
}

async function patchFavorite(id: number, action: 'add' | 'remove'): Promise<void> {
  try {
    await apiFetch('/favorites', {
      method: 'PATCH',
      body: JSON.stringify({ action, id }),
    })
  } catch {
    // non-fatal
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [favorites, setFavorites] = useState<Set<number>>(new Set())
  const favoritesRef = useRef<Set<number>>(new Set())
  const lastFetchRef = useRef<number>(0)

  useEffect(() => { favoritesRef.current = favorites }, [favorites])

  const loadFavorites = useCallback(async () => {
    if (!user) {
      const local = loadLocal()
      setFavorites(local)
      favoritesRef.current = local
      return
    }

    const remote = await fetchRemote()
    if (remote === null) return // worker unavailable — keep current state

    // Merge any favorites saved while signed out, then clear localStorage
    const local = loadLocal()
    if (local.size > 0) {
      for (const id of local) remote.add(id)
      localStorage.removeItem(STORAGE_KEY)
      await pushRemote(remote)
    }

    setFavorites(remote)
    favoritesRef.current = remote
    lastFetchRef.current = Date.now()
  }, [user])

  // Reload on sign-in / sign-out
  useEffect(() => { loadFavorites() }, [loadFavorites])

  // Re-fetch when the tab regains focus (30s debounce to avoid hammering on rapid switches)
  useEffect(() => {
    const onFocus = () => {
      if (user && Date.now() - lastFetchRef.current > 30_000) loadFavorites()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [user, loadFavorites])

  const toggleFavorite = async (id: number) => {
    const next = new Set(favoritesRef.current)
    if (next.has(id)) next.delete(id)
    else next.add(id)

    // Optimistic update
    setFavorites(next)
    favoritesRef.current = next

    if (!user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      return
    }

    const action = next.has(id) ? 'add' : 'remove'
    await patchFavorite(id, action)
  }

  const isFavorite = (id: number) => favorites.has(id)

  return (
    <FavoritesContext.Provider value={{ favorites, toggleFavorite, isFavorite }}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used inside FavoritesProvider')
  return ctx
}
