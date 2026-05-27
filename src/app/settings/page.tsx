import type { Metadata } from 'next'
import { Suspense } from 'react'
import SettingsView from '@/app/components/SettingsView'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function SettingsPage() {
  return (
    <div className="size-full flex flex-col" style={{ height: '100vh' }}>
      <Suspense>
        <SettingsView />
      </Suspense>
    </div>
  )
}
