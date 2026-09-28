import type { Metadata } from 'next'
import { Suspense } from 'react'
import ListingsGrid from '../components/ListingsGrid'

export const metadata: Metadata = {
  title: 'Homes for rent and sale in Ethiopia | Gojo',
  description: 'Browse apartments, villas, houses and commercial spaces for rent and sale across Ethiopia. Filter by city, price, bedrooms and type on Gojo.',
  alternates: { canonical: 'https://yevilla.com/listings' },
}

export default function ListingsPage() {
  return (
    <Suspense>
      <ListingsGrid />
    </Suspense>
  )
}
