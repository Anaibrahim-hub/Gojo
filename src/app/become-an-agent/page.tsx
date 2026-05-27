import type { Metadata } from 'next'
import { Suspense } from 'react'
import AgentApplicationView from '@/app/components/AgentApplicationView'

export const metadata: Metadata = {
  title: 'Become a Real Estate Agent | Yevilla',
  description: 'Apply to become a verified Yevilla agent. List multiple properties, reach buyers and renters across Ethiopia, and grow your real estate business.',
  alternates: { canonical: '/become-an-agent' },
}

export default function BecomeAnAgentPage() {
  return (
    <div className="size-full flex flex-col" style={{ height: '100vh' }}>
      <Suspense>
        <AgentApplicationView />
      </Suspense>
    </div>
  )
}
