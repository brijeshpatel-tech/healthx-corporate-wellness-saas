"use client"

import { AlertTriangle, ArrowRight, Coins, Gift, HeartPulse, Megaphone, Percent, Plus, Trophy, UserCheck, UserPlus, Users } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { GettingStartedCard } from "@/components/business/people/getting-started-card"
import { BarsChart, DonutChart, TrendChart } from "@/components/common/charts"
import { InlineBar, PrivacyNote, SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { EmptyState, QueryState } from "@/components/common/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Period } from "@/lib/api/business/common"
import { dashboardApi, type DashboardData, type DashboardKpi } from "@/lib/api/business/dashboard"
import { organizationApi } from "@/lib/api/business/organization"
import { useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { useSession } from "@/lib/auth/session"
import { formatCompact, formatNumber, formatPercent, formatShortDate, daysBetween } from "@/lib/format"

const delta = (k: DashboardKpi) => (k.previous ? (k.value - k.previous) / k.previous : 0)

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}

export default function BusinessDashboardPage() {
  const session = useSession("business")
  const can = useCan()
  const isTeamManager = session?.role === "team_manager"
  const [period, setPeriod] = useState<Period>("30d")
  const [departmentId, setDepartmentId] = useState<string>("all")
  const [teamId, setTeamId] = useState<string>("all")
  const [trendMetric, setTrendMetric] = useState<"activeEmployees" | "avgSteps">("activeEmployees")

  const lookups = useApiQuery(["business", "lookups"], () => organizationApi.lookups(), { enabled: !isTeamManager })
  const query = { period, departmentId: departmentId === "all" ? undefined : departmentId, teamId: teamId === "all" ? undefined : teamId }
  const dashboard = useApiQuery(["business", "dashboard", query], () => dashboardApi.get(query), { placeholderData: (prev) => prev })
  const teams = (lookups.data?.teams ?? []).filter((t) => departmentId === "all" || t.departmentId === departmentId)

  return (
    <PageContainer>
      <PageHeader
        title={`${greeting()}, ${session?.user.name.split(" ")[0] ?? ""} 👋`}
        description={isTeamManager ? "How your team is doing — combined figures only." : `Wellness participation across ${session?.companyName ?? "your company"}.`}
        actions={
          <>
            {can("employees.manage") ? (
              <Button asChild variant="outline">
                <Link href="/business-portal/employees?invite=1">
                  <UserPlus data-icon="inline-start" /> Invite employees
                </Link>
              </Button>
            ) : null}
            {can("announcements.manage") ? (
              <Button asChild variant="outline">
                <Link href="/business-portal/announcements/new">
                  <Megaphone data-icon="inline-start" /> Send announcement
                </Link>
              </Button>
            ) : null}
            {can("challenges.manage") ? (
              <Button asChild>
                <Link href="/business-portal/challenges/new">
                  <Plus data-icon="inline-start" /> Create challenge
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      {can("employees.manage") ? <GettingStartedCard /> : null}

      {/* Filters scope everything below */}
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" variant="outline" value={period} onValueChange={(v) => v && setPeriod(v as Period)}>
          <ToggleGroupItem value="7d" className="px-3">
            7 days
          </ToggleGroupItem>
          <ToggleGroupItem value="30d" className="px-3">
            30 days
          </ToggleGroupItem>
          <ToggleGroupItem value="90d" className="px-3">
            90 days
          </ToggleGroupItem>
        </ToggleGroup>
        {!isTeamManager ? (
          <>
            <Select
              value={departmentId}
              onValueChange={(v) => {
                setDepartmentId(v)
                setTeamId("all")
              }}
            >
              <SelectTrigger className="h-8 w-48">
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {lookups.data?.departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger className="h-8 w-44">
                <SelectValue placeholder="All teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teams</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : null}
        {dashboard.data ? (
          <Badge variant="secondary" className="ml-auto">
            {dashboard.data.scopeLabel}
          </Badge>
        ) : null}
      </div>

      <QueryState query={dashboard}>
        {(data) =>
          data.kpis.totalEmployees.value === 0 ? (
            <EmptyState
              icon={Users}
              title="Invite your employees to get started"
              description="Once employees join HealthX, participation and engagement will show up here."
              action={
                can("employees.manage") ? (
                  <Button asChild>
                    <Link href="/business-portal/employees?invite=1">Invite employees</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className={dashboard.isFetching ? "opacity-70 transition-opacity" : "transition-opacity"}>
              <DashboardBody data={data} period={period} trendMetric={trendMetric} setTrendMetric={setTrendMetric} />
            </div>
          )
        }
      </QueryState>
    </PageContainer>
  )
}

function DashboardBody({
  data,
  period,
  trendMetric,
  setTrendMetric,
}: {
  data: DashboardData
  period: Period
  trendMetric: "activeEmployees" | "avgSteps"
  setTrendMetric: (m: "activeEmployees" | "avgSteps") => void
}) {
  const can = useCan()
  const k = data.kpis
  const periodLabel = period === "7d" ? "vs previous 7 days" : period === "30d" ? "vs previous 30 days" : "vs previous 90 days"

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total employees" value={formatNumber(k.totalEmployees.value)} icon={Users} tone="slate" hint={`${formatNumber(data.onboarding.invited)} invited, not joined`} href={can("employees.view") ? "/business-portal/employees" : undefined} />
        <StatCard label="Active employees" value={formatNumber(k.activeEmployees.value)} icon={UserCheck} tone="emerald" delta={delta(k.activeEmployees)} deltaLabel={periodLabel} />
        <StatCard label="Participation" value={formatPercent(k.participationRate.value)} icon={Percent} tone="sky" delta={k.participationRate.value - k.participationRate.previous} deltaLabel="points vs previous" />
        <StatCard label="Active challenges" value={formatNumber(k.activeChallenges.value)} icon={Trophy} tone="violet" href="/business-portal/challenges" hint="running now" />
        <StatCard label="Points awarded" value={formatCompact(k.pointsAwarded.value)} icon={Coins} tone="amber" delta={delta(k.pointsAwarded)} deltaLabel={periodLabel} />
        <StatCard label="Rewards redeemed" value={formatNumber(k.rewardsRedeemed.value)} icon={Gift} tone="rose" delta={delta(k.rewardsRedeemed)} deltaLabel={periodLabel} href={can("orders.view") ? "/business-portal/orders" : undefined} />
        <StatCard label="Monthly active wellness participants" value={formatNumber(k.monthlyActiveWellnessParticipants.value)} icon={HeartPulse} tone="emerald" delta={delta(k.monthlyActiveWellnessParticipants)} deltaLabel="vs last month" />
        <StatCard label="Wellness engagement rate" value={formatPercent(k.wellnessEngagementRate.value)} icon={Percent} tone="sky" hint="active wellness employees ÷ eligible" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title={trendMetric === "activeEmployees" ? "Daily active employees" : "Average steps per active employee"}
          description="Employees who logged at least one wellness activity that day."
          actions={
            <Tabs value={trendMetric} onValueChange={(v) => setTrendMetric(v as typeof trendMetric)}>
              <TabsList>
                <TabsTrigger value="activeEmployees">Active</TabsTrigger>
                <TabsTrigger value="avgSteps">Steps</TabsTrigger>
              </TabsList>
            </Tabs>
          }
        >
          <TrendChart
            data={data.activityTrend}
            series={[{ key: trendMetric, label: trendMetric === "activeEmployees" ? "Active employees" : "Avg steps" }]}
            xFormatter={(d) => formatShortDate(d)}
            height={260}
          />
        </SectionCard>

        <SectionCard title="Adoption" description="Where employees are in their journey.">
          <DonutChart
            data={[
              { name: "Active", value: data.onboarding.active, color: "var(--chart-3)" },
              { name: "Registered", value: data.onboarding.registered, color: "var(--chart-1)" },
              { name: "Invited", value: data.onboarding.invited, color: "var(--chart-4)" },
              { name: "Inactive", value: data.onboarding.inactive, color: "var(--chart-8)" },
            ]}
            centerValue={formatPercent(data.kpis.participationRate.value)}
            centerLabel="participating"
            height={170}
            className="sm:flex-col"
          />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Participation by department"
          description={`Participation = active ÷ eligible employees × 100. Groups under ${data.minGroupSize} people are hidden.`}
          actions={
            can("analytics.view") ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/business-portal/analytics?tab=departments">
                  Details <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            ) : undefined
          }
        >
          {data.departments.length > 2 ? (
            <BarsChart
              data={data.departments.filter((d) => d.participation !== null).map((d) => ({ name: d.name, participation: Math.round((d.participation ?? 0) * 100) }))}
              categoryKey="name"
              series={[{ key: "participation", label: "Participation" }]}
              layout="horizontal"
              valueFormatter={(v) => `${v}%`}
              height={Math.max(180, data.departments.length * 40)}
            />
          ) : (
            <ul className="space-y-4">
              {data.departments.map((d) => (
                <li key={d.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{d.name}</span>
                    <span className="text-muted-foreground tabular-nums">{d.participation === null ? `Hidden (< ${data.minGroupSize} people)` : formatPercent(d.participation)}</span>
                  </div>
                  <InlineBar value={d.participation ?? 0} max={1} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Active challenges"
          description="Participation and average progress."
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link href="/business-portal/challenges">
                All challenges <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          }
        >
          {data.activeChallenges.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No challenges running"
              description="Challenges are the fastest way to boost participation."
              action={
                can("challenges.manage") ? (
                  <Button asChild size="sm">
                    <Link href="/business-portal/challenges/new">Create challenge</Link>
                  </Button>
                ) : undefined
              }
              className="py-8"
            />
          ) : (
            <ul className="divide-y">
              {data.activeChallenges.map((c) => {
                const daysLeft = Math.max(0, daysBetween(new Date().toISOString().slice(0, 10), c.endDate))
                return (
                  <li key={c.id}>
                    <Link href={`/business-portal/challenges/${c.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/50">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-lg" style={{ backgroundColor: `${c.coverColor}22` }}>
                        {c.coverEmoji}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold">{c.name}</p>
                          <span className="shrink-0 text-xs text-muted-foreground">{daysLeft} days left</span>
                        </div>
                        <Progress value={c.avgProgress * 100} className="h-1.5" />
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(c.participants)} joined · {formatPercent(c.eligible ? c.participants / c.eligible : 0)} of eligible · avg {formatPercent(c.avgProgress)} complete
                        </p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      {data.lowParticipation.length > 0 && !can("team.view") ? (
        <SectionCard
          className="border-amber-500/30 bg-amber-500/[0.04]"
          title={
            <span className="inline-flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" /> Teams that need a nudge
            </span>
          }
          description="Teams where fewer than 60% of members were active in this period."
          actions={
            can("announcements.manage") ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/business-portal/announcements/new">
                  <Megaphone data-icon="inline-start" /> Send encouragement
                </Link>
              </Button>
            ) : undefined
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.lowParticipation.map((t) => (
              <div key={t.id} className="space-y-2 rounded-xl border bg-card p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t.name}</span>
                  <span className="text-sm font-semibold text-amber-700 tabular-nums dark:text-amber-400">{formatPercent(t.participation)}</span>
                </div>
                <InlineBar value={t.participation} max={1} color="var(--chart-4)" />
                <p className="text-xs text-muted-foreground">{t.employees} members</p>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {(data.pendingOrders > 0 && can("orders.manage")) || (data.pendingInvites > 0 && can("employees.manage")) ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.pendingOrders > 0 && can("orders.manage") ? (
            <Link href="/business-portal/orders?status=pending_approval" className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40">
              <span className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-rose-500/12 text-rose-600">
                  <Gift className="size-4.5" />
                </span>
                <span className="text-sm">
                  <span className="font-semibold">{data.pendingOrders} reward orders</span> waiting for approval
                </span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground" />
            </Link>
          ) : null}
          {data.pendingInvites > 0 && can("employees.manage") ? (
            <Link href="/business-portal/employees?status=invited" className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40">
              <span className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/14 text-amber-600">
                  <UserPlus className="size-4.5" />
                </span>
                <span className="text-sm">
                  <span className="font-semibold">{data.pendingInvites} invitations</span> not yet accepted
                </span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground" />
            </Link>
          ) : null}
        </div>
      ) : null}

      <PrivacyNote minGroupSize={data.minGroupSize} />
    </div>
  )
}
