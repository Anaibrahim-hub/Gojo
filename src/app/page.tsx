'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import HomePage from './components/HomePage'
import PropertyModal from './components/PropertyModal'

interface Property {
  id: number
  price: number
  rent: number
  address: string
  city: string
  state: string
  zip: string
  beds: number
  baths: number
  sqft: number
  status: 'active' | 'pending' | 'new'
  image: string
  lat: number
  lng: number
  type: 'sale' | 'rent' | 'both'
  propertyType?: string
}

export default function Home() {
  const router = useRouter()
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [listingMode, setListingMode] = useState<'buy' | 'rent'>('buy')

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
