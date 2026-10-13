"use client"

import { ArrowRight } from "lucide-react"
import { DataTable, type Column } from "@/components/common/data-table"
import { StatusBadge } from "@/components/common/status-badge"
import { PersonCell } from "@/components/common/user-avatar"
import { activityMeta, formatActivityValue, type ActivityReviewRow } from "@/lib/api/business/activity-review"
import { formatDate, formatDateTime, formatNumber, formatRelative } from "@/lib/format"
import { ActivityIcon, KIND_LABEL, outcomeLabel } from "./review-bits"

const OUTCOME_TONE = { approved: "green", adjusted: "violet", rejected: "red", pending: "amber" } as const

/** "Handled" history: who decided what, when, and why. */
export function ReviewHistoryTable({
  rows,
  loading,
  toolbar,
  emptyTitle,
  emptyDescription,
  emptyAction,
  className,
}: {
  rows: ActivityReviewRow[]
  loading?: boolean
  toolbar?: React.ReactNode
  emptyTitle: string
  emptyDescription?: React.ReactNode
  emptyAction?: React.ReactNode
  className?: string
}) {
  const columns: Column<ActivityReviewRow>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (r) => <PersonCell name={r.employeeName} subtitle={r.departmentName || undefined} color={r.avatarColor} />,
      sortValue: (r) => r.employeeName,
      className: "max-w-56",
    },
    {
      key: "activity",
      header: "Activity",
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <ActivityIcon type={r.type} className="hidden size-8 text-base sm:flex" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{activityMeta(r.type).label}</div>
            <div className="truncate text-xs text-muted-foreground">
              {formatDate(r.day, "d MMM")} · {r.origin === "admin" ? "Added by admin" : KIND_LABEL[r.kind]}
            </div>
          </div>
        </div>
      ),
      sortValue: (r) => r.day,
    },
    {
      key: "value",
      header: "Value",
      cell: (r) =>
        r.status === "adjusted" && r.originalValue !== undefined ? (
          <div className="flex flex-wrap items-center gap-1 text-sm tabular-nums">
            <span className="text-muted-foreground line-through">{formatActivityValue(r.originalValue, r.unit)}</span>
            <ArrowRight className="size-3 text-muted-foreground" aria-label="corrected to" />
            <span className="font-medium">{formatActivityValue(r.value, r.unit)}</span>
          </div>
        ) : (
          <span className="text-sm tabular-nums">{formatActivityValue(r.value, r.unit)}</span>
        ),
      hideOnMobile: true,
    },
    { key: "outcome", header: "Outcome", cell: (r) => <StatusBadge status={r.status} tone={OUTCOME_TONE[r.status]} label={outcomeLabel(r)} />, sortValue: (r) => r.status },
    {
      key: "points",
      header: "Points",
      align: "right",
      cell: (r) =>
        r.status === "rejected" || r.points <= 0 ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          <span className="text-sm font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">+{formatNumber(r.points)}</span>
        ),
      sortValue: (r) => (r.status === "rejected" ? 0 : r.points),
      hideOnMobile: true,
    },
    {
      key: "handled",
      header: "Handled",
      cell: (r) => (
        <div className="min-w-0 text-sm">
          <div className="truncate">{r.handledBy ?? "—"}</div>
          <div className="truncate text-xs text-muted-foreground" title={r.handledAt ? formatDateTime(r.handledAt) : undefined}>
            {r.handledAt ? formatRelative(r.handledAt) : ""}
          </div>
        </div>
      ),
      sortValue: (r) => r.handledAt ?? "",
      hideOnMobile: true,
    },
    {
      key: "reason",
      header: "Reason",
      cell: (r) => (r.reason ? <p className="line-clamp-2 max-w-72 text-sm text-muted-foreground">{r.reason}</p> : <span className="text-sm text-muted-foreground">—</span>),
      className: "hidden xl:table-cell",
      headerClassName: "hidden xl:table-cell",
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(r) => r.id}
      loading={loading}
      clientPageSize={10}
      toolbar={toolbar}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      emptyAction={emptyAction}
      className={className}
    />
  )
}
