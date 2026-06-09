'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
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

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [photoURL, setPhotoURL] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)

  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const email = window.localStorage.getItem('emailForSignIn')
      if (email) {
        signInWithEmailLink(auth, email, window.location.href)
          .then(() => {
            window.localStorage.removeItem('emailForSignIn')
            window.history.replaceState({}, '', window.location.pathname)
          })
          .catch(console.error)
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setDisplayName(u?.displayName ?? null)
      // Only use photos the user explicitly uploaded (R2). Ignore Google/OAuth provider
      // photos — they require referrer tricks and CSP allowances that are fragile.
      const url = u?.photoURL ?? null
      const isThirdParty = url && (
        url.includes('googleusercontent.com') ||
        url.includes('graph.facebook.com') ||
        url.includes('twimg.com')
      )
      setPhotoURL(isThirdParty ? null : url)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }

  const sendEmailLink = async (email: string) => {
    await sendSignInLinkToEmail(auth, email, {
      url: window.location.origin,
      handleCodeInApp: true,
    })
    window.localStorage.setItem('emailForSignIn', email)
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
  }

  const updateUserPhoto = async (url: string | null) => {
    if (!auth.currentUser) return
    await updateProfile(auth.currentUser, { photoURL: url })
    setPhotoURL(url)
  }

  const updateUserProfile = async (data: { displayName?: string }) => {
    if (!auth.currentUser) return
    await updateProfile(auth.currentUser, data)
    if ('displayName' in data) setDisplayName(data.displayName ?? null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, photoURL, displayName, signInWithGoogle, sendEmailLink, signOut, updateUserPhoto, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
