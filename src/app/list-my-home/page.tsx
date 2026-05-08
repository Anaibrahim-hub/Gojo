import { Suspense } from 'react'
import ListRentView from '@/app/components/ListRentView'

export default function ListMyHomePage() {
  return (
    <div className="size-full flex flex-col" style={{ height: '100vh' }}>
      <Suspense>
        <ListRentView />
      </Suspense>
    </div>
  )
}
