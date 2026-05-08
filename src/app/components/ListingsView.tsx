'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import MapView from './MapView'
import PropertyCard from './PropertyCard'
import FilterPanel from './FilterPanel'
import PropertyModal from './PropertyModal'
import SignInModal from './SignInModal'
import { Map, List, ChevronDown } from 'lucide-react'
import { mockProperties, type Property } from '@/app/data/properties'

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
  })

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [hoveredPropertyId, setHoveredPropertyId] = useState<number | null>(null)
  const [mobileView, setMobileView] = useState<'map' | 'list'>('list')
  const [listingMode, setListingMode] = useState<'buy' | 'rent'>(initialMode)
  const [sortBy, setSortBy] = useState<'recommended' | 'price-low' | 'price-high' | 'beds' | 'baths' | 'sqft'>('recommended')
  const [showSignInModal, setShowSignInModal] = useState(false)

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleClearFilters = () => {
    setFilters({ minPrice: '', maxPrice: '', beds: '', baths: '', minSqft: '', status: '', propertyType: '' })
  }

  const filteredProperties = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    const filtered = mockProperties.filter((property) => {
      if (listingMode === 'buy' && property.type === 'rent') return false
      if (listingMode === 'rent' && property.type === 'sale') return false
      if (q && !property.address.toLowerCase().includes(q) &&
               !property.city.toLowerCase().includes(q) &&
               !property.state.toLowerCase().includes(q) &&
               !property.zip.includes(q) &&
               !property.propertyType.toLowerCase().includes(q)) return false
      const priceValue = listingMode === 'buy' ? property.price : property.rent
      if (filters.minPrice && priceValue < parseInt(filters.minPrice)) return false
      if (filters.maxPrice && priceValue > parseInt(filters.maxPrice)) return false
      if (filters.beds && property.beds < parseInt(filters.beds)) return false
      if (filters.baths && property.baths < parseInt(filters.baths)) return false
      if (filters.status && property.status !== filters.status) return false
      if (filters.propertyType && property.propertyType !== filters.propertyType) return false
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
    }
    return sorted
  }, [filters, listingMode, sortBy, searchQuery])

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

        <div className={`w-full lg:w-1/2 h-full overflow-y-auto bg-gradient-to-br from-gray-50 to-blue-50/30 p-3 lg:p-6 ${mobileView === 'map' ? 'hidden lg:block' : ''}`}>
          <div className="mb-4 lg:mb-5 flex items-center justify-between gap-3">
            <div className="inline-block bg-white px-3 lg:px-4 py-1.5 lg:py-2 rounded-full shadow-md border border-gray-100">
              <span className="font-semibold text-gray-700 text-sm lg:text-base">{filteredProperties.length}</span>
              <span className="text-gray-500 ml-1 text-xs lg:text-base">properties found</span>
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
          </div>
        </div>
      </div>

      <PropertyModal
        property={selectedProperty}
        onClose={() => setSelectedProperty(null)}
        listingMode={listingMode}
      />

      <button
        onClick={() => setMobileView(mobileView === 'map' ? 'list' : 'map')}
        className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-full shadow-2xl hover:shadow-blue-500/50 transition-all flex items-center gap-2 font-semibold"
      >
        {mobileView === 'map' ? (
          <>
            <List className="w-5 h-5" />
            <span>List</span>
          </>
        ) : (
          <>
            <Map className="w-5 h-5" />
            <span>Map</span>
          </>
        )}
      </button>

      <SignInModal open={showSignInModal} onClose={() => setShowSignInModal(false)} />
    </div>
  )
}
