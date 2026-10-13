"use client"

import { Activity, CalendarDays, CalendarRange, Clock, Magnet, Repeat } from "lucide-react"
import { BarsChart, TrendChart } from "@/components/common/charts"
import { InlineBar, SectionCard } from "@/components/common/misc"
import { StatCard } from "@/components/common/stat-card"
import { ErrorState } from "@/components/common/states"
import { analyticsApi } from "@/lib/api/business/analytics"
import { useApiQuery } from "@/lib/api/hooks"
import { formatNumber, formatPercent, formatShortDate } from "@/lib/format"
import { change, NotEnoughData, pointChange, TabSkeleton, type TabFilters } from "./shared"

/** SCR-B-026 — Engagement: DAU / WAU / MAU, stickiness and session frequency (Phase 2). */
export function EngagementTab({ filters }: { filters: TabFilters }) {
  const q = useApiQuery(["business", "analytics", "engagement", filters], () => analyticsApi.engagement(filters), { placeholderData: (p) => p })
  if (q.isLoading) return <TabSkeleton tiles={6} />
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const d = q.data!
  if (d.suppressed) return <NotEnoughData min={d.minGroupSize} scope={d.scopeLabel} />
  const c = d.current
  const p = d.previous

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Daily active users (avg)" value={formatNumber(c.dau)} icon={Activity} tone="emerald" delta={change(c.dau, p.dau)} deltaLabel="vs previous period" />
        <StatCard label="Weekly active users (avg)" value={formatNumber(c.wau)} icon={CalendarDays} tone="sky" delta={change(c.wau, p.wau)} deltaLabel="vs previous period" />
        <StatCard label="Monthly active users" value={formatNumber(c.mau)} icon={CalendarRange} tone="violet" delta={change(c.mau, p.mau)} deltaLabel="vs previous period" />
        <StatCard label="Stickiness (DAU ÷ MAU)" value={formatPercent(c.stickiness)} icon={Magnet} tone="amber" delta={pointChange(c.stickiness, p.stickiness)} deltaLabel="points" hint="share of monthly users who come back daily" />
        <StatCard label="Sessions per user / week" value={c.sessionsPerUserWeek.toFixed(1)} icon={Repeat} tone="rose" delta={change(c.sessionsPerUserWeek, p.sessionsPerUserWeek)} deltaLabel="vs previous period" />
        <StatCard label="Average session length" value={`${c.avgSessionMinutes.toFixed(1)} min`} icon={Clock} tone="slate" delta={change(c.avgSessionMinutes, p.avgSessionMinutes)} deltaLabel="vs previous period" />
      </div>

      <SectionCard title="Active users over time" description="Daily, weekly (rolling 7 days) and monthly (rolling 30 days) active users.">
        <TrendChart
          data={d.series}
          series={[
            { key: "mau", label: "Monthly active" },
            { key: "wau", label: "Weekly active" },
            { key: "dau", label: "Daily active" },
          ]}
          variant="line"
          xFormatter={(v) => formatShortDate(v)}
          height={280}
        />
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Sessions by day of week" description="Average app sessions per weekday.">
          <BarsChart data={d.sessionsByWeekday} categoryKey="day" series={[{ key: "sessions", label: "Sessions" }]} height={240} />
        </SectionCard>
        <SectionCard title="Feature usage" description="Share of active employees who used each feature in the period.">
          <ul className="space-y-3.5">
            {d.featureUsage.map((f) => (
              <li key={f.feature} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{f.feature}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatPercent(f.share)} · {formatNumber(f.users)} people
                  </span>
                </div>
                <InlineBar value={f.share} max={1} />
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  )
}
