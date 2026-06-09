'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, Loader2, AlertCircle } from 'lucide-react'
import { verifyBeforeUpdateEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/lib/auth-context'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''
const PHONE_KEY = (uid: string) => `profile_phone_${uid}`

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  }
  if (email) return email[0].toUpperCase()
  return '?'
}

export default function EditProfileView() {
  const router = useRouter()
  const { user, photoURL, displayName, loading, updateUserPhoto, updateUserProfile } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    setName(user.displayName ?? '')
    setEmail(user.email ?? '')
    setPhone(localStorage.getItem(PHONE_KEY(user.uid)) ?? '')
    setPhotoPreview(photoURL)
  }, [user, photoURL])

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPendingFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!user || !auth.currentUser) return
    setSaving(true)
    setError(null)
    setInfo(null)
    try {
      if (pendingFile) {
        const token = await user.getIdToken()
        const fd = new FormData()
        fd.append('file', pendingFile)
        const res = await fetch(`${WORKER_URL}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        })
        if (!res.ok) throw new Error('Photo upload failed. Please try again.')
        const { url } = await res.json() as { url: string }
        await updateUserPhoto(url)
        setPendingFile(null)
      }

      const nameChanged = name.trim() !== (user.displayName ?? '')
      if (nameChanged) await updateUserProfile({ displayName: name.trim() })

      const emailChanged = email.trim().toLowerCase() !== (user.email ?? '').toLowerCase()
      if (emailChanged) {
        await verifyBeforeUpdateEmail(auth.currentUser, email.trim())
        localStorage.setItem(PHONE_KEY(user.uid), phone.trim())
        setInfo(`Verification link sent to ${email.trim()}. Your email will update after you click it.`)
        setSaving(false)
        return
      }

      localStorage.setItem(PHONE_KEY(user.uid), phone.trim())
      router.back()
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string }
      setError(
        err.code === 'auth/requires-recent-login'
          ? 'For security, please sign out and sign back in before changing your email.'
          : (err.message || 'Something went wrong. Please try again.')
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  if (!user) {
    router.replace('/settings')
    return null
  }

  const initials = getInitials(displayName ?? user.displayName, user.email)

  return (
    <div className="min-h-screen bg-[#F7F7F7]">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#EBEBEB] px-4 h-14 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          disabled={saving}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-[#F7F7F7] hover:bg-gray-100 transition-colors disabled:opacity-40"
        >
          <ArrowLeft className="w-5 h-5 text-[#222222]" />
        </button>
        <p className="text-[16px] font-bold text-[#222222]">Edit Profile</p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 bg-[#5BA4CF] text-white text-sm font-bold rounded-full min-w-[60px] flex items-center justify-center disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">

        {/* Avatar */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden">
              {photoPreview ? (
                <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#5BA4CF] flex items-center justify-center">
                  <span className="text-[28px] font-bold text-white select-none">{initials}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              className="absolute bottom-0 right-0 w-8 h-8 bg-[#5BA4CF] rounded-full flex items-center justify-center border-2 border-white shadow-sm disabled:opacity-60"
            >
              <Camera className="w-4 h-4 text-white" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoSelect}
              disabled={saving}
            />
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
            className="text-sm font-medium text-[#5BA4CF] disabled:opacity-60"
          >
            Change photo
          </button>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3.5">
            <label className="block text-[11px] font-semibold text-[#717171] uppercase tracking-wider mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className="w-full text-[15px] text-[#222222] outline-none bg-transparent placeholder:text-[#BEBEBE]"
              disabled={saving}
              autoCorrect="off"
            />
          </div>
          <div className="h-px bg-[#EBEBEB] mx-4" />
          <div className="px-4 py-3.5">
            <label className="block text-[11px] font-semibold text-[#717171] uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full text-[15px] text-[#222222] outline-none bg-transparent placeholder:text-[#BEBEBE]"
              disabled={saving}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          <div className="h-px bg-[#EBEBEB] mx-4" />
          <div className="px-4 py-3.5">
            <label className="block text-[11px] font-semibold text-[#717171] uppercase tracking-wider mb-1.5">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+251 9XX XXX XXX"
              className="w-full text-[15px] text-[#222222] outline-none bg-transparent placeholder:text-[#BEBEBE]"
              disabled={saving}
            />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-sm rounded-2xl px-4 py-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {info && (
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 text-blue-700 text-sm rounded-2xl px-4 py-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{info}</span>
          </div>
        )}

        <p className="text-xs text-[#BEBEBE] text-center px-4">
          Changing your email sends a verification link to the new address.
        </p>

        {/* Mobile bottom-nav spacer */}
        <div className="lg:hidden" style={{ height: 'calc(4rem + env(safe-area-inset-bottom))' }} />
      </div>
    </div>
  )
}
