import type { useRouter } from 'next/navigation'

type Router = ReturnType<typeof useRouter>

/**
 * Go to /listings with the given query string. When already on /listings the
 * URL is changed through the History API (which Next syncs to useSearchParams)
 * instead of the router: in the static export, router.push/replace to the same
 * path with a different query is silently dropped after a load that already
 * had a query string.
 */
export function goToListings(router: Router, qs: string, { replace = false }: { replace?: boolean } = {}) {
  const href = `/listings${qs ? `?${qs}` : ''}`
  if (window.location.pathname.replace(/\/$/, '') === '/listings') {
    if (replace) window.history.replaceState(null, '', href)
    else window.history.pushState(null, '', href)
    return
  }
  if (replace) router.replace(href, { scroll: false })
  else router.push(href)
}
