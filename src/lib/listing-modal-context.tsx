'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import ListingSheet from '@/app/components/ListingSheet'
import type { Property } from '@/app/data/properties'
import type { Mode } from './listing-utils'

interface ListingModalContextValue {
  /** The listing currently shown in the modal, if any. */
  current: Property | null
  openListing: (p: Property, opts?: { mode?: Mode | null; onClose?: () => void }) => void
}

const ListingModalContext = createContext<ListingModalContextValue | null>(null)

// One shared listing sheet for the whole app, so any card or reel can open a listing.
export function ListingModalProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Property | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)
  const onCloseRef = useRef<(() => void) | undefined>(undefined)

  const openListing = useCallback<ListingModalContextValue['openListing']>((p, opts) => {
    onCloseRef.current = opts?.onClose
    setMode(opts?.mode ?? null)
    setCurrent(p)
  }, [])

  const close = useCallback(() => {
    setCurrent(null)
    const cb = onCloseRef.current
    onCloseRef.current = undefined
    cb?.()
  }, [])

  const value = useMemo(() => ({ current, openListing }), [current, openListing])

  return (
    <ListingModalContext.Provider value={value}>
      {children}
      <ListingSheet listing={current} mode={mode} onClose={close} />
    </ListingModalContext.Provider>
  )
}

export function useListingModal() {
  const ctx = useContext(ListingModalContext)
  if (!ctx) throw new Error('useListingModal must be used inside ListingModalProvider')
  return ctx
}
