'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Clock, MapPin, Search, X } from 'lucide-react'
import { cn } from './ui/utils'
import { useListings } from '@/lib/listings-context'
import { goToListings } from '@/lib/listings-nav'

const RECENT_KEY = 'gojo_header_recent_searches'
const MAX_RECENT = 4
const MAX_SUGGESTIONS = 8

type Suggestion =
  | { kind: 'query'; value: string }
  | { kind: 'recent'; value: string }
  | { kind: 'place'; value: string; count: number }

function loadRecent(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    if (!Array.isArray(stored)) return []
    return stored.filter((v): v is string => typeof v === 'string').slice(0, MAX_RECENT)
  } catch { return [] }
}

function saveRecent(value: string) {
  try {
    const next = [value, ...loadRecent().filter(v => v.toLowerCase() !== value.toLowerCase())].slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {}
}

/**
 * Header search box. Clicking it shows suggestions right away (recent searches,
 * then popular places from real listings); typing narrows them as you go.
 */
export default function HeaderSearch({
  className,
  onActiveChange,
}: {
  className?: string
  /** Called when the search opens/closes, so the header can make room for it on phones. */
  onActiveChange?: (active: boolean) => void
}) {
  const router = useRouter()
  const params = useSearchParams()
  const { listings } = useListings()
  const currentPlace = params.get('place') ?? params.get('q') ?? ''
  const [query, setQuery] = useState(currentPlace)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [recent, setRecent] = useState<string[]>([])
  // Whether the user has typed since opening; until then show the full list even
  // if the box already holds the current search.
  const [typed, setTyped] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  useEffect(() => { setQuery(currentPlace) }, [currentPlace])
  useEffect(() => { onActiveChange?.(open) }, [open, onActiveChange])

  const cancel = () => {
    setOpen(false)
    setQuery(currentPlace)
    inputRef.current?.blur()
  }

  // Close when clicking or tabbing outside
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // Cities and neighborhoods from real listings, most listings first
  const places = useMemo(() => {
    const counts = new Map<string, number>()
    for (const l of listings) {
      for (const p of new Set([l.city, l.subCity].filter(Boolean) as string[])) {
        counts.set(p, (counts.get(p) ?? 0) + 1)
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }))
  }, [listings])

  const trimmed = typed ? query.trim() : ''
  const suggestions = useMemo<Suggestion[]>(() => {
    const q = trimmed.toLowerCase()
    if (!q) {
      return [
        ...recent.map(value => ({ kind: 'recent' as const, value })),
        ...places
          .filter(p => !recent.some(r => r.toLowerCase() === p.value.toLowerCase()))
          .slice(0, MAX_SUGGESTIONS - recent.length)
          .map(p => ({ kind: 'place' as const, ...p })),
      ]
    }
    const matches = places
      .filter(p => p.value.toLowerCase().includes(q))
      .sort((a, b) => Number(b.value.toLowerCase().startsWith(q)) - Number(a.value.toLowerCase().startsWith(q)))
      .slice(0, MAX_SUGGESTIONS - 1)
      .map(p => ({ kind: 'place' as const, ...p }))
    const exact = matches.some(m => m.value.toLowerCase() === q)
    return exact ? matches : [{ kind: 'query' as const, value: trimmed }, ...matches]
  }, [trimmed, places, recent])

  useEffect(() => { setHighlight(-1) }, [trimmed, open])

  const openMenu = () => {
    setRecent(loadRecent())
    setTyped(false)
    setOpen(true)
  }

  const submit = (value: string) => {
    const v = value.trim()
    setQuery(v)
    setOpen(false)
    inputRef.current?.blur()
    if (v) saveRecent(v)
    const next = new URLSearchParams(params.toString())
    next.delete('q')
    next.delete('open')
    if (v) next.set('place', v)
    else next.delete('place')
    goToListings(router, next.toString())
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) openMenu()
      setHighlight(h => Math.min(h + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      submit(highlight >= 0 && suggestions[highlight] ? suggestions[highlight].value : query)
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  const showMenu = open && suggestions.length > 0
  const firstPlaceIndex = suggestions.findIndex(s => s.kind === 'place')

  return (
    <div ref={wrapRef} className={cn('relative flex min-w-0 flex-1 items-center gap-2', className)}>
      <div
        className={cn(
          'flex h-12 min-w-0 flex-1 items-center rounded-full border bg-background pl-5 pr-1.5 shadow-sm transition-shadow',
          open ? 'border-foreground/20 shadow-md' : 'border-border hover:shadow-md',
        )}
      >
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showMenu}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={highlight >= 0 ? `${listId}-${highlight}` : undefined}
          aria-label="Search by city or neighborhood"
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          placeholder="Anywhere in Ethiopia"
          onFocus={e => { openMenu(); e.currentTarget.select() }}
          onClick={() => { if (!open) openMenu() }}
          onChange={e => {
            setQuery(e.target.value)
            if (!open) openMenu()
            setTyped(true)
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-base font-semibold text-foreground outline-none md:text-sm placeholder:font-medium placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => { setQuery(''); setTyped(true); inputRef.current?.focus() }}
            className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          aria-label="Search"
          onClick={() => submit(query)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>

      {/* Phones: the search takes over the header row, so give an obvious way out */}
      {open && (
        <button
          type="button"
          onClick={cancel}
          className="shrink-0 px-1 text-sm font-semibold text-foreground md:hidden"
        >
          Cancel
        </button>
      )}

      {showMenu && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search suggestions"
          className="fixed inset-x-3 top-[4.75rem] z-50 max-h-[min(24rem,70vh)] overflow-y-auto rounded-2xl border border-border bg-popover py-2 shadow-xl md:absolute md:inset-x-auto md:left-0 md:top-[calc(100%+0.5rem)] md:w-[28rem] md:min-w-full"
        >
          {suggestions.map((s, i) => (
            <li key={`${s.kind}-${s.value}`} role="presentation">
              {s.kind === 'recent' && i === 0 && <GroupLabel>Recent searches</GroupLabel>}
              {s.kind === 'place' && i === firstPlaceIndex && (
                <GroupLabel>{trimmed ? 'Places' : 'Popular places'}</GroupLabel>
              )}
              <div
                id={`${listId}-${i}`}
                role="option"
                aria-selected={highlight === i}
                // Keep focus in the input so the click registers before blur
                onPointerDown={e => e.preventDefault()}
                onClick={() => submit(s.value)}
                onPointerEnter={() => setHighlight(i)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 px-4 py-2.5',
                  highlight === i && 'bg-muted',
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                  {s.kind === 'recent' ? <Clock className="h-4 w-4" /> : s.kind === 'query' ? <Search className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {s.kind === 'query' ? <>Search for &ldquo;{s.value}&rdquo;</> : <Highlighted text={s.value} query={trimmed} />}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {s.kind === 'place' ? `${s.count} ${s.count === 1 ? 'home' : 'homes'} · Ethiopia` : s.kind === 'recent' ? 'Recent search' : 'Anywhere it appears in a listing'}
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>
}

/** Bolds the part of `text` that matches the typed query. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const i = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent text-primary">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  )
}
