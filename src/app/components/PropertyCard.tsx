'use client'

import React, { useState } from 'react';
import { Heart, ChevronLeft, ChevronRight, Share2, Check } from 'lucide-react';
import { useFavorites } from '@/lib/favorites-context';
import { formatETB } from '@/app/components/ui/utils';

function isNewListing(createdAt?: number): boolean {
  if (!createdAt) return false;
  return (Date.now() - createdAt) / (1000 * 60 * 60 * 24) <= 7;
}

interface PropertyCardProps {
  property: {
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
    photos?: string[];
    lat: number;
    lng: number;
    type: 'sale' | 'rent' | 'both';
    createdAt?: number;
    subCity?: string;
    propertyType?: string;
  };
  onClick: () => void;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  listingMode: 'buy' | 'rent';
}

export default function PropertyCard({ property, onClick, isHovered, onMouseEnter, onMouseLeave, listingMode }: PropertyCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [copied, setCopied] = useState(false);
  const { isFavorite, toggleFavorite } = useFavorites();

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/listings?q=${encodeURIComponent(property.address)}`;
    if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) && navigator.share) {
      try { await navigator.share({ title: property.address, text: `${property.address}, ${property.city}`, url }); } catch { /* cancelled */ }
      return;
    }
    try { await navigator.clipboard.writeText(url); } catch {
      const el = document.createElement('textarea');
      el.value = url;
      el.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const wantBuy = listingMode === 'buy';
  const showRent = (!wantBuy || !property.price) && !!property.rent;
  const displayPrice = showRent ? property.rent : property.price;

  const images = property.photos?.length ? property.photos : [property.image];

  const next = (e?: React.MouseEvent) => { if (e) e.stopPropagation(); setCurrentImageIndex(i => (i + 1) % images.length); };
  const prev = (e?: React.MouseEvent) => { if (e) e.stopPropagation(); setCurrentImageIndex(i => (i - 1 + images.length) % images.length); };
  const goTo = (e: React.MouseEvent, idx: number) => { e.stopPropagation(); setCurrentImageIndex(idx); };

  const onTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (touchStart && touchEnd && Math.abs(touchStart - touchEnd) > 50) {
      touchStart - touchEnd > 0 ? next() : prev();
    }
    setTouchStart(0); setTouchEnd(0);
  };

  return (
    <div
      className={`group bg-white overflow-hidden cursor-pointer transition-all duration-200
        rounded-2xl shadow-md active:scale-[0.99]
        lg:rounded-lg lg:active:scale-100 lg:border ${
        isHovered
          ? 'lg:shadow-xl lg:border-gray-400'
          : 'lg:shadow-sm lg:border-gray-200 lg:hover:shadow-lg lg:hover:border-gray-300'
      }`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Photo */}
      <div
        className="relative h-60 lg:h-52 overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={images[currentImageIndex]}
          alt={property.address}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />

        {isNewListing(property.createdAt) && (
          <span className="absolute top-3 left-3 z-10 bg-green-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            New
          </span>
        )}

        {/* Heart + Share */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(property.id); }}
            className="bg-white/90 backdrop-blur-sm p-1.5 rounded-full shadow-md hover:bg-white hover:scale-110 transition-all"
          >
            <Heart className={`w-4 h-4 ${isFavorite(property.id) ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
          </button>
          <button
            onClick={handleShare}
            className="bg-white/90 backdrop-blur-sm p-1.5 rounded-full shadow-md hover:bg-white hover:scale-110 transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4 text-gray-500" />}
          </button>
        </div>

        {/* Mobile: cinematic gradient + price/stats overlay */}
        <div className="lg:hidden absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
        <div className="lg:hidden absolute bottom-0 left-0 right-0 px-3.5 pb-3.5 z-10 pointer-events-none">
          <p className="text-white font-bold text-[17px] leading-tight drop-shadow-sm">
            {formatETB(displayPrice)}
            {showRent && <span className="text-sm font-normal opacity-75 ml-0.5">/mo</span>}
          </p>
          <div className="flex items-center gap-1.5 text-white/70 text-xs font-medium mt-0.5">
            <span>{property.beds} bd</span>
            <span className="text-white/40">·</span>
            <span>{property.baths} ba</span>
            {property.sqft > 0 && (
              <>
                <span className="text-white/40">·</span>
                <span>{property.sqft.toLocaleString()} m²</span>
              </>
            )}
          </div>
        </div>

        {/* Nav arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full shadow transition-all
                bg-black/30 backdrop-blur-sm p-1.5
                lg:bg-white/90 lg:p-1 lg:opacity-0 lg:group-hover:opacity-100 lg:backdrop-blur-none lg:shadow-md"
            >
              <ChevronLeft className="w-4 h-4 text-white lg:text-gray-700" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full shadow transition-all
                bg-black/30 backdrop-blur-sm p-1.5
                lg:bg-white/90 lg:p-1 lg:opacity-0 lg:group-hover:opacity-100 lg:backdrop-blur-none lg:shadow-md"
            >
              <ChevronRight className="w-4 h-4 text-white lg:text-gray-700" />
            </button>

            {/* Mobile: photo count badge */}
            <div className="lg:hidden absolute bottom-3.5 right-3.5 z-10 bg-black/45 backdrop-blur-sm px-2 py-0.5 rounded-full pointer-events-none">
              <span className="text-white text-[11px] font-semibold">{currentImageIndex + 1}/{images.length}</span>
            </div>

            {/* Desktop: dot indicators */}
            <div className="hidden lg:flex absolute bottom-2.5 left-1/2 -translate-x-1/2 gap-1">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => goTo(e, i)}
                  className={`h-1.5 rounded-full transition-all ${i === currentImageIndex ? 'bg-white w-4' : 'bg-white/60 w-1.5 hover:bg-white/80'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Mobile: minimal info (price + stats shown in photo overlay) */}
      <div className="lg:hidden px-3.5 py-2.5">
        {property.address && (
          <p className="text-[13px] text-gray-800 font-medium truncate">{property.address}</p>
        )}
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-xs text-gray-400 truncate">
            {[property.subCity, property.city].filter(Boolean).join(', ')}
          </p>
          {property.propertyType && (
            <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2">{property.propertyType}</span>
          )}
        </div>
      </div>

      {/* Desktop: full info row (unchanged) */}
      <div className="hidden lg:block px-3 py-2.5">
        <p className="text-base font-bold text-gray-900 leading-tight mb-1">
          {formatETB(displayPrice)}
          {showRent && <span className="text-sm font-normal text-gray-500 ml-0.5">/mo</span>}
        </p>
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-800 mb-1.5">
          <span>{property.beds} bd</span>
          <span className="text-gray-300 font-normal">|</span>
          <span>{property.baths} ba</span>
          {property.sqft > 0 && (
            <>
              <span className="text-gray-300 font-normal">|</span>
              <span>{property.sqft.toLocaleString()} m²</span>
            </>
          )}
        </div>
        {property.address && (
          <p className="text-[13px] text-gray-600 truncate">{property.address}</p>
        )}
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-xs text-gray-400 truncate">
            {[property.subCity, property.city].filter(Boolean).join(', ')}
          </p>
          {property.propertyType && (
            <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2">{property.propertyType}</span>
          )}
        </div>
      </div>
    </div>
  );
}
