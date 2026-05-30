import type { R2Bucket, ExecutionContext, D1Database, KVNamespace } from '@cloudflare/workers-types'

export interface Env {
  GOJO_LISTINGS: R2Bucket
  DB: D1Database
  RATE_LIMITER: KVNamespace
  FIREBASE_PROJECT_ID: string
  R2_PUBLIC_URL: string      // e.g. https://pub-xxx.r2.dev  (no trailing slash)
  ALLOWED_ORIGIN: string     // e.g. https://yevilla.com
  ADMIN_SECRET: string       // set via: wrangler secret put ADMIN_SECRET
  FIREBASE_SERVICE_ACCOUNT_JSON: string  // set via: wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON
  BREVO_API_KEY: string      // set via: wrangler secret put BREVO_API_KEY
  STAFF_EMAIL: string        // set via: wrangler secret put STAFF_EMAIL (default: anaibrahim628@gmail.com)
}

// ── Allowlists ────────────────────────────────────────────────────────────────

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const ALLOWED_CITIES = new Set([
  'Addis Ababa', 'Dire Dawa', 'Hawassa', 'Mekelle', 'Gondar',
  'Bahir Dar', 'Adama', 'Jimma', 'Dessie', 'Jijiga', 'Other',
])

const ALLOWED_PROPERTY_TYPES = new Set([
  'House (ቤት)', 'Apartment / Condominium', 'Studio',
  'Villa', 'Townhouse', 'Commercial Space',
])

const ALLOWED_AMENITIES = new Set([
  'Parking', 'Laundry', 'Pet Friendly', 'Generator',
  'Security Guard', 'Water Tank', 'Elevator', 'Furnished',
])

// ── Rate-limit buckets (requests per window) ──────────────────────────────────

const RATE_LIMITS = {
  upload:    { max: 20, windowSec: 60 },   // agents upload more
  write:     { max: 30, windowSec: 60 },   // agents post multiple listings
  read_auth: { max: 30, windowSec: 60 },
  read_pub:  { max: 60, windowSec: 60 },
  email:     { max: 5,  windowSec: 60 },   // form submissions
} as const

const MAX_IMAGE_SIZE = 10 * 1024 * 1024

// ── DB row / body types ───────────────────────────────────────────────────────

// Mirror of the client-side uidToNumId — must stay in sync
function uidToNumId(uid: string): number {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = (Math.imul(31, h) + uid.charCodeAt(i)) | 0
  return Math.abs(h) + 1000
}

interface ListingRow {
  id: string
  owner_id: string
  owner_email: string | null
  owner_display_name: string | null
  owner_photo_url: string | null
  city: string | null
  sub_city: string | null
  woreda: string | null
  kebele: string | null
  landmark: string | null
  lat: number | null
  lng: number | null
  property_type: string | null
  listing_type: string
  monthly_rent: number | null
  sale_price: number | null
  bedrooms: number | null
  bathrooms: number | null
  area_sqm: number | null
  available_from: string | null
  description: string | null
  amenities: string
  photos: string
  status: string
  created_at: number
  updated_at: number
  view_count: number
}

interface ListingBody {
  listingId?: string | null       // present when editing an existing listing
  ownerEmail?: string | null
  ownerDisplayName?: string | null
  ownerPhotoURL?: string | null
  city?: string
  subCity?: string
  woreda?: string
  kebele?: string
  landmark?: string
  lat?: number | null
  lng?: number | null
  propertyType?: string
  listingType?: string            // 'rent' | 'sale'
  monthlyRent?: number | null
  salePrice?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  areaSqm?: number | null
  availableFrom?: string | null
  description?: string
  amenities?: string[]
  photos?: { url: string; key: string }[]
}

// ── Entry point ───────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('Origin') ?? ''

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) })
    }

    const { pathname } = new URL(request.url)

    try {
      if (request.method === 'POST' && pathname === '/upload') {
        return await handleUpload(request, env, origin)
      }
      if (request.method === 'DELETE' && pathname.startsWith('/image/')) {
        return await handleImageDelete(request, env, origin, pathname.slice(7))
      }
      if (pathname === '/listings' && request.method === 'GET') {
        return await handleGetAllListings(request, env, origin)
      }
      if (pathname === '/listing') {
        if (request.method === 'GET')    return await handleGetListing(request, env, origin)
        if (request.method === 'POST')   return await handleUpsertListing(request, env, origin)
        if (request.method === 'DELETE') return await handleDeleteListing(request, env, origin)
      }
      if (pathname === '/listing/view' && request.method === 'POST') {
        return await handleIncrementView(request, env, origin)
      }
      if (pathname === '/favorites') {
        if (request.method === 'GET') return await handleGetFavorites(request, env, origin)
        if (request.method === 'PUT') return await handleSetFavorites(request, env, origin)
        if (request.method === 'PATCH') return await handlePatchFavorite(request, env, origin)
      }
      if (pathname === '/contact' && request.method === 'GET') {
        return await handleGetContact(request, env, origin)
      }
      if (pathname === '/submit-form' && request.method === 'POST') {
        return await handleSubmitForm(request, env, origin)
      }
      if (pathname === '/admin/listing/approve' && request.method === 'PATCH') {
        return await handleApproveListing(request, env, origin)
      }
      if (pathname === '/admin/agents') {
        if (request.method === 'POST')   return await handleAddAgent(request, env, origin)
        if (request.method === 'DELETE') return await handleRemoveAgent(request, env, origin)
      }
      if (pathname === '/admin/listings') {
        if (request.method === 'GET')    return await handleAdminGetListings(request, env, origin)
        if (request.method === 'DELETE') return await handleAdminDeleteListing(request, env, origin)
      }
      if (pathname === '/admin/users' && request.method === 'GET') {
        return await handleAdminGetUsers(request, env, origin)
      }
      if (pathname.startsWith('/admin/users/') && pathname.endsWith('/disable') && request.method === 'PATCH') {
        return await handleAdminDisableUser(request, env, origin, pathname)
      }
      if (pathname === '/admin/stats' && request.method === 'GET') {
        return await handleAdminGetStats(request, env, origin)
      }
      if (pathname === '/admin/staff') {
        if (request.method === 'GET')    return await handleAdminGetStaff(request, env, origin)
        if (request.method === 'POST')   return await handleAdminAddStaff(request, env, origin)
        if (request.method === 'DELETE') return await handleAdminDeleteStaff(request, env, origin)
      }
      if (pathname === '/admin/staff/check' && request.method === 'POST') {
        return await handleAdminCheckStaff(request, env, origin)
      }
    } catch (err) {
      console.error(err)
      return jsonErr(500, 'Internal server error', origin, env)
    }

    return new Response('Not Found', { status: 404 })
  },
}

// ── Agent helpers ─────────────────────────────────────────────────────────────

async function isAgent(uid: string, env: Env): Promise<boolean> {
  const row = await env.DB.prepare('SELECT 1 FROM agents WHERE uid = ?').bind(uid).first()
  return !!row
}

// ── Listings: GET all (public) ────────────────────────────────────────────────

async function handleGetAllListings(request: Request, env: Env, origin: string): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  if (!await rateLimit(env, `pub:${ip}`, RATE_LIMITS.read_pub)) {
    return jsonErr(429, 'Too many requests — please slow down', origin, env)
  }

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const limit = 100
  const offset = (page - 1) * limit

  const [{ results }, agentsResult] = await Promise.all([
    env.DB.prepare('SELECT * FROM listings WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .bind('published', limit + 1, offset).all<ListingRow>(),
    env.DB.prepare('SELECT uid FROM agents').all<{ uid: string }>(),
  ])
  const agentUids = new Set(agentsResult.results.map(r => r.uid))
  const hasMore = results.length > limit
  const pageResults = hasMore ? results.slice(0, limit) : results

  const h = corsHeaders(origin, env)
  h.set('Content-Type', 'application/json')
  h.set('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=30')
  return new Response(JSON.stringify({
    listings: pageResults.map(r => ({ ...rowToListing(r, true), isAgent: agentUids.has(r.owner_id) })),
    hasMore,
  }), { status: 200, headers: h })
}

// ── Listing: GET own (authenticated) ─────────────────────────────────────────

async function handleGetListing(request: Request, env: Env, origin: string): Promise<Response> {
  const uid = await authenticate(request, env)
  if (!uid) return jsonErr(401, 'Unauthorized', origin, env)

  if (!await rateLimit(env, `auth:${uid}`, RATE_LIMITS.read_auth)) {
    return jsonErr(429, 'Too many requests — please slow down', origin, env)
  }

  const [{ results }, agent] = await Promise.all([
    env.DB.prepare('SELECT * FROM listings WHERE owner_id = ? ORDER BY created_at DESC')
      .bind(uid).all<ListingRow>(),
    isAgent(uid, env),
  ])

  const numIds = results.map(r => uidToNumId(r.id))
  let likeMap = new Map<number, number>()
  if (numIds.length > 0) {
    const placeholders = numIds.map(() => '?').join(',')
    const { results: likeCounts } = await env.DB.prepare(
      `SELECT property_id, COUNT(*) as cnt FROM favorites WHERE property_id IN (${placeholders}) GROUP BY property_id`
    ).bind(...numIds).all<{ property_id: number; cnt: number }>()
    likeMap = new Map(likeCounts.map(r => [r.property_id, r.cnt]))
  }
  const listings = results.map(r => ({
    ...rowToListing(r, true),
    likeCount: likeMap.get(uidToNumId(r.id)) ?? 0,
  }))

  return json({ listings, isAgent: agent }, 200, origin, env)
}

// ── Listing: POST (upsert for regular users, insert for agents) ───────────────

async function handleUpsertListing(request: Request, env: Env, origin: string): Promise<Response> {
  const uid = await authenticate(request, env)
  if (!uid) return jsonErr(401, 'Unauthorized', origin, env)

  if (!await rateLimit(env, `write:${uid}`, RATE_LIMITS.write)) {
    return jsonErr(429, 'Too many requests — please slow down', origin, env)
  }

  let body: ListingBody
  try {
    body = await request.json() as ListingBody
  } catch {
    return jsonErr(400, 'Invalid JSON body', origin, env)
  }

  sanitizeBody(body)

  const errors = validateBody(body, env)
  if (errors.length > 0) {
    return jsonErr(400, errors[0], origin, env)
  }

  const now = Date.now()
  const agent = await isAgent(uid, env)

  if (!agent && body.listingType === 'sale') {
    return jsonErr(403, 'Only agents can post sale listings', origin, env)
  }

  const listingId = typeof body.listingId === 'string' && body.listingId.length > 0
    ? body.listingId
    : null

  if (listingId) {
    // Edit mode: update an existing listing — verify ownership
    const existing = await env.DB.prepare(
      'SELECT id, status FROM listings WHERE id = ? AND owner_id = ?'
    ).bind(listingId, uid).first<{ id: string; status: string }>()

    if (!existing) return jsonErr(404, 'Listing not found', origin, env)

    // Agents keep 'published'; regular user edits stay in their current status
    const newStatus = agent ? 'published' : existing.status

    await env.DB.prepare(`
      UPDATE listings SET
        owner_email        = ?,
        owner_display_name = ?,
        owner_photo_url    = ?,
        city               = ?,
        sub_city           = ?,
        woreda             = ?,
        kebele             = ?,
        landmark           = ?,
        lat                = ?,
        lng                = ?,
        property_type      = ?,
        listing_type       = ?,
        monthly_rent       = ?,
        sale_price         = ?,
        bedrooms           = ?,
        bathrooms          = ?,
        area_sqm           = ?,
        available_from     = ?,
        description        = ?,
        amenities          = ?,
        photos             = ?,
        status             = ?,
        updated_at         = ?
      WHERE id = ? AND owner_id = ?
    `).bind(
      body.ownerEmail ?? null,
      body.ownerDisplayName ?? null,
      body.ownerPhotoURL ?? null,
      body.city ?? null,
      body.subCity ?? null,
      body.woreda ?? null,
      body.kebele ?? null,
      body.landmark ?? null,
      body.lat ?? null,
      body.lng ?? null,
      body.propertyType ?? null,
      body.listingType ?? 'rent',
      body.monthlyRent ?? null,
      body.salePrice ?? null,
      body.bedrooms ?? null,
      body.bathrooms ?? null,
      body.areaSqm ?? null,
      body.availableFrom || null,
      body.description ?? null,
      JSON.stringify(body.amenities ?? []),
      JSON.stringify(body.photos ?? []),
      newStatus,
      now,
      listingId, uid,
    ).run()
  } else if (agent) {
    // Agent create mode: always insert a new listing, auto-publish
    const newId = crypto.randomUUID()
    await env.DB.prepare(`
      INSERT INTO listings (
        id, owner_id, owner_email, owner_display_name, owner_photo_url,
        city, sub_city, woreda, kebele, landmark,
        lat, lng, property_type,
        listing_type, monthly_rent, sale_price,
        bedrooms, bathrooms, area_sqm, available_from,
        description, amenities, photos,
        status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        'published', ?, ?
      )
    `).bind(
      newId, uid,
      body.ownerEmail ?? null,
      body.ownerDisplayName ?? null,
      body.ownerPhotoURL ?? null,
      body.city ?? null,
      body.subCity ?? null,
      body.woreda ?? null,
      body.kebele ?? null,
      body.landmark ?? null,
      body.lat ?? null,
      body.lng ?? null,
      body.propertyType ?? null,
      body.listingType ?? 'rent',
      body.monthlyRent ?? null,
      body.salePrice ?? null,
      body.bedrooms ?? null,
      body.bathrooms ?? null,
      body.areaSqm ?? null,
      body.availableFrom || null,
      body.description ?? null,
      JSON.stringify(body.amenities ?? []),
      JSON.stringify(body.photos ?? []),
      now, now,
    ).run()
  } else {
    // Regular user: upsert their single listing (id = uid), starts as pending
    await env.DB.prepare(`
      INSERT INTO listings (
        id, owner_id, owner_email, owner_display_name, owner_photo_url,
        city, sub_city, woreda, kebele, landmark,
        lat, lng, property_type,
        listing_type, monthly_rent, sale_price,
        bedrooms, bathrooms, area_sqm, available_from,
        description, amenities, photos,
        status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        'pending', ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        owner_email        = excluded.owner_email,
        owner_display_name = excluded.owner_display_name,
        owner_photo_url    = excluded.owner_photo_url,
        city               = excluded.city,
        sub_city           = excluded.sub_city,
        woreda             = excluded.woreda,
        kebele             = excluded.kebele,
        landmark           = excluded.landmark,
        lat                = excluded.lat,
        lng                = excluded.lng,
        property_type      = excluded.property_type,
        listing_type       = excluded.listing_type,
        monthly_rent       = excluded.monthly_rent,
        sale_price         = excluded.sale_price,
        bedrooms           = excluded.bedrooms,
        bathrooms          = excluded.bathrooms,
        area_sqm           = excluded.area_sqm,
        available_from     = excluded.available_from,
        description        = excluded.description,
        amenities          = excluded.amenities,
        photos             = excluded.photos,
        updated_at         = excluded.updated_at
    `).bind(
      uid, uid,
      body.ownerEmail ?? null,
      body.ownerDisplayName ?? null,
      body.ownerPhotoURL ?? null,
      body.city ?? null,
      body.subCity ?? null,
      body.woreda ?? null,
      body.kebele ?? null,
      body.landmark ?? null,
      body.lat ?? null,
      body.lng ?? null,
      body.propertyType ?? null,
      body.listingType ?? 'rent',
      body.monthlyRent ?? null,
      body.salePrice ?? null,
      body.bedrooms ?? null,
      body.bathrooms ?? null,
      body.areaSqm ?? null,
      body.availableFrom || null,
      body.description ?? null,
      JSON.stringify(body.amenities ?? []),
      JSON.stringify(body.photos ?? []),
      now, now,
    ).run()
  }

  // Return the target listing
  const targetId = listingId ?? (agent ? null : uid)
  let saved: ListingRow | null = null
  if (targetId) {
    saved = await env.DB.prepare('SELECT * FROM listings WHERE id = ?')
      .bind(targetId).first<ListingRow>() ?? null
  } else {
    // Agent just inserted — fetch the most recent one
    saved = await env.DB.prepare(
      'SELECT * FROM listings WHERE owner_id = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(uid).first<ListingRow>() ?? null
  }

  if (!saved) return jsonErr(500, 'Failed to retrieve saved listing', origin, env)
  return json(rowToListing(saved, true), 200, origin, env)
}

// ── Listing: DELETE ───────────────────────────────────────────────────────────

async function handleDeleteListing(request: Request, env: Env, origin: string): Promise<Response> {
  const uid = await authenticate(request, env)
  if (!uid) return jsonErr(401, 'Unauthorized', origin, env)

  if (!await rateLimit(env, `write:${uid}`, RATE_LIMITS.write)) {
    return jsonErr(429, 'Too many requests — please slow down', origin, env)
  }

  // Optional listingId query param — if omitted, falls back to id = uid (regular users)
  const url = new URL(request.url)
  const listingId = url.searchParams.get('id') ?? uid

  const row = await env.DB.prepare(
    'SELECT id, photos FROM listings WHERE id = ? AND owner_id = ?'
  ).bind(listingId, uid).first<Pick<ListingRow, 'id' | 'photos'>>()

  if (!row) return jsonErr(404, 'Listing not found', origin, env)

  const photos = safeParseJSON<{ url: string; key: string }[]>(row.photos, [])
  await Promise.allSettled(photos.map(p => env.GOJO_LISTINGS.delete(p.key)))

  await env.DB.prepare('DELETE FROM listings WHERE id = ? AND owner_id = ?')
    .bind(listingId, uid).run()

  return json({ deleted: listingId }, 200, origin, env)
}

// ── Image upload ──────────────────────────────────────────────────────────────

async function handleUpload(request: Request, env: Env, origin: string): Promise<Response> {
  const uid = await authenticate(request, env)
  if (!uid) return jsonErr(401, 'Unauthorized', origin, env)

  if (!await rateLimit(env, `upload:${uid}`, RATE_LIMITS.upload)) {
    return jsonErr(429, 'Upload limit reached — please wait a minute', origin, env)
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return jsonErr(400, 'Invalid multipart body', origin, env)
  }

  const fileEntry = form.get('file')
  if (!fileEntry || typeof fileEntry === 'string') {
    return jsonErr(400, 'Missing file field', origin, env)
  }
  const file = fileEntry as File

  const ext = ALLOWED_MIME[file.type]
  if (!ext) return jsonErr(400, 'Only JPEG, PNG, and WebP are allowed', origin, env)
  if (file.size > MAX_IMAGE_SIZE) return jsonErr(413, 'File exceeds 10 MB limit', origin, env)
  if (file.size === 0) return jsonErr(400, 'Empty file', origin, env)

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (!isAllowedImageMagic(header, file.type)) {
    return jsonErr(400, 'File content does not match its declared type', origin, env)
  }

  const key = `listings/${uid}/${crypto.randomUUID()}.${ext}`

  await env.GOJO_LISTINGS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { uploadedBy: uid },
  })

  return json({ key, url: `${env.R2_PUBLIC_URL}/${key}` }, 200, origin, env)
}

// ── Image delete ──────────────────────────────────────────────────────────────

async function handleImageDelete(
  request: Request,
  env: Env,
  origin: string,
  rawKey: string
): Promise<Response> {
  const uid = await authenticate(request, env)
  if (!uid) return jsonErr(401, 'Unauthorized', origin, env)

  if (!await rateLimit(env, `write:${uid}`, RATE_LIMITS.write)) {
    return jsonErr(429, 'Too many requests — please slow down', origin, env)
  }

  const key = decodeURIComponent(rawKey)

  if (!key.startsWith(`listings/${uid}/`)) {
    return jsonErr(403, 'Forbidden', origin, env)
  }

  if (key.includes('..') || key.includes('//')) {
    return jsonErr(400, 'Invalid key', origin, env)
  }

  await env.GOJO_LISTINGS.delete(key)
  return json({ deleted: key }, 200, origin, env)
}

// ── Listing: view increment (public) ─────────────────────────────────────────

async function handleIncrementView(request: Request, env: Env, origin: string): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  if (!await rateLimit(env, `view:${ip}`, RATE_LIMITS.read_pub)) {
    return jsonErr(429, 'Too many requests', origin, env)
  }

  let body: { listingId: unknown }
  try {
    body = await request.json() as { listingId: unknown }
  } catch {
    return jsonErr(400, 'Invalid JSON', origin, env)
  }

  if (typeof body.listingId !== 'string' || body.listingId.length > 128) {
    return jsonErr(400, 'Invalid listingId', origin, env)
  }

  await env.DB.prepare(
    'UPDATE listings SET view_count = view_count + 1 WHERE id = ?'
  ).bind(body.listingId).run()

  return json({ ok: true }, 200, origin, env)
}

// ── Favorites: GET ────────────────────────────────────────────────────────────

async function handleGetFavorites(request: Request, env: Env, origin: string): Promise<Response> {
  const uid = await authenticate(request, env)
  if (!uid) return jsonErr(401, 'Unauthorized', origin, env)

  if (!await rateLimit(env, `auth:${uid}`, RATE_LIMITS.read_auth)) {
    return jsonErr(429, 'Too many requests', origin, env)
  }

  const { results } = await env.DB.prepare(
    'SELECT property_id FROM favorites WHERE user_id = ?'
  ).bind(uid).all<{ property_id: number }>()

  return json({ ids: results.map(r => r.property_id) }, 200, origin, env)
}

// ── Favorites: PUT (replace full list) ───────────────────────────────────────

async function handleSetFavorites(request: Request, env: Env, origin: string): Promise<Response> {
  const uid = await authenticate(request, env)
  if (!uid) return jsonErr(401, 'Unauthorized', origin, env)

  if (!await rateLimit(env, `write:${uid}`, RATE_LIMITS.write)) {
    return jsonErr(429, 'Too many requests', origin, env)
  }

  let body: { ids: unknown }
  try {
    body = await request.json() as { ids: unknown }
  } catch {
    return jsonErr(400, 'Invalid JSON', origin, env)
  }

  if (!Array.isArray(body.ids) || body.ids.length > 200) {
    return jsonErr(400, 'ids must be an array of at most 200 items', origin, env)
  }

  const ids = (body.ids as unknown[])
    .filter((id): id is number => typeof id === 'number' && Number.isInteger(id))

  await env.DB.batch([
    env.DB.prepare('DELETE FROM favorites WHERE user_id = ?').bind(uid),
    ...ids.map(id =>
      env.DB.prepare('INSERT INTO favorites (user_id, property_id) VALUES (?, ?)').bind(uid, id)
    ),
  ])

  return json({ ids }, 200, origin, env)
}

// ── Favorites: PATCH (add / remove single item) ───────────────────────────────

async function handlePatchFavorite(request: Request, env: Env, origin: string): Promise<Response> {
  const uid = await authenticate(request, env)
  if (!uid) return jsonErr(401, 'Unauthorized', origin, env)

  if (!await rateLimit(env, `write:${uid}`, RATE_LIMITS.write)) {
    return jsonErr(429, 'Too many requests', origin, env)
  }

  let body: { action: unknown; id: unknown }
  try {
    body = await request.json() as { action: unknown; id: unknown }
  } catch {
    return jsonErr(400, 'Invalid JSON', origin, env)
  }

  if (body.action !== 'add' && body.action !== 'remove') {
    return jsonErr(400, 'action must be "add" or "remove"', origin, env)
  }
  if (typeof body.id !== 'number' || !Number.isInteger(body.id)) {
    return jsonErr(400, 'id must be an integer', origin, env)
  }

  if (body.action === 'add') {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO favorites (user_id, property_id) VALUES (?, ?)'
    ).bind(uid, body.id).run()
  } else {
    await env.DB.prepare(
      'DELETE FROM favorites WHERE user_id = ? AND property_id = ?'
    ).bind(uid, body.id).run()
  }

  return json({ ok: true }, 200, origin, env)
}

// ── Admin: approve / reject listing ──────────────────────────────────────────

async function handleApproveListing(request: Request, env: Env, origin: string): Promise<Response> {
  const secret = request.headers.get('X-Admin-Secret')
  if (!secret || secret !== env.ADMIN_SECRET) {
    return jsonErr(401, 'Unauthorized', origin, env)
  }

  let body: { listingId: unknown; action: unknown }
  try {
    body = await request.json() as { listingId: unknown; action: unknown }
  } catch {
    return jsonErr(400, 'Invalid JSON', origin, env)
  }

  if (typeof body.listingId !== 'string' || body.listingId.length > 128) {
    return jsonErr(400, 'Invalid listingId', origin, env)
  }
  if (body.action !== 'approve' && body.action !== 'reject') {
    return jsonErr(400, 'action must be "approve" or "reject"', origin, env)
  }

  const newStatus = body.action === 'approve' ? 'published' : 'rejected'
  const result = await env.DB.prepare(
    'UPDATE listings SET status = ?, updated_at = ? WHERE id = ?'
  ).bind(newStatus, Date.now(), body.listingId).run()

  if (result.meta.changes === 0) return jsonErr(404, 'Listing not found', origin, env)

  return json({ listingId: body.listingId, status: newStatus }, 200, origin, env)
}

// ── Admin: manage agents ──────────────────────────────────────────────────────

async function handleAddAgent(request: Request, env: Env, origin: string): Promise<Response> {
  const secret = request.headers.get('X-Admin-Secret')
  if (!secret || secret !== env.ADMIN_SECRET) return jsonErr(401, 'Unauthorized', origin, env)

  let body: { uid: unknown }
  try { body = await request.json() as { uid: unknown } }
  catch { return jsonErr(400, 'Invalid JSON', origin, env) }

  if (typeof body.uid !== 'string' || body.uid.length > 128) {
    return jsonErr(400, 'Invalid uid', origin, env)
  }

  await env.DB.prepare(
    'INSERT OR IGNORE INTO agents (uid) VALUES (?)'
  ).bind(body.uid).run()

  return json({ uid: body.uid, role: 'agent' }, 200, origin, env)
}

async function handleRemoveAgent(request: Request, env: Env, origin: string): Promise<Response> {
  const secret = request.headers.get('X-Admin-Secret')
  if (!secret || secret !== env.ADMIN_SECRET) return jsonErr(401, 'Unauthorized', origin, env)

  let body: { uid: unknown }
  try { body = await request.json() as { uid: unknown } }
  catch { return jsonErr(400, 'Invalid JSON', origin, env) }

  if (typeof body.uid !== 'string' || body.uid.length > 128) {
    return jsonErr(400, 'Invalid uid', origin, env)
  }

  await env.DB.prepare('DELETE FROM agents WHERE uid = ?').bind(body.uid).run()
  return json({ uid: body.uid, role: null }, 200, origin, env)
}

// ── Admin: GET all listings ───────────────────────────────────────────────────

async function handleAdminGetListings(request: Request, env: Env, origin: string): Promise<Response> {
  const secret = request.headers.get('X-Admin-Secret')
  if (!secret || secret !== env.ADMIN_SECRET) return jsonErr(401, 'Unauthorized', origin, env)

  const [listingsResult, agentsResult] = await Promise.all([
    env.DB.prepare('SELECT * FROM listings ORDER BY created_at DESC').all<ListingRow>(),
    env.DB.prepare('SELECT uid FROM agents').all<{ uid: string }>(),
  ])

  const agentUids = new Set(agentsResult.results.map(r => r.uid))

  return json(
    listingsResult.results.map(r => ({ ...rowToListing(r, true), isAgent: agentUids.has(r.owner_id) })),
    200, origin, env,
  )
}

// ── Admin: DELETE any listing ─────────────────────────────────────────────────

async function handleAdminDeleteListing(request: Request, env: Env, origin: string): Promise<Response> {
  const secret = request.headers.get('X-Admin-Secret')
  if (!secret || secret !== env.ADMIN_SECRET) return jsonErr(401, 'Unauthorized', origin, env)

  let body: { id: unknown }
  try { body = await request.json() as { id: unknown } }
  catch { return jsonErr(400, 'Invalid JSON', origin, env) }

  if (typeof body.id !== 'string' || body.id.length > 128) {
    return jsonErr(400, 'Invalid id', origin, env)
  }

  const row = await env.DB.prepare(
    'SELECT id, photos FROM listings WHERE id = ?'
  ).bind(body.id).first<Pick<ListingRow, 'id' | 'photos'>>()

  if (!row) return jsonErr(404, 'Listing not found', origin, env)

  const photos = safeParseJSON<{ url: string; key: string }[]>(row.photos, [])
  await Promise.allSettled(photos.map(p => env.GOJO_LISTINGS.delete(p.key)))
  await env.DB.prepare('DELETE FROM listings WHERE id = ?').bind(body.id).run()

  return json({ deleted: body.id }, 200, origin, env)
}

// ── Firebase Auth helpers ─────────────────────────────────────────────────────

interface FirebaseAuthUser {
  localId: string
  email?: string
  displayName?: string
  photoUrl?: string
  createdAt?: string  // epoch ms as a string
  disabled?: boolean
}

interface AdminUserBody {
  disabled: unknown
}

async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const key = JSON.parse(serviceAccountJson) as { client_email: string; private_key: string }
  const now = Math.floor(Date.now() / 1000)

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const signingInput = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })}`

  const pem = key.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '')
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput))
  const encodedSig = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${signingInput}.${encodedSig}`,
    }),
  })
  const { access_token } = await tokenRes.json() as { access_token: string }
  return access_token
}

async function listAllFirebaseUsers(projectId: string, accessToken: string): Promise<FirebaseAuthUser[]> {
  const users: FirebaseAuthUser[] = []
  let nextPageToken: string | undefined
  do {
    const url = new URL(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:batchGet`)
    url.searchParams.set('maxResults', '1000')
    if (nextPageToken) url.searchParams.set('nextPageToken', nextPageToken)
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } })
    const data = await res.json() as { users?: FirebaseAuthUser[]; nextPageToken?: string }
    if (data.users) users.push(...data.users)
    nextPageToken = data.nextPageToken
  } while (nextPageToken)
  return users
}

// ── Admin: GET users ──────────────────────────────────────────────────────────

async function handleAdminGetUsers(request: Request, env: Env, origin: string): Promise<Response> {
  const secret = request.headers.get('X-Admin-Secret')
  if (!secret || secret !== env.ADMIN_SECRET) return jsonErr(401, 'Unauthorized', origin, env)

  const accessToken = await getGoogleAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON)

  const [firebaseUsers, agentsResult, listingCountsResult] = await Promise.all([
    listAllFirebaseUsers(env.FIREBASE_PROJECT_ID, accessToken),
    env.DB.prepare('SELECT uid, created_at FROM agents').all<{ uid: string; created_at: number }>(),
    env.DB.prepare('SELECT owner_id, COUNT(*) as count FROM listings GROUP BY owner_id').all<{ owner_id: string; count: number }>(),
  ])

  const agentMap = new Map(agentsResult.results.map(r => [r.uid, r.created_at]))
  const listingCountMap = new Map(listingCountsResult.results.map(r => [r.owner_id, r.count]))

  const users = firebaseUsers.map(u => ({
    id: u.localId,
    name: u.displayName ?? '',
    email: u.email ?? '',
    photoURL: u.photoUrl ?? null,
    isAgent: agentMap.has(u.localId),
    listingCount: listingCountMap.get(u.localId) ?? 0,
    joinedAt: u.createdAt ? parseInt(u.createdAt, 10) : Date.now(),
    disabled: u.disabled ?? false,
  }))

  return json({ users, agentUids: [...agentMap.keys()] }, 200, origin, env)
}

// ── Admin: disable / reactivate a Firebase Auth user ─────────────────────────

async function handleAdminDisableUser(request: Request, env: Env, origin: string, pathname: string): Promise<Response> {
  const secret = request.headers.get('X-Admin-Secret')
  if (!secret || secret !== env.ADMIN_SECRET) return jsonErr(401, 'Unauthorized', origin, env)

  const uid = pathname.split('/')[3]
  if (!uid || uid.length > 128) return jsonErr(400, 'Invalid uid', origin, env)

  let body: AdminUserBody
  try { body = await request.json() as AdminUserBody }
  catch { return jsonErr(400, 'Invalid JSON', origin, env) }

  if (typeof body.disabled !== 'boolean') return jsonErr(400, 'disabled must be a boolean', origin, env)

  const accessToken = await getGoogleAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON)
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:update`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: uid, disableUser: body.disabled }),
    }
  )

  if (!res.ok) return jsonErr(500, 'Failed to update user', origin, env)
  return json({ uid, disabled: body.disabled }, 200, origin, env)
}

// ── Admin: GET stats ──────────────────────────────────────────────────────────

async function handleAdminGetStats(request: Request, env: Env, origin: string): Promise<Response> {
  const secret = request.headers.get('X-Admin-Secret')
  if (!secret || secret !== env.ADMIN_SECRET) return jsonErr(401, 'Unauthorized', origin, env)

  const [listingStats, agentCount, ownerCount, userListings, agentListings] = await Promise.all([
    env.DB.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END) as pending,
             SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
             SUM(CASE WHEN status = 'rejected'  THEN 1 ELSE 0 END) as rejected
      FROM listings
    `).first<{ total: number; pending: number; published: number; rejected: number }>(),
    env.DB.prepare('SELECT COUNT(*) as count FROM agents').first<{ count: number }>(),
    env.DB.prepare('SELECT COUNT(DISTINCT owner_id) as count FROM listings').first<{ count: number }>(),
    env.DB.prepare('SELECT COUNT(*) as count FROM listings WHERE owner_id NOT IN (SELECT uid FROM agents)').first<{ count: number }>(),
    env.DB.prepare('SELECT COUNT(*) as count FROM listings WHERE owner_id IN (SELECT uid FROM agents)').first<{ count: number }>(),
  ])

  const totalAgents = agentCount?.count ?? 0
  const totalOwners = ownerCount?.count ?? 0
  const totalUsers = Math.max(0, totalOwners - totalAgents)

  return json({
    totalUsers,
    totalAgents,
    totalListings: listingStats?.total ?? 0,
    pendingListings: listingStats?.pending ?? 0,
    publishedListings: listingStats?.published ?? 0,
    rejectedListings: listingStats?.rejected ?? 0,
    userListings: userListings?.count ?? 0,
    agentListings: agentListings?.count ?? 0,
  }, 200, origin, env)
}

// ── Contact info: GET (public) ────────────────────────────────────────────────

interface ContactRow {
  phone: string | null
  email: string | null
  address: string | null
  office_hours: string | null
}

async function handleGetContact(request: Request, env: Env, origin: string): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  if (!await rateLimit(env, `pub:${ip}`, RATE_LIMITS.read_pub)) {
    return jsonErr(429, 'Too many requests', origin, env)
  }

  const cached = await env.RATE_LIMITER.get('contact_info')
  if (cached) {
    const h = corsHeaders(origin, env)
    h.set('Content-Type', 'application/json')
    return new Response(cached, { status: 200, headers: h })
  }

  const row = await env.DB.prepare(
    'SELECT phone, email, address, office_hours FROM contact_info WHERE id = 1'
  ).first<ContactRow>()

  const data = row ?? { phone: null, email: null, address: null, office_hours: null }
  env.RATE_LIMITER.put('contact_info', JSON.stringify(data), { expirationTtl: 3600 }).catch(() => {})

  return json(data, 200, origin, env)
}

// ── Firebase JWT verification ─────────────────────────────────────────────────

async function authenticate(request: Request, env: Env): Promise<string | null> {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  if (token.length > 4096) return null
  return verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID)
}

async function verifyFirebaseToken(token: string, projectId: string): Promise<string | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const header = JSON.parse(b64u(parts[0])) as { kid?: string; alg?: string }
    const payload = JSON.parse(b64u(parts[1])) as {
      sub: string; iss: string; aud: string | string[]
      exp: number; iat: number; auth_time?: number
    }

    if (!payload.sub || typeof payload.sub !== 'string') return null

    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) return null
    if (payload.iat > now + 300) return null
    if (payload.auth_time !== undefined && payload.auth_time > now + 300) return null

    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
    if (!aud.includes(projectId)) return null
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null
    if (!header.kid || header.alg !== 'RS256') return null

    const jwksRes = await fetch(
      'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { cf: { cacheTtl: 3600, cacheEverything: true } } as any
    )
    if (!jwksRes.ok) return null

    const { keys } = (await jwksRes.json()) as { keys: Array<JsonWebKey & { kid?: string }> }
    const jwk = keys.find(k => k.kid === header.kid)
    if (!jwk) return null

    const pubKey = await crypto.subtle.importKey(
      'jwk', jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['verify']
    )

    const msg = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    const sig = Uint8Array.from(
      atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    )

    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pubKey, sig, msg)
    return valid ? payload.sub : null
  } catch {
    return null
  }
}

// ── Form submission → Brevo email ────────────────────────────────────────────

const FORM_SUBJECTS: Record<string, string> = {
  'talk-to-agent': 'New Agent Inquiry — Yevilla',
  'contact':       'New Contact Message — Yevilla',
  'sell-home':     'New Sell My Home Request — Yevilla',
  'become-agent':  'New Agent Application — Yevilla',
}

async function handleSubmitForm(request: Request, env: Env, origin: string): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  if (!await rateLimit(env, `email:${ip}`, RATE_LIMITS.email)) {
    return jsonErr(429, 'Too many submissions — please slow down', origin, env)
  }

  let body: { type?: unknown; fields?: unknown }
  try { body = await request.json() } catch { return jsonErr(400, 'Invalid JSON', origin, env) }

  const type = typeof body.type === 'string' ? body.type : ''
  if (!FORM_SUBJECTS[type]) return jsonErr(400, 'Invalid form type', origin, env)

  const rawFields = body.fields
  if (!rawFields || typeof rawFields !== 'object' || Array.isArray(rawFields)) {
    return jsonErr(400, 'Missing fields', origin, env)
  }

  const fields: Record<string, string> = {}
  for (const [k, v] of Object.entries(rawFields as Record<string, unknown>)) {
    const key = sanitizeText(String(k), 60)
    const val = sanitizeText(String(v ?? ''), 2000)
    if (key && val) fields[key] = val
  }

  if (Object.keys(fields).length === 0) return jsonErr(400, 'No fields provided', origin, env)

  const to = env.STAFF_EMAIL || 'anaibrahim628@gmail.com'
  const subject = FORM_SUBJECTS[type]
  const html = buildFormEmailHtml(type, fields)

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'Yevilla', email: 'noreply@yevilla.com' },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    })
    if (!res.ok) {
      console.error('Brevo error', res.status, await res.text())
      return jsonErr(502, 'Failed to send — please try again', origin, env)
    }
  } catch (err) {
    console.error('Brevo fetch error', err)
    return jsonErr(502, 'Failed to send — please try again', origin, env)
  }

  return json({ ok: true }, 200, origin, env)
}

function buildFormEmailHtml(type: string, fields: Record<string, string>): string {
  const title = ({
    'talk-to-agent': 'Agent Inquiry',
    'contact':       'Contact Message',
    'sell-home':     'Sell My Home Request',
    'become-agent':  'Agent Application',
  } as Record<string, string>)[type] ?? 'Form Submission'

  const rows = Object.entries(fields).map(([k, v]) => `
    <tr>
      <td style="padding:8px 14px;background:#f3f4f6;font-weight:600;color:#374151;white-space:nowrap;vertical-align:top;border-bottom:1px solid #e5e7eb;font-size:13px">${escapeHtml(k)}</td>
      <td style="padding:8px 14px;color:#1f2937;vertical-align:top;border-bottom:1px solid #e5e7eb;font-size:13px">${escapeHtml(v).replace(/\n/g, '<br>')}</td>
    </tr>`).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f9fafb;padding:24px;margin:0">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.12)">
    <div style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:24px 32px">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700">Yevilla — ${escapeHtml(title)}</h1>
    </div>
    <div style="padding:28px 32px">
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">${rows}</table>
      <p style="margin:20px 0 0;font-size:12px;color:#9ca3af">Submitted via yevilla.com</p>
    </div>
  </div>
</body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── Rate limiter (fixed window via KV) ────────────────────────────────────────

async function rateLimit(
  env: Env,
  key: string,
  bucket: { max: number; windowSec: number }
): Promise<boolean> {
  const window = Math.floor(Date.now() / 1000 / bucket.windowSec)
  const kvKey = `rl:${key}:${window}`
  const current = parseInt((await env.RATE_LIMITER.get(kvKey)) ?? '0', 10)
  if (current >= bucket.max) return false
  env.RATE_LIMITER.put(kvKey, String(current + 1), {
    expirationTtl: bucket.windowSec * 2,
  }).catch(() => { /* non-fatal */ })
  return true
}

// ── Input sanitization ────────────────────────────────────────────────────────

function sanitizeText(s: string | undefined | null, maxLen: number): string {
  if (!s) return ''
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLen)
}

function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
}

function isValidHttpsUrl(url: string): boolean {
  try { return new URL(url).protocol === 'https:' } catch { return false }
}

function isValidISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s))
}

function sanitizeBody(body: ListingBody): void {
  body.ownerDisplayName = sanitizeText(body.ownerDisplayName, 150) || null
  body.city             = sanitizeText(body.city, 100)
  body.subCity          = sanitizeText(body.subCity, 100)
  body.woreda           = sanitizeText(body.woreda, 100)
  body.kebele           = sanitizeText(body.kebele, 100)
  body.landmark         = sanitizeText(body.landmark, 200)
  body.description      = sanitizeText(body.description, 2000)
  body.propertyType     = sanitizeText(body.propertyType, 100)
  body.listingType      = sanitizeText(body.listingType, 10) || 'rent'

  if (body.ownerEmail && !isValidEmail(body.ownerEmail)) body.ownerEmail = null
  if (body.ownerPhotoURL && !isValidHttpsUrl(body.ownerPhotoURL)) body.ownerPhotoURL = null

  if (body.monthlyRent != null) body.monthlyRent = Math.min(Math.max(body.monthlyRent, 0), 100_000_000)
  if (body.salePrice   != null) body.salePrice   = Math.min(Math.max(body.salePrice, 0), 1_000_000_000)
  if (body.bedrooms    != null) body.bedrooms    = Math.min(Math.max(Math.floor(body.bedrooms), 0), 50)
  if (body.bathrooms   != null) body.bathrooms   = Math.min(Math.max(Math.floor(body.bathrooms), 0), 50)
  if (body.areaSqm     != null) body.areaSqm     = Math.min(Math.max(body.areaSqm, 0), 50_000)
  if (body.lat         != null) body.lat         = Math.min(Math.max(body.lat, -90), 90)
  if (body.lng         != null) body.lng         = Math.min(Math.max(body.lng, -180), 180)
}

// ── Input validation ──────────────────────────────────────────────────────────

function validateBody(body: ListingBody, env: Env): string[] {
  const errors: string[] = []

  if (body.city && !ALLOWED_CITIES.has(body.city)) {
    errors.push('Invalid city value')
  }
  if (body.propertyType && !ALLOWED_PROPERTY_TYPES.has(body.propertyType)) {
    errors.push('Invalid property type')
  }
  if (body.listingType && body.listingType !== 'rent' && body.listingType !== 'sale') {
    errors.push('listingType must be "rent" or "sale"')
  }
  if (body.availableFrom && !isValidISODate(body.availableFrom)) {
    errors.push('availableFrom must be a valid YYYY-MM-DD date')
  }

  if (body.amenities) {
    if (!Array.isArray(body.amenities) || body.amenities.length > 20) {
      errors.push('amenities must be an array of at most 20 items')
    } else {
      for (const a of body.amenities) {
        if (typeof a !== 'string' || !ALLOWED_AMENITIES.has(a)) {
          errors.push(`Unknown amenity: "${a}"`)
          break
        }
      }
    }
  }

  if (body.photos) {
    if (!Array.isArray(body.photos) || body.photos.length > 10) {
      errors.push('photos must be an array of at most 10 items')
    } else {
      for (const p of body.photos) {
        if (typeof p?.url !== 'string' || typeof p?.key !== 'string') {
          errors.push('Each photo must have url and key fields')
          break
        }
        if (!p.url.startsWith(`${env.R2_PUBLIC_URL}/listings/`)) {
          errors.push('Invalid photo URL — must be hosted in the Gojo R2 bucket')
          break
        }
        if (p.key.includes('..') || p.key.includes('//')) {
          errors.push('Invalid photo key')
          break
        }
      }
    }
  }

  return errors
}

// ── Image magic-byte check ────────────────────────────────────────────────────

function isAllowedImageMagic(bytes: Uint8Array, mime: string): boolean {
  const b = bytes
  const isJpeg = b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF
  const isPng  = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47
  const isWebp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
                 b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  if (mime === 'image/jpeg') return isJpeg
  if (mime === 'image/png')  return isPng
  if (mime === 'image/webp') return isWebp
  return false
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function b64u(s: string): string {
  const pad = (4 - (s.length % 4)) % 4
  return atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad))
}

function safeParseJSON<T>(s: string, fallback: T): T {
  try { return JSON.parse(s) as T } catch { return fallback }
}

function rowToListing(row: ListingRow, includeEmail: boolean) {
  return {
    id:               row.id,
    ownerId:          row.owner_id,
    ownerDisplayName: row.owner_display_name,
    ownerPhotoURL:    row.owner_photo_url,
    ...(includeEmail ? { ownerEmail: row.owner_email } : {}),
    city:          row.city ?? '',
    subCity:       row.sub_city ?? '',
    woreda:        row.woreda ?? '',
    kebele:        row.kebele ?? '',
    landmark:      row.landmark ?? '',
    lat:           row.lat,
    lng:           row.lng,
    propertyType:  row.property_type ?? '',
    listingType:   (row.listing_type ?? 'rent') as 'rent' | 'sale',
    monthlyRent:   row.monthly_rent,
    salePrice:     row.sale_price,
    bedrooms:      row.bedrooms,
    bathrooms:     row.bathrooms,
    areaSqm:       row.area_sqm,
    availableFrom: row.available_from,
    description:   row.description ?? '',
    amenities:     safeParseJSON<string[]>(row.amenities, []),
    photos:        safeParseJSON<{ url: string; key: string }[]>(row.photos, []),
    status:        row.status,
    viewCount:     row.view_count ?? 0,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  }
}

// ── Admin: Staff ──────────────────────────────────────────────────────────────

interface StaffRow {
  id: string
  name: string
  email: string
  created_at: number
}

async function handleAdminGetStaff(request: Request, env: Env, origin: string): Promise<Response> {
  const secret = request.headers.get('X-Admin-Secret')
  if (!secret || secret !== env.ADMIN_SECRET) return jsonErr(401, 'Unauthorized', origin, env)

  const result = await env.DB.prepare('SELECT * FROM staff ORDER BY created_at DESC').all<StaffRow>()
  return json(result.results.map(r => ({
    id: r.id, name: r.name, email: r.email, createdAt: r.created_at,
  })), 200, origin, env)
}

async function handleAdminAddStaff(request: Request, env: Env, origin: string): Promise<Response> {
  const secret = request.headers.get('X-Admin-Secret')
  if (!secret || secret !== env.ADMIN_SECRET) return jsonErr(401, 'Unauthorized', origin, env)

  let body: { name?: unknown; email?: unknown }
  try { body = await request.json() as { name?: unknown; email?: unknown } }
  catch { return jsonErr(400, 'Invalid JSON', origin, env) }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!name || !email) return jsonErr(400, 'name and email are required', origin, env)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonErr(400, 'Invalid email', origin, env)

  const id = crypto.randomUUID()
  const now = Date.now()
  try {
    await env.DB.prepare('INSERT INTO staff (id, name, email, created_at) VALUES (?, ?, ?, ?)')
      .bind(id, name, email, now).run()
  } catch {
    return jsonErr(409, 'Email already exists', origin, env)
  }

  return json({ id, name, email, createdAt: now }, 201, origin, env)
}

async function handleAdminCheckStaff(request: Request, env: Env, origin: string): Promise<Response> {
  const secret = request.headers.get('X-Admin-Secret')
  if (!secret || secret !== env.ADMIN_SECRET) return jsonErr(401, 'Unauthorized', origin, env)

  let body: { email?: unknown }
  try { body = await request.json() as { email?: unknown } }
  catch { return jsonErr(400, 'Invalid JSON', origin, env) }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email) return jsonErr(400, 'email required', origin, env)

  const row = await env.DB.prepare('SELECT id, name, email, created_at FROM staff WHERE LOWER(email) = ?')
    .bind(email).first<StaffRow>()
  if (!row) return jsonErr(404, 'Not a staff member', origin, env)
  return json({ id: row.id, name: row.name, email: row.email, createdAt: row.created_at }, 200, origin, env)
}

async function handleAdminDeleteStaff(request: Request, env: Env, origin: string): Promise<Response> {
  const secret = request.headers.get('X-Admin-Secret')
  if (!secret || secret !== env.ADMIN_SECRET) return jsonErr(401, 'Unauthorized', origin, env)

  let body: { id?: unknown }
  try { body = await request.json() as { id?: unknown } }
  catch { return jsonErr(400, 'Invalid JSON', origin, env) }

  if (typeof body.id !== 'string' || !body.id) return jsonErr(400, 'id required', origin, env)

  const result = await env.DB.prepare('DELETE FROM staff WHERE id = ?').bind(body.id).run()
  if (result.meta.changes === 0) return jsonErr(404, 'Staff member not found', origin, env)
  return json({ deleted: body.id }, 200, origin, env)
}

function corsHeaders(origin: string, env: Env): Headers {
  const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(origin)
  const wwwVariant = env.ALLOWED_ORIGIN.replace(/^https:\/\//, 'https://www.')
  const allowed = origin === env.ALLOWED_ORIGIN || origin === wwwVariant || isLocalhost
  const h = new Headers()
  h.set('Access-Control-Allow-Origin', allowed ? origin : env.ALLOWED_ORIGIN)
  h.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  h.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Admin-Secret')
  h.set('Access-Control-Max-Age', '86400')
  h.set('X-Content-Type-Options', 'nosniff')
  h.set('X-Frame-Options', 'DENY')
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  return h
}

function json(data: unknown, status: number, origin: string, env: Env): Response {
  const h = corsHeaders(origin, env)
  h.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(data), { status, headers: h })
}

function jsonErr(status: number, error: string, origin: string, env: Env): Response {
  return json({ error }, status, origin, env)
}
