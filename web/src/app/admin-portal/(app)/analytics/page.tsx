"use client"

import { Activity, BarChart3, Building2, Download, Droplets, Dumbbell, Footprints, Gauge, HeartPulse, IndianRupee, ListChecks, Percent, Repeat, TrendingDown, TrendingUp, Trophy, UserCheck, UserPlus, Users } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { FilterSelect, PeriodFilter } from "@/components/admin/filter-select"
import { ActivationFunnel, CohortTable } from "@/components/admin/platform/analytics-visuals"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { BarsChart, TrendChart } from "@/components/common/charts"
import { SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { PhaseBadge } from "@/components/common/status-badge"
import { EmptyState, QueryState } from "@/components/common/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { analyticsApi, type AnalyticsData, type AnalyticsQuery, type Kpi } from "@/lib/api/platform/analytics"
import type { Period } from "@/lib/api/platform/common"
import { downloadText } from "@/lib/download"
import { formatCompact, formatCurrency, formatDate, formatNumber, formatPercent, formatShortDate } from "@/lib/format"

const delta = (k: Kpi) => (k.previous ? (k.value - k.previous) / k.previous : undefined)

const TABS = ["acquisition", "activation", "engagement", "retention", "wellness", "revenue"]

export default function Page() {
  return (
    <Suspense>
      <PlatformAnalyticsPage />
    </Suspense>
  )
}

/** SCR-P-024 Platform analytics & KPIs (aggregates only). */
function PlatformAnalyticsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const can = useAdminCan()
  const [period, setPeriod] = useState<Period>("30d")
  const [companyId, setCompanyId] = useState("all")
  const [planId, setPlanId] = useState("all")
  const tabParam = params.get("tab") ?? ""
  const tab = TABS.includes(tabParam) && (tabParam !== "revenue" || can("revenue.view")) ? tabParam : "acquisition"
  const setTab = (t: string) => router.replace(t === "acquisition" ? pathname : `${pathname}?tab=${t}`, { scroll: false })

  const lookups = useApiQuery(["admin", "analytics-filters"], () => analyticsApi.lookups())
  const query: AnalyticsQuery = { period, companyId: companyId === "all" ? undefined : companyId, planId: planId === "all" ? undefined : planId }
  const analytics = useApiQuery(["admin", "analytics", query], () => analyticsApi.get(query), { placeholderData: (prev) => prev })
  const exportCsv = useApiMutation(analyticsApi.exportCsv, { success: "Export ready", invalidate: false, onSuccess: (r) => downloadText(r.fileName, r.csv) })
  const showRevenue = can("revenue.view")

  return (
    <PageContainer>
      <PageHeader
        title="Analytics & KPIs"
        description="Platform-wide acquisition, activation, engagement, retention and wellness — aggregated across companies. No individual health data."
        actions={
          <Button variant="outline" onClick={() => exportCsv.mutate(query)} disabled={exportCsv.isPending || !analytics.data?.enoughData}>
            {exportCsv.isPending ? <Spinner /> : <Download data-icon="inline-start" />}
            Export CSV
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <PeriodFilter value={period} onChange={setPeriod} />
        <FilterSelect value={companyId} onChange={setCompanyId} allLabel="All companies" className="sm:w-52" options={(lookups.data?.companies ?? []).map((c) => ({ value: c.id, label: c.name }))} />
        <FilterSelect value={planId} onChange={setPlanId} allLabel="All plans" className="sm:w-36" options={(lookups.data?.plans ?? []).map((p) => ({ value: p.id, label: p.name }))} />
        {analytics.data ? (
          <Badge variant="secondary" className="ml-auto">
            {analytics.data.scope.label} · {analytics.data.periodLabel}
          </Badge>
        ) : null}
      </div>

      <QueryState query={analytics}>
        {(data) =>
          !data.enoughData ? (
            <EmptyState
              icon={BarChart3}
              title="Not enough data yet."
              description="Metrics appear once employees in the selected companies have registered. Try a different company or plan."
              action={
                companyId !== "all" || planId !== "all" ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCompanyId("all")
                      setPlanId("all")
                    }}
                  >
                    Show all companies
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className={analytics.isFetching ? "flex flex-col gap-6 opacity-70 transition-opacity" : "flex flex-col gap-6 transition-opacity"}>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <StatCard label="Companies onboarded" value={formatNumber(data.acquisition.companiesOnboarded.value)} icon={Building2} tone="sky" hint={`${formatNumber(data.scope.companies)} in scope`} />
                <StatCard label="Employees invited" value={formatCompact(data.acquisition.employeesInvited.value)} icon={UserPlus} tone="slate" delta={delta(data.acquisition.employeesInvited)} />
                <StatCard label="Active employees" value={formatCompact(data.acquisition.activeUsers.value)} icon={UserCheck} tone="emerald" delta={delta(data.acquisition.activeUsers)} hint="activity or sign-in in period" />
                <StatCard label="Monthly Active Wellness Participants" value={formatCompact(data.wellness.mawp.value)} icon={HeartPulse} tone="rose" delta={delta(data.wellness.mawp)} deltaLabel="vs last month" />
                <StatCard
                  label="Wellness Engagement Rate"
                  value={formatPercent(data.wellness.engagementRate.value)}
                  icon={Percent}
                  tone="violet"
                  hint={`of ${formatCompact(data.wellness.eligible)} eligible`}
                />
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Definitions:</span> an <em>active employee</em> logged a wellness activity or signed in during the selected period. <em>Participation</em> and the Wellness Engagement Rate = active ÷ eligible (invited, not deactivated) employees × 100. A Monthly Active Wellness Participant did at least one wellness activity in the last 30 days.
              </p>

              <Tabs value={tab} onValueChange={setTab} className="gap-4">
                <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                  <TabsList>
                    <TabsTrigger value="acquisition" className="px-3">Acquisition</TabsTrigger>
                    <TabsTrigger value="activation" className="px-3">Activation <P2 /></TabsTrigger>
                    <TabsTrigger value="engagement" className="px-3">Engagement <P2 /></TabsTrigger>
                    <TabsTrigger value="retention" className="px-3">Retention <P2 /></TabsTrigger>
                    <TabsTrigger value="wellness" className="px-3">Wellness KPIs <P2 /></TabsTrigger>
                    {showRevenue && data.revenue ? <TabsTrigger value="revenue" className="px-3">Revenue <P2 /></TabsTrigger> : null}
                  </TabsList>
                </div>
                <TabsContent value="acquisition">
                  <Acquisition data={data} />
                </TabsContent>
                <TabsContent value="activation">
                  <SectionCard title="Activation funnel" description="Registration, profile completion, first activity and first challenge — current state of all accounts in scope." actions={<PhaseBadge phase={2} />}>
                    <ActivationFunnel steps={data.funnel} />
                  </SectionCard>
                </TabsContent>
                <TabsContent value="engagement">
                  <Engagement data={data} period={period} />
                </TabsContent>
                <TabsContent value="retention">
                  <SectionCard title="Retention cohorts" description="Share of employees who registered in each month and were still active 7, 30 and 90 days later." actions={<PhaseBadge phase={2} />}>
                    <CohortTable rows={data.retention} />
                  </SectionCard>
                </TabsContent>
                <TabsContent value="wellness">
                  <Wellness data={data} />
                </TabsContent>
                {showRevenue && data.revenue ? (
                  <TabsContent value="revenue">
                    <Revenue revenue={data.revenue} />
                  </TabsContent>
                ) : null}
              </Tabs>
            </div>
          )
        }
      </QueryState>
    </PageContainer>
  )
}

function Acquisition({ data }: { data: AnalyticsData }) {
  const a = data.acquisition
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title="Companies onboarded per month" description="New customer companies created, last 12 months.">
        <BarsChart data={a.monthly} categoryKey="month" series={[{ key: "companies", label: "Companies" }]} height={240} />
      </SectionCard>
      <SectionCard
        title="Employees invited and registered"
        description="Per month, last 12 months."
        actions={
          <span className="text-xs text-muted-foreground">
            {formatCompact(a.employeesRegistered.value)} registered in period
          </span>
        }
      >
        <BarsChart
          data={a.monthly}
          categoryKey="month"
          series={[
            { key: "invited", label: "Invited" },
            { key: "registered", label: "Registered" },
          ]}
          valueFormatter={(v) => formatCompact(v)}
          height={240}
        />
      </SectionCard>
    </div>
  )
}

function Engagement({ data, period }: { data: AnalyticsData; period: Period }) {
  const e = data.engagement
  const fmtX = (v: string) => (period === "12m" ? formatDate(v, "MMM") : formatShortDate(v))
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Avg daily active users (DAU)" value={formatCompact(e.avgDau)} icon={Activity} tone="emerald" />
        <StatCard label="Avg weekly active users (WAU)" value={formatCompact(e.avgWau)} icon={Users} tone="sky" />
        <StatCard label="Monthly active users (MAU)" value={formatCompact(e.mau)} icon={UserCheck} tone="violet" />
        <StatCard label="Stickiness (DAU ÷ MAU)" value={formatPercent(e.stickiness)} icon={Repeat} tone="amber" delta={e.stickiness - e.stickinessPrevious} deltaLabel="pts vs previous" />
        <StatCard label="Activities per active user" value={formatNumber(e.activitiesPerUser.value, 1)} icon={Activity} tone="sky" delta={delta(e.activitiesPerUser)} hint="in period" />
        <StatCard label="Challenge participation" value={formatPercent(e.challengeParticipation.value)} icon={Trophy} tone="amber" delta={delta(e.challengeParticipation)} hint="active ÷ eligible × 100" />
      </div>
      <SectionCard title="Daily, weekly and monthly active users" description={period === "12m" ? "Weekly points, last 12 months." : "Daily, for the selected period."} actions={<PhaseBadge phase={2} />}>
        <TrendChart
          data={e.series}
          variant="line"
          series={[
            { key: "mau", label: "MAU" },
            { key: "wau", label: "WAU" },
            { key: "dau", label: "DAU" },
          ]}
          xFormatter={fmtX}
          tooltipLabelFormatter={(v) => formatDate(v)}
          valueFormatter={(v) => formatCompact(v)}
          height={280}
        />
      </SectionCard>
    </div>
  )
}

function Wellness({ data }: { data: AnalyticsData }) {
  const w = data.wellness
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="font-heading text-base font-semibold">Wellness KPIs</h2>
        <PhaseBadge phase={2} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Average daily steps" value={formatNumber(w.avgDailySteps.value)} icon={Footprints} tone="emerald" delta={delta(w.avgDailySteps)} hint="per active employee" />
        <StatCard label="Workouts per active employee" value={formatNumber(w.workoutsPerUser.value, 1)} icon={Dumbbell} tone="sky" delta={delta(w.workoutsPerUser)} hint="in period" />
        <StatCard label="Habit completion" value={formatPercent(w.habitCompletion.value)} icon={ListChecks} tone="violet" delta={delta(w.habitCompletion)} hint="of planned habit check-ins" />
        <StatCard label="Challenge completion" value={formatPercent(w.challengeCompletion.value)} icon={Trophy} tone="amber" delta={delta(w.challengeCompletion)} hint="of participants finished" />
        <StatCard label="Hydration goals hit" value={formatCompact(w.hydrationGoalsHit.value)} icon={Droplets} tone="sky" delta={delta(w.hydrationGoalsHit)} hint="employee-days" />
        <StatCard label="Average wellness score" value={formatNumber(w.avgWellnessScore.value, 1)} icon={Gauge} tone="emerald" delta={delta(w.avgWellnessScore)} />
      </div>
      <SectionCard title="Feature participation" description="Share of active employees who used each wellness feature in the period." actions={<PhaseBadge phase={2} />}>
        <BarsChart data={w.modules} categoryKey="module" layout="horizontal" series={[{ key: "share", label: "Active employees" }]} valueFormatter={(v) => formatPercent(v)} height={260} />
      </SectionCard>
    </div>
  )
}

function Revenue({ revenue: r }: { revenue: NonNullable<AnalyticsData["revenue"]> }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="font-heading text-base font-semibold">Revenue KPIs</h2>
        <PhaseBadge phase={2} />
        <span className="text-xs text-muted-foreground">Visible to Super Admins only</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="MRR" value={formatCurrency(r.mrr, "INR", true)} icon={IndianRupee} tone="emerald" hint={`${formatNumber(r.payingCompanies)} paying companies`} />
        <StatCard label="ARR" value={formatCurrency(r.arr, "INR", true)} icon={IndianRupee} tone="sky" />
        <StatCard label="ARPU" value={formatCurrency(r.arpu, "INR", r.arpu >= 100000)} icon={Building2} tone="violet" hint="per company / month" />
        <StatCard label="Revenue per employee" value={formatCurrency(r.revenuePerEmployee)} icon={Users} tone="slate" hint="per active employee / month" />
        <StatCard label="Expansion revenue" value={formatCurrency(r.expansionMrr, "INR", true)} icon={TrendingUp} tone="emerald" hint="new MRR from upgrades & seats" />
        <StatCard label="Churn" value={formatPercent(r.churn, 1)} icon={TrendingDown} tone="rose" hint="MRR lost per month" />
      </div>
      <SectionCard title="Monthly recurring revenue" description="Last 12 months.">
        <TrendChart data={r.mrrTrend} xKey="month" series={[{ key: "mrr", label: "MRR" }]} valueFormatter={(v) => formatCurrency(v, "INR", true)} height={260} />
      </SectionCard>
    </div>
  )
}

/** Compact Phase 2 marker for tab labels. */
function P2() {
  return <PhaseBadge phase={2} className="ml-0.5 h-4 px-1 text-[9px]" />
}
