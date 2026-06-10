import type { Metadata } from 'next'
import { Suspense } from 'react'
import ListingsView from '../components/ListingsView'

export const metadata: Metadata = {
  title: 'Property Listings in Ethiopia | Yevilla',
  description: 'Browse homes, apartments, and commercial properties for sale and rent across Ethiopia. Filter by location, price, and type on Yevilla.',
  alternates: { canonical: 'https://yevilla.com/listings' },
}

export default function ListingsPage() {
  return (
    <div className="size-full flex flex-col" style={{ height: '100vh' }}>
      <Suspense>
        <ListingsView />
      </Suspense>
    </div>
  )
}
