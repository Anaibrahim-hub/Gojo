import type { Metadata } from 'next'
import { Suspense } from 'react'
import EditProfileView from '@/app/components/EditProfileView'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function EditProfilePage() {
  return (
    <div className="size-full flex flex-col" style={{ height: '100vh' }}>
      <Suspense>
        <EditProfileView />
      </Suspense>
    </div>
  )
}
