import type { R2Bucket, ExecutionContext, D1Database, KVNamespace, ScheduledEvent } from '@cloudflare/workers-types'

export interface Env {
  GOJO_LISTINGS: R2Bucket
  DB: D1Database
  RATE_LIMITER: KVNamespace
  PUSH_TOKENS: KVNamespace     // uid → ExponentPushToken[...]
  SAVED_SEARCHES: KVNamespace  // uid → JSON array of search criteria
  FIREBASE_PROJECT_ID: string
  R2_PUBLIC_URL: string      // e.g. https://pub-xxx.r2.dev  (no trailing slash)
  ALLOWED_ORIGIN: string     // e.g. https://yevilla.com
  ADMIN_SECRET: string       // set via: wrangler secret put ADMIN_SECRET
  FIREBASE_SERVICE_ACCOUNT_JSON: string  // set via: wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON
  BREVO_API_KEY: string      // set via: wrangler secret put BREVO_API_KEY
  STAFF_EMAIL: string        // set via: wrangler secret put STAFF_EMAIL (default: anaibrahim628@gmail.com)
  TURNSTILE_SECRET: string   // set via: wrangler secret put TURNSTILE_SECRET (Cloudflare Turnstile)
  R2_ACCOUNT_ID: string      // wrangler.toml [vars] — account that owns the bucket
  R2_BUCKET_NAME: string     // wrangler.toml [vars] — bucket behind GOJO_LISTINGS
  R2_ACCESS_KEY_ID: string   // set via: wrangler secret put R2_ACCESS_KEY_ID (R2 API token, Object Read & Write)
  R2_SECRET_ACCESS_KEY: string // set via: wrangler secret put R2_SECRET_ACCESS_KEY
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
  'Hotel', 'Event Venue',
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

// Walkthrough videos upload straight from the browser to R2 through a short-lived
// presigned URL (so they aren't limited by the worker's 100 MB request cap). The
// worker then verifies the stored file (type + length) before it can be attached
// to a listing. `family` picks the container parser used to read the duration.
type VideoFamily = 'iso' | 'matroska'
const ALLOWED_VIDEO_TYPES: Record<string, { ext: string; family: VideoFamily }> = {
  'video/mp4':        { ext: 'mp4',  family: 'iso' },
  'video/quicktime':  { ext: 'mov',  family: 'iso' },
  'video/x-m4v':      { ext: 'm4v',  family: 'iso' },
  'video/3gpp':       { ext: '3gp',  family: 'iso' },
  'video/3gpp2':      { ext: '3g2',  family: 'iso' },
  'video/webm':       { ext: 'webm', family: 'matroska' },
  'video/x-matroska': { ext: 'mkv',  family: 'matroska' },
}
const VIDEO_KEY_EXT = /\.(mp4|mov|m4v|3gp|3g2|webm|mkv)$/
const MAX_VIDEO_SIZE = 500 * 1024 * 1024        // a 60 s 4K phone clip is ~170–400 MB
const MAX_VIDEO_SECONDS = 60
const VIDEO_UPLOAD_URL_TTL = 15 * 60            // presigned PUT lifetime (seconds)
const VIDEO_VERIFIED_TTL = 7 * 24 * 60 * 60     // how long a verified upload can be attached

// ── DB row / body types ───────────────────────────────────────────────────────


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
  video: string | null
  status: string
  agent_phone: string | null
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
  /** Omitted = leave the listing's video unchanged (older clients); null = remove it. */
  video?: { url: string; key: string } | null
  agentPhone?: string | null
}

interface ReportRow {
  id: string
  target_type: string
  target_id: string
  reporter_uid: string
  reporter_email: string | null
  reason: string
  details: string | null
  status: string
  created_at: number
  resolved_at: number | null
  resolved_by: string | null
}

// ── Entry point ───────────────────────────────────────────────────────────────

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    await env.DB.prepare('DELETE FROM notifications WHERE created_at < ?')
      .bind(oneWeekAgo).run()
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('Origin') ?? ''

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) })
    }

    const { pathname } = new URL(request.url)

    try {
      if (request.method === 'POST' && pathname === '/video/upload-url') {
        return handleVideoUploadUrl(request, env, origin)
      }
      if (request.method === 'POST' && pathname === '/video/complete') {
        return handleVideoComplete(request, env, origin)
      }
      if (request.method === 'POST' && pathname === '/upload') {
        return await handleUpload(request, env, origin)
      }
      if (request.method === 'DELETE' && pathname.startsWith('/image/')) {
        return await handleImageDelete(request, env, origin, pathname.slice(7))
      }
      if (pathname === '/listings' && request.method === 'GET') {
        return await handleGetAllListings(request, env, origin, ctx)
      }
      if (pathname === '/listing') {
        if (request.method === 'GET')    return await handleGetListing(request, env, origin)
        if (request.method === 'POST')   return await handleUpsertListing(request, env, origin)
        if (request.method === 'DELETE') return await handleDeleteListing(request, env, origin)
      }
      if (pathname === '/listing/view' && request.method === 'POST') {
        return await handleIncrementView(request, env, origin, ctx)
      }
      if (pathname === '/favorites') {
        if (request.method === 'GET') return await handleGetFavorites(request, env, origin)
        if (request.method === 'PUT') return await handleSetFavorites(request, env, origin)
        if (request.method === 'PATCH') return await handlePatchFavorite(request, env, origin)
      }
      if (pathname === '/push-token' && request.method === 'POST') {
        return await handleRegisterPushToken(request, env, origin)
      }
      if (pathname === '/saved-search' && request.method === 'POST') {
        return await handleSaveSavedSearch(request, env, origin)
      }
      if (pathname === '/notifications' && request.method === 'GET') {
        return await handleGetNotifications(request, env, origin)
      }
      if (pathname === '/notifications/read' && request.method === 'PATCH') {
        return await handleMarkNotificationsRead(request, env, origin)
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
      if (pathname === '/report' && request.method === 'POST') {
        return await handleCreateReport(request, env, origin)
      }
      if (pathname === '/admin/reports' && request.method === 'GET') {
        return await handleAdminGetReports(request, env, origin)
      }
      if (pathname.startsWith('/admin/reports/') && request.method === 'PATCH') {
        return await handleAdminUpdateReport(request, env, origin, pathname)
      }
      if (pathname === '/legal' && request.method === 'GET') {
        return await handleGetLegal(request, env, origin, ctx)
      }
      if (pathname === '/admin/legal') {
        if (request.method === 'GET') return await handleAdminGetLegal(request, env, origin)
        if (request.method === 'PUT') return await handleAdminPutLegal(request, env, origin)
      }
      if (pathname === '/app-version' && request.method === 'GET') {
        return await handleGetAppVersion(request, env, origin)
      }
      if (pathname === '/admin/app-config') {
        if (request.method === 'GET')   return await handleAdminGetAppConfig(request, env, origin)
        if (request.method === 'PATCH') return await handleAdminPatchAppConfig(request, env, origin)
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

const AGENT_UIDS_KEY = 'agent_uids'

// Agent membership changes rarely, but the public /listings endpoint needs it on
// every request to set the `isAgent` flag. Cache the set in edge-local KV instead
// of doing a full-table scan against the (single-region) D1 on each read. The key
// is invalidated in handleAddAgent/handleRemoveAgent so promotions take effect at once.
async function getAgentUids(env: Env): Promise<Set<string>> {
  const cached = await env.RATE_LIMITER.get(AGENT_UIDS_KEY)
  if (cached) {
    try { return new Set(JSON.parse(cached) as string[]) } catch {}
  }
  const { results } = await env.DB.prepare('SELECT uid FROM agents').all<{ uid: string }>()
  const uids = results.map(r => r.uid)
  env.RATE_LIMITER.put(AGENT_UIDS_KEY, JSON.stringify(uids), { expirationTtl: 300 }).catch(() => {})
  return new Set(uids)
}

// ── Edge cache helpers ────────────────────────────────────────────────────────
// Cache public JSON payloads in the colo-local edge cache (caches.default), keyed
// by an origin-independent URL so per-client CORS headers are never baked into the
// stored entry. On a hit the worker still runs but skips the cross-continent D1
// round-trip — the dominant latency for users far from the D1 primary region.

function edgeCacheKey(name: string): Request {
  return new Request(`https://edge-cache.yevilla.internal/${name}`)
}

async function edgeCacheMatch(key: Request): Promise<string | null> {
  const hit = await caches.default.match(key)
  return hit ? await hit.text() : null
}

function edgeCacheStore(ctx: ExecutionContext, key: Request, body: string, maxAgeSec: number): void {
  const res = new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${maxAgeSec}`,
    },
  })
  ctx.waitUntil(caches.default.put(key, res))
}

// ── Listings: GET all (public) ────────────────────────────────────────────────

async function handleGetAllListings(request: Request, env: Env, origin: string, ctx: ExecutionContext): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  if (!await rateLimit(env, `pub:${ip}`, RATE_LIMITS.read_pub)) {
    return jsonErr(429, 'Too many requests — please slow down', origin, env)
  }

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const limit = 100
  const offset = (page - 1) * limit

  // Serve from the colo-local edge cache when warm — no D1 round-trip. CORS headers
  // are rebuilt per request so every client (web, mobile-web, admin) gets correct ones.
  const cacheKey = edgeCacheKey(`listings-p${page}`)
  const cachedBody = await edgeCacheMatch(cacheKey)
  if (cachedBody !== null) {
    return jsonCached(cachedBody, origin, env)
  }

  const [{ results }, agentUids] = await Promise.all([
    env.DB.prepare('SELECT * FROM listings WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .bind('published', limit + 1, offset).all<ListingRow>(),
    getAgentUids(env),
  ])
  const hasMore = results.length > limit
  const pageResults = hasMore ? results.slice(0, limit) : results

  const body = JSON.stringify({
    listings: pageResults.map(r => ({ ...rowToListing(r, true), isAgent: agentUids.has(r.owner_id) })),
    hasMore,
  })
  edgeCacheStore(ctx, cacheKey, body, 60)
  return jsonCached(body, origin, env)
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

  const listingIds = results.map(r => r.id)
  let likeMap = new Map<string, number>()
  if (listingIds.length > 0) {
    const placeholders = listingIds.map(() => '?').join(',')
    const { results: likeCounts } = await env.DB.prepare(
      `SELECT property_id, COUNT(*) as cnt FROM favorites WHERE property_id IN (${placeholders}) GROUP BY property_id`
    ).bind(...listingIds).all<{ property_id: string; cnt: number }>()
    likeMap = new Map(likeCounts.map(r => [r.property_id, r.cnt]))
  }
  const listings = results.map(r => ({
    ...rowToListing(r, true),
    favoriteCount: likeMap.get(r.id) ?? 0,
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

  // A video can only be attached once /video/complete has verified it (or if it's
  // already this listing's video) — so a client can't skip the length check.
  if (body.video) {
    if (!body.video.key.startsWith(`listings/${uid}/`)) return jsonErr(403, 'Forbidden', origin, env)
    const existingId = listingId ?? (agent ? null : uid)
    const current = existingId
      ? await env.DB.prepare('SELECT video FROM listings WHERE id = ? AND owner_id = ?')
          .bind(existingId, uid).first<{ video: string | null }>()
      : null
    const currentKey = current?.video ? safeParseJSON<{ key?: string } | null>(current.video, null)?.key : undefined
    if (body.video.key !== currentKey && !(await env.RATE_LIMITER.get(`video-verified:${body.video.key}`))) {
      return jsonErr(400, 'That video has not been verified — please upload it again', origin, env)
    }
  }

  // Id of a listing an agent creates in this request (set below)
  let insertedId: string | null = null

  // Capture existing listing data before any edit so we can detect price drops
  let oldListingBeforeEdit: ReturnType<typeof rowToListing> | null = null

  if (listingId) {
    // Edit mode: update an existing listing — verify ownership
    const existing = await env.DB.prepare(
      'SELECT id, status FROM listings WHERE id = ? AND owner_id = ?'
    ).bind(listingId, uid).first<{ id: string; status: string }>()

    if (!existing) return jsonErr(404, 'Listing not found', origin, env)

    // Snapshot before update so we can detect a price drop after saving
    const oldRow = await env.DB.prepare('SELECT * FROM listings WHERE id = ?')
      .bind(listingId).first<ListingRow>()
    if (oldRow) oldListingBeforeEdit = rowToListing(oldRow, false)

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
        agent_phone        = ?,
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
      body.agentPhone ?? null,
      newStatus,
      now,
      listingId, uid,
    ).run()
  } else if (agent) {
    // Agent create mode: always insert a new listing, auto-publish
    const newId = crypto.randomUUID()
    insertedId = newId
    await env.DB.prepare(`
      INSERT INTO listings (
        id, owner_id, owner_email, owner_display_name, owner_photo_url,
        city, sub_city, woreda, kebele, landmark,
        lat, lng, property_type,
        listing_type, monthly_rent, sale_price,
        bedrooms, bathrooms, area_sqm, available_from,
        description, amenities, photos, agent_phone,
        status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
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
      body.agentPhone ?? null,
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
        description, amenities, photos, agent_phone,
        status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
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
        agent_phone        = excluded.agent_phone,
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
      body.agentPhone ?? null,
      now, now,
    ).run()
  }

  // Video is only written when the client sends the field, so clients that don't
  // know about videos (e.g. older mobile builds) never wipe an existing one.
  if (body.video !== undefined) {
    const videoTarget = listingId ?? insertedId ?? uid
    const prev = await env.DB.prepare('SELECT video FROM listings WHERE id = ? AND owner_id = ?')
      .bind(videoTarget, uid).first<{ video: string | null }>()
    await env.DB.prepare('UPDATE listings SET video = ? WHERE id = ? AND owner_id = ?')
      .bind(body.video ? JSON.stringify(body.video) : null, videoTarget, uid).run()
    // Remove the replaced/removed video from R2
    const prevKey = prev?.video ? safeParseJSON<{ key?: string } | null>(prev.video, null)?.key : undefined
    if (prevKey && prevKey !== body.video?.key && prevKey.startsWith(`listings/${uid}/`)) {
      await env.GOJO_LISTINGS.delete(prevKey).catch(() => {})
    }
  }

  // Persist agent phone in agents table so all their listings have it without re-saving
  if (agent && body.agentPhone) {
    await env.DB.prepare(
      'UPDATE agents SET phone = ? WHERE uid = ?'
    ).bind(body.agentPhone, uid).run()
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

  const savedListing = rowToListing(saved, true)

  // Notification #3: new published listing → match against saved searches
  if (!listingId && saved.status === 'published') {
    notifyMatchingSavedSearches(savedListing, env).catch(() => {})
  }

  // Notification #4: price dropped on an edited listing
  if (listingId && oldListingBeforeEdit) {
    notifyPriceDrop(oldListingBeforeEdit, savedListing, env).catch(() => {})
  }

  return json(savedListing, 200, origin, env)
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
    'SELECT id, photos, video FROM listings WHERE id = ? AND owner_id = ?'
  ).bind(listingId, uid).first<Pick<ListingRow, 'id' | 'photos' | 'video'>>()

  if (!row) return jsonErr(404, 'Listing not found', origin, env)

  await Promise.allSettled(listingMediaKeys(row).map(k => env.GOJO_LISTINGS.delete(k)))

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

// ── Video upload (direct to R2) ───────────────────────────────────────────────
// 1. POST /video/upload-url  → presigned PUT URL for listings/<uid>/<uuid>.<ext>,
//    locked to the declared content type and exact byte size.
// 2. The browser PUTs the file straight to R2.
// 3. POST /video/complete    → the worker checks the stored file's signature and
//    length; failures are deleted, successes are marked verified for attaching.

async function handleVideoUploadUrl(request: Request, env: Env, origin: string): Promise<Response> {
  const uid = await authenticate(request, env)
  if (!uid) return jsonErr(401, 'Unauthorized', origin, env)

  if (!await rateLimit(env, `upload:${uid}`, RATE_LIMITS.upload)) {
    return jsonErr(429, 'Upload limit reached — please wait a minute', origin, env)
  }
  if (!env.R2_ACCOUNT_ID || !env.R2_BUCKET_NAME || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    return jsonErr(503, 'Video uploads are not configured yet', origin, env)
  }

  let body: { contentType?: unknown; size?: unknown }
  try { body = await request.json() as typeof body }
  catch { return jsonErr(400, 'Invalid JSON body', origin, env) }

  const contentType = typeof body.contentType === 'string' ? body.contentType.toLowerCase() : ''
  const spec = ALLOWED_VIDEO_TYPES[contentType]
  if (!spec) return jsonErr(400, 'Unsupported video format — use MP4, MOV, 3GP, WebM, or MKV', origin, env)

  const size = Number(body.size)
  if (!Number.isInteger(size) || size <= 0) return jsonErr(400, 'Invalid file size', origin, env)
  if (size > MAX_VIDEO_SIZE) return jsonErr(413, 'Video exceeds the 500 MB limit', origin, env)

  const key = `listings/${uid}/${crypto.randomUUID()}.${spec.ext}`
  const uploadUrl = await presignR2Put(env, key, contentType, size, VIDEO_UPLOAD_URL_TTL)
  return json({ uploadUrl, key, contentType }, 200, origin, env)
}

async function handleVideoComplete(request: Request, env: Env, origin: string): Promise<Response> {
  const uid = await authenticate(request, env)
  if (!uid) return jsonErr(401, 'Unauthorized', origin, env)

  if (!await rateLimit(env, `write:${uid}`, RATE_LIMITS.write)) {
    return jsonErr(429, 'Too many requests — please slow down', origin, env)
  }

  let body: { key?: unknown }
  try { body = await request.json() as typeof body }
  catch { return jsonErr(400, 'Invalid JSON body', origin, env) }

  const key = typeof body.key === 'string' ? body.key : ''
  if (!key.startsWith(`listings/${uid}/`) || key.includes('..') || key.includes('//') || !VIDEO_KEY_EXT.test(key)) {
    return jsonErr(400, 'Invalid key', origin, env)
  }

  const head = await env.GOJO_LISTINGS.head(key)
  if (!head) return jsonErr(404, 'Upload not found — please try again', origin, env)

  const reject = async (message: string) => {
    await env.GOJO_LISTINGS.delete(key).catch(() => {})
    return jsonErr(400, message, origin, env)
  }

  const spec = ALLOWED_VIDEO_TYPES[(head.httpMetadata?.contentType ?? '').toLowerCase()]
  if (!spec || !key.endsWith(`.${spec.ext}`)) return reject('Unsupported video format')
  if (head.size > MAX_VIDEO_SIZE) return reject('Video exceeds the 500 MB limit')

  const first = await env.GOJO_LISTINGS.get(key, { range: { offset: 0, length: 12 } })
  const magic = first ? new Uint8Array(await first.arrayBuffer()) : new Uint8Array()
  if (!isAllowedVideoMagic(magic, spec.family)) return reject('File content does not match its declared type')

  const seconds = await readVideoDurationSeconds(env.GOJO_LISTINGS, key, head.size, spec.family).catch(() => null)
  if (seconds === null) return reject('Could not read the video length — please try a different file')
  if (seconds > MAX_VIDEO_SECONDS + 0.5) {
    return reject(`Video is ${Math.round(seconds)} seconds long — the limit is ${MAX_VIDEO_SECONDS} seconds`)
  }

  await env.RATE_LIMITER.put(`video-verified:${key}`, '1', { expirationTtl: VIDEO_VERIFIED_TTL })
  return json({ key, url: `${env.R2_PUBLIC_URL}/${key}`, seconds: Math.round(seconds * 10) / 10 }, 200, origin, env)
}

function readVideoDurationSeconds(bucket: R2Bucket, key: string, fileSize: number, family: VideoFamily): Promise<number | null> {
  return family === 'iso'
    ? readMp4DurationSeconds(bucket, key, fileSize)
    : readMatroskaDurationSeconds(bucket, key, fileSize)
}

// ── R2 presigned URLs (AWS Signature V4, query-string auth) ──────────────────

function encodeRfc3986(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data))
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Builds a SigV4 presigned URL. `headers` (plus host) must be sent exactly as signed. */
async function presignUrl(o: {
  method: string
  host: string
  path: string
  headers: Record<string, string>
  accessKeyId: string
  secretAccessKey: string
  region: string
  service: string
  expiresIn: number
  now: Date
}): Promise<string> {
  const amzDate = o.now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const date = amzDate.slice(0, 8)
  const scope = `${date}/${o.region}/${o.service}/aws4_request`

  const headers: Record<string, string> = { host: o.host }
  for (const [k, v] of Object.entries(o.headers)) headers[k.toLowerCase()] = v.trim()
  const headerNames = Object.keys(headers).sort()
  const signedHeaders = headerNames.join(';')

  const canonicalQuery = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${o.accessKeyId}/${scope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(o.expiresIn)],
    ['X-Amz-SignedHeaders', signedHeaders],
  ]
    .map(([k, v]) => [encodeRfc3986(k), encodeRfc3986(v)])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')

  const canonicalRequest = [
    o.method,
    o.path,
    canonicalQuery,
    headerNames.map(k => `${k}:${headers[k]}\n`).join(''),
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRequest))),
  ].join('\n')

  let signingKey = await hmacSha256(new TextEncoder().encode(`AWS4${o.secretAccessKey}`), date)
  signingKey = await hmacSha256(signingKey, o.region)
  signingKey = await hmacSha256(signingKey, o.service)
  signingKey = await hmacSha256(signingKey, 'aws4_request')
  const signature = toHex(await hmacSha256(signingKey, stringToSign))

  return `https://${o.host}${o.path}?${canonicalQuery}&X-Amz-Signature=${signature}`
}

function presignR2Put(env: Env, key: string, contentType: string, size: number, expiresIn: number): Promise<string> {
  return presignUrl({
    method: 'PUT',
    host: `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    path: `/${env.R2_BUCKET_NAME}/${key.split('/').map(encodeRfc3986).join('/')}`,
    headers: { 'content-type': contentType, 'content-length': String(size) },
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    region: 'auto',
    service: 's3',
    expiresIn,
    now: new Date(),
  })
}

/**
 * Reads a WebM/MKV duration from the Segment > Info element near the start of
 * the file (Duration × TimecodeScale). Returns null when absent — e.g. live
 * recordings written without a duration.
 */
async function readMatroskaDurationSeconds(bucket: R2Bucket, key: string, fileSize: number): Promise<number | null> {
  const obj = await bucket.get(key, { range: { offset: 0, length: Math.min(fileSize, 512 * 1024) } })
  if (!obj) return null
  const v = new DataView(await obj.arrayBuffer())
  const len = v.byteLength

  // EBML variable-length integers: the leading 1-bit marks the width.
  const vintWidth = (first: number) => { for (let n = 1; n <= 8; n++) if (first & (0x80 >> (n - 1))) return n; return 0 }
  const readId = (p: number) => {
    const w = vintWidth(v.getUint8(p))
    if (!w || w > 4 || p + w > len) return null
    let id = 0
    for (let i = 0; i < w; i++) id = id * 256 + v.getUint8(p + i)
    return { id, next: p + w }
  }
  const readSize = (p: number) => {
    const first = v.getUint8(p)
    const w = vintWidth(first)
    if (!w || p + w > len) return null
    let size = first & (0xff >> w)
    let allOnes = size === (0xff >> w)
    for (let i = 1; i < w; i++) {
      const b = v.getUint8(p + i)
      size = size * 256 + b
      if (b !== 0xff) allOnes = false
    }
    return { size: allOnes ? -1 : size, next: p + w } // -1 = unknown size
  }
  const readUint = (p: number, n: number) => { let x = 0; for (let i = 0; i < n; i++) x = x * 256 + v.getUint8(p + i); return x }

  let p = 0
  const ebml = readId(p)
  if (!ebml || ebml.id !== 0x1A45DFA3) return null
  const ebmlSize = readSize(ebml.next)
  if (!ebmlSize || ebmlSize.size < 0) return null
  p = ebmlSize.next + ebmlSize.size

  const seg = p < len ? readId(p) : null
  if (!seg || seg.id !== 0x18538067) return null
  const segSize = readSize(seg.next)
  if (!segSize) return null
  p = segSize.next
  const segEnd = segSize.size < 0 ? len : Math.min(len, segSize.next + segSize.size)

  while (p < segEnd) {
    const el = readId(p)
    if (!el) return null
    const sz = readSize(el.next)
    if (!sz) return null
    if (el.id === 0x1549A966) { // Info
      const end = sz.size < 0 ? segEnd : Math.min(segEnd, sz.next + sz.size)
      let q = sz.next
      let timecodeScale = 1_000_000 // default: 1 ms
      let duration: number | null = null
      while (q < end) {
        const c = readId(q)
        if (!c) break
        const cs = readSize(c.next)
        if (!cs || cs.size < 0 || cs.next + cs.size > len) break
        if (c.id === 0x2AD7B1) timecodeScale = readUint(cs.next, cs.size)
        if (c.id === 0x4489) duration = cs.size === 4 ? v.getFloat32(cs.next) : cs.size === 8 ? v.getFloat64(cs.next) : null
        q = cs.next + cs.size
      }
      return duration !== null && duration > 0 ? (duration * timecodeScale) / 1e9 : null
    }
    if (sz.size < 0) return null // an unknown-size element (e.g. a Cluster) before Info
    p = sz.next + sz.size
  }
  return null
}

/**
 * Reads an MP4/MOV duration without downloading the whole file. Walks the
 * top-level boxes with small ranged reads:
 *  - regular files: `moov/mvhd` holds timescale + duration (moov may sit at the end);
 *  - fragmented files (mvhd duration 0): sums each track's sample durations across
 *    the `moof/traf/trun` fragments, using the track's `mdhd` timescale.
 * Returns null when no duration can be determined.
 */
async function readMp4DurationSeconds(bucket: R2Bucket, key: string, fileSize: number): Promise<number | null> {
  const read = async (offset: number, length: number): Promise<DataView | null> => {
    const obj = await bucket.get(key, { range: { offset, length } })
    if (!obj) return null
    return new DataView(await obj.arrayBuffer())
  }
  const fourcc = (v: DataView, at: number) =>
    String.fromCharCode(v.getUint8(at), v.getUint8(at + 1), v.getUint8(at + 2), v.getUint8(at + 3))

  // Child boxes of a box whose payload spans [start, end) within `v`.
  function* children(v: DataView, start: number, end: number) {
    let p = start
    while (p + 8 <= end) {
      let size = v.getUint32(p)
      let header = 8
      if (size === 1) {
        if (p + 16 > end) return
        size = Number(v.getBigUint64(p + 8))
        header = 16
      } else if (size === 0) {
        size = end - p
      }
      if (size < header || p + size > end) return
      yield { type: fourcc(v, p + 4), body: p + header, end: p + size }
      p += size
    }
  }
  const find = (v: DataView, start: number, end: number, type: string) => {
    for (const c of children(v, start, end)) if (c.type === type) return c
    return null
  }

  const trackTimescale = new Map<number, number>()      // track_ID → mdhd timescale
  const trackDefaultDuration = new Map<number, number>() // track_ID → trex default_sample_duration
  const fragmentTicks = new Map<number, number>()        // track_ID → summed sample durations
  let fragmented = false

  let offset = 0
  for (let i = 0; i < 1000 && offset + 8 <= fileSize; i++) {
    const head = await read(offset, Math.min(16, fileSize - offset))
    if (!head || head.byteLength < 8) return null
    let boxSize = head.getUint32(0)
    if (boxSize === 1) {
      if (head.byteLength < 16) return null
      boxSize = Number(head.getBigUint64(8))
    } else if (boxSize === 0) {
      boxSize = fileSize - offset
    }
    if (boxSize < 8) return null
    const type = fourcc(head, 4)

    if (type === 'moov' || type === 'moof') {
      if (boxSize > 16 * 1024 * 1024) return null
      const v = await read(offset, boxSize)
      if (!v) return null
      const top = children(v, 0, v.byteLength).next().value
      if (!top) return null

      if (type === 'moov') {
        const mvhd = find(v, top.body, top.end, 'mvhd')
        if (mvhd) {
          const b = mvhd.body
          const v1 = v.getUint8(b) === 1
          const timescale = v.getUint32(b + (v1 ? 20 : 12))
          const duration = v1 ? Number(v.getBigUint64(b + 24)) : v.getUint32(b + 16)
          if (timescale && duration) return duration / timescale
        }
        for (const trak of children(v, top.body, top.end)) {
          if (trak.type !== 'trak') continue
          const tkhd = find(v, trak.body, trak.end, 'tkhd')
          const mdia = find(v, trak.body, trak.end, 'mdia')
          const mdhd = mdia && find(v, mdia.body, mdia.end, 'mdhd')
          if (!tkhd || !mdhd) continue
          const trackId = v.getUint32(tkhd.body + (v.getUint8(tkhd.body) === 1 ? 20 : 12))
          trackTimescale.set(trackId, v.getUint32(mdhd.body + (v.getUint8(mdhd.body) === 1 ? 20 : 12)))
        }
        const mvex = find(v, top.body, top.end, 'mvex')
        if (mvex) {
          fragmented = true
          for (const trex of children(v, mvex.body, mvex.end)) {
            if (trex.type === 'trex') trackDefaultDuration.set(v.getUint32(trex.body + 4), v.getUint32(trex.body + 12))
          }
        }
      } else {
        fragmented = true
        for (const traf of children(v, top.body, top.end)) {
          if (traf.type !== 'traf') continue
          const tfhd = find(v, traf.body, traf.end, 'tfhd')
          if (!tfhd) continue
          const tfFlags = v.getUint32(tfhd.body) & 0xffffff
          const trackId = v.getUint32(tfhd.body + 4)
          let q = tfhd.body + 8
          if (tfFlags & 0x01) q += 8 // base_data_offset
          if (tfFlags & 0x02) q += 4 // sample_description_index
          const defaultDuration = tfFlags & 0x08 ? v.getUint32(q) : trackDefaultDuration.get(trackId) ?? 0
          let ticks = 0
          for (const trun of children(v, traf.body, traf.end)) {
            if (trun.type !== 'trun') continue
            const flags = v.getUint32(trun.body) & 0xffffff
            const count = v.getUint32(trun.body + 4)
            let r = trun.body + 8
            if (flags & 0x01) r += 4 // data_offset
            if (flags & 0x04) r += 4 // first_sample_flags
            if (!(flags & 0x100)) { ticks += count * defaultDuration; continue }
            const stride = 4 * [0x100, 0x200, 0x400, 0x800].filter(f => flags & f).length
            for (let n = 0; n < count && r + 4 <= trun.end; n++, r += stride) ticks += v.getUint32(r)
          }
          fragmentTicks.set(trackId, (fragmentTicks.get(trackId) ?? 0) + ticks)
        }
      }
    }
    offset += boxSize
  }

  if (!fragmented) return null
  let longest: number | null = null
  for (const [trackId, ticks] of fragmentTicks) {
    const timescale = trackTimescale.get(trackId)
    if (timescale && ticks) longest = Math.max(longest ?? 0, ticks / timescale)
  }
  return longest
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

async function handleIncrementView(request: Request, env: Env, origin: string, ctx: ExecutionContext): Promise<Response> {
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

  // Fire-and-forget: the view count is non-critical, so don't make the caller wait
  // on a write round-trip to the D1 primary region.
  ctx.waitUntil(env.DB.prepare(
    'UPDATE listings SET view_count = view_count + 1 WHERE id = ?'
  ).bind(body.listingId).run())

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
  ).bind(uid).all<{ property_id: string }>()

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
    .filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 128)

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
  if (typeof body.id !== 'string' || body.id.length === 0 || body.id.length > 128) {
    return jsonErr(400, 'id must be a non-empty string', origin, env)
  }

  if (body.action === 'add') {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO favorites (user_id, property_id) VALUES (?, ?)'
    ).bind(uid, body.id).run()

    // Notify the listing owner (fire-and-forget)
    const listing = await env.DB.prepare(
      'SELECT owner_id, city, property_type FROM listings WHERE id = ?'
    ).bind(body.id).first<{ owner_id: string; city: string; property_type: string }>()
    if (listing && listing.owner_id !== uid) {
      notifyUser(
        env, listing.owner_id,
        'Someone saved your listing',
        `Your ${listing.property_type} in ${listing.city} was added to a buyer's favorites.`,
        body.id as string,
      ).catch(() => {})
    }
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

  const [result, listingRow] = await Promise.all([
    env.DB.prepare('UPDATE listings SET status = ?, updated_at = ? WHERE id = ?')
      .bind(newStatus, Date.now(), body.listingId).run(),
    env.DB.prepare('SELECT owner_id, city, property_type FROM listings WHERE id = ?')
      .bind(body.listingId).first<{ owner_id: string; city: string; property_type: string }>(),
  ])

  if (result.meta.changes === 0) return jsonErr(404, 'Listing not found', origin, env)

  if (listingRow) {
    if (newStatus === 'published') {
      await notifyUser(
        env, listingRow.owner_id,
        'Listing Approved',
        `Your ${listingRow.property_type} in ${listingRow.city} is now live.`,
        body.listingId as string,
      )
    } else {
      await notifyUser(
        env, listingRow.owner_id,
        'Listing Needs Changes',
        `Your ${listingRow.property_type} in ${listingRow.city} was not approved. Tap to review.`,
        body.listingId as string,
      )
    }
  }

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
  env.RATE_LIMITER.delete(AGENT_UIDS_KEY).catch(() => {})

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
  env.RATE_LIMITER.delete(AGENT_UIDS_KEY).catch(() => {})
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
    'SELECT id, photos, video FROM listings WHERE id = ?'
  ).bind(body.id).first<Pick<ListingRow, 'id' | 'photos' | 'video'>>()

  if (!row) return jsonErr(404, 'Listing not found', origin, env)

  await Promise.allSettled(listingMediaKeys(row).map(k => env.GOJO_LISTINGS.delete(k)))
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

// ── Push notifications ────────────────────────────────────────────────────────

async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ to: token, title, body, data, sound: 'default' }),
  }).catch(() => { /* non-fatal */ })
}

async function createNotification(
  env: Env,
  userId: string,
  title: string,
  body: string,
  listingId?: string,
): Promise<void> {
  const id = crypto.randomUUID()
  await env.DB.prepare(
    'INSERT INTO notifications (id, user_id, title, body, listing_id, read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)'
  ).bind(id, userId, title, body, listingId ?? null, Date.now()).run()
}

async function notifyUser(
  env: Env,
  userId: string,
  title: string,
  body: string,
  listingId?: string,
): Promise<void> {
  await createNotification(env, userId, title, body, listingId)
  const token = await env.PUSH_TOKENS.get(userId)
  if (token) {
    await sendPushNotification(token, title, body, listingId ? { listingId } : {})
  }
}

async function handleGetNotifications(request: Request, env: Env, origin: string): Promise<Response> {
  const uid = await authenticate(request, env)
  if (!uid) return jsonErr(401, 'Unauthorized', origin, env)

  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

  // Purge expired notifications (fire-and-forget)
  env.DB.prepare('DELETE FROM notifications WHERE user_id = ? AND created_at < ?')
    .bind(uid, oneWeekAgo).run().catch(() => {})

  const { results } = await env.DB.prepare(
    'SELECT id, title, body, listing_id, read, created_at FROM notifications WHERE user_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 50'
  ).bind(uid, oneWeekAgo).all<{
    id: string; title: string; body: string
    listing_id: string | null; read: number; created_at: number
  }>()

  return json(results.map(r => ({
    id: r.id,
    title: r.title,
    body: r.body,
    listingId: r.listing_id,
    read: r.read === 1,
    createdAt: r.created_at,
  })), 200, origin, env)
}

async function handleMarkNotificationsRead(request: Request, env: Env, origin: string): Promise<Response> {
  const uid = await authenticate(request, env)
  if (!uid) return jsonErr(401, 'Unauthorized', origin, env)

  let body: { ids?: unknown }
  try { body = await request.json() as { ids?: unknown } }
  catch { return jsonErr(400, 'Invalid JSON', origin, env) }

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    // Mark specific notifications read
    const ids = (body.ids as unknown[]).filter((id): id is string => typeof id === 'string')
    const placeholders = ids.map(() => '?').join(',')
    await env.DB.prepare(
      `UPDATE notifications SET read = 1 WHERE user_id = ? AND id IN (${placeholders})`
    ).bind(uid, ...ids).run()
  } else {
    // Mark all read
    await env.DB.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').bind(uid).run()
  }

  return json({ ok: true }, 200, origin, env)
}

async function handleRegisterPushToken(request: Request, env: Env, origin: string): Promise<Response> {
  const uid = await authenticate(request, env)
  if (!uid) return jsonErr(401, 'Unauthorized', origin, env)

  let body: { token: unknown }
  try { body = await request.json() as { token: unknown } }
  catch { return jsonErr(400, 'Invalid JSON', origin, env) }

  if (typeof body.token !== 'string' || !body.token.startsWith('ExponentPushToken[')) {
    return jsonErr(400, 'Invalid push token', origin, env)
  }

  await env.PUSH_TOKENS.put(uid, body.token)
  return json({ ok: true }, 200, origin, env)
}

async function handleSaveSavedSearch(request: Request, env: Env, origin: string): Promise<Response> {
  const uid = await authenticate(request, env)
  if (!uid) return jsonErr(401, 'Unauthorized', origin, env)

  let body: { city?: unknown; listingType?: unknown; propertyType?: unknown; minBeds?: unknown; maxPrice?: unknown }
  try { body = await request.json() as typeof body }
  catch { return jsonErr(400, 'Invalid JSON', origin, env) }

  const search = {
    city:         typeof body.city === 'string' ? body.city.trim() : undefined,
    listingType:  typeof body.listingType === 'string' ? body.listingType : 'all',
    propertyType: typeof body.propertyType === 'string' ? body.propertyType : undefined,
    minBeds:      typeof body.minBeds === 'number' ? body.minBeds : undefined,
    maxPrice:     typeof body.maxPrice === 'string' ? body.maxPrice : undefined,
  }

  await env.SAVED_SEARCHES.put(uid, JSON.stringify([search]))
  return json({ ok: true }, 200, origin, env)
}

async function notifyMatchingSavedSearches(
  listing: ReturnType<typeof rowToListing>,
  env: Env,
): Promise<void> {
  const { keys } = await env.SAVED_SEARCHES.list()
  await Promise.allSettled(
    keys.map(async ({ name: uid }) => {
      if (uid === listing.id) return // listing.id === owner_id for regular users
      const raw = await env.SAVED_SEARCHES.get(uid)
      if (!raw) return
      const searches = safeParseJSON<Array<{
        city?: string; listingType?: string; propertyType?: string
        minBeds?: number; maxPrice?: string
      }>>(raw, [])
      const matches = searches.some((s) => {
        if (s.city && !listing.city.toLowerCase().includes(s.city.toLowerCase())) return false
        if (s.listingType && s.listingType !== 'all' && listing.listingType !== s.listingType) return false
        if (s.propertyType && listing.propertyType !== s.propertyType) return false
        if (s.minBeds && (listing.bedrooms ?? 0) < s.minBeds) return false
        const price = listing.listingType === 'rent' ? listing.monthlyRent : listing.salePrice
        if (s.maxPrice && price && price > Number(s.maxPrice)) return false
        return true
      })
      if (!matches) return
      const priceStr = listing.listingType === 'rent'
        ? `ETB ${listing.monthlyRent?.toLocaleString()}/mo`
        : `ETB ${listing.salePrice?.toLocaleString()}`
      await notifyUser(
        env, uid,
        'New listing matches your search',
        `${listing.propertyType} in ${listing.city} — ${priceStr}`,
        listing.id,
      )
    }),
  )
}

async function notifyPriceDrop(
  oldListing: ReturnType<typeof rowToListing>,
  newListing: ReturnType<typeof rowToListing>,
  env: Env,
): Promise<void> {
  const oldPrice = oldListing.listingType === 'rent' ? oldListing.monthlyRent : oldListing.salePrice
  const newPrice = newListing.listingType === 'rent' ? newListing.monthlyRent : newListing.salePrice
  if (!oldPrice || !newPrice || newPrice >= oldPrice) return

  const { results } = await env.DB.prepare(
    'SELECT user_id FROM favorites WHERE property_id = ?'
  ).bind(newListing.id).all<{ user_id: string }>()

  const priceStr = newListing.listingType === 'rent'
    ? `ETB ${newPrice.toLocaleString()}/mo`
    : `ETB ${newPrice.toLocaleString()}`

  await Promise.allSettled(
    results.map(async ({ user_id }) => {
      if (user_id === newListing.id) return // don't notify owner
      await notifyUser(
        env, user_id,
        'Price drop on a saved listing',
        `Now ${priceStr} — ${newListing.propertyType} in ${newListing.city}`,
        newListing.id,
      )
    }),
  )
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
  if (cached) return jsonCached(cached, origin, env, 3600)

  const row = await env.DB.prepare(
    'SELECT phone, email, address, office_hours FROM contact_info WHERE id = 1'
  ).first<ContactRow>()

  const data = row ?? { phone: null, email: null, address: null, office_hours: null }
  const body = JSON.stringify(data)
  env.RATE_LIMITER.put('contact_info', body, { expirationTtl: 3600 }).catch(() => {})

  return jsonCached(body, origin, env, 3600)
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

// Verify a Cloudflare Turnstile token against the siteverify API. Returns false
// on any error so a failed verification can never fall through to "allowed".
async function verifyTurnstile(token: string, ip: string, secret: string): Promise<boolean> {
  if (!secret || !token) return false
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}

async function handleSubmitForm(request: Request, env: Env, origin: string): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  if (!await rateLimit(env, `email:${ip}`, RATE_LIMITS.email)) {
    return jsonErr(429, 'Too many submissions — please slow down', origin, env)
  }

  let body: { type?: unknown; fields?: unknown; token?: unknown; company?: unknown }
  try { body = await request.json() } catch { return jsonErr(400, 'Invalid JSON', origin, env) }

  // Honeypot: the hidden "company" field is invisible to humans. Any value means
  // a bot filled it in — silently accept so the bot can't detect the trap, but
  // never send the email.
  if (typeof body.company === 'string' && body.company.trim() !== '') {
    return json({ ok: true }, 200, origin, env)
  }

  // Anti-bot gate. Browsers always send an Origin header → require a Cloudflare
  // Turnstile token. Native app clients (Expo) send no Origin → require a valid
  // Firebase JWT instead (unforgeable, signed by Google; the app uses an
  // anonymous sign-in for logged-out users). Both branches are unspoofable: a bot
  // can neither pass Turnstile by sending an Origin, nor pass the JWT check by
  // omitting one.
  if (request.headers.get('Origin')) {
    const token = typeof body.token === 'string' ? body.token : ''
    if (!await verifyTurnstile(token, ip, env.TURNSTILE_SECRET)) {
      return jsonErr(403, 'Verification failed — please try again', origin, env)
    }
  } else {
    const authz = request.headers.get('Authorization') ?? ''
    const jwt = authz.startsWith('Bearer ') ? authz.slice(7) : ''
    const uid = jwt ? await verifyFirebaseToken(jwt, env.FIREBASE_PROJECT_ID) : null
    if (!uid) {
      return jsonErr(403, 'Verification failed — please try again', origin, env)
    }
  }

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
  if (body.listingType === 'sale' && (body.propertyType === 'Hotel' || body.propertyType === 'Event Venue')) {
    errors.push('Hotels and event venues can only be listed for rent')
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

  if (body.video != null) {
    const v = body.video
    if (typeof v?.url !== 'string' || typeof v?.key !== 'string') {
      errors.push('video must have url and key fields')
    } else if (!v.url.startsWith(`${env.R2_PUBLIC_URL}/listings/`) || v.url !== `${env.R2_PUBLIC_URL}/${v.key}`) {
      errors.push('Invalid video URL — must be hosted in the Gojo R2 bucket')
    } else if (v.key.includes('..') || v.key.includes('//') || !VIDEO_KEY_EXT.test(v.key)) {
      errors.push('Invalid video key')
    }
  }

  return errors
}

// ── Video magic-byte check ────────────────────────────────────────────────────

function isAllowedVideoMagic(b: Uint8Array, family: VideoFamily): boolean {
  if (b.length < 8) return false
  if (family === 'iso') {
    // MP4 / MOV / 3GP: the file starts with a box whose type (bytes 4–7) is one of these
    const type = String.fromCharCode(b[4], b[5], b[6], b[7])
    return ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip', 'pnot'].includes(type)
  }
  // WebM / Matroska: EBML header 1A 45 DF A3
  return b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3
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

/** Every R2 object a listing owns (photos + optional video), for cleanup on delete. */
function listingMediaKeys(row: Pick<ListingRow, 'photos' | 'video'>): string[] {
  const photos = safeParseJSON<{ key?: string }[]>(row.photos, []).map(p => p.key)
  const video = row.video ? safeParseJSON<{ key?: string } | null>(row.video, null)?.key : undefined
  return [...photos, video].filter((k): k is string => typeof k === 'string' && k.length > 0)
}

function rowToListing(row: ListingRow & { agent_phone_from_agents?: string | null }, includeEmail: boolean) {
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
    video:         row.video ? safeParseJSON<{ url: string; key: string } | null>(row.video, null) : null,
    agentPhone:    row.agent_phone ?? row.agent_phone_from_agents ?? undefined,
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

// ── Reports: POST /report ─────────────────────────────────────────────────────

async function handleCreateReport(request: Request, env: Env, origin: string): Promise<Response> {
  const uid = await authenticate(request, env)
  if (!uid) return jsonErr(401, 'Unauthorized', origin, env)

  if (!await rateLimit(env, `write:${uid}`, RATE_LIMITS.write)) {
    return jsonErr(429, 'Too many requests — please slow down', origin, env)
  }

  let body: { targetType?: unknown; targetId?: unknown; reason?: unknown; details?: unknown }
  try {
    body = await request.json() as { targetType?: unknown; targetId?: unknown; reason?: unknown; details?: unknown }
  } catch {
    return jsonErr(400, 'Invalid JSON body', origin, env)
  }

  if (body.targetType !== 'listing' && body.targetType !== 'user') {
    return jsonErr(400, 'targetType must be listing or user', origin, env)
  }
  if (typeof body.targetId !== 'string' || body.targetId.length === 0 || body.targetId.length > 128) {
    return jsonErr(400, 'targetId must be a non-empty string (max 128 chars)', origin, env)
  }
  const validReasons = new Set(['spam', 'misleading', 'unavailable', 'copyright'])
  if (typeof body.reason !== 'string' || !validReasons.has(body.reason)) {
    return jsonErr(400, 'reason must be one of: spam, misleading, unavailable, copyright', origin, env)
  }

  const details = typeof body.details === 'string'
    ? body.details.trim().slice(0, 500) || null
    : null

  const id = crypto.randomUUID()
  const now = Date.now()

  await env.DB.prepare(`
    INSERT INTO reports (id, target_type, target_id, reporter_uid, reporter_email, reason, details, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `).bind(id, body.targetType, body.targetId, uid, null, body.reason, details, now).run()

  return json({ ok: true, id }, 201, origin, env)
}

// ── Admin: GET /admin/reports ─────────────────────────────────────────────────

async function handleAdminGetReports(request: Request, env: Env, origin: string): Promise<Response> {
  const secret = request.headers.get('X-Admin-Secret')
  if (!secret || secret !== env.ADMIN_SECRET) return jsonErr(401, 'Unauthorized', origin, env)

  const url = new URL(request.url)
  const statusParam = url.searchParams.get('status') ?? ''
  const validStatuses = new Set(['pending', 'resolved', 'dismissed'])

  let results: ReportRow[]
  if (statusParam && validStatuses.has(statusParam)) {
    const { results: rows } = await env.DB.prepare(
      'SELECT * FROM reports WHERE status = ? ORDER BY created_at DESC'
    ).bind(statusParam).all<ReportRow>()
    results = rows
  } else {
    const { results: rows } = await env.DB.prepare(
      'SELECT * FROM reports ORDER BY created_at DESC'
    ).all<ReportRow>()
    results = rows
  }

  return json(results, 200, origin, env)
}

// ── Admin: PATCH /admin/reports/:id ──────────────────────────────────────────

async function handleAdminUpdateReport(request: Request, env: Env, origin: string, pathname: string): Promise<Response> {
  const secret = request.headers.get('X-Admin-Secret')
  if (!secret || secret !== env.ADMIN_SECRET) return jsonErr(401, 'Unauthorized', origin, env)

  const reportId = pathname.slice('/admin/reports/'.length)
  if (!reportId) return jsonErr(400, 'Report ID required', origin, env)

  let body: { status?: unknown }
  try {
    body = await request.json() as { status?: unknown }
  } catch {
    return jsonErr(400, 'Invalid JSON body', origin, env)
  }

  if (body.status !== 'resolved' && body.status !== 'dismissed') {
    return jsonErr(400, 'status must be resolved or dismissed', origin, env)
  }

  const resolvedAt = Date.now()
  const result = await env.DB.prepare(
    'UPDATE reports SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ?'
  ).bind(body.status, resolvedAt, 'staff', reportId).run()

  if (result.meta.changes === 0) return jsonErr(404, 'Report not found', origin, env)

  return json({ ok: true }, 200, origin, env)
}

// ── Legal content types ───────────────────────────────────────────────────────

interface LegalSection { title: string; body: string }
interface LegalDoc { effectiveDate: string; sections: LegalSection[] }

// ── Legal content defaults ────────────────────────────────────────────────────

const DEFAULT_GOJO_PRIVACY: LegalDoc = {
  effectiveDate: 'June 1, 2026',
  sections: [
    {
      title: '1. Information We Collect',
      body: 'We collect the following information when you use Yevilla:\n\n• Account information: Your email address and display name when you create an account via Google Sign-In or email magic link.\n• Listing content: Property details you submit, including address, city, property type, pricing, photos, and description.\n• Usage data: Anonymous property view counts are recorded to surface popular listings. No personally identifiable usage data is collected.\n• Browser local storage: Your email address is stored in your browser\'s local storage solely to pre-fill the sign-in email field on return visits. This data never leaves your browser and is not sent to our servers.\n• Rate-limit data: Your IP address is temporarily stored in Cloudflare KV to enforce fair-use rate limits. This data expires automatically and is not linked to your account.',
    },
    {
      title: '2. How We Use Your Information',
      body: 'We use the information we collect exclusively to operate the platform:\n\n• Operate the platform: Display listings, enable search and filtering, and manage your account.\n• Authenticate you: Verify your identity via Google Sign-In or email magic link.\n• Process listings: Review, approve, and display property listings submitted by users.\n• Respond to inquiries: Reply to messages you send through the Contact page.\n• Prevent abuse: Enforce rate limits and detect fraudulent or harmful activity.\n\nWe do not use your data for advertising, sell your personal information, or share it with data brokers.',
    },
    {
      title: '3. How We Share Your Information',
      body: 'We share your information only in the following limited circumstances:\n\n• Published listings are public: When you publish a listing, its details (property type, price, location, photos, and your display name) are visible to all visitors of the Yevilla website.\n• Service providers: We use the following third-party services solely to operate the platform: Google Firebase (authentication and database), Google Sign-In (OAuth), Apple Sign-In (OAuth where applicable), Mapbox (map rendering and address geocoding), and Cloudflare (hosting, CDN, and rate limiting). These providers are contractually required to protect your data.\n• Legal disclosures: We may disclose your information if required by law, court order, or governmental authority, or if necessary to protect our rights or the safety of others.',
    },
    {
      title: '4. Data Storage and Security',
      body: 'Your account and listing data are stored on Google Firebase servers, which are protected by industry-standard security measures including encryption at rest and in transit (TLS).\n\nListing photos are stored in Cloudflare R2 object storage and served via Cloudflare\'s global CDN. Photos associated with published listings are publicly accessible by URL while the listing is active. When a listing is deleted, its photos are permanently removed from storage.\n\nAll data transmitted between your browser and our servers is encrypted using TLS.',
    },
    {
      title: '5. Cookies and Local Storage',
      body: 'Yevilla does not use tracking cookies or advertising cookies of any kind.\n\nWe use your browser\'s local storage solely to remember your email address for the sign-in form, making it more convenient for you to return. This data is stored only in your browser and is never sent to our servers as part of routine operation. You can clear it at any time by clearing your browser\'s local storage or site data.',
    },
    {
      title: '6. Data Retention',
      body: '• Listing data: Retained until you delete your listing or your account.\n• Saved favorites: Retained until you remove them from your favorites or delete your account.\n• Authentication records: Managed by Google Firebase Authentication and subject to Google\'s data retention policies.\n• Rate-limit KV entries: Automatically expire within a short window (typically 60–120 seconds) and are not retained beyond their purpose.',
    },
    {
      title: '7. Your Rights',
      body: 'You have the following rights regarding your personal information:\n\n• Access: You may request a copy of the personal information we hold about you.\n• Correction: You may update your display name and other account details at any time.\n• Deletion: You may delete your listings and associated photos at any time. To request deletion of your account and all associated data, please contact us via the Contact page on the website.\n• Withdraw consent: You may withdraw your consent to data processing at any time by deleting your account.\n\nTo exercise any of these rights, please use the Contact page on the Yevilla website.',
    },
    {
      title: '8. Children\'s Privacy',
      body: 'Yevilla is not directed to or intended for use by individuals under the age of 18. We do not knowingly collect personal information from minors. If you believe a minor has provided us with personal information, please contact us via the Contact page and we will take steps to delete it.',
    },
    {
      title: '9. Changes to This Policy',
      body: 'We may update this Privacy Policy from time to time to reflect changes to our practices or for other operational, legal, or regulatory reasons. We will indicate the effective date of the current version at the top of this policy. Your continued use of Yevilla after any changes constitutes your acceptance of the updated policy.',
    },
    {
      title: '10. Contact',
      body: 'If you have questions or concerns about this Privacy Policy or how we handle your data, please reach out to us via the Contact page on the Yevilla website.',
    },
  ],
}

const DEFAULT_GOJO_TERMS: LegalDoc = {
  effectiveDate: 'June 1, 2026',
  sections: [
    {
      title: '1. About Yevilla',
      body: 'Yevilla is an online marketplace for Ethiopian real estate. It allows users to browse, search, and connect with property owners and verified agents offering properties for rent or sale across Ethiopia. Yevilla is a listing platform only — we are not a real estate agent, broker, buyer, seller, landlord, or tenant in any transaction, and we are not a party to any agreement between users.\n\nBy using Yevilla, you agree to these Terms of Service. If you do not agree, you must not use the platform.',
    },
    {
      title: '2. Eligibility',
      body: 'To use Yevilla, you must:\n\n• Be at least 18 years of age.\n• Have the legal capacity to enter into a binding agreement under Ethiopian law.\n• Provide accurate, truthful, and current information when registering and using the platform.\n\nBy using the platform, you represent and warrant that you meet these requirements.',
    },
    {
      title: '3. User Accounts',
      body: 'You may sign in using Google Sign-In or an email magic link. You are responsible for maintaining the confidentiality of your account and for all activity that occurs under it.\n\n• One account per person: You may maintain only one account. Creating multiple accounts to circumvent restrictions or bans is prohibited.\n• Security: You agree to notify us promptly if you become aware of any unauthorized access to or use of your account.\n• Accuracy: You agree to keep your account information accurate and up to date.',
    },
    {
      title: '4. Listings and Content',
      body: 'By submitting a listing, you represent and warrant that:\n\n• You are the property owner or the owner\'s authorized representative with the right to list the property.\n• All listing information — including price, location, photos, property details, and availability — is truthful, accurate, and not misleading.\n• Your listing content does not infringe any third party\'s intellectual property rights.\n• Your listing complies with all applicable Ethiopian laws and regulations, including property ownership, rental, and consumer protection laws.\n\nYou must not post listings that are fraudulent, deceptive, discriminatory, or intended to scam other users.',
    },
    {
      title: '5. Prohibited Conduct',
      body: 'You agree not to engage in any of the following:\n\n• Fraud or deception: Posting false, misleading, or fraudulent listings or impersonating another person or entity.\n• Scraping and automation: Using automated tools, bots, or scripts to access, scrape, or extract data from the platform without our written permission.\n• Harassment: Harassing, threatening, or abusing other users.\n• Circumvention: Attempting to bypass any content filters, rate limits, or security measures.\n• Unlawful use: Using the platform for any purpose that violates Ethiopian law or any applicable regulation.\n• Interference: Attempting to disrupt, overload, or compromise the platform\'s infrastructure or security.',
    },
    {
      title: '6. Moderation',
      body: 'We review all listings before they are published. We reserve the right to reject, remove, or unpublish any listing at our sole discretion, including listings that violate these Terms, that we determine are inaccurate or misleading, or that we otherwise consider inappropriate for the platform. We are not obligated to provide a reason for rejection or removal.',
    },
    {
      title: '7. One Listing per Standard User',
      body: 'Standard (non-agent) users may maintain one active listing at a time. This listing is associated with your account. If you submit a new listing, it will replace your existing one after review and approval. Verified agents may manage multiple listings simultaneously.',
    },
    {
      title: '8. Verified Agents',
      body: 'Users may apply to become a verified agent on Yevilla. Approval is at our sole discretion.\n\n• Application: Applicants must provide accurate information, including their full name, email, phone number, license number, years of experience, specialization, and service areas.\n• Responsibilities: Verified agents are responsible for the accuracy of all listings they manage and must comply with all applicable Ethiopian real estate licensing laws and professional conduct standards.\n• Revocation: We reserve the right to revoke agent status at any time for violations of these Terms, misrepresentation in the application, or conduct that we determine is harmful to users or the platform.',
    },
    {
      title: '9. Intellectual Property',
      body: 'The Yevilla name, logo, website design, and all platform software, text, and graphics created by us are our exclusive property and are protected by applicable copyright and trademark law. You may not use them without our prior written permission.\n\nBy submitting listing content (including photos, descriptions, and contact information), you grant us a non-exclusive, royalty-free, worldwide license to store, display, and distribute that content solely for the purpose of operating the platform. You retain all ownership rights in your content. You may remove your content at any time by deleting your listing.',
    },
    {
      title: '10. Disclaimers',
      body: 'We do not verify the accuracy of listings or the identity of users beyond basic authentication. The presence of a listing on Yevilla does not constitute our endorsement, recommendation, or guarantee of that listing or of the user who posted it.\n\nNothing on the platform constitutes legal, financial, or real estate advice. You are solely responsible for conducting your own due diligence before entering into any real estate transaction.\n\nThe platform is provided "as is" and "as available" without warranties of any kind, express or implied, including warranties of merchantability, fitness for a particular purpose, or non-infringement.',
    },
    {
      title: '11. Limitation of Liability',
      body: 'To the maximum extent permitted by applicable law, Yevilla and its operators, officers, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of or inability to use the platform, including loss of profits, data, or goodwill, even if we have been advised of the possibility of such damages.\n\nOur total liability to you for any claim arising out of or relating to these Terms or the platform shall not exceed ETB 1,000 or the amount you paid us (if any) in the twelve months preceding the claim, whichever is greater.',
    },
    {
      title: '12. Indemnification',
      body: 'You agree to indemnify and hold harmless Yevilla and its operators, officers, and affiliates from any claims, damages, liabilities, costs, and expenses (including reasonable attorneys\' fees) arising out of or related to: (a) your use of the platform; (b) your violation of these Terms; (c) your listing content; or (d) your violation of any third-party rights.',
    },
    {
      title: '13. Account Termination',
      body: 'You may request deletion of your account at any time by contacting us via the Contact page. Account deletion will permanently remove your listings and associated photos.\n\nWe reserve the right to suspend or terminate your access to the platform at any time, without notice, if we determine that you have violated these Terms or if your conduct may harm us, other users, or third parties. We are not liable for any loss resulting from such termination.',
    },
    {
      title: '14. Governing Law',
      body: 'These Terms are governed by and construed in accordance with the laws of the Federal Democratic Republic of Ethiopia. Any dispute arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of Addis Ababa, Ethiopia.',
    },
    {
      title: '15. Changes to These Terms',
      body: 'We may update these Terms at any time. We will indicate the effective date of the current version at the top of this document. Your continued use of Yevilla after any changes constitutes your acceptance of the revised Terms.',
    },
    {
      title: '16. Contact',
      body: 'If you have questions or concerns about these Terms, please contact us via the Contact page on the Yevilla website.',
    },
  ],
}

const DEFAULT_YEVILLA_PRIVACY: LegalDoc = {
  effectiveDate: 'June 1, 2026',
  sections: [
    {
      title: '1. Information We Collect',
      body: 'We collect the following information when you use the Yevilla app:\n\n• Account information: Your email address, display name, and profile photo when you create or update your account.\n• Listing information: Property details including address, city, sub-city, woreda, kebele, landmark, property type, pricing, bedrooms, bathrooms, area, amenities, availability date, description, and photos.\n• Agent application: Full name, email, phone number, license number, years of experience, specialization, service areas, and biography when you apply to become a verified agent.\n• Contact messages: Name, email, subject, and message content submitted through our contact form.\n• Location data: GPS coordinates when you use the location feature to pin your property on the map. We only access your location when you explicitly trigger this action within the App.\n• Usage data: Property view counts and save counts are recorded to help surface popular listings.\n• Authentication tokens: Firebase authentication tokens stored securely on your device to maintain your session.\n\nWe also receive information from third-party sign-in providers: Google (account ID, email, display name), Apple (user identifier and optionally email and name depending on your privacy settings), and Mapbox (search queries and map interactions governed by Mapbox\'s privacy policy).',
    },
    {
      title: '2. How We Use Your Information',
      body: 'We use the information we collect to:\n\n• Provide the App\'s core features: Display listings, enable search and map functionality, save favorites, and manage your account.\n• Authenticate you: Verify your identity securely when you sign in via email link, Google, or Apple.\n• Process listing submissions: Review, approve, and display your property listings.\n• Respond to inquiries: Reply to messages sent through the contact form.\n• Improve the App: Analyze usage patterns such as view counts and search queries to improve the quality and relevance of listings.\n• Communicate with you: Send transactional emails such as sign-in magic links.\n\nWe do not use your data for advertising, sell your personal information, or share it with data brokers.',
    },
    {
      title: '3. How We Share Your Information',
      body: 'When you publish a listing, the following information is visible to all users of the App: property details (type, price, address, photos, amenities, description), your display name, your email address (for non-agent owners), and your phone number (for verified agents who choose to display it).\n\nWe share data with the following service providers solely to operate the App: Google Firebase (authentication, database, and file storage), Google Sign-In (OAuth authentication), Apple Sign-In (OAuth authentication), and Mapbox (map rendering and address geocoding). These providers are contractually required to protect your data and may not use it for their own purposes.\n\nWe may disclose your information if required to do so by law, court order, or governmental authority, or if we believe in good faith that disclosure is necessary to protect our rights, your safety, or the safety of others.',
    },
    {
      title: '4. Data Storage and Security',
      body: 'Your data is stored on Google Firebase servers, which are protected by industry-standard security measures including encryption in transit (TLS) and at rest.\n\nAuthentication tokens on your device are stored in Expo SecureStore, which uses your device\'s native secure enclave (Keychain on iOS, Keystore on Android).\n\nWe retain your data for as long as your account is active. When you deactivate your account, we delete your listings (including photos stored in cloud storage), favorites, and Firebase authentication record.',
    },
    {
      title: '5. Your Rights and Choices',
      body: 'You can update your display name and profile photo at any time from the Edit Profile screen in the App.\n\nYou may permanently deactivate your account from the Profile screen. This action deletes all your listings and their associated photos from our storage, removes all your saved favorites, deletes your Firebase authentication account, and is irreversible — data cannot be recovered after deactivation.\n\nLocation access is only requested when you explicitly use the "set location" feature while creating or editing a listing. You can deny this permission in your device settings at any time; the App will still function, but you will not be able to set GPS coordinates for listings.\n\nPhoto library access is only requested when you choose to add photos to a listing. You can manage this permission in your device settings.',
    },
    {
      title: '6. Children\'s Privacy',
      body: 'The App is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us and we will delete it.',
    },
    {
      title: '7. Changes to This Policy',
      body: 'We may update this Privacy Policy from time to time. We will notify you of material changes by updating the effective date at the top of this policy. Continued use of the App after changes constitutes acceptance of the updated policy.',
    },
    {
      title: '8. Contact Us',
      body: 'If you have questions or concerns about this Privacy Policy or your data, please contact us:\n\nEmail: ana.ibrahim342@gmail.com\n\nApp: Use the "Contact Us" section in the App\'s Profile screen.',
    },
  ],
}

const DEFAULT_YEVILLA_TERMS: LegalDoc = {
  effectiveDate: 'June 1, 2026',
  sections: [
    {
      title: '1. Acceptance of Terms',
      body: 'By downloading, installing, or using Yevilla, you confirm that you are at least 18 years old, have the legal capacity to enter into a binding agreement, and agree to these Terms and our Privacy Policy. If you do not agree, you must not use the App.',
    },
    {
      title: '2. Description of Service',
      body: 'Yevilla is a real estate marketplace platform that allows users to browse, search, and filter property listings (for rent and for sale) in Ethiopia, post and manage property listings, save favorite listings, view properties on an interactive map, contact property owners and verified agents, and apply to become a verified agent on the platform.\n\nYevilla is a listing platform only. We do not act as a real estate agent, broker, buyer, seller, landlord, or tenant in any transaction. We are not a party to any agreement between users.',
    },
    {
      title: '3. User Accounts',
      body: 'You may sign in using your email address (via a magic link), Google account, or Apple ID. You are responsible for maintaining the confidentiality of your account and for all activity that occurs under it.\n\nYou agree to provide accurate, current, and complete information when creating your account and to update it as necessary.\n\nEach user may maintain only one account. Creating multiple accounts to circumvent restrictions or bans is prohibited.',
    },
    {
      title: '4. Listings and Content',
      body: 'Only the property owner or their authorized representative may post a listing. Posting a property you do not own or are not authorized to represent is strictly prohibited.\n\nYou must ensure that all listing content is truthful, accurate, and not misleading — including price, location, property type, size, amenities, available date, and photos (which must be of the actual property).\n\nYou may not post listings that are fraudulent, deceptive, or intended to scam other users; advertise a property you do not have the right to rent or sell; contain illegal, offensive, or discriminatory content; include personal information of third parties without their consent; or violate any applicable Ethiopian law or regulation.\n\nAll listings are reviewed before publication. We reserve the right to reject, remove, or unpublish any listing at our sole discretion.',
    },
    {
      title: '5. Prohibited Conduct',
      body: 'You agree not to:\n\n• Use the App for any unlawful purpose\n• Harass, threaten, or harm other users\n• Scrape, copy, or systematically extract data from the App without our written permission\n• Reverse engineer, decompile, or attempt to extract the source code of the App\n• Use automated tools (bots, scrapers) to access, query, or interact with the App\n• Interfere with or disrupt the App\'s infrastructure or security\n• Impersonate another person or entity\n• Circumvent any content filtering or access controls',
    },
    {
      title: '6. Moderation',
      body: 'All listings are reviewed before publication. We reserve the right to reject, remove, or unpublish any listing at our sole discretion, including listings that violate these Terms or that we determine are otherwise inappropriate. We are not obligated to provide a reason for rejection or removal.',
    },
    {
      title: '7. One Active Listing per Non-Agent User',
      body: 'Standard (non-agent) users may maintain one active listing at a time. Verified agents may manage multiple listings.',
    },
    {
      title: '8. Verified Agents',
      body: 'Users may apply to become a verified agent by providing their full name, email, phone number, license number, years of experience, specialization, and service areas. Approval is at our sole discretion.\n\nVerified agents are responsible for the accuracy of all listings they manage and must comply with all applicable Ethiopian real estate licensing laws and professional conduct standards.\n\nWe reserve the right to revoke agent status for violations of these Terms, misrepresentation in the application, or conduct that we determine is harmful to users or to the platform.',
    },
    {
      title: '9. Intellectual Property',
      body: 'The Yevilla name, logo, design, and all software, text, and graphics created by us are our exclusive property and are protected by applicable copyright and trademark law. You may not use them without our written permission.\n\nBy posting a listing or any content on the App (including photos, descriptions, and contact information), you grant us a non-exclusive, royalty-free, worldwide license to store, display, and distribute that content solely for the purpose of operating and promoting the App. You retain all ownership rights in your content.',
    },
    {
      title: '10. Disclaimers',
      body: 'We do not verify the accuracy of listings or the identity of users beyond basic authentication. The presence of a listing on Yevilla does not constitute our endorsement, recommendation, or guarantee of that listing or the user who posted it.\n\nNothing in the App constitutes legal, financial, or real estate advice. You are solely responsible for conducting your own due diligence before entering into any real estate transaction.\n\nThe App is provided "as is" and "as available" without warranties of any kind, express or implied, including warranties of merchantability, fitness for a particular purpose, or non-infringement.',
    },
    {
      title: '11. Limitation of Liability',
      body: 'To the maximum extent permitted by applicable law, Yevilla and its officers, employees, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of or inability to use the App, including loss of profits, data, or goodwill, even if we have been advised of the possibility of such damages.\n\nOur total liability to you for any claim arising out of or relating to these Terms or the App shall not exceed the amount you paid us (if any) in the twelve (12) months preceding the claim.',
    },
    {
      title: '12. Indemnification',
      body: 'You agree to indemnify and hold harmless Yevilla and its officers, employees, and affiliates from any claims, damages, liabilities, costs, and expenses (including reasonable attorneys\' fees) arising out of or related to: (a) your use of the App; (b) your violation of these Terms; (c) your listing content; or (d) your violation of any third-party rights.',
    },
    {
      title: '13. Account Termination',
      body: 'You may deactivate your account at any time from the Profile screen. Deactivation permanently deletes your listings, photos, and favorites and is irreversible.\n\nWe reserve the right to suspend or terminate your account at any time, without notice, if we determine that you have violated these Terms or if your conduct may harm us, other users, or third parties. We are not liable for any loss resulting from such termination.',
    },
    {
      title: '14. Governing Law',
      body: 'These Terms are governed by and construed in accordance with the laws of the Federal Democratic Republic of Ethiopia. Any dispute arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of Addis Ababa, Ethiopia.',
    },
    {
      title: '15. Changes to These Terms',
      body: 'We may update these Terms at any time. We will notify you of material changes by updating the effective date above. If you continue to use the App after revised Terms become effective, you accept the revised Terms.',
    },
    {
      title: '16. Contact Us',
      body: 'If you have questions about these Terms, please contact us:\n\nEmail: ana.ibrahim342@gmail.com\n\nApp: Use the "Contact Us" section in the App\'s Profile screen.',
    },
  ],
}

// ── Legal content: helper ─────────────────────────────────────────────────────

async function getLegalDoc(env: Env, platform: string, type: string): Promise<LegalDoc> {
  const key = `legal:${platform}:${type}`
  const stored = await env.RATE_LIMITER.get(key)
  if (stored) {
    try { return JSON.parse(stored) as LegalDoc } catch {}
  }
  if (platform === 'gojo' && type === 'privacy') return DEFAULT_GOJO_PRIVACY
  if (platform === 'gojo' && type === 'terms') return DEFAULT_GOJO_TERMS
  if (platform === 'yevilla' && type === 'privacy') return DEFAULT_YEVILLA_PRIVACY
  if (platform === 'yevilla' && type === 'terms') return DEFAULT_YEVILLA_TERMS
  return { effectiveDate: 'June 1, 2026', sections: [] }
}

// ── Legal content: GET /legal (public) ───────────────────────────────────────

async function handleGetLegal(request: Request, env: Env, origin: string, ctx: ExecutionContext): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  if (!await rateLimit(env, `pub:${ip}`, RATE_LIMITS.read_pub)) {
    return jsonErr(429, 'Too many requests — please slow down', origin, env)
  }

  const url = new URL(request.url)
  const platform = url.searchParams.get('platform') ?? ''
  const type = url.searchParams.get('type') ?? ''

  if (platform !== 'gojo' && platform !== 'yevilla') {
    return jsonErr(400, 'platform must be gojo or yevilla', origin, env)
  }
  if (type !== 'privacy' && type !== 'terms') {
    return jsonErr(400, 'type must be privacy or terms', origin, env)
  }

  const cacheKey = edgeCacheKey(`legal-${platform}-${type}`)
  const cachedBody = await edgeCacheMatch(cacheKey)
  if (cachedBody !== null) {
    return jsonCached(cachedBody, origin, env, 3600)
  }

  const doc = await getLegalDoc(env, platform, type)
  const body = JSON.stringify(doc)
  edgeCacheStore(ctx, cacheKey, body, 3600)
  return jsonCached(body, origin, env, 3600)
}

// ── Admin: GET /admin/legal ───────────────────────────────────────────────────

async function handleAdminGetLegal(request: Request, env: Env, origin: string): Promise<Response> {
  const secret = request.headers.get('X-Admin-Secret')
  if (!secret || secret !== env.ADMIN_SECRET) return jsonErr(401, 'Unauthorized', origin, env)

  const [gojoPrivacy, gojoTerms, yevillaPrivacy, yevillaTerms] = await Promise.all([
    getLegalDoc(env, 'gojo', 'privacy'),
    getLegalDoc(env, 'gojo', 'terms'),
    getLegalDoc(env, 'yevilla', 'privacy'),
    getLegalDoc(env, 'yevilla', 'terms'),
  ])

  return json({
    gojo: { privacy: gojoPrivacy, terms: gojoTerms },
    yevilla: { privacy: yevillaPrivacy, terms: yevillaTerms },
  }, 200, origin, env)
}

// ── Admin: PUT /admin/legal ───────────────────────────────────────────────────

async function handleAdminPutLegal(request: Request, env: Env, origin: string): Promise<Response> {
  const secret = request.headers.get('X-Admin-Secret')
  if (!secret || secret !== env.ADMIN_SECRET) return jsonErr(401, 'Unauthorized', origin, env)

  let body: { platform?: unknown; type?: unknown; doc?: unknown }
  try { body = await request.json() as { platform?: unknown; type?: unknown; doc?: unknown } }
  catch { return jsonErr(400, 'Invalid JSON', origin, env) }

  const platform = typeof body.platform === 'string' ? body.platform : ''
  const type = typeof body.type === 'string' ? body.type : ''

  if (platform !== 'gojo' && platform !== 'yevilla') {
    return jsonErr(400, 'platform must be gojo or yevilla', origin, env)
  }
  if (type !== 'privacy' && type !== 'terms') {
    return jsonErr(400, 'type must be privacy or terms', origin, env)
  }

  const doc = body.doc
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return jsonErr(400, 'doc must be an object', origin, env)
  }
  const d = doc as Record<string, unknown>

  if (typeof d.effectiveDate !== 'string' || d.effectiveDate.length === 0 || d.effectiveDate.length > 50) {
    return jsonErr(400, 'doc.effectiveDate must be a non-empty string (max 50 chars)', origin, env)
  }
  if (!Array.isArray(d.sections) || d.sections.length > 50) {
    return jsonErr(400, 'doc.sections must be an array of at most 50 items', origin, env)
  }
  for (const section of d.sections as unknown[]) {
    if (!section || typeof section !== 'object' || Array.isArray(section)) {
      return jsonErr(400, 'Each section must be an object', origin, env)
    }
    const s = section as Record<string, unknown>
    if (typeof s.title !== 'string' || s.title.length === 0 || s.title.length > 200) {
      return jsonErr(400, 'Each section.title must be a non-empty string (max 200 chars)', origin, env)
    }
    if (typeof s.body !== 'string' || s.body.length === 0 || s.body.length > 10000) {
      return jsonErr(400, 'Each section.body must be a non-empty string (max 10000 chars)', origin, env)
    }
  }

  const legalDoc: LegalDoc = {
    effectiveDate: d.effectiveDate as string,
    sections: (d.sections as Array<Record<string, string>>).map(s => ({
      title: s.title,
      body: s.body,
    })),
  }

  const key = `legal:${platform}:${type}`
  await env.RATE_LIMITER.put(key, JSON.stringify(legalDoc))
  caches.default.delete(edgeCacheKey(`legal-${platform}-${type}`)).catch(() => {})

  return json({ ok: true, platform, type }, 200, origin, env)
}

// ── App config ────────────────────────────────────────────────────────────────

const APP_VERSION_KEY = 'app_version'

async function handleGetAppVersion(request: Request, env: Env, origin: string): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  if (!await rateLimit(env, `pub:${ip}`, RATE_LIMITS.read_pub)) {
    return jsonErr(429, 'Too many requests', origin, env)
  }

  // Hit by every mobile app launch; changes only on a release. Serve from KV
  // (edge-local) and let clients cache for an hour to avoid a D1 round-trip per open.
  // Invalidated in handleAdminPatchAppConfig.
  const cached = await env.RATE_LIMITER.get(APP_VERSION_KEY)
  if (cached) return jsonCached(cached, origin, env, 3600)

  const row = await env.DB.prepare(
    'SELECT min_ios_version, min_android_version, ios_store_url, android_store_url FROM app_config WHERE id = 1'
  ).first<{ min_ios_version: string; min_android_version: string; ios_store_url: string; android_store_url: string }>()

  const body = JSON.stringify({
    minIosVersion:     row?.min_ios_version     ?? '0.0.0',
    minAndroidVersion: row?.min_android_version ?? '0.0.0',
    iosStoreUrl:       row?.ios_store_url       ?? '',
    androidStoreUrl:   row?.android_store_url   ?? '',
  })
  env.RATE_LIMITER.put(APP_VERSION_KEY, body, { expirationTtl: 3600 }).catch(() => {})
  return jsonCached(body, origin, env, 3600)
}

async function handleAdminGetAppConfig(request: Request, env: Env, origin: string): Promise<Response> {
  const secret = request.headers.get('X-Admin-Secret')
  if (!secret || secret !== env.ADMIN_SECRET) return jsonErr(401, 'Unauthorized', origin, env)

  const row = await env.DB.prepare(
    'SELECT min_ios_version, min_android_version, ios_store_url, android_store_url, updated_at FROM app_config WHERE id = 1'
  ).first<{ min_ios_version: string; min_android_version: string; ios_store_url: string; android_store_url: string; updated_at: number }>()

  return json({
    minIosVersion:     row?.min_ios_version     ?? '0.0.0',
    minAndroidVersion: row?.min_android_version ?? '0.0.0',
    iosStoreUrl:       row?.ios_store_url       ?? '',
    androidStoreUrl:   row?.android_store_url   ?? '',
    updatedAt:         row?.updated_at          ?? 0,
  }, 200, origin, env)
}

async function handleAdminPatchAppConfig(request: Request, env: Env, origin: string): Promise<Response> {
  const secret = request.headers.get('X-Admin-Secret')
  if (!secret || secret !== env.ADMIN_SECRET) return jsonErr(401, 'Unauthorized', origin, env)

  let body: { minIosVersion?: unknown; minAndroidVersion?: unknown; iosStoreUrl?: unknown; androidStoreUrl?: unknown }
  try { body = await request.json() as typeof body }
  catch { return jsonErr(400, 'Invalid JSON', origin, env) }

  const semverRe = /^\d+\.\d+\.\d+$/
  if (body.minIosVersion !== undefined && (typeof body.minIosVersion !== 'string' || !semverRe.test(body.minIosVersion))) {
    return jsonErr(400, 'minIosVersion must be semver (e.g. 1.2.0)', origin, env)
  }
  if (body.minAndroidVersion !== undefined && (typeof body.minAndroidVersion !== 'string' || !semverRe.test(body.minAndroidVersion))) {
    return jsonErr(400, 'minAndroidVersion must be semver (e.g. 1.2.0)', origin, env)
  }

  const existing = await env.DB.prepare(
    'SELECT min_ios_version, min_android_version, ios_store_url, android_store_url FROM app_config WHERE id = 1'
  ).first<{ min_ios_version: string; min_android_version: string; ios_store_url: string; android_store_url: string }>()

  const minIos     = typeof body.minIosVersion     === 'string' ? body.minIosVersion     : (existing?.min_ios_version ?? '0.0.0')
  const minAndroid = typeof body.minAndroidVersion === 'string' ? body.minAndroidVersion : (existing?.min_android_version ?? '0.0.0')
  const iosUrl     = typeof body.iosStoreUrl       === 'string' ? body.iosStoreUrl       : (existing?.ios_store_url ?? '')
  const androidUrl = typeof body.androidStoreUrl   === 'string' ? body.androidStoreUrl   : (existing?.android_store_url ?? '')
  const now = Date.now()

  await env.DB.prepare(
    'INSERT OR REPLACE INTO app_config (id, min_ios_version, min_android_version, ios_store_url, android_store_url, updated_at) VALUES (1, ?, ?, ?, ?, ?)'
  ).bind(minIos, minAndroid, iosUrl, androidUrl, now).run()
  env.RATE_LIMITER.delete(APP_VERSION_KEY).catch(() => {})

  return json({ minIosVersion: minIos, minAndroidVersion: minAndroid, iosStoreUrl: iosUrl, androidStoreUrl: androidUrl, updatedAt: now }, 200, origin, env)
}

function corsHeaders(origin: string, env: Env): Headers {
  const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(origin)
  const wwwVariant = env.ALLOWED_ORIGIN.replace(/^https:\/\//, 'https://www.')
  const adminVariant = env.ALLOWED_ORIGIN.replace(/^https:\/\//, 'https://admin.')
  const allowed = origin === env.ALLOWED_ORIGIN || origin === wwwVariant || origin === adminVariant || isLocalhost
  const h = new Headers()
  h.set('Access-Control-Allow-Origin', allowed ? origin : env.ALLOWED_ORIGIN)
  h.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  h.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Admin-Secret')
  h.set('Access-Control-Max-Age', '86400')
  h.set('Vary', 'Origin')
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

// Return an already-serialized public JSON body with fresh CORS headers and a
// short browser/edge Cache-Control. Used by endpoints backed by the edge cache so
// the cached body stays CORS-agnostic and headers are correct for every client.
function jsonCached(body: string, origin: string, env: Env, maxAgeSec = 60): Response {
  const h = corsHeaders(origin, env)
  h.set('Content-Type', 'application/json')
  h.set('Cache-Control', `public, max-age=${maxAgeSec}, s-maxage=${maxAgeSec}, stale-while-revalidate=30`)
  return new Response(body, { status: 200, headers: h })
}

function jsonErr(status: number, error: string, origin: string, env: Env): Response {
  return json({ error }, status, origin, env)
}
