'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import HomePage from './HomePage'
import PropertyModal from './PropertyModal'
import type { Property } from '@/app/data/properties'

export default function HomeClient() {
  const router = useRouter()
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [listingMode, setListingMode] = useState<'buy' | 'rent'>('buy')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (window.innerWidth < 1024) {
      router.replace('/listings')
      return
    }
    setReady(true)
    function onResize() {
      if (window.innerWidth < 1024) router.replace('/listings')
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [router])

  if (!ready) return <div style={{ height: '100dvh', background: '#fff' }} />

  return (
    <>
      <HomePage
        onNavigateToMap={(mode, location) => {
          const params = new URLSearchParams()
          if (mode) params.set('mode', mode)
          if (location) {
            params.set('q', location.q)
            params.set('lat', String(location.lat))
            params.set('lng', String(location.lng))
            params.set('zoom', String(location.zoom))
          }
          router.push(`/listings?${params.toString()}`)
        }}
        onPropertyClick={(property: Property) => {
          setSelectedProperty(property)
          setListingMode(property.type === 'rent' ? 'rent' : 'buy')
        }}
      />
      <PropertyModal
        property={selectedProperty}
        onClose={() => setSelectedProperty(null)}
        listingMode={listingMode}
      />
    </>
  )
}
