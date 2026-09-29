'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Play } from 'lucide-react'
import { useListings } from '@/lib/listings-context'
import { img } from '@/lib/image'
import { primeSharedVideo } from '@/lib/shared-video'
import { listingKey, listingTitle, placeLabel, tourListings } from '@/lib/listing-utils'

export default function VideoReels() {
  const router = useRouter()
  const { listings, loading } = useListings()
  const tours = useMemo(() => tourListings(listings), [listings])

  if (!loading && tours.length === 0) return null

  const open = (i: number) => {
    // Unlock sound during the tap so the tour starts playing with audio.
    primeSharedVideo(tours[i].video!)
    router.push(`/reels?start=${encodeURIComponent(listingKey(tours[i]))}`)
  }

  return (
    <section className="mx-auto max-w-7xl px-6 pt-6">
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Video tours</h2>
        <span className="text-sm text-muted-foreground">Tap to watch</span>
      </div>
      <div className="-mx-6 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex gap-4">
          {loading && tours.length === 0
            ? Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="shrink-0">
                  <div className="aspect-[9/14] w-[160px] animate-pulse rounded-2xl bg-muted sm:w-[180px]" />
                </li>
              ))
            : tours.map((l, i) => (
                <li key={listingKey(l)} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => open(i)}
                    className="group relative block w-[160px] overflow-hidden rounded-2xl bg-muted text-left sm:w-[180px]"
                    aria-label={`Play video tour: ${listingTitle(l)}`}
                  >
                    <img
                      src={img(l.image, { width: 400 })}
                      alt=""
                      loading="lazy"
                      className="aspect-[9/14] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/10 to-transparent" />
                    <div className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-background/95 shadow-lg transition-transform group-hover:scale-110">
                      <Play className="h-5 w-5 fill-foreground text-foreground" />
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 text-background">
                      <div className="line-clamp-2 text-sm font-semibold first-letter:uppercase leading-snug">{listingTitle(l)}</div>
                      <div className="mt-0.5 truncate text-xs opacity-90">{placeLabel(l)}</div>
                    </div>
                  </button>
                </li>
              ))}
        </ul>
      </div>
    </section>
  )
}
