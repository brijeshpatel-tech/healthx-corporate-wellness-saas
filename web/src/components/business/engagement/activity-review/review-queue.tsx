"use client"

import { Check, Clock, PencilLine, X } from "lucide-react"
import { PersonCell } from "@/components/common/user-avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { activityMeta, formatActivityValue, type ActivityReviewRow } from "@/lib/api/business/activity-review"
import { formatDate, formatNumber, formatRelative, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ActivityIcon, PointsChip, RecordNote } from "./review-bits"

const DAY_MS = 86_400_000

/** Whole days a record has been waiting since its activity date. */
function waitingDays(day: string) {
  const start = new Date(`${day}T00:00:00`).getTime()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((today.getTime() - start) / DAY_MS))
}

/**
 * Pending review queue: one row per record with the employee, what was recorded, the note or flag,
 * the points at stake and Approve / Correct / Reject. Rows stack into cards on phones.
 */
export function ReviewQueue({
  rows,
  loading,
  kind,
  selectable,
  selectedIds = [],
  onSelectedIdsChange,
  approvingId,
  onApprove,
  onCorrect,
  onReject,
  empty,
  className,
}: {
  rows: ActivityReviewRow[]
  loading?: boolean
  kind: "manual" | "suspicious"
  selectable?: boolean
  selectedIds?: string[]
  onSelectedIdsChange?: (ids: string[]) => void
  approvingId?: string | null
  onApprove: (row: ActivityReviewRow) => void
  onCorrect: (row: ActivityReviewRow) => void
  onReject: (row: ActivityReviewRow) => void
  empty: React.ReactNode
  className?: string
}) {
  const selected = new Set(selectedIds)
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const someSelected = !allSelected && rows.some((r) => selected.has(r.id))
  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedIdsChange?.([...next])
  }
  const approveLabel = kind === "manual" ? "Approve" : "Accept"

  if (!loading && rows.length === 0) return <>{empty}</>

  return (
    <Card className={cn("gap-0 overflow-hidden py-0", className)}>
      <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {selectable ? (
          <Checkbox
            checked={allSelected ? true : someSelected ? "indeterminate" : false}
            onCheckedChange={() => onSelectedIdsChange?.(allSelected ? [] : rows.map((r) => r.id))}
            aria-label="Select all entries"
            disabled={loading}
          />
        ) : null}
        <span>{loading ? "Loading…" : `${pluralize(rows.length, kind === "manual" ? "entry" : "record", kind === "manual" ? "entries" : "records")} waiting · oldest first`}</span>
      </div>
      <ul className="divide-y" aria-busy={loading}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:gap-6">
                <div className="flex items-center gap-3 md:w-56">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-8 w-full max-w-md" />
                </div>
                <Skeleton className="h-8 w-56" />
              </li>
            ))
          : rows.map((row) => {
              const meta = activityMeta(row.type)
              const waiting = waitingDays(row.day)
              const busy = approvingId === row.id
              return (
                <li key={row.id} data-state={selected.has(row.id) ? "selected" : undefined} className="flex flex-col gap-3 p-4 transition-colors data-[state=selected]:bg-primary/[0.04] lg:flex-row lg:items-start lg:gap-6">
                  <div className="flex items-center gap-3 lg:w-56 lg:shrink-0 lg:pt-1">
                    {selectable ? <Checkbox checked={selected.has(row.id)} onCheckedChange={() => toggle(row.id)} aria-label={`Select ${row.employeeName}'s entry`} /> : null}
                    <PersonCell name={row.employeeName} subtitle={row.departmentName || undefined} color={row.avatarColor} className="flex-1" />
                    <PointsChip points={row.points} label="pts at stake" className="lg:hidden" />
                  </div>

                  <div className="flex min-w-0 flex-1 gap-3">
                    <ActivityIcon type={row.type} className="hidden sm:flex" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="font-heading text-base font-semibold tabular-nums">{formatActivityValue(row.value, row.unit)}</span>
                        <span className="text-sm font-medium">
                          <span className="sm:hidden" aria-hidden>
                            {meta.emoji}{" "}
                          </span>
                          {meta.label}
                        </span>
                        <span className="text-sm text-muted-foreground">· {formatDate(row.day, "EEE d MMM")}</span>
                        {waiting > 3 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                            <Clock className="size-3" /> Waiting {formatNumber(waiting)} days
                          </span>
                        ) : null}
                      </div>
                      <RecordNote row={row} />
                      {row.createdAt ? <p className="text-[11px] text-muted-foreground">{kind === "manual" ? "Logged" : "Flagged"} {formatRelative(row.createdAt)}</p> : null}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 lg:items-end">
                    <PointsChip points={row.points} label="pts at stake" className="hidden lg:inline-flex" />
                    <div className="grid grid-cols-3 gap-2 lg:flex">
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onReject(row)} disabled={busy} aria-label={`Reject ${row.employeeName}'s entry`}>
                        <X data-icon="inline-start" /> Reject
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => onCorrect(row)} disabled={busy} aria-label={`Correct ${row.employeeName}'s entry`}>
                        <PencilLine data-icon="inline-start" /> {kind === "manual" ? "Correct" : "Adjust"}
                      </Button>
                      <Button size="sm" onClick={() => onApprove(row)} disabled={busy} aria-label={`${approveLabel} ${row.employeeName}'s entry`}>
                        {busy ? <Spinner /> : <Check data-icon="inline-start" />} {approveLabel}
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
      </ul>
    </Card>
  )
}
