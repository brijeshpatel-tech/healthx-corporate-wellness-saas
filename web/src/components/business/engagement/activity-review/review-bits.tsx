"use client"

import { AlertTriangle, Coins, Quote } from "lucide-react"
import { UserAvatar } from "@/components/common/user-avatar"
import { activityMeta, formatActivityValue, type ActivityReviewRow } from "@/lib/api/business/activity-review"
import { formatDate, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Emoji tile for an activity type. */
export function ActivityIcon({ type, className }: { type: string; className?: string }) {
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-lg leading-none", className)} aria-hidden>
      {activityMeta(type).emoji}
    </span>
  )
}

/** "+40 pts" chip (or "No points"). */
export function PointsChip({ points, label = "pts", className }: { points: number; label?: string; className?: string }) {
  if (points <= 0)
    return <span className={cn("inline-flex h-6 shrink-0 items-center rounded-full bg-muted px-2.5 text-xs font-medium whitespace-nowrap text-muted-foreground", className)}>No points</span>
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-amber-500/12 px-2.5 text-xs font-semibold whitespace-nowrap text-amber-800 tabular-nums dark:text-amber-300", className)}>
      <Coins className="size-3.5" />
      {formatNumber(points)} {label}
    </span>
  )
}

/** Employee note (manual) or the reason a record was flagged (unusual data). */
export function RecordNote({ row, className }: { row: Pick<ActivityReviewRow, "kind" | "note">; className?: string }) {
  if (!row.note) return row.kind === "manual" ? <p className={cn("text-xs text-muted-foreground italic", className)}>No note added</p> : null
  if (row.kind === "suspicious")
    return (
      <p className={cn("flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-sm text-amber-900 dark:text-amber-200", className)}>
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="min-w-0 break-words">{row.note}</span>
      </p>
    )
  return (
    <p className={cn("flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground", className)}>
      <Quote className="mt-0.5 size-3.5 shrink-0 opacity-60" />
      <span className="min-w-0 break-words">{row.note}</span>
    </p>
  )
}

/** Compact record card used inside the review dialogs. */
export function RecordSummary({ row }: { row: ActivityReviewRow }) {
  const meta = activityMeta(row.type)
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-3">
      <div className="flex items-center gap-3">
        <UserAvatar name={row.employeeName} color={row.avatarColor} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{row.employeeName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {meta.emoji} {meta.label} · {formatDate(row.day, "EEE d MMM")}
          </p>
        </div>
        <div className="text-right">
          <p className="font-heading text-base leading-tight font-semibold tabular-nums">{formatActivityValue(row.value, row.unit)}</p>
          <PointsChip points={row.points} className="mt-1" />
        </div>
      </div>
      <RecordNote row={row} />
    </div>
  )
}

export const KIND_LABEL: Record<ActivityReviewRow["kind"], string> = { manual: "Manual entry", suspicious: "Unusual data" }

/** Outcome badge text — "Accepted" for flagged records, "Corrected" for adjusted ones. */
export function outcomeLabel(row: Pick<ActivityReviewRow, "status" | "kind" | "origin">) {
  if (row.status === "adjusted") return "Corrected"
  if (row.status === "rejected") return "Rejected"
  if (row.status === "approved") return row.origin === "admin" ? "Added by admin" : row.kind === "suspicious" ? "Accepted" : "Approved"
  return "Pending"
}
