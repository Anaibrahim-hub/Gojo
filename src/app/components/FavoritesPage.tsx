'use client'

import Link from 'next/link'
import { Heart, LogIn } from 'lucide-react'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'
import ListingCard, { ListingCardSkeleton } from './ListingCard'
import { useFavorites } from '@/lib/favorites-context'
import { useAuth } from '@/lib/auth-context'
import { useSignInPrompt } from '@/lib/sign-in-prompt-context'
import { useListings } from '@/lib/listings-context'
import { listingKey } from '@/lib/listing-utils'

export default function FavoritesPage() {
  const { user, loading: authLoading } = useAuth()
  const { promptSignIn } = useSignInPrompt()
  const { favorites } = useFavorites()
  const { listings, loading } = useListings()
  const saved = listings.filter(l => favorites.has(l.id))

  return (
    <div className="min-h-screen bg-background pb-20 font-sans text-foreground md:pb-0">
      <SiteHeader />
      {authLoading ? (
        <section className="mx-auto max-w-2xl px-6 py-20">
          <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-muted" />
        </section>
      ) : !user ? (
        <section className="mx-auto max-w-2xl px-6 py-20 text-center">
          <Heart className="mx-auto h-10 w-10 text-primary" strokeWidth={1.5} />
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Sign in to see your favorites</h1>
          <p className="mt-2 text-muted-foreground">Save homes you love and find them here on any device.</p>
          <button
            type="button"
            onClick={() => promptSignIn()}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-95"
          >
            <LogIn className="h-4 w-4" /> Sign in
          </button>
        </section>
      ) : loading && favorites.size > 0 ? (
        <section className="mx-auto max-w-7xl px-6 py-10">
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <ListingCardSkeleton key={i} />)}
          </div>
        </section>
      ) : saved.length > 0 ? (
        <section className="mx-auto max-w-7xl px-6 py-10">
          <h1 className="mb-6 text-2xl font-bold tracking-tight">Favorites</h1>
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {saved.map(l => <ListingCard key={listingKey(l)} listing={l} />)}
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-2xl px-6 py-20 text-center">
          <Heart className="mx-auto h-10 w-10 text-primary" strokeWidth={1.5} />
          <h1 className="mt-4 text-3xl font-bold tracking-tight">No favorites yet</h1>
          <p className="mt-2 text-muted-foreground">Tap the heart on any home to save it here for later.</p>
          <Link href="/listings" className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-95">
            Browse homes
          </Link>
        </section>
      )}
      <SiteFooter />
    </div>
  )
}
