'use client'

import { CURRENCIES, useCurrency } from '@/lib/currency'
import { cn } from './ui/utils'

export default function CurrencyToggle({ className }: { className?: string }) {
  const { currency, setCurrency } = useCurrency()
  return (
    <div
      role="group"
      aria-label="Display currency"
      className={cn('flex shrink-0 items-center rounded-full border border-border bg-muted p-0.5', className)}
    >
      {CURRENCIES.map(code => (
        <button
          key={code}
          type="button"
          onClick={() => setCurrency(code)}
          aria-pressed={currency === code}
          className={cn(
            'rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors',
            currency === code ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {code}
        </button>
      ))}
    </div>
  )
}
