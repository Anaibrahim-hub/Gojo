import type { Metadata } from 'next'
import { Suspense } from 'react'
import ReelsView from '../components/ReelsView'

export const metadata: Metadata = {
  title: 'Video tours of Ethiopian homes | Gojo',
  description: 'Swipe through home tours across Ethiopia, then jump straight to the listing.',
  alternates: { canonical: 'https://yevilla.com/reels' },
}

export default function ReelsPage() {
  return (
    <Suspense>
      <ReelsView />
    </Suspense>
  )
}
