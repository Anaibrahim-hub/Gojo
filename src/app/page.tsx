import type { Metadata } from 'next'
import HomeView from './components/HomeView'

export const metadata: Metadata = {
  title: 'Gojo — Find a verified home in Ethiopia',
  description: 'Browse apartments, villas, houses and commercial spaces for rent and sale across Addis Ababa, Bahir Dar, Hawassa and beyond.',
  alternates: { canonical: 'https://yevilla.com/' },
}

export default function Home() {
  return <HomeView />
}
