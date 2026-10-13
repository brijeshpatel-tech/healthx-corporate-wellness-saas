import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Tone = "emerald" | "sky" | "violet" | "amber" | "rose" | "slate"

const TONES: Record<Tone, string> = {
  emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  sky: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
  violet: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
  amber: "bg-amber-500/14 text-amber-600 dark:text-amber-400",
  rose: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
  slate: "bg-slate-500/12 text-slate-600 dark:text-slate-300",
}

/** KPI tile: label, big value, optional delta vs previous period and hint. */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "emerald",
  delta,
  deltaLabel = "vs last period",
  hint,
  href,
  loading,
  className,
}: {
  label: string
  value: React.ReactNode
  icon?: LucideIcon
  tone?: Tone
  /** Relative change, e.g. 0.12 = +12%. Positive is shown green. */
  delta?: number
  deltaLabel?: string
  hint?: React.ReactNode
  href?: string
  loading?: boolean
  className?: string
}) {
  const content = (
    <Card className={cn("gap-0 py-0 transition-shadow", href && "hover:shadow-md hover:ring-1 hover:ring-primary/20", className)}>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          {Icon ? (
            <span className={cn("flex size-9 items-center justify-center rounded-xl", TONES[tone])}>
              <Icon className="size-4.5" />
            </span>
          ) : null}
        </div>
        {loading ? <Skeleton className="h-8 w-24" /> : <div className="font-heading text-[1.75rem] leading-none font-bold tracking-tight tabular-nums">{value}</div>}
        {delta !== undefined || hint ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {delta !== undefined ? <Delta value={delta} /> : null}
            {delta !== undefined ? <span>{deltaLabel}</span> : null}
            {hint ? <span>{hint}</span> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
  return href ? (
    <Link href={href} className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      {content}
    </Link>
  ) : (
    content
  )
}

export function Delta({ value, inverse = false, className }: { value: number; inverse?: boolean; className?: string }) {
  const good = inverse ? value < 0 : value > 0
  const flat = Math.abs(value) < 0.005
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold tabular-nums",
        flat ? "bg-muted text-muted-foreground" : good ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/12 text-rose-700 dark:text-rose-400",
        className,
      )}
    >
      <Icon className="size-3.5" />
      {flat ? "0%" : `${Math.abs(value * 100).toFixed(Math.abs(value) < 0.1 ? 1 : 0)}%`}
    </span>
  )
}
