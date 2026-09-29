'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ChevronDown, ChevronUp, Heart, MapPin, Share2 } from 'lucide-react'
import VideoPlayer from './VideoPlayer'
import { useListings } from '@/lib/listings-context'
import { useFavorites } from '@/lib/favorites-context'
import { useCurrency } from '@/lib/currency'
import { useListingModal } from '@/lib/listing-modal-context'
import { shareListing } from '@/lib/contact'
import { listingHref, listingKey, listingPrice, listingTitle, photosOf, placeLabel, tourListings, unitLabel } from '@/lib/listing-utils'

/**
 * Full-screen video-tour feed (phones and desktop). Swipe, scroll, or use the
 * arrow keys to move between tours; tap the listing info to open its details.
 */
export default function ReelsView() {
  const params = useSearchParams()
  const router = useRouter()
  const start = params.get('start')
  const { listings, loading } = useListings()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { format } = useCurrency()
  const tours = useMemo(() => tourListings(listings), [listings])
  const [activeId, setActiveId] = useState<string | null>(start)
  const { current: selected, openListing } = useListingModal()
  const containerRef = useRef<HTMLDivElement>(null)

  const exit = () => {
    if (window.history.length > 1) router.back()
    else router.push('/')
  }

  const activeIndex = Math.max(0, tours.findIndex(t => listingKey(t) === activeId))

  const scrollToIndex = useCallback((i: number) => {
    const t = tours[i]
    if (t) document.getElementById(`reel-${listingKey(t)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [tours])

  // Jump to the tapped reel once tours load.
  useEffect(() => {
    if (!start || tours.length === 0) return
    document.getElementById(`reel-${start}`)?.scrollIntoView({ block: 'start' })
  }, [start, tours.length])

  // Track which reel is on screen so only that one plays.
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const io = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setActiveId(e.target.getAttribute('data-id')) }),
      { root, threshold: 0.6 },
    )
    root.querySelectorAll('[data-id]').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [tours])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Desktop keyboard navigation (disabled while the listing modal is open).
  useEffect(() => {
    if (selected) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); scrollToIndex(activeIndex + 1) }
      if (e.key === 'ArrowUp') { e.preventDefault(); scrollToIndex(activeIndex - 1) }
      if (e.key === 'Escape') exit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 h-[100dvh] w-screen snap-y snap-mandatory overflow-y-auto overscroll-contain bg-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <button
        type="button"
        onClick={exit}
        aria-label="Back"
        className="fixed left-4 top-[calc(env(safe-area-inset-top)+1.5rem)] z-20 flex h-10 w-10 items-center justify-center rounded-full bg-foreground/40 text-background backdrop-blur md:left-6 md:top-8"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      {tours.length > 1 && (
        <div className="fixed right-6 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-3 md:flex">
          <button
            type="button"
            aria-label="Previous tour"
            disabled={activeIndex === 0}
            onClick={() => scrollToIndex(activeIndex - 1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-background/90 text-foreground shadow-lg transition-opacity disabled:opacity-30"
          >
            <ChevronUp className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next tour"
            disabled={activeIndex === tours.length - 1}
            onClick={() => scrollToIndex(activeIndex + 1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-background/90 text-foreground shadow-lg transition-opacity disabled:opacity-30"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>
      )}

      {loading && tours.length === 0 && (
        <div className="flex h-[100dvh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-background/30 border-t-background" aria-label="Loading" />
        </div>
      )}

      {tours.map((l, i) => {
        const id = listingKey(l)
        const active = !selected && (activeId ? activeId === id : i === 0)
        const saved = isFavorite(l.id)
        const price = listingPrice(l)
        return (
          <section key={id} id={`reel-${id}`} data-id={id} className="relative h-[100dvh] w-full snap-start snap-always">
            <VideoPlayer
              src={l.video!}
              poster={photosOf(l)[0]}
              title={`Video tour of ${listingTitle(l)}`}
              active={active}
              autoPlay
              loop
              preload={Math.abs(i - activeIndex) <= 1}
              controlsPosition="screen-bottom"
              hideControlsOnMobile
              className="absolute inset-0"
            >
              {/* Shade behind the listing info so white text stays readable on bright video */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-1/2 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
              <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+8rem)] right-4 z-20 flex flex-col items-center gap-5 text-background md:bottom-28 md:right-24">
                <button type="button" aria-label={saved ? 'Remove from favorites' : 'Save'} aria-pressed={saved} onClick={() => toggleFavorite(l.id)} className="flex flex-col items-center gap-1">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-background/15 backdrop-blur">
                    <Heart className={`h-5 w-5 ${saved ? 'fill-primary text-primary' : ''}`} />
                  </span>
                  <span className="text-[11px] font-semibold">Save</span>
                </button>
                <button type="button" aria-label="Share" onClick={() => shareListing(listingTitle(l), `${window.location.origin}${listingHref(l)}`)} className="flex flex-col items-center gap-1">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-background/15 backdrop-blur">
                    <Share2 className="h-5 w-5" />
                  </span>
                  <span className="text-[11px] font-semibold">Share</span>
                </button>
              </div>

              {/* Listing info — tap anywhere here to open the listing modal */}
              <button
                type="button"
                onClick={() => openListing(l)}
                aria-label={`Open listing: ${listingTitle(l)}`}
                className="group absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] z-10 block px-5 pr-20 text-left text-background md:bottom-20 md:px-10"
              >
                <div className="max-w-2xl">
                  <h2 className="text-xl font-bold leading-tight first-letter:uppercase md:text-3xl">{listingTitle(l)}</h2>
                  <div className="mt-1.5 flex items-center gap-2 text-sm opacity-90 md:text-base">
                    <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4" /> {placeLabel(l)}
                  </div>
                  {price > 0 && (
                    <div className="mt-1 text-sm font-semibold md:text-lg">
                      {format(price)}<span className="font-normal opacity-80"> {unitLabel(l)}</span>
                    </div>
                  )}
                  {l.description && (
                    <p className="mt-2 hidden max-w-xl text-sm opacity-90 md:line-clamp-2">{l.description}</p>
                  )}
                  <span className="mt-3 inline-block rounded-full bg-background px-5 py-2 text-xs font-semibold text-foreground shadow-lg transition-transform group-hover:scale-105 md:text-sm">
                    View listing
                  </span>
                </div>
              </button>
            </VideoPlayer>
          </section>
        )
      })}
    </div>
  )
}
