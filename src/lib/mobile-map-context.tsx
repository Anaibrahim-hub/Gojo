'use client'
import { createContext, useContext, useState } from 'react'

const Ctx = createContext<{ open: boolean; setOpen: (v: boolean) => void }>({
  open: false, setOpen: () => {},
})

export function MobileMapProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return <Ctx.Provider value={{ open, setOpen }}>{children}</Ctx.Provider>
}

export function useMobileMap() { return useContext(Ctx) }
