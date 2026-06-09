import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'
import { FavoritesProvider } from '@/lib/favorites-context'
import { ListingsProvider } from '@/lib/listings-context'
import { MobileMapProvider } from '@/lib/mobile-map-context'
import MobileBottomNav from '@/app/components/MobileBottomNav'
import '../styles/index.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
})

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
    images: [
      {
        url: '/hero-bg.jpg',
        width: 4000,
        height: 2250,
        alt: 'Yevilla — Real Estate in Ethiopia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Yevilla — Find Homes for Sale & Rent in Ethiopia',
    description: 'Browse homes for sale and rent across Ethiopia. Find apartments, houses, villas and commercial spaces on Yevilla.',
    images: ['/hero-bg.jpg'],
  },
}

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'RealEstateAgent',
  name: 'Yevilla',
  url: 'https://yevilla.com',
  logo: 'https://yevilla.com/hero-bg.jpg',
  description: 'Ethiopia\'s real estate marketplace for buying, renting, and listing properties.',
  areaServed: {
    '@type': 'Country',
    name: 'Ethiopia',
  },
}

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Yevilla',
  url: 'https://yevilla.com',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://yevilla.com/listings?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://gojo-upload.ana-ibrahim433.workers.dev" />
        <link rel="dns-prefetch" href="https://gojo-upload.ana-ibrahim433.workers.dev" />
        <link rel="dns-prefetch" href="https://api.mapbox.com" />
        <link rel="dns-prefetch" href="https://events.mapbox.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body style={{ height: '100%', margin: 0 }}>
        <AuthProvider><ListingsProvider><FavoritesProvider><MobileMapProvider>
          {children}
          <MobileBottomNav />
        </MobileMapProvider></FavoritesProvider></ListingsProvider></AuthProvider>
      </body>
    </html>
  )
}
