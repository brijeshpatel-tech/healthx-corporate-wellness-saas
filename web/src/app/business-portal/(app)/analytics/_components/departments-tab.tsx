"use client"

import { AlertTriangle, Megaphone, Network, Percent, TrendingUp } from "lucide-react"
import Link from "next/link"
import { BarsChart, Sparkline } from "@/components/common/charts"
import { DataTable, type Column } from "@/components/common/data-table"
import { InlineBar, SectionCard } from "@/components/common/misc"
import { StatCard } from "@/components/common/stat-card"
import { EmptyState, ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { analyticsApi, type DepartmentAnalyticsRow } from "@/lib/api/business/analytics"
import { useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { formatNumber, formatPercent } from "@/lib/format"
import { Hidden, PercentCell, TabSkeleton, type TabFilters } from "./shared"

const announceHref = (ids: string[]) => `/business-portal/announcements/new?audience=departments&ids=${ids.join(",")}`

/** SCR-B-024 — Departments: employees, active, participation, low-participation flags. */
export function DepartmentsTab({ filters, threshold: requested }: { filters: TabFilters; threshold?: number }) {
  const can = useCan()
  const query = { range: filters.range, threshold: requested }
  const q = useApiQuery(["business", "analytics", "departments", query], () => analyticsApi.departments(query), { placeholderData: (p) => p })
  if (q.isLoading) return <TabSkeleton tiles={3} />
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const d = q.data!
  if (!d.rows.length) return <EmptyState icon={Network} title="No departments yet." description="Add departments to compare participation across your company." action={<Button asChild><Link href="/business-portal/departments">Go to Departments</Link></Button>} />

  const threshold = d.threshold
  const visible = d.rows.filter((r) => r.participation !== null)
  const low = d.rows.filter((r) => r.low)
  const best = visible[0]
  const columns: Column<DepartmentAnalyticsRow>[] = [
    {
      key: "name",
      header: "Department",
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{r.name}</span>
          {r.low ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/14 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
              <AlertTriangle className="size-3" /> Low
            </span>
          ) : null}
        </div>
      ),
    },
    { key: "employees", header: "Employees", align: "right", sortValue: (r) => r.employees, cell: (r) => <span className="tabular-nums">{formatNumber(r.employees)}</span> },
    { key: "active", header: "Active", align: "right", sortValue: (r) => r.active, cell: (r) => (r.suppressed ? <Hidden min={d.minGroupSize} /> : <span className="tabular-nums">{formatNumber(r.active)}</span>), hideOnMobile: true },
    {
      key: "participation",
      header: "Participation",
      sortValue: (r) => r.participation ?? -1,
      cell: (r) =>
        r.participation === null ? (
          <Hidden min={d.minGroupSize} />
        ) : (
          <div className="flex w-40 items-center gap-2">
            <InlineBar value={r.participation} max={1} color={r.low ? "var(--chart-4)" : undefined} />
            <PercentCell value={r.participation} min={d.minGroupSize} low={r.low} />
          </div>
        ),
    },
    { key: "steps", header: "Avg steps / day", align: "right", sortValue: (r) => r.avgSteps ?? -1, cell: (r) => (r.avgSteps === null ? <Hidden min={d.minGroupSize} /> : <span className="tabular-nums">{formatNumber(r.avgSteps)}</span>), hideOnMobile: true },
    { key: "challenge", header: "In a challenge", align: "right", sortValue: (r) => r.challengeParticipation ?? -1, cell: (r) => <PercentCell value={r.challengeParticipation} min={d.minGroupSize} />, hideOnMobile: true },
    { key: "trend", header: "Trend", cell: (r) => (r.trend ? <Sparkline values={r.trend} className="w-24" height={28} color={r.low ? "var(--chart-4)" : undefined} /> : null), hideOnMobile: true },
    {
      key: "action",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (r) =>
        r.low && can("announcements.manage") ? (
          <Button asChild size="sm" variant="outline">
            <Link href={announceHref([r.id])}>
              <Megaphone data-icon="inline-start" /> Nudge
            </Link>
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Company participation" value={formatPercent(d.companyParticipation)} icon={Percent} tone="emerald" hint="active ÷ eligible employees × 100" />
        <StatCard label="Highest participation" value={best ? formatPercent(best.participation) : "—"} icon={TrendingUp} tone="sky" hint={best?.name} />
        <StatCard label={`Below ${formatPercent(threshold)} threshold`} value={formatNumber(low.length)} icon={AlertTriangle} tone="amber" hint={low.length ? low.map((l) => l.name).join(", ") : "No departments need a nudge"} />
      </div>

      {low.length ? (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-4 sm:flex-row sm:items-center">
          <AlertTriangle className="size-5 shrink-0 text-amber-600" />
          <p className="flex-1 text-sm">
            <span className="font-semibold">
              {low.length} {low.length === 1 ? "department is" : "departments are"} below {formatPercent(threshold)} participation.
            </span>{" "}
            <span className="text-muted-foreground">A targeted announcement or a team challenge usually helps.</span>
          </p>
          {can("announcements.manage") ? (
            <Button asChild size="sm">
              <Link href={announceHref(low.map((l) => l.id))}>
                <Megaphone data-icon="inline-start" /> Send announcement
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <SectionCard title="Participation by department" description={`Participation = active ÷ eligible employees × 100. Departments below ${formatPercent(threshold)} are flagged in the table.`}>
        {visible.length ? (
          <BarsChart
            data={visible.map((r) => ({ name: r.name, participation: Math.round((r.participation ?? 0) * 100) }))}
            categoryKey="name"
            series={[{ key: "participation", label: "Participation" }]}
            layout="horizontal"
            valueFormatter={(v) => `${v}%`}
            height={Math.max(200, visible.length * 42)}
          />
        ) : (
          <p className="text-sm text-muted-foreground">All departments are below the minimum group size.</p>
        )}
      </SectionCard>

      <DataTable columns={columns} rows={d.rows} getRowId={(r) => r.id} />
    </div>
  )
}
