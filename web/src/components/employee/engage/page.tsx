"use client"

import type { LucideIcon } from "lucide-react"
import { AlertTriangle, ChevronRight, RefreshCw } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * Page frame for the employee app's engagement screens (challenges, rewards, settings…).
 * Mobile-first: same gutters as Home; `narrow` for forms/settings, `wide` for grids.
 */
export function EngagePage({
  title,
  description,
  backHref,
  backLabel,
  actions,
  badge,
  size = "default",
  className,
  children,
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  backHref?: string
  backLabel?: string
  actions?: React.ReactNode
  badge?: React.ReactNode
  size?: "narrow" | "default" | "wide"
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("mx-auto flex w-full flex-col gap-5 p-4 sm:p-6", size === "narrow" ? "max-w-2xl" : size === "wide" ? "max-w-6xl" : "max-w-5xl", className)}>
      {title ? <PageHeader title={title} description={description} backHref={backHref} backLabel={backLabel} actions={actions} badge={badge} /> : null}
      {children}
    </div>
  )
}

export type Tone = "emerald" | "sky" | "violet" | "amber" | "rose" | "cyan" | "indigo" | "slate" | "orange" | "teal" | "pink" | "lime"

export const TONE_TILE: Record<Tone, string> = {
  emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  sky: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
  violet: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  rose: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
  cyan: "bg-cyan-500/12 text-cyan-600 dark:text-cyan-400",
  indigo: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-400",
  slate: "bg-slate-500/12 text-slate-600 dark:text-slate-300",
  orange: "bg-orange-500/12 text-orange-600 dark:text-orange-400",
  teal: "bg-teal-500/12 text-teal-600 dark:text-teal-400",
  pink: "bg-pink-500/12 text-pink-600 dark:text-pink-400",
  lime: "bg-lime-500/15 text-lime-700 dark:text-lime-400",
}

/** Rounded square with a tinted icon (same look as the Home tiles). */
export function IconTile({ icon: Icon, tone = "emerald", size = "md", className }: { icon: LucideIcon; tone?: Tone; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl",
        size === "sm" ? "size-8" : size === "lg" ? "size-12 rounded-2xl" : "size-10",
        TONE_TILE[tone],
        className,
      )}
    >
      <Icon className={size === "sm" ? "size-4" : size === "lg" ? "size-6" : "size-5"} />
    </span>
  )
}

/** Emoji on a coloured gradient — covers for challenges, rewards, programs, content. */
export function EmojiCover({
  emoji,
  color,
  size = "md",
  className,
  children,
}: {
  emoji: string
  color: string
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden text-white shadow-sm",
        size === "sm" && "size-10 rounded-xl text-xl",
        size === "md" && "size-14 rounded-2xl text-3xl",
        size === "lg" && "size-20 rounded-2xl text-4xl",
        size === "xl" && "size-28 rounded-3xl text-6xl",
        className,
      )}
      style={{ background: `linear-gradient(135deg, ${color}, ${color}b3)` }}
      aria-hidden
    >
      <span className="drop-shadow-sm">{emoji}</span>
      {children}
    </div>
  )
}

/** Full-width segmented control (big touch targets) for the main tabs of a screen. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: { value: T; label: React.ReactNode; count?: number }[]
  value: T
  onChange: (value: T) => void
  className?: string
  ariaLabel?: string
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn("grid w-full gap-1 rounded-xl bg-muted p-1 sm:w-auto sm:min-w-96", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-all",
              active ? "bg-card text-foreground shadow-sm ring-1 ring-border/60" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="truncate">{o.label}</span>
            {o.count !== undefined ? (
              <span className={cn("rounded-full px-1.5 text-[11px] leading-5 font-semibold tabular-nums", active ? "bg-primary/12 text-primary" : "bg-background/60")}>{o.count}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/** Horizontally scrolling filter chips (categories, types, statuses). */
export function ChipTabs<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: { value: T; label: React.ReactNode; count?: number; icon?: React.ReactNode }[]
  value: T
  onChange: (value: T) => void
  className?: string
  ariaLabel?: string
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn("-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden", className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
              active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {o.icon}
            {o.label}
            {o.count !== undefined ? <span className={cn("rounded-full px-1.5 text-[11px] leading-5 font-semibold tabular-nums", active ? "bg-white/20" : "bg-muted")}>{o.count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

/** Titled group of rows inside one rounded card (settings / profile lists). */
export function MenuGroup({ title, description, children, className }: { title?: React.ReactNode; description?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-2", className)}>
      {title ? (
        <div className="px-1">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}
      <div className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">{children}</div>
    </section>
  )
}

/** One tappable row: icon tile, title, description, value and chevron. */
export function MenuRow({
  icon,
  tone = "slate",
  title,
  description,
  value,
  href,
  onClick,
  trailing,
  badge,
  destructive,
  disabled,
  external,
}: {
  icon?: LucideIcon
  tone?: Tone
  title: React.ReactNode
  description?: React.ReactNode
  value?: React.ReactNode
  href?: string
  onClick?: () => void
  trailing?: React.ReactNode
  badge?: React.ReactNode
  destructive?: boolean
  disabled?: boolean
  external?: boolean
}) {
  const body = (
    <>
      {icon ? <IconTile icon={icon} tone={destructive ? "rose" : tone} size="sm" /> : null}
      <span className="min-w-0 flex-1">
        <span className={cn("flex items-center gap-2 text-sm font-medium", destructive && "text-destructive")}>
          <span className="truncate">{title}</span>
          {badge}
        </span>
        {description ? <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span> : null}
      </span>
      {value !== undefined ? <span className="max-w-[45%] shrink-0 truncate text-right text-sm text-muted-foreground">{value}</span> : null}
      {trailing ?? (href || onClick ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" /> : null)}
    </>
  )
  const cls = cn("flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors", (href || onClick) && !disabled && "hover:bg-muted/50", disabled && "pointer-events-none opacity-50")
  if (href)
    return (
      <Link href={href} className={cls} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} aria-disabled={disabled}>
        {body}
      </Link>
    )
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls} disabled={disabled}>
        {body}
      </button>
    )
  return <div className={cls}>{body}</div>
}

/** Small label/value stat used inside hero cards. */
export function MiniStat({ label, value, hint, className }: { label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 space-y-0.5", className)}>
      <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
      <p className="truncate font-heading text-lg font-bold tabular-nums">{value}</p>
      {hint ? <p className="truncate text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/** Error block with the spec's wording ("Couldn't load challenges.") and a Retry button. */
export function LoadError({ title, error, onRetry, className }: { title: string; error?: unknown; onRetry?: () => void; className?: string }) {
  const message = error instanceof Error ? error.message : undefined
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 px-6 py-12 text-center", className)} role="alert">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="font-heading text-base font-semibold">{title}</p>
        {message ? <p className="max-w-sm text-sm text-muted-foreground">{message}</p> : null}
      </div>
      {onRetry ? (
        <Button variant="outline" size="lg" onClick={onRetry} className="mt-1 rounded-xl px-4">
          <RefreshCw data-icon="inline-start" />
          Retry
        </Button>
      ) : null}
    </div>
  )
}

/** Skeleton list of cards for loading states. */
export function CardListSkeleton({ count = 4, className, itemClassName }: { count?: number; className?: string; itemClassName?: string }) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn("h-40 rounded-2xl", itemClassName)} />
      ))}
    </div>
  )
}
