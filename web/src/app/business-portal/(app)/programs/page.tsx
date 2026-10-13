"use client"

import { CalendarRange, LayoutTemplate, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { CountTabs } from "@/components/business/engagement/count-tabs"
import { CoverTile } from "@/components/business/engagement/cover-picker"
import { ProgramActionsMenu } from "@/components/business/engagement/programs/program-actions"
import { DataTable, type Column } from "@/components/common/data-table"
import { InlineBar, SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { EmptyState, ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { programsApi, type ProgramQuery, type ProgramRow, type ProgramStatus } from "@/lib/api/business/programs"
import { useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { formatNumber, formatPercent, formatShortDate, pluralize } from "@/lib/format"

type Tab = ProgramStatus | "all"

function timing(p: ProgramRow) {
  if (p.status === "active") return p.daysLeft === 0 ? `Week ${p.currentWeek} · ends today` : `Week ${p.currentWeek} of ${p.durationWeeks} · ${pluralize(p.daysLeft ?? 0, "day")} left`
  if (p.status === "scheduled") return p.daysToStart === 1 ? "Starts tomorrow" : `Starts in ${pluralize(p.daysToStart ?? 0, "day")}`
  if (p.status === "draft") return (p.daysToStart ?? 0) < 0 ? "Start date has passed" : "Not published"
  if (p.status === "completed") return `Ended ${formatShortDate(p.endDate)}`
  return "Archived"
}

export default function ProgramsPage() {
  const router = useRouter()
  const can = useCan()
  const [status, setStatus] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const query: ProgramQuery = { status, search: search || undefined }
  const list = useApiQuery(["business", "programs", query], () => programsApi.list(query), { placeholderData: (prev) => prev })
  const templates = useApiQuery(["business", "program-templates"], () => programsApi.templates())
  const data = list.data
  const firstTemplate = templates.data?.[0]
  const nothingAtAll = !!data && data.counts.all === 0 && status === "all" && !search

  const columns: Column<ProgramRow>[] = [
    {
      key: "name",
      header: "Program",
      sortValue: (p) => p.name,
      className: "max-w-[22rem] whitespace-normal",
      cell: (p) => (
        <div className="flex min-w-0 items-center gap-3">
          <CoverTile emoji={p.coverEmoji} color={p.coverColor} />
          <div className="min-w-0">
            <div className="line-clamp-2 font-medium md:line-clamp-1">{p.name}</div>
            <div className="text-xs text-muted-foreground">
              {pluralize(p.durationWeeks, "week")} · {pluralize(p.goalCount, "goal")} · {p.audienceLabel}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground md:hidden">{timing(p)}</div>
          </div>
        </div>
      ),
    },
    {
      key: "dates",
      header: "Dates",
      hideOnMobile: true,
      sortValue: (p) => p.startDate ?? "",
      cell: (p) => (
        <div className="text-sm whitespace-nowrap">
          {p.startDate ? (
            <>
              {formatShortDate(p.startDate)} – {formatShortDate(p.endDate)}
            </>
          ) : (
            <span className="text-muted-foreground">No start date</span>
          )}
          <div className="text-xs text-muted-foreground">{timing(p)}</div>
        </div>
      ),
    },
    { key: "status", header: "Status", cell: (p) => <StatusBadge status={p.status} /> },
    {
      key: "enrolled",
      header: "Enrolled",
      align: "right",
      hideOnMobile: true,
      sortValue: (p) => p.enrolledCount,
      cell: (p) =>
        p.status === "draft" ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          <div className="text-sm tabular-nums">
            <span className="font-semibold">{formatNumber(p.enrolledCount)}</span>
            <div className="text-xs text-muted-foreground">of {formatNumber(p.eligibleCount)}</div>
          </div>
        ),
    },
    {
      key: "completion",
      header: "Completion",
      hideOnMobile: true,
      className: "w-44",
      sortValue: (p) => p.completionRate,
      cell: (p) =>
        p.status === "active" || p.status === "completed" || (p.status === "archived" && p.completionRate > 0) ? (
          <div className="min-w-32 space-y-1">
            <div className="text-right text-xs font-semibold tabular-nums">{formatPercent(p.completionRate)}</div>
            <InlineBar value={p.completionRate} max={1} color={p.coverColor} className="h-1.5" />
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Not started</span>
        ),
    },
    { key: "actions", header: <span className="sr-only">Actions</span>, align: "right", cell: (p) => <ProgramActionsMenu program={p} /> },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Wellness programs"
        badge={<PhaseBadge phase={2} />}
        description="Multi-week programs and campaigns with weekly goals — a guided way to build healthy habits together."
        actions={
          can("programs.manage") ? (
            <>
              <Button asChild variant="outline">
                <Link href="/business-portal/programs/new">
                  <LayoutTemplate data-icon="inline-start" /> Use template
                </Link>
              </Button>
              <Button asChild>
                <Link href="/business-portal/programs/new?template=blank">
                  <Plus data-icon="inline-start" /> Create program
                </Link>
              </Button>
            </>
          ) : null
        }
      />

      {list.error && !data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : nothingAtAll ? (
        <EmptyState
          icon={CalendarRange}
          title="No programs yet."
          description={firstTemplate ? `Start from the ${firstTemplate.name} template — weekly goals are ready to go.` : "Create a multi-week program with weekly goals for your employees."}
          action={
            can("programs.manage") ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <Link href={firstTemplate ? `/business-portal/programs/new?template=${firstTemplate.id}` : "/business-portal/programs/new"}>
                    <LayoutTemplate data-icon="inline-start" /> Use {firstTemplate ? "this template" : "a template"}
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/business-portal/programs/new?template=blank">Start from scratch</Link>
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CountTabs
              value={status}
              onChange={setStatus}
              items={[
                { value: "all", label: "All", count: data?.counts.all },
                { value: "active", label: "Active", count: data?.counts.active },
                { value: "scheduled", label: "Scheduled", count: data?.counts.scheduled },
                { value: "draft", label: "Draft", count: data?.counts.draft },
                { value: "completed", label: "Completed", count: data?.counts.completed },
                { value: "archived", label: "Archived", count: data?.counts.archived },
              ]}
            />
            <SearchInput value={search} onChange={setSearch} placeholder="Search programs…" />
          </div>
          <DataTable
            columns={columns}
            rows={data?.items ?? []}
            getRowId={(p) => p.id}
            loading={list.isLoading}
            onRowClick={(p) => router.push(`/business-portal/programs/${p.id}`)}
            clientPageSize={10}
            emptyTitle={search ? "No programs match your search" : `No ${status === "all" ? "" : status} programs`}
            emptyDescription={search ? "Try a different name." : "Programs move here as their status changes."}
            className={list.isFetching && !list.isLoading ? "opacity-80 transition-opacity" : "transition-opacity"}
          />
        </>
      )}
    </PageContainer>
  )
}
