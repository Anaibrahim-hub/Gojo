'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import MapView from './MapView'
import PropertyCard from './PropertyCard'
import FilterPanel from './FilterPanel'
import PropertyModal from './PropertyModal'
import SignInModal from './SignInModal'
import { Map, List, ChevronDown, Loader2, Home } from 'lucide-react'
import { type Property } from '@/app/data/properties'
import { useListings } from '@/lib/listings-context'

export default function ListingsView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialMode = searchParams.get('mode') === 'rent' ? 'rent' : 'buy'
  const initialQ = searchParams.get('q') ?? ''
  const initialLat = searchParams.get('lat')
  const initialLng = searchParams.get('lng')
  const initialZoom = searchParams.get('zoom')

  const [searchQuery, setSearchQuery] = useState(initialQ)
  const [mapFlyTo, setMapFlyTo] = useState<{ lng: number; lat: number; zoom: number } | null>(
    initialLat && initialLng
      ? { lat: parseFloat(initialLat), lng: parseFloat(initialLng), zoom: parseFloat(initialZoom ?? '12') }
      : null
  )
  const [filters, setFilters] = useState({
    minPrice: '',
    maxPrice: '',
    beds: '',
    baths: '',
    minSqft: '',
    status: '',
    propertyType: '',
    furnished: '',
  })

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [hoveredPropertyId, setHoveredPropertyId] = useState<number | null>(null)
  const [mobileView, setMobileView] = useState<'map' | 'list'>('list')
  const [listingMode, setListingMode] = useState<'buy' | 'rent'>(initialMode)
  const [sortBy, setSortBy] = useState<'recommended' | 'price-low' | 'price-high' | 'beds' | 'baths' | 'sqft'>('recommended')
  const [showSignInModal, setShowSignInModal] = useState(false)
  const { listings: apiListings, loading: loadingListings, hasMore, loadMore, loadingMore } = useListings()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set('mode', listingMode)
    router.replace(`/listings?${params.toString()}`, { scroll: false })
  }, [listingMode])

  useEffect(() => {
    if (mobileView === 'map') window.dispatchEvent(new Event('resize'))
  }, [mobileView])

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleClearFilters = () => {
    setFilters({ minPrice: '', maxPrice: '', beds: '', baths: '', minSqft: '', status: '', propertyType: '', furnished: '' })
  }

  const filteredProperties = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    const filtered = apiListings.filter((property) => {
      if (listingMode === 'buy' && property.type === 'rent') return false
      if (listingMode === 'rent' && property.type === 'sale') return false
      if (q) {
        const words = q.split(/\s+/).filter(Boolean)
        const haystack = [
          property.address,
          property.city,
          property.state,
          property.zip,
          property.propertyType ?? '',
          property.subCity ?? '',
          property.woreda ?? '',
          property.landmark ?? '',
        ].join(' ').toLowerCase()
        if (!words.every(w => haystack.includes(w))) return false
      }
      const priceValue = listingMode === 'buy' ? property.price : property.rent
      if (filters.minPrice && priceValue < parseInt(filters.minPrice)) return false
      if (filters.maxPrice && priceValue > parseInt(filters.maxPrice)) return false
      if (filters.beds && property.beds < parseInt(filters.beds)) return false
      if (filters.baths && property.baths < parseInt(filters.baths)) return false
      if (filters.status && property.status !== filters.status) return false
      if (filters.propertyType && property.propertyType !== filters.propertyType) return false
      if (filters.furnished === 'true' && !property.furnished) return false
      if (filters.furnished === 'false' && property.furnished) return false
      return true
    })

    const sorted = [...filtered]
    if (sortBy === 'price-low') {
      sorted.sort((a, b) => (listingMode === 'buy' ? a.price - b.price : a.rent - b.rent))
    } else if (sortBy === 'price-high') {
      sorted.sort((a, b) => (listingMode === 'buy' ? b.price - a.price : b.rent - a.rent))
    } else if (sortBy === 'beds') {
      sorted.sort((a, b) => b.beds - a.beds)
    } else if (sortBy === 'baths') {
      sorted.sort((a, b) => b.baths - a.baths)
    } else if (sortBy === 'sqft') {
      sorted.sort((a, b) => b.sqft - a.sqft)
    } else {
      sorted.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    }
    return sorted
  }, [filters, listingMode, sortBy, searchQuery, apiListings])

  return (
    <div className="size-full flex flex-col">
      <FilterPanel
        filters={filters}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onLocationSelect={setMapFlyTo}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        listingMode={listingMode}
        onListingModeChange={setListingMode}
        onLogoClick={() => router.push('/')}
        onSignInClick={() => setShowSignInModal(true)}
      />

      <div className="flex-1 flex overflow-hidden relative">
        <div className={`w-full lg:w-1/2 h-full ${mobileView === 'list' ? 'hidden lg:block' : ''}`}>
          <MapView
            properties={filteredProperties}
            onPropertyClick={setSelectedProperty}
            hoveredPropertyId={hoveredPropertyId}
            onMarkerHover={setHoveredPropertyId}
            listingMode={listingMode}
            flyTo={mapFlyTo}
          />
        </div>

        <div className={`w-full lg:w-1/2 h-full overflow-y-auto bg-white flex flex-col ${mobileView === 'map' ? 'hidden lg:block' : ''}`}>

          {/* Count + sort bar */}
          <div className="sticky top-0 bg-white z-20 border-b border-gray-100 px-4 py-2.5 flex items-center justify-between gap-4 flex-shrink-0">
            <span className="text-sm text-gray-500">
              {loadingListings
                ? <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />Loading…</span>
                : <><strong className="text-gray-900 font-semibold">{filteredProperties.length}</strong> homes</>
              }
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

          {!loadingListings && filteredProperties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center flex-1">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Home className="w-7 h-7 text-gray-400" />
              </div>
              <p className="text-gray-700 font-semibold">No homes found</p>
              <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or search</p>
            </div>
          ) : (
            <div className="p-3 pb-24 lg:pb-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filteredProperties.map((property) => (
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
              {hasMore && (
                <div className="col-span-full flex justify-center pt-2 pb-4">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 px-8 py-2.5 border border-gray-300 rounded-full text-sm font-medium text-gray-700 hover:border-gray-500 hover:text-gray-900 transition-all disabled:opacity-50"
                  >
                    {loadingMore ? <><Loader2 className="w-4 h-4 animate-spin" />Loading…</> : 'Load more homes'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <PropertyModal
        property={selectedProperty}
        onClose={() => setSelectedProperty(null)}
        listingMode={listingMode}
      />

      <button
        onClick={() => setMobileView(mobileView === 'map' ? 'list' : 'map')}
        className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white px-5 py-3 rounded-full shadow-xl transition-all flex items-center gap-2 text-sm font-semibold active:scale-95"
      >
        {mobileView === 'map' ? (
          <>
            <List className="w-4 h-4" />
            <span>List</span>
          </>
        ) : (
          <>
            <Map className="w-4 h-4" />
            <span>Map</span>
          </>
        )}
      </button>

      <SignInModal open={showSignInModal} onClose={() => setShowSignInModal(false)} />
    </div>
  )
}
