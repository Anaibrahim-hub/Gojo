'use client'

import { createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode } from 'react'
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  sendSignInLinkToEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth'
import { auth } from './firebase'

interface AuthContextType {
  user: User | null
  loading: boolean
  photoURL: string | null
  displayName: string | null
  signInWithGoogle: () => Promise<void>
  sendEmailLink: (email: string) => Promise<void>
  signOut: () => Promise<void>
  updateUserPhoto: (url: string | null) => Promise<void>
  updateUserProfile: (data: { displayName?: string }) => Promise<void>
}

/** Fired after the signed-in user renames themselves: `{ detail: { uid, name } }`. */
export const OWNER_RENAMED_EVENT = 'gojo:owner-renamed'

/**
 * Listings store a copy of the owner's name ("Listed by …", hotel/venue titles).
 * Push the current name to all of the user's listings via the worker.
 */
async function syncListingOwnerName(u: User, name: string) {
  try {
    const token = await u.getIdToken()
    await fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ displayName: name }),
    })
  } catch { /* best effort; retried next session */ }
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [photoURL, setPhotoURL] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)

  useEffect(() => {
    console.log('[auth] setting up onAuthStateChanged')
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      console.log('[auth] state changed → user:', u ? u.email : null, '| loading was:', loading)
      setUser(u)
      setDisplayName(u?.displayName ?? null)
      const url = u?.photoURL ?? null
      const isThirdParty = url && (
        url.includes('googleusercontent.com') ||
        url.includes('graph.facebook.com') ||
        url.includes('twimg.com')
      )
      setPhotoURL(isThirdParty ? null : url)
      setLoading(false)
      // Once per session, catch listings up with a rename made elsewhere (e.g. the app).
      if (u && !u.isAnonymous && u.displayName) {
        window.dispatchEvent(new CustomEvent(OWNER_RENAMED_EVENT, { detail: { uid: u.uid, name: u.displayName } }))
        const key = `gojo_name_synced_${u.uid}`
        try {
          if (sessionStorage.getItem(key) !== u.displayName) {
            sessionStorage.setItem(key, u.displayName)
            syncListingOwnerName(u, u.displayName)
          }
        } catch { syncListingOwnerName(u, u.displayName) }
      }
    })
    return unsubscribe
  }, [])

  const signInWithGoogle = useCallback(async () => {
    console.log('[auth] signInWithGoogle start')
    const provider = new GoogleAuthProvider()
    try {
      const result = await signInWithPopup(auth, provider)
      console.log('[auth] signInWithGoogle success → user:', result.user.email)
    } catch (e) {
      console.error('[auth] signInWithGoogle error:', e)
      throw e
    }
  }, [])

  const sendEmailLink = useCallback(async (email: string) => {
    const actionUrl = `${window.location.origin}/auth-action`
    console.log('[auth] sendEmailLink → email:', email, '| continueUrl:', actionUrl)
    await sendSignInLinkToEmail(auth, email, {
      url: actionUrl,
      handleCodeInApp: true,
    })
    window.localStorage.setItem('emailForSignIn', email)
    console.log('[auth] sendEmailLink sent ok')
  }, [])

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth)
  }, [])

  const updateUserPhoto = useCallback(async (url: string | null) => {
    if (!auth.currentUser) return
    await updateProfile(auth.currentUser, { photoURL: url })
    setPhotoURL(url)
  }, [])

  const updateUserProfile = useCallback(async (data: { displayName?: string }) => {
    if (!auth.currentUser) return
    const u = auth.currentUser
    await updateProfile(u, data)
    if (!('displayName' in data)) return
    const name = data.displayName ?? null
    setDisplayName(name)
    // Tell open pages, and update the copy of the name stored on this user's listings.
    window.dispatchEvent(new CustomEvent(OWNER_RENAMED_EVENT, { detail: { uid: u.uid, name } }))
    await syncListingOwnerName(u, name ?? '')
  }, [])

  const value = useMemo(
    () => ({ user, loading, photoURL, displayName, signInWithGoogle, sendEmailLink, signOut, updateUserPhoto, updateUserProfile }),
    [user, loading, photoURL, displayName, signInWithGoogle, sendEmailLink, signOut, updateUserPhoto, updateUserProfile]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
