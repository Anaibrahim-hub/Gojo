import React, { useState } from 'react';
import { Bed, Bath, Maximize, Heart, ChevronLeft, ChevronRight } from 'lucide-react';
import { useFavorites } from '@/lib/favorites-context';

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
    lat: number;
    lng: number;
    type: 'sale' | 'rent' | 'both';
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
  const { isFavorite, toggleFavorite } = useFavorites();

  const statusConfig = {
    active: { bg: 'bg-slate-600', text: 'Active' },
    pending: { bg: 'bg-amber-500', text: 'Pending' },
    new: { bg: 'bg-emerald-500', text: 'New' },
  };

  const displayPrice = listingMode === 'buy' ? property.price : property.rent;
  const priceLabel = listingMode === 'buy' ? '' : '/mo';

  const propertyImages = [
    property.image,
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
    'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800',
    'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800',
  ];

  const nextImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % propertyImages.length);
  };

  const prevImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + propertyImages.length) % propertyImages.length);
  };

  const goToImage = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setCurrentImageIndex(index);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;

    if (Math.abs(distance) > minSwipeDistance) {
      if (distance > 0) {
        nextImage();
      } else {
        prevImage();
      }
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  return (
    <div
      className={`bg-white rounded-xl overflow-hidden transition-all duration-300 cursor-pointer group ${
        isHovered ? 'shadow-2xl scale-[1.02] ring-2 ring-blue-500' : 'shadow-md hover:shadow-xl'
      }`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className="relative overflow-hidden group/image"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={propertyImages[currentImageIndex]}
          alt={property.address}
          className="w-full h-72 lg:h-64 object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className={`absolute top-3 left-3 ${statusConfig[property.status].bg} text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg backdrop-blur-sm`}>
          {statusConfig[property.status].text}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(property.id); }}
          className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all z-10"
        >
          <Heart className={`w-4 h-4 transition-colors ${isFavorite(property.id) ? 'fill-red-500 text-red-500' : 'text-gray-700'}`} />
        </button>

        <button
          onClick={prevImage}
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm p-1.5 rounded-full shadow-lg hover:bg-white transition-all opacity-0 group-hover/image:opacity-100"
        >
          <ChevronLeft className="w-4 h-4 text-gray-700" />
        </button>

        <button
          onClick={nextImage}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm p-1.5 rounded-full shadow-lg hover:bg-white transition-all opacity-0 group-hover/image:opacity-100"
        >
          <ChevronRight className="w-4 h-4 text-gray-700" />
        </button>

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {propertyImages.map((_, index) => (
            <button
              key={index}
              onClick={(e) => goToImage(e, index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentImageIndex
                  ? 'bg-white w-6'
                  : 'bg-white/60 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      </div>
      <div className="p-4 lg:p-5">
        <div className="text-lg lg:text-xl font-bold text-black mb-3">
          Br {displayPrice.toLocaleString()}{priceLabel}
        </div>
        <div className="flex items-center gap-3 lg:gap-5 text-gray-600 mb-3 text-xs lg:text-base">
          <div className="flex items-center gap-1 lg:gap-1.5">
            <Bed className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-blue-600" />
            <span className="font-medium">{property.beds} bd</span>
          </div>
          <div className="flex items-center gap-1 lg:gap-1.5">
            <Bath className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-blue-600" />
            <span className="font-medium">{property.baths} ba</span>
          </div>
          <div className="flex items-center gap-1 lg:gap-1.5">
            <Maximize className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-blue-600" />
            <span className="font-medium">{property.sqft.toLocaleString()} sqft</span>
          </div>
        </div>
        <div className="font-medium text-gray-800 text-sm lg:text-base mb-1">{property.address}</div>
        <div className="text-gray-500 text-xs lg:text-sm">
          {property.city}, {property.state} {property.zip}
        </div>
      </div>
    </div>
  );
}
