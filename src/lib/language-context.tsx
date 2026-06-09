'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { translateText, type LangCode, LANGUAGES } from './myMemory'

const LANG_KEY = 'yevilla_language'

// Global in-memory cache: "lang:text" → translated
const cache = new Map<string, string>()

function cacheKey(text: string, lang: LangCode) {
  return `${lang}:${text}`
}

interface LanguageContextValue {
  language: LangCode
  setLanguage: (lang: LangCode) => void
  translate: (text: string) => Promise<string>
  batchTranslate: (texts: string[]) => Promise<string[]>
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState<LangCode>('en')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY)
      if (saved) setLang(saved as LangCode)
    } catch {}
  }, [])

  const setLanguage = useCallback((lang: LangCode) => {
    setLang(lang)
    try { localStorage.setItem(LANG_KEY, lang) } catch {}
  }, [])

  const translate = useCallback(async (text: string): Promise<string> => {
    if (language === 'en' || !text.trim()) return text
    const key = cacheKey(text, language)
    const cached = cache.get(key)
    if (cached !== undefined && cached !== '%' && !cached.startsWith('MYMEMORY')) return cached
    const result = await translateText(text, language)
    if (result !== text) cache.set(key, result)
    return result
  }, [language])

  const batchTranslate = useCallback(async (texts: string[]): Promise<string[]> => {
    if (language === 'en') return texts
    const results = new Array<string>(texts.length)
    const toFetch: { idx: number; text: string }[] = []

    texts.forEach((text, idx) => {
      const key = cacheKey(text, language)
      const cached = cache.get(key)
      if (cached !== undefined && cached !== '%' && !cached.startsWith('MYMEMORY')) {
        results[idx] = cached
      } else {
        toFetch.push({ idx, text })
      }
    })

    if (toFetch.length > 0) {
      const translated = await Promise.all(
        toFetch.map(({ text }) => translateText(text, language))
      )
      toFetch.forEach(({ idx, text }, i) => {
        if (translated[i] !== text) cache.set(cacheKey(text, language), translated[i])
        results[idx] = translated[i]
      })
    }

    return results
  }, [language])

  const value = useMemo(
    () => ({ language, setLanguage, translate, batchTranslate }),
    [language, setLanguage, translate, batchTranslate]
  )

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be inside LanguageProvider')
  return ctx
}

// Translates a screen's static UI strings in one batch.
// Pass a stable object (defined outside the component) as `defaults`.
export function useScreenT<T extends Record<string, string>>(defaults: T): T {
  const { language, batchTranslate } = useLanguage()
  const defaultsRef = useRef(defaults)
  const [strings, setStrings] = useState<T>(defaults)

  useEffect(() => {
    if (language === 'en') {
      setStrings(defaultsRef.current)
      return
    }
    let cancelled = false
    const keys = Object.keys(defaultsRef.current) as (keyof T)[]
    const values = keys.map(k => defaultsRef.current[k])
    batchTranslate(values).then(results => {
      if (cancelled) return
      const out = {} as T
      keys.forEach((k, i) => { out[k] = results[i] as T[keyof T] })
      setStrings(out)
    })
    return () => { cancelled = true }
  }, [language, batchTranslate])

  return strings
}

export { LANGUAGES }
export type { LangCode }
