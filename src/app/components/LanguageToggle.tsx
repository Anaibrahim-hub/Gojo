'use client'

import { useEffect, useRef, useState } from 'react'
import { Globe, Check } from 'lucide-react'
import { useLanguage, type LangCode } from '@/lib/language-context'

const LANGUAGES: { code: LangCode; label: string; short: string }[] = [
  { code: 'am', label: 'አማርኛ (Amharic)', short: 'አማ' },
  { code: 'om', label: 'Afaan Oromoo (Oromo)', short: 'OM' },
  { code: 'ti', label: 'ትግርኛ (Tigrinya)', short: 'ትግ' },
  { code: 'en', label: 'English', short: 'EN' },
]

/** `align="right"` opens the list leftward, for a toggle at the right edge of the screen. */
export default function LanguageToggle({ align = 'left' }: { align?: 'left' | 'right' }) {
  const { language, setLanguage } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const current = LANGUAGES.find(l => l.code === language) ?? LANGUAGES[3]

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Change language"
        aria-expanded={open}
        className="flex h-10 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm font-semibold text-foreground shadow-sm transition hover:shadow-md"
      >
        <Globe className="h-4 w-4 text-primary" />
        {current.short}
      </button>
      {open && (
        <ul className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-12 z-50 w-56 overflow-hidden rounded-2xl border border-border bg-popover py-1 shadow-lg`}>
          {LANGUAGES.map(l => (
            <li key={l.code}>
              <button
                type="button"
                onClick={() => { setLanguage(l.code); setOpen(false) }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-popover-foreground hover:bg-muted"
              >
                {l.label}
                {l.code === language && <Check className="h-4 w-4 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
