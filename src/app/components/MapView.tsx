'use client'

import { useState, useEffect, useRef } from 'react'
import Map, { Marker, Popup, NavigationControl, FullscreenControl } from 'react-map-gl/mapbox'
import type { MapRef } from 'react-map-gl/mapbox'

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
  propertyType: string
}

interface MapViewProps {
  properties: Property[]
  onPropertyClick: (property: Property) => void
  hoveredPropertyId: number | null
  onMarkerHover: (id: number | null) => void
  listingMode: 'buy' | 'rent'
  flyTo: { lng: number; lat: number; zoom: number } | null
}

const statusBorderColors: Record<Property['status'], string> = {
  active: '#6B7280',
  pending: '#EAB308',
  new: '#10B981',
}

export default function MapView({ properties, onPropertyClick, hoveredPropertyId, onMarkerHover, listingMode, flyTo }: MapViewProps) {
  const mapRef = useRef<MapRef>(null)
  const [popupProperty, setPopupProperty] = useState<Property | null>(null)
  const [satellite, setSatellite] = useState(false)

  useEffect(() => {
    if (flyTo && mapRef.current) {
      mapRef.current.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: flyTo.zoom, duration: 1500 })
    }
  }, [flyTo])

  const getDisplayPrice = (property: Property) =>
    listingMode === 'buy' ? property.price : property.rent

  const formatPrice = (price: number) => {
    if (listingMode === 'rent') return `Br ${price.toLocaleString()}`
    if (price >= 1_000_000) return `Br ${(price / 1_000_000).toFixed(1)}M`
    return `Br ${(price / 1_000).toFixed(0)}K`
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: 38.7578, latitude: 9.0320, zoom: 12 }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={satellite ? 'mapbox://styles/mapbox/satellite-streets-v12' : 'mapbox://styles/mapbox/streets-v12'}
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
    >
      <NavigationControl position="top-right" />
      <FullscreenControl position="top-right" />

      <div
        onClick={() => setSatellite((s) => !s)}
        className="absolute bottom-8 right-2.5 z-10 w-16 cursor-pointer overflow-hidden rounded-xl border-2 border-white shadow-xl transition-all hover:scale-105"
        style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
      >
        <img
          src={satellite
            ? 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/38.7578,9.0320,12,0/64x64?access_token=' + process.env.NEXT_PUBLIC_MAPBOX_TOKEN
            : 'https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/38.7578,9.0320,12,0/64x64?access_token=' + process.env.NEXT_PUBLIC_MAPBOX_TOKEN
          }
          alt={satellite ? 'Switch to map' : 'Switch to satellite'}
          className="h-16 w-16 object-cover"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-black/50 py-1 text-center text-xs font-semibold text-white">
          {satellite ? 'Map' : 'Satellite'}
        </div>
      </div>

      {properties.map((property) => {
        const isHovered = hoveredPropertyId === property.id
        const displayPrice = getDisplayPrice(property)

        return (
          <Marker
            key={property.id}
            longitude={property.lng}
            latitude={property.lat}
            anchor="bottom"
            style={{ zIndex: isHovered ? 10 : 1 }}
          >
            <div
              onClick={() => onPropertyClick(property)}
              onMouseEnter={() => {
                onMarkerHover(property.id)
                setPopupProperty(property)
              }}
              onMouseLeave={() => {
                onMarkerHover(null)
                setPopupProperty(null)
              }}
              className="cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-bold shadow-lg transition-all"
              style={{
                background: isHovered
                  ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
                  : 'white',
                color: isHovered ? 'white' : '#111827',
                border: `2px solid ${isHovered ? '#3B82F6' : statusBorderColors[property.status]}`,
                transform: isHovered ? 'scale(1.15)' : 'scale(1)',
              }}
            >
              {formatPrice(displayPrice)}
            </div>
          </Marker>
        )
      })}

      {popupProperty && (
        <Popup
          longitude={popupProperty.lng}
          latitude={popupProperty.lat}
          anchor="top"
          closeButton={false}
          closeOnClick={false}
          offset={16}
          className="mapbox-property-popup"
        >
          <div
            className="w-56 cursor-pointer overflow-hidden rounded-xl"
            onClick={() => onPropertyClick(popupProperty)}
          >
            <img
              src={popupProperty.image}
              alt={popupProperty.address}
              className="h-28 w-full object-cover"
            />
            <div className="p-2.5">
              <div className="bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-base font-bold text-transparent">
                ${getDisplayPrice(popupProperty).toLocaleString()}
                {listingMode === 'rent' ? '/mo' : ''}
              </div>
              <div className="mt-0.5 text-xs text-gray-600">
                {popupProperty.beds} bd · {popupProperty.baths} ba · {popupProperty.sqft.toLocaleString()} sqft
              </div>
              <div className="mt-0.5 truncate text-xs text-gray-500">{popupProperty.address}</div>
            </div>
          </div>
        </Popup>
      )}
    </Map>
  )
}
