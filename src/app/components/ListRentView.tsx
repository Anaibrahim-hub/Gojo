'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Loader2, AlertCircle, LogIn, Home, BedDouble, Bath, Ruler, Edit2, Upload, X, Eye, Heart, Video } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import SignInModal from './SignInModal'
import { formatETB } from '@/app/components/ui/utils'
import { rentUnit } from '@/lib/listing-utils'

const AMENITIES = [
  'Parking', 'Laundry', 'Pet Friendly', 'Generator',
  'Security Guard', 'Water Tank', 'Elevator', 'Furnished',
]

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''

async function compressImage(file: File): Promise<File> {
  if (file.size < 300 * 1024) return file
  return new Promise((resolve) => {
    const img = new Image()
    const blobUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(blobUrl)
      const MAX = 1080
      const scale = Math.min(1, MAX / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => resolve(
          blob
            ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
            : file
        ),
        'image/jpeg', 0.75
      )
    }
    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(file) }
    img.src = blobUrl
  })
}

function xhrUpload(
  url: string, body: FormData, token: string,
  onProgress: (pct: number) => void
): Promise<{ url: string; key: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 95))
    }
    xhr.onload = () => {
      onProgress(100)
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)) }
        catch { reject(new Error('Invalid response from server')) }
      } else {
        try { reject(new Error(JSON.parse(xhr.responseText).error || 'Upload failed')) }
        catch { reject(new Error(`Upload failed (${xhr.status})`)) }
      }
    }
    xhr.onerror = () => reject(new Error('Network error — check your connection'))
    xhr.ontimeout = () => reject(new Error('Upload timed out'))
    xhr.timeout = 60000
    xhr.send(body)
  })
}

// PUTs the file straight to R2 through a presigned URL (no worker size cap).
// The Content-Type must match what the URL was signed for.
function xhrPut(url: string, file: File, contentType: string, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 90))
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)))
    xhr.onerror = () => reject(new Error('Network error — check your connection'))
    xhr.ontimeout = () => reject(new Error('Upload timed out'))
    xhr.timeout = 60 * 60 * 1000
    xhr.send(file)
  })
}

// 1) ask the worker for an upload URL, 2) upload to R2, 3) have the worker verify
// the stored file (type + 60-second limit) before it can be attached to a listing.
async function uploadVideo(
  file: File, contentType: string, token: string,
  onProgress: (pct: number) => void
): Promise<{ url: string; key: string }> {
  const call = async (path: string, body: unknown) => {
    const res = await fetch(`${WORKER_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`)
    return data
  }
  const { uploadUrl, key } = await call('/video/upload-url', { contentType, size: file.size }) as { uploadUrl: string; key: string }
  await xhrPut(uploadUrl, file, contentType, onProgress)
  onProgress(95)
  const verified = await call('/video/complete', { key }) as { url: string; key: string }
  onProgress(100)
  return { url: verified.url, key: verified.key }
}

const RATE_LABEL = { month: 'Monthly Rent', night: 'Nightly Rate', day: 'Daily Rate' } as const
const RATE_SUFFIX = { month: '/mo', night: '/night', day: '/day' } as const

// Formats the worker can verify. Some systems leave file.type empty (e.g. .mkv),
// so fall back to the file extension.
const VIDEO_TYPE_BY_EXT: Record<string, string> = {
  mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v', '3gp': 'video/3gpp',
  '3g2': 'video/3gpp2', webm: 'video/webm', mkv: 'video/x-matroska',
}
const VIDEO_TYPES = new Set(Object.values(VIDEO_TYPE_BY_EXT))
function videoContentType(file: File): string | null {
  if (VIDEO_TYPES.has(file.type)) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return VIDEO_TYPE_BY_EXT[ext] ?? null
}
const MAX_VIDEO_MB = 500
const MAX_VIDEO_SECONDS = 60

// Reads a local video file's length (seconds) before uploading it.
function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration) }
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')) }
    v.src = url
  })
}

interface ImageEntry {
  id: string
  uploading: boolean
  progress: number
  url: string
  key: string
  preview: string
}

interface ListingData {
  id: string
  city: string; subCity: string; woreda: string; kebele: string; landmark: string
  lat: number | null; lng: number | null
  propertyType: string
  listingType: 'rent' | 'sale'
  monthlyRent: number | null
  salePrice: number | null
  bedrooms: number | null
  bathrooms: number | null; areaSqm: number | null; availableFrom: string | null
  description: string; amenities: string[]
  photos: { url: string; key: string }[]
  video?: { url: string; key: string } | null
  status: string
  viewCount?: number
  likeCount?: number
}

const EMPTY_FORM = {
  city: '', subCity: '', woreda: '', kebele: '', landmark: '',
  propertyType: '', listingType: 'rent' as 'rent' | 'sale',
  monthlyRent: '', salePrice: '',
  bedrooms: '', bathrooms: '',
  areaSqm: '', availableFrom: '', description: '',
}

export default function ListRentView() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [signInOpen, setSignInOpen] = useState(false)

  const [checkingListing, setCheckingListing] = useState(true)
  const [listings, setListings] = useState<ListingData[]>([])
  const [isAgent, setIsAgent] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [images, setImages] = useState<ImageEntry[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [video, setVideo] = useState<{ url: string; key: string } | null>(null)
  // Key of the video already saved on the listing being edited; removing it only
  // takes effect (and deletes the file) when the listing is saved.
  const [savedVideoKey, setSavedVideoKey] = useState<string | null>(null)
  const [videoProgress, setVideoProgress] = useState<number | null>(null)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [amenities, setAmenities] = useState<Record<string, boolean>>(
    Object.fromEntries(AMENITIES.map((a) => [a, false]))
  )
  // Not editable on the form; kept so saving an older listing doesn't clear its coordinates
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const setField = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))

  useEffect(() => {
    if (!user) { setListings([]); setIsAgent(false); setCheckingListing(false); return }
    setCheckingListing(true)
    user.getIdToken()
      .then(token =>
        fetch(`${WORKER_URL}/listing`, { headers: { Authorization: `Bearer ${token}` } })
      )
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load listings')
        const data = await res.json() as { listings: ListingData[]; isAgent: boolean }
        setListings(data.listings ?? [])
        setIsAgent(data.isAgent ?? false)
      })
      .catch(() => { setListings([]); setIsAgent(false) })
      .finally(() => setCheckingListing(false))
  }, [user])

  function enterEditMode(listing: ListingData) {
    setForm({
      city: listing.city ?? '',
      subCity: listing.subCity ?? '',
      woreda: listing.woreda ?? '',
      kebele: listing.kebele ?? '',
      landmark: listing.landmark ?? '',
      propertyType: listing.propertyType ?? '',
      listingType: listing.listingType ?? 'rent',
      monthlyRent: listing.monthlyRent != null ? String(listing.monthlyRent) : '',
      salePrice: listing.salePrice != null ? String(listing.salePrice) : '',
      bedrooms: listing.bedrooms != null ? String(listing.bedrooms) : '',
      bathrooms: listing.bathrooms != null ? String(listing.bathrooms) : '',
      areaSqm: listing.areaSqm != null ? String(listing.areaSqm) : '',
      availableFrom: listing.availableFrom ?? '',
      description: listing.description ?? '',
    })
    setLat(listing.lat != null ? String(listing.lat) : '')
    setLng(listing.lng != null ? String(listing.lng) : '')
    setAmenities(Object.fromEntries(AMENITIES.map(a => [a, listing.amenities?.includes(a) ?? false])))
    setImages(
      (listing.photos ?? []).map(p => ({
        id: crypto.randomUUID(),
        uploading: false, progress: 100,
        url: p.url, key: p.key, preview: '',
      }))
    )
    setVideo(listing.video ?? null)
    setSavedVideoKey(listing.video?.key ?? null)
    setVideoError(null)
    setEditingId(listing.id)
    setSubmitError(null)
    setIsEditing(true)
  }

  function exitForm() {
    setIsEditing(false)
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setImages([])
    setVideo(null)
    setSavedVideoKey(null)
    setVideoProgress(null)
    setVideoError(null)
    setAmenities(Object.fromEntries(AMENITIES.map((a) => [a, false])))
    setLat(''); setLng('')
    setSubmitError(null)
  }

  function validateForm(): string | null {
    if (!form.city) return 'Please select a city.'
    if (!form.propertyType) return 'Please select a property type.'
    if (form.listingType === 'rent') {
      const rateLabel = RATE_LABEL[rentUnit(form.propertyType)].toLowerCase()
      if (!form.monthlyRent || parseFloat(form.monthlyRent) <= 0) return `Please enter a valid ${rateLabel}.`
      if (parseFloat(form.monthlyRent) > 100_000_000) return `The ${rateLabel} exceeds the maximum allowed value.`
    } else {
      if (!form.salePrice || parseFloat(form.salePrice) <= 0) return 'Please enter a valid sale price.'
      if (parseFloat(form.salePrice) > 1_000_000_000) return 'Sale price exceeds the maximum allowed value.'
    }
    if (form.bedrooms && (parseInt(form.bedrooms) < 0 || parseInt(form.bedrooms) > 50)) return 'Bedrooms must be between 0 and 50.'
    if (form.bathrooms && (parseInt(form.bathrooms) < 0 || parseInt(form.bathrooms) > 50)) return 'Bathrooms must be between 0 and 50.'
    if (form.areaSqm && (parseFloat(form.areaSqm) <= 0 || parseFloat(form.areaSqm) > 50_000)) return 'Area must be between 1 and 50,000 m².'
    if (form.description.length > 2000) return 'Description must be 2,000 characters or less.'
    if (form.landmark.length > 200) return 'Landmark must be 200 characters or less.'
    if (images.filter(img => !img.uploading).length === 0) return 'Please upload at least one photo of your property.'
    return null
  }

  async function handleSubmit() {
    if (!user) { setSignInOpen(true); return }
    const validationError = validateForm()
    if (validationError) { setSubmitError(validationError); return }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const body = {
        listingId: editingId ?? undefined,
        ownerEmail: user.email ?? null,
        ownerDisplayName: user.displayName ?? null,
        ownerPhotoURL: user.photoURL ?? null,
        city: form.city, subCity: form.subCity, woreda: form.woreda,
        kebele: form.kebele, landmark: form.landmark,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        propertyType: form.propertyType,
        listingType: form.listingType,
        monthlyRent: form.listingType === 'rent' && form.monthlyRent ? parseFloat(form.monthlyRent) : null,
        salePrice: form.listingType === 'sale' && form.salePrice ? parseFloat(form.salePrice) : null,
        bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
        bathrooms: form.bathrooms ? parseInt(form.bathrooms) : null,
        areaSqm: form.areaSqm ? parseFloat(form.areaSqm) : null,
        availableFrom: form.availableFrom || null,
        description: form.description,
        amenities: Object.entries(amenities).filter(([, v]) => v).map(([k]) => k),
        photos: images.filter(img => !img.uploading).map(img => ({ url: img.url, key: img.key })),
        video,
      }
      const token = await user.getIdToken()
      const res = await fetch(`${WORKER_URL}/listing`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? 'Failed to save')
      }
      const saved = await res.json() as ListingData
      setListings(prev => {
        const idx = prev.findIndex(l => l.id === saved.id)
        if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
        return [saved, ...prev]
      })
      exitForm()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function confirmDelete(listing: ListingData) {
    setDeletingId(listing.id)
    setDeleteError(null)
    setShowDeleteConfirm(true)
  }

  async function handleDeleteListing() {
    if (!user || !WORKER_URL || !deletingId) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const token = await user.getIdToken()
      const url = `${WORKER_URL}/listing?id=${encodeURIComponent(deletingId)}`
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? 'Failed to delete listing')
      }
      setListings(prev => prev.filter(l => l.id !== deletingId))
      setShowDeleteConfirm(false)
      setDeletingId(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete listing.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const toConsider = Array.from(e.target.files ?? [])
    e.target.value = ''
    const remaining = 10 - images.length
    const toAdd = toConsider.slice(0, remaining)
    if (!toAdd.length) return
    if (!user) { setSignInOpen(true); return }
    if (!WORKER_URL) { setUploadError('Upload service not configured.'); return }
    setUploadError(null)
    const placeholders: ImageEntry[] = toAdd.map(f => ({
      id: crypto.randomUUID(), uploading: true, progress: 0,
      preview: URL.createObjectURL(f), url: '', key: '',
    }))
    setImages(prev => [...prev, ...placeholders])
    const [token, compressed] = await Promise.all([
      user.getIdToken(),
      Promise.all(toAdd.map(f => compressImage(f))),
    ])
    await Promise.all(
      compressed.map(async (file, i) => {
        const pid = placeholders[i].id
        const fd = new FormData()
        fd.append('file', file)
        try {
          const { url, key } = await xhrUpload(
            `${WORKER_URL}/upload`, fd, token,
            (pct) => setImages(prev => {
              const idx = prev.findIndex(img => img.id === pid)
              if (idx === -1) return prev
              const u = [...prev]; u[idx] = { ...u[idx], progress: pct }; return u
            })
          )
          setImages(prev => {
            const idx = prev.findIndex(img => img.id === pid)
            if (idx === -1) return prev
            const u = [...prev]
            URL.revokeObjectURL(u[idx].preview)
            u[idx] = { id: pid, uploading: false, progress: 100, url, key, preview: '' }
            return u
          })
        } catch (err) {
          setUploadError(err instanceof Error ? err.message : 'Upload failed')
          setImages(prev => {
            const idx = prev.findIndex(img => img.id === pid)
            if (idx === -1) return prev
            const u = [...prev]
            URL.revokeObjectURL(u[idx].preview)
            u.splice(idx, 1); return u
          })
        }
      })
    )
  }

  async function removeImage(index: number) {
    const entry = images[index]
    if (!entry || entry.uploading) return
    setImages(prev => prev.filter((_, i) => i !== index))
    if (user && WORKER_URL && entry.key) {
      const token = await user.getIdToken()
      fetch(`${WORKER_URL}/image/${encodeURIComponent(entry.key)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      }).catch(console.error)
    }
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!user) { setSignInOpen(true); return }
    if (!WORKER_URL) { setVideoError('Upload service not configured.'); return }
    const contentType = videoContentType(file)
    if (!contentType) { setVideoError('Please choose a video file (MP4, MOV, 3GP, WebM, or MKV).'); return }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setVideoError(`Video is ${Math.ceil(file.size / 1024 / 1024)} MB — the limit is ${MAX_VIDEO_MB} MB.`)
      return
    }
    const seconds = await readVideoDuration(file).catch(() => null)
    if (seconds !== null && Number.isFinite(seconds) && seconds > MAX_VIDEO_SECONDS + 0.5) {
      setVideoError(`Video is ${Math.round(seconds)} seconds long — the limit is ${MAX_VIDEO_SECONDS} seconds. Please trim it and try again.`)
      return
    }
    setVideoError(null)
    setVideoProgress(0)
    try {
      const token = await user.getIdToken()
      const uploaded = await uploadVideo(file, contentType, token, setVideoProgress)
      discardUnsavedVideo()
      setVideo(uploaded)
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setVideoProgress(null)
    }
  }

  // Deletes the current video from storage if it was uploaded in this session and
  // never saved to the listing (a saved one is cleaned up by the server on save).
  function discardUnsavedVideo() {
    const key = video?.key
    if (!key || key === savedVideoKey || !user || !WORKER_URL) return
    user.getIdToken().then(token =>
      fetch(`${WORKER_URL}/image/${encodeURIComponent(key)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
    ).catch(console.error)
  }

  function removeVideo() {
    discardUnsavedVideo()
    setVideo(null)
  }

  const uploadingCount = images.filter(i => i.uploading).length
  const readyCount = images.filter(i => !i.uploading).length

  function toggleAmenity(name: string) {
    setAmenities((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  const canAddMore = isAgent || listings.length === 0

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (authLoading || checkingListing) {
    return (
      <div className="size-full flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-gray-400 animate-spin" />
      </div>
    )
  }

  // ── Form view ────────────────────────────────────────────────────────────────

  if (showForm || isEditing) {
    const isSale = form.listingType === 'sale'
    return (
      <div className="size-full flex flex-col">
        <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-4 lg:px-6 h-14 flex items-center gap-3 sticky top-0 z-10 flex-shrink-0">
          <button
            onClick={exitForm}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-all flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="text-base font-bold text-gray-900">
            {isEditing ? 'Edit Listing' : 'New Listing'}
          </span>
        </div>

        {!user && (
          <div className="bg-gray-50 border-b border-gray-100 px-4 lg:px-6 py-3 flex items-center justify-between gap-3 flex-shrink-0">
            <p className="text-sm text-gray-600">Sign in to publish your listing and upload photos.</p>
            <button
              onClick={() => setSignInOpen(true)}
              className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-full transition-all flex-shrink-0"
            >
              <LogIn className="w-4 h-4" /> Sign in
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-6 lg:px-6">
          <div className="max-w-2xl mx-auto space-y-4">

            {/* Photos */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Property Photos <span className="text-red-500">*</span></p>
                <span className="text-sm text-gray-400">{readyCount}/10</span>
              </div>

              {uploadError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{uploadError}
                </div>
              )}

              {images.length < 10 && (
                user ? (
                  <label className="flex flex-col items-center justify-center w-full h-36 border border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-gray-500 hover:bg-gray-50 transition-all mb-4">
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 font-medium">Click to upload images</p>
                    <p className="text-xs text-gray-400 mt-0.5">{images.length}/10 · JPEG, PNG, WebP</p>
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleImageUpload} />
                  </label>
                ) : (
                  <button type="button" onClick={() => setSignInOpen(true)}
                    className="flex flex-col items-center justify-center w-full h-36 border border-dashed border-gray-300 rounded-xl hover:border-gray-500 hover:bg-gray-50 transition-all mb-4">
                    <LogIn className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 font-medium">Sign in to upload photos</p>
                  </button>
                )
              )}

              {images.length > 0 && (
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                  {images.map((entry, i) => {
                    if (entry.uploading) {
                      return (
                        <div key={entry.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                          <img src={entry.preview} alt="Uploading…" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3">
                            <span className="text-xs font-bold text-gray-600">{entry.progress}%</span>
                            <div className="w-full bg-gray-200 rounded-full h-1">
                              <div className="bg-gray-900 h-1 rounded-full transition-all duration-200" style={{ width: `${entry.progress}%` }} />
                            </div>
                          </div>
                        </div>
                      )
                    }
                    return (
                      <div key={entry.id} className="relative aspect-square rounded-xl overflow-hidden group border border-gray-100">
                        <img src={entry.url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                        {i === 0 && (
                          <span className="absolute bottom-1.5 left-1.5 bg-gray-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Cover</span>
                        )}
                        <button
                          onClick={() => removeImage(i)}
                          className="absolute top-1.5 right-1.5 bg-black/40 hover:bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Video tour */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Video Tour <span className="font-medium normal-case tracking-normal">(optional)</span></p>
              </div>
              <p className="text-sm text-gray-500 mb-4">A short walkthrough plays first when people open your listing. Any video up to {MAX_VIDEO_SECONDS} seconds long.</p>

              {videoError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{videoError}
                </div>
              )}

              {videoProgress !== null ? (
                <div className="flex flex-col items-center justify-center gap-2 w-full h-36 border border-gray-200 rounded-xl px-6">
                  <span className="text-sm font-bold text-gray-700">Uploading video… {videoProgress}%</span>
                  <div className="w-full max-w-xs bg-gray-200 rounded-full h-1.5">
                    <div className="bg-gray-900 h-1.5 rounded-full transition-all duration-200" style={{ width: `${videoProgress}%` }} />
                  </div>
                  <span className="text-xs text-gray-400">Keep this page open until it finishes.</span>
                </div>
              ) : video ? (
                <div className="relative w-full max-w-sm rounded-xl overflow-hidden border border-gray-100 bg-black group">
                  <video src={video.url} controls playsInline preload="metadata" className="w-full aspect-video object-contain" />
                  <button
                    type="button"
                    onClick={removeVideo}
                    aria-label="Remove video"
                    className="absolute top-2 right-2 bg-black/50 hover:bg-red-500 text-white p-1.5 rounded-full transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : user ? (
                <label className="flex flex-col items-center justify-center w-full h-36 border border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-gray-500 hover:bg-gray-50 transition-all">
                  <Video className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 font-medium">Click to upload a video</p>
                  <p className="text-xs text-gray-400 mt-0.5">Up to {MAX_VIDEO_SECONDS} seconds</p>
                  <input type="file" accept="video/*,.mkv,.3gp" className="hidden" onChange={handleVideoUpload} />
                </label>
              ) : (
                <button type="button" onClick={() => setSignInOpen(true)}
                  className="flex flex-col items-center justify-center w-full h-36 border border-dashed border-gray-300 rounded-xl hover:border-gray-500 hover:bg-gray-50 transition-all">
                  <LogIn className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 font-medium">Sign in to upload a video</p>
                </button>
              )}
            </div>

            {/* Location */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Location</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">City</label>
                  <select value={form.city} onChange={setField('city')} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-900 bg-white text-sm">
                    <option value="">Select city</option>
                    {['Addis Ababa','Dire Dawa','Hawassa','Mekelle','Gondar','Bahir Dar','Adama','Bishoftu','Jimma','Dessie','Jijiga','Other'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Sub-city</label>
                  <input type="text" value={form.subCity} onChange={setField('subCity')} placeholder="e.g. Bole, Kirkos, Yeka" maxLength={100} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-900 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Woreda</label>
                  <input type="text" value={form.woreda} onChange={setField('woreda')} placeholder="e.g. Woreda 03" maxLength={100} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-900 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Kebele</label>
                  <input type="text" value={form.kebele} onChange={setField('kebele')} placeholder="e.g. 01" maxLength={100} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-900 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Landmark / Area Description</label>
                <input type="text" value={form.landmark} onChange={setField('landmark')} placeholder="e.g. Near Bole Atlas Hotel, behind the blue building" maxLength={200} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-900 text-sm" />
              </div>
            </div>

            {/* Property Details */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Property Details</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Property Type</label>
                  <select
                    value={form.propertyType}
                    onChange={e => {
                      const propertyType = e.target.value
                      // Hotels and event venues are priced per night / per day and never sold
                      setForm(prev => ({ ...prev, propertyType, listingType: rentUnit(propertyType) === 'month' ? prev.listingType : 'rent' }))
                    }}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-900 bg-white text-sm">
                    <option value="">Select type</option>
                    {['House (ቤት)','Apartment / Condominium','Studio','Villa','Townhouse','Commercial Space','Hotel','Event Venue'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {isSale ? 'Sale Price (Br)' : `${RATE_LABEL[rentUnit(form.propertyType)]} (Br)`}
                  </label>
                  {isSale ? (
                    <input type="number" value={form.salePrice} onChange={setField('salePrice')} placeholder="e.g. 4500000" min={0} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-900 text-sm" />
                  ) : (
                    <input type="number" value={form.monthlyRent} onChange={setField('monthlyRent')} placeholder="e.g. 25000" min={0} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-900 text-sm" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Bedrooms</label>
                  <input type="number" value={form.bedrooms} onChange={setField('bedrooms')} placeholder="e.g. 3" min={0} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-900 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Bathrooms</label>
                  <input type="number" value={form.bathrooms} onChange={setField('bathrooms')} placeholder="e.g. 2" min={0} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-900 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Area (m²)</label>
                  <input type="number" value={form.areaSqm} onChange={setField('areaSqm')} placeholder="e.g. 120" min={0} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-900 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Available From</label>
                  <input type="date" value={form.availableFrom} onChange={setField('availableFrom')} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-900 text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                  <textarea rows={4} value={form.description} onChange={setField('description')} placeholder="Describe the property — key features, condition, access to transport, nearby schools or markets, etc." maxLength={2000} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-900 text-sm resize-none" />
                  <p className="text-xs text-gray-400 text-right mt-1">{form.description.length}/2000</p>
                </div>
              </div>
            </div>

            {/* Amenities */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Amenities</p>
              <div className="flex flex-wrap gap-2">
                {AMENITIES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleAmenity(name)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                      amenities[name]
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {submitError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{submitError}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={uploadingCount > 0 || videoProgress !== null || submitting}
              className="w-full disabled:opacity-50 disabled:cursor-not-allowed bg-gray-900 hover:bg-gray-800 active:bg-black text-white py-4 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2 mb-8"
            >
              {(uploadingCount > 0 || videoProgress !== null || submitting) && <Loader2 className="w-4 h-4 animate-spin" />}
              {uploadingCount > 0
                ? `Uploading ${uploadingCount} photo…`
                : videoProgress !== null
                ? 'Uploading video…'
                : submitting
                  ? 'Saving…'
                  : isEditing
                    ? 'Update Listing'
                    : isSale ? 'Publish Sale Listing' : 'Publish Rental Listing'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Overview ──────────────────────────────────────────────────────────────────

  return (
    <div className="size-full flex flex-col">
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />

      {/* Mobile header */}
      <div className="lg:hidden sticky top-0 z-50 bg-white px-2 pt-5 pb-3 flex items-center justify-between flex-shrink-0">
        <span className="text-[28px] font-extrabold text-[#222222]">My Listings</span>
        {canAddMore && (
          <button
            onClick={() => user ? setShowForm(true) : setSignInOpen(true)}
            className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 active:bg-black text-white px-4 py-2 rounded-full font-semibold text-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        )}
      </div>

      {/* Desktop header */}
      <div className="hidden lg:flex bg-white border-b border-gray-100 px-6 h-14 items-center gap-3 flex-shrink-0">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-gray-100 rounded-lg transition-all flex-shrink-0">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <span className="text-base font-bold text-gray-900 flex-1">My Listings</span>
        {canAddMore && (
          <button
            onClick={() => user ? setShowForm(true) : setSignInOpen(true)}
            className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 active:bg-black text-white px-4 py-2 rounded-full font-semibold text-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto bg-white p-4 lg:p-6">
        <div className="max-w-6xl mx-auto">

          {listings.length > 0 ? (
            <>
              <p className="text-sm text-gray-400 mb-4">
                <strong className="text-gray-900 font-semibold">{listings.length}</strong>{' '}
                {listings.length === 1 ? 'listing' : 'listings'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {listings.map(d => {
                  const cover = d.photos?.[0]?.url
                  const isSale = d.listingType === 'sale'
                  return (
                    <div key={d.id} className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-all group border border-gray-100">
                      <div className="relative h-56">
                        {cover ? (
                          <>
                            <img src={cover} alt="Listing" className="w-full h-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                            <div className="absolute bottom-3 left-3">
                              {isSale
                                ? d.salePrice != null && (
                                    <div className="text-white font-bold text-lg leading-tight">
                                      {formatETB(d.salePrice)}<span className="text-white/70 text-xs font-normal ml-1">sale</span>
                                    </div>
                                  )
                                : d.monthlyRent != null && (
                                    <div className="text-white font-bold text-lg leading-tight">
                                      {formatETB(d.monthlyRent)}<span className="text-white/70 text-xs font-normal">{RATE_SUFFIX[rentUnit(d.propertyType)]}</span>
                                    </div>
                                  )
                              }
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                            <Home className="w-12 h-12 text-gray-300" />
                          </div>
                        )}

                        {/* Top-left badges */}
                        <div className="absolute top-3 left-3 flex gap-1.5">
                          <span className={`text-white text-xs font-semibold px-2.5 py-1 rounded-full ${isSale ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                            {isSale ? 'For Sale' : 'For Rent'}
                          </span>
                          <span className={`text-white text-xs font-semibold px-2.5 py-1 rounded-full ${d.status === 'published' ? 'bg-green-500' : 'bg-amber-500'}`}>
                            {d.status === 'published' ? 'Live' : 'Pending'}
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div className="absolute top-3 right-3 flex gap-1.5">
                          <button
                            onClick={() => enterEditMode(d)}
                            className="bg-black/30 backdrop-blur-sm p-2 rounded-full transition-all hover:bg-black/50"
                          >
                            <Edit2 className="w-4 h-4 text-white" />
                          </button>
                          <button
                            onClick={() => confirmDelete(d)}
                            className="bg-black/30 backdrop-blur-sm p-2 rounded-full transition-all hover:bg-black/50"
                          >
                            <Trash2 className="w-4 h-4 text-red-300" />
                          </button>
                        </div>

                        {d.photos && d.photos.length > 1 && (
                          <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs font-medium px-2.5 py-1 rounded-full">
                            {d.photos.length} photos
                          </div>
                        )}
                      </div>

                      <div className="p-4">
                        {!cover && (
                          isSale
                            ? d.salePrice != null && (
                                <div className="text-xl font-bold text-gray-900 mb-2">
                                  {formatETB(d.salePrice)}<span className="text-sm font-normal text-gray-500 ml-1">sale</span>
                                </div>
                              )
                            : d.monthlyRent != null && (
                                <div className="text-xl font-bold text-gray-900 mb-2">
                                  {formatETB(d.monthlyRent)}<span className="text-sm font-normal text-gray-500">{RATE_SUFFIX[rentUnit(d.propertyType)]}</span>
                                </div>
                              )
                        )}
                        <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
                          {d.bedrooms != null && <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" />{d.bedrooms} bd</span>}
                          {d.bathrooms != null && <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" />{d.bathrooms} ba</span>}
                          {d.areaSqm != null && <span className="flex items-center gap-1"><Ruler className="w-3.5 h-3.5" />{d.areaSqm} m²</span>}
                        </div>
                        {d.landmark && <div className="text-sm font-medium text-gray-800 mb-0.5 truncate">{d.landmark}</div>}
                        <div className="text-xs text-gray-400">{[d.subCity, d.city].filter(Boolean).join(', ')}</div>
                        <div className="flex items-center gap-4 mt-2 pt-2 border-t border-gray-100">
                          <span className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Eye className="w-3.5 h-3.5" />{(d.viewCount ?? 0).toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Heart className="w-3.5 h-3.5" />{(d.likeCount ?? 0).toLocaleString()}
                          </span>
                        </div>
                        {d.amenities && d.amenities.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
                            {d.amenities.slice(0, 3).map(a => (
                              <span key={a} className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-0.5 rounded-full">{a}</span>
                            ))}
                            {d.amenities.length > 3 && (
                              <span className="text-xs text-gray-400">+{d.amenities.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-5">
                <Home className="w-7 h-7 text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1.5">No listings yet</h3>
              <p className="text-gray-400 text-sm mb-7 max-w-xs leading-relaxed">
                {isAgent
                  ? 'Add your first property to get started.'
                  : 'Publish your property listing to reach buyers and renters.'}
              </p>
              {canAddMore && (
                <button
                  onClick={() => user ? setShowForm(true) : setSignInOpen(true)}
                  className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 active:bg-black text-white rounded-full text-sm font-semibold transition-all"
                >
                  Add Listing
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4" onClick={() => { if (!deleting) setShowDeleteConfirm(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Delete Listing?</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
              <button onClick={() => setShowDeleteConfirm(false)} className="ml-auto p-1.5 hover:bg-gray-100 rounded-full transition-all">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <p className="text-gray-600 text-sm mb-6">Are you sure you want to delete this listing? All data including photos will be permanently removed.</p>

            {deleteError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{deleteError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteListing}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-semibold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
