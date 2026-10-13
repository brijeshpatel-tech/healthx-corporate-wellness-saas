"use client"

import type { LucideIcon } from "lucide-react"
import { Award, Brain, Droplets, Dumbbell, Flame, Footprints, Gift, Hourglass, ListChecks, RotateCcw, SlidersHorizontal, Trophy } from "lucide-react"
import Link from "next/link"
import { IconTile, type Tone } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import type { TxView } from "@/lib/api/employee/gamification"
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format"
import type { PointsSource } from "@/lib/types"
import { cn } from "@/lib/utils"

export const SOURCE_META: Record<PointsSource, { icon: LucideIcon; tone: Tone }> = {
  steps: { icon: Footprints, tone: "sky" },
  workout: { icon: Dumbbell, tone: "violet" },
  meditation: { icon: Brain, tone: "teal" },
  water: { icon: Droplets, tone: "cyan" },
  challenge: { icon: Trophy, tone: "amber" },
  streak: { icon: Flame, tone: "orange" },
  badge: { icon: Award, tone: "pink" },
  habit: { icon: ListChecks, tone: "emerald" },
  manual_adjustment: { icon: SlidersHorizontal, tone: "slate" },
  redemption: { icon: Gift, tone: "rose" },
  refund: { icon: RotateCcw, tone: "emerald" },
  expiry: { icon: Hourglass, tone: "slate" },
}

const TYPE_LABEL: Record<TxView["type"], string> = { earn: "Earned", redeem: "Redeemed", adjust: "Adjustment", refund: "Refund", expire: "Expired" }

/** Detail body for the transaction sheet (source detail). */
export function TxDetail({ t }: { t: TxView }) {
  const meta = SOURCE_META[t.source] ?? SOURCE_META.manual_adjustment
  const positive = t.points > 0
  return (
    <div className="flex flex-col items-center gap-4 pt-2 text-center">
      <IconTile icon={meta.icon} tone={meta.tone} size="lg" />
      <p className={cn("font-heading text-4xl font-extrabold tabular-nums", positive ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
        {positive ? "+" : "−"}
        {formatNumber(Math.abs(t.points))} <span className="text-base font-semibold text-muted-foreground">pts</span>
      </p>
      {t.reversed ? <p className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">Reversed — these points were refunded</p> : null}
      <dl className="w-full divide-y rounded-2xl border text-left text-sm">
        {[
          ["Description", t.description],
          ["Source", t.sourceLabel],
          ["Type", TYPE_LABEL[t.type]],
          ["Date", formatDateTime(t.createdAt)],
          ["Balance after", `${formatNumber(t.balanceAfter)} pts`],
          ...(t.createdBy ? [["Added by", t.createdBy]] : []),
        ].map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-4 px-4 py-3">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {t.link ? (
        <Button asChild variant="outline" className="h-10 w-full rounded-xl">
          <Link href={t.link}>Go to {t.sourceLabel.toLowerCase()}</Link>
        </Button>
      ) : null}
    </div>
  )
}

/** One points-ledger row (+50 Workout, −500 Amazon Voucher…). */
export function TxRow({ t, onClick }: { t: TxView; onClick?: () => void }) {
  const meta = SOURCE_META[t.source] ?? SOURCE_META.manual_adjustment
  const positive = t.points > 0
  const body = (
    <>
      <IconTile icon={meta.icon} tone={meta.tone} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{t.description}</span>
          {t.reversed ? <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] leading-4 font-semibold text-muted-foreground uppercase">Reversed</span> : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {t.sourceLabel} · {formatRelative(t.createdAt)}
        </p>
      </div>
      <span className={cn("shrink-0 font-heading text-sm font-bold tabular-nums", positive ? "text-emerald-600 dark:text-emerald-400" : "text-foreground", t.reversed && "text-muted-foreground line-through")}>
        {positive ? "+" : "−"}
        {formatNumber(Math.abs(t.points))}
      </span>
    </>
  )
  if (onClick)
    return (
      <button type="button" onClick={onClick} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50">
        {body}
      </button>
    )
  return <div className="flex min-h-14 items-center gap-3 px-4 py-3">{body}</div>
}
