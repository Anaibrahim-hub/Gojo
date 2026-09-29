/**
 * One <video> element shared by every video tour on the site.
 *
 * Browsers (iPhone Safari especially) only let a video play with sound after a tap,
 * and Safari grants that per element. Reusing a single element — unlocked by the tap
 * that opens a tour, then moved into whichever reel or listing is on screen — keeps
 * the sound on while swiping between tours.
 */

let el: HTMLVideoElement | null = null
// Where each tour was left off, so returning to it (e.g. closing the listing) resumes.
const positions = new Map<string, number>()

export function sharedVideo(): HTMLVideoElement {
  if (!el) {
    el = document.createElement('video')
    el.playsInline = true
    el.setAttribute('playsinline', '')
    el.preload = 'auto'
  }
  return el
}

/** Point the shared element at `src`, resuming where that tour was left off. */
export function loadSharedVideo(src: string) {
  const v = sharedVideo()
  const current = v.getAttribute('src')
  if (current === src) return
  if (current) positions.set(current, v.currentTime)
  v.src = src
  const resumeAt = positions.get(src)
  if (resumeAt) v.addEventListener('loadedmetadata', () => { v.currentTime = resumeAt }, { once: true })
}

/**
 * Call synchronously inside the tap that opens a tour: starting playback during the
 * tap unlocks sound for the shared element (and gets the download going early).
 */
export function primeSharedVideo(src: string) {
  if (typeof document === 'undefined') return
  const v = sharedVideo()
  loadSharedVideo(src)
  v.muted = false
  v.play().catch(() => {})
}
