'use client'

import Link from 'next/link'
import { ShieldCheck, Camera, Handshake } from 'lucide-react'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'

export default function AboutView() {
  return (
    <div className="min-h-screen bg-background pb-20 font-sans text-foreground md:pb-0">
      <SiteHeader />

      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <span className="text-sm font-semibold uppercase tracking-widest text-primary">Our story</span>
        <h1 className="mt-3 text-5xl font-extrabold leading-tight tracking-tight md:text-6xl">
          Real estate, the way it should be in Ethiopia.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Renting or buying a home in Ethiopia is hard for the wrong reasons — phantom listings, hidden fees, broker chains, and photos that don&apos;t match the unit. Gojo exists to make it simple.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6">
        <img
          src="/gojo/hero.jpg"
          alt="Modern apartments in Addis Ababa"
          width={1920}
          height={1280}
          loading="lazy"
          className="aspect-[16/7] w-full rounded-3xl object-cover"
        />
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="mb-10 text-3xl font-bold tracking-tight">What we promise</h2>
        <div className="grid gap-10 md:grid-cols-3">
          <Pillar icon={<ShieldCheck className="h-7 w-7 text-primary" />} title="Every listing reviewed" body="Every listing from an owner is reviewed by our team before it goes live, and agents are verified before they can publish." />
          <Pillar icon={<Camera className="h-7 w-7 text-primary" />} title="Real photos" body="Listings show real photos of the home, so what you see is what you'll visit." />
          <Pillar icon={<Handshake className="h-7 w-7 text-primary" />} title="Talk to the lister directly" body="Contact owners and agents on WhatsApp or Telegram — no middlemen, no chains." />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Find your next home today.</h2>
        <Link
          href="/listings"
          className="mt-6 inline-flex rounded-full bg-primary px-7 py-3 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-95"
        >
          Browse homes
        </Link>
      </section>

      <SiteFooter />
    </div>
  )
}

function Pillar({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">{icon}</div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-muted-foreground">{body}</p>
    </div>
  )
}
