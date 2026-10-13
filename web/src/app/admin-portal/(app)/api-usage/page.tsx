"use client"

import { Download, Gauge, ServerCrash, ShieldAlert, Webhook } from "lucide-react"
import { useState } from "react"
import { FilterSelect, PeriodFilter } from "@/components/admin/filter-select"
import { TrendChart } from "@/components/common/charts"
import { DataTable, type Column } from "@/components/common/data-table"
import { SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { EmptyState, QueryState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { analyticsApi } from "@/lib/api/platform/analytics"
import type { Period } from "@/lib/api/platform/common"
import { ENDPOINT_GROUPS, usageApi, type ApiGroupBy, type ApiUsageQuery, type ApiUsageRow, type EndpointGroup } from "@/lib/api/platform/usage"
import { downloadText } from "@/lib/download"
import { formatCompact, formatDate, formatNumber, formatPercent, formatShortDate } from "@/lib/format"

const GROUP_BY_LABEL: Record<ApiGroupBy, string> = { company: "Company", client: "Integration / client", endpoint: "Endpoint group" }

/** SCR-P-028 API usage (Phase 2). */
export default function ApiUsagePage() {
  const [period, setPeriod] = useState<Period>("30d")
  const [companyId, setCompanyId] = useState("all")
  const [group, setGroup] = useState("all")
  const [groupBy, setGroupBy] = useState<ApiGroupBy>("company")

  const lookups = useApiQuery(["admin", "analytics-filters"], () => analyticsApi.lookups())
  const query: ApiUsageQuery = { period, companyId: companyId === "all" ? undefined : companyId, group: group === "all" ? undefined : (group as EndpointGroup), groupBy }
  const usage = useApiQuery(["admin", "api-usage", query], () => usageApi.api(query), { placeholderData: (prev) => prev })
  const exportCsv = useApiMutation(usageApi.exportApi, { success: "Export ready", invalidate: false, onSuccess: (r) => downloadText(r.fileName, r.csv) })
  const fmtX = (v: string) => (period === "12m" ? formatDate(v, "MMM") : formatShortDate(v))

  const columns: Column<ApiUsageRow>[] = [
    {
      key: "name",
      header: GROUP_BY_LABEL[groupBy],
      cell: (r) => (
        <div className="min-w-0 max-w-64">
          <div className="truncate text-sm font-medium">{r.name}</div>
          <div className="truncate text-xs text-muted-foreground md:hidden">
            {formatPercent(r.errorRate, 2)} errors · p95 {formatNumber(r.p95)} ms
          </div>
          {r.detail ? <div className="hidden truncate text-xs text-muted-foreground md:block">{r.detail}</div> : null}
        </div>
      ),
      sortValue: (r) => r.name,
    },
    { key: "requests", header: "Requests", align: "right", cell: (r) => <span className="tabular-nums">{formatNumber(r.requests)}</span>, sortValue: (r) => r.requests },
    { key: "errors", header: "Errors", align: "right", cell: (r) => <span className="tabular-nums">{formatNumber(r.errors)}</span>, sortValue: (r) => r.errors, hideOnMobile: true },
    {
      key: "rate",
      header: "Error %",
      align: "right",
      cell: (r) => (r.errorRate >= 0.02 ? <StatusBadge status="warning" label={formatPercent(r.errorRate, 2)} /> : <span className="tabular-nums">{formatPercent(r.errorRate, 2)}</span>),
      sortValue: (r) => r.errorRate,
      hideOnMobile: true,
    },
    { key: "p95", header: "p95", align: "right", cell: (r) => <span className="tabular-nums whitespace-nowrap">{formatNumber(r.p95)} ms</span>, sortValue: (r) => r.p95, hideOnMobile: true },
    { key: "rl", header: "Rate-limit hits", align: "right", cell: (r) => <span className="tabular-nums">{formatNumber(r.rateLimitHits)}</span>, sortValue: (r) => r.rateLimitHits, hideOnMobile: true },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="API usage"
        badge={<PhaseBadge phase={2} />}
        description="Request volumes, errors and response times per company, integration and endpoint group."
        actions={
          <Button variant="outline" onClick={() => exportCsv.mutate(query)} disabled={exportCsv.isPending || !usage.data?.rows.length}>
            {exportCsv.isPending ? <Spinner /> : <Download data-icon="inline-start" />}
            Export CSV
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <PeriodFilter value={period} onChange={setPeriod} />
        <FilterSelect value={companyId} onChange={setCompanyId} allLabel="All companies" className="sm:w-52" options={(lookups.data?.companies ?? []).map((c) => ({ value: c.id, label: c.name }))} />
        <FilterSelect value={group} onChange={setGroup} allLabel="All endpoint groups" className="sm:w-56" options={ENDPOINT_GROUPS.map((g) => ({ value: g.id, label: g.label }))} />
      </div>

      <QueryState query={usage}>
        {(data) =>
          data.totals.requests === 0 ? (
            <EmptyState icon={Webhook} title="No data for this period." description="This company made no API requests in the selected period. Suspended companies are excluded." />
          ) : (
            <div className={usage.isFetching ? "flex flex-col gap-6 opacity-70 transition-opacity" : "flex flex-col gap-6 transition-opacity"}>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Requests" value={formatCompact(data.totals.requests)} icon={Webhook} tone="sky" delta={data.previous.requests ? (data.totals.requests - data.previous.requests) / data.previous.requests : undefined} />
                <StatCard label="Error rate" value={formatPercent(data.totals.errorRate, 2)} icon={ServerCrash} tone="rose" hint={`${formatCompact(data.totals.errors)} errors · was ${formatPercent(data.previous.errorRate, 2)}`} />
                <StatCard label="p95 response time" value={`${formatNumber(data.totals.p95)} ms`} icon={Gauge} tone="violet" hint={`was ${formatNumber(data.previous.p95)} ms`} />
                <StatCard label="Rate-limit hits" value={formatNumber(data.totals.rateLimitHits)} icon={ShieldAlert} tone="amber" hint="requests throttled (429)" />
              </div>

              <SectionCard title="Requests" description={period === "12m" ? "Per week" : "Per day"}>
                <TrendChart data={data.series} series={[{ key: "requests", label: "Requests" }]} xFormatter={fmtX} tooltipLabelFormatter={(v) => formatDate(v)} valueFormatter={(v) => formatCompact(v)} height={240} />
              </SectionCard>
              <div className="grid gap-4 lg:grid-cols-2">
                <SectionCard title="Error rate" description="Share of requests that returned 5xx or failed.">
                  <TrendChart data={data.series} variant="line" series={[{ key: "errorRate", label: "Error rate" }]} xFormatter={fmtX} tooltipLabelFormatter={(v) => formatDate(v)} valueFormatter={(v) => formatPercent(v, 2)} height={200} />
                </SectionCard>
                <SectionCard title="p95 response time" description="95% of requests were faster than this.">
                  <TrendChart data={data.series} variant="line" series={[{ key: "p95", label: "p95" }]} xFormatter={fmtX} tooltipLabelFormatter={(v) => formatDate(v)} valueFormatter={(v) => `${formatNumber(v)}ms`} height={200} />
                </SectionCard>
              </div>

              <DataTable
                key={groupBy}
                columns={columns}
                rows={data.rows}
                getRowId={(r) => r.id}
                clientPageSize={12}
                emptyTitle="No data for this period."
                toolbar={
                  <>
                    <span className="text-sm font-medium">Breakdown by</span>
                    <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as ApiGroupBy)}>
                      <TabsList>
                        <TabsTrigger value="company" className="px-2.5">Company</TabsTrigger>
                        <TabsTrigger value="client" className="px-2.5">Integration</TabsTrigger>
                        <TabsTrigger value="endpoint" className="px-2.5">Endpoint</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <span className="ml-auto text-sm text-muted-foreground">{formatNumber(data.rows.length)} rows</span>
                  </>
                }
              />
            </div>
          )
        }
      </QueryState>
    </PageContainer>
  )
}
