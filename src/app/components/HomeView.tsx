'use client'

import Link from 'next/link'
import { ShieldCheck, Camera, Sparkles } from 'lucide-react'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'
import VideoReels from './VideoReels'
import ListingCard, { ListingCardSkeleton } from './ListingCard'
import { useListings } from '@/lib/listings-context'
import { useCurrency } from '@/lib/currency'
import { useT } from '@/lib/i18n'
import { listingKey, rentUnit } from '@/lib/listing-utils'

const CITIES = [
  { name: 'Addis Ababa', image: '/gojo/city-addis.jpg' },
  { name: 'Bahir Dar', image: '/gojo/city-bahirdar.jpg' },
  { name: 'Hawassa', image: '/gojo/city-hawassa.jpg' },
]

export default function HomeView() {
  const t = useT()
  const { listings, loading } = useListings()
  const { format } = useCurrency()

  // Real counts and lowest monthly rent per city for the spotlight tiles.
  const cityStats = (name: string) => {
    const inCity = listings.filter(l => l.city.toLowerCase().includes(name.toLowerCase().split(' ')[0]))
    const rents = inCity.filter(l => rentUnit(l.propertyType) === 'month').map(l => l.rent).filter(r => r > 0)
    return {
      count: inCity.length,
      from: rents.length ? Math.min(...rents) : null,
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20 font-sans text-foreground md:pb-0">
      <SiteHeader showSearch />

      {/* Hero */}
      <section className="relative hidden md:block">
        <div className="relative h-[560px] w-full">
          <img
            src="/gojo/hero.jpg"
            alt="Modern apartments in Addis Ababa at golden hour"
            width={1920}
            height={1280}
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-foreground/30 via-foreground/10 to-background" />
          <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-center px-6">
            <h1 className="max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-tight text-background drop-shadow-md sm:text-6xl md:text-7xl">
              {t('hero.title1')}<br />{t('hero.title2')}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-background/95 drop-shadow">{t('hero.body')}</p>
          </div>
        </div>
        <div className="h-12" />
      </section>

      <VideoReels />

      {/* Featured listings */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-bold tracking-tight">{t('home.featured')}</h2>
          <Link href="/listings" className="text-sm font-semibold text-foreground underline-offset-4 hover:underline">
            {t('home.seeAll')}
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loading && listings.length === 0
            ? Array.from({ length: 8 }, (_, i) => <ListingCardSkeleton key={i} />)
            : listings.slice(0, 8).map(l => <ListingCard key={listingKey(l)} listing={l} />)}
        </div>
      </section>

      {/* City spotlight */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">{t('home.cityTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('home.cityBody')}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {CITIES.map(c => {
            const s = cityStats(c.name)
            const detail = [
              `${s.count} ${s.count === 1 ? 'home' : 'homes'}`,
              s.from != null && `${t('home.from')} ${format(s.from)}${t('home.perMonth')}`,
            ].filter(Boolean).join(' · ')
            return <CityTile key={c.name} name={c.name} detail={loading ? '' : detail} image={c.image} />
          })}
        </div>
      </section>

      {/* Trust band */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="rounded-3xl bg-accent/60 p-10 md:p-14">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t('promise.title')}</h2>
            <p className="mt-3 text-muted-foreground">{t('promise.body')}</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            <PromiseItem icon={<ShieldCheck className="h-7 w-7 text-primary" />} title={t('promise.verified')} body={t('promise.verifiedBody')} />
            <PromiseItem icon={<Camera className="h-7 w-7 text-primary" />} title={t('promise.photo')} body={t('promise.photoBody')} />
            <PromiseItem icon={<Sparkles className="h-7 w-7 text-primary" />} title={t('promise.pricing')} body={t('promise.pricingBody')} />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}

function CityTile({ name, detail, image }: { name: string; detail: string; image: string }) {
  return (
    <Link href={`/listings?place=${encodeURIComponent(name)}`} className="group relative block overflow-hidden rounded-2xl">
      <img
        src={image}
        alt={name}
        width={1024}
        height={1280}
        loading="lazy"
        className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/10 to-transparent" />
      <div className="absolute bottom-5 left-5 text-background">
        <div className="text-2xl font-bold">{name}</div>
        {detail && <div className="text-sm opacity-90">{detail}</div>}
      </div>
    </Link>
  )
}

function PromiseItem({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-background">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  )
}
