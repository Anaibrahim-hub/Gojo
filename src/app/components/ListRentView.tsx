'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, Trash2 } from 'lucide-react'

const AMENITIES = [
  'Parking',
  'Laundry',
  'Pet Friendly',
  'Generator',
  'Security Guard',
  'Water Tank',
  'Elevator',
  'Furnished',
]

export default function ListRentView() {
  const router = useRouter()
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [amenities, setAmenities] = useState<Record<string, boolean>>(
    Object.fromEntries(AMENITIES.map((a) => [a, false]))
  )

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    const remaining = 10 - uploadedImages.length
    const toAdd = Array.from(files).slice(0, remaining)
    toAdd.forEach((file) => {
      const url = URL.createObjectURL(file)
      setUploadedImages((prev) => [...prev, url])
    })
    e.target.value = ''
  }

  function removeImage(index: number) {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index))
  }

  function toggleAmenity(name: string) {
    setAmenities((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  return (
    <div className="size-full flex flex-col">
      {/* Header */}
      <div className="bg-white shadow px-4 lg:px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-xl transition-all flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">List My Home for Rent</h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Image Upload */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Property Photos</h2>

            {uploadedImages.length < 10 && (
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all mb-4">
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm font-medium text-gray-600">Click to upload photos</span>
                <span className="text-xs text-gray-400 mt-1">
                  {uploadedImages.length}/10 photos uploaded
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>
            )}

            {uploadedImages.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {uploadedImages.map((src, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={src}
                      alt={`Property photo ${i + 1}`}
                      className="w-full h-24 object-cover rounded-lg border-2 border-gray-200"
                    />
                    {i === 0 && (
                      <span className="absolute bottom-1 left-1 bg-blue-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                        Cover
                      </span>
                    )}
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Property Details */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Property Details</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
              <input
                type="text"
                placeholder="Full street address"
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                <input
                  type="text"
                  placeholder="e.g. Addis Ababa"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sub-city / Woreda</label>
                <input
                  type="text"
                  placeholder="e.g. Bole, Woreda 03"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ZIP / Postal Code</label>
                <input
                  type="text"
                  placeholder="e.g. 1000"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Property Type</label>
                <select className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500">
                  <option value="">Select type</option>
                  <option>House</option>
                  <option>Condo</option>
                  <option>Townhouse</option>
                  <option>Multi-family</option>
                  <option>Commercial</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Rent (Br)</label>
                <input
                  type="number"
                  placeholder="e.g. 25000"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bedrooms</label>
                <input
                  type="number"
                  placeholder="e.g. 3"
                  min={0}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bathrooms</label>
                <input
                  type="number"
                  placeholder="e.g. 2"
                  min={0}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Square Meters</label>
                <input
                  type="number"
                  placeholder="e.g. 120"
                  min={0}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Available From</label>
                <input
                  type="date"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                rows={4}
                placeholder="Describe your property — highlights, neighbourhood, access to transport, etc."
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Amenities */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Amenities</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {AMENITIES.map((name) => (
                <label key={name} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={amenities[name]}
                    onChange={() => toggleAmenity(name)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">{name}</span>
                </label>
              ))}
            </div>

            <button
              type="button"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-all"
            >
              Publish Rental Listing
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
