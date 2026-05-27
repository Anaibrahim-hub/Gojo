import type { Metadata } from 'next'
import PrivacyContent from './PrivacyContent'

export const metadata: Metadata = {
  title: 'Privacy Policy | Yevilla',
  description: 'Read the Yevilla privacy policy to understand how we collect, use, and protect your personal information.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return <PrivacyContent />
}
