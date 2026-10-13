"use client"

import { CalendarDays, Coins, Gift, Users } from "lucide-react"
import Link from "next/link"
import { InlineBar } from "@/components/common/misc"
import { StatusBadge } from "@/components/common/status-badge"
import { Card } from "@/components/ui/card"
import type { ChallengeRow } from "@/lib/api/business/challenges"
import { formatNumber, formatPercent, formatShortDate, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ChallengeActionsMenu } from "./challenge-actions"
import { formatMetricValue, typeLabel } from "./challenge-meta"

export function timingLabel(c: Pick<ChallengeRow, "status" | "daysLeft" | "daysToStart" | "durationDays" | "endDate" | "warmup">) {
  if (c.warmup) return c.daysToStart === 1 ? "Warm-up · scoring starts tomorrow" : `Warm-up · scoring in ${pluralize(c.daysToStart ?? 0, "day")}`
  if (c.status === "active") return c.daysLeft === 0 ? "Ends today" : `${pluralize(c.daysLeft ?? 0, "day")} left`
  if (c.status === "scheduled") return c.daysToStart === 1 ? "Starts tomorrow" : `Starts in ${pluralize(c.daysToStart ?? 0, "day")}`
  if (c.status === "draft") return (c.daysToStart ?? 0) < 0 ? "Start date has passed" : `${pluralize(c.durationDays, "day")} long`
  if (c.status === "completed") return `Ended ${formatShortDate(c.endDate)}`
  return "Cancelled"
}

/** Status badge that shows "Warm-up" for scheduled challenges in their warm-up period (#358). */
export function ChallengeStatusBadge({ challenge: c }: { challenge: Pick<ChallengeRow, "status" | "warmup"> }) {
  return c.warmup ? <StatusBadge status="scheduled" tone="teal" label="Warm-up" /> : <StatusBadge status={c.status} />
}

/** Challenge card for the list grid: cover, dates, participation and average progress. */
export function ChallengeCard({ challenge: c }: { challenge: ChallengeRow }) {
  const started = c.status === "active" || c.status === "completed"
  return (
    <Card className="group relative gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md">
      <div className="relative flex h-24 items-end justify-between px-4 pb-3" style={{ background: `linear-gradient(135deg, ${c.coverColor}, ${c.coverColor}b3)` }}>
        <span className="text-4xl leading-none drop-shadow-sm" aria-hidden>
          {c.coverEmoji}
        </span>
        <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">{typeLabel(c.type, c.teamUnit)}</span>
        <div className="absolute top-2.5 right-2.5 rounded-full bg-background/90 shadow-sm">
          <ChallengeStatusBadge challenge={c} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Link href={`/business-portal/challenges/${c.id}`} className="line-clamp-1 font-heading font-semibold after:absolute after:inset-0 hover:underline">
              {c.name}
            </Link>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatMetricValue(c.target, c.metric, c.customMetricLabel)} · {c.audienceLabel}
            </p>
          </div>
          <div className="relative z-10 -mt-1 -mr-2">
            <ChallengeActionsMenu challenge={c} />
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" />
          <span>
            {formatShortDate(c.startDate)} – {formatShortDate(c.endDate)}
          </span>
          <span aria-hidden>·</span>
          <span className={cn(c.status === "active" && "font-medium text-foreground", c.status === "draft" && (c.daysToStart ?? 0) < 0 && "font-medium text-destructive")}>{timingLabel(c)}</span>
        </div>

        {started ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Users className="size-3.5" />
                <span className="font-semibold text-foreground tabular-nums">{formatNumber(c.participantsCount)}</span> / {formatNumber(c.eligibleCount)} joined
              </span>
              <span className="font-medium tabular-nums">{formatPercent(c.participationRate)}</span>
            </div>
            <InlineBar value={c.avgProgress} max={1} color={c.coverColor} />
            <p className="text-xs text-muted-foreground">
              {c.type === "collaborative" ? "Shared goal" : "Average progress"} <span className="font-medium text-foreground tabular-nums">{formatPercent(c.avgProgress)}</span>
              {c.type !== "collaborative" && c.type !== "team" ? (
                <>
                  {" "}
                  · {formatNumber(c.completedCount)} completed
                </>
              ) : null}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{formatNumber(c.eligibleCount)}</span> eligible employees
            {c.status === "cancelled" ? " were invited" : " can join"}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Coins className="size-3.5 text-amber-500" />
            <span className="font-medium text-foreground">{formatNumber(c.points)}</span> pts
          </span>
          {c.rewardName ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <Gift className="size-3.5 text-rose-500" />
              <span className="truncate">{c.rewardName}</span>
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  )
}
