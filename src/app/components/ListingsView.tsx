'use client'

import { useState, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { useScreenT } from '@/lib/language-context'
import LanguagePicker from './LanguagePicker'

const MapView = dynamic(() => import('./MapView'), { ssr: false })
import PropertyCard from './PropertyCard'
import FilterPanel from './FilterPanel'
import PropertyModal from './PropertyModal'
import SignInModal from './SignInModal'
import {
  Map, List, ChevronDown, Loader2, Home, Key,
  Search, SlidersHorizontal, X, MapPin, TrendingUp, ArrowLeft,
} from 'lucide-react'
import { type Property } from '@/app/data/properties'
import { useListings } from '@/lib/listings-context'
import { useMobileMap } from '@/lib/mobile-map-context'
import { filterLocalPlaces } from '@/app/data/places'

const RECENT_KEY = 'gojo_recent_searches'

interface GeocodingFeature {
  id: string; place_name: string; text: string; center: [number, number]; place_type: string[]
}
interface RecentSearch {
  text: string; placeName: string; lng: number; lat: number; zoom: number
}

function zoomForType(types: string[]): number {
  if (types.includes('address')) return 15
  if (types.includes('neighborhood') || types.includes('locality')) return 13
  if (types.includes('postcode')) return 13
  if (types.includes('place')) return 11
  if (types.includes('region')) return 8
  return 12
}
function loadRecent(): RecentSearch[] { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] } }
function saveRecent(item: RecentSearch) {
  const deduped = loadRecent().filter(s => s.text !== item.text)
  localStorage.setItem(RECENT_KEY, JSON.stringify([item, ...deduped].slice(0, 5)))
}

const LISTINGS_DEFAULTS = {
  buy: 'Buy',
  rent: 'Rent',
  map: 'Map',
  list: 'List',
  sortLabel: 'Sort:',
  newest: 'Newest',
  priceLow: 'Price: Low → High',
  priceHigh: 'Price: High → Low',
  mostBeds: 'Most Bedrooms',
  mostBaths: 'Most Bathrooms',
  largest: 'Largest Area',
  homes: 'homes',
  property: 'property',
  properties: 'properties',
  noHomes: 'No homes found',
  noHomesHint: 'Try adjusting your filters or search',
  loadMore: 'Load more homes',
} as const

export default function ListingsView() {
  const s = useScreenT(LISTINGS_DEFAULTS)
  const router = useRouter()
  const searchParams = useSearchParams()
  const modeParam = searchParams.get('mode')
  const initialMode = modeParam === 'rent' ? 'rent' : 'buy'
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
    minPrice: '', maxPrice: '', beds: '', baths: '', minSqft: '', status: '', propertyType: '', furnished: '',
  })

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [hoveredPropertyId, setHoveredPropertyId] = useState<number | null>(null)
  const [mobileView, setMobileView] = useState<'map' | 'list'>('list')
  const [listingMode, setListingMode] = useState<'buy' | 'rent'>(initialMode)
  const [showAllTypes, setShowAllTypes] = useState(false)
  const [sortBy, setSortBy] = useState<'recommended' | 'price-low' | 'price-high' | 'beds' | 'baths' | 'sqft'>('recommended')
  const [showSignInModal, setShowSignInModal] = useState(false)
  const { listings: apiListings, loading: loadingListings, hasMore, loadMore, loadingMore } = useListings()
  const { setOpen: setMapNavOpen } = useMobileMap()

  // Mobile search modal
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<GeocodingFeature[]>([])
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])
  const [isSearchLoading, setIsSearchLoading] = useState(false)

  // Mobile filter/sort UI
  const [showMobileFilter, setShowMobileFilter] = useState(false)
  const [mobileSortOpen, setMobileSortOpen] = useState(false)

  // On mobile the list is the default view, but the map <div> is only CSS-hidden —
  // so Mapbox GL (large JS + WebGL + tile fetches) would still download and init for
  // every mobile visitor. Gate the actual MapView mount on desktop OR the user
  // opening the map, so mobile users don't pay for Mapbox until they want it.
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (showAllTypes) return
    const params = new URLSearchParams(window.location.search)
    params.set('mode', listingMode)
    router.replace(`/listings?${params.toString()}`, { scroll: false })
  }, [listingMode, showAllTypes])

  useEffect(() => {
    if (mobileView === 'map') window.dispatchEvent(new Event('resize'))
    setMapNavOpen(mobileView === 'map')
    return () => setMapNavOpen(false)
  }, [mobileView, setMapNavOpen])

  // Geocoding for mobile search
  useEffect(() => {
    const q = inputValue.trim()
    if (q.length < 2) { setSuggestions([]); setIsSearchLoading(false); return }
    setIsSearchLoading(true)
    const timer = setTimeout(async () => {
      try {
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
        const res = await fetch(
          `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&access_token=${token}&country=et&types=region,place,neighborhood,postcode,address&limit=5&proximity=38.7578,9.0320`
        )
        const data = await res.json()
        setSuggestions(
          (data.features || []).map((f: { id: string; geometry: { coordinates: [number, number] }; properties: { name: string; feature_type: string; context?: { country?: { name: string } } } }) => {
            const type = f.properties.feature_type
            const country = f.properties.context?.country?.name ?? 'Ethiopia'
            return {
              id: f.id, text: f.properties.name,
              place_name: type === 'region' ? country : `${f.properties.name}, ${country}`,
              center: f.geometry.coordinates, place_type: [type],
            }
          })
        )
      } catch { setSuggestions([]) }
      finally { setIsSearchLoading(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [inputValue])

  const mergedSuggestions = useMemo(() => {
    const local = filterLocalPlaces(inputValue)
    const localNames = new Set(local.map(p => p.text.toLowerCase()))
    return [...local, ...suggestions.filter(s => !localNames.has(s.text.toLowerCase()))]
  }, [inputValue, suggestions])

  const openSearchModal = () => {
    setInputValue(''); setSuggestions([]); setRecentSearches(loadRecent()); setShowSearchModal(true)
  }
  const selectSuggestion = (f: GeocodingFeature) => {
    const zoom = zoomForType(f.place_type)
    const [lng, lat] = f.center
    const text = f.text.split(',')[0]
    saveRecent({ text, placeName: f.place_name, lng, lat, zoom })
    setShowSearchModal(false)
    setSearchQuery(text)
    setMapFlyTo({ lat, lng, zoom })
    setShowAllTypes(false)
  }
  const selectRecent = (item: RecentSearch) => {
    setShowSearchModal(false)
    setSearchQuery(item.text)
    setMapFlyTo({ lat: item.lat, lng: item.lng, zoom: item.zoom })
  }

  const handleFilterChange = (key: string, value: string) => setFilters(prev => ({ ...prev, [key]: value }))
  const handleClearFilters = () => setFilters({ minPrice: '', maxPrice: '', beds: '', baths: '', minSqft: '', status: '', propertyType: '', furnished: '' })

  const hasActiveFilters = Object.values(filters).some(v => !!v)

  const filteredProperties = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    const filtered = apiListings.filter(property => {
      if (!showAllTypes && listingMode === 'buy' && property.type === 'rent') return false
      if (!showAllTypes && listingMode === 'rent' && property.type === 'sale') return false
      if (q) {
        const words = q.split(/\s+/).filter(Boolean)
        const haystack = [
          property.address, property.city, property.state, property.zip,
          property.propertyType ?? '', property.subCity ?? '', property.woreda ?? '', property.landmark ?? '',
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
    if (sortBy === 'price-low') sorted.sort((a, b) => (listingMode === 'buy' ? a.price - b.price : a.rent - b.rent))
    else if (sortBy === 'price-high') sorted.sort((a, b) => (listingMode === 'buy' ? b.price - a.price : b.rent - a.rent))
    else if (sortBy === 'beds') sorted.sort((a, b) => b.beds - a.beds)
    else if (sortBy === 'baths') sorted.sort((a, b) => b.baths - a.baths)
    else if (sortBy === 'sqft') sorted.sort((a, b) => b.sqft - a.sqft)
    else sorted.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    return sorted
  }, [filters, listingMode, showAllTypes, sortBy, searchQuery, apiListings])

  const sortOptions: { value: typeof sortBy; label: string }[] = [
    { value: 'recommended', label: s.newest },
    { value: 'price-low',   label: s.priceLow },
    { value: 'price-high',  label: s.priceHigh },
    { value: 'beds',        label: s.mostBeds },
    { value: 'baths',       label: s.mostBaths },
    { value: 'sqft',        label: s.largest },
  ]

  return (
    <div className="size-full flex flex-col">

      {/* ── Desktop: FilterPanel ── */}
      <div className="hidden lg:block flex-shrink-0">
        <FilterPanel
          filters={filters}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onLocationSelect={setMapFlyTo}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
          listingMode={listingMode}
          onListingModeChange={(mode) => { setShowAllTypes(false); setListingMode(mode) }}
          onLogoClick={() => router.push('/')}
          onSignInClick={() => setShowSignInModal(true)}
        />
      </div>

      {/* ── Mobile: fixed search header ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 h-14 flex items-center px-3 gap-2">
        <div
          onClick={openSearchModal}
          className="flex-1 flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2.5 text-left cursor-pointer"
        >
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="flex-1 text-sm text-gray-400 truncate">
            {searchQuery || 'City, address, or sub-city…'}
          </span>
          {searchQuery ? (
            <button onClick={e => { e.stopPropagation(); setSearchQuery('') }} className="flex-shrink-0 p-0.5">
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); setShowMobileFilter(true) }}
              className={`flex-shrink-0 p-0.5 ${hasActiveFilters ? 'text-blue-600' : 'text-gray-400'}`}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          )}
        </div>
        <LanguagePicker compact dropUp={false} />
      </div>

      {/* ── Mobile: spacer for fixed header ── */}
      <div className="lg:hidden flex-shrink-0 h-14" />

      {/* ── Mobile: sticky filter bar (hidden in map view) ── */}
      <div className={`lg:hidden sticky top-14 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-3 py-2 flex items-center justify-between flex-shrink-0 ${mobileView === 'map' ? 'hidden' : ''}`}>
        <div className="flex bg-gray-100 rounded-full p-0.5">
          {(['buy', 'rent'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setShowAllTypes(false); setListingMode(m) }}
              className={`px-4 py-1 text-xs font-semibold rounded-full transition-all ${listingMode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              {m === 'buy' ? s.buy : s.rent}
            </button>
          ))}
        </div>
        <div className="relative">
          <button
            onClick={() => setMobileSortOpen(v => !v)}
            className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-full text-xs font-semibold text-gray-600"
          >
            <span>{sortOptions.find(o => o.value === sortBy)?.label ?? 'Sort'}</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>
          {mobileSortOpen && (
            <div className="absolute top-full right-0 mt-1.5 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50 min-w-[180px]">
              {sortOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setSortBy(opt.value); setMobileSortOpen(false) }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-medium ${sortBy === opt.value ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Map */}
        <div className={`w-full lg:w-1/2 h-full ${mobileView === 'list' ? 'hidden lg:block' : ''}`}>
          {(isDesktop || mobileView === 'map') && (
            <MapView
              properties={filteredProperties}
              onPropertyClick={setSelectedProperty}
              hoveredPropertyId={hoveredPropertyId}
              onMarkerHover={setHoveredPropertyId}
              listingMode={listingMode}
              flyTo={mapFlyTo}
            />
          )}
        </div>

        {/* List */}
        <div className={`w-full lg:w-1/2 h-full overflow-y-auto bg-white flex flex-col ${mobileView === 'map' ? 'hidden lg:block' : ''}`}>

          {/* Desktop count + sort bar */}
          <div className="hidden lg:flex sticky top-0 bg-white/95 backdrop-blur-sm z-20 border-b border-gray-100 px-4 py-2.5 items-center justify-between gap-4 flex-shrink-0">
            <span className="text-sm text-gray-500">
              {loadingListings
                ? <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />Loading…</span>
                : <><strong className="text-gray-900 font-semibold">{filteredProperties.length}</strong> {s.homes}</>
              }
            </span>
            <div className="relative flex items-center gap-1.5">
              <span className="text-xs font-medium text-gray-400">{s.sortLabel}</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className="appearance-none text-sm font-semibold text-gray-700 cursor-pointer focus:outline-none pr-5 bg-transparent"
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

          {/* Mobile count */}
          {!loadingListings && filteredProperties.length > 0 && (
            <p className="lg:hidden text-xs font-semibold text-gray-700 px-4 pt-2 pb-1">
              {filteredProperties.length} {filteredProperties.length === 1 ? s.property : s.properties}
            </p>
          )}

          {loadingListings ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center flex-1">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <Home className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-800 font-semibold">{s.noHomes}</p>
              <p className="text-gray-400 text-sm mt-1">{s.noHomesHint}</p>
            </div>
          ) : (
            <div className="p-3 pb-28 lg:pb-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filteredProperties.map(property => (
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
                    className="flex items-center gap-2 px-8 py-2.5 border border-gray-200 rounded-full text-sm font-semibold text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all disabled:opacity-50"
                  >
                    {loadingMore ? <><Loader2 className="w-4 h-4 animate-spin" />Loading…</> : s.loadMore}
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

      {/* Map / List FAB — sits above bottom nav on mobile */}
      <button
        onClick={() => setMobileView(mobileView === 'map' ? 'list' : 'map')}
        className="lg:hidden fixed bottom-[4.75rem] left-1/2 -translate-x-1/2 z-40 bg-gray-950 text-white px-5 py-2.5 rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.35)] transition-all flex items-center gap-2 text-sm font-semibold active:scale-95"
      >
        {mobileView === 'map' ? (
          <><List className="w-4 h-4" /><span>{s.list}</span></>
        ) : (
          <><Map className="w-4 h-4" /><span>{s.map}</span></>
        )}
      </button>

      <SignInModal open={showSignInModal} onClose={() => setShowSignInModal(false)} />

      {/* ── Mobile Search — fullscreen white screen (matches native Yevilla) ── */}
      {showSearchModal && (
        <div className="lg:hidden fixed inset-0 z-[200] bg-white flex flex-col">
          {/* Header: back arrow + focused input */}
          <div
            className="flex items-center gap-2 px-4 py-3 border-b border-[#EBEBEB] flex-shrink-0"
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
          >
            <button
              onClick={() => setShowSearchModal(false)}
              className="w-10 h-10 flex items-center justify-center flex-shrink-0"
            >
              <ArrowLeft className="w-[22px] h-[22px] text-[#222222]" />
            </button>
            <div className="flex-1 flex items-center gap-2 bg-[#F7F7F7] rounded-full h-11 px-4">
              {isSearchLoading
                ? <Loader2 className="w-4 h-4 text-[#5BA4CF] animate-spin flex-shrink-0" />
                : <Search className="w-4 h-4 text-[#717171] flex-shrink-0" />
              }
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && mergedSuggestions.length > 0) selectSuggestion(mergedSuggestions[0])
                  if (e.key === 'Escape') setShowSearchModal(false)
                }}
                placeholder="Search city, area, or property type…"
                className="flex-1 bg-transparent outline-none text-base text-[#222222] placeholder:text-[#717171]"
                autoFocus
              />
              {inputValue && (
                <button onClick={() => { setInputValue(''); setSuggestions([]) }}>
                  <X className="w-[15px] h-[15px] text-[#717171]" />
                </button>
              )}
            </div>
          </div>

          {/* Suggestions card */}
          {mergedSuggestions.length > 0 && (
            <div className="mx-5 mt-3 bg-white rounded-2xl shadow-lg border border-[#EBEBEB] overflow-hidden">
              {mergedSuggestions.map((f, i) => (
                <button
                  key={f.id}
                  onClick={() => selectSuggestion(f)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-[#F7F7F7] ${i < mergedSuggestions.length - 1 ? 'border-b border-[#EBEBEB]' : ''}`}
                >
                  <div className="w-8 h-8 rounded-full bg-[#F7F7F7] flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-[#5BA4CF]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#222222] truncate">{f.text.split(',')[0]}</p>
                    {f.place_name !== f.text && (
                      <p className="text-[11px] text-[#717171] truncate">{f.place_name}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Recent searches */}
          {!inputValue && recentSearches.length > 0 && (
            <div className="mx-5 mt-3">
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-[11px] font-semibold text-[#717171] uppercase tracking-wider">Recent</p>
                <button
                  onClick={() => { localStorage.removeItem(RECENT_KEY); setRecentSearches([]) }}
                  className="text-xs text-[#717171] font-medium"
                >
                  Clear
                </button>
              </div>
              <div className="bg-white rounded-2xl border border-[#EBEBEB] overflow-hidden shadow-sm">
                {recentSearches.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => selectRecent(item)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-[#F7F7F7] ${i < recentSearches.length - 1 ? 'border-b border-[#EBEBEB]' : ''}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-[#F7F7F7] flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-3.5 h-3.5 text-[#717171]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#222222] truncate">{item.text}</p>
                      <p className="text-[11px] text-[#717171] truncate">{item.placeName}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Nearby chips — shown when no query and no recents */}
          {!inputValue && recentSearches.length === 0 && (
            <div className="px-5 mt-5">
              <p className="text-[11px] font-semibold text-[#717171] uppercase tracking-wider mb-3">Nearby</p>
              <div className="flex flex-wrap gap-2">
                {['Bole', 'CMC', 'Kazanchis', 'Gerji', 'Sarbet', 'Old Airport'].map(area => (
                  <button
                    key={area}
                    onClick={() => setInputValue(area)}
                    className="px-4 py-2 bg-[#F7F7F7] text-[#222222] rounded-full text-[13px] font-medium"
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Mobile Filter Sheet ── */}
      {showMobileFilter && (
        <div className="lg:hidden fixed inset-0 z-[500]">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileFilter(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-4" />
            <div className="px-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-gray-900">Filters</h3>
                {hasActiveFilters && (
                  <button onClick={handleClearFilters} className="text-sm text-blue-600 font-medium">Clear all</button>
                )}
              </div>

              <div className="mb-5">
                <p className="text-sm font-semibold text-gray-800 mb-3">Bedrooms</p>
                <div className="flex gap-2 flex-wrap">
                  {[0, 1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => handleFilterChange('beds', n === 0 ? '' : String(n))}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${(n === 0 ? !filters.beds : filters.beds === String(n)) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                      {n === 0 ? 'Any' : `${n}+`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <p className="text-sm font-semibold text-gray-800 mb-3">Bathrooms</p>
                <div className="flex gap-2 flex-wrap">
                  {[0, 1, 2, 3].map(n => (
                    <button key={n} onClick={() => handleFilterChange('baths', n === 0 ? '' : String(n))}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${(n === 0 ? !filters.baths : filters.baths === String(n)) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                      {n === 0 ? 'Any' : `${n}+`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <p className="text-sm font-semibold text-gray-800 mb-3">Property Type</p>
                <div className="flex gap-2 flex-wrap">
                  {['', 'Apartment', 'House', 'Villa', 'Commercial'].map(t => (
                    <button key={t} onClick={() => handleFilterChange('propertyType', t)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${filters.propertyType === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                      {t || 'Any'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-800 mb-3">Furnished</p>
                <div className="flex gap-2">
                  {([['', 'Any'], ['true', 'Yes'], ['false', 'No']] as [string, string][]).map(([val, label]) => (
                    <button key={val} onClick={() => handleFilterChange('furnished', val)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${filters.furnished === val ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowMobileFilter(false)}
                className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold text-sm"
              >
                Show {filteredProperties.length} {filteredProperties.length === 1 ? s.property : s.properties}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close sort dropdown on outside tap */}
      {mobileSortOpen && (
        <div className="lg:hidden fixed inset-0 z-30" onClick={() => setMobileSortOpen(false)} />
      )}

    </div>
  )
}
