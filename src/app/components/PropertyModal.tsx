import React, { useState, useEffect } from 'react';
import { X, Bed, Bath, Maximize, ChevronLeft, ChevronRight, Mail, Phone, User } from 'lucide-react';
import { type Property } from '@/app/data/properties';
import { useAuth } from '@/lib/auth-context';

interface PropertyModalProps {
  property: Property | null;
  onClose: () => void;
  listingMode: 'buy' | 'rent';
}

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''

export default function PropertyModal({ property, onClose, listingMode }: PropertyModalProps) {
  const [slideshowIndex, setSlideshowIndex] = useState<number | null>(null);
  const { user, photoURL } = useAuth();

  useEffect(() => {
    if (!property?.firestoreId || !WORKER_URL) return
    fetch(`${WORKER_URL}/listing/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId: property.firestoreId }),
    }).catch(() => {})
  }, [property?.firestoreId]);

  if (!property) return null;

  const isOwner = !!user && (user.email === property.ownerEmail || user.uid === property.firestoreId)
  const ownerPhoto = isOwner ? photoURL : (property.ownerPhotoURL ?? null)

  const propertyImages = property.photos?.length
    ? property.photos
    : [property.image];

  const displayPrice = listingMode === 'buy' ? (property.price || 0) : (property.rent || 0);
  const priceLabel = listingMode === 'buy' ? '' : '/mo';

  const nextImage = () => {
    if (slideshowIndex !== null) {
      setSlideshowIndex((slideshowIndex + 1) % propertyImages.length);
    }
  };

  const prevImage = () => {
    if (slideshowIndex !== null) {
      setSlideshowIndex((slideshowIndex - 1 + propertyImages.length) % propertyImages.length);
    }
  };

  const closeSlideshowHandler = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSlideshowIndex(null);
  };

  const hasOwner = !property.isAgent && !property.agentId && (property.ownerDisplayName || property.ownerEmail);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-0 lg:p-4" onClick={onClose}>
        <div className="flex items-start gap-4 w-full h-full lg:h-auto justify-center">

          {/* Main property modal */}
          <div className="bg-white rounded-2xl max-w-5xl w-full h-full lg:max-h-[90vh] overflow-hidden shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex-shrink-0 bg-white/95 backdrop-blur-md border-b border-gray-200 flex items-center justify-between p-4 lg:p-6 z-10 shadow-sm">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl lg:text-4xl font-bold truncate text-black">
                  Br {displayPrice.toLocaleString()}{priceLabel}
                </h2>
                <p className="text-gray-600 text-sm lg:text-base truncate font-medium mt-1">
                  {[property.address, property.city, property.state].filter(Boolean).join(', ')}
                </p>
              </div>
              <button onClick={onClose} className="p-2 lg:p-3 hover:bg-gray-100 rounded-full flex-shrink-0 ml-2 transition-all hover:rotate-90">
                <X className="w-5 h-5 lg:w-6 lg:h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 lg:gap-3 p-3 lg:p-6 bg-gray-50">
                {propertyImages.map((img, idx) => (
                  <div key={idx} className={`relative group ${idx === 0 ? 'col-span-2' : ''}`}>
                    <img
                      src={img}
                      alt={`Property ${idx + 1}`}
                      className={`w-full object-cover rounded-xl cursor-pointer transition-all ${idx === 0 ? 'h-56 lg:h-96' : 'h-36 lg:h-52'} group-hover:scale-[1.02] shadow-md group-hover:shadow-xl`}
                      onClick={(e) => { e.stopPropagation(); setSlideshowIndex(idx); }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-xl transition-all pointer-events-none" />
                  </div>
                ))}
              </div>

              <div className="p-4 lg:p-6 space-y-5 lg:space-y-6">

                {/* Core specs */}
                <div className="flex flex-wrap items-center gap-3 lg:gap-5">
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl">
                    <Bed className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-gray-800">{property.beds} Beds</span>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl">
                    <Bath className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-gray-800">{property.baths} Baths</span>
                  </div>
                  {property.sqft > 0 && (
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl">
                      <Maximize className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-semibold text-gray-800">{property.sqft.toLocaleString()} m²</span>
                    </div>
                  )}
                  {property.furnished && (
                    <span className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-2 rounded-xl text-sm font-semibold">Furnished</span>
                  )}
                </div>

                {/* Property details table */}
                {(property.propertyType || property.availableFrom || property.subCity || property.woreda || property.kebele || property.city) && (
                  <div>
                    <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-3">Property Details</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                      {property.propertyType && (
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-gray-500">Type</span>
                          <span className="font-medium text-gray-800">{property.propertyType}</span>
                        </div>
                      )}
                      {property.city && (
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-gray-500">City</span>
                          <span className="font-medium text-gray-800">{property.city}</span>
                        </div>
                      )}
                      {property.subCity && (
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-gray-500">Sub City</span>
                          <span className="font-medium text-gray-800">{property.subCity}</span>
                        </div>
                      )}
                      {property.woreda && (
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-gray-500">Woreda</span>
                          <span className="font-medium text-gray-800">{property.woreda}</span>
                        </div>
                      )}
                      {property.kebele && (
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-gray-500">Kebele</span>
                          <span className="font-medium text-gray-800">{property.kebele}</span>
                        </div>
                      )}
                      {property.landmark && (
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-gray-500">Landmark</span>
                          <span className="font-medium text-gray-800">{property.landmark}</span>
                        </div>
                      )}
                      {property.availableFrom && (
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-gray-500">Available From</span>
                          <span className="font-medium text-gray-800">
                            {new Date(property.availableFrom).toLocaleDateString('en-ET', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Description */}
                {property.description && (
                  <div>
                    <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-2">Description</h3>
                    <p className="text-gray-600 text-sm lg:text-base leading-relaxed whitespace-pre-line">{property.description}</p>
                  </div>
                )}

                {/* Amenities */}
                {property.amenities && property.amenities.length > 0 && (
                  <div>
                    <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-3">Amenities</h3>
                    <div className="flex flex-wrap gap-2">
                      {property.amenities.map((a) => (
                        <span key={a} className="bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1.5 rounded-full text-xs font-medium">{a}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mobile contact card */}
                {hasOwner && (
                  <div className="lg:hidden border border-gray-100 rounded-2xl overflow-hidden">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-600 px-5 pt-6 pb-8 text-center">
                      <div className="relative inline-block">
                        {ownerPhoto ? (
                          <img
                            src={ownerPhoto}
                            alt={property.ownerDisplayName ?? 'Owner'}
                            className="w-16 h-16 rounded-full object-cover ring-4 ring-white/80 shadow-xl mx-auto"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-white/20 ring-4 ring-white/80 shadow-xl mx-auto flex items-center justify-center">
                            <User className="w-8 h-8 text-white/70" />
                          </div>
                        )}
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-400 border-2 border-white rounded-full" />
                      </div>
                      <p className="text-white font-bold text-base mt-2">{property.ownerDisplayName ?? 'Property Owner'}</p>
                      <p className="text-blue-200 text-xs mt-0.5">Property Owner</p>
                    </div>
                    <div className="px-5 py-4 -mt-4 bg-white rounded-t-2xl relative">
                      {property.ownerEmail && (
                        <a
                          href={`mailto:${property.ownerEmail}`}
                          className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl transition-colors text-sm font-semibold shadow-md shadow-blue-500/25"
                        >
                          <Mail className="w-4 h-4" />
                          Email Owner
                        </a>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* Owner card — shown to the right on desktop */}
          {hasOwner && (
            <div
              className="hidden lg:flex flex-col bg-white rounded-2xl shadow-2xl w-72 xl:w-80 flex-shrink-0 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 px-6 pt-8 pb-10 text-center">
                <div className="relative inline-block">
                  {ownerPhoto ? (
                    <img
                      src={ownerPhoto}
                      alt={property.ownerDisplayName ?? 'Owner'}
                      className="w-24 h-24 rounded-full object-cover ring-4 ring-white/80 shadow-xl mx-auto"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-white/20 ring-4 ring-white/80 shadow-xl mx-auto flex items-center justify-center">
                      <User className="w-12 h-12 text-white/70" />
                    </div>
                  )}
                  <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full" />
                </div>
                <p className="text-white font-bold text-lg mt-3">{property.ownerDisplayName ?? 'Property Owner'}</p>
                <p className="text-blue-200 text-xs mt-0.5">Property Owner</p>
              </div>

              <div className="px-6 py-6 -mt-5 bg-white rounded-t-2xl relative">
                {property.ownerEmail && (
                  <a
                    href={`mailto:${property.ownerEmail}`}
                    className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl transition-colors text-sm font-semibold shadow-md shadow-blue-500/25"
                  >
                    <Mail className="w-4 h-4" />
                    Email Owner
                  </a>
                )}
              </div>
            </div>
          )}

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
            onClick={(e) => { e.stopPropagation(); prevImage(); }}
            className="absolute left-4 text-white p-4 hover:bg-white/20 rounded-full transition-all"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>

          <div className="max-w-7xl max-h-[90vh] px-4 lg:px-16" onClick={(e) => e.stopPropagation()}>
            <img
              src={propertyImages[slideshowIndex]}
              alt={`Property ${slideshowIndex + 1}`}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="text-white text-center mt-6 text-lg font-medium">
              {slideshowIndex + 1} / {propertyImages.length}
            </div>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); nextImage(); }}
            className="absolute right-4 text-white p-4 hover:bg-white/20 rounded-full transition-all"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </div>
      )}
    </>
  );
}
