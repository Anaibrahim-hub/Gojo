// Free image resizing via wsrv.nl (images.weserv.nl) — a free, Cloudflare-backed
// image-resizing proxy. No account, no per-transform cost.
//
// Property photos in R2 are served full-size (~1080px JPEGs). On a listings grid
// that's dozens of full-resolution downloads — the biggest bandwidth cost for users
// on slow mobile links. This rewrites an R2 image URL so wsrv.nl fetches it once,
// then serves a width-capped WebP variant (typically ~80% smaller).
//
// Enabled by default. To disable (serve original full-size images) set
// NEXT_PUBLIC_IMAGE_RESIZE=0. wsrv.nl must be allowed in img-src (see next.config.ts).

const R2 = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '').replace(/\/$/, '')
const ENABLED = (process.env.NEXT_PUBLIC_IMAGE_RESIZE ?? '1') !== '0'

interface ImgOpts {
  width: number
  quality?: number
}

export function img(url: string | undefined | null, { width, quality = 75 }: ImgOpts): string {
  if (!url) return ''
  if (!ENABLED) return url
  // Only proxy real http(s) images, and (when R2 is configured) only our own assets.
  if (!/^https?:\/\//.test(url)) return url
  if (R2 && !url.startsWith(R2)) return url
  // `we` = never enlarge (don't upscale photos already smaller than the target).
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&q=${quality}&output=webp&we`
}
