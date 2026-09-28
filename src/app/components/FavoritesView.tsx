'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Heart, Home, Key, Map, List, ChevronDown, Loader2 } from 'lucide-react'
import { useFavorites } from '@/lib/favorites-context'
import { type Property } from '@/app/data/properties'
import { useListings } from '@/lib/listings-context'

const MapView = dynamic(() => import('./MapView'), { ssr: false })
import PropertyCard from './PropertyCard'
import PropertyModal from './PropertyModal'

function sortProps(arr: Property[], sortBy: string, mode: 'buy' | 'rent'): Property[] {
  const result = [...arr]
  if (sortBy === 'price-low') result.sort((a, b) => (mode === 'buy' ? a.price - b.price : a.rent - b.rent))
  else if (sortBy === 'price-high') result.sort((a, b) => (mode === 'buy' ? b.price - a.price : b.rent - a.rent))
  else if (sortBy === 'beds') result.sort((a, b) => b.beds - a.beds)
  else if (sortBy === 'baths') result.sort((a, b) => b.baths - a.baths)
  else if (sortBy === 'sqft') result.sort((a, b) => b.sqft - a.sqft)
  return result
}

export default function FavoritesView() {
  const router = useRouter()
  const { favorites } = useFavorites()
  const { listings: apiListings, loading: loadingListings } = useListings()
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [hoveredPropertyId, setHoveredPropertyId] = useState<number | null>(null)
  const [listingMode, setListingMode] = useState<'buy' | 'rent'>('buy')
  const [sortBy, setSortBy] = useState<'recommended' | 'price-low' | 'price-high' | 'beds' | 'baths' | 'sqft'>('recommended')

  const favoriteProperties = apiListings.filter((p) => favorites.has(p.id))

  // Mobile: filter by listing type (matches native app behaviour)
  const mobileFavorites = favoriteProperties.filter((p) =>
    listingMode === 'buy' ? (p.type === 'sale' || p.type === 'both') : (p.type === 'rent' || p.type === 'both')
  )

  const desktopSorted = sortProps(favoriteProperties, sortBy, listingMode)
  const mobileSorted = sortProps(mobileFavorites, sortBy, listingMode)

  return (
    <div className="size-full flex flex-col">

      {/* ── Desktop header ── */}
      <div className="hidden lg:flex bg-white border-b border-gray-100 px-6 h-14 items-center gap-3 flex-shrink-0">
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

      {/* ── Mobile header: Wishlists ── */}
      <div className="lg:hidden sticky top-0 z-50 bg-white px-2 pt-5 pb-3 flex items-center justify-between flex-shrink-0">
        <span className="text-[28px] font-extrabold text-[#222222]">Wishlists</span>
        <div className="flex bg-white border border-[#EBEBEB] rounded-full overflow-hidden">
          <button
            onClick={() => setListingMode('buy')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all ${
              listingMode === 'buy' ? 'bg-[#222222] text-white' : 'text-[#717171]'
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setListingMode('rent')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all ${
              listingMode === 'rent' ? 'bg-[#222222] text-white' : 'text-[#717171]'
            }`}
          >
            Rent
          </button>
        </div>
      </div>

      {/* ── Mobile content ── */}
      <div className="lg:hidden flex-1 overflow-y-auto bg-white">
        {loadingListings ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 text-[#5BA4CF] animate-spin" />
          </div>
        ) : mobileSorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center px-8 gap-4 pt-20 pb-10">
            <Heart className="w-[72px] h-[72px] text-[#EBEBEB]" />
            <p className="text-[20px] font-bold text-[#222222]">No saved listings yet</p>
            <p className="text-[15px] text-[#717171] leading-relaxed">
              Tap the heart on any listing to save it here.
            </p>
          </div>
        ) : (
          <div className="px-2 py-4 flex flex-col gap-4 pb-28">
            {mobileSorted.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                onClick={() => setSelectedProperty(property)}
                isHovered={false}
                onMouseEnter={() => {}}
                onMouseLeave={() => {}}
                listingMode={listingMode}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Desktop content ── */}
      {loadingListings ? (
        <div className="hidden lg:flex flex-1 items-center justify-center">
          <Loader2 className="w-7 h-7 text-gray-400 animate-spin" />
        </div>
      ) : favoriteProperties.length === 0 ? (
        <div className="hidden lg:flex flex-1 flex-col items-center justify-center text-center px-4">
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
        <div className="hidden lg:flex flex-1 overflow-hidden relative">
          {/* Map */}
          <div className="w-1/2 h-full">
            <MapView
              properties={desktopSorted}
              onPropertyClick={(p) => setSelectedProperty(p)}
              hoveredPropertyId={hoveredPropertyId}
              onMarkerHover={setHoveredPropertyId}
              listingMode={listingMode}
              flyTo={null}
            />
          </div>

          {/* List */}
          <div className="w-1/2 h-full overflow-y-auto bg-white flex flex-col">
            <div className="sticky top-0 bg-white z-20 border-b border-gray-100 px-4 py-2.5 flex items-center justify-between gap-4 flex-shrink-0">
              <span className="text-sm text-gray-500">
                <strong className="text-gray-900 font-semibold">{desktopSorted.length}</strong> saved
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
            <div className="p-3 pb-3 grid grid-cols-2 gap-3">
              {desktopSorted.map((property) => (
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
    </div>
  )
}
