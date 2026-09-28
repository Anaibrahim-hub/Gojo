'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Heart, Building2, User } from 'lucide-react'
import { useSearchOpen } from '@/lib/search-open-store'
import { useT, type I18nKey } from '@/lib/i18n'

const TABS: { href: string; key: I18nKey; icon: typeof Home }[] = [
  { href: '/', key: 'nav.home', icon: Home },
  { href: '/favorites', key: 'nav.favorites', icon: Heart },
  { href: '/my-listings', key: 'nav.listings', icon: Building2 },
  { href: '/profile', key: 'nav.profile', icon: User },
]

// Full-screen or form pages where the tab bar would get in the way.
const HIDDEN_ON = ['/reels', '/list-my-home', '/sell-my-home', '/auth-action']

export default function BottomNav() {
  const t = useT()
  const pathname = usePathname()
  const searchOpen = useSearchOpen()
  if (searchOpen || HIDDEN_ON.includes(pathname)) return null

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-2xl items-stretch justify-between px-2">
        {TABS.map(({ href, key, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' || pathname === '/listings' : pathname.startsWith(href)
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 py-2 text-[11px] font-semibold transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}
              >
                <Icon className="h-5 w-5" />
                {t(key)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
