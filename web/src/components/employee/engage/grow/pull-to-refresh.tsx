"use client"

import { RefreshCw } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

const THRESHOLD = 72
const MAX = 120

/**
 * Touch pull-to-refresh (phones). Desktop users get the Refresh button instead.
 * Only starts when the page is scrolled to the very top.
 */
export function PullToRefresh({ onRefresh, refreshing, children, className }: { onRefresh: () => void; refreshing?: boolean; children: React.ReactNode; className?: string }) {
  const [pull, setPull] = useState(0)
  const startY = useRef<number | null>(null)
  const current = useRef(0)

  // Stop the browser's own pull-to-reload while this screen is open.
  useEffect(() => {
    const html = document.documentElement
    const previous = html.style.overscrollBehaviorY
    html.style.overscrollBehaviorY = "contain"
    return () => {
      html.style.overscrollBehaviorY = previous
    }
  }, [])

  const onTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY > 0 || refreshing) return
    startY.current = e.touches[0]?.clientY ?? null
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return
    const dy = (e.touches[0]?.clientY ?? 0) - startY.current
    if (dy <= 0 || window.scrollY > 0) {
      current.current = 0
      setPull(0)
      return
    }
    const next = Math.min(MAX, dy * 0.5)
    current.current = next
    setPull(next)
  }
  const onTouchEnd = () => {
    if (startY.current === null) return
    startY.current = null
    if (current.current >= THRESHOLD) onRefresh()
    current.current = 0
    setPull(0)
  }

  const shown = refreshing ? 52 : pull
  const ready = pull >= THRESHOLD
  return (
    <div className={cn("relative", className)} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center"
        style={{ height: shown, opacity: shown ? 1 : 0, transition: pull ? "none" : "height 200ms ease, opacity 200ms ease" }}
        aria-hidden={!refreshing}
      >
        <span className={cn("mt-2 flex size-9 items-center justify-center rounded-full border bg-card shadow-md", ready || refreshing ? "text-primary" : "text-muted-foreground")}>
          <RefreshCw className={cn("size-4", refreshing && "animate-spin")} style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }} />
        </span>
      </div>
      <div style={{ transform: shown ? `translateY(${shown}px)` : undefined, transition: pull ? "none" : "transform 200ms ease" }}>{children}</div>
      {refreshing ? (
        <span className="sr-only" role="status">
          Refreshing your feed
        </span>
      ) : null}
    </div>
  )
}
