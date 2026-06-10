import type { Metadata } from 'next'
import { Suspense } from 'react'
import ContactView from '@/app/components/ContactView'

export const metadata: Metadata = {
  title: 'Contact Us | Yevilla',
  description: 'Get in touch with the Yevilla team. Reach out with questions about listings, your account, or how to list your property in Ethiopia.',
  alternates: { canonical: 'https://yevilla.com/contact' },
}

export default function ContactPage() {
  return (
    <div className="size-full flex flex-col" style={{ height: '100vh' }}>
      <Suspense>
        <ContactView />
      </Suspense>
    </div>
  )
}
