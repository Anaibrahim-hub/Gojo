'use client'

import { useEffect, useState } from 'react'

// Tracks whether a full-screen search/filter sheet is open so the bottom nav can hide.
let open = false
const listeners = new Set<(v: boolean) => void>()

export function setSearchOpen(v: boolean) {
  open = v
  listeners.forEach(l => l(v))
}

export function useSearchOpen() {
  const [value, setValue] = useState(open)
  useEffect(() => {
    listeners.add(setValue)
    setValue(open)
    return () => { listeners.delete(setValue) }
  }, [])
  return value
}
