import type { NextConfig } from 'next'

// The dev server runs on plain http://localhost. Forcing https there (HSTS and
// upgrade-insecure-requests) makes Safari request every CSS/JS file over https,
// which fails and leaves the page unstyled, so those two are production-only.
const isDev = process.env.NODE_ENV === 'development'

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://challenges.cloudflare.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://images.unsplash.com https://*.mapbox.com https://*.r2.dev https://media.yevilla.com https://wsrv.nl;
  media-src 'self' blob: https://*.r2.dev https://media.yevilla.com;
  connect-src 'self' https://api.mapbox.com https://events.mapbox.com https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com https://*.workers.dev https://accounts.google.com https://api.mymemory.translated.net;
  font-src 'self' data:;
  worker-src blob:;
  child-src blob:;
  frame-src https://gojo-9e529.firebaseapp.com https://accounts.google.com https://apis.google.com https://challenges.cloudflare.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  ${isDev ? '' : 'upgrade-insecure-requests;'}
`

const securityHeaders = [
  {
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin-allow-popups',
  },
  ...(isDev ? [] : [{
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  }]),
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), browsing-topics=()',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Content-Security-Policy',
    value: ContentSecurityPolicy.replace(/\n/g, '').replace(/\s{2,}/g, ' ').trim(),
  },
]

const isExport = process.env.CF_BUILD === '1'

const nextConfig: NextConfig = {
  ...(isExport ? { output: 'export' } : {}),
  images: {
    unoptimized: isExport,
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.r2.dev' },
      { protocol: 'https', hostname: 'media.yevilla.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
