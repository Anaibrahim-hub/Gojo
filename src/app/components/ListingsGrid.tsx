'use client'

import { useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'
import CategoryStrip from './CategoryStrip'
import ListingCard, { ListingCardSkeleton } from './ListingCard'
import { useListings } from '@/lib/listings-context'
import { useListingModal } from '@/lib/listing-modal-context'
import { useListing } from '@/lib/use-listing'
import { CATEGORIES, listingKey, listingPrice, matchesCategory, matchesMode, searchText, type Mode } from '@/lib/listing-utils'

const num = (v: string | null) => {
  const n = Number(v)
  return v && Number.isFinite(n) && n > 0 ? n : undefined
}

export default function ListingsGrid() {
  const params = useSearchParams()
  const router = useRouter()
  const { listings, loading, loadingMore, hasMore, loadMore } = useListings()
  const { openListing } = useListingModal()

  const place = params.get('place') ?? params.get('q') ?? ''
  const type = params.get('type')
  const modeParam = params.get('mode')
  const mode: Mode | null = modeParam === 'buy' || modeParam === 'rent' ? modeParam : null
  const beds = num(params.get('beds'))
  const baths = num(params.get('baths'))
  const minPrice = num(params.get('minPrice'))
  const maxPrice = num(params.get('maxPrice'))

  // Shared links (?open=<id>) open that listing's modal; closing it drops the param.
  const openId = params.get('open')
  const { listing: linked } = useListing(openId)
  useEffect(() => {
    if (!linked) return
    openListing(linked, {
      mode,
      onClose: () => {
        const next = new URLSearchParams(window.location.search)
        next.delete('open')
        const qs = next.toString()
        router.replace(`/listings${qs ? `?${qs}` : ''}`, { scroll: false })
      },
    })
    // Open once per linked listing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked?.id])

  const filtered = useMemo(() => {
    const q = place.trim().toLowerCase()
    return listings.filter(l => {
      if (q && !searchText(l).includes(q)) return false
      if (!matchesCategory(l, type)) return false
      if (!matchesMode(l, mode)) return false
      if (beds && l.beds < beds) return false
      if (baths && l.baths < baths) return false
      const price = listingPrice(l, mode)
      if (minPrice && price < minPrice) return false
      if (maxPrice && price > maxPrice) return false
      return true
    })
  }, [listings, place, type, mode, beds, baths, minPrice, maxPrice])

  const category = CATEGORIES.find(c => c.id === type) ?? CATEGORIES[0]
  const noun = filtered.length === 1 ? category.singular : category.plural
  const verb = mode === 'buy' ? 'for sale' : mode === 'rent' ? 'for rent' : ''
  const heading = [String(filtered.length), noun, verb, place && `in ${place}`].filter(Boolean).join(' ')

  return (
    <div className="min-h-screen bg-background pb-20 font-sans text-foreground md:pb-0">
      <SiteHeader showSearch />
      <CategoryStrip />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">{loading ? 'Loading homes…' : heading}</h1>
          <p className="text-sm text-muted-foreground">
            {place ? 'Matching your search' : 'Across Ethiopia'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loading
            ? Array.from({ length: 8 }, (_, i) => <ListingCardSkeleton key={i} />)
            : filtered.map(l => <ListingCard key={listingKey(l)} listing={l} mode={mode} />)}
        </div>

        {!loading && filtered.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No {category.plural} match your search yet. Try another city or fewer filters.
          </p>
        )}

        {!loading && hasMore && (
          <div className="mt-12 flex justify-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="rounded-full border border-foreground px-6 py-3 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Show more homes'}
            </button>
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  )
}
