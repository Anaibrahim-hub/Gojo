import type { Metadata } from 'next'
import { Suspense } from 'react'
import ListRentView from '@/app/components/ListRentView'

export const metadata: Metadata = {
  title: 'List Your Home | Yevilla',
  description: 'Submit your property for rent or sale on Yevilla. Reach thousands of buyers and renters looking for homes across Ethiopia.',
  alternates: { canonical: '/list-my-home' },
}

export default function ListMyHomePage() {
  return (
    <div className="size-full flex flex-col" style={{ height: '100vh' }}>
      <Suspense>
        <ListRentView />
      </Suspense>
    </div>
  )
}
