# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm run dev      # Start Next.js dev server at http://localhost:3000
pnpm run build    # Production build
pnpm run start    # Start production server
```

**First-time setup**: After `pnpm install`, run `pnpm approve-builds` to allow `@tailwindcss/oxide`, `esbuild`, and `sharp` build scripts (required on fresh clone).

No test suite exists in this project.

## Architecture

This is a Next.js 16 App Router application (originally exported from Figma Make, migrated from Vite). It has **no backend** — all property data is hardcoded in `src/app/components/ListingsView.tsx` as `mockProperties`.

### Routes

| Route | File | Description |
|---|---|---|
| `/` | `src/app/page.tsx` | Landing page (`'use client'`) |
| `/listings` | `src/app/listings/page.tsx` | Map + filter + property grid |

Navigation uses `next/navigation` (`useRouter`, `useSearchParams`). The `/listings` route accepts a `?mode=buy|rent` query param to pre-select the listing mode.

### Component structure

```
src/app/
  layout.tsx              — root layout, imports global CSS
  page.tsx                — home route ('use client'), wraps HomePage + PropertyModal
  listings/page.tsx       — listings route, wraps ListingsView in Suspense
  components/
    ListingsView.tsx      — ('use client') owns all filter/sort/view state
    HomePage.tsx          — ('use client') marketing landing page
    MapView.tsx           — custom CSS-based map (not Leaflet)
    FilterPanel.tsx       — header with buy/rent toggle + filters
    PropertyCard.tsx      — individual listing card
    PropertyModal.tsx     — property detail overlay
    ui/                   — shadcn-style Radix UI components
```

### State ownership

`ListingsView.tsx` is the single source of truth for the listings view:
- `filters`, `listingMode` (`'buy'`|`'rent'`), `sortBy`
- `selectedProperty` — drives `PropertyModal` open/close
- `hoveredPropertyId` — syncs hover between `MapView` markers and `PropertyCard`
- `mobileView` (`'map'`|`'list'`) — mobile tab toggle

`page.tsx` (home route) owns `selectedProperty` and `listingMode` for the property modal that can be opened from the homepage.

### Map

`MapView` is a **custom CSS-based map** — Leaflet is installed but unused. Property coordinates are converted to CSS `left`/`top` percentages via `lngToX()` and `latToY()`, hardcoded to the San Francisco bounding box.

### Styling

- **Tailwind v4** via `@tailwindcss/postcss` (PostCSS plugin, not Vite plugin)
- CSS entry: `src/styles/index.css` → imports `fonts.css`, `tailwind.css`, `theme.css`
- Tailwind sources scanned from `src/**` (configured via `@source` in `tailwind.css`)
- Design tokens (colors, radius, etc.) are CSS custom properties in `src/styles/theme.css`
- `cn()` utility at `src/app/components/ui/utils.ts`
- `@` path alias resolves to `src/`
