import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'
import { FavoritesProvider } from '@/lib/favorites-context'
import { ListingsProvider } from '@/lib/listings-context'
import { LanguageProvider } from '@/lib/language-context'
import { ListingModalProvider } from '@/lib/listing-modal-context'
import { SignInPromptProvider } from '@/lib/sign-in-prompt-context'
import BottomNav from '@/app/components/BottomNav'
import '../styles/index.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '800', '900'],
})

export const metadata: Metadata = {
  title: 'Gojo — Find a verified home in Ethiopia',
  description: 'Gojo is Ethiopia\'s real estate marketplace. Browse homes for sale and rent in Addis Ababa and across Ethiopia. Connect with agents, list your property, and find your next home.',
  metadataBase: new URL('https://yevilla.com'),
  openGraph: {
    title: 'Gojo — Find a verified home in Ethiopia',
    description: 'Browse homes for sale and rent across Ethiopia. Find apartments, houses, villas and commercial spaces on Gojo.',
    url: 'https://yevilla.com',
    siteName: 'Gojo',
    type: 'website',
    images: [
      {
        url: '/hero-bg.jpg',
        width: 4000,
        height: 2250,
        alt: 'Gojo — Real Estate in Ethiopia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gojo — Find a verified home in Ethiopia',
    description: 'Browse homes for sale and rent across Ethiopia. Find apartments, houses, villas and commercial spaces on Gojo.',
    images: ['/hero-bg.jpg'],
  },
}

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'RealEstateAgent',
  name: 'Gojo',
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
  name: 'Gojo',
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body style={{ margin: 0 }}>
        <LanguageProvider><AuthProvider><SignInPromptProvider><ListingsProvider><FavoritesProvider><ListingModalProvider>
          {children}
          <BottomNav />
        </ListingModalProvider></FavoritesProvider></ListingsProvider></SignInPromptProvider></AuthProvider></LanguageProvider>
      </body>
    </html>
  )
}
