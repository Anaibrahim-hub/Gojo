'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''

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

export default function SettingsView() {
  const router = useRouter()
  const { user, photoURL, signOut, updateUserPhoto } = useAuth()
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)

  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [removingPhoto, setRemovingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false)

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return
    if (!WORKER_URL) { setPhotoError('Upload service not configured.'); return }
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
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Photo upload failed')
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleRemovePhoto() {
    setRemovingPhoto(true)
    setPhotoError(null)
    try {
      await updateUserPhoto(null)
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Failed to remove photo')
    } finally {
      setRemovingPhoto(false)
    }
  }

  return (
    <div className="size-full flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-100 px-4 lg:px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl transition-all flex-shrink-0">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Account Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Profile Photo */}
          {user && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-5">Profile Photo</h3>
              <div className="flex items-center gap-5">
                {/* Clickable avatar */}
                <label className={`relative cursor-pointer group flex-shrink-0 ${uploadingPhoto || removingPhoto ? 'pointer-events-none' : ''}`}>
                  <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-gray-100 shadow-md">
                    {photoURL && !photoLoadFailed ? (
                      <img
                        src={photoURL}
                        alt="Profile"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={() => setPhotoLoadFailed(true)}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <span className="text-white text-2xl font-bold select-none">
                          {getInitials(user.displayName, user.email)}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Hover overlay with camera icon */}
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploadingPhoto
                      ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                      : <Camera className="w-6 h-6 text-white" />
                    }
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto || removingPhoto}
                  />
                </label>

                <div>
                  <p className="font-semibold text-gray-900">{user.displayName || 'No name set'}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {uploadingPhoto ? 'Uploading…' : removingPhoto ? 'Removing…' : 'Click photo to change · JPEG, PNG, WebP'}
                  </p>
                  {photoURL && !uploadingPhoto && !removingPhoto && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="mt-2 text-xs text-red-500 hover:text-red-600 font-medium transition-colors"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </div>

              {photoError && (
                <div className="mt-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{photoError}
                </div>
              )}
            </div>
          )}

          {/* Account Info */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Account Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input type="text" defaultValue={user?.displayName ?? ''} placeholder="Your full name" className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input type="email" defaultValue={user?.email ?? ''} placeholder="your@email.com" className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input type="tel" placeholder="+251 91 000 0000" className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div><p className="font-medium text-gray-900">Email Notifications</p><p className="text-sm text-gray-500">Receive updates about new listings</p></div>
                <input type="checkbox" defaultChecked className="w-5 h-5 accent-blue-600" />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="font-medium text-gray-900">Price Drop Alerts</p><p className="text-sm text-gray-500">Get notified when prices drop</p></div>
                <input type="checkbox" defaultChecked className="w-5 h-5 accent-blue-600" />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="font-medium text-gray-900">New Listings in My Area</p><p className="text-sm text-gray-500">Be the first to see new properties</p></div>
                <input type="checkbox" defaultChecked className="w-5 h-5 accent-blue-600" />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="font-medium text-gray-900">Saved Search Alerts</p><p className="text-sm text-gray-500">Updates matching your saved searches</p></div>
                <input type="checkbox" className="w-5 h-5 accent-blue-600" />
              </div>
            </div>
          </div>

          {/* Privacy */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Privacy</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div><p className="font-medium text-gray-900">Show Profile to Agents</p><p className="text-sm text-gray-500">Allow agents to view your profile</p></div>
                <input type="checkbox" defaultChecked className="w-5 h-5 accent-blue-600" />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="font-medium text-gray-900">Share Activity Data</p><p className="text-sm text-gray-500">Help us improve recommendations</p></div>
                <input type="checkbox" className="w-5 h-5 accent-blue-600" />
              </div>
            </div>
          </div>

          {/* Deactivate Account */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Deactivate Account</h3>
            <p className="text-sm text-gray-500 mb-4">Deactivating your account will hide your profile and listings. You can reactivate at any time by signing back in.</p>
            {!showDeactivateConfirm ? (
              <button onClick={() => setShowDeactivateConfirm(true)} className="w-full border-2 border-red-200 text-red-600 hover:bg-red-50 py-3 rounded-lg font-semibold transition-all">
                Deactivate Account
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-800">Are you sure you want to deactivate your account?</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowDeactivateConfirm(false)} className="flex-1 border-2 border-gray-200 text-gray-700 hover:bg-gray-50 py-3 rounded-lg font-semibold transition-all">Cancel</button>
                  <button onClick={async () => { await signOut(); router.push('/'); }} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition-all">Yes, Deactivate</button>
                </div>
              </div>
            )}
          </div>

          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-all">
            Save Changes
          </button>

        </div>
      </div>
    </div>
  )
}
