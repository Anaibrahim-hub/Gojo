'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import SignInModal from '@/app/components/SignInModal'
import { auth } from './firebase'

interface SignInPromptValue {
  /** Opens the app-wide sign-in dialog (e.g. when a signed-out user taps a heart). */
  promptSignIn: (opts?: { onDismiss?: () => void }) => void
}

const SignInPromptContext = createContext<SignInPromptValue | null>(null)

export function SignInPromptProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const onDismissRef = useRef<(() => void) | undefined>(undefined)
  const promptSignIn = useCallback<SignInPromptValue['promptSignIn']>(opts => {
    onDismissRef.current = opts?.onDismiss
    setOpen(true)
  }, [])
  const close = useCallback(() => {
    setOpen(false)
    // The modal also closes itself after a successful sign-in; only a close with
    // nobody signed in counts as the user backing out.
    if (!auth.currentUser) onDismissRef.current?.()
    onDismissRef.current = undefined
  }, [])
  const value = useMemo(() => ({ promptSignIn }), [promptSignIn])
  return (
    <SignInPromptContext.Provider value={value}>
      {children}
      <SignInModal open={open} onClose={close} />
    </SignInPromptContext.Provider>
  )
}

export function useSignInPrompt() {
  const ctx = useContext(SignInPromptContext)
  if (!ctx) throw new Error('useSignInPrompt must be used inside SignInPromptProvider')
  return ctx
}
