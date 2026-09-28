'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search, User, TrendingUp, Home, Key, MessageCircle, ChevronRight,
  X, Menu, Heart, Settings, Tag, UserPlus, LogOut, MapPin, Loader2,
  Mail, Share2, Check, ChevronLeft,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useFavorites } from '@/lib/favorites-context';
import { useListings } from '@/lib/listings-context';
import { type Property, apiListingToProperty } from '@/app/data/properties';
import SignInModal from './SignInModal';
import { formatETBCompact, formatETB } from '@/app/components/ui/utils';
import { img as cdnImg } from '@/lib/image';
import { filterLocalPlaces } from '@/app/data/places';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? '';

interface GeocodingFeature {
  id: string; place_name: string; text: string; center: [number, number]; place_type: string[];
}
interface RecentSearch {
  text: string; placeName: string; lng: number; lat: number; zoom: number;
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
  if (types.includes('region')) return 8;
  return 12;
}
function loadRecent(): RecentSearch[] { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } }
function saveRecent(item: RecentSearch) {
  const deduped = loadRecent().filter(s => s.text !== item.text);
  localStorage.setItem(RECENT_KEY, JSON.stringify([item, ...deduped].slice(0, 5)));
}

function isNewListing(createdAt?: number): boolean {
  if (!createdAt) return false;
  return (Date.now() - createdAt) / (1000 * 60 * 60 * 24) <= 7;
}

// ── Shared carousel card ─────────────────────────────────────────────────────
function PropertyCarouselCard({
  property, onClick, isFav, onFav, isShared, onShare, priceLabel,
}: {
  property: Property; onClick: () => void; isFav: boolean; onFav: (e: React.MouseEvent) => void;
  isShared: boolean; onShare: (e: React.MouseEvent) => void; priceLabel: string;
}) {
  const image = property.photos?.[0] ?? property.image;
  return (
    <div
      className="flex-shrink-0 w-carousel-w-sm lg:w-carousel-w-lg cursor-pointer group snap-start"
      onClick={onClick}
    >
      <div className="relative h-carousel-img-sm lg:h-carousel-img-lg overflow-hidden rounded-2xl mb-3 shadow-sm group-hover:shadow-lg transition-all duration-300">
        <img
          src={cdnImg(image, { width: 640 })}
          alt={property.address}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />

        {isNewListing(property.createdAt) && (
          <span className="absolute top-2.5 left-2.5 bg-blue-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider">
            New
          </span>
        )}

        <div className="absolute top-2.5 right-2.5 flex gap-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onFav}
            className="bg-white/95 backdrop-blur-sm p-1.5 rounded-full shadow hover:bg-white transition-all"
          >
            <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
          </button>
          <button
            onClick={onShare}
            className="bg-white/95 backdrop-blur-sm p-1.5 rounded-full shadow hover:bg-white transition-all"
          >
            {isShared ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Share2 className="w-3.5 h-3.5 text-gray-500" />}
          </button>
        </div>

        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-white text-[17px] font-bold leading-none tracking-tight drop-shadow">{priceLabel}</p>
        </div>
      </div>

      <div className="px-0.5">
        <p className="text-[13px] font-semibold text-gray-800 mb-0.5">
          {property.beds} bd
          <span className="text-gray-300 mx-1.5 font-normal">·</span>
          {property.baths} ba
          {property.sqft > 0 && <><span className="text-gray-300 mx-1.5 font-normal">·</span>{property.sqft.toLocaleString()} m²</>}
        </p>
        {property.address && <p className="text-[12px] text-gray-500 truncate">{property.address}</p>}
        <p className="text-[11px] text-gray-400 truncate mt-0.5">{[property.subCity, property.city].filter(Boolean).join(', ')}</p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function HomePage({ onNavigateToMap, onPropertyClick }: HomePageProps) {
  const router = useRouter();
  const { user, photoURL, signOut, loading } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { listings: apiListings, loading: loadingListings } = useListings();

  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchListingMode, setSearchListingMode] = useState<'buy' | 'rent'>('buy');
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodingFeature[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [myListing, setMyListing] = useState<Property | null>(null);
  const [isAgent, setIsAgent] = useState(false);
  const [isAgentChecked, setIsAgentChecked] = useState(false);
  const [sharedId, setSharedId] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);

  // The hero slideshow is `hidden lg:block` (desktop only), but display:none does
  // NOT stop browsers downloading its up-to-8 full-size images — so every mobile
  // visitor pays for images they never see. Only mount it on real desktop viewports.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const [agentLocation, setAgentLocation] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentPhone, setAgentPhone] = useState('');
  const [agentMessage, setAgentMessage] = useState('');
  const [agentSubmitting, setAgentSubmitting] = useState(false);
  const [agentSubmitted, setAgentSubmitted] = useState(false);
  const [agentError, setAgentError] = useState('');

  const userMenuRef = useRef<HTMLDivElement>(null);
  const talkToAgentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    if (!showUserMenu) return;
    function handle(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showUserMenu]);

  useEffect(() => {
    if (!showSearchModal && !showMenu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [showSearchModal, showMenu]);

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
          (data.features || []).map((f: { id: string; geometry: { coordinates: [number, number] }; properties: { name: string; feature_type: string; context?: { country?: { name: string } } } }) => {
            const type = f.properties.feature_type;
            const country = f.properties.context?.country?.name ?? 'Ethiopia';
            return {
              id: f.id, text: f.properties.name,
              place_name: type === 'region' ? country : `${f.properties.name}, ${country}`,
              center: f.geometry.coordinates, place_type: [type],
            };
          })
        );
      } catch { setSuggestions([]); }
      finally { setIsLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  useEffect(() => {
    if (!user || !WORKER_URL) { setMyListing(null); setIsAgent(false); setIsAgentChecked(false); return; }
    user.getIdToken().then(token =>
      fetch(`${WORKER_URL}/listing`, { headers: { Authorization: `Bearer ${token}` } })
    ).then(async res => {
      if (!res.ok) { setMyListing(null); setIsAgentChecked(true); return; }
      const data = await res.json() as { listings: Record<string, unknown>[]; isAgent: boolean };
      setIsAgent(data.isAgent ?? false); setIsAgentChecked(true);
      const first = data.listings?.[0];
      setMyListing(first ? apiListingToProperty(first) : null);
    }).catch(() => { setMyListing(null); setIsAgentChecked(true); });
  }, [user]);

  const mergedSuggestions = useMemo(() => {
    const local = filterLocalPlaces(inputValue);
    const localNames = new Set(local.map(p => p.text.toLowerCase()));
    return [...local, ...suggestions.filter(s => !localNames.has(s.text.toLowerCase()))];
  }, [inputValue, suggestions]);

  const handleShare = async (e: React.MouseEvent, property: Property) => {
    e.stopPropagation();
    const url = `${window.location.origin}/listings?q=${encodeURIComponent(property.address)}`;
    if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) && navigator.share) {
      try { await navigator.share({ title: property.address, url }); } catch { /* cancelled */ }
      return;
    }
    try { await navigator.clipboard.writeText(url); } catch {
      const el = document.createElement('textarea');
      el.value = url; el.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
    }
    setSharedId(property.id);
    setTimeout(() => setSharedId(null), 2000);
  };

  async function handleAgentFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agentEmail.trim()) { setAgentError('Please enter your email address.'); return; }
    setAgentSubmitting(true); setAgentError('');
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
    } catch { setAgentError('Something went wrong. Please try again.'); }
    finally { setAgentSubmitting(false); }
  }

  const openSearchModal = () => {
    setInputValue(''); setSuggestions([]); setRecentSearches(loadRecent()); setShowSearchModal(true);
  };
  const selectSuggestion = (f: GeocodingFeature) => {
    const zoom = zoomForType(f.place_type);
    const [lng, lat] = f.center;
    const text = f.text.split(',')[0];
    saveRecent({ text, placeName: f.place_name, lng, lat, zoom });
    setShowSearchModal(false);
    onNavigateToMap(searchListingMode, { q: text, lat, lng, zoom });
  };
  const selectRecent = (item: RecentSearch) => {
    setShowSearchModal(false);
    onNavigateToMap(searchListingMode, { q: item.text, lat: item.lat, lng: item.lng, zoom: item.zoom });
  };

  const heroListings = apiListings.slice(0, 8);

  // Auto-advance slideshow
  useEffect(() => {
    if (heroListings.length < 2) return;
    const id = setInterval(() => setHeroIndex(i => (i + 1) % heroListings.length), 5000);
    return () => clearInterval(id);
  }, [heroListings.length]);

  const recommendations = apiListings
    .filter(p => searchListingMode === 'rent' ? (p.type === 'rent' || p.type === 'both') : (p.type === 'sale' || p.type === 'both'))
    .slice(0, 6);
  const forSale = apiListings.filter(p => p.type === 'sale' || p.type === 'both');
  const forRent = apiListings.filter(p => p.type === 'rent' || p.type === 'both');
  const saved = apiListings.filter(p => isFavorite(p.id));

  const footerLinks = {
    findUs: [{ title: 'Contact Us', href: '/contact' }, { title: 'Office Locations', href: '/contact' }],
    joinUs: [{ title: 'Become an Agent', href: '/become-an-agent' }, { title: 'Careers', href: '/contact' }],
    more: [{ title: 'List Your Property', href: '/list-my-home' }, { title: 'Market Reports', href: '/contact' }],
    legal: [{ title: 'Privacy Policy', href: '/privacy' }, { title: 'Terms of Use', href: '/terms' }],
  };

  const renderSection = (
    label: string, title: string, onViewAll: () => void, sectionLoading: boolean, content: React.ReactNode
  ) => (
    <section className="py-10 lg:py-14">
      <div className="max-w-7xl mx-auto px-4 lg:px-6">
        <div className="flex items-end justify-between mb-7 lg:mb-9">
          <div>
            <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-[0.22em] mb-1.5">{label}</p>
            <h2 className="text-2xl lg:text-[1.75rem] font-bold text-gray-900 tracking-tight leading-tight">{title}</h2>
          </div>
          <button onClick={onViewAll} className="text-sm font-medium text-gray-400 hover:text-gray-900 flex items-center gap-1 transition-colors shrink-0 ml-4">
            View all <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {sectionLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : content}
      </div>
    </section>
  );

  const renderCards = (items: Property[], mode: 'buy' | 'rent') => (
    <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide overscroll-x-contain -mx-4 px-4 lg:mx-0 lg:px-0">
      {items.map(p => {
        const showRent = (mode === 'rent' || !p.price) && p.rent > 0;
        const price = showRent ? `${formatETB(p.rent)}/mo` : formatETBCompact(p.price);
        return (
          <PropertyCarouselCard
            key={p.id}
            property={p}
            onClick={() => onPropertyClick(p)}
            isFav={isFavorite(p.id)}
            onFav={e => { e.stopPropagation(); toggleFavorite(p.id); }}
            isShared={sharedId === p.id}
            onShare={e => handleShare(e, p)}
            priceLabel={price}
          />
        );
      })}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-[env(safe-area-inset-bottom)]">

      {/* ── Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-[0_1px_6px_rgba(0,0,0,0.05)]">
        {/* Desktop header */}
        <div className="hidden lg:flex px-8 h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {!loading && !user && (
              <button onClick={() => setShowMenu(true)} className="p-2 rounded-lg transition-all hover:bg-gray-100 text-gray-600">
                <Menu className="w-5 h-5" />
              </button>
            )}
            <span className="text-xl font-bold tracking-tight text-gray-900">Yevilla</span>
          </div>
          <div className="flex items-center gap-3">
            {!loading && (user ? (
              <div className="relative" ref={userMenuRef}>
                <button onClick={() => setShowUserMenu(v => !v)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:bg-gray-100 text-gray-700">
                  {photoURL
                    ? <img src={photoURL} alt="" className="w-7 h-7 rounded-full object-cover" referrerPolicy="no-referrer" />
                    : <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">{user.displayName?.[0] ?? '?'}</div>
                  }
                  <span className="text-sm font-medium max-w-[100px] truncate">{user.displayName ?? user.email}</span>
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showUserMenu ? '-rotate-90' : 'rotate-90'} opacity-50`} />
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                      {user.displayName && <p className="text-sm font-semibold text-gray-900 truncate">{user.displayName}</p>}
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <div className="py-1">
                      {[{ icon: Heart, label: 'Favorites', path: '/favorites' }, { icon: Settings, label: 'Settings', path: '/edit-profile' }].map(item => (
                        <button key={item.path} onClick={() => { router.push(item.path); setShowUserMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 text-sm text-gray-700 transition-colors">
                          <item.icon className="w-4 h-4 text-gray-400" />{item.label}
                        </button>
                      ))}
                      <div className="border-t border-gray-100 my-1" />
                      <button onClick={() => { router.push('/list-my-home'); setShowUserMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 text-sm text-gray-700 transition-colors">
                        <Key className="w-4 h-4 text-gray-400" />My Listing
                      </button>
                      {isAgentChecked && !isAgent && (
                        <button onClick={() => { router.push('/sell-my-home'); setShowUserMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 text-sm text-gray-700 transition-colors">
                          <Tag className="w-4 h-4 text-gray-400" />Sell My Home
                        </button>
                      )}
                      {isAgentChecked && !isAgent && (
                        <button onClick={() => { router.push('/become-an-agent'); setShowUserMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 text-sm text-gray-700 transition-colors">
                          <UserPlus className="w-4 h-4 text-gray-400" />Become an Agent
                        </button>
                      )}
                      <div className="border-t border-gray-100 my-1" />
                      <button onClick={() => { signOut(); setShowUserMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-red-50 text-sm text-red-600 transition-colors">
                        <LogOut className="w-4 h-4" />Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => setShowSignInModal(true)} className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all bg-gray-900 text-white hover:bg-gray-700">
                Sign In
              </button>
            ))}
          </div>
        </div>

      </header>

      {/* ── Hero — split: dark search panel left + listing slideshow right (desktop only) ── */}
      <section className="hidden lg:flex flex-row overflow-hidden lg:[height:clamp(480px,68vh,720px)]">

        {/* Left: mid-dark search panel */}
        <div className="w-full lg:w-[42%] bg-[#1c1917] flex flex-col justify-center px-5 py-10 lg:px-12 lg:py-0 flex-shrink-0">
          <h1 className="text-[clamp(1.65rem,5vw,3rem)] font-black text-white leading-[1.05] tracking-[-0.03em] mb-6">
            Find homes<br />across Ethiopia
          </h1>

          {/* Buy / Rent tabs */}
          <div className="flex mb-4 border border-white/20 rounded-xl overflow-hidden w-fit">
            {(['buy', 'rent'] as const).map((m, i) => (
              <button
                key={m}
                onClick={() => setSearchListingMode(m)}
                className={`px-6 py-2 text-sm font-semibold capitalize transition-all ${
                  searchListingMode === m ? 'bg-white text-gray-900' : 'text-white/55 hover:text-white/85'
                } ${i > 0 ? 'border-l border-white/20' : ''}`}
              >
                {m === 'buy' ? 'Buy' : 'Rent'}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div
            onClick={openSearchModal}
            className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 cursor-pointer group max-w-sm hover:ring-2 hover:ring-blue-400/40 transition-all shadow-sm"
          >
            <span className="flex-1 text-gray-400 text-sm text-left truncate">City, address, or sub-city…</span>
            <button className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors">
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* Area chips */}
          <div className="flex gap-2 mt-4 flex-wrap">
            {['Bole', 'CMC', 'Kazanchis', 'Gerji', 'Sarbet'].map(area => (
              <button
                key={area}
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set('mode', searchListingMode);
                  params.set('q', area);
                  router.push(`/listings?${params.toString()}`);
                }}
                className="px-3 py-1 bg-white/[0.08] text-white/55 text-xs rounded-full border border-white/15 hover:bg-white/15 hover:text-white/80 transition-all"
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        {/* Right: listing slideshow — hidden on mobile */}
        <div className="hidden lg:block relative flex-1 min-h-0 bg-gray-900 overflow-hidden">
          {/* Images */}
          {heroListings.length === 0 || !isDesktop ? (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
          ) : (
            heroListings.map((listing, i) => {
              const img = listing.photos?.[0] ?? listing.image;
              return (
                <div
                  key={listing.id}
                  className={`absolute inset-0 transition-opacity duration-700 ${i === heroIndex ? 'opacity-100' : 'opacity-0'}`}
                >
                  <img src={cdnImg(img, { width: 1280 })} alt={listing.address} loading={i === 0 ? undefined : 'lazy'} decoding="async" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/10" />
                </div>
              );
            })
          )}


          {/* Property info card — bottom right */}
          {heroListings[heroIndex] && (() => {
            const p = heroListings[heroIndex];
            const showRent = (!p.price || searchListingMode === 'rent') && p.rent > 0;
            const price = showRent ? `${formatETB(p.rent)}/mo` : formatETBCompact(p.price);
            return (
              <div className="absolute bottom-4 right-4 z-20 bg-gray-100/80 backdrop-blur-md rounded-2xl shadow-xl p-4 w-56 lg:w-64">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="text-lg font-black text-gray-900 tracking-tight leading-none">{price}</p>
                    <p className="text-xs text-gray-500 truncate mt-1">
                      {[p.subCity, p.city].filter(Boolean).join(', ') || p.address}
                    </p>
                  </div>
                  <button
                    onClick={() => onPropertyClick(p)}
                    className="flex-shrink-0 bg-gray-900 hover:bg-gray-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    View
                  </button>
                </div>
                {/* Progress bars */}
                {heroListings.length > 1 && (
                  <div className="flex gap-1">
                    {heroListings.map((_, idx) => (
                      <div
                        key={idx}
                        onClick={() => setHeroIndex(idx)}
                        className="h-[3px] flex-1 rounded-full overflow-hidden cursor-pointer bg-gray-300"
                      >
                        {idx < heroIndex && (
                          <div className="h-full w-full bg-gray-800 rounded-full" />
                        )}
                        {idx === heroIndex && (
                          <div
                            key={heroIndex}
                            className="h-full bg-gray-800 rounded-full"
                            style={{ width: '0%', animation: 'progress-fill 5s linear forwards' }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </section>

      {/* ── Desktop: carousel sections ── */}
      <div className="hidden lg:block">
        {(loadingListings || recommendations.length > 0) && renderSection('Curated Picks', 'Recommended for You', () => onNavigateToMap(searchListingMode), loadingListings, renderCards(recommendations, searchListingMode))}
        {!loadingListings && recommendations.length > 0 && <div className="border-t border-gray-200 max-w-7xl mx-auto" />}

        {(loadingListings || forRent.length > 0) && renderSection('Rentals', 'Homes for Rent', () => onNavigateToMap('rent'), loadingListings, renderCards(forRent, 'rent'))}
        {!loadingListings && forRent.length > 0 && <div className="border-t border-gray-100 max-w-7xl mx-auto" />}

        {(loadingListings || forSale.length > 0) && renderSection('For Sale', 'Homes for Sale', () => onNavigateToMap('buy'), loadingListings, renderCards(forSale, 'buy'))}

        {user && saved.length > 0 && (
          <><div className="border-t border-gray-100 max-w-7xl mx-auto" />{renderSection('Your Saves', 'Saved Listings', () => router.push('/favorites'), false, renderCards(saved, 'buy'))}</>
        )}

        {myListing && myListing.status === 'active' && (
          <><div className="border-t border-gray-100 max-w-7xl mx-auto" />{renderSection('Your Property', 'My Listing', () => router.push('/list-my-home'), false, renderCards([myListing], 'rent'))}</>
        )}
      </div>

      {/* ── Talk to an Agent (desktop only) ── */}
      <section ref={talkToAgentRef} className="hidden lg:block bg-[#EEEEEE] py-16 lg:py-24 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10 lg:mb-12">
            <p className="text-blue-600 text-[11px] font-semibold uppercase tracking-[0.3em] mb-3">Expert Guidance</p>
            <h2 className="text-3xl lg:text-5xl font-black text-gray-900 tracking-tight mb-4">Talk to an Agent</h2>
            <p className="text-gray-500 text-base max-w-sm mx-auto leading-relaxed">
              Our local experts are ready to help you navigate the market.
            </p>
          </div>

          {agentSubmitted ? (
            <div className="flex flex-col items-center py-10 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-xl font-bold text-gray-900">Request submitted!</p>
              <p className="text-gray-500 text-sm">An agent will reach out to you shortly.</p>
            </div>
          ) : (
            <form className="space-y-3.5" onSubmit={handleAgentFormSubmit}>
              <input
                type="text" placeholder="Where are you searching? (City, Neighborhood)"
                value={agentLocation} onChange={e => setAgentLocation(e.target.value)}
                className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none transition-all text-sm"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <input
                  type="email" placeholder="Email Address *"
                  value={agentEmail} onChange={e => setAgentEmail(e.target.value)}
                  className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none transition-all text-sm"
                />
                <input
                  type="tel" placeholder="Phone Number"
                  value={agentPhone} onChange={e => setAgentPhone(e.target.value)}
                  className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none transition-all text-sm"
                />
              </div>
              <textarea
                placeholder="Tell us about your real estate goals…"
                rows={4}
                value={agentMessage} onChange={e => setAgentMessage(e.target.value)}
                className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none transition-all resize-none text-sm"
              />
              {agentError && <p className="text-sm text-red-500">{agentError}</p>}
              <button
                type="submit" disabled={agentSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
              >
                {agentSubmitting && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>}
                {agentSubmitting ? 'Submitting…' : 'Submit Request'}
              </button>
              <p className="text-[11px] text-gray-500 text-center leading-relaxed">
                By submitting, you agree to our{' '}
                <a href="/privacy" className="text-gray-600 hover:text-gray-900 transition-colors">Privacy Policy</a>{' '}and{' '}
                <a href="/terms" className="text-gray-600 hover:text-gray-900 transition-colors">Terms of Use</a>.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ── Footer (desktop only) ── */}
      <footer className="hidden lg:block bg-[#0c0a09] border-t border-white/[0.06] py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          <div className="mb-10 lg:mb-12">
            <span className="text-2xl font-black text-white tracking-tight">Yevilla</span>
            <p className="text-gray-500 text-sm mt-1.5 max-w-xs leading-relaxed">Ethiopia's premier real estate marketplace.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {[
              { title: 'Find Us', links: footerLinks.findUs },
              { title: 'Join Us', links: footerLinks.joinUs },
              { title: 'More', links: footerLinks.more },
              { title: 'Legal', links: footerLinks.legal },
            ].map(col => (
              <div key={col.title}>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-4">{col.title}</p>
                <ul className="space-y-3">
                  {col.links.map(link => (
                    <li key={link.title}>
                      <a href={link.href} className="text-gray-400 hover:text-white text-sm transition-colors">{link.title}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/[0.05] pt-6 text-gray-600 text-xs">
            &copy; 2026 Yevilla Real Estate. All rights reserved.
          </div>
        </div>
      </footer>

      {/* ── Search Modal ── */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-start justify-center pt-14 lg:pt-20 px-4" onClick={() => setShowSearchModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5">
              {/* Buy/Rent */}
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden mb-4">
                <button onClick={() => setSearchListingMode('buy')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-all ${searchListingMode === 'buy' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                  <Home className="w-4 h-4" />Buy
                </button>
                <button onClick={() => setSearchListingMode('rent')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold border-l border-gray-200 transition-all ${searchListingMode === 'rent' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                  <Key className="w-4 h-4" />Rent
                </button>
              </div>

              {/* Input */}
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-3">
                {isLoading ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" /> : <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                <input
                  type="text" value={inputValue} onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && mergedSuggestions.length > 0) selectSuggestion(mergedSuggestions[0]); if (e.key === 'Escape') setShowSearchModal(false); }}
                  placeholder="Search by city, address, or sub-city…"
                  className="flex-1 outline-none text-base text-gray-900 placeholder:text-gray-400"
                  autoFocus
                />
                {inputValue && (
                  <button onClick={() => { setInputValue(''); setSuggestions([]); }} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>

              {/* Suggestions */}
              {mergedSuggestions.length > 0 && (
                <div className="space-y-0.5 mb-2">
                  {mergedSuggestions.map(f => (
                    <button key={f.id} onClick={() => selectSuggestion(f)} className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-xl transition-colors text-left">
                      <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{f.text.split(',')[0]}</p>
                        <p className="text-xs text-gray-400 truncate">{f.place_name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Recent */}
              {!inputValue && recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Recent</p>
                    <button onClick={() => { localStorage.removeItem(RECENT_KEY); setRecentSearches([]); }} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Clear</button>
                  </div>
                  <div className="space-y-0.5">
                    {recentSearches.map((item, i) => (
                      <button key={i} onClick={() => selectRecent(item)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-xl text-left transition-colors">
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
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Nearby</p>
                  <div className="flex flex-wrap gap-2">
                    {['Bole', 'CMC', 'Kazanchis', 'Gerji', 'Sarbet', 'Old Airport'].map(area => (
                      <button key={area} onClick={() => setInputValue(area)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors">
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

      {/* ── Side drawer menu ── */}
      {showMenu && (
        <>
          <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] ${user ? 'lg:hidden' : ''}`} onClick={() => setShowMenu(false)} />
          <div className={`fixed top-0 left-0 h-full w-72 bg-white z-[1001] shadow-2xl ${user ? 'lg:hidden' : ''}`}>
            <div className="px-5 py-5 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xl font-black text-gray-900">Yevilla</span>
              <button onClick={() => setShowMenu(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-3 space-y-0.5">
              {user ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-3 mb-1">
                    {photoURL
                      ? <img src={photoURL} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" referrerPolicy="no-referrer" />
                      : <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{user.displayName?.[0] ?? '?'}</div>
                    }
                    <div className="min-w-0">
                      {user.displayName && <p className="font-semibold text-gray-900 text-sm truncate">{user.displayName}</p>}
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                  </div>
                  {[
                    { icon: Heart, label: 'Favorites', path: '/favorites' },
                    { icon: Settings, label: 'Settings', path: '/edit-profile' },
                  ].map(item => (
                    <button key={item.path} onClick={() => { router.push(item.path); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors">
                      <item.icon className="w-4 h-4 text-gray-400" />{item.label}
                    </button>
                  ))}
                  <div className="border-t border-gray-100 my-1.5" />
                  <button onClick={() => { router.push('/list-my-home'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors">
                    <Key className="w-4 h-4 text-gray-400" />My Listing
                  </button>
                  {isAgentChecked && !isAgent && (
                    <button onClick={() => { router.push('/sell-my-home'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors">
                      <Tag className="w-4 h-4 text-gray-400" />Sell My Home
                    </button>
                  )}
                  {isAgentChecked && !isAgent && (
                    <button onClick={() => { router.push('/become-an-agent'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors">
                      <UserPlus className="w-4 h-4 text-gray-400" />Become an Agent
                    </button>
                  )}
                  <div className="border-t border-gray-100 my-1.5" />
                  <button onClick={() => { router.push('/contact'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors">
                    <MessageCircle className="w-4 h-4 text-gray-400" />Contact Us
                  </button>
                  <div className="border-t border-gray-100 my-1.5" />
                  <button onClick={() => { signOut(); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-50 rounded-lg text-sm text-red-600 transition-colors">
                    <LogOut className="w-4 h-4" />Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { setShowSignInModal(true); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 rounded-lg text-sm font-semibold text-blue-600 transition-colors">
                    <User className="w-4 h-4" />Sign In
                  </button>
                  <div className="border-t border-gray-100 my-1.5" />
                  {[
                    { icon: Heart, label: 'Favorites' },
                    { icon: Key, label: 'My Listing' },
                    { icon: Tag, label: 'Sell My Home' },
                    { icon: UserPlus, label: 'Become an Agent' },
                  ].map(item => (
                    <button key={item.label} onClick={() => { setShowSignInModal(true); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors">
                      <item.icon className="w-4 h-4 text-gray-400" />{item.label}
                    </button>
                  ))}
                  <div className="border-t border-gray-100 my-1.5" />
                  <button
                    onClick={() => { setShowMenu(false); setTimeout(() => talkToAgentRef.current?.scrollIntoView({ behavior: 'smooth' }), 300); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 text-gray-400" />Contact Us
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
