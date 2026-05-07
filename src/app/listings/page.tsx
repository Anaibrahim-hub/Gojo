import { Suspense } from 'react'
import ListingsView from '../components/ListingsView'

export default function ListingsPage() {
  return (
    <div className="size-full flex flex-col" style={{ height: '100vh' }}>
      <Suspense>
        <ListingsView />
      </Suspense>
    </div>
  )
}
