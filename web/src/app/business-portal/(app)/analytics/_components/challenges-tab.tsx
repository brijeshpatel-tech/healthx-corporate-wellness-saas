"use client"

import { CheckCircle2, Percent, Trophy, Users } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BarsChart, TrendChart } from "@/components/common/charts"
import { DataTable, type Column } from "@/components/common/data-table"
import { SectionCard } from "@/components/common/misc"
import { StatCard } from "@/components/common/stat-card"
import { EmptyState, ErrorState } from "@/components/common/states"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { analyticsApi, type ChallengeAnalyticsRow } from "@/lib/api/business/analytics"
import { useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { formatCompact, formatDate, formatNumber, formatPercent, formatShortDate, titleCase } from "@/lib/format"
import type { ChallengeType } from "@/lib/types"
import { Hidden, NotEnoughData, PercentCell, TabSkeleton, type TabFilters } from "./shared"

const TYPE_LABEL: Record<ChallengeType, string> = { individual: "Individual", leaderboard: "Leaderboard", team: "Team", company: "Company-wide", collaborative: "Collaborative" }
const short = (s: string, n = 22) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** SCR-B-025 — Challenge analytics: participation and completion across challenges. */
export function ChallengesTab({ filters, type }: { filters: TabFilters; type?: ChallengeType }) {
  const router = useRouter()
  const can = useCan()
  const query = { ...filters, type }
  const q = useApiQuery(["business", "analytics", "challenges", query], () => analyticsApi.challenges(query), { placeholderData: (p) => p })
  if (q.isLoading) return <TabSkeleton tiles={4} />
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const d = q.data!
  if (d.suppressed) return <NotEnoughData min={d.minGroupSize} scope={d.scopeLabel} />
  if (!d.rows.length)
    return (
      <EmptyState
        icon={Trophy}
        title="No challenges in this period."
        description="Try a longer date range, or launch a challenge to get people moving."
        action={
          can("challenges.manage") ? (
            <Button asChild>
              <Link href="/business-portal/challenges/new">Create challenge</Link>
            </Button>
          ) : undefined
        }
      />
    )

  const chartRows = d.rows.filter((r) => r.completionRate !== null).slice(0, 8)
  const columns: Column<ChallengeAnalyticsRow>[] = [
    {
      key: "name",
      header: "Challenge",
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl text-base" style={{ backgroundColor: `${r.coverColor}22` }}>
            {r.coverEmoji}
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium">{r.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {TYPE_LABEL[r.type]} · {titleCase(r.metric)} · {formatDate(r.startDate, "d MMM")} – {formatDate(r.endDate, "d MMM")}
            </div>
          </div>
        </div>
      ),
      className: "max-w-80",
    },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} />, hideOnMobile: true },
    {
      key: "participants",
      header: "Participants",
      align: "right",
      sortValue: (r) => r.participants,
      cell: (r) => (
        <div className="text-right">
          <div className="font-semibold tabular-nums">{formatNumber(r.participants)}</div>
          <div className="text-xs text-muted-foreground">
            {formatPercent(r.participationRate)} of {formatNumber(r.eligible)}
          </div>
        </div>
      ),
    },
    { key: "completion", header: "Completion", align: "right", sortValue: (r) => r.completionRate ?? -1, cell: (r) => <PercentCell value={r.completionRate} min={d.minGroupSize} /> },
    {
      key: "progress",
      header: "Avg progress",
      sortValue: (r) => r.avgProgress ?? -1,
      cell: (r) =>
        r.avgProgress === null ? (
          <Hidden min={d.minGroupSize} />
        ) : (
          <div className="w-32 space-y-1">
            <Progress value={r.avgProgress * 100} className="h-1.5" />
            <p className="text-xs text-muted-foreground">
              {formatPercent(r.avgProgress)}
              {r.avgValue !== null && r.type !== "collaborative" ? ` · avg ${formatCompact(r.avgValue)} ${r.unit}` : ""}
            </p>
          </div>
        ),
      hideOnMobile: true,
    },
    {
      key: "top",
      header: "Top team",
      cell: (r) => (r.topUnit ? <span className="text-sm">{r.topUnit.name}</span> : <span className="text-xs text-muted-foreground">—</span>),
      hideOnMobile: true,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Challenges in period" value={formatNumber(d.totals.challenges)} icon={Trophy} tone="violet" hint={d.byType.map((t) => `${t.challenges} ${TYPE_LABEL[t.type].toLowerCase()}`).join(" · ")} />
        <StatCard label="People taking part" value={formatNumber(d.totals.participants)} icon={Users} tone="sky" hint="unique participants" />
        <StatCard label="Average participation" value={formatPercent(d.totals.avgParticipation)} icon={Percent} tone="emerald" hint="joined ÷ eligible" />
        <StatCard label="Average completion" value={formatPercent(d.totals.avgCompletion)} icon={CheckCircle2} tone="amber" hint="reached the target" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Participation and completion" description="Top challenges in this period.">
          <BarsChart
            data={chartRows.map((r) => ({ name: short(r.name), participation: Math.round(r.participationRate * 100), completion: Math.round((r.completionRate ?? 0) * 100) }))}
            categoryKey="name"
            series={[
              { key: "participation", label: "Participation" },
              { key: "completion", label: "Completion" },
            ]}
            layout="horizontal"
            valueFormatter={(v) => `${v}%`}
            height={Math.max(220, chartRows.length * 56)}
          />
        </SectionCard>
        <SectionCard title="Daily active participants" description="People who logged progress in any challenge.">
          <TrendChart data={d.daily} series={[{ key: "participants", label: "Active participants" }]} xFormatter={(v) => formatShortDate(v)} height={Math.max(220, chartRows.length * 56) - 8} />
        </SectionCard>
      </div>

      <DataTable columns={columns} rows={d.rows} getRowId={(r) => r.id} onRowClick={(r) => router.push(`/business-portal/challenges/${r.id}`)} clientPageSize={10} />
    </div>
  )
}
