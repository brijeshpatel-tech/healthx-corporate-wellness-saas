"use client"

import { ShieldCheck } from "lucide-react"
import { EmptyState } from "@/components/common/states"
import { Skeleton } from "@/components/ui/skeleton"
import type { AnalyticsRange } from "@/lib/api/business/analytics"
import { formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"

export interface TabFilters {
  range: AnalyticsRange
  departmentId?: string
  teamId?: string
}

/** Cell shown instead of a figure for groups below the minimum size. */
export function Hidden({ min, className }: { min: number; className?: string }) {
  return <span className={cn("text-xs whitespace-nowrap text-muted-foreground", className)}>Hidden (&lt; {min} people)</span>
}

export function PercentCell({ value, min, low }: { value: number | null; min: number; low?: boolean }) {
  if (value === null) return <Hidden min={min} />
  return <span className={cn("font-medium tabular-nums", low && "text-amber-700 dark:text-amber-400")}>{formatPercent(value)}</span>
}

/** Whole scope is below the minimum group size. */
export function NotEnoughData({ min, scope }: { min: number; scope: string }) {
  return (
    <EmptyState
      icon={ShieldCheck}
      title="Not enough data to show this group."
      description={`${scope} has fewer than ${min} people, so figures are hidden to protect privacy. Choose a larger department or the whole company.`}
    />
  )
}

export function TabSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="flex flex-col gap-6">
      <div className={cn("grid gap-4 sm:grid-cols-2", tiles >= 4 ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
        {Array.from({ length: tiles }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

/** Relative change, guarded against divide-by-zero. */
export const change = (value: number | null, previous: number | null) => (value === null || previous === null || !previous ? undefined : (value - previous) / previous)

/** Absolute change for rates (percentage points as a ratio). */
export const pointChange = (value: number | null, previous: number | null) => (value === null || previous === null ? undefined : value - previous)
