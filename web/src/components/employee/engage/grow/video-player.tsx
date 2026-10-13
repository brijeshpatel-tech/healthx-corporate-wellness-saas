"use client"

import { Pause, Play, RotateCcw, TriangleAlert, Volume2, VolumeX } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`

/**
 * Demo video player: cover art, play / pause, seekable progress and captions
 * built from the video's script. Shows "Video can't play right now." when the
 * item has no playable source.
 */
export function VideoPlayer({
  title,
  emoji,
  color,
  durationSec,
  url,
  captions,
}: {
  title: string
  emoji: string
  color: string
  durationSec: number
  url?: string
  captions: string[]
}) {
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [muted, setMuted] = useState(false)
  const playable = !!url
  const ended = time >= durationSec
  const isPlaying = playing && !ended && playable

  useEffect(() => {
    if (!isPlaying) return
    const t = setInterval(() => setTime((s) => Math.min(durationSec, s + 1)), 1000)
    return () => clearInterval(t)
  }, [isPlaying, durationSec])

  const toggle = () => {
    if (!playable) return
    if (ended) {
      setTime(0)
      setPlaying(true)
      return
    }
    setPlaying((p) => !p)
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!playable) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    setTime(Math.round(ratio * durationSec))
  }

  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!playable) return
    if (e.key === "ArrowRight") setTime((s) => Math.min(durationSec, s + 5))
    if (e.key === "ArrowLeft") setTime((s) => Math.max(0, s - 5))
  }

  const pct = durationSec ? (time / durationSec) * 100 : 0
  const caption = captions.length && time > 0 ? captions[Math.min(captions.length - 1, Math.floor((time / durationSec) * captions.length))] : undefined

  return (
    <div className="overflow-hidden rounded-3xl bg-slate-950 shadow-lg ring-1 ring-black/5">
      <div
        className="relative flex aspect-video items-center justify-center overflow-hidden"
        style={{ background: `radial-gradient(80% 90% at 50% 40%, ${color}cc, ${color}55 55%, #020617 100%)` }}
      >
        <span
          className={cn(
            "drop-shadow-xl transition-all duration-500 select-none",
            isPlaying || !playable ? "text-7xl sm:text-8xl" : "absolute top-4 right-5 text-5xl opacity-70 sm:text-6xl",
            isPlaying && "animate-pulse",
          )}
          aria-hidden
        >
          {emoji}
        </span>
        {!isPlaying && playable ? <p className="pointer-events-none absolute bottom-4 left-4 max-w-[70%] font-heading text-sm leading-snug font-bold text-white/90 sm:text-base">{title}</p> : null}
        {isPlaying ? (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
            <span className="flex h-3 items-end gap-0.5" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-0.5 animate-bounce rounded-full bg-emerald-400" style={{ height: 6 + i * 3, animationDelay: `${i * 120}ms` }} />
              ))}
            </span>
            Playing
          </span>
        ) : null}

        {!playable ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 px-6 text-center text-white backdrop-blur-[2px]" role="alert">
            <TriangleAlert className="size-7 text-amber-300" />
            <p className="font-semibold">Video can&apos;t play right now.</p>
            <p className="text-xs text-white/75">Please try again later — you can still read the summary below.</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={toggle}
            aria-label={ended ? "Replay video" : isPlaying ? "Pause video" : "Play video"}
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-opacity focus-visible:outline-none",
              isPlaying ? "opacity-0 hover:opacity-100 focus-visible:opacity-100" : "opacity-100",
            )}
          >
            <span className="flex size-16 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-xl ring-8 ring-white/20 transition-transform hover:scale-105 sm:size-20">
              {ended ? <RotateCcw className="size-7" /> : isPlaying ? <Pause className="size-7 fill-current" /> : <Play className="ml-1 size-7 fill-current" />}
            </span>
          </button>
        )}

        {caption ? (
          <p className="pointer-events-none absolute inset-x-4 bottom-3 mx-auto max-w-lg rounded-lg bg-black/60 px-3 py-1.5 text-center text-xs leading-snug text-white sm:text-sm" aria-live="polite">
            {caption}
          </p>
        ) : null}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 px-3 py-2.5 text-white sm:px-4">
        <button type="button" onClick={toggle} disabled={!playable} aria-label={isPlaying ? "Pause" : "Play"} className="flex size-9 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-40">
          {isPlaying ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
        </button>
        <span className="w-10 text-xs text-white/80 tabular-nums">{clock(time)}</span>
        <div
          role="slider"
          tabIndex={playable ? 0 : -1}
          aria-label={`Seek ${title}`}
          aria-valuemin={0}
          aria-valuemax={durationSec}
          aria-valuenow={time}
          aria-valuetext={`${clock(time)} of ${clock(durationSec)}`}
          onClick={seek}
          onKeyDown={onKey}
          className="group relative h-6 flex-1 cursor-pointer focus-visible:outline-none"
        >
          <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-500 ease-linear" style={{ width: `${pct}%` }} />
          </div>
          <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-[left] duration-500 ease-linear group-focus-visible:ring-4 group-focus-visible:ring-emerald-400/50" style={{ left: `${pct}%` }} />
        </div>
        <span className="w-10 text-right text-xs text-white/80 tabular-nums">{clock(durationSec)}</span>
        <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted} className="flex size-9 items-center justify-center rounded-full hover:bg-white/10">
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      </div>
    </div>
  )
}
