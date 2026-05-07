'use client'

import React, { useState, useRef, useEffect } from 'react';
import { Search, User, TrendingUp, Home, Key, MessageCircle, FileText, BarChart3, ChevronRight, X, Menu, Heart, Settings, Tag, UserPlus, LogOut, MapPin, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import SignInModal from './SignInModal';

interface Property {
  id: number;
  price: number;
  rent: number;
  address: string;
  city: string;
  state: string;
  zip: string;
  beds: number;
  baths: number;
  sqft: number;
  status: 'active' | 'pending' | 'new';
  image: string;
  lat: number;
  lng: number;
  type: 'sale' | 'rent' | 'both';
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
  const { user, signOut } = useAuth();
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [recommendedIndex, setRecommendedIndex] = useState(0);
  const [forSaleIndex, setForSaleIndex] = useState(0);
  const [forRentIndex, setForRentIndex] = useState(0);
  const [searchListingMode, setSearchListingMode] = useState<'buy' | 'rent'>('buy');
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodingFeature[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const recommendedRef = useRef<HTMLDivElement>(null);
  const forSaleRef = useRef<HTMLDivElement>(null);
  const forRentRef = useRef<HTMLDivElement>(null);


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

  const recommendations: (Property & { badge: string | null })[] = [
    {
      id: 1,
      image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800',
      price: 35000000,
      rent: 120000,
      address: 'Africa Avenue, Bole',
      city: 'Addis Ababa',
      state: 'AA',
      zip: '1000',
      beds: 4,
      baths: 3,
      sqft: 3200,
      status: 'new' as const,
      lat: 8.9806,
      lng: 38.8090,
      type: 'both' as const,
      badge: 'Hot',
    },
    {
      id: 2,
      image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800',
      price: 25000000,
      rent: 95000,
      address: 'Gerji Mebrat Haile',
      city: 'Addis Ababa',
      state: 'AA',
      zip: '1000',
      beds: 4,
      baths: 3,
      sqft: 2800,
      status: 'active' as const,
      lat: 8.9990,
      lng: 38.8220,
      type: 'sale' as const,
      badge: 'New',
    },
    {
      id: 3,
      image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
      price: 14000000,
      rent: 55000,
      address: 'CMC Road, CMC',
      city: 'Addis Ababa',
      state: 'AA',
      zip: '1000',
      beds: 3,
      baths: 2,
      sqft: 2100,
      status: 'pending' as const,
      lat: 9.0330,
      lng: 38.8194,
      type: 'both' as const,
      badge: null,
    },
  ];

  const forSale: Property[] = [
    {
      id: 4,
      image: 'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800',
      price: 48000000,
      rent: 175000,
      address: 'Old Airport Road, Nifas Silk',
      city: 'Addis Ababa',
      state: 'AA',
      zip: '1000',
      beds: 5,
      baths: 4,
      sqft: 4200,
      status: 'new' as const,
      lat: 8.9930,
      lng: 38.7930,
      type: 'sale' as const,
    },
    {
      id: 5,
      image: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800',
      price: 11500000,
      rent: 42000,
      address: 'Sarbet, Around Gotera',
      city: 'Addis Ababa',
      state: 'AA',
      zip: '1000',
      beds: 2,
      baths: 2,
      sqft: 1400,
      status: 'active' as const,
      lat: 9.0050,
      lng: 38.7530,
      type: 'both' as const,
    },
  ];

  const forRent: (Property & { available: boolean; petFriendly: boolean })[] = [
    {
      id: 6,
      image: 'https://images.unsplash.com/photo-1599809275671-b5942cabc7a2?w=800',
      price: 0,
      rent: 32000,
      address: 'Kazanchis, Near ECA',
      city: 'Addis Ababa',
      state: 'AA',
      zip: '1000',
      beds: 2,
      baths: 1,
      sqft: 1100,
      status: 'active' as const,
      lat: 9.0180,
      lng: 38.7640,
      type: 'rent' as const,
      available: true,
      petFriendly: true,
    },
    {
      id: 7,
      image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800',
      price: 0,
      rent: 22000,
      address: 'Summit Abo, Yeka',
      city: 'Addis Ababa',
      state: 'AA',
      zip: '1000',
      beds: 2,
      baths: 1,
      sqft: 1000,
      status: 'pending' as const,
      lat: 8.9860,
      lng: 38.8220,
      type: 'rent' as const,
      available: true,
      petFriendly: false,
    },
  ];

  const footerLinks = {
    findUs: [
      { title: 'Contact Us', href: '#' },
      { title: 'Office Locations', href: '#' },
      { title: 'Community Events', href: '#' },
    ],
    joinUs: [
      { title: 'Become an Agent', href: '#' },
      { title: 'Careers', href: '#' },
      { title: 'Culture & Values', href: '#' },
    ],
    more: [
      { title: 'List Your Property', href: '#' },
      { title: 'Market Reports', href: '#' },
      { title: 'Home Valuation Tool', href: '#' },
      { title: 'Mortgage Calculator', href: '#' },
    ],
    legal: [
      { title: 'Privacy Policy', href: '#' },
      { title: 'Terms of Use', href: '#' },
      { title: 'Terms and Policy', href: '#' },
    ],
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowMenu(true)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-all"
            >
              <Menu className="w-6 h-6 text-gray-700" />
            </button>

            <div className="text-xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Gojo
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-3">
            {user ? (
              <>
                <div className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 transition-all cursor-default">
                  {user.photoURL
                    ? <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                    : <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">{user.displayName?.[0] ?? user.email?.[0]?.toUpperCase() ?? '?'}</div>
                  }
                  <span className="text-sm font-medium text-gray-700 max-w-[120px] truncate">{user.displayName ?? user.email}</span>
                </div>
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
            {'Find Your Dream Home'}
          </h1>
          <p className="text-base lg:text-lg text-gray-600 px-2">
            {'Discover the perfect property in your ideal neighborhood'}
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
      <section className="max-w-7xl mx-auto px-4 lg:px-6 py-4 lg:py-6">
        <div className="flex items-center justify-between mb-3 lg:mb-4">
          <h2 className="text-xl lg:text-3xl font-bold text-gray-900">{'Recommended for You'}</h2>
          <button onClick={() => onNavigateToMap('buy')} className="text-blue-600 font-semibold flex items-center gap-1 hover:gap-2 transition-all text-sm lg:text-base">
            {'View All'} <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5" />
          </button>
        </div>
        <div
          ref={recommendedRef}
          className="flex gap-3 lg:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide lg:overflow-x-auto"
          onScroll={(e) => {
            const target = e.target as HTMLDivElement;
            const scrollLeft = target.scrollLeft;
            const itemWidth = 288 + 12; // 72*4 (w-72) + 12 (gap-3)
            const index = Math.round(scrollLeft / itemWidth);
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
                {property.badge && (
                  <div className={`absolute top-2 lg:top-3 right-2 lg:right-3 ${property.badge === 'Hot' ? 'bg-red-500' : 'bg-green-500'} text-white px-2 lg:px-3 py-1 rounded-full text-xs font-bold shadow-lg`}>
                    {property.badge}
                  </div>
                )}
                <div className="absolute bottom-2 lg:bottom-3 left-2 lg:left-3 right-2 lg:right-3">
                  <div className="text-white text-xl lg:text-2xl font-bold">{formatPrice(property.price)}</div>
                  <div className="text-white/90 text-xs lg:text-sm">{property.city}, {property.state}</div>
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
                  const itemWidth = 288 + 12;
                  recommendedRef.current.scrollTo({ left: index * itemWidth, behavior: 'smooth' });
                }
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                index === recommendedIndex ? 'bg-blue-600 w-6' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </section>

      {/* For Sale */}
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
        <div
          ref={forSaleRef}
          className="flex gap-3 lg:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide lg:overflow-x-auto"
          onScroll={(e) => {
            const target = e.target as HTMLDivElement;
            const scrollLeft = target.scrollLeft;
            const itemWidth = 288 + 12;
            const index = Math.round(scrollLeft / itemWidth);
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
                <div className="text-gray-700 font-medium text-sm lg:text-base">{property.city}, {property.state}</div>
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
                  const itemWidth = 288 + 12;
                  forSaleRef.current.scrollTo({ left: index * itemWidth, behavior: 'smooth' });
                }
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                index === forSaleIndex ? 'bg-blue-600 w-6' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </section>

      {/* For Rent */}
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
        <div
          ref={forRentRef}
          className="flex gap-3 lg:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide lg:overflow-x-auto"
          onScroll={(e) => {
            const target = e.target as HTMLDivElement;
            const scrollLeft = target.scrollLeft;
            const itemWidth = 288 + 12;
            const index = Math.round(scrollLeft / itemWidth);
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
              </div>
              <div className="p-4 lg:p-5">
                <div className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">
                  Br {property.rent.toLocaleString()}/mo
                </div>
                <div className="flex items-center gap-2 mb-2 lg:mb-3 flex-wrap">
                  {property.available && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                      {'Available Now'}
                    </span>
                  )}
                  {property.petFriendly && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                      🐾 {'Pet Friendly'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 lg:gap-3 text-gray-600 mb-2 text-xs lg:text-sm">
                  <span>{property.beds} {'bd'}</span>
                  <span>•</span>
                  <span>{property.baths} {'ba'}</span>
                </div>
                <div className="text-gray-700 font-medium text-sm lg:text-base">{property.city}, {property.state}</div>
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
                  const itemWidth = 288 + 12;
                  forRentRef.current.scrollTo({ left: index * itemWidth, behavior: 'smooth' });
                }
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                index === forRentIndex ? 'bg-blue-600 w-6' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </section>

      {/* Talk to an Agent */}
      <section className="max-w-3xl mx-auto px-4 lg:px-6 py-8 lg:py-16">
        <div className="text-center mb-6 lg:mb-10">
          <h2 className="text-2xl lg:text-5xl font-bold text-gray-900 mb-3 lg:mb-4">{'Talk to an Agent'}</h2>
          <p className="text-gray-600 text-base lg:text-xl max-w-2xl mx-auto px-2">
            {'Looking for your next move? Our team is here to help you navigate the market with ease.'}
          </p>
        </div>

        <form className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {'Where are you searching for homes?'}
            </label>
            <input
              type="text"
              placeholder="City, Neighborhood, or ZIP"
              className="w-full px-5 py-4 bg-white border-2 border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm hover:border-gray-300"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {'Email Address'}
              </label>
              <input
                type="email"
                placeholder="email@example.com"
                className="w-full px-5 py-4 bg-white border-2 border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm hover:border-gray-300"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {'Phone Number'}
              </label>
              <input
                type="tel"
                placeholder="(555) 000-0000"
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
              className="w-full px-5 py-4 bg-white border-2 border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none shadow-sm hover:border-gray-300"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/50 hover:scale-[1.02] transform"
          >
            {'Submit Request'}
          </button>

          <p className="text-xs text-gray-500 leading-relaxed text-center">
            By submitting this form, I agree to receive calls and SMS messages from Gojo for the purpose of updates and promotions. Messages may be sent on a recurring basis and frequency will vary. Message and data rates may apply. Consent to receive SMS messages is not required as a condition for purchasing any goods or services. To unsubscribe from SMS messages, reply "STOP" at any time. For assistance, reply "HELP" or visit our <a href="#" className="text-blue-600 hover:underline">Support Page</a> and <a href="#" className="text-blue-600 hover:underline">FAQ</a>. By proceeding, you confirm that you are creating a Gojo account and have read and agree to our <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a> and <a href="#" className="text-blue-600 hover:underline">Terms of Use</a>.
          </p>
        </form>
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
            <p>&copy; 2026 Gojo. All rights reserved.</p>
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
      {showMenu && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[1000] lg:hidden"
            onClick={() => setShowMenu(false)}
          />
          <div className="fixed top-0 left-0 h-full w-80 bg-white z-[1001] shadow-2xl lg:hidden transform transition-transform">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Gojo
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
                  {user.photoURL
                    ? <img src={user.photoURL} alt={user.displayName || ''} className="w-9 h-9 rounded-full object-cover flex-shrink-0" referrerPolicy="no-referrer" />
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

              <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 rounded-lg transition-all font-medium text-gray-700">
                <Heart className="w-5 h-5" />
                Favorites
              </button>

              <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 rounded-lg transition-all font-medium text-gray-700">
                <Settings className="w-5 h-5" />
                Settings
              </button>

              <div className="border-t border-gray-200 my-2"></div>

              <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 rounded-lg transition-all font-medium text-gray-700">
                <Key className="w-5 h-5" />
                List My Home for Rent
              </button>

              <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 rounded-lg transition-all font-medium text-gray-700">
                <Tag className="w-5 h-5" />
                Sell My Home
              </button>

              <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 rounded-lg transition-all font-medium text-gray-700">
                <UserPlus className="w-5 h-5" />
                Become an Agent
              </button>

              <div className="border-t border-gray-200 my-2"></div>

              <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 rounded-lg transition-all font-medium text-gray-700">
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
