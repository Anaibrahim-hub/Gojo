'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Loader2, AlertCircle } from 'lucide-react'

function AuthAction() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const mode = searchParams.get('mode')
    const currentUrl = window.location.href

    if (mode === 'signIn' && isSignInWithEmailLink(auth, currentUrl)) {
      const email = localStorage.getItem('emailForSignIn')
      if (!email) {
        setError('Email not found. Please request a new sign-in link.')
        return
      }
      signInWithEmailLink(auth, email, currentUrl)
        .then(() => {
          localStorage.removeItem('emailForSignIn')
          router.replace('/')
        })
        .catch((err: { message?: string }) => {
          setError(err.message || 'Sign-in failed. Please try again.')
        })
    } else {
      router.replace('/')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex flex-col items-center justify-center gap-3 px-6">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-red-500" />
        </div>
        <p className="text-sm text-[#717171] text-center max-w-xs">{error}</p>
        <button
          onClick={() => router.replace('/')}
          className="mt-2 px-6 py-3 bg-[#5BA4CF] text-white text-sm font-semibold rounded-xl"
        >
          Go Home
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#5BA4CF]" />
    </div>
  )
}

export default function AuthActionPage() {
  return (
    <Suspense>
      <AuthAction />
    </Suspense>
  )
}
