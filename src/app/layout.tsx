import type { Metadata } from 'next'
import '../styles/index.css'
import { AuthProvider } from '@/lib/auth-context'
import { FavoritesProvider } from '@/lib/favorites-context'

export const metadata: Metadata = {
  title: 'Yevilla — Find Homes for Sale & Rent in Ethiopia',
  description: 'Yevilla is Ethiopia\'s real estate marketplace. Browse homes for sale and rent in Addis Ababa and across Ethiopia. Connect with agents, list your property, and find your next home.',
  metadataBase: new URL('https://yevilla.com'),
  openGraph: {
    title: 'Yevilla — Find Homes for Sale & Rent in Ethiopia',
    description: 'Browse homes for sale and rent across Ethiopia. Find apartments, houses, villas and commercial spaces on Yevilla.',
    url: 'https://yevilla.com',
    siteName: 'Yevilla',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ height: '100%', margin: 0 }}>
        <AuthProvider><FavoritesProvider>{children}</FavoritesProvider></AuthProvider>
      </body>
    </html>
  )
}
