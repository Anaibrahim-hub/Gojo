'use client'

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  Search, SlidersHorizontal, X, Home, Key, User, Menu, Heart,
  Settings, Tag, UserPlus, Mail, TrendingUp, MapPin, Loader2,
  ChevronRight, LogOut, ChevronDown,
} from 'lucide-react';
import { filterLocalPlaces } from '@/app/data/places';

interface FilterPanelProps {
  filters: {
    minPrice: string;
    maxPrice: string;
    beds: string;
    baths: string;
    minSqft: string;
    status: string;
    propertyType: string;
    furnished: string;
  };
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onLocationSelect: (coords: { lng: number; lat: number; zoom: number }) => void;
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
  listingMode: 'buy' | 'rent';
  onListingModeChange: (mode: 'buy' | 'rent') => void;
  onLogoClick: () => void;
  onSignInClick: () => void;
}

interface GeocodingFeature {
  id: string;
  place_name: string;
  text: string;
  center: [number, number];
  place_type: string[];
}

interface RecentSearch {
  text: string;
  placeName: string;
  lng: number;
  lat: number;
  zoom: number;
}

const RECENT_KEY = 'gojo_recent_searches';

function zoomForType(types: string[]): number {
  if (types.includes('address')) return 15;
  if (types.includes('neighborhood') || types.includes('locality')) return 13;
  if (types.includes('postcode')) return 13;
  if (types.includes('place')) return 11;
  if (types.includes('region')) return 8;
  return 12;
}

function loadRecent(): RecentSearch[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}

function saveRecent(item: RecentSearch) {
  const deduped = loadRecent().filter(s => s.text !== item.text);
  localStorage.setItem(RECENT_KEY, JSON.stringify([item, ...deduped].slice(0, 5)));
}

function compactPrice(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

export default function FilterPanel({
  filters, searchQuery, onSearchChange, onLocationSelect,
  onFilterChange, onClearFilters, listingMode, onListingModeChange,
  onLogoClick, onSignInClick,
}: FilterPanelProps) {
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<null | 'price' | 'beds' | 'type'>(null);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodingFeature[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const filterChipsRef = useRef<HTMLDivElement>(null);
  const { user, photoURL, signOut, loading } = useAuth();
  const [isAgent, setIsAgent] = useState(false);
  const [isAgentChecked, setIsAgentChecked] = useState(false);

  const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? '';

  // Outside click — user menu
  useEffect(() => {
    if (!showUserMenu) return;
    function handle(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showUserMenu]);

  // Outside click — filter dropdowns
  useEffect(() => {
    if (!openDropdown) return;
    function handle(e: MouseEvent) {
      if (filterChipsRef.current && !filterChipsRef.current.contains(e.target as Node)) setOpenDropdown(null);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [openDropdown]);

  useEffect(() => {
    if (!user || !WORKER_URL) { setIsAgent(false); setIsAgentChecked(false); return; }
    user.getIdToken().then(token =>
      fetch(`${WORKER_URL}/listing`, { headers: { Authorization: `Bearer ${token}` } })
    ).then(async res => {
      if (!res.ok) { setIsAgentChecked(true); return; }
      const data = await res.json() as { listings: unknown[]; isAgent: boolean };
      setIsAgent(data.isAgent ?? false);
      setIsAgentChecked(true);
    }).catch(() => setIsAgentChecked(true));
  }, [user]);

  const buyPriceOptions = {
    min: [
      { label: 'Min Price', value: '' },
      { label: 'ETB 5M', value: '5000000' },
      { label: 'ETB 10M', value: '10000000' },
      { label: 'ETB 15M', value: '15000000' },
      { label: 'ETB 25M', value: '25000000' },
      { label: 'ETB 40M', value: '40000000' },
    ],
    max: [
      { label: 'Max Price', value: '' },
      { label: 'ETB 15M', value: '15000000' },
      { label: 'ETB 25M', value: '25000000' },
      { label: 'ETB 40M', value: '40000000' },
      { label: 'ETB 60M', value: '60000000' },
      { label: 'ETB 100M', value: '100000000' },
    ],
  };

  const rentPriceOptions = {
    min: [
      { label: 'Min Rent', value: '' },
      { label: 'ETB 15,000', value: '15000' },
      { label: 'ETB 25,000', value: '25000' },
      { label: 'ETB 40,000', value: '40000' },
      { label: 'ETB 70,000', value: '70000' },
      { label: 'ETB 100,000', value: '100000' },
    ],
    max: [
      { label: 'Max Rent', value: '' },
      { label: 'ETB 40,000', value: '40000' },
      { label: 'ETB 75,000', value: '75000' },
      { label: 'ETB 120,000', value: '120000' },
      { label: 'ETB 200,000', value: '200000' },
      { label: 'ETB 300,000', value: '300000' },
    ],
  };

  const priceOptions = listingMode === 'buy' ? buyPriceOptions : rentPriceOptions;

  // Chip labels (null = not active)
  const priceChipLabel = useMemo(() => {
    const { minPrice, maxPrice } = filters;
    if (!minPrice && !maxPrice) return null;
    if (minPrice && maxPrice) return `ETB ${compactPrice(+minPrice)}–${compactPrice(+maxPrice)}`;
    if (minPrice) return `From ETB ${compactPrice(+minPrice)}`;
    return `Up to ETB ${compactPrice(+maxPrice)}`;
  }, [filters.minPrice, filters.maxPrice]);

  const bedsChipLabel = useMemo(() => {
    const parts: string[] = [];
    if (filters.beds) parts.push(`${filters.beds}+ bd`);
    if (filters.baths) parts.push(`${filters.baths}+ ba`);
    return parts.length ? parts.join(', ') : null;
  }, [filters.beds, filters.baths]);

  const typeChipLabel = filters.propertyType || null;
  const hasMoreFilters = !!filters.furnished;

  const mergedSuggestions = useMemo(() => {
    const local = filterLocalPlaces(inputValue);
    const localNames = new Set(local.map(p => p.text.toLowerCase()));
    return [...local, ...suggestions.filter(s => !localNames.has(s.text.toLowerCase()))];
  }, [inputValue, suggestions]);

  // Geocoding debounce
  useEffect(() => {
    const q = inputValue.trim();
    if (q.length < 2) { setSuggestions([]); setIsLoading(false); return; }
    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        const res = await fetch(
          `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&access_token=${token}&country=et&types=region,place,neighborhood,postcode,address&limit=5&proximity=38.7578,9.0320`
        );
        const data = await res.json();
        setSuggestions(
          (data.features || []).map((f: { id: string; geometry: { coordinates: [number, number] }; properties: { name: string; feature_type: string; context?: { place?: { name: string }; country?: { name: string } } } }) => {
            const type = f.properties.feature_type;
            const country = f.properties.context?.country?.name ?? 'Ethiopia';
            const placeName = type === 'region' ? country : `${f.properties.name}, ${country}`;
            return { id: f.id, text: f.properties.name, place_name: placeName, center: f.geometry.coordinates, place_type: [type] };
          })
        );
      } catch { setSuggestions([]); }
      finally { setIsLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const openModal = () => {
    setInputValue(''); setSuggestions([]); setRecentSearches(loadRecent()); setShowSearchModal(true);
  };

  const selectSuggestion = (feature: GeocodingFeature) => {
    const zoom = zoomForType(feature.place_type);
    const [lng, lat] = feature.center;
    saveRecent({ text: feature.text, placeName: feature.place_name, lng, lat, zoom });
    onSearchChange(feature.text);
    onLocationSelect({ lng, lat, zoom });
    setShowSearchModal(false);
  };

  const selectRecent = (item: RecentSearch) => {
    onSearchChange(item.text);
    onLocationSelect({ lng: item.lng, lat: item.lat, zoom: item.zoom });
    setShowSearchModal(false);
  };

  // ── Shared chip class helper ──────────────────────────────────────────────
  const chip = (active: boolean) =>
    `flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border transition-all whitespace-nowrap ${
      active
        ? 'bg-gray-900 text-white border-gray-900'
        : 'text-gray-700 border-gray-300 hover:border-gray-500 bg-white'
    }`;

  return (
    <div className="sticky top-0 z-50 lg:static bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center gap-2 lg:gap-3 px-3 lg:px-4 h-14">

        {/* Mobile: hamburger for logged-in users */}
        {user && (
          <button
            onClick={() => setShowMenu(true)}
            className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg transition-all flex-shrink-0"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
        )}

        {/* Logo */}
        <div
          onClick={onLogoClick}
          className={`${!user ? 'block' : 'hidden'} lg:block text-xl font-bold text-gray-900 cursor-pointer flex-shrink-0 select-none`}
        >
          Yevilla
        </div>

        {/* Desktop: Buy / Rent segmented control */}
        <div className="hidden lg:flex items-center border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
          <button
            onClick={() => onListingModeChange('buy')}
            className={`px-4 py-1.5 text-sm font-medium transition-all ${
              listingMode === 'buy' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => onListingModeChange('rent')}
            className={`px-4 py-1.5 text-sm font-medium transition-all ${
              listingMode === 'rent' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Rent
          </button>
        </div>

        {/* Search bar */}
        <div
          onClick={openModal}
          className={`flex items-center gap-2 flex-1 min-w-0 border rounded-lg px-3 py-2 cursor-pointer transition-all ${
            searchQuery ? 'border-gray-900' : 'border-gray-200 hover:border-gray-400'
          }`}
        >
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className={`flex-1 text-sm truncate ${searchQuery ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
            {searchQuery || <span className="hidden lg:inline">City, Address, or Sub-City</span>}
            {!searchQuery && <span className="lg:hidden">Search</span>}
          </span>
          {searchQuery && (
            <button
              onClick={(e) => { e.stopPropagation(); onSearchChange(''); }}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Desktop: inline filter chips */}
        <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0" ref={filterChipsRef}>

          {/* Price */}
          <div className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === 'price' ? null : 'price')}
              className={chip(!!priceChipLabel)}
            >
              <span>{priceChipLabel ?? 'Price'}</span>
              <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
            </button>
            {openDropdown === 'price' && (
              <div className="absolute top-full left-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-xl z-50 p-4 w-60">
                <p className="text-sm font-semibold text-gray-900 mb-3">Price Range</p>
                <div className="space-y-2">
                  <select
                    value={filters.minPrice}
                    onChange={(e) => onFilterChange('minPrice', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-gray-400 bg-white"
                  >
                    {priceOptions.min.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <select
                    value={filters.maxPrice}
                    onChange={(e) => onFilterChange('maxPrice', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-gray-400 bg-white"
                  >
                    {priceOptions.max.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Beds & Baths */}
          <div className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === 'beds' ? null : 'beds')}
              className={chip(!!bedsChipLabel)}
            >
              <span>{bedsChipLabel ?? 'Beds & Baths'}</span>
              <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
            </button>
            {openDropdown === 'beds' && (
              <div className="absolute top-full left-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-xl z-50 p-4 w-64">
                <p className="text-sm font-semibold text-gray-900 mb-2">Bedrooms</p>
                <div className="flex gap-1.5 mb-4">
                  {['', '1', '2', '3', '4', '5'].map(b => (
                    <button
                      key={b}
                      onClick={() => onFilterChange('beds', b)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        filters.beds === b ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {b === '' ? 'Any' : b === '5' ? '5+' : b}
                    </button>
                  ))}
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-2">Bathrooms</p>
                <div className="flex gap-1.5">
                  {['', '1', '2', '3', '4'].map(b => (
                    <button
                      key={b}
                      onClick={() => onFilterChange('baths', b)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        filters.baths === b ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {b === '' ? 'Any' : `${b}+`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Home Type */}
          <div className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
              className={chip(!!typeChipLabel)}
            >
              <span>{typeChipLabel ?? 'Home Type'}</span>
              <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
            </button>
            {openDropdown === 'type' && (
              <div className="absolute top-full left-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-xl z-50 p-2 w-48">
                {['', 'House', 'Condo', 'Townhouse', 'Multi-family', 'Commercial', 'Land'].map(t => (
                  <button
                    key={t}
                    onClick={() => { onFilterChange('propertyType', t); setOpenDropdown(null); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                      filters.propertyType === t ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {t === '' ? 'All Types' : t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* More filters */}
          <button
            onClick={() => { setOpenDropdown(null); setShowFilters(true); }}
            className={chip(hasMoreFilters)}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>More</span>
          </button>
        </div>

        {/* Mobile: filter icon */}
        <button
          onClick={() => setShowFilters(true)}
          className="lg:hidden p-2 border border-gray-200 rounded-lg hover:border-gray-400 transition-all flex-shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4 text-gray-600" />
        </button>

        {/* Desktop divider */}
        <div className="hidden lg:block w-px h-6 bg-gray-200 flex-shrink-0" />

        {/* User avatar / Sign In (desktop) */}
        <div className="hidden lg:flex items-center">
          {!loading && (user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(v => !v)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-all"
              >
                {photoURL
                  ? <img src={photoURL} alt={user.displayName || ''} className="w-7 h-7 rounded-full object-cover" referrerPolicy="no-referrer" />
                  : <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">{user.displayName?.[0] ?? '?'}</div>
                }
                <span className="text-sm font-medium text-gray-700 max-w-[100px] truncate">{user.displayName}</span>
                <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showUserMenu ? '-rotate-90' : 'rotate-90'}`} />
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    {user.displayName && <p className="text-sm font-semibold text-gray-900 truncate">{user.displayName}</p>}
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <div className="py-1">
                    <button onClick={() => { router.push('/favorites'); setShowUserMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-all text-sm font-medium text-gray-700">
                      <Heart className="w-4 h-4 text-gray-400" />Favorites
                    </button>
                    <button onClick={() => { router.push('/settings'); setShowUserMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-all text-sm font-medium text-gray-700">
                      <Settings className="w-4 h-4 text-gray-400" />Settings
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button onClick={() => { router.push('/list-my-home'); setShowUserMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-all text-sm font-medium text-gray-700">
                      <Key className="w-4 h-4 text-gray-400" />My Listing
                    </button>
                    {isAgentChecked && !isAgent && (
                      <button onClick={() => { router.push('/sell-my-home'); setShowUserMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-all text-sm font-medium text-gray-700">
                        <Tag className="w-4 h-4 text-gray-400" />Sell My Home
                      </button>
                    )}
                    {isAgentChecked && !isAgent && (
                      <button onClick={() => { router.push('/become-an-agent'); setShowUserMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-all text-sm font-medium text-gray-700">
                        <UserPlus className="w-4 h-4 text-gray-400" />Become an Agent
                      </button>
                    )}
                    <div className="border-t border-gray-100 my-1" />
                    <button onClick={() => { router.push('/contact'); setShowUserMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-all text-sm font-medium text-gray-700">
                      <Mail className="w-4 h-4 text-gray-400" />Contact Us
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button onClick={() => { signOut(); setShowUserMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-red-50 transition-all text-sm font-medium text-red-600">
                      <LogOut className="w-4 h-4" />Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onSignInClick}
              className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:border-gray-500 hover:text-gray-900 transition-all"
            >
              Sign In
            </button>
          ))}
        </div>

        {/* Mobile: Sign In (not logged in only) */}
        {!loading && !user && (
          <button
            onClick={onSignInClick}
            className="lg:hidden px-3 py-1.5 text-sm font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-all flex-shrink-0"
          >
            Sign In
          </button>
        )}
      </div>

      {/* ── Filter modal (mobile full-screen / desktop centered) ── */}
      {showFilters && (
        <div
          className="fixed inset-0 bg-black/50 z-[1000] flex items-start justify-center p-0 lg:p-6 lg:items-center"
          onClick={() => setShowFilters(false)}
        >
          <div
            className="bg-white w-full h-full lg:h-auto lg:max-w-2xl lg:rounded-2xl overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 lg:p-6 space-y-5 pb-24 lg:pb-6">
              <div className="flex items-center justify-between">
                <button onClick={() => setShowFilters(false)} className="p-2 -ml-2">
                  <X className="w-6 h-6 text-gray-900" />
                </button>
                <h2 className="text-base font-bold text-gray-900">All Filters</h2>
                <button onClick={onClearFilters} className="text-sm font-semibold text-blue-600">Reset</button>
              </div>

              {/* Buy / Rent — shown in modal on mobile */}
              <div className="lg:hidden">
                <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => onListingModeChange('buy')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all ${listingMode === 'buy' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    <Home className="w-4 h-4" />Buy
                  </button>
                  <button
                    onClick={() => onListingModeChange('rent')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all border-l border-gray-200 ${listingMode === 'rent' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    <Key className="w-4 h-4" />Rent
                  </button>
                </div>
              </div>

              {/* Price */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-2">Price Range</h3>
                <div className="flex items-center gap-2">
                  <select
                    value={filters.minPrice}
                    onChange={e => onFilterChange('minPrice', e.target.value)}
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-gray-400 bg-white"
                  >
                    {priceOptions.min.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <span className="text-gray-400 text-xs">—</span>
                  <select
                    value={filters.maxPrice}
                    onChange={e => onFilterChange('maxPrice', e.target.value)}
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-gray-400 bg-white"
                  >
                    {priceOptions.max.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Beds */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-2">Beds</h3>
                <div className="grid grid-cols-6 gap-2">
                  {['', '1', '2', '3', '4', '5'].map(bed => (
                    <button key={bed} onClick={() => onFilterChange('beds', bed)} className={`px-2 py-2.5 rounded-xl text-sm font-medium transition-all ${filters.beds === bed ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-400'}`}>
                      {bed === '' ? 'Any' : bed === '5' ? '5+' : bed}
                    </button>
                  ))}
                </div>
              </div>

              {/* Baths */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-2">Baths</h3>
                <div className="grid grid-cols-5 gap-2">
                  {['', '1', '2', '3', '4'].map(bath => (
                    <button key={bath} onClick={() => onFilterChange('baths', bath)} className={`px-2 py-2.5 rounded-xl text-sm font-medium transition-all ${filters.baths === bath ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-400'}`}>
                      {bath === '' ? 'Any' : bath === '4' ? '4+' : `${bath}+`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Home Type */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-2">Home Type</h3>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {[{ value: '', label: 'All' }, { value: 'House', label: 'House' }, { value: 'Condo', label: 'Condo' }, { value: 'Townhouse', label: 'Townhouse' }, { value: 'Multi-family', label: 'Multi-family' }, { value: 'Commercial', label: 'Commercial' }, { value: 'Land', label: 'Land' }].map(t => (
                    <button key={t.value} onClick={() => onFilterChange('propertyType', t.value)} className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${filters.propertyType === t.value ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-400'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Furnished */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-2">Furnished</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[{ value: '', label: 'Any' }, { value: 'true', label: 'Furnished' }, { value: 'false', label: 'Unfurnished' }].map(o => (
                    <button key={o.value} onClick={() => onFilterChange('furnished', o.value)} className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${filters.furnished === o.value ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-400'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="fixed lg:relative bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 lg:border-0 lg:p-0">
                <button
                  onClick={() => setShowFilters(false)}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3.5 rounded-xl text-sm font-bold transition-all"
                >
                  Show results
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile menu drawer ── */}
      {showMenu && user && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[1000] lg:hidden" onClick={() => setShowMenu(false)} />
          <div className="fixed top-0 left-0 h-full w-72 bg-white z-[1001] shadow-2xl lg:hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Yevilla</div>
              <button onClick={() => setShowMenu(false)} className="p-2 hover:bg-gray-100 rounded-full transition-all">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-3 space-y-0.5">
              {user && (
                <div className="flex items-center gap-3 px-3 py-3 mb-1">
                  {photoURL
                    ? <img src={photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full object-cover flex-shrink-0" referrerPolicy="no-referrer" />
                    : <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">{user.displayName?.[0] ?? user.email?.[0]?.toUpperCase() ?? '?'}</div>
                  }
                  <div className="min-w-0">
                    {user.displayName && <p className="font-semibold text-gray-900 truncate text-sm">{user.displayName}</p>}
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                </div>
              )}
              {[
                { icon: Heart, label: 'Favorites', path: '/favorites' },
                { icon: Settings, label: 'Settings', path: '/settings' },
              ].map(item => (
                <button key={item.path} onClick={() => { router.push(item.path); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 rounded-lg transition-all text-sm font-medium text-gray-700">
                  <item.icon className="w-4 h-4 text-gray-400" />{item.label}
                </button>
              ))}
              <div className="border-t border-gray-100 my-1.5" />
              <button onClick={() => { router.push('/list-my-home'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 rounded-lg transition-all text-sm font-medium text-gray-700">
                <Key className="w-4 h-4 text-gray-400" />My Listing
              </button>
              {isAgentChecked && !isAgent && (
                <button onClick={() => { router.push('/sell-my-home'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 rounded-lg transition-all text-sm font-medium text-gray-700">
                  <Tag className="w-4 h-4 text-gray-400" />Sell My Home
                </button>
              )}
              {isAgentChecked && !isAgent && (
                <button onClick={() => { router.push('/become-an-agent'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 rounded-lg transition-all text-sm font-medium text-gray-700">
                  <UserPlus className="w-4 h-4 text-gray-400" />Become an Agent
                </button>
              )}
              <div className="border-t border-gray-100 my-1.5" />
              <button onClick={() => { router.push('/contact'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 rounded-lg transition-all text-sm font-medium text-gray-700">
                <Mail className="w-4 h-4 text-gray-400" />Contact Us
              </button>
              <div className="border-t border-gray-100 my-1.5" />
              <button onClick={() => { signOut(); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-red-50 rounded-lg transition-all text-sm font-medium text-red-600">
                <LogOut className="w-4 h-4" />Sign Out
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Search modal ── */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex items-start justify-center pt-16 lg:pt-20" onClick={() => setShowSearchModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-5">
              {/* Search input */}
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-4">
                {isLoading
                  ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
                  : <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                }
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && mergedSuggestions.length > 0) selectSuggestion(mergedSuggestions[0]);
                    if (e.key === 'Escape') setShowSearchModal(false);
                  }}
                  placeholder="Search by city, address, or sub-city…"
                  className="flex-1 outline-none text-base text-gray-900 placeholder:text-gray-400"
                  autoFocus
                />
                {inputValue && (
                  <button onClick={() => { setInputValue(''); setSuggestions([]); }} className="p-1 hover:bg-gray-100 rounded-full">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>

              {/* Suggestions */}
              {mergedSuggestions.length > 0 && (
                <div className="space-y-0.5 mb-2">
                  {mergedSuggestions.map(feature => (
                    <button
                      key={feature.id}
                      onClick={() => selectSuggestion(feature)}
                      className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-xl transition-all text-left"
                    >
                      <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{feature.text.split(',')[0]}</p>
                        <p className="text-xs text-gray-400 truncate">{feature.place_name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Recent searches */}
              {!inputValue && recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent</p>
                    <button onClick={() => { localStorage.removeItem(RECENT_KEY); setRecentSearches([]); }} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                      Clear
                    </button>
                  </div>
                  <div className="space-y-0.5">
                    {recentSearches.map((item, i) => (
                      <button key={i} onClick={() => selectRecent(item)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-xl transition-all text-left">
                        <TrendingUp className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate">{item.text}</p>
                          <p className="text-xs text-gray-400 truncate">{item.placeName}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Nearby chips */}
              {!inputValue && recentSearches.length === 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Nearby</p>
                  <div className="flex flex-wrap gap-2">
                    {['Bole', 'CMC', 'Kazanchis', 'Gerji', 'Sarbet', 'Old Airport'].map(area => (
                      <button
                        key={area}
                        onClick={() => setInputValue(area)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-200 transition-all"
                      >
                        {area}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
