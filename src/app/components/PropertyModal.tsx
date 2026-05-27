import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Mail, Bed, Bath, Maximize, Images } from 'lucide-react';
import { type Property } from '@/app/data/properties';
import { useAuth } from '@/lib/auth-context';
import { formatETB } from '@/app/components/ui/utils';

interface PropertyModalProps {
  property: Property | null;
  onClose: () => void;
  listingMode: 'buy' | 'rent';
}

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? '';

export default function PropertyModal({ property, onClose, listingMode }: PropertyModalProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [mobilePhotoIndex, setMobilePhotoIndex] = useState(0);
  const [mobileTouchStartX, setMobileTouchStartX] = useState(0);
  const { user, photoURL } = useAuth();
  const onCloseRef = React.useRef(onClose);
  const pushedHistoryRef = React.useRef(false);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!property?.firestoreId || !WORKER_URL) return;
    fetch(`${WORKER_URL}/listing/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId: property.firestoreId }),
    }).catch(() => {});
  }, [property?.firestoreId]);

  useEffect(() => {
    if (!property) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [property]);

  useEffect(() => {
    if (!property) return;
    history.pushState({ modal: true }, '');
    pushedHistoryRef.current = true;
    const handlePopState = () => { pushedHistoryRef.current = false; onCloseRef.current(); };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [property]);

  const handleClose = () => {
    if (pushedHistoryRef.current) { pushedHistoryRef.current = false; history.back(); }
    else onCloseRef.current();
  };

  if (!property) return null;

  const isOwner = !!user && (user.email === property.ownerEmail || user.uid === property.firestoreId);
  const ownerPhoto = isOwner ? photoURL : (property.ownerPhotoURL ?? null);
  const images = property.photos?.length ? property.photos : [property.image];

  const wantBuy = listingMode === 'buy';
  const hasSalePrice = (property.price ?? 0) > 0;
  const hasRentPrice = (property.rent ?? 0) > 0;
  const showRent = (!wantBuy || !hasSalePrice) && hasRentPrice;
  const displayPrice = showRent ? property.rent : property.price;
  const hasOwner = !property.agentId && (property.ownerDisplayName || property.ownerEmail);

  const nextLightbox = () => lightboxIndex !== null && setLightboxIndex((lightboxIndex + 1) % images.length);
  const prevLightbox = () => lightboxIndex !== null && setLightboxIndex((lightboxIndex - 1 + images.length) % images.length);

  const onMobileTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - mobileTouchStartX;
    if (Math.abs(dx) > 50) {
      dx < 0
        ? setMobilePhotoIndex(i => (i + 1) % images.length)
        : setMobilePhotoIndex(i => (i - 1 + images.length) % images.length);
    }
  };

  return (
    <>
      {/* Modal */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1000] flex items-end lg:items-center justify-center lg:gap-4 lg:px-4"
        onClick={handleClose}
      >
        <div
          className="relative w-full h-full lg:h-auto lg:max-h-[92vh] lg:max-w-4xl xl:max-w-5xl bg-white lg:rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Mobile: back arrow (top-left, over photo) */}
          <button
            onClick={handleClose}
            className="lg:hidden absolute top-4 left-4 z-20 bg-black/35 backdrop-blur-sm p-2 rounded-full"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>

          {/* Desktop: X button (top-right) */}
          <button
            onClick={handleClose}
            className="hidden lg:flex absolute top-4 right-4 z-20 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-white transition-all hover:scale-110 items-center justify-center"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>

          {/* ── Desktop photo grid ── */}
          <div className="hidden lg:block flex-shrink-0 h-[400px] xl:h-[460px] overflow-hidden">
            {images.length === 1 ? (
              <div className="relative h-full cursor-pointer overflow-hidden group" onClick={() => setLightboxIndex(0)}>
                <img src={images[0]} alt="Property" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all" />
              </div>
            ) : (
              <div className={`grid h-full gap-1 ${images.length >= 3 ? 'grid-cols-[3fr_2fr]' : 'grid-cols-2'}`}>
                <div className="relative h-full cursor-pointer overflow-hidden group" onClick={() => setLightboxIndex(0)}>
                  <img src={images[0]} alt="Property" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all pointer-events-none" />
                </div>
                <div className="grid grid-rows-2 gap-1 h-full min-h-0 overflow-hidden">
                  <div className="relative cursor-pointer overflow-hidden group min-h-0" onClick={() => setLightboxIndex(1)}>
                    <img src={images[1]} alt="Property" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all pointer-events-none" />
                  </div>
                  <div className="relative cursor-pointer overflow-hidden group min-h-0" onClick={() => setLightboxIndex(2)}>
                    <img src={images[2] ?? images[1]} alt="Property" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all pointer-events-none" />
                    {images.length > 3 && (
                      <div className="absolute inset-0 bg-black/45 flex items-center justify-center gap-2 hover:bg-black/55 transition-all">
                        <Images className="w-5 h-5 text-white" />
                        <span className="text-white text-sm font-semibold">+{images.length - 3} more</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Mobile photo carousel (cinematic) ── */}
          <div
            className="lg:hidden flex-shrink-0 relative h-80"
            onTouchStart={(e) => setMobileTouchStartX(e.targetTouches[0].clientX)}
            onTouchEnd={onMobileTouchEnd}
          >
            <img
              src={images[mobilePhotoIndex]}
              alt="Property"
              className="w-full h-full object-cover"
            />
            {/* Subtle bottom gradient */}
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent pointer-events-none" />

            {images.length > 1 && (
              <>
                <button
                  onClick={() => setMobilePhotoIndex(i => (i - 1 + images.length) % images.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/30 backdrop-blur-sm p-2 rounded-full"
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={() => setMobilePhotoIndex(i => (i + 1) % images.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/30 backdrop-blur-sm p-2 rounded-full"
                >
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
                {/* Photo count badge */}
                <div className="absolute bottom-3.5 right-3.5 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full pointer-events-none">
                  <span className="text-white text-xs font-semibold">{mobilePhotoIndex + 1} / {images.length}</span>
                </div>
              </>
            )}
          </div>

          {/* ── Scrollable content ── */}
          <div className="flex-1 overflow-y-auto">
            <div>
              <div className="flex-1 px-5 lg:px-8 py-5 lg:py-6">

                {/* Price + stats */}
                <div className="mb-5 lg:mb-6">
                  <p className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight mb-2">
                    {formatETB(displayPrice)}
                    {showRent && <span className="text-xl font-normal text-gray-500 ml-1">/mo</span>}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-600">
                    <span className="flex items-center gap-1.5">
                      <Bed className="w-4 h-4 text-gray-400" />
                      <strong className="text-gray-900">{property.beds}</strong> Beds
                    </span>
                    <span className="text-gray-200">|</span>
                    <span className="flex items-center gap-1.5">
                      <Bath className="w-4 h-4 text-gray-400" />
                      <strong className="text-gray-900">{property.baths}</strong> Baths
                    </span>
                    {property.sqft > 0 && (
                      <>
                        <span className="text-gray-200">|</span>
                        <span className="flex items-center gap-1.5">
                          <Maximize className="w-4 h-4 text-gray-400" />
                          <strong className="text-gray-900">{property.sqft.toLocaleString()}</strong> m²
                        </span>
                      </>
                    )}
                    {property.furnished && (
                      <span className="ml-1 px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold">Furnished</span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm mt-2">
                    {[property.address, property.subCity, property.city].filter(Boolean).join(', ')}
                  </p>
                </div>

                <div className="border-t border-gray-100 mb-5" />

                {/* Property details */}
                {(property.propertyType || property.availableFrom || property.subCity || property.woreda || property.kebele || property.landmark) && (
                  <div className="mb-5 lg:mb-6">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Property Details</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-0 text-sm">
                      {[
                        ['Type', property.propertyType],
                        ['City', property.city],
                        ['Sub-City', property.subCity],
                        ['Woreda', property.woreda],
                        ['Kebele', property.kebele],
                        ['Landmark', property.landmark],
                        ['Available From', property.availableFrom
                          ? new Date(property.availableFrom).toLocaleDateString('en-ET', { year: 'numeric', month: 'long', day: 'numeric' })
                          : undefined],
                      ].filter(([, v]) => !!v).map(([label, value]) => (
                        <div key={label as string} className="flex justify-between py-2.5 border-b border-gray-50">
                          <span className="text-gray-400">{label}</span>
                          <span className="font-medium text-gray-800 text-right ml-4">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                {property.description && (
                  <div className="mb-5 lg:mb-6">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">About this home</h3>
                    <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{property.description}</p>
                  </div>
                )}

                {/* Amenities */}
                {property.amenities && property.amenities.length > 0 && (
                  <div className="mb-5 lg:mb-6">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Amenities</h3>
                    <div className="flex flex-wrap gap-2">
                      {property.amenities.map(a => (
                        <span key={a} className="px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-full text-xs font-medium">{a}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Mobile sticky contact bar ── */}
          {hasOwner && property.ownerEmail && (
            <div className="lg:hidden flex-shrink-0 px-4 py-3.5 border-t border-gray-100 bg-white">
              <a
                href={`mailto:${property.ownerEmail}`}
                className="flex items-center justify-center gap-2 w-full bg-gray-900 hover:bg-gray-800 active:bg-black text-white py-4 rounded-2xl text-sm font-semibold transition-colors"
              >
                <Mail className="w-4 h-4" />
                {property.isAgent ? 'Contact Agent' : 'Contact Owner'}
              </a>
            </div>
          )}
        </div>

        {/* ── Desktop contact card — outside the modal ── */}
        {hasOwner && (
          <div
            className="hidden lg:flex flex-col w-72 xl:w-80 flex-shrink-0 self-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl border border-white/10">
              <div className="bg-gray-950 px-6 py-7 text-center">
                {ownerPhoto ? (
                  <img
                    src={ownerPhoto}
                    alt={property.ownerDisplayName ?? 'Owner'}
                    className="w-16 h-16 rounded-full object-cover ring-2 ring-white/20 mx-auto mb-3"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-white/10 ring-2 ring-white/20 mx-auto mb-3 flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">
                      {(property.ownerDisplayName ?? property.ownerEmail ?? '?')[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <p className="text-white font-semibold text-base leading-tight">{property.ownerDisplayName ?? 'Property Owner'}</p>
                <p className="text-gray-400 text-xs mt-1">{property.isAgent ? 'Licensed Agent' : 'Property Owner'}</p>
              </div>
              <div className="p-5 space-y-3">
                <div className="text-center pb-3 border-b border-gray-100">
                  <p className="text-2xl font-bold text-gray-900">
                    {formatETB(displayPrice)}
                    {showRent && <span className="text-base font-normal text-gray-500 ml-1">/mo</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {[property.subCity, property.city].filter(Boolean).join(', ')}
                  </p>
                </div>
                {property.ownerEmail && (
                  <>
                    <a
                      href={`mailto:${property.ownerEmail}`}
                      className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors shadow-md shadow-blue-600/20"
                    >
                      <Mail className="w-4 h-4" />
                      {property.isAgent ? 'Contact Agent' : 'Contact Owner'}
                    </a>
                    <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                      By proceeding, you agree to our{' '}
                      <a href="/terms" className="underline hover:text-gray-600 transition-colors">Terms of Use</a>.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Fullscreen lightbox ── */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 bg-black/95 z-[2000] flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          <button onClick={() => setLightboxIndex(null)} className="absolute top-4 right-4 text-white p-3 hover:bg-white/10 rounded-full transition-all z-10">
            <X className="w-7 h-7" />
          </button>
          <button onClick={e => { e.stopPropagation(); prevLightbox(); }} className="absolute left-4 text-white p-3 hover:bg-white/10 rounded-full transition-all">
            <ChevronLeft className="w-7 h-7" />
          </button>
          <div className="max-w-6xl max-h-[90vh] w-full px-16" onClick={e => e.stopPropagation()}>
            <img
              src={images[lightboxIndex]}
              alt={`Photo ${lightboxIndex + 1}`}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl mx-auto"
            />
            <p className="text-gray-500 text-center mt-4 text-sm">{lightboxIndex + 1} / {images.length}</p>
          </div>
          <button onClick={e => { e.stopPropagation(); nextLightbox(); }} className="absolute right-4 text-white p-3 hover:bg-white/10 rounded-full transition-all">
            <ChevronRight className="w-7 h-7" />
          </button>
        </div>
      )}
    </>
  );
}
