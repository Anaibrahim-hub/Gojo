'use client'

import { Briefcase, BedSingle, Building, Building2, Crown, Home, Hotel, LayoutGrid, PartyPopper } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CATEGORIES } from '@/lib/listing-utils'

const ICONS = { Briefcase, BedSingle, Building, Building2, Crown, Home, Hotel, LayoutGrid, PartyPopper }

export default function CategoryStrip() {
  const pathname = usePathname()
  const router = useRouter()
  const params = useSearchParams()
  const type = pathname === '/listings' ? params.get('type') ?? 'all' : 'all'

  const select = (id: string) => {
    const next = new URLSearchParams(pathname === '/listings' ? params.toString() : '')
    next.delete('open')
    if (id === 'all') next.delete('type')
    else next.set('type', id)
    const qs = next.toString()
    const href = `/listings${qs ? `?${qs}` : ''}`
    if (pathname === '/listings') router.replace(href, { scroll: false })
    else router.push(href)
  }

  return (
    <div className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-7xl gap-8 overflow-x-auto px-6 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORIES.map(cat => {
          const Icon = ICONS[cat.icon]
          const isActive = type === cat.id
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => select(cat.id)}
              aria-pressed={isActive}
              className={`flex shrink-0 flex-col items-center gap-2 border-b-2 pb-3 text-xs font-medium transition-colors ${
                isActive
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
              }`}
            >
              <Icon className="h-6 w-6" strokeWidth={1.5} />
              {cat.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
