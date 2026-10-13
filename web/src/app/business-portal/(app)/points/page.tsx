"use client"

import { Award, ChevronDown, Coins, Download, Gift, SlidersHorizontal, Wallet } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { AdjustPointsDialog } from "@/components/business/engagement/points/adjust-points-dialog"
import { AwardsLog, type AwardsFilters } from "@/components/business/engagement/points/awards-log"
import { MonthlyPointsCard, PointsSourcesCard } from "@/components/business/engagement/points/points-overview"
import { PrivacyNote } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { PhaseBadge } from "@/components/common/status-badge"
import { ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { pointsApi, type SourcePeriod } from "@/lib/api/business/points"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { downloadText } from "@/lib/download"
import { formatCompact, formatNumber, pluralize } from "@/lib/format"

/** SCR-B-035 Points (Phase 2) — company-level totals only (client decision #18), plus the admin awards log. */
export default function PointsPage() {
  const can = useCan()
  const manage = can("points.manage")
  const [period, setPeriod] = useState<SourcePeriod>("this_month")
  const [filters, setFilters] = useState<AwardsFilters>({ search: "", kind: "all", range: {} })
  const [adjustOpen, setAdjustOpen] = useState(false)

  const summary = useApiQuery(["business", "points", "summary", period], () => pointsApi.summary({ period }), { placeholderData: (prev) => prev })
  const s = summary.data
  const onDownload = (r: { fileName: string; csv: string }) => downloadText(r.fileName, r.csv)
  const exportSummary = useApiMutation(pointsApi.exportSummary, { success: "Export ready", invalidate: false, onSuccess: onDownload })
  const exportAwards = useApiMutation(pointsApi.exportAwards, { success: "Export ready", invalidate: false, onSuccess: onDownload })

  return (
    <PageContainer>
      <PageHeader
        title="Points"
        badge={<PhaseBadge phase={2} />}
        description="Company-wide points: how many were awarded, redeemed and are still to spend, and the bonuses and corrections admins made. Points never expire."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={exportSummary.isPending || exportAwards.isPending}>
                  <Download data-icon="inline-start" /> Export <ChevronDown data-icon="inline-end" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => exportSummary.mutate()}>Monthly summary (CSV)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportAwards.mutate({ search: filters.search || undefined, kind: filters.kind, from: filters.range.from, to: filters.range.to })}>
                  Awards & adjustments log (CSV)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {manage ? (
              <>
                <Button variant="outline" onClick={() => setAdjustOpen(true)}>
                  <SlidersHorizontal data-icon="inline-start" /> Adjust points
                </Button>
                <Button asChild>
                  <Link href="/business-portal/points/award">
                    <Award data-icon="inline-start" /> Award points
                  </Link>
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {summary.error && !s ? (
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard
              label="Awarded this month"
              value={s ? formatCompact(s.awardedThisMonth) : "—"}
              loading={summary.isLoading}
              icon={Coins}
              tone="emerald"
              hint={s ? `${formatCompact(s.awardedLastMonth)} last month` : undefined}
            />
            <StatCard
              label="Redeemed this month"
              value={s ? formatCompact(s.redeemedThisMonth) : "—"}
              loading={summary.isLoading}
              icon={Gift}
              tone="rose"
              hint={s ? `${pluralize(s.redemptionsThisMonth, "order")} · ${formatCompact(s.redeemedLastMonth)} last month` : undefined}
              href={can("orders.view") ? "/business-portal/orders" : undefined}
            />
            <StatCard
              label="Outstanding"
              value={s ? formatCompact(s.outstanding) : "—"}
              loading={summary.isLoading}
              icon={Wallet}
              tone="amber"
              hint={s ? `unspent across ${formatNumber(s.employeesWithBalance)} employees` : undefined}
            />
            <StatCard
              label="Admin awards this month"
              value={s ? formatNumber(s.awardsThisMonth.count) : "—"}
              loading={summary.isLoading}
              icon={Award}
              tone="violet"
              hint={s ? `+${formatCompact(s.awardsThisMonth.credited)} / −${formatCompact(s.awardsThisMonth.debited)} points` : undefined}
            />
          </div>

          {s ? (
            <div className="grid gap-4 lg:grid-cols-5">
              <MonthlyPointsCard summary={s} className="lg:col-span-3" />
              <PointsSourcesCard summary={s} period={period} onPeriodChange={setPeriod} fetching={summary.isFetching} className="lg:col-span-2" />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-5">
              <Skeleton className="h-80 rounded-xl lg:col-span-3" />
              <Skeleton className="h-80 rounded-xl lg:col-span-2" />
            </div>
          )}

          <PrivacyNote minGroupSize={s?.minGroupSize}>
            Privacy first: you only see company totals. No one at your company can see an individual employee&apos;s points history or what they earned points for, and
            sources used by fewer than {s?.minGroupSize ?? 5} people are hidden.
          </PrivacyNote>
        </>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="awards-heading">
        <div>
          <h2 id="awards-heading" className="font-heading text-base font-semibold">
            Admin awards & adjustments
          </h2>
          <p className="text-sm text-muted-foreground">Every bonus and correction made by an admin — who did it, when, why and for whom.</p>
        </div>
        <AwardsLog filters={filters} onChange={(f) => setFilters((prev) => ({ ...prev, ...f }))} canAward={manage} />
      </section>

      <AdjustPointsDialog open={adjustOpen} onOpenChange={setAdjustOpen} />
    </PageContainer>
  )
}
