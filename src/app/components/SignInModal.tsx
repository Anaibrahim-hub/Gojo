'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Mail, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

type View = 'options' | 'email'

const FIREBASE_ERRORS: Record<string, string> = {
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/popup-blocked': 'Popup was blocked — please allow popups for this site and try again.',
  'auth/unauthorized-domain': 'This domain is not authorised in Firebase. Add it under Authentication → Settings → Authorised domains.',
  'auth/popup-closed-by-user': '',
  'auth/cancelled-popup-request': '',
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function SignInModal({ open, onClose }: Props) {
  const { user, signInWithGoogle, sendEmailLink } = useAuth()
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  const [view, setView] = useState<View>('options')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    console.log('[modal] user/open changed → user:', user ? user.email : null, '| open:', open)
    if (user && open) {
      console.log('[modal] user signed in → closing modal')
      onCloseRef.current()
    }
  }, [user, open]) // onClose intentionally excluded — kept stable via ref

  useEffect(() => {
    if (!open) {
      setView('options')
      setEmail('')
      setSent(false)
      setError('')
      setLoading(false)
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open])

  if (!open) return null

  const handleError = (err: unknown) => {
    const code = (err as { code?: string }).code ?? ''
    const msg = FIREBASE_ERRORS[code]
    if (msg !== '') setError(msg || 'Something went wrong. Please try again.')
  }

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      await signInWithGoogle()
      onClose()
    } catch (err) {
      handleError(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await sendEmailLink(email)
      setSent(true)
    } catch (err) {
      handleError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-sm mx-4 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>

        {view === 'options' && (
          <>
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Sign in to Yevilla</h2>
            <p className="text-sm text-gray-500 mb-6">Save searches, contact agents, and more.</p>

            {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

            <div className="flex flex-col gap-3">
              <button
                onClick={handleGoogle}
                disabled={loading}
                className="flex items-center justify-center gap-3 w-full border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
                Continue with Google
              </button>

              <button
                onClick={() => { setView('email'); setError('') }}
                className="flex items-center justify-center gap-3 w-full border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <Mail size={18} />
                Continue with Email
              </button>
            </div>

            <p className="text-xs text-gray-400 text-center mt-5">
              By proceeding, you confirm that you have read and agree to our{' '}
              <Link href="/privacy" onClick={onClose} className="underline hover:text-gray-600">
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link href="/terms" onClick={onClose} className="underline hover:text-gray-600">
                Terms of Use
              </Link>.
            </p>
          </>
        )}

        {view === 'email' && !sent && (
          <>
            <button
              onClick={() => { setView('options'); setError('') }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Sign in with Email</h2>
            <p className="text-sm text-gray-500 mb-5">We&apos;ll send a sign-in link to your inbox — no password needed.</p>

            <form onSubmit={handleSendLink} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email address</label>
                <input
                  type="email"
                  autoFocus
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-black text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-900 transition disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send Sign-In Link'}
              </button>
            </form>
          </>
        )}

        {view === 'email' && sent && (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail size={22} className="text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Check your inbox</h2>
            <p className="text-sm text-gray-500 mb-1">
              We sent a sign-in link to
            </p>
            <p className="text-sm font-medium text-gray-800 mb-5">{email}</p>
            <p className="text-xs text-gray-400">
              Click the link in the email to sign in. You can close this window.
            </p>
            <button
              onClick={() => { setSent(false); setEmail('') }}
              className="mt-5 text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Use a different email
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
