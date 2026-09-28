import type { Metadata } from 'next'
import ProfilePage from '@/app/components/ProfilePage'

export const metadata: Metadata = {
  title: 'Profile | Gojo',
  robots: { index: false, follow: false },
}

export default function Profile() {
  return <ProfilePage />
}
