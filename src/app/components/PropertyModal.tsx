import React, { useState } from 'react';
import { X, Bed, Bath, Maximize, MapPin, Calendar, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';

interface PropertyModalProps {
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
  } | null;
  onClose: () => void;
  listingMode: 'buy' | 'rent';
}

export default function PropertyModal({ property, onClose, listingMode }: PropertyModalProps) {
  const [slideshowIndex, setSlideshowIndex] = useState<number | null>(null);

  if (!property) return null;

  const mockImages = [
    property.image,
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
    'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800',
    'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800',
  ];

  const displayPrice = listingMode === 'buy' ? (property.price || 0) : (property.rent || 0);
  const priceLabel = listingMode === 'buy' ? '' : '/mo';

  const buyingScore = Math.floor(Math.random() * 30) + 70;
  const daysOnMarket = Math.floor(Math.random() * 30) + 1;
  const basePrice = listingMode === 'buy' ? (property.price || 0) : (property.rent || 0);
  const medianValue = basePrice + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * (listingMode === 'buy' ? 5000000 : 10000));

  const nextImage = () => {
    if (slideshowIndex !== null) {
      setSlideshowIndex((slideshowIndex + 1) % mockImages.length);
    }
  };

  const prevImage = () => {
    if (slideshowIndex !== null) {
      setSlideshowIndex((slideshowIndex - 1 + mockImages.length) % mockImages.length);
    }
  };

  const handleImageClick = (index: number) => {
    setSlideshowIndex(index);
  };

  const closeSlideshowHandler = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSlideshowIndex(null);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-0 lg:p-4" onClick={onClose}>
        <div className="bg-white rounded-none lg:rounded-2xl max-w-5xl w-full h-full lg:max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-gray-200 flex items-center justify-between p-4 lg:p-6 z-10 shadow-sm">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl lg:text-4xl font-bold truncate text-black">
              Br {displayPrice.toLocaleString()}{priceLabel}
            </h2>
            <p className="text-gray-600 text-sm lg:text-base truncate font-medium mt-1">{property.address}, {property.city}, {property.state}</p>
          </div>
          <button onClick={onClose} className="p-2 lg:p-3 hover:bg-gray-100 rounded-full flex-shrink-0 ml-2 transition-all hover:rotate-90">
            <X className="w-5 h-5 lg:w-6 lg:h-6" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:gap-3 p-3 lg:p-6 bg-gray-50">
          {mockImages.map((img, idx) => (
            <div key={idx} className={`relative group ${idx === 0 ? 'col-span-2' : ''}`}>
              <img
                src={img}
                alt={`Property ${idx + 1}`}
                className={`w-full object-cover rounded-xl cursor-pointer transition-all ${idx === 0 ? 'h-56 lg:h-96' : 'h-36 lg:h-52'} group-hover:scale-[1.02] shadow-md group-hover:shadow-xl`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleImageClick(idx);
                }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-xl transition-all pointer-events-none" />
            </div>
          ))}
        </div>

        <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
          <div className="flex flex-wrap items-center gap-4 lg:gap-6">
            <div className="flex items-center gap-2">
              <Bed className="w-4 h-4 lg:w-5 lg:h-5 text-gray-600" />
              <span className="text-sm lg:text-lg">{property.beds} Beds</span>
            </div>
            <div className="flex items-center gap-2">
              <Bath className="w-4 h-4 lg:w-5 lg:h-5 text-gray-600" />
              <span className="text-sm lg:text-lg">{property.baths} Baths</span>
            </div>
            <div className="flex items-center gap-2">
              <Maximize className="w-4 h-4 lg:w-5 lg:h-5 text-gray-600" />
              <span className="text-sm lg:text-lg">{(property.sqft || 0).toLocaleString()} sqft</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-100 rounded-2xl p-5 lg:p-7 shadow-sm">
            <h3 className="text-xl lg:text-2xl font-bold mb-4 lg:mb-5 text-gray-800">
              {listingMode === 'buy' ? '💡 Investment Insights' : '📊 Rental Insights'}
            </h3>
            <div className="grid grid-cols-3 gap-3 lg:gap-4">
              <div>
                <div className="flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-2 text-gray-600 mb-1">
                  <TrendingUp className="w-3 h-3 lg:w-4 lg:h-4" />
                  <span className="text-xs lg:text-sm">{listingMode === 'buy' ? 'Buying' : 'Value'} Score</span>
                </div>
                <div className="text-lg lg:text-2xl text-green-600">{buyingScore}/100</div>
              </div>
              <div>
                <div className="flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-2 text-gray-600 mb-1">
                  <Calendar className="w-3 h-3 lg:w-4 lg:h-4" />
                  <span className="text-xs lg:text-sm">Days on Market</span>
                </div>
                <div className="text-lg lg:text-2xl">{daysOnMarket}</div>
              </div>
              <div>
                <div className="flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-2 text-gray-600 mb-1">
                  <MapPin className="w-3 h-3 lg:w-4 lg:h-4" />
                  <span className="text-xs lg:text-sm">Median {listingMode === 'buy' ? 'Sale' : 'Rent'}</span>
                </div>
                <div className="text-lg lg:text-2xl">
                  {listingMode === 'buy' ? 'Br ' + (medianValue / 1000000).toFixed(1) + 'M' : 'Br ' + medianValue.toLocaleString()}
                </div>
              </div>
            </div>
            <div className="mt-3 lg:mt-4 text-xs lg:text-sm text-gray-600">
              {listingMode === 'buy'
                ? `This property scores high based on comparable sales, market trends, and neighborhood growth in the ${property.zip} area.`
                : `This rental property offers competitive pricing and excellent value compared to similar units in the ${property.zip} area.`
              }
            </div>
          </div>

          <div>
            <h3 className="text-lg lg:text-xl mb-2 lg:mb-3">Property Details</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 text-xs lg:text-sm">
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-600">Property Type</span>
                <span>Single Family</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-600">Year Built</span>
                <span>{2024 - Math.floor(Math.random() * 50)}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-600">Lot Size</span>
                <span>{(Math.random() * 0.5 + 0.1).toFixed(2)} acres</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-600">HOA</span>
                <span>Br {(Math.floor(Math.random() * 5000 + 2000)).toLocaleString()}/month</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
            <button className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3.5 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 text-sm lg:text-base font-semibold">
              {listingMode === 'buy' ? '📅 Schedule Tour' : '🏠 Schedule Viewing'}
            </button>
            <button className="flex-1 border-2 border-gray-300 py-3.5 rounded-xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 hover:border-blue-400 transition-all text-sm lg:text-base font-semibold text-gray-700 hover:text-blue-700">
              {listingMode === 'buy' ? '💬 Contact Agent' : '📧 Contact Landlord'}
            </button>
          </div>
        </div>
      </div>
      </div>

      {slideshowIndex !== null && (
        <div
          className="fixed inset-0 bg-black/95 z-[2000] flex items-center justify-center"
          onClick={closeSlideshowHandler}
        >
          <button
            onClick={closeSlideshowHandler}
            className="absolute top-4 right-4 text-white p-3 hover:bg-white/20 rounded-full z-10 transition-all"
          >
            <X className="w-8 h-8" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              prevImage();
            }}
            className="absolute left-4 text-white p-4 hover:bg-white/20 rounded-full transition-all"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>

          <div className="max-w-7xl max-h-[90vh] px-4 lg:px-16" onClick={(e) => e.stopPropagation()}>
            <img
              src={mockImages[slideshowIndex]}
              alt={`Property ${slideshowIndex + 1}`}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="text-white text-center mt-6 text-lg font-medium">
              {slideshowIndex + 1} / {mockImages.length}
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              nextImage();
            }}
            className="absolute right-4 text-white p-4 hover:bg-white/20 rounded-full transition-all"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </div>
      )}
    </>
  );
}
