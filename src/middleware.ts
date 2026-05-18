import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Known malicious scanner signatures
const BAD_BOTS = /sqlmap|nikto|dirbuster|nessus|masscan|zgrab|python-requests\/[0-1]\.|curl\/[0-6]\.|go-http-client\/1\.|libwww-perl|scrapy|harvest|wget\//i

export function middleware(request: NextRequest) {
  const ua = request.headers.get('user-agent') ?? ''

  // Block requests with no User-Agent or known attack tools
  if (!ua.trim() || BAD_BOTS.test(ua)) {
    return new NextResponse(null, { status: 403 })
  }

  // Block path traversal attempts
  const path = request.nextUrl.pathname
  if (path.includes('..') || path.includes('//')) {
    return new NextResponse(null, { status: 400 })
  }

  const response = NextResponse.next()

  // Expose Cloudflare's verified country header to the app if present
  const country = request.headers.get('cf-ipcountry')
  if (country) response.headers.set('x-country', country)

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)'],
}
