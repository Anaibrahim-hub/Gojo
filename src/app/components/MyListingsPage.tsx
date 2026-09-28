'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2 } from 'lucide-react'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'
import SignInModal from './SignInModal'
import ListingCard, { ListingCardSkeleton } from './ListingCard'
import { useAuth } from '@/lib/auth-context'
import { apiListingToProperty, type Property } from '@/app/data/properties'
import { listingKey } from '@/lib/listing-utils'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''

const STATUS: Record<string, { label: string; className: string }> = {
  published: { label: 'Published', className: 'bg-background/95 text-foreground' },
  pending: { label: 'Pending review', className: 'bg-amber-100 text-amber-900' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800' },
}

export default function MyListingsPage() {
  const { user, loading: authLoading } = useAuth()
  const [listings, setListings] = useState<{ property: Property; status: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [signInOpen, setSignInOpen] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user || !WORKER_URL) { setListings([]); setLoading(false); return }
    setLoading(true)
    setError(false)
    user.getIdToken()
      .then(token => fetch(`${WORKER_URL}/listing`, { headers: { Authorization: `Bearer ${token}` } }))
      .then(async res => {
        if (!res.ok) throw new Error('Failed to load listings')
        const data = await res.json() as { listings: Record<string, unknown>[] }
        setListings((data.listings ?? []).map(d => ({ property: apiListingToProperty(d), status: String(d.status ?? 'pending') })))
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [user, authLoading])

  return (
    <div className="min-h-screen bg-background pb-20 font-sans text-foreground md:pb-0">
      <SiteHeader />
      {!authLoading && !user ? (
        <EmptyState
          title="Sign in to manage your listings"
          body="List your property with Gojo and reach renters and buyers across Ethiopia."
          action={<button type="button" onClick={() => setSignInOpen(true)} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-95">Sign in</button>}
        />
      ) : loading || authLoading ? (
        <section className="mx-auto max-w-7xl px-6 py-10">
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => <ListingCardSkeleton key={i} />)}
          </div>
        </section>
      ) : listings.length === 0 ? (
        <EmptyState
          title={error ? "Couldn't load your listings" : 'You have no listings'}
          body={error ? 'Check your connection and try again.' : 'List your property with Gojo and reach renters and buyers across Ethiopia.'}
          action={<Link href="/list-my-home" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-95">List a property</Link>}
        />
      ) : (
        <section className="mx-auto max-w-7xl px-6 py-10">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h1 className="text-2xl font-bold tracking-tight">My listings</h1>
            <Link href="/list-my-home" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-95">
              Manage listings
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map(({ property, status }) => {
              const s = STATUS[status] ?? STATUS.pending
              return (
                <ListingCard
                  key={listingKey(property)}
                  listing={property}
                  href={status === 'published' ? undefined : '/list-my-home'}
                  badge={<span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${s.className}`}>{s.label}</span>}
                />
              )
            })}
          </div>
        </section>
      )}
      <SiteFooter />
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </div>
  )
}

function EmptyState({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-2xl px-6 py-20 text-center">
      <Building2 className="mx-auto h-10 w-10 text-primary" strokeWidth={1.5} />
      <h1 className="mt-4 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted-foreground">{body}</p>
      <div className="mt-6 flex justify-center">{action}</div>
    </section>
  )
}
