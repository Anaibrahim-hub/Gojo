import type { Metadata } from 'next'
import HomeClient from './components/HomeClient'

export const metadata: Metadata = {
  title: 'Yevilla — Find Homes for Sale & Rent in Ethiopia',
  description: "Ethiopia's real estate marketplace. Browse homes for sale and rent in Addis Ababa and across Ethiopia. Connect with agents, list your property, and find your next home.",
  alternates: { canonical: 'https://yevilla.com/' },
}

export default function Home() {
  return <HomeClient />
}
