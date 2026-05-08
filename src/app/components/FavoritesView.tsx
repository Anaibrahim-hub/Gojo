'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Heart, Home, Key, Map, List, ChevronDown } from 'lucide-react'
import { useFavorites } from '@/lib/favorites-context'
import { mockProperties, type Property } from '@/app/data/properties'
import MapView from './MapView'
import PropertyCard from './PropertyCard'
import PropertyModal from './PropertyModal'

export default function FavoritesView() {
  const router = useRouter()
  const { favorites } = useFavorites()
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [hoveredPropertyId, setHoveredPropertyId] = useState<number | null>(null)
  const [listingMode, setListingMode] = useState<'buy' | 'rent'>('buy')
  const [mobileView, setMobileView] = useState<'map' | 'list'>('list')
  const [sortBy, setSortBy] = useState<'recommended' | 'price-low' | 'price-high' | 'beds' | 'baths' | 'sqft'>('recommended')

  const favoriteProperties = mockProperties.filter((p) => favorites.has(p.id))

  const sorted = [...favoriteProperties]
  if (sortBy === 'price-low') sorted.sort((a, b) => (listingMode === 'buy' ? a.price - b.price : a.rent - b.rent))
  else if (sortBy === 'price-high') sorted.sort((a, b) => (listingMode === 'buy' ? b.price - a.price : b.rent - a.rent))
  else if (sortBy === 'beds') sorted.sort((a, b) => b.beds - a.beds)
  else if (sortBy === 'baths') sorted.sort((a, b) => b.baths - a.baths)
  else if (sortBy === 'sqft') sorted.sort((a, b) => b.sqft - a.sqft)

  return (
    <div className="size-full flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-gray-100 px-4 lg:px-6 py-3 lg:py-4 flex items-center gap-3 lg:gap-5 flex-wrap">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-xl transition-all flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>

        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-500 fill-red-500" />
          <span className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Favorites
          </span>
        </div>

        {/* Buy / Rent toggle */}
        <div className="flex bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-1.5 gap-1 shadow-inner ml-auto">
          <button
            onClick={() => setListingMode('buy')}
            className={`flex items-center gap-2 px-4 lg:px-5 py-2.5 rounded-lg transition-all text-sm lg:text-base font-medium ${
              listingMode === 'buy'
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Home className="w-4 h-4" />Buy
          </button>
          <button
            onClick={() => setListingMode('rent')}
            className={`flex items-center gap-2 px-4 lg:px-5 py-2.5 rounded-lg transition-all text-sm lg:text-base font-medium ${
              listingMode === 'rent'
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Key className="w-4 h-4" />Rent
          </button>
        </div>
      </div>

      {favoriteProperties.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-5">
            <Heart className="w-9 h-9 text-gray-300" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">No saved listings yet</h2>
          <p className="text-gray-500 mb-6 max-w-xs">
            Tap the heart on any listing to save it here for easy access later.
          </p>
          <button
            onClick={() => router.push('/listings')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-md"
          >
            Browse Listings
          </button>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden relative">
          {/* Map */}
          <div className={`w-full lg:w-1/2 h-full ${mobileView === 'list' ? 'hidden lg:block' : ''}`}>
            <MapView
              properties={sorted}
              onPropertyClick={setSelectedProperty}
              hoveredPropertyId={hoveredPropertyId}
              onMarkerHover={setHoveredPropertyId}
              listingMode={listingMode}
              flyTo={null}
            />
          </div>

          {/* Property list */}
          <div className={`w-full lg:w-1/2 h-full overflow-y-auto bg-gradient-to-br from-gray-50 to-blue-50/30 p-3 lg:p-6 ${mobileView === 'map' ? 'hidden lg:block' : ''}`}>
            <div className="mb-4 lg:mb-5 flex items-center justify-between gap-3">
              <div className="inline-block bg-white px-3 lg:px-4 py-1.5 lg:py-2 rounded-full shadow-md border border-gray-100">
                <span className="font-semibold text-gray-700 text-sm lg:text-base">{sorted.length}</span>
                <span className="text-gray-500 ml-1 text-xs lg:text-base">saved</span>
              </div>

              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="appearance-none bg-white px-3 lg:px-4 py-1.5 lg:py-2 pr-8 lg:pr-10 rounded-full shadow-md border border-gray-100 text-xs lg:text-sm font-medium text-gray-700 cursor-pointer hover:border-blue-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                >
                  <option value="recommended">Recommended</option>
                  <option value="price-low">Price (Low to High)</option>
                  <option value="price-high">Price (High to Low)</option>
                  <option value="beds">Beds</option>
                  <option value="baths">Baths</option>
                  <option value="sqft">Square Feet</option>
                </select>
                <ChevronDown className="w-3 h-3 lg:w-4 lg:h-4 text-gray-500 absolute right-2 lg:right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
              {sorted.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  onClick={() => setSelectedProperty(property)}
                  isHovered={hoveredPropertyId === property.id}
                  onMouseEnter={() => setHoveredPropertyId(property.id)}
                  onMouseLeave={() => setHoveredPropertyId(null)}
                  listingMode={listingMode}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <PropertyModal
        property={selectedProperty}
        onClose={() => setSelectedProperty(null)}
        listingMode={listingMode}
      />

      {favoriteProperties.length > 0 && (
        <button
          onClick={() => setMobileView(mobileView === 'map' ? 'list' : 'map')}
          className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-full shadow-2xl hover:shadow-blue-500/50 transition-all flex items-center gap-2 font-semibold"
        >
          {mobileView === 'map' ? (
            <><List className="w-5 h-5" /><span>List</span></>
          ) : (
            <><Map className="w-5 h-5" /><span>Map</span></>
          )}
        </button>
      )}
    </div>
  )
}
