import type { Metadata } from 'next'
import AboutView from '@/app/components/AboutView'

export const metadata: Metadata = {
  title: 'About | Gojo',
  description: 'Gojo is on a mission to bring trust and transparency to Ethiopian real estate.',
  alternates: { canonical: 'https://yevilla.com/about' },
}

export default function About() {
  return <AboutView />
}
