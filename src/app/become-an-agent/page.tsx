import { Suspense } from 'react'
import AgentApplicationView from '@/app/components/AgentApplicationView'

export default function BecomeAnAgentPage() {
  return (
    <div className="size-full flex flex-col" style={{ height: '100vh' }}>
      <Suspense>
        <AgentApplicationView />
      </Suspense>
    </div>
  )
}
