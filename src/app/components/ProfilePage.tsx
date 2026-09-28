'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BadgeCheck, Building2, ChevronRight, FileText, Heart, LogOut, Mail, Settings, Shield, User, UserPen } from 'lucide-react'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'
import SignInModal from './SignInModal'
import LanguageToggle from './LanguageToggle'
import CurrencyToggle from './CurrencyToggle'
import { useAuth } from '@/lib/auth-context'

const ACCOUNT_LINKS = [
  { href: '/edit-profile', label: 'Edit profile', icon: UserPen },
  { href: '/settings', label: 'Account settings', icon: Settings },
  { href: '/my-listings', label: 'My listings', icon: Building2 },
  { href: '/favorites', label: 'Favorites', icon: Heart },
  { href: '/become-an-agent', label: 'Become an agent', icon: BadgeCheck },
]

const INFO_LINKS = [
  { href: '/contact', label: 'Contact us', icon: Mail },
  { href: '/privacy', label: 'Privacy policy', icon: Shield },
  { href: '/terms', label: 'Terms of service', icon: FileText },
]

export default function ProfilePage() {
  const { user, loading, photoURL, displayName, signOut } = useAuth()
  const [signInOpen, setSignInOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background pb-20 font-sans text-foreground md:pb-0">
      <SiteHeader />
      <section className="mx-auto max-w-2xl px-6 py-12">
        {loading ? (
          <div className="mx-auto h-16 w-16 animate-pulse rounded-full bg-muted" />
        ) : user ? (
          <div className="flex items-center gap-4">
            {photoURL ? (
              <img src={photoURL} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-xl font-bold text-muted-foreground">
                {(displayName || user.email || 'G').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight">{displayName || 'Your account'}</h1>
              {user.email && <p className="truncate text-sm text-muted-foreground">{user.email}</p>}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <User className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">Sign in to Gojo</h1>
            <p className="mt-2 text-muted-foreground">Save favorites, contact owners, and manage your listings from one place.</p>
            <button
              type="button"
              onClick={() => setSignInOpen(true)}
              className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-95"
            >
              Sign in or create account
            </button>
          </div>
        )}

        {user && <LinkList links={ACCOUNT_LINKS} className="mt-8" />}

        <div className="mt-8 flex items-center justify-between rounded-2xl border border-border px-4 py-3">
          <span className="text-sm font-semibold">Language</span>
          <LanguageToggle />
        </div>
        {/* Signed-out visitors get these from the footer; don't repeat them here */}
        {user && (
          <>
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-border px-4 py-3">
              <span className="text-sm font-semibold">Currency</span>
              <CurrencyToggle />
            </div>
            <LinkList links={INFO_LINKS} className="mt-8" />
          </>
        )}

        {user && (
          <button
            type="button"
            onClick={() => signOut()}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-semibold hover:bg-muted"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        )}
      </section>
      <SiteFooter />
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </div>
  )
}

function LinkList({ links, className }: { links: { href: string; label: string; icon: typeof User }[]; className?: string }) {
  return (
    <ul className={`divide-y divide-border rounded-2xl border border-border ${className ?? ''}`}>
      {links.map(({ href, label, icon: Icon }) => (
        <li key={href}>
          <Link href={href} className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium hover:bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
            <span className="flex-1">{label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
