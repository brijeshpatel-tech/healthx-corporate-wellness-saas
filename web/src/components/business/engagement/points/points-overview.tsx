"use client"

import { EyeOff } from "lucide-react"
import { BarsChart } from "@/components/common/charts"
import { InlineBar, SectionCard } from "@/components/common/misc"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { PointsSummary, SourcePeriod } from "@/lib/api/business/points"
import { formatCompact, formatNumber, formatPercent } from "@/lib/format"

/** Awarded vs redeemed per calendar month (company totals). */
export function MonthlyPointsCard({ summary, className }: { summary: PointsSummary; className?: string }) {
  return (
    <SectionCard className={className} title="Points by month" description="Company totals for the last 6 months. The current month is month-to-date.">
      <BarsChart
        data={summary.monthly}
        categoryKey="label"
        series={[
          { key: "awarded", label: "Awarded" },
          { key: "redeemed", label: "Redeemed" },
        ]}
        valueFormatter={(v) => formatCompact(v)}
        height={260}
      />
    </SectionCard>
  )
}

const PERIODS: { value: SourcePeriod; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_6_months", label: "6 months" },
]

/** Where points come from — company totals by source, small groups hidden. */
export function PointsSourcesCard({
  summary,
  period,
  onPeriodChange,
  fetching,
  className,
}: {
  summary: PointsSummary
  period: SourcePeriod
  onPeriodChange: (p: SourcePeriod) => void
  fetching?: boolean
  className?: string
}) {
  const s = summary.sources
  const max = Math.max(1, ...s.rows.filter((r) => !r.hidden).map((r) => r.points))
  return (
    <SectionCard
      className={className}
      title="Where points come from"
      description={`${formatNumber(s.total)} points awarded ${s.periodLabel}, by source.`}
      actions={
        <ToggleGroup type="single" variant="outline" size="sm" value={period} onValueChange={(v) => v && onPeriodChange(v as SourcePeriod)} aria-label="Period">
          {PERIODS.map((p) => (
            <ToggleGroupItem key={p.value} value={p.value} className="px-2.5 text-xs">
              {p.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      }
    >
      <ul className={fetching ? "space-y-3.5 opacity-70 transition-opacity" : "space-y-3.5 transition-opacity"}>
        {s.rows.map((r) => (
          <li key={r.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{r.label}</span>
              {r.hidden ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <EyeOff className="size-3.5" /> Hidden (&lt; {summary.minGroupSize} people)
                </span>
              ) : (
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  <span className="font-semibold text-foreground">{formatCompact(r.points)}</span> · {formatPercent(r.share)}
                </span>
              )}
            </div>
            <InlineBar value={r.hidden ? 0 : r.points} max={max} />
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
