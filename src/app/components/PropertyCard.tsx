'use client'

import React, { useState } from 'react';
import { Heart, ChevronLeft, ChevronRight, Share2, Check } from 'lucide-react';
import { useFavorites } from '@/lib/favorites-context';
import { formatETB } from '@/app/components/ui/utils';
import { img } from '@/lib/image';

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

  const isNew = isNewListing(property.createdAt);
  const badge = isNew ? 'New' : property.type === 'rent' ? 'Rent' : 'Sale';

  const statParts: string[] = [];
  if (property.beds > 0) statParts.push(`${property.beds} beds`);
  if (property.baths > 0) statParts.push(`${property.baths} baths`);
  if (property.sqft > 0) statParts.push(`${property.sqft.toLocaleString()} m²`);
  const statsLine = statParts.join(' · ');

  return (
    <div
      className={`group bg-white overflow-hidden cursor-pointer transition-all duration-200
        rounded-2xl border border-gray-100 shadow-sm
        lg:rounded-xl ${
        isHovered
          ? 'lg:shadow-md lg:border-blue-200'
          : 'lg:shadow-sm lg:hover:shadow-md lg:hover:border-gray-200'
      }`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Photo */}
      <div
        className="relative overflow-hidden"
        style={{ height: 'clamp(180px, 62vw, 256px)' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={img(images[currentImageIndex], { width: 640 })}
          alt={property.address}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 lg:group-hover:scale-[1.04]"
        />

        {/* Badge top-left */}
        <span className={`absolute top-3 left-3 z-10 text-[10px] font-semibold px-2.5 py-1 rounded-full
          ${isNew ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'}`}>
          {badge}
        </span>

        {/* Heart + Share — shadow-only on mobile, bg on desktop */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(property.id); }}
            className="p-1 lg:bg-white/90 lg:backdrop-blur-sm lg:rounded-full lg:shadow lg:hover:bg-white lg:hover:scale-110 transition-all"
            style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}
          >
            <Heart className={`w-5 h-5 lg:w-4 lg:h-4 ${isFavorite(property.id) ? 'fill-red-500 text-red-500' : 'text-white lg:text-gray-500'}`} />
          </button>
          <button
            onClick={handleShare}
            className="p-1 lg:bg-white/90 lg:backdrop-blur-sm lg:rounded-full lg:shadow lg:hover:bg-white lg:hover:scale-110 transition-all"
            style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}
          >
            {copied
              ? <Check className="w-5 h-5 lg:w-4 lg:h-4 text-green-400 lg:text-green-500" />
              : <Share2 className="w-5 h-5 lg:w-4 lg:h-4 text-white lg:text-gray-500" />}
          </button>
        </div>

        {/* Dot indicators — shown on both mobile and desktop */}
        {images.length > 1 && (
          <>
            {/* Mobile: tap dots (no arrows) */}
            <div className="lg:hidden absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none">
              {images.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all ${
                    i === currentImageIndex
                      ? 'w-2 h-2 bg-white'
                      : 'w-1.5 h-1.5 bg-white/50'
                  }`}
                />
              ))}
            </div>

            {/* Desktop: clickable dot indicators + arrows */}
            <button
              onClick={prev}
              className="hidden lg:block absolute left-2 top-1/2 -translate-y-1/2 rounded-full shadow bg-white/90 p-1 opacity-0 group-hover:opacity-100 transition-all"
            >
              <ChevronLeft className="w-4 h-4 text-gray-700" />
            </button>
            <button
              onClick={next}
              className="hidden lg:block absolute right-2 top-1/2 -translate-y-1/2 rounded-full shadow bg-white/90 p-1 opacity-0 group-hover:opacity-100 transition-all"
            >
              <ChevronRight className="w-4 h-4 text-gray-700" />
            </button>
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

      {/* Info section — same structure on mobile + desktop */}
      <div className="px-3.5 pt-3 pb-3.5 lg:px-3 lg:py-2.5">
        <p className="text-[17px] lg:text-[15px] font-bold text-gray-900 leading-tight tracking-tight">
          {formatETB(displayPrice)}
          {showRent && <span className="text-sm font-normal text-gray-400 ml-0.5">/mo</span>}
        </p>
        {statsLine && (
          <p className="text-[13px] text-gray-700 font-medium mt-1 truncate">{statsLine}</p>
        )}
        {property.address && (
          <p className="text-[12px] text-gray-500 mt-0.5 truncate">{property.address}</p>
        )}
        {(property.subCity || property.city) && (
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">
            {[property.subCity, property.city].filter(Boolean).join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}
