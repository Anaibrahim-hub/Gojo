'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react'
import { apiListingToProperty, type Property } from '@/app/data/properties'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''

// Module-level cache so re-mounting (e.g. navigating back) is instant
const PAGE_CACHE: Map<number, { props: Property[]; ts: number }> = new Map()
const CACHE_TTL = 60_000 // 60 s

interface ListingsContextValue {
  listings: Property[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  loadMore: () => void
}

const ListingsContext = createContext<ListingsContextValue | null>(null)

export function ListingsProvider({ children }: { children: ReactNode }) {
  const [listings, setListings] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const pageRef = useRef(1)
  const fetchingRef = useRef(false)

  const fetchPage = useCallback(async (page: number, append: boolean) => {
    if (!WORKER_URL) { setLoading(false); return }
    if (fetchingRef.current) return

    // Serve from cache immediately, then revalidate in background
    const cached = PAGE_CACHE.get(page)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      if (append) {
        setListings(prev => [...prev, ...cached.props])
        setLoadingMore(false)
      } else {
        setListings(cached.props)
        setLoading(false)
      }
      pageRef.current = page
      return
    }

    fetchingRef.current = true
    try {
      const res = await fetch(`${WORKER_URL}/listings?page=${page}`)
      if (!res.ok) return
      const data = await res.json() as { listings: Record<string, unknown>[]; hasMore: boolean }
      const props = data.listings.map(apiListingToProperty)
      PAGE_CACHE.set(page, { props, ts: Date.now() })
      if (append) {
        setListings(prev => [...prev, ...props])
      } else {
        setListings(props)
      }
      setHasMore(data.hasMore)
      pageRef.current = page
    } catch {
      // worker unavailable
    } finally {
      fetchingRef.current = false
      if (append) setLoadingMore(false)
      else setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPage(1, false) }, [fetchPage])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    fetchPage(pageRef.current + 1, true)
  }, [loadingMore, hasMore, fetchPage])

  const value = useMemo(
    () => ({ listings, loading, loadingMore, hasMore, loadMore }),
    [listings, loading, loadingMore, hasMore, loadMore]
  )

  return (
    <ListingsContext.Provider value={value}>
      {children}
    </ListingsContext.Provider>
  )
}

export function useListings() {
  const ctx = useContext(ListingsContext)
  if (!ctx) throw new Error('useListings must be used inside ListingsProvider')
  return ctx
}
