# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Frontend
pnpm dev                  # Next.js dev server at http://localhost:3000 (uses live worker API)
pnpm build                # Standard Next.js build
pnpm cf:build             # Static export build (CF_BUILD=1, outputs to out/)
pnpm cf:preview           # Build + local Cloudflare Pages preview
pnpm cf:deploy            # Build + deploy to Cloudflare Pages (project: yevilla)

# Worker (Cloudflare Worker backend)
pnpm worker:dev           # Local worker dev server (wrangler dev)
pnpm worker:deploy        # Deploy worker to Cloudflare

# Database (Cloudflare D1)
pnpm d1:create            # Create the D1 database (one-time, paste returned ID into worker/wrangler.toml)
pnpm d1:migrate           # Run all 5 migrations against production D1
pnpm d1:migrate:local     # Run all 5 migrations against local D1 (for worker:dev)

# R2 (image storage)
pnpm worker:r2:create     # Create the gojo-listings R2 bucket (one-time)
pnpm worker:r2:cors       # Apply CORS rules from worker/r2-cors.json
```

**First-time setup**: After `pnpm install`, run `pnpm approve-builds` to allow `@tailwindcss/oxide`, `esbuild`, `sharp`, and `workerd` build scripts. Run `wrangler login` once before any `cf:` or `worker:` commands.

**Static export**: `next.config.ts` sets `output: 'export'` when `CF_BUILD=1`. `middleware.ts` is NOT executed in static export — bot protection is handled by Cloudflare WAF. Security headers are injected via `public/_headers`.

## Architecture

```
┌─────────────────────────┐      ┌─────────────────────────────────────┐
│  Next.js 16 frontend    │      │  Cloudflare Worker (gojo-upload)    │
│  static export →        │─────▶│  worker/src/index.ts                │
│  Cloudflare Pages       │      │  https://gojo-upload.ana-ibrahim433 │
│  (gojo.com.et)          │      │         .workers.dev                │
└─────────────────────────┘      └──────────┬──────────────────────────┘
                                            │
                   ┌────────────────────────┼──────────────────┐
                   ▼                        ▼                  ▼
          Cloudflare D1             Cloudflare R2        Cloudflare KV
         (gojo-listings-db)       (gojo-listings)      (RATE_LIMITER)
         listings, favorites,      property photos      rate-limit buckets
         agents, contact_info
```

**Firebase** is used for user authentication only — the frontend gets a Firebase JWT, sends it as `Authorization: Bearer <token>`, and the worker verifies it by fetching Firebase's public JWKS (no Firebase Admin SDK needed).

**Admin dashboard** is a separate Next.js project at `~/Documents/Admin Dashboard for Real Estate`, deployed to `admin.yevilla.com`. It proxies all requests through Next.js API routes to this worker using `X-Admin-Secret`.

## Worker API (`worker/src/index.ts`)

All routes are on the `gojo-upload` worker. Auth uses Firebase JWT unless noted.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/upload` | Firebase JWT | Upload a photo to R2; returns `{ key, url }` |
| `POST` | `/video/upload-url` | Firebase JWT | Presigned R2 PUT URL for a listing video (`{ contentType, size }`; MP4/MOV/M4V/3GP/WebM/MKV, ≤ 500 MB); returns `{ uploadUrl, key }` |
| `POST` | `/video/complete` | Firebase JWT | Verify an uploaded video (signature + ≤ 60 s, parsed from the file); failures are deleted, successes can be attached to a listing for 7 days |
| `DELETE` | `/image/:key` | Firebase JWT | Delete own photo or video from R2 |
| `GET` | `/listings` | Public | All published listings |
| `GET` | `/listing` | Firebase JWT | Caller's own listings + `isAgent` flag |
| `POST` | `/listing` | Firebase JWT | Create/upsert a listing (agents auto-publish; users go pending) |
| `DELETE` | `/listing` | Firebase JWT | Delete own listing + its R2 photos |
| `POST` | `/listing/view` | Public | Increment view count |
| `GET` | `/favorites` | Firebase JWT | Get saved favorite IDs |
| `PUT` | `/favorites` | Firebase JWT | Replace full favorites list |
| `GET` | `/contact` | Public | Contact info row |
| `PATCH` | `/admin/listing/approve` | `X-Admin-Secret` | Approve or reject a listing |
| `POST` | `/admin/agents` | `X-Admin-Secret` | Promote user to agent |
| `DELETE` | `/admin/agents` | `X-Admin-Secret` | Remove agent role |
| `GET` | `/admin/listings` | `X-Admin-Secret` | All listings with `isAgent` flag |
| `DELETE` | `/admin/listings` | `X-Admin-Secret` | Delete any listing + its R2 photos |
| `GET` | `/admin/users` | `X-Admin-Secret` | All users derived from listing owners + agents |
| `GET` | `/admin/stats` | `X-Admin-Secret` | Aggregate counts (users, agents, listings by status) |

**Agent behaviour**: UIDs in the `agents` table get unlimited listings (UUID primary key, auto-published). Regular users get one listing (id = Firebase UID, upsert semantics, starts as `pending`).

## Database Schema (Cloudflare D1 — `gojo-listings-db`)

Migrations live in `worker/migrations/` and must be applied in order (0001 → 0005).

```sql
listings      -- property listings; id is UUID for agents, Firebase UID for regular users
favorites     -- (user_id TEXT, property_id INTEGER) saved properties
agents        -- (uid TEXT) Firebase UIDs with agent role
contact_info  -- single row (id = 1) with phone, email, address, office_hours
```

Key `listings` columns: `owner_id`, `listing_type` ('rent'|'sale'), `status` ('pending'|'published'|'rejected'), `amenities` (JSON array), `photos` (JSON array of `{url, key}`), `video` (JSON `{url, key}` or NULL — migration 0013; only written when a POST /listing body includes `video`, so clients that omit it never clear it). `property_type` includes `Hotel` (rent is per night) and `Event Venue` (per day); the amount is stored in `monthly_rent`.

## Worker Environment Variables

Set in `worker/wrangler.toml` (plain vars) or via `wrangler secret put` (secrets):

| Variable | Where | Value |
|----------|-------|-------|
| `FIREBASE_PROJECT_ID` | `wrangler.toml` [vars] | `gojo-9e529` |
| `ALLOWED_ORIGIN` | `wrangler.toml` [vars] | `https://yevilla.com` |
| `ADMIN_SECRET` | Cloudflare secret | shared with admin dashboard `.env.local` |
| `R2_PUBLIC_URL` | Cloudflare secret | `https://pub-XXXX.r2.dev` |
| `BREVO_API_KEY` | Cloudflare secret | Brevo transactional email API key |
| `STAFF_EMAIL` | Cloudflare secret | recipient for form submissions (default: anaibrahim628@gmail.com) |
| `TURNSTILE_SECRET` | Cloudflare secret | Cloudflare Turnstile secret key; verifies contact-form submissions |
| `R2_ACCOUNT_ID`, `R2_BUCKET_NAME` | `wrangler.toml` [vars] | Target of presigned video uploads |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Cloudflare secret | R2 API token (Object Read & Write on `gojo-listings`) used to sign video upload URLs |

Bindings (set in `wrangler.toml`): `DB` (D1), `GOJO_LISTINGS` (R2), `RATE_LIMITER` (KV).

## Frontend Environment Variables (`.env.local`)

Copy `.env.example` → `.env.local`:

```
NEXT_PUBLIC_MAPBOX_TOKEN=        # Mapbox token (restricted to gojo.com.et)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID= # gojo-9e529
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_WORKER_URL=          # https://gojo-upload.ana-ibrahim433.workers.dev
NEXT_PUBLIC_R2_PUBLIC_URL=       # https://pub-XXXX.r2.dev
NEXT_PUBLIC_TURNSTILE_SITE_KEY=  # Cloudflare Turnstile public site key (contact-form anti-spam)
```

**Contact-form anti-spam** (`/submit-form`): three layers — a per-IP rate limit (5/60s), a hidden `company` honeypot field (any value → silently dropped), and an unforgeable identity gate. The gate branches on the `Origin` header: browsers (always send `Origin`) must pass a Cloudflare **Turnstile** token; native app clients (Expo, no `Origin`) must present a valid **Firebase JWT**. A bot can neither fake an Origin past Turnstile nor omit it past the JWT check. The Expo app signs logged-out users in anonymously so every submission carries a JWT (requires the **Anonymous** provider enabled in Firebase Auth).

## Frontend Routes

| Route | File | Description |
|-------|------|-------------|
| `/` | `src/app/page.tsx` | Landing page |
| `/listings` | `src/app/listings/page.tsx` | Map + filter + property grid; accepts `?mode=buy\|rent` |
| `/favorites` | `src/app/favorites/page.tsx` | Saved favorites (requires auth) |
| `/list-my-home` | `src/app/list-my-home/page.tsx` | User listing submission form |
| `/sell-my-home` | `src/app/sell-my-home/` | Agent listing form |
| `/settings` | `src/app/settings/page.tsx` | User account settings |
| `/contact` | `src/app/contact/page.tsx` | Contact page |
| `/become-an-agent` | `src/app/become-an-agent/page.tsx` | Agent application page |

## Styling

- **Tailwind v4** via `@tailwindcss/postcss`
- CSS entry: `src/styles/index.css` → imports `fonts.css`, `tailwind.css`, `theme.css`
- Design tokens (colors, radius) in `src/styles/theme.css` as CSS custom properties
- `cn()` utility at `src/app/components/ui/utils.ts`
- `@` path alias resolves to `src/`

No test suite exists.
