'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Search, Heart, User, Key } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useMobileMap } from '@/lib/mobile-map-context'
import { useScreenT } from '@/lib/language-context'
import SignInModal from './SignInModal'

const NAV_DEFAULTS = {
  search: 'Search',
  saved: 'Saved',
  myHome: 'My Home',
  profile: 'Profile',
} as const

export default function MobileBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { open: mapOpen } = useMobileMap()
  const [showSignIn, setShowSignIn] = useState(false)
  const s = useScreenT(NAV_DEFAULTS)

  const tabs = [
    { icon: Search, label: s.search,  href: '/listings',    requiresAuth: false },
    { icon: Heart,  label: s.saved,   href: '/favorites',   requiresAuth: true  },
    { icon: Key,    label: s.myHome,  href: '/list-my-home', requiresAuth: true  },
    { icon: User,   label: s.profile, href: '/settings',    requiresAuth: true  },
  ]

  if (mapOpen) return null

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex">
          {tabs.map(({ icon: Icon, label, href, requiresAuth }) => {
            const isActive = href === '/listings'
              ? pathname.startsWith('/listings')
              : pathname.startsWith(href)
            return (
              <button
                key={href}
                onClick={() => {
                  if (authLoading) return
                  if (requiresAuth && !user) {
                    setShowSignIn(true)
                    return
                  }
                  router.push(href)
                }}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5"
              >
                <Icon
                  className={`w-5 h-5 transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span className={`text-[10px] font-semibold transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      <SignInModal open={showSignIn} onClose={() => setShowSignIn(false)} />
    </>
  )
}
