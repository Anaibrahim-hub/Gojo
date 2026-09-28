'use client'

import { useEffect, useState } from 'react'
import type { Property } from '@/app/data/properties'
import { listingTitle, placeLabel } from './listing-utils'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''

let officePhone: Promise<string | null> | null = null

/** The listing's own agent phone, falling back to the office number from /contact. */
export function useContactPhone(p: Property | null | undefined): string | null {
  const [fallback, setFallback] = useState<string | null>(null)
  useEffect(() => {
    if (!WORKER_URL || !p || p.agentPhone) return
    officePhone ??= fetch(`${WORKER_URL}/contact`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: { phone?: string } | null) => d?.phone ?? null)
      .catch(() => null)
    officePhone.then(setFallback)
  }, [p])
  return p?.agentPhone || fallback
}

export function contactMessage(p: Property, displayPrice: string): string {
  return `Hi! I'm interested in the ${listingTitle(p)} in ${placeLabel(p)} (${displayPrice}) I saw on Gojo. Could you share more details?`
}

export function whatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/[\s+\-()]/g, '')}?text=${encodeURIComponent(message)}`
}

export function telegramUrl(phone: string, message: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, '')
  const e164 = cleaned.startsWith('+') ? cleaned : `+${cleaned}`
  return `https://t.me/${e164}?text=${encodeURIComponent(message)}`
}

/** Records a listing view (fire-and-forget). */
export function recordView(firestoreId: string | undefined) {
  if (!firestoreId || !WORKER_URL) return
  fetch(`${WORKER_URL}/listing/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listingId: firestoreId }),
  }).catch(() => {})
}

export async function shareListing(title: string, url: string) {
  if (navigator.share) {
    await navigator.share({ title, url }).catch(() => {})
  } else {
    await navigator.clipboard?.writeText(url).catch(() => {})
  }
}
