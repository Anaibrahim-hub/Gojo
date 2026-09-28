export interface Agent {
  id: string
  name: string
  photo: string
  email: string
  phone: string
  office: string
  rating: number
  reviews: number
}

export const mockAgents: Agent[] = [
  {
    id: 'sarah-mitchell',
    name: 'Sarah Mitchell',
    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
    email: 'sarah.mitchell@gojoestates.com',
    phone: '+251 911 123 456',
    office: 'Gojo Estates — Bole Branch',
    rating: 4.9,
    reviews: 127,
  },
  {
    id: 'james-okafor',
    name: 'James Okafor',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    email: 'james.okafor@gojoestates.com',
    phone: '+251 911 234 567',
    office: 'Gojo Estates — CMC Branch',
    rating: 4.7,
    reviews: 89,
  },
  {
    id: 'liya-tadesse',
    name: 'Liya Tadesse',
    photo: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200',
    email: 'liya.tadesse@gojoestates.com',
    phone: '+251 911 345 678',
    office: 'Gojo Estates — Piassa Office',
    rating: 4.8,
    reviews: 104,
  },
]

export interface Property {
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
  photos?: string[]       // multiple photos from a Firestore listing
  video?: string          // optional walkthrough video URL (R2)
  lat: number | null
  lng: number | null
  type: 'sale' | 'rent' | 'both'
  propertyType?: string
  furnished?: boolean
  agentId?: string
  isAgent?: boolean
  firestoreId?: string    // original Firestore document ID
  ownerDisplayName?: string
  ownerPhotoURL?: string
  ownerEmail?: string
  subCity?: string
  woreda?: string
  kebele?: string
  landmark?: string
  availableFrom?: string | null
  description?: string
  amenities?: string[]
  createdAt?: number
  agentPhone?: string
}

// Stable numeric ID from a Firebase UID (offset avoids colliding with mock IDs 1–9)
export function uidToNumId(uid: string): number {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = (Math.imul(31, h) + uid.charCodeAt(i)) | 0
  return Math.abs(h) + 1000
}

export function apiListingToProperty(d: Record<string, unknown>): Property {
  const photos = (d.photos as { url: string }[] | undefined) ?? []
  return {
    id: uidToNumId(d.id as string),
    firestoreId: d.id as string,
    price: (d.salePrice as number) ?? 0,
    rent: (d.monthlyRent as number) ?? 0,
    address: (d.landmark as string) || (d.woreda as string) || '',
    city: (d.city as string) ?? '',
    state: '',
    zip: '',
    beds: (d.bedrooms as number) ?? 0,
    baths: (d.bathrooms as number) ?? 0,
    sqft: (d.areaSqm as number) ?? 0,
    status: (d.status as string) === 'published' ? 'active' : 'pending',
    image: photos[0]?.url ?? 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800',
    photos: photos.map(p => p.url),
    video: (d.video as { url?: string } | null | undefined)?.url || undefined,
    lat: (d.lat as number | null) ?? null,
    lng: (d.lng as number | null) ?? null,
    type: (d.listingType as 'rent' | 'sale') ?? 'rent',
    propertyType: (d.propertyType as string) ?? '',
    furnished: ((d.amenities as string[] | undefined) ?? []).includes('Furnished'),
    isAgent: (d.isAgent as boolean) ?? false,
    ownerDisplayName: (d.ownerDisplayName as string) ?? undefined,
    ownerPhotoURL: (d.ownerPhotoURL as string) ?? undefined,
    ownerEmail: (d.ownerEmail as string) ?? undefined,
    subCity: (d.subCity as string) ?? undefined,
    woreda: (d.woreda as string) ?? undefined,
    kebele: (d.kebele as string) ?? undefined,
    landmark: (d.landmark as string) ?? undefined,
    availableFrom: (d.availableFrom as string | null) ?? null,
    description: (d.description as string) ?? undefined,
    amenities: (d.amenities as string[]) ?? [],
    createdAt: (d.createdAt as number) ?? undefined,
    agentPhone: (d.agentPhone as string) ?? undefined,
  }
}

export const mockProperties: Property[] = [
  {
    id: 1,
    price: 35000000,
    rent: 120000,
    address: 'Africa Avenue, Bole',
    city: 'Addis Ababa',
    state: 'AA',
    zip: '1000',
    beds: 4,
    baths: 3,
    sqft: 3200,
    status: 'new',
    image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800',
    lat: 8.9806,
    lng: 38.8090,
    type: 'both',
    propertyType: 'House',
    furnished: true,
    agentId: 'sarah-mitchell',
  },
  {
    id: 2,
    price: 18500000,
    rent: 75000,
    address: 'Bole Medhanealem Road',
    city: 'Addis Ababa',
    state: 'AA',
    zip: '1000',
    beds: 3,
    baths: 2,
    sqft: 1800,
    status: 'active',
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800',
    lat: 8.9950,
    lng: 38.8020,
    type: 'sale',
    propertyType: 'Condo',
    furnished: false,
    agentId: 'james-okafor',
  },
  {
    id: 3,
    price: 14000000,
    rent: 55000,
    address: 'CMC Road, CMC',
    city: 'Addis Ababa',
    state: 'AA',
    zip: '1000',
    beds: 3,
    baths: 2,
    sqft: 2100,
    status: 'pending',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
    lat: 9.0330,
    lng: 38.8194,
    type: 'both',
    propertyType: 'House',
    furnished: true,
    agentId: 'sarah-mitchell',
  },
  {
    id: 4,
    price: 25000000,
    rent: 95000,
    address: 'Gerji Mebrat Haile',
    city: 'Addis Ababa',
    state: 'AA',
    zip: '1000',
    beds: 4,
    baths: 3,
    sqft: 2800,
    status: 'new',
    image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800',
    lat: 8.9990,
    lng: 38.8220,
    type: 'sale',
    propertyType: 'House',
    furnished: false,
    agentId: 'james-okafor',
  },
  {
    id: 5,
    price: 11500000,
    rent: 42000,
    address: 'Sarbet, Around Gotera',
    city: 'Addis Ababa',
    state: 'AA',
    zip: '1000',
    beds: 2,
    baths: 2,
    sqft: 1400,
    status: 'active',
    image: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800',
    lat: 9.0050,
    lng: 38.7530,
    type: 'both',
    propertyType: 'Condo',
    furnished: true,
    agentId: 'liya-tadesse',
  },
  {
    id: 6,
    price: 0,
    rent: 32000,
    address: 'Kazanchis, Near ECA',
    city: 'Addis Ababa',
    state: 'AA',
    zip: '1000',
    beds: 2,
    baths: 1,
    sqft: 1100,
    status: 'active',
    image: 'https://images.unsplash.com/photo-1599809275671-b5942cabc7a2?w=800',
    lat: 9.0180,
    lng: 38.7640,
    type: 'rent',
    propertyType: 'Condo',
    furnished: true,
    agentId: 'liya-tadesse',
  },
  {
    id: 7,
    price: 48000000,
    rent: 175000,
    address: 'Old Airport Road, Nifas Silk',
    city: 'Addis Ababa',
    state: 'AA',
    zip: '1000',
    beds: 5,
    baths: 4,
    sqft: 4200,
    status: 'new',
    image: 'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800',
    lat: 8.9930,
    lng: 38.7930,
    type: 'sale',
    propertyType: 'House',
    furnished: false,
    agentId: 'sarah-mitchell',
  },
  {
    id: 8,
    price: 0,
    rent: 22000,
    address: 'Summit Abo, Yeka',
    city: 'Addis Ababa',
    state: 'AA',
    zip: '1000',
    beds: 2,
    baths: 1,
    sqft: 1000,
    status: 'pending',
    image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800',
    lat: 8.9860,
    lng: 38.8220,
    type: 'rent',
    propertyType: 'Townhouse',
    furnished: false,
    agentId: 'james-okafor',
  },
  {
    id: 9,
    price: 65000000,
    rent: 280000,
    address: 'Adama–Addis Ababa Expressway',
    city: 'Adama',
    state: 'OR',
    zip: '2000',
    beds: 0,
    baths: 4,
    sqft: 6500,
    status: 'active',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800',
    lat: 8.5400,
    lng: 39.2700,
    type: 'both',
    propertyType: 'Commercial',
    furnished: true,
    agentId: 'liya-tadesse',
  },
]
