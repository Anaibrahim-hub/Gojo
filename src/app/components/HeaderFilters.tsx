'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'
import { setSearchOpen } from '@/lib/search-open-store'
import { useCurrency } from '@/lib/currency'
import { useListings } from '@/lib/listings-context'
import { listingPrice, matchesMode, type Mode } from '@/lib/listing-utils'
import { goToListings } from '@/lib/listings-nav'
import { cn } from './ui/utils'

const COUNTS = [0, 1, 2, 3, 4] as const
const countLabel = (n: number) => (n === 0 ? 'Any' : n === 4 ? '4+' : String(n))
const num = (v: string | null) => {
  const n = Number(v)
  return v && Number.isFinite(n) && n > 0 ? n : undefined
}

const RANGE_THUMB =
  'absolute top-0 left-0 h-10 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-foreground [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-foreground [&::-moz-range-thumb]:bg-background [&::-moz-range-thumb]:shadow'

export default function HeaderFilters() {
  const router = useRouter()
  const params = useSearchParams()
  const { listings } = useListings()
  const { format } = useCurrency()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const urlMode = (params.get('mode') as Mode | null) ?? null
  const urlBeds = num(params.get('beds'))
  const urlBaths = num(params.get('baths'))
  const urlMin = num(params.get('minPrice'))
  const urlMax = num(params.get('maxPrice'))

  const [mode, setMode] = useState<Mode | null>(urlMode)
  const [beds, setBeds] = useState(urlBeds ?? 0)
  const [baths, setBaths] = useState(urlBaths ?? 0)
  const [minPrice, setMinPrice] = useState<number | undefined>(urlMin)
  const [maxPrice, setMaxPrice] = useState<number | undefined>(urlMax)

  // Re-sync when the panel opens or the URL changes.
  useEffect(() => {
    setMode(urlMode)
    setBeds(urlBeds ?? 0)
    setBaths(urlBaths ?? 0)
    setMinPrice(urlMin)
    setMaxPrice(urlMax)
  }, [urlMode, urlBeds, urlBaths, urlMin, urlMax, open])

  useEffect(() => {
    setSearchOpen(open)
    if (!open) { document.body.style.overflow = ''; return }
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  // Slider bounds follow the prices of listings in the selected mode.
  const [MIN_PRICE, MAX_PRICE] = useMemo(() => {
    const prices = listings.filter(l => matchesMode(l, mode)).map(l => listingPrice(l, mode)).filter(p => p > 0)
    if (prices.length === 0) return [0, 100_000]
    return [Math.min(...prices), Math.max(...prices)]
  }, [listings, mode])
  const step = MAX_PRICE > 1_000_000 ? 50_000 : 1_000

  const activeCount =
    (urlMode ? 1 : 0) + (urlBeds ? 1 : 0) + (urlBaths ? 1 : 0) + (urlMin != null || urlMax != null ? 1 : 0)

  const apply = () => {
    setOpen(false)
    const next = new URLSearchParams()
    const place = params.get('place') ?? params.get('q')
    const type = params.get('type')
    if (place) next.set('place', place)
    if (type) next.set('type', type)
    if (mode) next.set('mode', mode)
    if (beds) next.set('beds', String(beds))
    if (baths) next.set('baths', String(baths))
    if (minPrice != null) next.set('minPrice', String(minPrice))
    if (maxPrice != null) next.set('maxPrice', String(maxPrice))
    goToListings(router, next.toString())
  }

  const clear = () => {
    setMode(null)
    setBeds(0)
    setBaths(0)
    setMinPrice(undefined)
    setMaxPrice(undefined)
  }

  const span = Math.max(1, MAX_PRICE - MIN_PRICE)
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - MIN_PRICE) / span) * 100))
  const minPct = minPrice != null ? pct(minPrice) : 0
  const maxPct = maxPrice != null ? pct(maxPrice) : 100
  const clamp = (v: number) => Math.max(MIN_PRICE, Math.min(MAX_PRICE, v))

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Filters"
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-background shadow-sm transition-shadow hover:shadow-md"
      >
        <SlidersHorizontal className="h-4 w-4" />
        {activeCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </button>

      {mounted && open && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col bg-background" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="flex items-center justify-between border-b border-border px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
            <button type="button" onClick={() => setOpen(false)} aria-label="Close filters" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
              <X className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold">Filters</span>
            <button type="button" onClick={clear} className="text-sm font-semibold text-muted-foreground underline">
              Clear
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6">
            <div className="mx-auto max-w-2xl space-y-8">
              <section>
                <h3 className="mb-3 text-base font-semibold">Bedrooms</h3>
                <div className="flex flex-wrap gap-2">
                  {COUNTS.map(n => <Chip key={n} active={beds === n} onClick={() => setBeds(n)}>{countLabel(n)}</Chip>)}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-base font-semibold">Bathrooms</h3>
                <div className="flex flex-wrap gap-2">
                  {COUNTS.map(n => <Chip key={n} active={baths === n} onClick={() => setBaths(n)}>{countLabel(n)}</Chip>)}
                </div>
              </section>

              <section>
                <h3 className="mb-4 text-base font-semibold">Price</h3>
                <div className="flex items-center gap-3">
                  <PriceInput
                    label="Minimum"
                    placeholder="No min"
                    value={minPrice}
                    step={step}
                    onChange={v => {
                      setMinPrice(v)
                      if (v != null && maxPrice != null && v > maxPrice) setMaxPrice(v)
                    }}
                  />
                  <span className="text-muted-foreground">–</span>
                  <PriceInput
                    label="Maximum"
                    placeholder="No max"
                    value={maxPrice}
                    step={step}
                    onChange={v => {
                      setMaxPrice(v)
                      if (v != null && minPrice != null && v < minPrice) setMinPrice(v)
                    }}
                  />
                </div>

                {/* Dual-thumb range slider */}
                <div className="relative mt-5 mb-2 h-10 select-none">
                  <div className="absolute top-1/2 left-0 right-0 h-1.5 -translate-y-1/2 rounded-full bg-muted" />
                  <div
                    className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-foreground"
                    style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }}
                  />
                  <input
                    type="range"
                    min={MIN_PRICE}
                    max={MAX_PRICE}
                    step={step}
                    value={minPrice != null ? clamp(minPrice) : MIN_PRICE}
                    onChange={e => {
                      const v = Number(e.target.value)
                      setMinPrice(v)
                      if (maxPrice != null && v > maxPrice) setMaxPrice(v)
                    }}
                    aria-label="Minimum price slider"
                    className={RANGE_THUMB}
                  />
                  <input
                    type="range"
                    min={MIN_PRICE}
                    max={MAX_PRICE}
                    step={step}
                    value={maxPrice != null ? clamp(maxPrice) : MAX_PRICE}
                    onChange={e => {
                      const v = Number(e.target.value)
                      setMaxPrice(v)
                      if (minPrice != null && v < minPrice) setMinPrice(v)
                    }}
                    aria-label="Maximum price slider"
                    className={RANGE_THUMB}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{format(MIN_PRICE)}</span>
                  <span>{format(MAX_PRICE)}</span>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Amounts are in ETB; your selected currency converts them for display.
                </p>
              </section>
            </div>
          </div>

          <div className="border-t border-border px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <button type="button" onClick={apply} className="mx-auto block w-full max-w-2xl rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground">
              Show homes
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-w-14 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
        active ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground hover:border-foreground',
      )}
    >
      {children}
    </button>
  )
}

function PriceInput({
  label, placeholder, value, step, onChange,
}: {
  label: string
  placeholder: string
  value: number | undefined
  step: number
  onChange: (v: number | undefined) => void
}) {
  return (
    <label className="flex-1 rounded-2xl border border-border px-4 py-3">
      <span className="block text-xs text-muted-foreground">{label} (ETB)</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={step}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0))}
        aria-label={`${label} price`}
        className="mt-1 w-full bg-transparent text-base font-semibold outline-none md:text-sm"
      />
    </label>
  )
}
