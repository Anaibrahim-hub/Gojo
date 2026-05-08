import { Suspense } from 'react'
import ContactView from '@/app/components/ContactView'

export default function ContactPage() {
  return (
    <div className="size-full flex flex-col" style={{ height: '100vh' }}>
      <Suspense>
        <ContactView />
      </Suspense>
    </div>
  )
}
