"use client"

import { Activity, Download, LayoutGrid, MousePointerClick, Users } from "lucide-react"
import { useState } from "react"
import { FilterSelect, PeriodFilter } from "@/components/admin/filter-select"
import { MODULE_ICON } from "@/components/admin/module-picker"
import { BarsChart, Sparkline, TrendChart } from "@/components/common/charts"
import { DataTable, type Column } from "@/components/common/data-table"
import { InlineBar, SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatCard, Delta } from "@/components/common/stat-card"
import { PhaseBadge } from "@/components/common/status-badge"
import { EmptyState, QueryState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { analyticsApi } from "@/lib/api/platform/analytics"
import type { Period } from "@/lib/api/platform/common"
import { usageApi, type FeatureUsageQuery, type FeatureUsageRow } from "@/lib/api/platform/usage"
import { downloadText } from "@/lib/download"
import { formatCompact, formatNumber, formatPercent, formatShortDate } from "@/lib/format"
import { MODULE_LABEL, type ModuleCode } from "@/lib/types"

/** SCR-P-027 Feature usage (Phase 2). */
export default function FeatureUsagePage() {
  const [period, setPeriod] = useState<Period>("30d")
  const [companyId, setCompanyId] = useState("all")
  const [feature, setFeature] = useState("all")

  const lookups = useApiQuery(["admin", "analytics-filters"], () => analyticsApi.lookups())
  const query: FeatureUsageQuery = { period, companyId: companyId === "all" ? undefined : companyId, feature: feature === "all" ? undefined : (feature as ModuleCode) }
  const usage = useApiQuery(["admin", "feature-usage", query], () => usageApi.features(query), { placeholderData: (prev) => prev })
  const exportCsv = useApiMutation(usageApi.exportFeatures, { success: "Export ready", invalidate: false, onSuccess: (r) => downloadText(r.fileName, r.csv) })
  const hasData = !!usage.data?.rows.some((r) => r.users > 0)

  const columns: Column<FeatureUsageRow>[] = [
    {
      key: "feature",
      header: "Feature",
      cell: (r) => {
        const Icon = MODULE_ICON[r.module]
        return (
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{Icon ? <Icon className="size-4" /> : null}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium">{r.label}</span>
                {r.phase === 2 ? <PhaseBadge phase={2} /> : null}
              </div>
              <div className="text-xs text-muted-foreground md:hidden">{formatCompact(r.users)} users · {formatPercent(r.adoption)}</div>
            </div>
          </div>
        )
      },
      sortValue: (r) => r.label,
    },
    { key: "users", header: "Users", align: "right", cell: (r) => <span className="tabular-nums">{formatNumber(r.users)}</span>, sortValue: (r) => r.users, hideOnMobile: true },
    {
      key: "companies",
      header: "Companies",
      align: "right",
      cell: (r) => (
        <span className="tabular-nums">
          {formatNumber(r.companies)}
          <span className="text-xs text-muted-foreground"> / {formatNumber(r.enabledCompanies)}</span>
        </span>
      ),
      sortValue: (r) => r.companies,
      hideOnMobile: true,
    },
    { key: "events", header: "Events", align: "right", cell: (r) => <span className="tabular-nums">{formatCompact(r.events)}</span>, sortValue: (r) => r.events, hideOnMobile: true },
    {
      key: "adoption",
      header: "Adoption",
      cell: (r) => (
        <div className="flex min-w-28 items-center gap-2">
          <InlineBar value={r.adoption} max={1} className="flex-1" />
          <span className="w-10 text-right text-sm tabular-nums">{formatPercent(r.adoption)}</span>
        </div>
      ),
      sortValue: (r) => r.adoption,
      hideOnMobile: true,
    },
    {
      key: "trend",
      header: "Trend",
      cell: (r) => (
        <div className="flex items-center justify-end gap-2">
          <Sparkline values={r.trend} className="w-20" height={28} />
          <Delta value={r.delta} className="text-xs" />
        </div>
      ),
      align: "right",
      sortValue: (r) => r.delta,
    },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Feature usage"
        badge={<PhaseBadge phase={2} />}
        description="Which features are used, by how many people and companies — from app analytics events. Aggregates only."
        actions={
          <Button variant="outline" onClick={() => exportCsv.mutate(query)} disabled={exportCsv.isPending || !hasData}>
            {exportCsv.isPending ? <Spinner /> : <Download data-icon="inline-start" />}
            Export CSV
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <PeriodFilter value={period} onChange={setPeriod} />
        <FilterSelect value={companyId} onChange={setCompanyId} allLabel="All companies" className="sm:w-52" options={(lookups.data?.companies ?? []).map((c) => ({ value: c.id, label: c.name }))} />
        <FilterSelect value={feature} onChange={setFeature} allLabel="All features" className="sm:w-52" options={(Object.keys(MODULE_LABEL) as ModuleCode[]).map((m) => ({ value: m, label: MODULE_LABEL[m] }))} />
      </div>

      <QueryState query={usage}>
        {(data) =>
          !hasData ? (
            <EmptyState
              icon={MousePointerClick}
              title="No usage data yet."
              description="Usage appears once employees in the selected company start using this feature. Check that the module is enabled for the company."
              action={
                companyId !== "all" || feature !== "all" ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCompanyId("all")
                      setFeature("all")
                    }}
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className={usage.isFetching ? "flex flex-col gap-6 opacity-70 transition-opacity" : "flex flex-col gap-6 transition-opacity"}>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Active users" value={formatCompact(data.totals.activeUsers)} icon={Users} tone="emerald" hint={data.periodLabel.toLowerCase()} />
                <StatCard label="Events tracked" value={formatCompact(data.totals.events)} icon={Activity} tone="sky" />
                <StatCard label="Features in use" value={formatNumber(data.totals.featuresInUse)} icon={LayoutGrid} tone="violet" hint={`of ${formatNumber(data.rows.length)}`} />
                <StatCard label="Top feature" value={<span className="text-xl">{data.rows[0]?.label ?? "—"}</span>} icon={MousePointerClick} tone="amber" hint={data.rows[0] ? `${formatPercent(data.rows[0].adoption)} adoption` : undefined} />
              </div>
              <div className="grid gap-4 lg:grid-cols-5">
                <SectionCard title="Top features by users" className="lg:col-span-3">
                  <BarsChart data={data.rows.slice(0, 8).map((r) => ({ label: r.label, users: r.users }))} categoryKey="label" layout="horizontal" series={[{ key: "users", label: "Users" }]} valueFormatter={(v) => formatCompact(v)} height={Math.max(180, Math.min(8, data.rows.length) * 36)} />
                </SectionCard>
                <SectionCard title="Events per day" description={feature === "all" ? "All features" : MODULE_LABEL[feature as ModuleCode]} className="lg:col-span-2">
                  <TrendChart data={data.daily} series={[{ key: "events", label: "Events" }]} xFormatter={formatShortDate} valueFormatter={(v) => formatCompact(v)} height={Math.max(180, Math.min(8, data.rows.length) * 36)} />
                </SectionCard>
              </div>
              <DataTable columns={columns} rows={data.rows} getRowId={(r) => r.module} emptyTitle="No usage data yet." />
            </div>
          )
        }
      </QueryState>
    </PageContainer>
  )
}
