'use client'

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Search, SlidersHorizontal, X, Home, Key, User, Menu, Heart, Settings, Tag, UserPlus, Mail, TrendingUp, MapPin, Loader2, ChevronRight, ArrowLeft, LogOut } from 'lucide-react';
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
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecent(item: RecentSearch) {
  const current = loadRecent();
  const deduped = current.filter((s) => s.text !== item.text);
  localStorage.setItem(RECENT_KEY, JSON.stringify([item, ...deduped].slice(0, 5)));
}

export default function FilterPanel({ filters, searchQuery, onSearchChange, onLocationSelect, onFilterChange, onClearFilters, listingMode, onListingModeChange, onLogoClick, onSignInClick }: FilterPanelProps) {
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodingFeature[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { user, photoURL, signOut, loading } = useAuth();
  const [isAgent, setIsAgent] = useState(false);
  const [isAgentChecked, setIsAgentChecked] = useState(false);

  const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? '';

  const mergedSuggestions = useMemo(() => {
    const local = filterLocalPlaces(inputValue);
    const localNames = new Set(local.map(p => p.text.toLowerCase()));
    const remote = suggestions.filter(s => !localNames.has(s.text.toLowerCase()));
    return [...local, ...remote];
  }, [inputValue, suggestions]);

  useEffect(() => {
    if (!user || !WORKER_URL) { setIsAgent(false); setIsAgentChecked(false); return }
    user.getIdToken().then(token =>
      fetch(`${WORKER_URL}/listing`, { headers: { Authorization: `Bearer ${token}` } })
    ).then(async res => {
      if (!res.ok) { setIsAgentChecked(true); return }
      const data = await res.json() as { listings: unknown[]; isAgent: boolean }
      setIsAgent(data.isAgent ?? false)
      setIsAgentChecked(true)
    }).catch(() => setIsAgentChecked(true))
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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    if (showUserMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  // Debounced geocoding fetch
  useEffect(() => {
    const q = inputValue.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }
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
            const placeName = type === 'region'
              ? country
              : `${f.properties.name}, ${country}`;
            return {
              id: f.id,
              text: f.properties.name,
              place_name: placeName,
              center: f.geometry.coordinates,
              place_type: [type],
            };
          })
        );
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const openModal = () => {
    setInputValue('');
    setSuggestions([]);
    setRecentSearches(loadRecent());
    setShowSearchModal(true);
  };

  const selectSuggestion = (feature: GeocodingFeature) => {
    const zoom = zoomForType(feature.place_type);
    const [lng, lat] = feature.center;
    const item: RecentSearch = { text: feature.text, placeName: feature.place_name, lng, lat, zoom };
    saveRecent(item);
    onSearchChange(feature.text);
    onLocationSelect({ lng, lat, zoom });
    setShowSearchModal(false);
  };

  const selectRecent = (item: RecentSearch) => {
    onSearchChange(item.text);
    onLocationSelect({ lng: item.lng, lat: item.lat, zoom: item.zoom });
    setShowSearchModal(false);
  };

  return (
    <div className="sticky top-0 z-50 lg:static bg-white shadow-lg border-b border-gray-100">
      <div className="p-3 lg:p-5 space-y-3">
        <div className="flex items-center gap-2 lg:gap-4 flex-wrap">
          {user && (
            <button
              onClick={() => setShowMenu(true)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-all"
            >
              <Menu className="w-6 h-6 text-gray-700" />
            </button>
          )}

          <div
            onClick={onLogoClick}
            className={`${!user ? 'block' : 'hidden'} lg:block text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent cursor-pointer hover:scale-105 transition-transform`}
          >
            Yevilla
          </div>

          <div className="hidden lg:flex bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-1.5 gap-1 shadow-inner flex-shrink-0">
            <button
              onClick={() => onListingModeChange('buy')}
              className={`flex items-center gap-2 px-4 lg:px-5 py-2.5 rounded-lg transition-all text-sm lg:text-base font-medium ${
                listingMode === 'buy'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Buy</span>
            </button>
            <button
              onClick={() => onListingModeChange('rent')}
              className={`flex items-center gap-2 px-4 lg:px-5 py-2.5 rounded-lg transition-all text-sm lg:text-base font-medium ${
                listingMode === 'rent'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Key className="w-4 h-4" />
              <span>Rent</span>
            </button>
          </div>

          <div
            onClick={openModal}
            className={`flex items-center gap-3 flex-1 min-w-[150px] bg-gray-50 rounded-xl px-4 py-3 border hover:border-blue-500 transition-all cursor-pointer ${searchQuery ? 'border-blue-400' : 'border-gray-200'}`}
          >
            <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <span className={`flex-1 text-sm lg:text-base truncate ${searchQuery ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
              {searchQuery || 'City, Address, or ZIP'}
            </span>
            {searchQuery && (
              <button
                onClick={(e) => { e.stopPropagation(); onSearchChange(''); }}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="hidden lg:flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-500 transition-all font-medium text-gray-700 flex-shrink-0"
          >
            <SlidersHorizontal className="w-5 h-5 text-blue-600" />
            <span>Filters</span>
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="lg:hidden p-2.5 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all ml-auto"
          >
            <SlidersHorizontal className="w-5 h-5 text-gray-700" />
          </button>

          {!loading && (user ? (
            <button
              onClick={() => signOut()}
              className="lg:hidden px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-all"
            >
              Sign Out
            </button>
          ) : (
            <button
              onClick={onSignInClick}
              className="lg:hidden px-4 py-2 text-sm font-semibold text-blue-600 border-2 border-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"
            >
              Sign In
            </button>
          ))}

          <div className="hidden lg:flex items-center gap-3">
            {!loading && (user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu((v) => !v)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 transition-all"
                >
                  {photoURL
                    ? <img src={photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                    : <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">{user.displayName?.[0] ?? '?'}</div>
                  }
                  <span className="text-sm font-medium text-gray-700 max-w-[120px] truncate">{user.displayName}</span>
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${showUserMenu ? '-rotate-90' : 'rotate-90'}`} />
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
                      <button
                        onClick={() => { signOut(); setShowUserMenu(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-red-50 transition-all text-sm font-medium text-red-600"
                      >
                        <LogOut className="w-4 h-4" />Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onSignInClick}
                className="px-6 py-2.5 border-2 border-blue-600 text-blue-600 rounded-xl font-semibold hover:bg-blue-600 hover:text-white transition-all text-base"
              >
                Sign In
              </button>
            ))}
          </div>
        </div>

      </div>

      {showFilters && (
        <div
          className="fixed inset-0 bg-black/50 z-[1000] flex items-start justify-center p-0 lg:p-6 lg:items-center"
          onClick={() => setShowFilters(false)}
        >
          <div
            className="bg-white w-full h-full lg:h-auto lg:max-w-2xl lg:rounded-2xl overflow-y-auto lg:overflow-visible"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 lg:p-6 space-y-5 pb-24 lg:pb-6">
              <div className="flex items-center justify-between">
                <button onClick={() => setShowFilters(false)} className="p-2 -ml-2">
                  <X className="w-6 h-6 text-gray-900" />
                </button>
                <h2 className="text-lg font-bold text-gray-900">Filters</h2>
                <button onClick={onClearFilters} className="text-blue-600 font-semibold">Reset</button>
              </div>

              <div>
                <div className="flex bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-1.5 gap-1 shadow-inner">
                  <button
                    onClick={() => onListingModeChange('buy')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all text-sm font-medium ${listingMode === 'buy' ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    <Home className="w-4 h-4" /><span>Buy</span>
                  </button>
                  <button
                    onClick={() => onListingModeChange('rent')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all text-sm font-medium ${listingMode === 'rent' ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    <Key className="w-4 h-4" /><span>Rent</span>
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-gray-900 mb-2">Price Range</h3>
                <div className="flex items-center gap-2 lg:gap-3">
                  <select
                    value={filters.minPrice}
                    onChange={(e) => onFilterChange('minPrice', e.target.value)}
                    className="flex-1 px-3 lg:px-4 py-2.5 lg:py-3 border-2 border-gray-200 rounded-xl text-xs lg:text-sm font-medium focus:outline-none focus:border-blue-500 bg-white"
                  >
                    {priceOptions.min.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <span className="text-gray-400 text-xs">—</span>
                  <select
                    value={filters.maxPrice}
                    onChange={(e) => onFilterChange('maxPrice', e.target.value)}
                    className="flex-1 px-3 lg:px-4 py-2.5 lg:py-3 border-2 border-gray-200 rounded-xl text-xs lg:text-sm font-medium focus:outline-none focus:border-blue-500 bg-white"
                  >
                    {priceOptions.max.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-gray-900 mb-2">Beds</h3>
                <div className="grid grid-cols-6 gap-2">
                  {['', '1', '2', '3', '4', '5'].map((bed) => (
                    <button key={bed} onClick={() => onFilterChange('beds', bed)} className={`px-3 py-3 rounded-xl text-sm font-medium transition-all ${filters.beds === bed ? 'bg-blue-100 border-2 border-blue-500 text-blue-700' : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                      {bed === '' ? 'Any' : bed === '5' ? '5+' : bed}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-gray-900 mb-2">Baths</h3>
                <div className="grid grid-cols-5 gap-2">
                  {['', '1', '2', '3', '4'].map((bath) => (
                    <button key={bath} onClick={() => onFilterChange('baths', bath)} className={`px-3 py-3 rounded-xl text-sm font-medium transition-all ${filters.baths === bath ? 'bg-blue-100 border-2 border-blue-500 text-blue-700' : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                      {bath === '' ? 'Any' : bath === '4' ? '4+' : `${bath}+`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-gray-900 mb-2">Home Type</h3>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {[{ value: '', label: 'All' }, { value: 'House', label: 'House' }, { value: 'Condo', label: 'Condo' }, { value: 'Townhouse', label: 'Townhouse' }, { value: 'Multi-family', label: 'Multi-family' }, { value: 'Commercial', label: 'Commercial' }, { value: 'Land', label: 'Land' }].map((type) => (
                    <button key={type.value} onClick={() => onFilterChange('propertyType', type.value)} className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${filters.propertyType === type.value ? 'bg-blue-100 border-2 border-blue-500 text-blue-700' : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-gray-900 mb-2">Furnished</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[{ value: '', label: 'Any' }, { value: 'true', label: 'Furnished' }, { value: 'false', label: 'Unfurnished' }].map((opt) => (
                    <button key={opt.value} onClick={() => onFilterChange('furnished', opt.value)} className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${filters.furnished === opt.value ? 'bg-blue-100 border-2 border-blue-500 text-blue-700' : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="fixed lg:relative bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 lg:border-t-0 lg:p-0 lg:mt-2">
                <button onClick={() => setShowFilters(false)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-full text-base font-bold shadow-lg transition-all">
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMenu && user && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[1000] lg:hidden" onClick={() => setShowMenu(false)} />
          <div className="fixed top-0 left-0 h-full w-80 bg-white z-[1001] shadow-2xl lg:hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Yevilla</div>
              <button onClick={() => setShowMenu(false)} className="p-2 hover:bg-gray-100 rounded-full transition-all">
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>
            <div className="p-4 space-y-1">
              {user ? (
                <div className="flex items-center gap-3 px-4 py-3 mb-1">
                  {photoURL
                    ? <img src={photoURL} alt={user.displayName || ''} className="w-9 h-9 rounded-full object-cover flex-shrink-0" referrerPolicy="no-referrer" />
                    : <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">{user.displayName?.[0] ?? user.email?.[0]?.toUpperCase() ?? '?'}</div>
                  }
                  <div className="min-w-0">
                    {user.displayName && <p className="font-semibold text-gray-900 truncate text-sm">{user.displayName}</p>}
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                </div>
              ) : (
                <button onClick={() => { onSignInClick(); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 rounded-lg transition-all font-medium text-gray-700"><User className="w-5 h-5" />Sign In</button>
              )}
              <button onClick={() => { router.push('/favorites'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 rounded-lg transition-all font-medium text-gray-700"><Heart className="w-5 h-5" />Favorites</button>
              <button onClick={() => { router.push('/settings'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 rounded-lg transition-all font-medium text-gray-700"><Settings className="w-5 h-5" />Settings</button>
              <div className="border-t border-gray-200 my-2"></div>
              <button onClick={() => { router.push('/list-my-home'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 rounded-lg transition-all font-medium text-gray-700"><Key className="w-5 h-5" />My Listing</button>
              {isAgentChecked && !isAgent && (
                <button onClick={() => { router.push('/sell-my-home'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 rounded-lg transition-all font-medium text-gray-700"><Tag className="w-5 h-5" />Sell My Home</button>
              )}
              {isAgentChecked && !isAgent && (
                <button onClick={() => { router.push('/become-an-agent'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 rounded-lg transition-all font-medium text-gray-700"><UserPlus className="w-5 h-5" />Become an Agent</button>
              )}
              <div className="border-t border-gray-200 my-2"></div>
              <button onClick={() => { router.push('/contact'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 rounded-lg transition-all font-medium text-gray-700"><Mail className="w-5 h-5" />Contact Us</button>
              {user && (
                <>
                  <div className="border-t border-gray-200 my-2"></div>
                  <button
                    onClick={() => { signOut(); setShowMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-50 rounded-lg transition-all font-medium text-red-600"
                  >
                    <LogOut className="w-5 h-5" />Sign Out
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {showSearchModal && (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex items-start justify-center pt-20 lg:pt-20" onClick={() => setShowSearchModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              {/* Buy/Rent Toggle */}
              <div className="flex bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-1.5 gap-1 shadow-inner mb-4">
                <button onClick={() => onListingModeChange('buy')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all text-sm font-medium ${listingMode === 'buy' ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30' : 'text-gray-600 hover:text-gray-900'}`}>
                  <Home className="w-4 h-4" /><span>Buy</span>
                </button>
                <button onClick={() => onListingModeChange('rent')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all text-sm font-medium ${listingMode === 'rent' ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30' : 'text-gray-600 hover:text-gray-900'}`}>
                  <Key className="w-4 h-4" /><span>Rent</span>
                </button>
              </div>

              {/* Search Input */}
              <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
                {isLoading
                  ? <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />
                  : <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
                }
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && mergedSuggestions.length > 0) selectSuggestion(mergedSuggestions[0]);
                    if (e.key === 'Escape') setShowSearchModal(false);
                  }}
                  placeholder="Search by city, address, or ZIP..."
                  className="flex-1 outline-none text-lg"
                  autoFocus
                />
                {inputValue && (
                  <button onClick={() => { setInputValue(''); setSuggestions([]); }} className="p-1 hover:bg-gray-100 rounded-full">
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                )}
              </div>

              {/* Suggestions */}
              {mergedSuggestions.length > 0 && (
                <div className="space-y-1 mb-4">
                  {mergedSuggestions.map((feature) => (
                    <button
                      key={feature.id}
                      onClick={() => selectSuggestion(feature)}
                      className="w-full flex items-start gap-3 p-3 hover:bg-blue-50 rounded-xl transition-all text-left"
                    >
                      <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 text-sm truncate">{feature.text.split(',')[0]}</div>
                        <div className="text-xs text-gray-500 truncate">{feature.place_name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Recent Searches — shown when not typing */}
              {!inputValue && recentSearches.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 text-sm">Recent Searches</h3>
                    <button
                      onClick={() => { localStorage.removeItem(RECENT_KEY); setRecentSearches([]); }}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="space-y-1">
                    {recentSearches.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => selectRecent(item)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-all text-left"
                      >
                        <TrendingUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-700 truncate">{item.text}</div>
                          <div className="text-xs text-gray-400 truncate">{item.placeName}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Nearby chips — shown when not typing and no recents */}
              {!inputValue && recentSearches.length === 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm">Nearby</h3>
                  <div className="flex flex-wrap gap-2">
                    {['Bole', 'CMC', 'Kazanchis', 'Gerji', 'Sarbet', 'Old Airport'].map((area) => (
                      <button
                        key={area}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-100 transition-all"
                        onClick={() => { setInputValue(area); }}
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
