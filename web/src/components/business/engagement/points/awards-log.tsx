"use client"

import { Award } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { DateRangeFilter, type DateRangeValue } from "@/components/business/engagement/orders/date-range-filter"
import { DataTable, type Column } from "@/components/common/data-table"
import { SearchInput } from "@/components/common/misc"
import { StatusBadge } from "@/components/common/status-badge"
import { ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { pointsApi, type AwardKind, type AwardsQuery, type PointsAward } from "@/lib/api/business/points"
import { useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber, formatTime, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

const KIND: Record<AwardKind, { label: string; tone: "violet" | "green" | "red" }> = {
  bulk: { label: "Bulk award", tone: "violet" },
  credit: { label: "Added", tone: "green" },
  debit: { label: "Deducted", tone: "red" },
}

export interface AwardsFilters {
  search: string
  kind: AwardKind | "all"
  range: DateRangeValue
}

/** Log of the bulk awards and manual adjustments admins made (who, when, why, how many people, points). */
export function AwardsLog({ filters, onChange, canAward }: { filters: AwardsFilters; onChange: (f: Partial<AwardsFilters>) => void; canAward: boolean }) {
  const [page, setPage] = useState(1)
  const query: AwardsQuery = { search: filters.search || undefined, kind: filters.kind, from: filters.range.from, to: filters.range.to, page, pageSize: 10 }
  const list = useApiQuery(["business", "points", "awards", query], () => pointsApi.awards(query), { placeholderData: (prev) => prev })
  const anyFilter = !!filters.search || filters.kind !== "all" || !!filters.range.from || !!filters.range.to
  const change = (f: Partial<AwardsFilters>) => {
    setPage(1)
    onChange(f)
  }

  const columns: Column<PointsAward>[] = [
    {
      key: "date",
      header: "Award date",
      cell: (a) => (
        <div className="text-sm whitespace-nowrap">
          {formatDate(a.awardDate)}
          <div className="text-xs text-muted-foreground">recorded {formatDate(a.createdAt, "d MMM")}, {formatTime(a.createdAt)}</div>
        </div>
      ),
      hideOnMobile: true,
    },
    {
      key: "recipients",
      header: "Recipients",
      cell: (a) => (
        <div className="min-w-0 max-w-64">
          <div className="truncate text-sm font-medium">{a.recipientsLabel}</div>
          <div className="truncate text-xs text-muted-foreground">
            <span className="md:hidden">{formatDate(a.awardDate, "d MMM")} · </span>
            {a.kind === "bulk" ? pluralize(a.recipientsCount, "person", "people") : "1 person"}
            <span className="md:hidden"> · {a.reason}</span>
          </div>
        </div>
      ),
    },
    { key: "kind", header: "Type", cell: (a) => <StatusBadge status={a.kind} label={KIND[a.kind].label} tone={KIND[a.kind].tone} dot={false} />, hideOnMobile: true },
    { key: "reason", header: "Reason", cell: (a) => <p className="line-clamp-2 max-w-72 text-sm text-muted-foreground">{a.reason}</p>, hideOnMobile: true },
    {
      key: "points",
      header: "Points",
      align: "right",
      cell: (a) => (
        <div className="whitespace-nowrap">
          <span className={cn("font-semibold tabular-nums", a.totalPoints >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>
            {a.totalPoints >= 0 ? "+" : "−"}
            {formatNumber(Math.abs(a.totalPoints))}
          </span>
          {a.kind === "bulk" ? <div className="text-xs text-muted-foreground tabular-nums">{formatNumber(a.pointsEach)} each</div> : null}
        </div>
      ),
    },
    { key: "by", header: "By", cell: (a) => <span className="text-sm whitespace-nowrap text-muted-foreground">{a.createdBy}</span>, hideOnMobile: true },
  ]

  if (list.error) return <ErrorState error={list.error} onRetry={() => list.refetch()} />

  return (
    <DataTable
      columns={columns}
      rows={list.data?.items ?? []}
      getRowId={(a) => a.id}
      loading={list.isLoading}
      pagination={list.data ? { page, pageSize: list.data.pageSize, total: list.data.total, onPageChange: setPage } : undefined}
      emptyTitle={anyFilter ? "Nothing matches these filters" : "No awards or adjustments yet"}
      emptyDescription={anyFilter ? "Try a different search, type or date range." : "Bonus points you award and manual corrections you make will be listed here."}
      emptyAction={
        anyFilter ? (
          <Button variant="outline" size="sm" onClick={() => change({ search: "", kind: "all", range: {} })}>
            Clear filters
          </Button>
        ) : canAward ? (
          <Button asChild size="sm">
            <Link href="/business-portal/points/award">
              <Award data-icon="inline-start" /> Award points
            </Link>
          </Button>
        ) : undefined
      }
      className={list.isFetching && !list.isLoading ? "opacity-80 transition-opacity" : "transition-opacity"}
      toolbar={
        <>
          <SearchInput value={filters.search} onChange={(search) => change({ search })} placeholder="Search reason, recipient or admin…" />
          <Select value={filters.kind} onValueChange={(v) => change({ kind: v as AwardsFilters["kind"] })}>
            <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="bulk">Bulk awards</SelectItem>
              <SelectItem value="credit">Points added</SelectItem>
              <SelectItem value="debit">Points deducted</SelectItem>
            </SelectContent>
          </Select>
          <DateRangeFilter value={filters.range} onChange={(range) => change({ range })} className="w-full sm:w-auto" />
          {list.data ? (
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">
              <span className="text-emerald-700 dark:text-emerald-400">+{formatNumber(list.data.totals.credited)}</span> added ·{" "}
              <span className="text-rose-700 dark:text-rose-400">−{formatNumber(list.data.totals.debited)}</span> deducted
            </span>
          ) : null}
        </>
      }
    />
  )
}
