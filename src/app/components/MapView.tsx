'use client'

import 'mapbox-gl/dist/mapbox-gl.css'
import { useState, useEffect, useRef } from 'react'
import Map, { Marker, Popup, NavigationControl, FullscreenControl } from 'react-map-gl/mapbox'
import type { MapRef } from 'react-map-gl/mapbox'
import type { Property } from '@/app/data/properties'
import { formatETB, formatETBCompact } from '@/app/components/ui/utils'
import { img as cdnImg } from '@/lib/image'

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
  const isTouchRef = useRef(false)

  useEffect(() => {
    if (flyTo && mapRef.current) {
      mapRef.current.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: flyTo.zoom, duration: 1500 })
    }
  }, [flyTo])

  const getDisplayPrice = (property: Property) =>
    listingMode === 'buy' ? property.price : property.rent

  const formatPrice = (price: number) =>
    listingMode === 'rent' ? formatETB(price) : formatETBCompact(price)

  return (
    <Map
      ref={mapRef}
      initialViewState={flyTo
        ? { longitude: flyTo.lng, latitude: flyTo.lat, zoom: flyTo.zoom }
        : { longitude: 38.7578, latitude: 9.0320, zoom: 12 }}
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

      {properties.filter(p => p.lat !== null && p.lng !== null).map((property) => {
        const isHovered = hoveredPropertyId === property.id
        const displayPrice = getDisplayPrice(property)

        return (
          <Marker
            key={property.id}
            longitude={property.lng!}
            latitude={property.lat!}
            anchor="bottom"
            style={{ zIndex: isHovered ? 10 : 1 }}
          >
            <div
              onTouchStart={() => { isTouchRef.current = true }}
              onClick={() => onPropertyClick(property)}
              onMouseEnter={() => {
                if (isTouchRef.current) { isTouchRef.current = false; return }
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

      {popupProperty && popupProperty.lat !== null && popupProperty.lng !== null && (
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
              src={cdnImg(popupProperty.image, { width: 480 })}
              alt={popupProperty.address}
              loading="lazy"
              decoding="async"
              className="h-28 w-full object-cover"
            />
            <div className="p-2.5">
              <div className="bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-base font-bold text-transparent">
                {formatPrice(getDisplayPrice(popupProperty))}
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
