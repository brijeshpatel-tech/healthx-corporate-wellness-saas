"use client"

import { Coins } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const CONFETTI_COLORS = ["#10b981", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6", "#f97316", "#14b8a6", "#facc15"]

/**
 * Lightweight CSS confetti (no packages). Positions are deterministic per index so
 * rendering stays pure; the animation plays once when mounted.
 */
export function Confetti({ pieces = 70, className, loop = false }: { pieces?: number; className?: string; loop?: boolean }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <style>{`
        @keyframes hx-confetti-fall {
          0% { transform: translate3d(0, -20px, 0) rotate(0deg); opacity: 0; }
          8% { opacity: 1; }
          100% { transform: translate3d(var(--hx-drift), 620px, 0) rotate(var(--hx-spin)); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) { .hx-confetti-piece { animation: none !important; display: none; } }
      `}</style>
      {Array.from({ length: pieces }).map((_, i) => {
        const left = (i * 37 + 11) % 100
        const delay = ((i * 53) % 900) / 1000
        const duration = 1.8 + ((i * 29) % 140) / 100
        const size = 6 + ((i * 17) % 7)
        const drift = (((i * 71) % 160) - 80) / 1
        const spin = 240 + ((i * 97) % 600)
        const round = i % 3 === 0
        return (
          <span
            key={i}
            className="hx-confetti-piece absolute top-0 block"
            style={
              {
                left: `${left}%`,
                width: size,
                height: round ? size : size * 0.45,
                borderRadius: round ? "9999px" : "2px",
                backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                animation: `hx-confetti-fall ${duration}s cubic-bezier(.2,.6,.4,1) ${delay}s ${loop ? "infinite" : "1"} both`,
                "--hx-drift": `${drift}px`,
                "--hx-spin": `${spin}deg`,
              } as React.CSSProperties
            }
          />
        )
      })}
    </div>
  )
}

/** Glowing emoji medallion used by celebrations and badge grids. */
export function Medallion({ emoji, color, size = "lg", locked, className }: { emoji: string; color: string; size?: "sm" | "md" | "lg" | "xl"; locked?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full",
        size === "sm" && "size-12 text-2xl",
        size === "md" && "size-16 text-3xl",
        size === "lg" && "size-24 text-5xl",
        size === "xl" && "size-32 text-6xl",
        locked && "grayscale",
        className,
      )}
      style={{
        background: locked ? "var(--muted)" : `radial-gradient(circle at 30% 25%, ${color}55, ${color}22 60%, transparent 72%), linear-gradient(145deg, ${color}33, ${color}14)`,
        boxShadow: locked ? undefined : `0 0 0 3px ${color}40, 0 10px 30px -8px ${color}80`,
      }}
      aria-hidden
    >
      <span className={cn(locked && "opacity-40")}>{emoji}</span>
    </span>
  )
}

/**
 * Full-screen-feeling celebration (badge unlocked, challenge complete, order placed).
 * Children render as the action area.
 */
export function CelebrationDialog({
  open,
  onOpenChange,
  emoji,
  color = "#10b981",
  eyebrow,
  title,
  description,
  points,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  emoji: string
  color?: string
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  points?: number
  children?: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-0 p-0 sm:max-w-md">
        <div className="relative flex flex-col items-center gap-4 px-6 pt-10 pb-6 text-center" style={{ background: `radial-gradient(120% 70% at 50% 0%, ${color}30, transparent 70%)` }}>
          {open ? <Confetti /> : null}
          <div className="animate-in duration-700 zoom-in-50 fade-in-0">
            <Medallion emoji={emoji} color={color} size="xl" />
          </div>
          <div className="relative space-y-1.5">
            {eyebrow ? <p className="text-xs font-semibold tracking-wide uppercase" style={{ color }}>{eyebrow}</p> : null}
            <DialogTitle className="font-heading text-2xl font-extrabold tracking-tight">{title}</DialogTitle>
            {description ? <DialogDescription className="text-sm text-muted-foreground">{description}</DialogDescription> : <DialogDescription className="sr-only">Celebration</DialogDescription>}
          </div>
          {points ? (
            <span className="relative inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3.5 py-1.5 text-sm font-bold text-amber-700 dark:text-amber-300">
              <Coins className="size-4" /> +{points} points
            </span>
          ) : null}
          {children ? <div className="relative flex w-full flex-col gap-2 pt-2 sm:flex-row sm:justify-center">{children}</div> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
