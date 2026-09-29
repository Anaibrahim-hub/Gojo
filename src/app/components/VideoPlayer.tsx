'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from 'lucide-react'
import { img } from '@/lib/image'
import { cn } from './ui/utils'

const SKIP_SECONDS = 10

function formatTime(t: number): string {
  if (!Number.isFinite(t) || t < 0) t = 0
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Listing video with full controls: a big play button, then play/pause,
 * rewind/forward 10 s, a seekable timeline, time, mute, and full screen.
 */
export default function VideoPlayer({
  src,
  poster,
  title,
  active = true,
  autoPlay = false,
  loop = false,
  preload = false,
  controlsPosition = 'bottom',
  hideControlsOnMobile = false,
  className,
  children,
}: {
  src: string
  /** Photo shown before the video starts. */
  poster?: string
  title: string
  /** When false the video pauses (e.g. scrolled away or on another slide). */
  active?: boolean
  /**
   * Start playing whenever it becomes active, with sound when the browser allows it
   * (the tap that opened the feed counts); otherwise muted until the next tap.
   */
  autoPlay?: boolean
  /** Repeat at the end (feed videos) instead of stopping (listing player). */
  loop?: boolean
  /** Buffer the video ahead of time (e.g. the next reel) so it starts without a flash. */
  preload?: boolean
  /**
   * Where the control bar sits: 'bottom' (inside a gallery slide) or 'screen-bottom'
   * (a full-screen page: pinned to the bottom edge, clear of the phone's home bar).
   */
  controlsPosition?: 'bottom' | 'screen-bottom'
  /** Phones get tap-to-play only (for a vertical swipe feed); desktop keeps the bar. */
  hideControlsOnMobile?: boolean
  className?: string
  children?: React.ReactNode
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [started, setStarted] = useState(false)
  // Autoplay feeds only show the big play button when the viewer paused (or playback
  // was refused), so it doesn't flash while swiping between videos.
  const [showPlayButton, setShowPlayButton] = useState(false)
  // Frames are actually moving (the `play` event fires before any have loaded).
  const [rendering, setRendering] = useState(false)
  // Muted by the browser's autoplay policy rather than by the viewer.
  const autoMutedRef = useRef(false)

  const play = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    // Retry with sound: a tap since the last attempt may have unlocked it.
    if (autoMutedRef.current) { v.muted = false; setMuted(false); autoMutedRef.current = false }
    v.play().catch(() => {
      // Autoplay with sound is blocked: retry muted.
      v.muted = true
      setMuted(true)
      autoMutedRef.current = true
      v.play().catch(() => setShowPlayButton(true))
    })
  }, [])

  // React doesn't reliably update the `muted` property after mount, so set it directly.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted
  }, [muted])

  // Pause when inactive; autoplay when it becomes active.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (!active) v.pause()
    else if (autoPlay) play()
  }, [active, autoPlay, play])

  useEffect(() => {
    const onChange = () => {
      const el = containerRef.current
      const isFull = document.fullscreenElement === el
      setFullscreen(prev => {
        // Leaving full screen can reset a scroll-snap gallery's position; bring
        // the player back into view instead of landing on another slide.
        if (prev && !isFull) requestAnimationFrame(() => el?.scrollIntoView({ block: 'nearest', inline: 'nearest' }))
        return isFull
      })
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggle = () => {
    const v = videoRef.current
    if (!v) return
    // The first tap on an autoplaying video that the browser muted turns the sound on.
    if (autoMutedRef.current && !v.paused) {
      v.muted = false
      setMuted(false)
      autoMutedRef.current = false
      return
    }
    if (v.paused) play()
    else { v.pause(); setShowPlayButton(true) }
  }

  const seekTo = (t: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min(duration || v.duration || 0, t))
    setTime(v.currentTime)
  }

  const toggleFullscreen = () => {
    const el = containerRef.current
    const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    if (!el || !v) return
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return }
    if (el.requestFullscreen) el.requestFullscreen().catch(() => v.webkitEnterFullscreen?.())
    else v.webkitEnterFullscreen?.() // iPhone Safari only supports native video full screen
  }

  // Keyboard: space/K play-pause, ←/→ seek, M mute, F full screen (only while active).
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      const v = videoRef.current
      if (!v) return
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); seekTo(v.currentTime - 5) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); seekTo(v.currentTime + 5) }
      else if (e.key === 'm') { autoMutedRef.current = false; setMuted(m => !m) }
      else if (e.key === 'f') toggleFullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const progress = duration ? (time / duration) * 100 : 0

  return (
    <div ref={containerRef} className={cn('group/video relative overflow-hidden bg-foreground', fullscreen && 'bg-black', className)}>
      {/* The poster sits behind the video rather than on it (a <video poster> stays up
          until playback begins). Autoplaying videos skip it entirely — a still photo
          before the video reads as a stall — and show a spinner while loading instead. */}
      {poster && !autoPlay && (
        <img src={img(poster, { width: 1080 })} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
      )}
      <video
        ref={videoRef}
        src={src}
        muted={muted}
        loop={loop}
        playsInline
        preload={active || preload ? 'auto' : 'metadata'}
        aria-label={title}
        onClick={toggle}
        onPlay={() => { setPlaying(true); setStarted(true); setShowPlayButton(false) }}
        onPlaying={() => setRendering(true)}
        onWaiting={() => setRendering(false)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setShowPlayButton(true) }}
        onTimeUpdate={e => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
        onDurationChange={e => setDuration(e.currentTarget.duration)}
        className={cn('absolute inset-0 h-full w-full cursor-pointer', fullscreen ? 'object-contain' : 'object-cover')}
      />

      {autoPlay && active && !rendering && !showPlayButton && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border-2 border-background/30 border-t-background" aria-label="Loading video" />
      )}

      {/* Big play button while paused */}
      {!playing && (!autoPlay || showPlayButton) && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Play video"
          className="absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow-lg transition-transform hover:scale-105"
        >
          <Play className="ml-1 h-7 w-7 fill-foreground" />
        </button>
      )}

      {/* Control bar */}
      <div
        className={cn(
          hideControlsOnMobile && 'max-md:hidden',
          'absolute inset-x-3 z-10 flex items-center gap-2 rounded-2xl bg-foreground/55 px-3 py-2 text-background backdrop-blur transition-opacity',
          controlsPosition === 'screen-bottom' ? 'bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] md:inset-x-10 md:bottom-6' : 'bottom-8',
          fullscreen && 'bottom-6 top-auto',
          // Stay visible while paused / before first play; fade during playback until hovered.
          // (a full-screen page keeps them visible so they're easy to find)
          playing && started && controlsPosition !== 'screen-bottom'
            ? 'opacity-100 md:opacity-0 md:group-hover/video:opacity-100 md:focus-within:opacity-100'
            : 'opacity-100',
        )}
      >
        <ControlButton label={playing ? 'Pause' : 'Play'} onClick={toggle}>
          {playing ? <Pause className="h-4 w-4 fill-background" /> : <Play className="h-4 w-4 fill-background" />}
        </ControlButton>
        <ControlButton label={`Rewind ${SKIP_SECONDS} seconds`} onClick={() => seekTo(time - SKIP_SECONDS)}>
          <RotateCcw className="h-4 w-4" />
        </ControlButton>
        <ControlButton label={`Forward ${SKIP_SECONDS} seconds`} onClick={() => seekTo(time + SKIP_SECONDS)}>
          <RotateCw className="h-4 w-4" />
        </ControlButton>
        <span className="shrink-0 text-xs font-semibold tabular-nums">{formatTime(time)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(time, duration || 0)}
          onChange={e => seekTo(Number(e.target.value))}
          aria-label="Seek"
          aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
          onPointerDown={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
          style={{ background: `linear-gradient(to right, white ${progress}%, rgba(255,255,255,0.35) ${progress}%)` }}
          className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full [touch-action:none] [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
        />
        <span className="shrink-0 text-xs font-semibold tabular-nums opacity-80">{formatTime(duration)}</span>
        <ControlButton label={muted ? 'Unmute' : 'Mute'} onClick={() => { autoMutedRef.current = false; setMuted(m => !m) }}>
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </ControlButton>
        <ControlButton label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={toggleFullscreen}>
          {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </ControlButton>
      </div>

      {children}
    </div>
  )
}

function ControlButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-background/20"
    >
      {children}
    </button>
  )
}
