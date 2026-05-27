'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Heart, Home, Key, Map, List, ChevronDown, Loader2 } from 'lucide-react'
import { useFavorites } from '@/lib/favorites-context'
import { type Property } from '@/app/data/properties'
import { useListings } from '@/lib/listings-context'
import MapView from './MapView'
import PropertyCard from './PropertyCard'
import PropertyModal from './PropertyModal'

export default function FavoritesView() {
  const router = useRouter()
  const { favorites } = useFavorites()
  const { listings: apiListings, loading: loadingListings } = useListings()
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [hoveredPropertyId, setHoveredPropertyId] = useState<number | null>(null)
  const [listingMode, setListingMode] = useState<'buy' | 'rent'>('buy')
  const [mobileView, setMobileView] = useState<'map' | 'list'>('list')
  const [sortBy, setSortBy] = useState<'recommended' | 'price-low' | 'price-high' | 'beds' | 'baths' | 'sqft'>('recommended')

  useEffect(() => {
    if (mobileView === 'map') window.dispatchEvent(new Event('resize'))
  }, [mobileView])

  const favoriteProperties = apiListings.filter((p) => favorites.has(p.id))

  const sorted = [...favoriteProperties]
  if (sortBy === 'price-low') sorted.sort((a, b) => (listingMode === 'buy' ? a.price - b.price : a.rent - b.rent))
  else if (sortBy === 'price-high') sorted.sort((a, b) => (listingMode === 'buy' ? b.price - a.price : b.rent - a.rent))
  else if (sortBy === 'beds') sorted.sort((a, b) => b.beds - a.beds)
  else if (sortBy === 'baths') sorted.sort((a, b) => b.baths - a.baths)
  else if (sortBy === 'sqft') sorted.sort((a, b) => b.sqft - a.sqft)

  return (
    <div className="size-full flex flex-col">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 lg:px-6 h-14 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-all flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>

        <div className="flex items-center gap-2 flex-1">
          <Heart className="w-4 h-4 text-red-500 fill-red-500" />
          <span className="text-base font-bold text-gray-900">Saved Homes</span>
        </div>

        {/* Buy / Rent toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5 flex-shrink-0">
          <button
            onClick={() => setListingMode('buy')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all text-sm font-semibold ${
              listingMode === 'buy' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Home className="w-3.5 h-3.5" />Buy
          </button>
          <button
            onClick={() => setListingMode('rent')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all text-sm font-semibold ${
              listingMode === 'rent' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Key className="w-3.5 h-3.5" />Rent
          </button>
        </div>
      </div>

      {loadingListings ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-gray-400 animate-spin" />
        </div>
      ) : favoriteProperties.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-5">
            <Heart className="w-7 h-7 text-gray-300" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1.5">No saved homes yet</h2>
          <p className="text-sm text-gray-400 mb-7 max-w-xs leading-relaxed">
            Tap the heart on any listing to save it here for easy access.
          </p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 active:bg-black text-white rounded-full text-sm font-semibold transition-all"
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
              onPropertyClick={(p) => setSelectedProperty(p)}
              hoveredPropertyId={hoveredPropertyId}
              onMarkerHover={setHoveredPropertyId}
              listingMode={listingMode}
              flyTo={null}
            />
          </div>

          {/* Property list */}
          <div className={`w-full lg:w-1/2 h-full overflow-y-auto bg-white flex flex-col ${mobileView === 'map' ? 'hidden lg:block' : ''}`}>

            {/* Count + sort bar */}
            <div className="sticky top-0 bg-white z-20 border-b border-gray-100 px-4 py-2.5 flex items-center justify-between gap-4 flex-shrink-0">
              <span className="text-sm text-gray-500">
                <strong className="text-gray-900 font-semibold">{sorted.length}</strong> saved
              </span>
              <div className="relative flex items-center gap-1">
                <span className="text-sm text-gray-400">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="appearance-none text-sm font-medium text-gray-700 cursor-pointer focus:outline-none pr-4 bg-transparent"
                >
                  <option value="recommended">Recommended</option>
                  <option value="price-low">Lowest price</option>
                  <option value="price-high">Highest price</option>
                  <option value="beds">Most beds</option>
                  <option value="baths">Most baths</option>
                  <option value="sqft">Largest</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-0 pointer-events-none" />
              </div>
            </div>

            <div className="p-3 pb-24 lg:pb-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
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
          className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-5 py-3 rounded-full shadow-xl transition-all flex items-center gap-2 text-sm font-semibold active:scale-95"
        >
          {mobileView === 'map' ? (
            <><List className="w-4 h-4" /><span>List</span></>
          ) : (
            <><Map className="w-4 h-4" /><span>Map</span></>
          )}
        </button>
      )}
    </div>
  )
}
