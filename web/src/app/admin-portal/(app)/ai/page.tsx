"use client"

import { Bot, Coins, Download, EyeOff, IndianRupee, Settings2, Sparkles, TriangleAlert, Users } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { FilterSelect, PeriodFilter } from "@/components/admin/filter-select"
import { AiCompanyLimitsDialog, AiGlobalForm } from "@/components/admin/platform/ai-settings-forms"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { BarsChart, TrendChart } from "@/components/common/charts"
import { DataTable, type Column } from "@/components/common/data-table"
import { InlineBar, PrivacyNote, SearchInput, SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { PhaseBadge } from "@/components/common/status-badge"
import { EmptyState, ErrorState, QueryState } from "@/components/common/states"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { aiApi, type AiCompanyRow, type AiUsageQuery } from "@/lib/api/platform/ai"
import type { Period } from "@/lib/api/platform/common"
import { downloadText } from "@/lib/download"
import { formatCompact, formatCurrency, formatDate, formatNumber, formatPercent, formatShortDate } from "@/lib/format"
import { cn } from "@/lib/utils"

const TABS = ["usage", "companies", "defaults"] as const
type Tab = (typeof TABS)[number]

/** SCR-P-033 AI configuration & usage (Phase 2). */
function AiPage() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const tabParam = params.get("tab") as Tab | null
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : "usage"
  const setTab = (t: string) => router.replace(t === "usage" ? pathname : `${pathname}?tab=${t}`, { scroll: false })
  const can = useAdminCan()
  const canEdit = can("ai.manage")
  const settings = useApiQuery(["admin", "ai-settings"], () => aiApi.settings())

  return (
    <PageContainer>
      <PageHeader title="AI configuration & usage" badge={<PhaseBadge phase={2} />} description="Turn AI features on per company, set usage limits and safety rules, and monitor requests, tokens and cost." />
      <PrivacyNote>
        <span className="font-semibold">Platform staff do not see conversation content.</span> Usage is counted per company only — no messages, prompts or individual employee data are shown here.
      </PrivacyNote>

      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList>
            <TabsTrigger value="usage" className="px-3">
              <Sparkles /> Usage
            </TabsTrigger>
            <TabsTrigger value="companies" className="px-3">
              <Bot /> Companies
            </TabsTrigger>
            <TabsTrigger value="defaults" className="px-3">
              <Settings2 /> Defaults &amp; safety
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="usage">
          <UsageTab />
        </TabsContent>
        <TabsContent value="companies">
          <QueryState query={settings} loading={<Skeleton className="h-96 rounded-xl" />}>
            {(data) => (
              <>
                {!data.global.aiCoachEnabled || !data.global.weeklyInsightEnabled ? (
                  <Alert className="mb-4 border-amber-500/40 bg-amber-500/8 text-amber-900 dark:text-amber-200">
                    <TriangleAlert />
                    <AlertDescription className="text-current/80">
                      {!data.global.aiCoachEnabled && !data.global.weeklyInsightEnabled ? "AI Coach and weekly insights are" : !data.global.aiCoachEnabled ? "The AI Coach is" : "Weekly AI insights are"} turned off platform-wide, so company switches have no effect until you turn{" "}
                      {!data.global.aiCoachEnabled && !data.global.weeklyInsightEnabled ? "them" : "it"} back on under Defaults &amp; safety.
                    </AlertDescription>
                  </Alert>
                ) : null}
                <CompaniesTable rows={data.companies} canEdit={canEdit} />
              </>
            )}
          </QueryState>
        </TabsContent>
        <TabsContent value="defaults">
          <QueryState query={settings} loading={<Skeleton className="h-96 rounded-xl" />}>
            {(data) => <AiGlobalForm settings={data.global} canEdit={canEdit} />}
          </QueryState>
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}

export default function Page() {
  return (
    <Suspense>
      <AiPage />
    </Suspense>
  )
}

function UsageTab() {
  const [period, setPeriod] = useState<Period>("30d")
  const [companyId, setCompanyId] = useState("all")
  const settings = useApiQuery(["admin", "ai-settings"], () => aiApi.settings())
  const query: AiUsageQuery = { period, companyId: companyId === "all" ? undefined : companyId }
  const usage = useApiQuery(["admin", "ai-usage", query], () => aiApi.usage(query), { placeholderData: (prev) => prev })
  const exportCsv = useApiMutation(aiApi.exportUsage, { success: "Export ready", onSuccess: (r) => downloadText(r.fileName, r.csv) })
  const fmtX = (v: string) => (period === "12m" ? formatDate(v, "MMM") : formatShortDate(v))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <PeriodFilter value={period} onChange={setPeriod} />
        <FilterSelect value={companyId} onChange={setCompanyId} allLabel="All companies" className="sm:w-52" options={(settings.data?.companies ?? []).map((c) => ({ value: c.companyId, label: c.name }))} />
        <Button variant="outline" className="sm:ml-auto" onClick={() => exportCsv.mutate(query)} disabled={exportCsv.isPending || !usage.data?.byCompany.length}>
          {exportCsv.isPending ? <Spinner /> : <Download data-icon="inline-start" />}
          Export usage
        </Button>
      </div>
      {usage.error ? (
        <ErrorState error={usage.error} onRetry={() => usage.refetch()} />
      ) : usage.isLoading || !usage.data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : usage.data.totals.requests === 0 ? (
        <EmptyState icon={Sparkles} title="No AI usage yet." description="Usage appears once a company with AI features turned on starts using the coach or receives weekly insights." />
      ) : (
        <div className={cn("flex flex-col gap-6 transition-opacity", usage.isFetching && "opacity-70")}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="AI requests"
              value={formatCompact(usage.data.totals.requests)}
              icon={Sparkles}
              tone="violet"
              delta={usage.data.previous.requests ? (usage.data.totals.requests - usage.data.previous.requests) / usage.data.previous.requests : undefined}
            />
            <StatCard label="Tokens" value={formatCompact(usage.data.totals.tokens)} icon={Coins} tone="sky" hint="input + output" />
            <StatCard label="Cost" value={formatCurrency(usage.data.totals.cost, "INR", usage.data.totals.cost >= 100000)} icon={IndianRupee} tone="amber" hint={`was ${formatCurrency(usage.data.previous.cost, "INR", usage.data.previous.cost >= 100000)}`} />
            <StatCard label="Employees using the coach" value={formatNumber(usage.data.totals.activeUsers)} icon={Users} tone="emerald" hint={`${formatCompact(usage.data.totals.insightsSent)} weekly insights sent`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-5">
            <SectionCard title="Requests" description={period === "12m" ? "Per week" : "Per day"} className="lg:col-span-3">
              <TrendChart data={usage.data.trend} series={[{ key: "requests", label: "Requests" }]} xFormatter={fmtX} tooltipLabelFormatter={(v) => formatDate(v)} valueFormatter={(v) => formatCompact(v)} height={260} />
            </SectionCard>
            <SectionCard title="Cost by company" description="Top companies in the period." className="lg:col-span-2">
              <BarsChart data={usage.data.byCompany.slice(0, 6)} categoryKey="name" layout="horizontal" series={[{ key: "cost", label: "Cost" }]} valueFormatter={(v) => formatCurrency(v, "INR", true)} categoryFormatter={(v) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)} height={260} />
            </SectionCard>
          </div>
          <DataTable
            columns={[
              { key: "name", header: "Company", cell: (r) => <span className="text-sm font-medium">{r.name}</span>, sortValue: (r) => r.name },
              { key: "req", header: "Requests", align: "right", cell: (r) => <span className="tabular-nums">{formatNumber(r.requests)}</span>, sortValue: (r) => r.requests },
              { key: "tok", header: "Tokens", align: "right", cell: (r) => <span className="tabular-nums">{formatCompact(r.tokens)}</span>, sortValue: (r) => r.tokens, hideOnMobile: true },
              { key: "cost", header: "Cost", align: "right", cell: (r) => <span className="tabular-nums">{formatCurrency(r.cost)}</span>, sortValue: (r) => r.cost },
              {
                key: "budget",
                header: "Budget used (this month)",
                cell: (r) => (
                  <div className="flex min-w-36 items-center gap-2">
                    <InlineBar value={Math.min(1, r.budgetUsed)} max={1} color={r.budgetUsed >= 0.9 ? "var(--destructive)" : undefined} className="flex-1" />
                    <span className="w-10 text-right text-xs tabular-nums">{formatPercent(r.budgetUsed)}</span>
                  </div>
                ),
                sortValue: (r) => r.budgetUsed,
                hideOnMobile: true,
              },
            ]}
            rows={usage.data.byCompany}
            getRowId={(r) => r.companyId}
            clientPageSize={10}
            emptyTitle="No AI usage yet."
          />
        </div>
      )}
    </div>
  )
}

function CompaniesTable({ rows, canEdit }: { rows: AiCompanyRow[]; canEdit: boolean }) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [editing, setEditing] = useState<AiCompanyRow | null>(null)
  const update = useApiMutation(aiApi.updateCompany, { success: "AI settings saved." })
  const pendingId = update.isPending ? update.variables?.companyId : undefined

  const visible = rows.filter(
    (r) =>
      r.name.toLowerCase().includes(search.trim().toLowerCase()) &&
      (filter === "all" || (filter === "coach_on" && r.aiCoachEnabled) || (filter === "in_plan" && r.inPlan) || (filter === "over_80" && r.budgetUsed >= 0.8)),
  )

  const columns: Column<AiCompanyRow>[] = [
    {
      key: "name",
      header: "Company",
      cell: (r) => (
        <div className="min-w-0 max-w-56">
          <div className="truncate text-sm font-medium">{r.name}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {r.planName}
            {r.inPlan ? null : <Badge variant="outline" className="h-4 px-1 text-[10px]">No AI module</Badge>}
          </div>
        </div>
      ),
      sortValue: (r) => r.name,
    },
    {
      key: "coach",
      header: "AI coach",
      align: "center",
      cell: (r) => {
        const sw = (
          <Switch
            checked={r.aiCoachEnabled}
            disabled={!canEdit || pendingId === r.companyId || (!r.inPlan && !r.aiCoachEnabled)}
            onCheckedChange={(v) => update.mutate({ companyId: r.companyId, aiCoachEnabled: v })}
            aria-label={`AI coach for ${r.name}`}
          />
        )
        return !r.inPlan && !r.aiCoachEnabled ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex" tabIndex={0}>
                {sw}
              </span>
            </TooltipTrigger>
            <TooltipContent>The {r.planName} plan doesn&apos;t include the AI Wellness Coach.</TooltipContent>
          </Tooltip>
        ) : (
          sw
        )
      },
    },
    {
      key: "insight",
      header: "Weekly insight",
      align: "center",
      cell: (r) => (
        <Switch
          checked={r.aiInsightsEnabled}
          disabled={!canEdit || pendingId === r.companyId}
          onCheckedChange={(v) => update.mutate({ companyId: r.companyId, aiInsightsEnabled: v })}
          aria-label={`Weekly AI insight for ${r.name}`}
        />
      ),
    },
    {
      key: "limit",
      header: "Limit / employee",
      align: "right",
      cell: (r) => (
        <span className="text-sm tabular-nums">
          {formatNumber(r.monthlyLimitPerEmployee)}
          {r.usesDefaults ? <span className="block text-xs text-muted-foreground">default</span> : null}
        </span>
      ),
      sortValue: (r) => r.monthlyLimitPerEmployee,
      hideOnMobile: true,
    },
    { key: "budget", header: "Monthly budget", align: "right", cell: (r) => <span className="text-sm tabular-nums">{formatCurrency(r.monthlyBudget)}</span>, sortValue: (r) => r.monthlyBudget, hideOnMobile: true },
    {
      key: "used",
      header: "Spent this month",
      cell: (r) => (
        <div className="min-w-32">
          <div className="flex justify-between gap-2 text-xs">
            <span className="tabular-nums">{formatCurrency(r.costThisMonth)}</span>
            <span className="text-muted-foreground tabular-nums">{formatPercent(r.budgetUsed)}</span>
          </div>
          <InlineBar value={Math.min(1, r.budgetUsed)} max={1} color={r.budgetUsed >= 0.9 ? "var(--destructive)" : undefined} className="mt-1" />
        </div>
      ),
      sortValue: (r) => r.budgetUsed,
      hideOnMobile: true,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (r) =>
        canEdit ? (
          <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>
            Limits
          </Button>
        ) : null,
    },
  ]

  return (
    <>
      <DataTable
        key={`${search}|${filter}`}
        columns={columns}
        rows={visible}
        getRowId={(r) => r.companyId}
        clientPageSize={12}
        emptyTitle="No companies match these filters"
        emptyDescription="Try a different search or filter."
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Search companies…" />
            <FilterSelect
              value={filter}
              onChange={setFilter}
              allLabel="All companies"
              className="sm:w-48"
              options={[
                { value: "coach_on", label: "AI coach on" },
                { value: "in_plan", label: "Plan includes AI" },
                { value: "over_80", label: "Budget ≥ 80% used" },
              ]}
            />
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <EyeOff className="size-3.5" /> Conversations are never visible to HealthX staff
            </span>
          </>
        }
      />
      <AiCompanyLimitsDialog company={editing} onOpenChange={(o) => !o && setEditing(null)} />
    </>
  )
}
