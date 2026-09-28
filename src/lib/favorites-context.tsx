'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react'
import { useAuth } from './auth-context'
import { auth } from './firebase'
import { useSignInPrompt } from './sign-in-prompt-context'

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
  const { promptSignIn } = useSignInPrompt()
  // A listing a signed-out user tapped the heart on; saved once they sign in.
  const pendingRef = useRef<number | null>(null)
  const [favorites, setFavorites] = useState<Set<number>>(new Set())
  const favoritesRef = useRef<Set<number>>(new Set())
  const lastFetchRef = useRef<number>(0)

  useEffect(() => { favoritesRef.current = favorites }, [favorites])

  const loadFavorites = useCallback(async () => {
    if (!user) {
      // Saving requires an account, so signed-out visitors see no saved hearts.
      // (Any favorites stored locally before this rule are merged in at sign-in.)
      setFavorites(new Set())
      favoritesRef.current = new Set()
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

  // Reload on sign-in / sign-out, then save the heart tapped before signing in
  useEffect(() => {
    loadFavorites().then(() => {
      const id = pendingRef.current
      if (!user || id === null) return
      pendingRef.current = null
      if (favoritesRef.current.has(id)) return
      const next = new Set(favoritesRef.current).add(id)
      setFavorites(next)
      favoritesRef.current = next
      patchFavorite(id, 'add')
    })
  }, [loadFavorites, user])

  // Re-fetch when the tab regains focus (30s debounce to avoid hammering on rapid switches)
  useEffect(() => {
    const onFocus = () => {
      if (user && Date.now() - lastFetchRef.current > 30_000) loadFavorites()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [user, loadFavorites])

  const toggleFavorite = useCallback(async (id: number) => {
    if (!user) {
      pendingRef.current = id
      promptSignIn({ onDismiss: () => { pendingRef.current = null } })
      return
    }

    const next = new Set(favoritesRef.current)
    if (next.has(id)) next.delete(id)
    else next.add(id)

    // Optimistic update
    setFavorites(next)
    favoritesRef.current = next

    const action = next.has(id) ? 'add' : 'remove'
    await patchFavorite(id, action)
  }, [user, promptSignIn])

  const isFavorite = useCallback((id: number) => favorites.has(id), [favorites])

  const value = useMemo(
    () => ({ favorites, toggleFavorite, isFavorite }),
    [favorites, toggleFavorite, isFavorite]
  )

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used inside FavoritesProvider')
  return ctx
}
