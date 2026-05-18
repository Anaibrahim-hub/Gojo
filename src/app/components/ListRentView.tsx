'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Loader2, AlertCircle, LogIn, MapPin, CheckCircle2, Home, BedDouble, Bath, Ruler, Edit2, Upload, X, Eye, Heart } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import SignInModal from './SignInModal'

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

  // The listing currently being edited (null = creating new)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [images, setImages] = useState<ImageEntry[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [amenities, setAmenities] = useState<Record<string, boolean>>(
    Object.fromEntries(AMENITIES.map((a) => [a, false]))
  )
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [locating, setLocating] = useState(false)
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
    setAmenities(Object.fromEntries(AMENITIES.map((a) => [a, false])))
    setLat(''); setLng('')
    setSubmitError(null)
  }

  function validateForm(): string | null {
    if (!form.city) return 'Please select a city.'
    if (!form.propertyType) return 'Please select a property type.'
    if (form.listingType === 'rent') {
      if (!form.monthlyRent || parseFloat(form.monthlyRent) <= 0) return 'Please enter a valid monthly rent.'
      if (parseFloat(form.monthlyRent) > 100_000_000) return 'Monthly rent exceeds the maximum allowed value.'
    } else {
      if (!form.salePrice || parseFloat(form.salePrice) <= 0) return 'Please enter a valid sale price.'
      if (parseFloat(form.salePrice) > 1_000_000_000) return 'Sale price exceeds the maximum allowed value.'
    }
    if (form.bedrooms && (parseInt(form.bedrooms) < 0 || parseInt(form.bedrooms) > 50)) return 'Bedrooms must be between 0 and 50.'
    if (form.bathrooms && (parseInt(form.bathrooms) < 0 || parseInt(form.bathrooms) > 50)) return 'Bathrooms must be between 0 and 50.'
    if (form.areaSqm && (parseFloat(form.areaSqm) <= 0 || parseFloat(form.areaSqm) > 50_000)) return 'Area must be between 1 and 50,000 m².'
    if (form.description.length > 2000) return 'Description must be 2,000 characters or less.'
    if (form.landmark.length > 200) return 'Landmark must be 200 characters or less.'
    if (lat && (parseFloat(lat) < -90 || parseFloat(lat) > 90)) return 'Latitude must be between -90 and 90.'
    if (lng && (parseFloat(lng) < -180 || parseFloat(lng) > 180)) return 'Longitude must be between -180 and 180.'
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

  function detectLocation() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude.toFixed(6)); setLng(pos.coords.longitude.toFixed(6)); setLocating(false) },
      () => setLocating(false),
      { timeout: 10000 }
    )
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

  const uploadingCount = images.filter(i => i.uploading).length
  const readyCount = images.filter(i => !i.uploading).length

  function toggleAmenity(name: string) {
    setAmenities((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  const canAddMore = isAgent || listings.length === 0

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (authLoading || checkingListing) {
    return (
      <div className="size-full flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  // ── Form view (create or edit) ───────────────────────────────────────────────

  if (showForm || isEditing) {
    const isSale = form.listingType === 'sale'
    return (
      <div className="size-full flex flex-col">
        <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />

        {/* Header */}
        <div className="bg-white shadow px-4 lg:px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
          <button
            onClick={exitForm}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back to Listings</span>
          </button>
        </div>

        {!user && (
          <div className="bg-blue-50 border-b border-blue-100 px-4 lg:px-6 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-blue-800 font-medium">Sign in to publish your listing and upload photos.</p>
            <button
              onClick={() => setSignInOpen(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-all flex-shrink-0"
            >
              <LogIn className="w-4 h-4" /> Sign in
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                {isEditing ? 'Edit Listing' : 'Add New Listing'}
              </h2>
              <p className="text-gray-500 mb-6">Upload your listing with up to 10 photos</p>

              {/* Listing type */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">Listing Type</label>
                <div className="flex gap-3">
                  {(['rent', 'sale'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, listingType: type }))}
                      className={`flex-1 py-2.5 rounded-xl font-semibold text-sm border-2 transition-all ${
                        form.listingType === type
                          ? type === 'sale'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {type === 'rent' ? 'For Rent' : 'For Sale'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Large upload zone */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">Property Photos</label>
                  <span className="text-sm text-gray-400">{readyCount}/10</span>
                </div>

                {uploadError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />{uploadError}
                  </div>
                )}

                {images.length < 10 && (
                  user ? (
                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all mb-4">
                      <Upload className="w-10 h-10 text-gray-400 mb-3" />
                      <p className="text-sm text-gray-600 font-medium">Click to upload images</p>
                      <p className="text-xs text-gray-400 mt-1">{images.length}/10 images · JPEG, PNG, WebP</p>
                      <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleImageUpload} />
                    </label>
                  ) : (
                    <button type="button" onClick={() => setSignInOpen(true)}
                      className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-blue-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all mb-4">
                      <LogIn className="w-10 h-10 text-blue-400 mb-3" />
                      <p className="text-sm text-blue-500 font-medium">Sign in to upload photos</p>
                    </button>
                  )
                )}

                {images.length > 0 && (
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {images.map((entry, i) => {
                      if (entry.uploading) {
                        return (
                          <div key={entry.id} className="relative aspect-square rounded-xl overflow-hidden border-2 border-blue-200 bg-blue-50">
                            <img src={entry.preview} alt="Uploading…" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3">
                              <span className="text-xs font-bold text-blue-600">{entry.progress}%</span>
                              <div className="w-full bg-blue-100 rounded-full h-1.5">
                                <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-200" style={{ width: `${entry.progress}%` }} />
                              </div>
                            </div>
                          </div>
                        )
                      }
                      return (
                        <div key={entry.id} className="relative aspect-square rounded-xl overflow-hidden group border-2 border-gray-200">
                          <img src={entry.url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                          {i === 0 && (
                            <span className="absolute bottom-1.5 left-1.5 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Cover</span>
                          )}
                          <button
                            onClick={() => removeImage(i)}
                            className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Location */}
              <h3 className="text-lg font-bold text-gray-900 mb-4">Location</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <select value={form.city} onChange={setField('city')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 bg-white">
                    <option value="">Select city</option>
                    {['Addis Ababa','Dire Dawa','Hawassa','Mekelle','Gondar','Bahir Dar','Adama','Jimma','Dessie','Jijiga','Other'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sub-city</label>
                  <input type="text" value={form.subCity} onChange={setField('subCity')} placeholder="e.g. Bole, Kirkos, Yeka" maxLength={100} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Woreda</label>
                  <input type="text" value={form.woreda} onChange={setField('woreda')} placeholder="e.g. Woreda 03" maxLength={100} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kebele</label>
                  <input type="text" value={form.kebele} onChange={setField('kebele')} placeholder="e.g. 01" maxLength={100} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Landmark / Area Description</label>
                <input type="text" value={form.landmark} onChange={setField('landmark')} placeholder="e.g. Near Bole Atlas Hotel, behind the blue building" maxLength={200} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
              </div>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">GPS Coordinates <span className="text-gray-400 font-normal">(optional)</span></label>
                  <button type="button" onClick={detectLocation} disabled={locating} className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 transition-all">
                    {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                    {locating ? 'Detecting…' : 'Use my location'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" value={lat} onChange={e => setLat(e.target.value)} placeholder="Latitude  e.g. 9.005401" className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-sm font-mono" />
                  <input type="text" value={lng} onChange={e => setLng(e.target.value)} placeholder="Longitude  e.g. 38.763611" className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-sm font-mono" />
                </div>
              </div>

              {/* Property Details */}
              <h3 className="text-lg font-bold text-gray-900 mb-4">Property Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Property Type</label>
                  <select value={form.propertyType} onChange={setField('propertyType')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 bg-white">
                    <option value="">Select type</option>
                    {['House (ቤት)','Apartment / Condominium','Studio','Villa','Townhouse','Commercial Space'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isSale ? 'Sale Price (Br)' : 'Monthly Rent (Br)'}
                  </label>
                  {isSale ? (
                    <input type="number" value={form.salePrice} onChange={setField('salePrice')} placeholder="e.g. 4500000" min={0} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500" />
                  ) : (
                    <input type="number" value={form.monthlyRent} onChange={setField('monthlyRent')} placeholder="e.g. 25000" min={0} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bedrooms</label>
                  <input type="number" value={form.bedrooms} onChange={setField('bedrooms')} placeholder="e.g. 3" min={0} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bathrooms</label>
                  <input type="number" value={form.bathrooms} onChange={setField('bathrooms')} placeholder="e.g. 2" min={0} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Area (m²)</label>
                  <input type="number" value={form.areaSqm} onChange={setField('areaSqm')} placeholder="e.g. 120" min={0} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Available From</label>
                  <input type="date" value={form.availableFrom} onChange={setField('availableFrom')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea rows={4} value={form.description} onChange={setField('description')} placeholder="Describe the property — key features, condition, access to transport, nearby schools or markets, etc." maxLength={2000} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
                  <p className="text-xs text-gray-400 text-right mt-1">{form.description.length}/2000</p>
                </div>
              </div>

              {/* Amenities */}
              <h3 className="text-lg font-bold text-gray-900 mb-4">Amenities</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                {AMENITIES.map((name) => (
                  <label key={name} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={amenities[name]} onChange={() => toggleAmenity(name)} className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm text-gray-700">{name}</span>
                  </label>
                ))}
              </div>

              {submitError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{submitError}
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={uploadingCount > 0 || submitting}
                className={`w-full disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                  isSale ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {(uploadingCount > 0 || submitting) && <Loader2 className="w-4 h-4 animate-spin" />}
                {uploadingCount > 0
                  ? `Uploading ${uploadingCount} photo…`
                  : submitting
                    ? 'Saving…'
                    : isEditing
                      ? 'Update Listing'
                      : isSale ? 'Publish Sale Listing' : 'Publish Rental Listing'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Overview ──────────────────────────────────────────────────────────────────

  return (
    <div className="size-full flex flex-col">
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />

      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-100 px-4 lg:px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl transition-all flex-shrink-0">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">My Listings</h1>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
        <div className="max-w-6xl mx-auto">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {isAgent ? 'Agent Listings' : 'My Listings'}
              </h2>
              <p className="text-gray-500 mt-0.5 text-sm">
                {listings.length === 0
                  ? '0 active listings'
                  : `${listings.length} active listing${listings.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            {canAddMore && (
              <button
                onClick={() => user ? setShowForm(true) : setSignInOpen(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-md hover:shadow-lg text-sm"
              >
                <Plus className="w-4 h-4" /> Add Listing
              </button>
            )}
          </div>

          {listings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map(d => {
                const cover = d.photos?.[0]?.url
                const isSale = d.listingType === 'sale'
                return (
                  <div key={d.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all group">
                    <div className="relative">
                      {cover ? (
                        <img src={cover} alt="Listing" className="w-full h-48 object-cover" />
                      ) : (
                        <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
                          <Home className="w-12 h-12 text-gray-300" />
                        </div>
                      )}

                      <div className="absolute top-3 right-3 flex gap-2">
                        <button
                          onClick={() => enterEditMode(d)}
                          className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-white transition-all"
                        >
                          <Edit2 className="w-4 h-4 text-gray-700" />
                        </button>
                        <button
                          onClick={() => confirmDelete(d)}
                          className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-white transition-all"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>

                      {/* Listing type badge */}
                      <div className={`absolute top-3 left-3 text-white text-xs font-semibold px-3 py-1 rounded-full ${
                        isSale ? 'bg-emerald-500' : 'bg-blue-500'
                      }`}>
                        {isSale ? 'For Sale' : 'For Rent'}
                      </div>

                      {/* Status badge */}
                      <div className={`absolute bottom-3 left-3 text-white text-xs font-semibold px-3 py-1 rounded-full ${
                        d.status === 'published' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}>
                        {d.status === 'published' ? 'Live' : 'Pending review'}
                      </div>

                      {d.photos && d.photos.length > 1 && (
                        <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs font-medium px-2.5 py-1 rounded-full">
                          {d.photos.length} photos
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      {isSale ? (
                        d.salePrice != null && (
                          <div className="text-xl font-bold text-gray-900 mb-2">
                            Br {d.salePrice.toLocaleString()}
                            <span className="text-sm font-normal text-gray-500 ml-1">sale price</span>
                          </div>
                        )
                      ) : (
                        d.monthlyRent != null && (
                          <div className="text-xl font-bold text-gray-900 mb-2">
                            Br {d.monthlyRent.toLocaleString()}<span className="text-sm font-normal text-gray-500">/mo</span>
                          </div>
                        )
                      )}
                      <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
                        {d.bedrooms != null && (
                          <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5 text-blue-500" />{d.bedrooms} bd</span>
                        )}
                        {d.bathrooms != null && (
                          <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5 text-blue-500" />{d.bathrooms} ba</span>
                        )}
                        {d.areaSqm != null && (
                          <span className="flex items-center gap-1"><Ruler className="w-3.5 h-3.5 text-blue-500" />{d.areaSqm} m²</span>
                        )}
                      </div>
                      {d.landmark && (
                        <div className="text-sm font-medium text-gray-800 mb-0.5">{d.landmark}</div>
                      )}
                      <div className="text-xs text-gray-500">
                        {[d.subCity, d.city].filter(Boolean).join(', ')}
                      </div>
                      <div className="flex items-center gap-4 mt-2 pt-2 border-t border-gray-100">
                        <span className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Eye className="w-3.5 h-3.5 text-gray-400" />
                          {(d.viewCount ?? 0).toLocaleString()} views
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Heart className="w-3.5 h-3.5 text-red-400" />
                          {(d.likeCount ?? 0).toLocaleString()} likes
                        </span>
                      </div>
                      {d.amenities && d.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
                          {d.amenities.slice(0, 3).map(a => (
                            <span key={a} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" /> {a}
                            </span>
                          ))}
                          {d.amenities.length > 3 && (
                            <span className="text-xs text-gray-400 px-1 py-0.5">+{d.amenities.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-5">
                <Home className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">No listings yet</h3>
              <p className="text-gray-500 text-sm mb-8 max-w-xs">
                {isAgent
                  ? 'Click "Add Listing" above to publish your first property.'
                  : 'Click "Add Listing" above to publish your first property listing.'}
              </p>
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
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{deleteError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteListing}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl font-semibold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
