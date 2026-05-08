import { Suspense } from 'react'
import FavoritesView from '@/app/components/FavoritesView'

export default function FavoritesPage() {
  return (
    <div className="size-full flex flex-col" style={{ height: '100vh' }}>
      <Suspense>
        <FavoritesView />
      </Suspense>
    </div>
  )
}
