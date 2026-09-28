import type { Metadata } from 'next'
import FavoritesPage from '@/app/components/FavoritesPage'

export const metadata: Metadata = {
  title: 'Favorites | Gojo',
  robots: { index: false, follow: false },
  alternates: { canonical: 'https://yevilla.com/favorites' },
}

export default function Favorites() {
  return <FavoritesPage />
}
