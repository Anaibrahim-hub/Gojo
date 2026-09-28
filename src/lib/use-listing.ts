'use client'

import { useEffect } from 'react'
import { useListings } from './listings-context'
import { listingKey } from './listing-utils'

/**
 * Finds a listing by firestore id (or numeric id) in the shared listings cache,
 * paging further through /listings until it turns up or pages run out.
 */
export function useListing(id: string | null) {
  const { listings, loading, loadingMore, hasMore, loadMore } = useListings()
  const listing = id ? listings.find(l => listingKey(l) === id) ?? null : null

  useEffect(() => {
    if (id && !listing && !loading && !loadingMore && hasMore) loadMore()
  }, [id, listing, loading, loadingMore, hasMore, loadMore])

  const searching = !!id && !listing && (loading || loadingMore || hasMore)
  return { listing, searching }
}
