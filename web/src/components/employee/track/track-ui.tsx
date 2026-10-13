"use client"

/** Building blocks for the employee app's tracking screens (mobile-first, app-like). */
import { ChevronLeft, ChevronRight, Info, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { PhaseBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type Tone = "sky" | "cyan" | "violet" | "emerald" | "indigo" | "orange" | "amber" | "rose" | "teal" | "slate"

export const TONE: Record<Tone, { bubble: string; text: string; solid: string; soft: string; ring: string }> = {
  sky: { bubble: "bg-sky-500/12 text-sky-600 dark:text-sky-400", text: "text-sky-600 dark:text-sky-400", solid: "bg-sky-500", soft: "bg-sky-500/8", ring: "#0ea5e9" },
  cyan: { bubble: "bg-cyan-500/12 text-cyan-600 dark:text-cyan-400", text: "text-cyan-600 dark:text-cyan-400", solid: "bg-cyan-500", soft: "bg-cyan-500/8", ring: "#06b6d4" },
  violet: { bubble: "bg-violet-500/12 text-violet-600 dark:text-violet-400", text: "text-violet-600 dark:text-violet-400", solid: "bg-violet-500", soft: "bg-violet-500/8", ring: "#8b5cf6" },
  emerald: { bubble: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400", text: "text-emerald-600 dark:text-emerald-400", solid: "bg-emerald-500", soft: "bg-emerald-500/8", ring: "#10b981" },
  indigo: { bubble: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-400", text: "text-indigo-600 dark:text-indigo-400", solid: "bg-indigo-500", soft: "bg-indigo-500/8", ring: "#6366f1" },
  orange: { bubble: "bg-orange-500/12 text-orange-600 dark:text-orange-400", text: "text-orange-600 dark:text-orange-400", solid: "bg-orange-500", soft: "bg-orange-500/8", ring: "#f97316" },
  amber: { bubble: "bg-amber-500/15 text-amber-600 dark:text-amber-400", text: "text-amber-600 dark:text-amber-400", solid: "bg-amber-500", soft: "bg-amber-500/8", ring: "#f59e0b" },
  rose: { bubble: "bg-rose-500/12 text-rose-600 dark:text-rose-400", text: "text-rose-600 dark:text-rose-400", solid: "bg-rose-500", soft: "bg-rose-500/8", ring: "#f43f5e" },
  teal: { bubble: "bg-teal-500/12 text-teal-600 dark:text-teal-400", text: "text-teal-600 dark:text-teal-400", solid: "bg-teal-500", soft: "bg-teal-500/8", ring: "#14b8a6" },
  slate: { bubble: "bg-muted text-muted-foreground", text: "text-muted-foreground", solid: "bg-slate-500", soft: "bg-muted/50", ring: "#64748b" },
}

/** Page body for tracking screens (same rhythm as Home). */
export function TrackPage({ children, className, narrow }: { children: React.ReactNode; className?: string; narrow?: boolean }) {
  return <div className={cn("mx-auto flex w-full flex-col gap-5 p-4 sm:p-6", narrow ? "max-w-2xl" : "max-w-5xl", className)}>{children}</div>
}

/** App-style page title with optional back link, Phase badge and actions. */
export function TrackHeader({
  title,
  subtitle,
  backHref,
  backLabel = "Back",
  phase,
  actions,
  className,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  backHref?: string
  backLabel?: string
  phase?: 2 | 3
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {backHref ? (
        <Link href={backHref} className="-ml-1 inline-flex w-fit items-center gap-0.5 rounded-md py-1 pr-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ChevronLeft className="size-4" />
          {backLabel}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
            {phase ? <PhaseBadge phase={phase} /> : null}
          </div>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}

export function IconBubble({ icon: Icon, tone = "emerald", size = "md", className }: { icon: LucideIcon; tone?: Tone; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl",
        size === "sm" ? "size-8" : size === "lg" ? "size-12 rounded-2xl" : "size-10",
        TONE[tone].bubble,
        className,
      )}
    >
      <Icon className={size === "sm" ? "size-4" : size === "lg" ? "size-6" : "size-5"} />
    </span>
  )
}

/** Big-number metric tile. */
export function MetricTile({
  icon,
  tone = "emerald",
  label,
  value,
  unit,
  hint,
  className,
}: {
  icon: LucideIcon
  tone?: Tone
  label: string
  value: React.ReactNode
  unit?: string
  hint?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2.5 rounded-2xl border bg-card p-3.5 shadow-xs sm:p-4", className)}>
      <IconBubble icon={icon} tone={tone} size="sm" />
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-bold tabular-nums sm:text-xl">
          {value}
          {unit ? <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span> : null}
        </p>
        {hint ? <p className="truncate text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  )
}

/** Pill segmented control (period toggles etc.). Big touch targets. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: React.ReactNode }[]
  className?: string
  ariaLabel?: string
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn("inline-flex rounded-full bg-muted p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-8 flex-1 rounded-full px-3.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-all hover:text-foreground",
            value === o.value && "bg-background text-foreground shadow-sm",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Previous / next stepper with a centred label (days, weeks, months). */
export function PeriodNavigator({
  label,
  sublabel,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  className,
}: {
  label: React.ReactNode
  sublabel?: React.ReactNode
  onPrev: () => void
  onNext: () => void
  prevDisabled?: boolean
  nextDisabled?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2 rounded-full border bg-card p-1 shadow-xs", className)}>
      <Button variant="ghost" size="icon" className="size-9 rounded-full" onClick={onPrev} disabled={prevDisabled} aria-label="Previous">
        <ChevronLeft />
      </Button>
      <div className="min-w-0 text-center leading-tight">
        <p className="truncate text-sm font-semibold">{label}</p>
        {sublabel ? <p className="truncate text-[11px] text-muted-foreground">{sublabel}</p> : null}
      </div>
      <Button variant="ghost" size="icon" className="size-9 rounded-full" onClick={onNext} disabled={nextDisabled} aria-label="Next">
        <ChevronRight />
      </Button>
    </div>
  )
}

/** Muted information note (disclaimers, rules, privacy). */
export function InfoNote({ children, icon: Icon = Info, className }: { children: React.ReactNode; icon?: LucideIcon; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground", className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

/** Small round number stepper with − / + buttons. */
export function NumberStepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  format = (v) => String(v),
  label,
  className,
}: {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  format?: (value: number) => string
  label?: string
  className?: string
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step))
  return (
    <div className={cn("flex items-center justify-between gap-3", className)} role="group" aria-label={label}>
      <Button type="button" variant="outline" size="icon" className="size-11 rounded-full text-lg" onClick={() => onChange(clamp(value - step))} disabled={value <= min} aria-label="Decrease">
        −
      </Button>
      <span className="min-w-20 text-center font-heading text-2xl font-extrabold tabular-nums" aria-live="polite">
        {format(value)}
      </span>
      <Button type="button" variant="outline" size="icon" className="size-11 rounded-full text-lg" onClick={() => onChange(clamp(value + step))} disabled={value >= max} aria-label="Increase">
        +
      </Button>
    </div>
  )
}

/** Chip toggle (multi-select chip groups). */
export function Chip({
  selected,
  onClick,
  children,
  className,
  disabled,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border bg-card px-3.5 text-sm font-medium transition-all hover:border-primary/40 disabled:opacity-50",
        selected && "border-primary bg-primary/10 text-primary ring-1 ring-primary/25 dark:text-emerald-300",
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Local YYYY-MM-DD for a Date. */
export const localDate = (d: Date = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

export const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + n)
  return localDate(d)
}

/** "Today", "Yesterday" or "Mon, 6 Oct". */
export function dayLabel(date: string) {
  const today = localDate()
  if (date === today) return "Today"
  if (date === addDays(today, -1)) return "Yesterday"
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
}

export const formatHM = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`
}

export const formatClock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, Math.floor(sec % 60))).padStart(2, "0")}`
