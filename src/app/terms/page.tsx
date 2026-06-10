import type { Metadata } from 'next'
import TermsContent from './TermsContent'

export const metadata: Metadata = {
  title: 'Terms of Service | Yevilla',
  description: 'Read the Yevilla terms of service to understand the rules and conditions for using our real estate platform.',
  alternates: { canonical: 'https://yevilla.com/terms' },
}

export default function TermsPage() {
  return <TermsContent />
}
