'use client'

import React, { useState, useRef, useEffect } from 'react';
import { Search, User, TrendingUp, Home, Key, MessageCircle, ChevronRight, X, Menu, Heart, Settings, Tag, UserPlus, LogOut, MapPin, Loader2, Mail, Share2, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useFavorites } from '@/lib/favorites-context';
import { type Property } from '@/app/data/properties';
import SignInModal from './SignInModal';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''

function uidToNumId(uid: string): number {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = (Math.imul(31, h) + uid.charCodeAt(i)) | 0
  return Math.abs(h) + 1000
}

function apiListingToProperty(d: Record<string, unknown>): Property {
  const photos = (d.photos as { url: string }[] | undefined) ?? []
  return {
    id: uidToNumId(d.id as string),
    firestoreId: d.id as string,
    price: 0,
    rent: (d.monthlyRent as number) ?? 0,
    address: (d.landmark as string) ||
      [(d.subCity as string), (d.woreda as string)].filter(Boolean).join(', ') ||
      (d.city as string) || '',
    city: (d.city as string) ?? '',
    state: '',
    zip: '',
    beds: (d.bedrooms as number) ?? 0,
    baths: (d.bathrooms as number) ?? 0,
    sqft: (d.areaSqm as number) ?? 0,
    status: (d.status as string) === 'published' ? 'active' : 'pending',
    image: photos[0]?.url ?? 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800',
    photos: photos.map(p => p.url),
    lat: (d.lat as number | null) ?? null,
    lng: (d.lng as number | null) ?? null,
    type: 'rent',
    propertyType: (d.propertyType as string) ?? '',
    furnished: ((d.amenities as string[] | undefined) ?? []).includes('Furnished'),
    ownerDisplayName: (d.ownerDisplayName as string) ?? undefined,
    ownerPhotoURL: (d.ownerPhotoURL as string) ?? undefined,
    ownerEmail: (d.ownerEmail as string) ?? undefined,
    subCity: (d.subCity as string) ?? undefined,
    woreda: (d.woreda as string) ?? undefined,
    kebele: (d.kebele as string) ?? undefined,
    landmark: (d.landmark as string) ?? undefined,
    availableFrom: (d.availableFrom as string | null) ?? null,
    description: (d.description as string) ?? undefined,
    amenities: (d.amenities as string[]) ?? [],
  }
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

interface HomePageProps {
  onNavigateToMap: (mode?: 'buy' | 'rent', location?: { q: string; lat: number; lng: number; zoom: number }) => void;
  onPropertyClick: (property: Property) => void;
}

const RECENT_KEY = 'gojo_recent_searches';

function zoomForType(types: string[]): number {
  if (types.includes('address')) return 15;
  if (types.includes('neighborhood') || types.includes('locality')) return 13;
  if (types.includes('postcode')) return 13;
  if (types.includes('place')) return 11;
  return 12;
}

function loadRecent(): RecentSearch[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}

function saveRecent(item: RecentSearch) {
  const current = loadRecent();
  const deduped = current.filter((s) => s.text !== item.text);
  localStorage.setItem(RECENT_KEY, JSON.stringify([item, ...deduped].slice(0, 5)));
}

export default function HomePage({ onNavigateToMap, onPropertyClick }: HomePageProps) {
  const router = useRouter();
  const { user, photoURL, signOut } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [recommendedIndex, setRecommendedIndex] = useState(0);
  const [forSaleIndex, setForSaleIndex] = useState(0);
  const [forRentIndex, setForRentIndex] = useState(0);
  const [searchListingMode, setSearchListingMode] = useState<'buy' | 'rent'>('buy');
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodingFeature[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiListings, setApiListings] = useState<Property[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [myListing, setMyListing] = useState<Property | null>(null);
  const [isAgent, setIsAgent] = useState(false);
  const [isAgentChecked, setIsAgentChecked] = useState(false);
  const [sharedId, setSharedId] = useState<number | null>(null);
  const [agentLocation, setAgentLocation] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentPhone, setAgentPhone] = useState('');
  const [agentMessage, setAgentMessage] = useState('');
  const [agentSubmitting, setAgentSubmitting] = useState(false);
  const [agentSubmitted, setAgentSubmitted] = useState(false);
  const [agentError, setAgentError] = useState('');

  const handleShare = async (e: React.MouseEvent, property: Property) => {
    e.stopPropagation();
    const url = `${window.location.origin}/listings?q=${encodeURIComponent(property.address)}`;
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if (isMobile && navigator.share) {
      try { await navigator.share({ title: property.address, text: `${property.address}, ${property.city}`, url }); } catch { /* cancelled */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement('textarea');
      el.value = url;
      el.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setSharedId(property.id);
    setTimeout(() => setSharedId(null), 2000);
  };

  const recommendedRef = useRef<HTMLDivElement>(null);
  const forSaleRef = useRef<HTMLDivElement>(null);
  const forRentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    if (showUserMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);


  const formatPrice = (price: number) => {
    if (price >= 1_000_000) return 'Br ' + (price / 1_000_000).toFixed(1) + 'M';
    return 'Br ' + (price / 1_000).toFixed(0) + 'K';
  };

  useEffect(() => {
    const q = inputValue.trim();
    if (q.length < 2) { setSuggestions([]); setIsLoading(false); return; }
    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${token}&country=et&types=place,neighborhood,postcode,address,locality&limit=5`
        );
        const data = await res.json();
        setSuggestions(data.features || []);
      } catch { setSuggestions([]); }
      finally { setIsLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  useEffect(() => {
    if (!WORKER_URL) { setLoadingListings(false); return }
    fetch(`${WORKER_URL}/listings`)
      .then(async res => {
        if (!res.ok) return
        const data = await res.json() as Record<string, unknown>[]
        setApiListings(data.map(apiListingToProperty))
      })
      .catch(() => {/* Worker unavailable */})
      .finally(() => setLoadingListings(false))
  }, [])

  useEffect(() => {
    if (!user || !WORKER_URL) { setMyListing(null); setIsAgent(false); setIsAgentChecked(false); return }
    user.getIdToken().then(token =>
      fetch(`${WORKER_URL}/listing`, { headers: { Authorization: `Bearer ${token}` } })
    ).then(async res => {
      if (!res.ok) { setMyListing(null); setIsAgentChecked(true); return }
      const data = await res.json() as { listings: Record<string, unknown>[]; isAgent: boolean }
      setIsAgent(data.isAgent ?? false)
      setIsAgentChecked(true)
      const first = data.listings?.[0]
      setMyListing(first ? apiListingToProperty(first) : null)
    }).catch(() => { setMyListing(null); setIsAgentChecked(true) })
  }, [user])

  async function handleAgentFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agentEmail.trim()) { setAgentError('Please enter your email address.'); return; }
    setAgentSubmitting(true);
    setAgentError('');
    try {
      const res = await fetch(`${WORKER_URL}/submit-form`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'talk-to-agent',
          fields: {
            ...(agentLocation && { 'Searching In': agentLocation }),
            'Email': agentEmail,
            ...(agentPhone && { 'Phone': agentPhone }),
            ...(agentMessage && { 'Message': agentMessage }),
          },
        }),
      });
      if (!res.ok) throw new Error();
      setAgentSubmitted(true);
    } catch {
      setAgentError('Something went wrong. Please try again.');
    } finally {
      setAgentSubmitting(false);
    }
  }

  const openSearchModal = () => {
    setInputValue('');
    setSuggestions([]);
    setRecentSearches(loadRecent());
    setShowSearchModal(true);
  };

  const selectSuggestion = (feature: GeocodingFeature) => {
    const zoom = zoomForType(feature.place_type);
    const [lng, lat] = feature.center;
    const text = feature.text.split(',')[0];
    saveRecent({ text, placeName: feature.place_name, lng, lat, zoom });
    setShowSearchModal(false);
    onNavigateToMap(searchListingMode, { q: text, lat, lng, zoom });
  };

  const selectRecent = (item: RecentSearch) => {
    setShowSearchModal(false);
    onNavigateToMap(searchListingMode, { q: item.text, lat: item.lat, lng: item.lng, zoom: item.zoom });
  };

  const recommendations = apiListings.slice(0, 3)
  const forSale = apiListings.filter(p => p.type === 'sale' || p.type === 'both')
  const forRent = apiListings.filter(p => p.type === 'rent' || p.type === 'both')

  const footerLinks = {
    findUs: [
      { title: 'Contact Us', href: '/contact' },
      { title: 'Office Locations', href: '/contact' },
      { title: 'Community Events', href: '/contact' },
    ],
    joinUs: [
      { title: 'Become an Agent', href: '/become-an-agent' },
      { title: 'Careers', href: '/contact' },
      { title: 'Culture & Values', href: '/contact' },
    ],
    more: [
      { title: 'List Your Property', href: '/list-my-home' },
      { title: 'Market Reports', href: '/contact' },
      { title: 'Home Valuation Tool', href: '/contact' },
      { title: 'Mortgage Calculator', href: '/contact' },
    ],
    legal: [
      { title: 'Privacy Policy', href: '/privacy' },
      { title: 'Terms of Use', href: '/terms' },
    ],
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {user && (
              <button
                onClick={() => setShowMenu(true)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-all"
              >
                <Menu className="w-6 h-6 text-gray-700" />
              </button>
            )}

            <div className="text-xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Yevilla
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-3">
            {user ? (
              <>
                {/* Desktop user menu */}
                <div className="relative hidden lg:block" ref={userMenuRef}>
                  <button
                    onClick={() => setShowUserMenu((v) => !v)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 transition-all"
                  >
                    {photoURL
                      ? <img src={photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                      : <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">{user.displayName?.[0] ?? user.email?.[0]?.toUpperCase() ?? '?'}</div>
                    }
                    <span className="text-sm font-medium text-gray-700 max-w-[120px] truncate">{user.displayName ?? user.email}</span>
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
                {/* Mobile sign out */}
                <button
                  onClick={() => signOut()}
                  className="lg:hidden px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-all"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowSignInModal(true)}
                className="px-4 py-2 lg:px-6 lg:py-2.5 border-2 border-blue-600 text-blue-600 rounded-xl font-semibold hover:bg-blue-600 hover:text-white transition-all text-sm lg:text-base"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Search */}
      <section className="max-w-7xl mx-auto px-4 lg:px-6 py-6 lg:py-12">
        <div className="text-center mb-6 lg:mb-8">
          <h1 className="text-3xl lg:text-5xl font-bold text-gray-900 mb-3 lg:mb-4">
            Find Your Dream Home in Ethiopia
          </h1>
          <p className="text-base lg:text-lg text-gray-600 px-2 max-w-2xl mx-auto">
            Yevilla is Ethiopia&apos;s real estate marketplace — search homes for sale and rent in Addis Ababa and across the country, connect with local agents, and list your property in minutes.
          </p>
        </div>

        <div
          onClick={openSearchModal}
          className="max-w-2xl mx-auto bg-white rounded-xl lg:rounded-2xl shadow-lg lg:shadow-xl p-3 lg:p-4 cursor-pointer hover:shadow-2xl transition-all border-2 border-gray-100 hover:border-blue-500"
        >
          <div className="flex items-center gap-3 lg:gap-4">
            <Search className="w-5 h-5 lg:w-6 lg:h-6 text-gray-400" />
            <span className="flex-1 text-base lg:text-lg text-gray-400">Search by city, neighborhood, or ZIP...</span>
          </div>
        </div>
      </section>

      {/* Recommendations */}
      {(!loadingListings && recommendations.length === 0) ? null : (
      <section className="max-w-7xl mx-auto px-4 lg:px-6 py-4 lg:py-6">
        <div className="flex items-center justify-between mb-3 lg:mb-4">
          <h2 className="text-xl lg:text-3xl font-bold text-gray-900">{'Recommended for You'}</h2>
          <button onClick={() => onNavigateToMap('rent')} className="text-blue-600 font-semibold flex items-center gap-1 hover:gap-2 transition-all text-sm lg:text-base">
            {'View All'} <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5" />
          </button>
        </div>
        {loadingListings ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <>
            <div
              ref={recommendedRef}
              className="flex gap-3 lg:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide lg:overflow-x-auto"
              onScroll={(e) => {
                const target = e.target as HTMLDivElement;
                const index = Math.round(target.scrollLeft / (288 + 12));
                setRecommendedIndex(index);
              }}
            >
              {recommendations.map((property) => (
                <div
                  key={property.id}
                  className="flex-shrink-0 w-72 lg:w-80 bg-white rounded-xl lg:rounded-2xl overflow-hidden shadow-md lg:shadow-lg hover:shadow-xl lg:hover:shadow-2xl transition-all snap-start cursor-pointer group"
                  onClick={() => onPropertyClick(property)}
                >
                  <div className="relative h-44 lg:h-48 overflow-hidden">
                    <img
                      src={property.image}
                      alt={property.address}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(property.id); }}
                      className="absolute top-2 lg:top-3 left-2 lg:left-3 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all z-10"
                    >
                      <Heart className={`w-4 h-4 transition-colors ${isFavorite(property.id) ? 'fill-red-500 text-red-500' : 'text-gray-700'}`} />
                    </button>
                    <button
                      onClick={(e) => handleShare(e, property)}
                      className="absolute top-2 lg:top-3 right-2 lg:right-3 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all z-10"
                    >
                      {sharedId === property.id ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4 text-gray-700" />}
                    </button>
                    <div className="absolute bottom-2 lg:bottom-3 left-2 lg:left-3 right-2 lg:right-3">
                      <div className="text-white text-xl lg:text-2xl font-bold">
                        {property.type === 'rent' ? `Br ${property.rent.toLocaleString()}/mo` : formatPrice(property.price)}
                      </div>
                      <div className="text-white/90 text-xs lg:text-sm">{property.city}{property.state ? `, ${property.state}` : ''}</div>
                    </div>
                  </div>
                  <div className="p-3 lg:p-4">
                    <div className="flex items-center gap-3 lg:gap-4 text-gray-600 text-xs lg:text-sm">
                      <span>{property.beds} {'beds'}</span>
                      <span>•</span>
                      <span>{property.baths} {'baths'}</span>
                      <span>•</span>
                      <span>{property.sqft.toLocaleString()} {'sqft'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-2 mt-2 lg:hidden">
              {recommendations.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (recommendedRef.current) {
                      recommendedRef.current.scrollTo({ left: index * (288 + 12), behavior: 'smooth' });
                    }
                  }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === recommendedIndex ? 'bg-blue-600 w-6' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </section>
      )}

      {/* For Rent */}
      {(!loadingListings && forRent.length === 0) ? null : (
      <section className="max-w-7xl mx-auto px-4 lg:px-6 py-4 lg:py-6">
        <div className="flex items-center justify-between mb-3 lg:mb-4">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" />
            <h2 className="text-xl lg:text-3xl font-bold text-gray-900">{'For Rent'}</h2>
          </div>
          <button onClick={() => onNavigateToMap('rent')} className="text-blue-600 font-semibold flex items-center gap-1 hover:gap-2 transition-all text-sm lg:text-base">
            {'View All'} <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5" />
          </button>
        </div>
        {loadingListings ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <>
            <div
              ref={forRentRef}
              className="flex gap-3 lg:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide lg:overflow-x-auto"
              onScroll={(e) => {
                const target = e.target as HTMLDivElement;
                const index = Math.round(target.scrollLeft / (288 + 12));
                setForRentIndex(index);
              }}
            >
              {forRent.map((property) => (
                <div
                  key={property.id}
                  className="flex-shrink-0 w-72 lg:w-80 bg-white rounded-xl lg:rounded-2xl overflow-hidden shadow-md lg:shadow-lg hover:shadow-xl lg:hover:shadow-2xl transition-all snap-start cursor-pointer group"
                  onClick={() => onPropertyClick(property)}
                >
                  <div className="relative h-44 lg:h-48 overflow-hidden">
                    <img
                      src={property.image}
                      alt={property.address}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute top-2 lg:top-3 right-2 lg:right-3 flex flex-col gap-2 z-10">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(property.id); }}
                        className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all"
                      >
                        <Heart className={`w-4 h-4 transition-colors ${isFavorite(property.id) ? 'fill-red-500 text-red-500' : 'text-gray-700'}`} />
                      </button>
                      <button
                        onClick={(e) => handleShare(e, property)}
                        className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all"
                      >
                        {sharedId === property.id ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4 text-gray-700" />}
                      </button>
                    </div>
                  </div>
                  <div className="p-4 lg:p-5">
                    <div className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">
                      Br {property.rent.toLocaleString()}/mo
                    </div>
                    <div className="flex items-center gap-2 lg:gap-3 text-gray-600 mb-2 text-xs lg:text-sm">
                      <span>{property.beds} {'bd'}</span>
                      <span>•</span>
                      <span>{property.baths} {'ba'}</span>
                      {property.sqft > 0 && <><span>•</span><span>{property.sqft.toLocaleString()} sqft</span></>}
                    </div>
                    <div className="text-gray-700 font-medium text-sm lg:text-base">{property.city}{property.state ? `, ${property.state}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-2 mt-2 lg:hidden">
              {forRent.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (forRentRef.current) {
                      forRentRef.current.scrollTo({ left: index * (288 + 12), behavior: 'smooth' });
                    }
                  }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === forRentIndex ? 'bg-blue-600 w-6' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </section>
      )}

      {/* For Sale */}
      {(!loadingListings && forSale.length === 0) ? null : (
      <section className="max-w-7xl mx-auto px-4 lg:px-6 py-4 lg:py-6">
        <div className="flex items-center justify-between mb-3 lg:mb-4">
          <div className="flex items-center gap-2">
            <Home className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" />
            <h2 className="text-xl lg:text-3xl font-bold text-gray-900">{'For Sale'}</h2>
          </div>
          <button onClick={() => onNavigateToMap('buy')} className="text-blue-600 font-semibold flex items-center gap-1 hover:gap-2 transition-all text-sm lg:text-base">
            {'View All'} <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5" />
          </button>
        </div>
        {loadingListings ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <>
            <div
              ref={forSaleRef}
              className="flex gap-3 lg:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide lg:overflow-x-auto"
              onScroll={(e) => {
                const target = e.target as HTMLDivElement;
                const index = Math.round(target.scrollLeft / (288 + 12));
                setForSaleIndex(index);
              }}
            >
              {forSale.map((property) => (
                <div
                  key={property.id}
                  className="flex-shrink-0 w-72 lg:w-80 bg-white rounded-xl lg:rounded-2xl overflow-hidden shadow-md lg:shadow-lg hover:shadow-xl lg:hover:shadow-2xl transition-all snap-start cursor-pointer group"
                  onClick={() => onPropertyClick(property)}
                >
                  <div className="relative h-44 lg:h-48 overflow-hidden">
                    <img
                      src={property.image}
                      alt={property.address}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute top-2 lg:top-3 right-2 lg:right-3 flex flex-col gap-2 z-10">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(property.id); }}
                        className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all"
                      >
                        <Heart className={`w-4 h-4 transition-colors ${isFavorite(property.id) ? 'fill-red-500 text-red-500' : 'text-gray-700'}`} />
                      </button>
                      <button
                        onClick={(e) => handleShare(e, property)}
                        className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all"
                      >
                        {sharedId === property.id ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4 text-gray-700" />}
                      </button>
                    </div>
                  </div>
                  <div className="p-4 lg:p-5">
                    <div className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">
                      {formatPrice(property.price)}
                    </div>
                    <div className="flex items-center gap-2 lg:gap-3 text-gray-600 mb-2 lg:mb-3 text-xs lg:text-sm">
                      <span>{property.beds} {'bd'}</span>
                      <span>•</span>
                      <span>{property.baths} {'ba'}</span>
                      <span>•</span>
                      <span>{property.sqft.toLocaleString()} {'sqft'}</span>
                    </div>
                    <div className="text-gray-700 font-medium text-sm lg:text-base">{property.city}{property.state ? `, ${property.state}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-2 mt-2 lg:hidden">
              {forSale.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (forSaleRef.current) {
                      forSaleRef.current.scrollTo({ left: index * (288 + 12), behavior: 'smooth' });
                    }
                  }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === forSaleIndex ? 'bg-blue-600 w-6' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </section>
      )}

      {/* Saved Listings — signed-in users with at least one favorite */}
      {user && apiListings.filter((p) => isFavorite(p.id)).length > 0 && (() => {
        const saved = apiListings.filter((p) => isFavorite(p.id));
        return (
          <section className="max-w-7xl mx-auto px-4 lg:px-6 py-4 lg:py-6">
            <div className="flex items-center justify-between mb-3 lg:mb-4">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 lg:w-6 lg:h-6 text-red-500 fill-red-500" />
                <h2 className="text-xl lg:text-3xl font-bold text-gray-900">Saved Listings</h2>
              </div>
              <button onClick={() => router.push('/favorites')} className="text-blue-600 font-semibold flex items-center gap-1 hover:gap-2 transition-all text-sm lg:text-base">
                View All <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5" />
              </button>
            </div>
            <div className="flex gap-3 lg:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
              {saved.map((property) => (
                <div
                  key={property.id}
                  className="flex-shrink-0 w-72 lg:w-80 bg-white rounded-xl lg:rounded-2xl overflow-hidden shadow-md lg:shadow-lg hover:shadow-xl transition-all snap-start cursor-pointer group"
                  onClick={() => onPropertyClick(property)}
                >
                  <div className="relative h-44 lg:h-48 overflow-hidden">
                    <img
                      src={property.image}
                      alt={property.address}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute top-2 lg:top-3 right-2 lg:right-3 flex flex-col gap-2 z-10">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(property.id); }}
                        className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all"
                      >
                        <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                      </button>
                      <button
                        onClick={(e) => handleShare(e, property)}
                        className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all"
                      >
                        {sharedId === property.id ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4 text-gray-700" />}
                      </button>
                    </div>
                  </div>
                  <div className="p-4 lg:p-5">
                    <div className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">
                      {property.type === 'rent' ? `Br ${property.rent.toLocaleString()}/mo` : formatPrice(property.price)}
                    </div>
                    <div className="flex items-center gap-2 lg:gap-3 text-gray-600 mb-2 text-xs lg:text-sm">
                      <span>{property.beds} bd</span>
                      <span>•</span>
                      <span>{property.baths} ba</span>
                      <span>•</span>
                      <span>{property.sqft.toLocaleString()} sqft</span>
                    </div>
                    <div className="text-gray-700 font-medium text-sm lg:text-base">{property.address}</div>
                    <div className="text-gray-500 text-xs lg:text-sm">{property.city}, {property.state}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {/* My Listing — shown only when the signed-in user has a published listing */}
      {myListing && myListing.status === 'active' && (
        <section className="max-w-7xl mx-auto px-4 lg:px-6 py-4 lg:py-6">
          <div className="flex items-center justify-between mb-3 lg:mb-4">
            <div className="flex items-center gap-2">
              <Home className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" />
              <h2 className="text-xl lg:text-3xl font-bold text-gray-900">My Listing</h2>
            </div>
            <button
              onClick={() => router.push('/list-my-home')}
              className="text-blue-600 font-semibold flex items-center gap-1 hover:gap-2 transition-all text-sm lg:text-base"
            >
              Manage <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5" />
            </button>
          </div>
          <div className="flex gap-3 lg:gap-4">
            <div
              className="flex-shrink-0 w-72 lg:w-80 bg-white rounded-xl lg:rounded-2xl overflow-hidden shadow-md lg:shadow-lg hover:shadow-xl lg:hover:shadow-2xl transition-all cursor-pointer group"
              onClick={() => onPropertyClick(myListing)}
            >
              <div className="relative h-44 lg:h-48 overflow-hidden">
                <img
                  src={myListing.image}
                  alt={myListing.address}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <button
                  onClick={(e) => handleShare(e, myListing)}
                  className="absolute top-2 lg:top-3 right-2 lg:right-3 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all z-10"
                >
                  {sharedId === myListing.id ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4 text-gray-700" />}
                </button>
                <div className="absolute bottom-2 lg:bottom-3 left-2 lg:left-3 right-2 lg:right-3">
                  <div className="text-white text-xl lg:text-2xl font-bold">
                    Br {myListing.rent.toLocaleString()}/mo
                  </div>
                  <div className="text-white/90 text-xs lg:text-sm">{myListing.city}</div>
                </div>
              </div>
              <div className="p-3 lg:p-4">
                <div className="flex items-center gap-3 lg:gap-4 text-gray-600 text-xs lg:text-sm mb-2">
                  {myListing.beds > 0 && <span>{myListing.beds} beds</span>}
                  {myListing.beds > 0 && myListing.baths > 0 && <span>•</span>}
                  {myListing.baths > 0 && <span>{myListing.baths} baths</span>}
                  {myListing.sqft > 0 && <><span>•</span><span>{myListing.sqft.toLocaleString()} m²</span></>}
                </div>
                {myListing.address && (
                  <div className="text-gray-700 font-medium text-sm lg:text-base truncate">{myListing.address}</div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Talk to an Agent */}
      <section className="max-w-3xl mx-auto px-4 lg:px-6 py-8 lg:py-16">
        <div className="text-center mb-6 lg:mb-10">
          <h2 className="text-2xl lg:text-5xl font-bold text-gray-900 mb-3 lg:mb-4">{'Talk to an Agent'}</h2>
          <p className="text-gray-600 text-base lg:text-xl max-w-2xl mx-auto px-2">
            {'Looking for your next move? Our team is here to help you navigate the market with ease.'}
          </p>
        </div>

        {agentSubmitted ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <svg className="w-14 h-14 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-xl font-bold text-gray-800">Request submitted!</p>
            <p className="text-gray-500">An agent will reach out to you shortly.</p>
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleAgentFormSubmit}>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {'Where are you searching for homes?'}
              </label>
              <input
                type="text"
                placeholder="City, Neighborhood, or ZIP"
                value={agentLocation}
                onChange={e => setAgentLocation(e.target.value)}
                className="w-full px-5 py-4 bg-white border-2 border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm hover:border-gray-300"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {'Email Address *'}
                </label>
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={agentEmail}
                  onChange={e => setAgentEmail(e.target.value)}
                  className="w-full px-5 py-4 bg-white border-2 border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm hover:border-gray-300"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {'Phone Number'}
                </label>
                <input
                  type="tel"
                  placeholder="+251 9X XXX XXXX"
                  value={agentPhone}
                  onChange={e => setAgentPhone(e.target.value)}
                  className="w-full px-5 py-4 bg-white border-2 border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm hover:border-gray-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {'What can we help you with?'}
              </label>
              <textarea
                placeholder={'Tell us about your real estate goals...'}
                rows={5}
                value={agentMessage}
                onChange={e => setAgentMessage(e.target.value)}
                className="w-full px-5 py-4 bg-white border-2 border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none shadow-sm hover:border-gray-300"
              />
            </div>

            {agentError && <p className="text-sm text-red-600">{agentError}</p>}

            <button
              type="submit"
              disabled={agentSubmitting}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 disabled:opacity-60 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/50 hover:scale-[1.02] transform flex items-center justify-center gap-2"
            >
              {agentSubmitting && <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>}
              {agentSubmitting ? 'Submitting…' : 'Submit Request'}
            </button>

            <p className="text-xs text-gray-500 leading-relaxed text-center">
              By submitting this form, I agree to receive calls and SMS messages from Yevilla for the purpose of updates and promotions. Messages may be sent on a recurring basis and frequency will vary. Message and data rates may apply. Consent to receive SMS messages is not required as a condition for purchasing any goods or services. To unsubscribe from SMS messages, reply &quot;STOP&quot; at any time. For assistance, <a href="/contact" className="text-blue-600 hover:underline">visit our Contact page</a>. By proceeding, you confirm that you have read and agree to our{' '}
              <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>{' '}and{' '}
              <a href="/terms" className="text-blue-600 hover:underline">Terms of Use</a>.
            </p>
          </form>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-4">Find Us</h3>
              <ul className="space-y-2">
                {footerLinks.findUs.map((link, index) => (
                  <li key={index}>
                    <a href={link.href} className="text-gray-400 hover:text-white transition-colors">
                      {link.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-4">Join Us</h3>
              <ul className="space-y-2">
                {footerLinks.joinUs.map((link, index) => (
                  <li key={index}>
                    <a href={link.href} className="text-gray-400 hover:text-white transition-colors">
                      {link.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-4">More</h3>
              <ul className="space-y-2">
                {footerLinks.more.map((link, index) => (
                  <li key={index}>
                    <a href={link.href} className="text-gray-400 hover:text-white transition-colors">
                      {link.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-4">Legal</h3>
              <ul className="space-y-2">
                {footerLinks.legal.map((link, index) => (
                  <li key={index}>
                    <a href={link.href} className="text-gray-400 hover:text-white transition-colors">
                      {link.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2026 Yevilla. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Search Modal */}
      {showSearchModal && (
        <div
          className="fixed inset-0 bg-black/50 z-[1000] flex items-start justify-center pt-20 lg:pt-20"
          onClick={() => setShowSearchModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Buy/Rent Toggle */}
              <div className="flex bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-1.5 gap-1 shadow-inner mb-4">
                <button onClick={() => setSearchListingMode('buy')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all text-sm font-medium ${searchListingMode === 'buy' ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30' : 'text-gray-600 hover:text-gray-900'}`}>
                  <Home className="w-4 h-4" /><span>Buy</span>
                </button>
                <button onClick={() => setSearchListingMode('rent')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all text-sm font-medium ${searchListingMode === 'rent' ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30' : 'text-gray-600 hover:text-gray-900'}`}>
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
                    if (e.key === 'Enter' && suggestions.length > 0) selectSuggestion(suggestions[0]);
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
              {suggestions.length > 0 && (
                <div className="space-y-1 mb-4">
                  {suggestions.map((feature) => (
                    <button key={feature.id} onClick={() => selectSuggestion(feature)} className="w-full flex items-start gap-3 p-3 hover:bg-blue-50 rounded-xl transition-all text-left">
                      <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 text-sm truncate">{feature.text.split(',')[0]}</div>
                        <div className="text-xs text-gray-500 truncate">{feature.place_name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Recent Searches */}
              {!inputValue && recentSearches.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 text-sm">Recent Searches</h3>
                    <button onClick={() => { localStorage.removeItem(RECENT_KEY); setRecentSearches([]); }} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Clear all</button>
                  </div>
                  <div className="space-y-1">
                    {recentSearches.map((item, i) => (
                      <button key={i} onClick={() => selectRecent(item)} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-all text-left">
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

              {/* Nearby chips */}
              {!inputValue && recentSearches.length === 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm">Nearby</h3>
                  <div className="flex flex-wrap gap-2">
                    {['Bole', 'CMC', 'Kazanchis', 'Gerji', 'Sarbet', 'Old Airport'].map((area) => (
                      <button
                        key={area}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-100 transition-all"
                        onClick={() => setInputValue(area)}
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

      <SignInModal open={showSignInModal} onClose={() => setShowSignInModal(false)} />

      {/* Mobile Menu */}
      {showMenu && user && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[1000] lg:hidden"
            onClick={() => setShowMenu(false)}
          />
          <div className="fixed top-0 left-0 h-full w-80 bg-white z-[1001] shadow-2xl lg:hidden transform transition-transform">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Yevilla
              </div>
              <button
                onClick={() => setShowMenu(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-all"
              >
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
                <button
                  onClick={() => { setShowSignInModal(true); setShowMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 rounded-lg transition-all font-medium text-gray-700"
                >
                  <User className="w-5 h-5" />
                  Sign In
                </button>
              )}

              <button onClick={() => { router.push('/favorites'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 rounded-lg transition-all font-medium text-gray-700">
                <Heart className="w-5 h-5" />
                Favorites
              </button>

              <button onClick={() => { router.push('/settings'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 rounded-lg transition-all font-medium text-gray-700">
                <Settings className="w-5 h-5" />
                Settings
              </button>

              <div className="border-t border-gray-200 my-2"></div>

              <button onClick={() => { router.push('/list-my-home'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 rounded-lg transition-all font-medium text-gray-700">
                <Key className="w-5 h-5" />
                My Listing
              </button>

              {isAgentChecked && !isAgent && (
                <button onClick={() => { router.push('/sell-my-home'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 rounded-lg transition-all font-medium text-gray-700">
                  <Tag className="w-5 h-5" />
                  Sell My Home
                </button>
              )}

              {isAgentChecked && !isAgent && (
                <button onClick={() => { router.push('/become-an-agent'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 rounded-lg transition-all font-medium text-gray-700">
                  <UserPlus className="w-5 h-5" />
                  Become an Agent
                </button>
              )}

              <div className="border-t border-gray-200 my-2"></div>

              <button onClick={() => { router.push('/contact'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 rounded-lg transition-all font-medium text-gray-700">
                <MessageCircle className="w-5 h-5" />
                Contact Us
              </button>

              {user && (
                <>
                  <div className="border-t border-gray-200 my-2"></div>
                  <button
                    onClick={() => { signOut(); setShowMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-50 rounded-lg transition-all font-medium text-red-600"
                  >
                    <LogOut className="w-5 h-5" />
                    Sign Out
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
