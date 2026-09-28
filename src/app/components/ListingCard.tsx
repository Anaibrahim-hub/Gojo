'use client'

import Link from 'next/link'
import { Heart } from 'lucide-react'
import type { Property } from '@/app/data/properties'
import { useFavorites } from '@/lib/favorites-context'
import { useCurrency } from '@/lib/currency'
import { useListingModal } from '@/lib/listing-modal-context'
import { img } from '@/lib/image'
import { isForSale, listingHref, listingPrice, listingTitle, placeLabel, unitLabel, type Mode } from '@/lib/listing-utils'

export default function ListingCard({
  listing, mode, badge, href,
}: {
  listing: Property
  mode?: Mode | null
  badge?: React.ReactNode
  href?: string
}) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const { format } = useCurrency()
  const { openListing } = useListingModal()
  const saved = isFavorite(listing.id)
  const price = listingPrice(listing, mode)

  return (
    <Link
      href={href ?? listingHref(listing)}
      onClick={e => {
        if (href || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        openListing(listing, { mode })
      }}
      className="group block"
    >
      <div className="relative overflow-hidden rounded-2xl bg-muted">
        <img
          src={img(listing.image, { width: 640 })}
          alt={listingTitle(listing)}
          width={1024}
          height={768}
          loading="lazy"
          className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {badge ?? (listing.isAgent ? (
          <span className="absolute left-3 top-3 rounded-full bg-background/95 px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
            Verified agent
          </span>
        ) : isForSale(listing, mode) ? (
          <span className="absolute left-3 top-3 rounded-full bg-background/95 px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
            For sale
          </span>
        ) : null)}
        <button
          type="button"
          onClick={e => { e.preventDefault(); e.stopPropagation(); toggleFavorite(listing.id) }}
          className="absolute right-3 top-3 rounded-full p-2 transition-transform hover:scale-110"
          aria-label={saved ? 'Remove from favorites' : 'Save listing'}
          aria-pressed={saved}
        >
          <Heart
            className={`h-6 w-6 drop-shadow ${saved ? 'fill-primary text-primary' : 'fill-foreground/40 text-background'}`}
            strokeWidth={2}
          />
        </button>
      </div>
      <div className="mt-3 space-y-0.5">
        <h3 className="truncate text-[15px] font-semibold text-foreground">{placeLabel(listing)}</h3>
        <div className="truncate text-sm text-muted-foreground first-letter:uppercase">{listingTitle(listing)}</div>
        <div className="text-sm text-muted-foreground">
          {[
            listing.beds > 0 && `${listing.beds} beds`,
            listing.baths > 0 && `${listing.baths} baths`,
            listing.sqft > 0 && `${listing.sqft} m²`,
          ].filter(Boolean).join(' · ') || ' '}
        </div>
        <div className="pt-1 text-[15px] text-foreground">
          {price > 0 ? (
            <>
              <span className="font-semibold">{format(price)}</span>
              <span className="text-muted-foreground"> {unitLabel(listing, mode)}</span>
            </>
          ) : (
            <span className="font-semibold">Price on request</span>
          )}
        </div>
      </div>
    </Link>
  )
}

export function ListingCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[4/3] w-full rounded-2xl bg-muted" />
      <div className="mt-3 h-4 w-2/3 rounded bg-muted" />
      <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
      <div className="mt-2 h-3 w-1/3 rounded bg-muted" />
    </div>
  )
}
