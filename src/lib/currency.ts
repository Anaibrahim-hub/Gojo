'use client'

import { useEffect, useState } from 'react'

export type Currency = 'ETB' | 'USD' | 'EUR'

export const CURRENCIES: Currency[] = ['ETB', 'USD', 'EUR']

// Display-only conversion from 1 ETB. Approximate — update these when the rate moves.
// Listing prices are always stored and filtered in ETB.
const ETB_PER: Record<Currency, number> = {
  ETB: 1,
  USD: 155,
  EUR: 175,
}

const STORAGE_KEY = 'gojo_currency'

let current: Currency = 'ETB'
const listeners = new Set<(value: Currency) => void>()

export function setCurrency(value: Currency) {
  current = value
  try { localStorage.setItem(STORAGE_KEY, value) } catch {}
  listeners.forEach(listener => listener(value))
}

/** Formats an ETB amount in the selected currency, e.g. "ETB 85,000" or "$548". */
export function formatPrice(etb: number, currency: Currency): string {
  const value = Math.round(etb / ETB_PER[currency])
  const amount = new Intl.NumberFormat('en-US').format(value)
  if (currency === 'USD') return `$${amount}`
  if (currency === 'EUR') return `€${amount}`
  return `ETB ${amount}`
}

export function useCurrency() {
  const [currency, setValue] = useState<Currency>(current)

  useEffect(() => {
    listeners.add(setValue)
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Currency | null
      if (stored && CURRENCIES.includes(stored)) current = stored
    } catch {}
    setValue(current)
    return () => { listeners.delete(setValue) }
  }, [])

  return {
    currency,
    setCurrency,
    format: (etb: number) => formatPrice(etb, currency),
  }
}
