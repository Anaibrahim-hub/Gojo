'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bath, BedDouble, CalendarDays, ChevronLeft, Clock, Flag, Heart, MapPin, Maximize2, MessageCircle, PartyPopper, Send, Share, ShieldCheck, X } from 'lucide-react'
import ReportModal from './ReportModal'
import VideoPlayer from './VideoPlayer'
import type { Property } from '@/app/data/properties'
import { useFavorites } from '@/lib/favorites-context'
import { useCurrency } from '@/lib/currency'
import { useLanguage } from '@/lib/language-context'
import { img } from '@/lib/image'
import { contactMessage, recordView, shareListing, telegramUrl, useContactPhone, whatsAppUrl } from '@/lib/contact'
import { isForSale, listingHref, listingPrice, listingTitle, photosOf, placeLabel, rentUnit, shortType, termLabel, unitLabel, type Mode } from '@/lib/listing-utils'
import { setSearchOpen } from '@/lib/search-open-store'

/**
 * Listing details in the prototype's layout: photos up top, a rounded sheet with
 * facts, highlights and description, and a price + contact bar pinned to the bottom.
 * Opens as a dialog over the page on desktop and full-screen on phones.
 */
export default function ListingSheet({
  listing,
  mode,
  onClose,
}: {
  listing: Property | null
  mode?: Mode | null
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted || !listing) return null
  return createPortal(<Sheet key={listing.firestoreId ?? listing.id} listing={listing} mode={mode} onClose={onClose} />, document.body)
}

function Sheet({ listing, mode, onClose }: { listing: Property; mode?: Mode | null; onClose: () => void }) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const { format } = useCurrency()
  const { language, translate } = useLanguage()
  const phone = useContactPhone(listing)
  // Gallery: the listing's video (if it has one) is slide 0, then each photo.
  const [slide, setSlide] = useState(0)
  const [reportOpen, setReportOpen] = useState(false)
  const [translated, setTranslated] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)
  const carouselRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const pushedRef = useRef(false)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => { recordView(listing.firestoreId) }, [listing.firestoreId])
  useEffect(() => { setTranslated(null) }, [language])

  // Lock page scroll and hide the tab bar while open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setSearchOpen(true)
    return () => { document.body.style.overflow = prev; setSearchOpen(false) }
  }, [])

  // The browser/phone back button closes the sheet instead of leaving the page.
  useEffect(() => {
    history.pushState({ listingSheet: true }, '')
    pushedRef.current = true
    const onPop = () => { pushedRef.current = false; onCloseRef.current() }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const close = useCallback(() => {
    if (pushedRef.current) { pushedRef.current = false; history.back() }
    else onCloseRef.current()
  }, [])

  useEffect(() => {
    if (reportOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, reportOpen])

  const photos = photosOf(listing)
  const price = listingPrice(listing, mode)
  const unit = unitLabel(listing, mode)
  const priceLabel = price > 0 ? `${format(price)}${unit ? ` ${unit}` : ''}` : 'Price on request'
  const message = contactMessage(listing, priceLabel)
  const saved = isFavorite(listing.id)
  const forSale = isForSale(listing, mode)
  const term = termLabel(listing, mode)
  const rate = forSale ? null : RATE_INFO[rentUnit(listing.propertyType)]
  const title = listingTitle(listing)
  const address = [listing.landmark, listing.kebele && `Kebele ${listing.kebele}`, listing.woreda && `Woreda ${listing.woreda}`, listing.subCity, listing.city]
    .filter(Boolean).join(', ')

  const hasVideo = !!listing.video
  const videoSlides = hasVideo ? 1 : 0
  const slideCount = photos.length + videoSlides
  const photoNumber = slide - videoSlides + 1 // 1-based; < 1 while on the video
  const goToSlide = (i: number) => {
    const el = carouselRef.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center md:bg-foreground/60 md:p-6 md:backdrop-blur-sm"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
        className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background font-sans text-foreground md:h-auto md:max-h-[92vh] md:max-w-3xl md:rounded-3xl md:shadow-2xl"
      >
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* Swipeable photo gallery */}
          <div className="relative">
            <div
              ref={carouselRef}
              onScroll={() => {
                const el = carouselRef.current
                if (el) setSlide(Math.round(el.scrollLeft / el.clientWidth))
              }}
              className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {listing.video && (
                <VideoPlayer
                  src={listing.video}
                  poster={photos[0]}
                  title={`Video tour of ${title}`}
                  active={slide === 0 && !reportOpen}
                  className="aspect-[4/3] w-full shrink-0 snap-center md:aspect-[16/9]"
                />
              )}
              {photos.map((src, i) => (
                <img
                  key={src + i}
                  src={img(src, { width: 1200 })}
                  alt={i === 0 ? title : `${title} — photo ${i + 1}`}
                  width={1200}
                  height={900}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  className="aspect-[4/3] w-full shrink-0 snap-center object-cover md:aspect-[16/9]"
                />
              ))}
            </div>

            {slideCount > 1 && (
              <>
                {photoNumber >= 1 && (
                  <span className="absolute bottom-10 right-4 rounded-full bg-foreground/60 px-2.5 py-1 text-xs font-semibold text-background">
                    {photoNumber} / {photos.length}
                  </span>
                )}
                {/* Arrows step from the video to each photo (phones can also swipe) */}
                <button
                  type="button"
                  aria-label={hasVideo && slide === 1 ? 'Back to video' : 'Previous photo'}
                  disabled={slide === 0}
                  onClick={() => goToSlide(slide - 1)}
                  className="absolute left-4 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-md transition-opacity disabled:pointer-events-none disabled:opacity-0"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label={slide === 0 && hasVideo ? 'Photos' : 'Next photo'}
                  disabled={slide === slideCount - 1}
                  onClick={() => goToSlide(slide + 1)}
                  className="absolute right-4 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-md transition-opacity disabled:pointer-events-none disabled:opacity-0"
                >
                  <ChevronLeft className="h-5 w-5 rotate-180" />
                </button>
              </>
            )}

            {/* Floating actions over the photo */}
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute left-4 top-[calc(env(safe-area-inset-top)+1rem)] z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 shadow-md backdrop-blur md:top-4"
            >
              <ChevronLeft className="h-5 w-5 md:hidden" />
              <X className="hidden h-5 w-5 md:block" />
            </button>
            <div className="absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-10 flex gap-2 md:top-4">
              <button
                type="button"
                aria-label="Share"
                onClick={() => shareListing(`${title} — ${placeLabel(listing)}`, `${window.location.origin}${listingHref(listing)}`)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-background/90 shadow-md backdrop-blur"
              >
                <Share className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={saved ? 'Remove from favorites' : 'Save listing'}
                aria-pressed={saved}
                onClick={() => toggleFavorite(listing.id)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-background/90 shadow-md backdrop-blur"
              >
                <Heart className={`h-4 w-4 ${saved ? 'fill-primary text-primary' : ''}`} />
              </button>
            </div>
          </div>

          {/* Sheet */}
          <div className="relative -mt-6 rounded-t-3xl bg-background px-6 pb-8 pt-4 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] md:px-8">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border md:hidden" />

            <h1 className="text-2xl font-bold tracking-tight first-letter:uppercase md:text-3xl">{title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {placeLabel(listing)}</span>
              <span>·</span>
              <span>{term}</span>
            </div>

            {/* House facts */}
            <div className="mt-6 grid grid-cols-3 divide-x divide-border rounded-2xl border border-border py-4 text-center">
              <Fact icon={<BedDouble className="h-5 w-5" />} value={listing.beds > 0 ? String(listing.beds) : '—'} label="Bedrooms" />
              <Fact icon={<Bath className="h-5 w-5" />} value={listing.baths > 0 ? String(listing.baths) : '—'} label="Bathrooms" />
              <Fact icon={<Maximize2 className="h-5 w-5" />} value={listing.sqft > 0 ? `${listing.sqft} m²` : '—'} label="Area" />
            </div>

            {/* Highlights */}
            <div className="mt-8 space-y-5 border-b border-border pb-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  {shortType(listing)}{unit === '/ month' || forSale ? ` ${forSale ? 'for sale' : 'for rent'}` : ''} in {listing.subCity || listing.city}
                </h2>
                {listing.isAgent && (
                  <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">Verified agent</span>
                )}
              </div>
              {rate && <Feature icon={rate.icon} title={rate.title} body={rate.body} />}
              {listing.isAgent && (
                <Feature icon={<ShieldCheck className="h-6 w-6" />} title="Listed by a Gojo agent" body="This listing is managed by an agent verified by our team." />
              )}
              {listing.availableFrom && (
                <Feature
                  icon={<CalendarDays className="h-6 w-6" />}
                  title="Availability"
                  body={`Available from ${new Date(listing.availableFrom).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`}
                />
              )}
              {address && <Feature icon={<MapPin className="h-6 w-6" />} title="Location" body={address} />}
            </div>

            {/* About */}
            {listing.description && (
              <div className="border-b border-border py-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">About this home</h3>
                  {language !== 'en' && !translated && (
                    <button
                      type="button"
                      disabled={translating}
                      onClick={async () => {
                        setTranslating(true)
                        try { setTranslated(await translate(listing.description!)) } finally { setTranslating(false) }
                      }}
                      className="text-sm font-semibold underline underline-offset-4 disabled:opacity-50"
                    >
                      {translating ? 'Translating…' : 'Translate'}
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-line text-base leading-relaxed">{translated ?? listing.description}</p>
              </div>
            )}

            {listing.amenities && listing.amenities.length > 0 && (
              <div className="border-b border-border py-6">
                <h3 className="mb-3 text-lg font-semibold">What this place offers</h3>
                <div className="flex flex-wrap gap-2">
                  {listing.amenities.map(a => (
                    <span key={a} className="rounded-full border border-border px-3 py-1.5 text-sm">{a}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Lister */}
            <div className="flex items-center gap-4 py-6">
              {listing.ownerPhotoURL ? (
                <img src={listing.ownerPhotoURL} alt="" className="h-14 w-14 rounded-full object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-lg font-bold text-muted-foreground">
                  {(listing.ownerDisplayName ?? 'G').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="font-semibold">Listed by {listing.ownerDisplayName || (listing.isAgent ? 'a Gojo agent' : 'the owner')}</div>
                <div className="text-sm text-muted-foreground">{listing.isAgent ? 'Property agent' : 'Property owner'}</div>
              </div>
            </div>

            {listing.firestoreId && (
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="flex items-center gap-2 text-sm font-semibold text-muted-foreground underline underline-offset-4"
              >
                <Flag className="h-4 w-4" /> Report this listing
              </button>
            )}
          </div>
        </div>

        {/* Price + contact bar */}
        <div className="shrink-0 border-t border-border bg-background/95 px-6 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur md:px-8 md:pb-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-lg font-bold">{price > 0 ? format(price) : 'Price on request'}</span>
              {price > 0 && unit && <span className="text-sm text-muted-foreground"> {unit}</span>}
            </div>
            <span className="text-sm text-muted-foreground">{term}</span>
          </div>
          {phone ? (
            <div className="mt-2 flex gap-3">
              <a href={whatsAppUrl(phone, message)} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-sm font-semibold text-white">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
              <a href={telegramUrl(phone, message)} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#229ED9] py-3 text-sm font-semibold text-white">
                <Send className="h-4 w-4" /> Telegram
              </a>
            </div>
          ) : (
            <p className="mt-2 py-3 text-center text-sm text-muted-foreground">No contact number available</p>
          )}
        </div>
      </div>

      {listing.firestoreId && (
        <div onClick={e => e.stopPropagation()}>
          <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} targetType="listing" targetId={listing.firestoreId} />
        </div>
      )}
    </div>
  )
}

// How each kind of rental is priced, shown as a highlight in the listing.
const RATE_INFO = {
  night: {
    icon: <BedDouble className="h-6 w-6" />,
    title: 'Nightly rate',
    body: 'Priced per night. Message the host to check your dates and availability.',
  },
  day: {
    icon: <PartyPopper className="h-6 w-6" />,
    title: 'Daily booking',
    body: 'Priced per day — for weddings, graduations, and corporate events. Message the host to check your date.',
  },
  month: {
    icon: <Clock className="h-6 w-6" />,
    title: 'Long-term lease',
    body: 'Priced per month. Ask the owner about the lease length and deposit.',
  },
} as const

function Fact({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-foreground">{icon}</span>
      <span className="text-sm font-semibold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 text-foreground">{icon}</div>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground">{body}</div>
      </div>
    </div>
  )
}
