"use client"

import { Droplets, Dumbbell, Footprints, ListChecks, Moon, UserX } from "lucide-react"
import { TrendChart } from "@/components/common/charts"
import { DataTable, type Column } from "@/components/common/data-table"
import { SectionCard } from "@/components/common/misc"
import { StatCard } from "@/components/common/stat-card"
import { ErrorState } from "@/components/common/states"
import { analyticsApi, type ParticipationRow } from "@/lib/api/business/analytics"
import { useApiQuery } from "@/lib/api/hooks"
import { formatNumber, formatPercent, formatShortDate } from "@/lib/format"
import { change, Hidden, NotEnoughData, PercentCell, pointChange, TabSkeleton, type TabFilters } from "./shared"

/** SCR-B-027 — Wellness participation (aggregated only, Phase 2). */
export function ParticipationTab({ filters }: { filters: TabFilters }) {
  const q = useApiQuery(["business", "analytics", "participation", filters], () => analyticsApi.participation(filters), { placeholderData: (p) => p })
  if (q.isLoading) return <TabSkeleton tiles={5} />
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const d = q.data!
  if (d.suppressed) return <NotEnoughData min={d.minGroupSize} scope={d.scopeLabel} />
  const t = d.tiles
  const group = d.groupedBy === "team" ? "Team" : "Department"

  const columns: Column<ParticipationRow>[] = [
    { key: "name", header: group, sortValue: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "employees", header: "Employees", align: "right", sortValue: (r) => r.employees, cell: (r) => <span className="tabular-nums">{formatNumber(r.employees)}</span>, hideOnMobile: true },
    { key: "steps", header: "Avg steps / day", align: "right", sortValue: (r) => r.avgSteps ?? -1, cell: (r) => (r.avgSteps === null ? <Hidden min={d.minGroupSize} /> : <span className="font-medium tabular-nums">{formatNumber(r.avgSteps)}</span>) },
    { key: "workout", header: "Workouts", align: "right", sortValue: (r) => r.workout ?? -1, cell: (r) => <PercentCell value={r.workout} min={d.minGroupSize} /> },
    { key: "hydration", header: "Hydration", align: "right", sortValue: (r) => r.hydration ?? -1, cell: (r) => <PercentCell value={r.hydration} min={d.minGroupSize} />, hideOnMobile: true },
    { key: "sleep", header: "Sleep tracking", align: "right", sortValue: (r) => r.sleep ?? -1, cell: (r) => <PercentCell value={r.sleep} min={d.minGroupSize} />, hideOnMobile: true },
    { key: "habit", header: "Habit completion", align: "right", sortValue: (r) => r.habit ?? -1, cell: (r) => <PercentCell value={r.habit} min={d.minGroupSize} />, hideOnMobile: true },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Average steps" value={formatNumber(t.avgSteps.value)} icon={Footprints} tone="emerald" delta={change(t.avgSteps.value, t.avgSteps.previous)} deltaLabel="vs previous" hint="per active employee per day" />
        <StatCard label="Workout participation" value={formatPercent(t.workout.value)} icon={Dumbbell} tone="violet" delta={pointChange(t.workout.value, t.workout.previous)} deltaLabel="points" />
        <StatCard label="Hydration participation" value={formatPercent(t.hydration.value)} icon={Droplets} tone="sky" delta={pointChange(t.hydration.value, t.hydration.previous)} deltaLabel="points" />
        <StatCard label="Sleep tracking" value={formatPercent(t.sleep.value)} icon={Moon} tone="slate" delta={pointChange(t.sleep.value, t.sleep.previous)} deltaLabel="points" />
        <StatCard label="Habit completion" value={formatPercent(t.habit.value)} icon={ListChecks} tone="amber" delta={pointChange(t.habit.value, t.habit.previous)} deltaLabel="points" />
      </div>

      <SectionCard title="Participation over time" description="Weekly share of joined employees taking part in each activity.">
        <TrendChart
          data={d.trend}
          series={[
            { key: "habit", label: "Habit completion" },
            { key: "hydration", label: "Hydration" },
            { key: "workout", label: "Workouts" },
            { key: "sleep", label: "Sleep tracking" },
          ]}
          variant="line"
          valueFormatter={(v) => `${Math.round(v)}%`}
          xFormatter={(v) => formatShortDate(v)}
          yDomain={[0, 100]}
          height={280}
        />
      </SectionCard>

      <section className="space-y-3">
        <div>
          <h3 className="font-heading text-base font-semibold">By {group.toLowerCase()}</h3>
          <p className="text-sm text-muted-foreground">
            Example: &quot;Engineering average steps: 8,240&quot; — never an individual&apos;s figures. {group}s with fewer than {d.minGroupSize} people are hidden.
          </p>
        </div>
        <DataTable columns={columns} rows={d.rows} getRowId={(r) => r.id} emptyTitle={`No ${group.toLowerCase()}s to compare`} />
      </section>

      {d.optedOut > 0 ? (
        <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <UserX className="size-3.5" /> {formatNumber(d.optedOut)} employees opted out of analytics and are excluded from these figures.
        </p>
      ) : null}
    </div>
  )
}
