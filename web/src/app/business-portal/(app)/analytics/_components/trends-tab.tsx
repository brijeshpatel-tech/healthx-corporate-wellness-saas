"use client"

import { LineChart } from "lucide-react"
import { BarsChart, TrendChart } from "@/components/common/charts"
import { SectionCard } from "@/components/common/misc"
import { EmptyState, ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { analyticsApi, type AnalyticsRange, type Granularity, type TrendPoint } from "@/lib/api/business/analytics"
import { useApiQuery } from "@/lib/api/hooks"
import { formatCompact, formatDate, formatNumber, formatPercent } from "@/lib/format"
import { NotEnoughData, TabSkeleton, type TabFilters } from "./shared"

type Key = Exclude<keyof TrendPoint, "period">

const CHARTS: { key: Key; title: string; description: string; kind: "line" | "bar"; format: (v: number) => string }[] = [
  { key: "participation", title: "Participation", description: "Active ÷ joined employees", kind: "line", format: (v) => formatPercent(v) },
  { key: "avgSteps", title: "Activity", description: "Average steps per active employee per day", kind: "line", format: (v) => formatCompact(v) },
  { key: "challengeParticipation", title: "Challenge participation", description: "Eligible employees in at least one challenge", kind: "line", format: (v) => formatPercent(v) },
  { key: "wellnessScore", title: "Average wellness score", description: "Company average, 0–100", kind: "line", format: (v) => formatNumber(v) },
  { key: "wau", title: "Employee engagement", description: "Weekly active users", kind: "line", format: (v) => formatNumber(v) },
  { key: "monthlyActive", title: "Monthly active employees", description: "Active in the last 30 days", kind: "line", format: (v) => formatNumber(v) },
  { key: "redemptions", title: "Reward redemptions", description: "Orders placed", kind: "bar", format: (v) => formatNumber(v) },
]

/** SCR-B-028 — Wellness trends (Phase 2). */
export function TrendsTab({ filters, granularity, onRangeChange }: { filters: TabFilters; granularity: Granularity; onRangeChange: (r: AnalyticsRange) => void }) {
  const query = { ...filters, granularity }
  const q = useApiQuery(["business", "analytics", "trends", query], () => analyticsApi.trends(query), { placeholderData: (p) => p })
  if (q.isLoading) return <TabSkeleton tiles={0} />
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const d = q.data!
  if (d.suppressed) return <NotEnoughData min={d.minGroupSize} scope={d.scopeLabel} />
  if (d.tooShort || d.points.length < 2)
    return (
      <EmptyState
        icon={LineChart}
        title="Trends appear after one month of data."
        description={`Choose a longer date range to see ${granularity === "month" ? "monthly" : "weekly"} trends.`}
        action={<Button onClick={() => onRangeChange(granularity === "month" ? "180d" : "90d")}>Show the last {granularity === "month" ? "6 months" : "90 days"}</Button>}
      />
    )

  const label = (v: string) => (granularity === "month" ? formatDate(v, "MMM yy") : formatDate(v, "d MMM"))
  const data = d.points.map((p) => ({ ...p }))
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {CHARTS.map((c) => {
        const first = d.points[0]![c.key]
        const last = d.points[d.points.length - 1]![c.key]
        const delta = first ? (last - first) / first : 0
        return (
          <SectionCard
            key={c.key}
            title={c.title}
            description={c.description}
            actions={
              <div className="text-right">
                <p className="font-heading text-lg font-bold tabular-nums">{c.format(last)}</p>
                <p className={delta >= 0 ? "text-xs font-medium text-emerald-700 dark:text-emerald-400" : "text-xs font-medium text-rose-700 dark:text-rose-400"}>
                  {delta >= 0 ? "+" : "−"}
                  {Math.abs(Math.round(delta * 100))}% over period
                </p>
              </div>
            }
            className={c.key === "redemptions" ? "md:col-span-2" : undefined}
          >
            {c.kind === "bar" ? (
              <BarsChart data={data} categoryKey="period" series={[{ key: c.key, label: c.title }]} categoryFormatter={label} valueFormatter={c.format} height={200} />
            ) : (
              <TrendChart data={data} series={[{ key: c.key, label: c.title }]} xFormatter={label} valueFormatter={c.format} height={200} />
            )}
          </SectionCard>
        )
      })}
    </div>
  )
}
