'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Suspense, useState } from 'react'
import HeaderSearch from './HeaderSearch'
import HeaderFilters from './HeaderFilters'
import LanguageToggle from './LanguageToggle'
import Logo from './Logo'
import { cn } from './ui/utils'
import { useT, type I18nKey } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { useSignInPrompt } from '@/lib/sign-in-prompt-context'

const NAV: { href: string; key: I18nKey }[] = [
  { href: '/', key: 'nav.home' },
  { href: '/favorites', key: 'nav.favorites' },
  { href: '/my-listings', key: 'nav.myListings' },
  { href: '/about', key: 'nav.about' },
]

export default function SiteHeader({ showSearch = false }: { showSearch?: boolean }) {
  const t = useT()
  const pathname = usePathname()
  const { user, loading, photoURL, displayName } = useAuth()
  const { promptSignIn } = useSignInPrompt()
  // On phones an active search takes the whole row (language + filters hide)
  const [searchActive, setSearchActive] = useState(false)
  return (
    <header
      className={cn(
        // Solid, no backdrop-blur: the search dropdown renders inside the header, and
        // some Safari versions crashed the page compositing a blurred layer with a scrolling child.
        'sticky top-0 z-40 border-b border-border bg-background',
        !showSearch && 'hidden md:block',
      )}
    >
      <div className="mx-auto max-w-7xl px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center gap-3 md:gap-8">
          <Logo className="hidden md:block" />
          <div className={cn(searchActive && 'max-md:hidden')}>
            <LanguageToggle />
          </div>

          {showSearch && (
            <div className="flex min-w-0 flex-1 items-center gap-2 md:max-w-2xl">
              <Suspense fallback={<div className="h-12 flex-1 rounded-full border border-border" />}>
                <HeaderSearch onActiveChange={setSearchActive} />
                <div className={cn(searchActive && 'max-md:hidden')}>
                  <HeaderFilters />
                </div>
              </Suspense>
            </div>
          )}

          <nav className="ml-auto hidden items-center gap-6 text-sm font-medium md:flex lg:gap-8">
            {NAV.map(({ href, key }) => {
              const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn('hover:text-foreground', active ? 'text-primary' : 'text-muted-foreground')}
                >
                  {t(key)}
                </Link>
              )
            })}

            {/* Account: sign-in button, or the user's avatar once signed in */}
            {loading ? (
              <span className="h-10 w-20 rounded-full bg-muted" aria-hidden />
            ) : user ? (
              <Link href="/profile" aria-label="Your profile" className="shrink-0 rounded-full ring-offset-2 transition hover:ring-2 hover:ring-border">
                {photoURL ? (
                  <img src={photoURL} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">
                    {(displayName || user.email || 'G').charAt(0).toUpperCase()}
                  </span>
                )}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => promptSignIn()}
                className="shrink-0 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Sign in
              </button>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}
