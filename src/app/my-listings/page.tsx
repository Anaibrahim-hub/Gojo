import type { Metadata } from 'next'
import MyListingsPage from '@/app/components/MyListingsPage'

export const metadata: Metadata = {
  title: 'My listings | Gojo',
  robots: { index: false, follow: false },
}

export default function MyListings() {
  return <MyListingsPage />
}
