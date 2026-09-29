import type { Property } from '@/app/data/properties'

export type Mode = 'rent' | 'buy'

// Category strip entries. `match` is tested against the listing's propertyType
// (values come from the list-my-home form, e.g. "Apartment / Condominium").
export const CATEGORIES = [
  { id: 'all', label: 'All', icon: 'LayoutGrid', match: undefined, singular: 'home', plural: 'homes' },
  { id: 'hotel', label: 'Hotels', icon: 'Hotel', match: 'hotel', singular: 'hotel', plural: 'hotels' },
  { id: 'venue', label: 'Event venues', icon: 'PartyPopper', match: 'event venue', singular: 'event venue', plural: 'event venues' },
  { id: 'house', label: 'Houses', icon: 'Home', match: 'house', singular: 'house', plural: 'houses' },
  { id: 'apartment', label: 'Apartments', icon: 'Building2', match: 'apartment', singular: 'apartment', plural: 'apartments' },
  { id: 'studio', label: 'Studios', icon: 'BedSingle', match: 'studio', singular: 'studio', plural: 'studios' },
  { id: 'villa', label: 'Villas', icon: 'Crown', match: 'villa', singular: 'villa', plural: 'villas' },
  { id: 'townhouse', label: 'Townhouses', icon: 'Building', match: 'townhouse', singular: 'townhouse', plural: 'townhouses' },
  { id: 'commercial', label: 'Commercial', icon: 'Briefcase', match: 'commercial', singular: 'commercial space', plural: 'commercial spaces' },
] as const

export type CategoryId = (typeof CATEGORIES)[number]['id']

export function matchesCategory(p: Property, category: string | null | undefined): boolean {
  const cat = CATEGORIES.find(c => c.id === category)
  if (!cat?.match) return true
  return (p.propertyType ?? '').toLowerCase().includes(cat.match)
}

export function isForSale(p: Property, mode?: Mode | null): boolean {
  if (p.type === 'sale') return true
  if (p.type === 'both') return mode === 'buy' ? p.price > 0 : !(p.rent > 0)
  return false
}

export function matchesMode(p: Property, mode: Mode | null | undefined): boolean {
  if (!mode) return true
  if (mode === 'buy') return p.type === 'sale' || (p.type === 'both' && p.price > 0)
  return p.type === 'rent' || (p.type === 'both' && p.rent > 0)
}

export type RentUnit = 'month' | 'night' | 'day'

/**
 * What a listing's rent is charged per. Hotels are nightly and event venues are
 * daily; the amount is stored in the same monthlyRent field as regular rentals.
 */
export function rentUnit(propertyType: string | undefined | null): RentUnit {
  const t = (propertyType ?? '').toLowerCase()
  if (t.includes('hotel')) return 'night'
  if (t.includes('event venue')) return 'day'
  return 'month'
}

/** How a listing is taken: "Nightly stay", "Daily booking", "Long-term lease", or "For sale". */
export function termLabel(p: Property, mode?: Mode | null): string {
  if (isForSale(p, mode)) return 'For sale'
  const unit = rentUnit(p.propertyType)
  if (unit === 'night') return 'Nightly stay'
  if (unit === 'day') return 'Daily booking'
  return 'Long-term lease'
}

/** Hotels and event venues are booked, not leased — titles drop "for rent". */
function isStay(p: Property): boolean {
  return rentUnit(p.propertyType) !== 'month'
}

/** Price in ETB to show for a listing: rent (per month/night/day), or sale price. */
export function listingPrice(p: Property, mode?: Mode | null): number {
  return isForSale(p, mode) ? p.price : p.rent
}

export function unitLabel(p: Property, mode?: Mode | null): string {
  return isForSale(p, mode) ? '' : `/ ${rentUnit(p.propertyType)}`
}

/** "Apartment / Condominium" → "Apartment", "House (ቤት)" → "House". */
export function shortType(p: Property): string {
  const raw = (p.propertyType ?? '').replace(/\(.*?\)/g, '').split('/')[0].trim()
  return raw || 'Home'
}

export function listingTitle(p: Property): string {
  if (isStay(p)) {
    // Hotels and event venues list under the business's own account, so its name is the title.
    const name = p.ownerDisplayName?.trim()
    if (name) return name
    const type = shortType(p).toLowerCase()
    return type.charAt(0).toUpperCase() + type.slice(1)
  }
  const beds = p.beds > 0 ? `${p.beds}-bedroom ` : ''
  const type = shortType(p)
  return `${beds}${beds ? type.toLowerCase() : type} ${isForSale(p) ? 'for sale' : 'for rent'}`
}

export function placeLabel(p: Property): string {
  return [p.subCity, p.city].filter(Boolean).join(', ') || p.address || 'Ethiopia'
}

export function photosOf(p: Property): string[] {
  return p.photos && p.photos.length > 0 ? p.photos : [p.image]
}

export function listingKey(p: Property): string {
  return p.firestoreId ?? String(p.id)
}

/** Shareable link: the listings page opens this listing's modal on load. */
export function listingHref(p: Property): string {
  return `/listings?open=${encodeURIComponent(listingKey(p))}`
}

export function searchText(p: Property): string {
  return [p.city, p.subCity, p.woreda, p.kebele, p.landmark, p.address, p.propertyType]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/** Listings with an uploaded video, newest first, for the video tours row and feed. */
export function tourListings(listings: Property[], limit = 20): Property[] {
  return listings.filter(l => !!l.video).slice(0, limit)
}
