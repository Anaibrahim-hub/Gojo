'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react'
import { apiListingToProperty, type Property } from '@/app/data/properties'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''

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
    fetchingRef.current = true
    try {
      const res = await fetch(`${WORKER_URL}/listings?page=${page}`)
      if (!res.ok) return
      const data = await res.json() as { listings: Record<string, unknown>[]; hasMore: boolean }
      const props = data.listings.map(apiListingToProperty)
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
