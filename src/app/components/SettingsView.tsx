'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronRight, LogOut, Bell, Shield, FileText,
  UserCog, User, Home, Briefcase, Phone, UserX, Camera, Loader2, AlertCircle, Languages, X,
} from 'lucide-react'
import { verifyBeforeUpdateEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/lib/auth-context'
import SignInModal from './SignInModal'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''
const PHONE_KEY = (uid: string) => `profile_phone_${uid}`
const LANG_KEY = 'yevilla_language'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'am', label: 'አማርኛ (Amharic)' },
  { code: 'om', label: 'Afaan Oromoo' },
  { code: 'ti', label: 'ትግርኛ (Tigrinya)' },
] as const

function getInitials(displayName: string | null, email: string | null): string {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  }
  if (email) return email[0].toUpperCase()
  return '?'
}

function MenuRow({
  icon, label, onPress, destructive = false, isLast = false,
}: {
  icon: React.ReactNode
  label: string
  onPress: () => void
  destructive?: boolean
  isLast?: boolean
}) {
  return (
    <button
      onClick={onPress}
      className={`w-full flex items-center gap-3 px-5 py-4 bg-white text-left active:bg-gray-50 transition-colors ${!isLast ? 'border-b border-[#EBEBEB]' : ''}`}
    >
      <span className="w-9 flex justify-center flex-shrink-0">{icon}</span>
      <span className={`flex-1 text-[15px] font-medium ${destructive ? 'text-[#E53935]' : 'text-[#222222]'}`}>
        {label}
      </span>
      <ChevronRight className="w-4 h-4 text-[#BEBEBE] flex-shrink-0" />
    </button>
  )
}

export default function SettingsView() {
  const router = useRouter()
  const { user, photoURL, displayName, loading, signOut, updateUserPhoto, updateUserProfile } = useAuth()

  useEffect(() => {
    if (window.innerWidth >= 1024) { router.replace('/'); return }
    function onResize() { if (window.innerWidth >= 1024) router.replace('/') }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [router])

  const [isAgent, setIsAgent] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [showDeactivate, setShowDeactivate] = useState(false)
  const [showLangPicker, setShowLangPicker] = useState(false)
  const [language, setLanguageState] = useState('en')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Edit Profile state
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null)
  const [editPendingFile, setEditPendingFile] = useState<File | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const editFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem(LANG_KEY)
    if (stored) setLanguageState(stored)
  }, [])

  function setLanguage(code: string) {
    setLanguageState(code)
    localStorage.setItem(LANG_KEY, code)
    setShowLangPicker(false)
  }

  useEffect(() => {
    if (!user || !WORKER_URL) return
    user.getIdToken().then(token =>
      fetch(`${WORKER_URL}/listing`, { headers: { Authorization: `Bearer ${token}` } })
    ).then(async res => {
      if (!res.ok) return
      const data = await res.json() as { isAgent: boolean }
      setIsAgent(data.isAgent ?? false)
    }).catch(() => {})
  }, [user])

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user || !WORKER_URL) return
    setUploadingPhoto(true)
    setPhotoError(null)
    try {
      const token = await user.getIdToken()
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${WORKER_URL}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (!res.ok) throw new Error('Upload failed')
      const { url } = await res.json() as { url: string }
      await updateUserPhoto(url)
      setPhotoLoadFailed(false)
    } catch {
      setPhotoError('Photo upload failed. Please try again.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  function openEditProfile() {
    setEditName(user?.displayName ?? '')
    setEditEmail(user?.email ?? '')
    setEditPhone(user ? (localStorage.getItem(PHONE_KEY(user.uid)) ?? '') : '')
    setEditPhotoPreview(photoURL)
    setEditPendingFile(null)
    setEditError(null)
    setShowEditProfile(true)
  }

  function handleEditPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setEditPendingFile(file)
    setEditPhotoPreview(URL.createObjectURL(file))
  }

  async function handleEditSave() {
    if (!user || !auth.currentUser) return
    setEditSaving(true)
    setEditError(null)
    try {
      if (editPendingFile) {
        const token = await user.getIdToken()
        const fd = new FormData()
        fd.append('file', editPendingFile)
        const res = await fetch(`${WORKER_URL}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        })
        if (!res.ok) throw new Error('Photo upload failed. Please try again.')
        const { url } = await res.json() as { url: string }
        await updateUserPhoto(url)
        setEditPendingFile(null)
      }

      const nameChanged = editName.trim() !== (user.displayName ?? '')
      if (nameChanged) await updateUserProfile({ displayName: editName.trim() })

      const emailChanged = editEmail.trim().toLowerCase() !== (user.email ?? '').toLowerCase()
      if (emailChanged) {
        await verifyBeforeUpdateEmail(auth.currentUser, editEmail.trim())
        setEditError(`Verification link sent to ${editEmail.trim()}. Your email will update after you click it.`)
        localStorage.setItem(PHONE_KEY(user.uid), editPhone.trim())
        setEditSaving(false)
        return
      }

      localStorage.setItem(PHONE_KEY(user.uid), editPhone.trim())
      setShowEditProfile(false)
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string }
      setEditError(
        err.code === 'auth/requires-recent-login'
          ? 'For security, please sign out and sign back in before changing your email.'
          : (err.message || 'Something went wrong. Please try again.')
      )
    } finally {
      setEditSaving(false)
    }
  }

  async function handleSignOut() {
    if (!confirm('Are you sure you want to sign out?')) return
    try { await signOut() } catch {}
    router.push('/')
  }

  async function handleDeactivate() {
    if (!confirm('This will permanently delete your account and all associated data. This action cannot be undone.\n\nAre you sure?')) return
    try { await signOut() } catch {}
    router.push('/')
  }

  const [showSignIn, setShowSignIn] = useState(false)

  if (loading) return null

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex flex-col items-center justify-center gap-3 px-6">
        <div className="lg:hidden h-14 absolute top-0 left-0 right-0" />
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-2">
          <User className="w-8 h-8 text-[#717171]" />
        </div>
        <p className="text-lg font-bold text-[#222222]">Sign in to view your profile</p>
        <p className="text-sm text-[#717171] text-center">Create an account or sign in to manage your settings.</p>
        <button
          onClick={() => setShowSignIn(true)}
          className="mt-2 px-6 py-3 bg-[#5BA4CF] text-white text-sm font-semibold rounded-xl"
        >
          Sign In
        </button>
        <SignInModal open={showSignIn} onClose={() => setShowSignIn(false)} />
      </div>
    )
  }

  const initials = getInitials(displayName ?? user.displayName, user.email)
  const currentLang = LANGUAGES.find(l => l.code === language)?.label ?? 'English'

  return (
    <div className="min-h-screen bg-[#F7F7F7] lg:pb-10">

      {/* Desktop header */}
      <div className="hidden lg:flex sticky top-0 z-10 bg-white border-b border-[#EBEBEB] px-6 h-16 items-center">
        <h1 className="text-xl font-bold text-[#222222]">Profile</h1>
      </div>

      {/* Mobile: top padding for fixed header */}
      <div className="lg:hidden h-14" />

      <div className="max-w-lg mx-auto lg:px-0 py-2 space-y-2">

        {/* ── Profile card ── */}
        <div className="flex flex-col items-center pt-9 pb-6 gap-1">
          {/* Avatar */}
          <div className="relative mb-2">
            {/* Mobile: plain avatar, no camera overlay */}
            <div className="lg:hidden w-[88px] h-[88px] rounded-full overflow-hidden">
              {photoURL && !photoLoadFailed ? (
                <img
                  src={photoURL}
                  alt="Profile"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={() => setPhotoLoadFailed(true)}
                />
              ) : (
                <div className="w-full h-full bg-[#F7F7F7] flex items-center justify-center">
                  <span className="text-[28px] font-bold text-[#222222] select-none">{initials}</span>
                </div>
              )}
            </div>

            {/* Desktop: avatar with camera upload overlay */}
            <div className="hidden lg:block">
              <div className="w-[88px] h-[88px] rounded-full overflow-hidden ring-2 ring-white shadow-md">
                {photoURL && !photoLoadFailed ? (
                  <img
                    src={photoURL}
                    alt="Profile"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={() => setPhotoLoadFailed(true)}
                  />
                ) : (
                  <div className="w-full h-full bg-[#F7F7F7] flex items-center justify-center">
                    <span className="text-[28px] font-bold text-[#222222] select-none">{initials}</span>
                  </div>
                )}
              </div>
              <label className={`absolute inset-0 rounded-full flex items-center justify-center cursor-pointer ${uploadingPhoto ? 'bg-black/40' : 'bg-transparent hover:bg-black/25 transition-colors'}`}>
                {uploadingPhoto
                  ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                  : <Camera className="w-5 h-5 text-white opacity-0 hover:opacity-100 transition-opacity" />
                }
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                />
              </label>
            </div>
          </div>

          <p className="text-[22px] font-extrabold text-[#222222] tracking-tight">{displayName ?? user.displayName ?? 'User'}</p>
          <p className="text-sm text-[#717171]">{user.email}</p>

          {isAgent && (
            <span className="mt-1.5 bg-[#5BA4CF] text-white text-[11px] font-extrabold px-3 py-0.5 rounded-full tracking-wide">
              Agent
            </span>
          )}

          {photoError && (
            <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl px-4 py-2.5 w-full max-w-xs mx-4">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{photoError}
            </div>
          )}
        </div>

        {/* ── Role-specific section (buyers only) ── */}
        {!isAgent && (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm mx-4 lg:mx-0">
            <MenuRow
              icon={<Home className="w-[18px] h-[18px] text-[#222222]" />}
              label="Sell My Home"
              onPress={() => router.push('/sell-my-home')}
            />
            <MenuRow
              icon={<Briefcase className="w-[18px] h-[18px] text-[#222222]" />}
              label="Become an Agent"
              onPress={() => router.push('/become-an-agent')}
              isLast
            />
          </div>
        )}

        {/* ── Shared settings ── */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm mx-4 lg:mx-0">
          <MenuRow
            icon={<UserCog className="w-[18px] h-[18px] text-[#222222]" />}
            label="Edit Profile"
            onPress={openEditProfile}
          />
          <MenuRow
            icon={<Bell className="w-[18px] h-[18px] text-[#222222]" />}
            label="Notifications"
            onPress={() => {}}
          />
          <MenuRow
            icon={<Languages className="w-[18px] h-[18px] text-[#222222]" />}
            label={`Language — ${currentLang}`}
            onPress={() => setShowLangPicker(true)}
          />
          <MenuRow
            icon={<Phone className="w-[18px] h-[18px] text-[#222222]" />}
            label="Contact Us"
            onPress={() => router.push('/contact')}
          />
          <MenuRow
            icon={<Shield className="w-[18px] h-[18px] text-[#222222]" />}
            label="Privacy Policy"
            onPress={() => router.push('/privacy')}
          />
          <MenuRow
            icon={<FileText className="w-[18px] h-[18px] text-[#222222]" />}
            label="Terms of Service"
            onPress={() => router.push('/terms')}
            isLast
          />
        </div>

        {/* ── Danger section ── */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm mx-4 lg:mx-0">
          <MenuRow
            icon={<LogOut className="w-[18px] h-[18px] text-[#E53935]" />}
            label="Sign out"
            onPress={handleSignOut}
            destructive
          />
          <MenuRow
            icon={<UserX className="w-[18px] h-[18px] text-[#E53935]" />}
            label="Deactivate Account"
            onPress={() => setShowDeactivate(true)}
            destructive
            isLast
          />
        </div>

        {/* Mobile bottom-nav spacer */}
        <div className="lg:hidden" style={{ height: 'calc(5rem + env(safe-area-inset-bottom))' }} />

      </div>

      {/* ── Edit Profile sheet ── */}
      {showEditProfile && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => !editSaving && setShowEditProfile(false)} />
          <div className="relative z-10 bg-white w-full max-w-lg rounded-t-2xl lg:rounded-2xl overflow-hidden shadow-2xl">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-0 lg:hidden" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#EBEBEB]">
              <button
                onClick={() => setShowEditProfile(false)}
                disabled={editSaving}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors disabled:opacity-40"
              >
                <X className="w-4 h-4 text-[#222222]" />
              </button>
              <p className="text-[15px] font-bold text-[#222222]">Edit Profile</p>
              <button
                onClick={handleEditSave}
                disabled={editSaving}
                className="px-4 py-1.5 bg-[#5BA4CF] text-white text-sm font-bold rounded-full min-w-[60px] flex items-center justify-center disabled:opacity-60"
              >
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </button>
            </div>

            <div className="overflow-y-auto max-h-[75vh] lg:max-h-[80vh]">
              {/* Avatar */}
              <div className="flex flex-col items-center pt-6 pb-4 gap-2">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full overflow-hidden">
                    {editPhotoPreview ? (
                      <img src={editPhotoPreview} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#5BA4CF] flex items-center justify-center">
                        <span className="text-[28px] font-bold text-white select-none">{initials}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => editFileInputRef.current?.click()}
                    disabled={editSaving}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-[#5BA4CF] rounded-full flex items-center justify-center border-2 border-white disabled:opacity-60"
                  >
                    <Camera className="w-4 h-4 text-white" />
                  </button>
                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleEditPhotoSelect}
                    disabled={editSaving}
                  />
                </div>
                <button
                  onClick={() => editFileInputRef.current?.click()}
                  disabled={editSaving}
                  className="text-sm font-medium text-[#5BA4CF] disabled:opacity-60"
                >
                  Change photo
                </button>
              </div>

              {/* Form fields */}
              <div className="px-4 pb-2">
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#EBEBEB]">
                  <div className="px-4 py-3.5">
                    <label className="block text-[11px] font-semibold text-[#717171] uppercase tracking-wider mb-1.5">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="Your name"
                      className="w-full text-[15px] text-[#222222] outline-none bg-transparent placeholder:text-[#BEBEBE]"
                      disabled={editSaving}
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
                      value={editEmail}
                      onChange={e => setEditEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full text-[15px] text-[#222222] outline-none bg-transparent placeholder:text-[#BEBEBE]"
                      disabled={editSaving}
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
                      value={editPhone}
                      onChange={e => setEditPhone(e.target.value)}
                      placeholder="+251 9XX XXX XXX"
                      className="w-full text-[15px] text-[#222222] outline-none bg-transparent placeholder:text-[#BEBEBE]"
                      disabled={editSaving}
                    />
                  </div>
                </div>
              </div>

              {editError && (
                <div className={`mx-4 mt-2 mb-2 flex items-start gap-2 text-xs rounded-xl px-4 py-2.5 ${editError.startsWith('Verification') ? 'bg-blue-50 border border-blue-100 text-blue-700' : 'bg-red-50 border border-red-100 text-red-600'}`}>
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              <p className="text-xs text-[#BEBEBE] text-center px-8 py-4">
                Changing your email sends a verification link to the new address.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Language picker sheet ── */}
      {showLangPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowLangPicker(false)} />
          <div className="relative z-10 bg-white w-full max-w-lg rounded-t-2xl lg:rounded-2xl lg:mb-8 overflow-hidden shadow-2xl">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-1 lg:hidden" />
            <div className="px-5 pt-4 pb-3 border-b border-[#EBEBEB]">
              <p className="text-[15px] font-bold text-[#222222]">Select Language</p>
            </div>
            {LANGUAGES.map((lang, i) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors active:bg-gray-50 ${i < LANGUAGES.length - 1 ? 'border-b border-[#EBEBEB]' : ''}`}
              >
                <span className={`text-[15px] font-medium ${lang.code === language ? 'text-[#5BA4CF]' : 'text-[#222222]'}`}>
                  {lang.label}
                </span>
                {lang.code === language && (
                  <span className="text-[#5BA4CF] text-lg font-bold">✓</span>
                )}
              </button>
            ))}
            <button
              onClick={() => setShowLangPicker(false)}
              className="w-full py-4 text-[15px] font-semibold text-[#717171] border-t border-[#EBEBEB]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Deactivate confirm sheet ── */}
      {showDeactivate && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeactivate(false)} />
          <div className="relative z-10 bg-white w-full max-w-sm mx-4 mb-4 lg:mb-0 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-[#222222] mb-2">Deactivate Account</h3>
            <p className="text-sm text-[#717171] mb-6 leading-relaxed">
              This will permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeactivate(false)}
                className="flex-1 py-3 border border-[#EBEBEB] rounded-xl text-sm font-semibold text-[#222222]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                className="flex-1 py-3 bg-[#E53935] rounded-xl text-sm font-semibold text-white"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
