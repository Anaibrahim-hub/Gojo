'use client'

import { useState, useRef, useEffect } from 'react'
import { Globe } from 'lucide-react'
import { useLanguage, LANGUAGES } from '@/lib/language-context'

interface Props {
  /** Show only the globe icon, no language code label */
  compact?: boolean
  /** Dropdown opens upward instead of downward */
  dropUp?: boolean
}

export default function LanguagePicker({ compact = false, dropUp = false }: Props) {
  const { language, setLanguage } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all text-xs font-semibold
          ${open ? 'bg-gray-100 text-gray-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
        title="Change language"
      >
        <Globe className="w-4 h-4 flex-shrink-0" />
        {!compact && <span className="uppercase">{language}</span>}
      </button>

      {open && (
        <div className={`absolute right-0 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-[200] min-w-[190px]
          ${dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}
        >
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => { setLanguage(lang.code); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                ${language === lang.code
                  ? 'bg-blue-50 text-blue-600 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50 font-medium'}`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
