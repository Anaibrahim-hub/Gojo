import type { Metadata } from 'next'
import { Suspense } from 'react'
import FavoritesView from '@/app/components/FavoritesView'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: { canonical: '/favorites' },
}

export default function FavoritesPage() {
  return (
    <div className="size-full flex flex-col" style={{ height: '100vh' }}>
      <Suspense>
        <FavoritesView />
      </Suspense>
    </div>
  )
}
