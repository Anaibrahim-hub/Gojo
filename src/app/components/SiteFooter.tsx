'use client'

import Link from 'next/link'
import CurrencyToggle from './CurrencyToggle'
import { useT } from '@/lib/i18n'

export default function SiteFooter() {
  const t = useT()
  return (
    <footer className="mt-24 border-t border-border bg-muted/40">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <FooterCol
            title={t('footer.support')}
            links={[
              { label: t('footer.helpCenter'), href: '/contact' },
              { label: t('footer.verification'), href: '/about' },
              { label: t('footer.report'), href: '/contact' },
            ]}
          />
          <FooterCol
            title={t('footer.hosting')}
            links={[
              { label: t('footer.listProperty'), href: '/list-my-home' },
              { label: 'Sell your home', href: '/sell-my-home' },
              { label: 'Become an agent', href: '/become-an-agent' },
            ]}
          />
          <FooterCol
            title="Gojo"
            links={[
              { label: t('footer.aboutUs'), href: '/about' },
              { label: t('footer.privacy'), href: '/privacy' },
              { label: 'Terms', href: '/terms' },
            ]}
          />
          <FooterCol
            title={t('footer.cities')}
            links={['Addis Ababa', 'Bahir Dar', 'Hawassa', 'Gondar', 'Mekelle'].map(c => ({
              label: c,
              href: `/listings?place=${encodeURIComponent(c)}`,
            }))}
          />
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 text-sm text-muted-foreground md:flex-row md:items-center">
          <div>{t('footer.copyright')}</div>
          <CurrencyToggle />
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-bold text-foreground">{title}</h3>
      <ul className="space-y-3 text-sm text-muted-foreground">
        {links.map(l => (
          <li key={l.label}>
            <Link href={l.href} className="hover:text-foreground hover:underline">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
