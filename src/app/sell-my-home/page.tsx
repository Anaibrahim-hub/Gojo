import { Suspense } from 'react'
import SellHomeView from '@/app/components/SellHomeView'

export default function SellMyHomePage() {
  return (
    <div className="size-full flex flex-col" style={{ height: '100vh' }}>
      <Suspense>
        <SellHomeView />
      </Suspense>
    </div>
  )
}
