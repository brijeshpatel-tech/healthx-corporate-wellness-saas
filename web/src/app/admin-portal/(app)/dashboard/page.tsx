"use client"

import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Building2,
  ChartLine,
  CircleCheck,
  Coins,
  FlaskConical,
  Gift,
  HeartPulse,
  IndianRupee,
  Info,
  Package,
  Percent,
  Plus,
  Rocket,
  ShieldOff,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { FilterSelect, PeriodFilter } from "@/components/admin/filter-select"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { BarsChart, DonutChart, TrendChart } from "@/components/common/charts"
import { InlineBar, PrivacyNote, SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge } from "@/components/common/status-badge"
import { StatCard } from "@/components/common/stat-card"
import { EmptyState, QueryState } from "@/components/common/states"
import { UserAvatar } from "@/components/common/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ADMIN_NAV, canAccessPath } from "@/config/nav"
import type { Period } from "@/lib/api/platform/common"
import { PERIOD_LABEL } from "@/lib/api/platform/common"
import { companiesApi } from "@/lib/api/platform/companies"
import { platformDashboardApi, type AttentionItem, type Kpi, type PlatformDashboard } from "@/lib/api/platform/dashboard"
import { useApiQuery } from "@/lib/api/hooks"
import { useSession } from "@/lib/auth/session"
import { formatCompact, formatCurrency, formatNumber, formatPercent, formatRelative, formatShortDate } from "@/lib/format"
import { cn } from "@/lib/utils"

const delta = (k: Kpi) => (k.previous ? (k.value - k.previous) / k.previous : 0)

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}

export default function AdminDashboardPage() {
  const session = useSession("admin")
  const can = useAdminCan()
  const [period, setPeriod] = useState<Period>("30d")
  const [planId, setPlanId] = useState("all")

  const lookups = useApiQuery(["admin", "companies", "lookups"], () => companiesApi.lookups())
  const query = { period, planId: planId === "all" ? undefined : planId }
  const dashboard = useApiQuery(["admin", "dashboard", query], () => platformDashboardApi.get(query), { placeholderData: (prev) => prev })

  return (
    <PageContainer>
      <PageHeader
        title={`${greeting()}, ${session?.user.name.split(" ")[0] ?? ""} 👋`}
        description="Companies, people and engagement across every HealthX customer — aggregated, never individual health data."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/admin-portal/analytics">
                <ChartLine data-icon="inline-start" /> Analytics
              </Link>
            </Button>
            {can("companies.manage") ? (
              <Button asChild>
                <Link href="/admin-portal/companies/new">
                  <Plus data-icon="inline-start" /> Create company
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <PeriodFilter value={period} onChange={setPeriod} />
        <FilterSelect
          value={planId}
          onChange={setPlanId}
          allLabel="All plans"
          options={(lookups.data?.plans ?? []).map((p) => ({ value: p.id, label: p.name }))}
          className="sm:w-36"
        />
        {dashboard.data ? (
          <Badge variant="secondary" className="sm:ml-auto">
            {PERIOD_LABEL[period]} · {formatNumber(dashboard.data.companies.total)} companies
          </Badge>
        ) : null}
      </div>

      <QueryState query={dashboard}>
        {(data) =>
          data.companies.total === 0 ? (
            <EmptyState
              icon={Building2}
              title="No companies yet"
              description={planId !== "all" ? "No companies are on this plan." : "Create the first company to start onboarding employees."}
              action={
                can("companies.manage") && planId === "all" ? (
                  <Button asChild>
                    <Link href="/admin-portal/companies/new">
                      <Plus data-icon="inline-start" /> Create company
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setPlanId("all")}>
                    Show all plans
                  </Button>
                )
              }
            />
          ) : (
            <div className={cn("flex flex-col gap-6 transition-opacity", dashboard.isFetching && "opacity-70")}>
              <DashboardBody data={data} period={period} />
            </div>
          )
        }
      </QueryState>
    </PageContainer>
  )
}

function DashboardBody({ data, period }: { data: PlatformDashboard; period: Period }) {
  const role = useSession("admin")?.role
  const link = (href: string) => (canAccessPath(ADMIN_NAV, href, role) ? href : undefined)
  const k = data.kpis
  const vs = period === "12m" ? "vs previous year" : `vs previous ${data.periodDays} days`

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard className="h-full" label="Active companies" value={formatNumber(data.companies.active)} icon={Building2} tone="emerald" hint={`${data.companies.newInPeriod} new in this period`} href={link("/admin-portal/companies?status=active")} />
        <StatCard className="h-full" label="Onboarding" value={formatNumber(data.companies.onboarding)} icon={Rocket} tone="sky" hint="setting up their workspace" href={link("/admin-portal/companies?status=onboarding")} />
        <StatCard className="h-full" label="On trial" value={formatNumber(data.companies.trial)} icon={FlaskConical} tone="violet" hint="free trial running" href={link("/admin-portal/companies?status=trial")} />
        <StatCard className="h-full" label="Suspended" value={formatNumber(data.companies.suspended)} icon={ShieldOff} tone="rose" hint="sign-in blocked, data kept" href={link("/admin-portal/companies?status=suspended")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard className="h-full" label="Employees invited" value={formatCompact(k.employeesInvited.value)} icon={UserPlus} tone="slate" delta={delta(k.employeesInvited)} deltaLabel={vs} href={link("/admin-portal/users")} />
        <StatCard className="h-full" label="Registered" value={formatCompact(k.employeesRegistered.value)} icon={UserCheck} tone="sky" hint={`${formatPercent(k.employeesRegistered.value / Math.max(1, k.employeesInvited.value))} of invited`} href={link("/admin-portal/users")} />
        <StatCard className="h-full" label="Monthly active users" value={formatCompact(k.monthlyActiveUsers.value)} icon={Users} tone="emerald" delta={delta(k.monthlyActiveUsers)} deltaLabel={vs} href={link("/admin-portal/analytics")} />
        <StatCard className="h-full" label="Monthly active wellness participants" value={formatCompact(k.monthlyActiveWellnessParticipants.value)} icon={HeartPulse} tone="rose" delta={delta(k.monthlyActiveWellnessParticipants)} deltaLabel={vs} href={link("/admin-portal/analytics")} />
        <StatCard className="h-full" label="Wellness engagement rate" value={formatPercent(k.wellnessEngagementRate.value)} icon={Percent} tone="violet" delta={k.wellnessEngagementRate.value - k.wellnessEngagementRate.previous} deltaLabel="pts" hint="participants ÷ eligible" />
        <StatCard className="h-full" label="Active challenges" value={formatNumber(k.activeChallenges.value)} icon={Trophy} tone="amber" hint="running across companies" href={link("/admin-portal/challenge-templates")} />
        <StatCard className="h-full" label="Points awarded" value={formatCompact(k.pointsAwarded.value)} icon={Coins} tone="amber" delta={delta(k.pointsAwarded)} deltaLabel={vs} href={link("/admin-portal/points-rules")} />
        <StatCard className="h-full" label="Rewards redeemed" value={formatNumber(k.rewardsRedeemed.value)} icon={Gift} tone="rose" delta={delta(k.rewardsRedeemed)} deltaLabel={vs} href={link("/admin-portal/orders")} />
        <StatCard className="h-full" label="Pending reward orders" value={formatNumber(k.pendingOrders.value)} icon={Package} tone="sky" hint="awaiting approval or fulfilment" href={link("/admin-portal/orders")} />
        {k.mrr ? (
          <StatCard className="h-full" label="Monthly recurring revenue" value={formatCurrency(k.mrr.value, "INR", true)} icon={IndianRupee} tone="emerald" delta={delta(k.mrr)} deltaLabel="vs last month" hint={<PhaseBadge phase={2} />} href={link("/admin-portal/revenue")} />
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Active users" description={period === "12m" ? "Weekly average of daily active users and wellness participants." : "Daily active users and employees who logged a wellness activity."}>
          <TrendChart
            data={data.activeUsersTrend}
            series={[
              { key: "active", label: "Active users" },
              { key: "participants", label: "Wellness participants" },
            ]}
            xFormatter={(d) => formatShortDate(d)}
            valueFormatter={(v) => formatCompact(v)}
            tooltipLabelFormatter={(d) => (period === "12m" ? `Week of ${formatShortDate(d)}` : formatShortDate(d))}
            height={260}
          />
        </SectionCard>

        {data.mrrByPlan ? (
          <SectionCard
            title={
              <span className="inline-flex items-center gap-2">
                MRR by plan <PhaseBadge phase={2} />
              </span>
            }
            description="Active and past-due subscriptions."
            actions={
              link("/admin-portal/revenue") ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin-portal/revenue">
                    Revenue <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
              ) : undefined
            }
          >
            {data.mrrByPlan.some((p) => p.mrr > 0) ? (
              <DonutChart
                data={data.mrrByPlan.map((p) => ({ name: `${p.name} · ${p.companies}`, value: p.mrr }))}
                centerValue={formatCurrency(k.mrr?.value ?? 0, "INR", true)}
                centerLabel="MRR"
                valueFormatter={(v) => formatCurrency(v, "INR", true)}
                height={170}
                className="sm:flex-col"
              />
            ) : (
              <EmptyState icon={IndianRupee} title="No revenue yet" description="MRR appears once companies on paid plans have active employees." className="py-8" />
            )}
          </SectionCard>
        ) : (
          <SectionCard title="Employee funnel" description="From invitation to monthly activity.">
            <Funnel data={data} />
          </SectionCard>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Companies onboarded" description={`${formatNumber(data.onboarded.reduce((a, m) => a + m.companies, 0))} in the last 12 months · ${formatNumber(data.onboarded.at(-1)?.cumulative ?? 0)} total`}>
          <BarsChart
            data={data.onboarded}
            categoryKey="label"
            series={[{ key: "companies", label: "Companies onboarded" }]}
            height={230}
            highlightCategory={data.onboarded.at(-1)?.label}
          />
        </SectionCard>

        <SectionCard
          title={
            <span className="inline-flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" /> Needs attention
            </span>
          }
          description="Suspended, overdue, ending trials and low engagement."
          actions={
            link("/admin-portal/companies") ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin-portal/companies">
                  All <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            ) : undefined
          }
        >
          {data.attention.length === 0 ? (
            <EmptyState icon={CircleCheck} title="All companies look healthy" description="Nothing needs your attention right now." className="py-8" />
          ) : (
            <ul className="-my-1 divide-y">
              {data.attention.map((a) => (
                <AttentionRow key={a.id} item={a} href={link(`/admin-portal/companies/${a.id}`)} />
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Recent activity"
          description="Latest admin actions across the platform."
          actions={
            link("/admin-portal/audit-logs") ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin-portal/audit-logs">
                  Audit log <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            ) : undefined
          }
        >
          {data.recentActivity.length === 0 ? (
            <EmptyState title="No activity yet" className="py-8" />
          ) : (
            <ul className="-my-1 divide-y">
              {data.recentActivity.map((l) => (
                <li key={l.id} className="flex items-start gap-3 py-2.5">
                  <UserAvatar name={l.actorName} color={l.severity === "critical" ? "#e11d48" : l.severity === "warning" ? "#d97706" : "#0ea5e9"} size="xs" className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm">
                      <span className="font-medium">{l.actorName}</span> <span className="text-muted-foreground">{l.action.toLowerCase()}</span>{" "}
                      <span className="font-medium">{l.entityName}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelative(l.createdAt)} · {l.actorRole}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {data.mrrByPlan ? (
        <SectionCard title="Employee funnel" description="From invitation to monthly activity, across the selected companies.">
          <Funnel data={data} horizontal />
        </SectionCard>
      ) : null}

      <PrivacyNote>Platform figures are aggregated across companies. HealthX staff never see an individual employee&apos;s health data.</PrivacyNote>
    </>
  )
}

function Funnel({ data, horizontal }: { data: PlatformDashboard; horizontal?: boolean }) {
  const steps = [
    { label: "Invited", value: data.funnel.invited, color: "var(--chart-1)" },
    { label: "Registered", value: data.funnel.registered, color: "var(--chart-3)" },
    { label: "Active this month", value: data.funnel.active, color: "var(--chart-4)" },
  ]
  return (
    <ul className={cn("gap-4", horizontal ? "grid sm:grid-cols-3" : "space-y-4")}>
      {steps.map((s, i) => (
        <li key={s.label} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">{s.label}</span>
            <span className="tabular-nums">
              <span className="font-semibold">{formatNumber(s.value)}</span>
              {i > 0 ? <span className="ml-1.5 text-xs text-muted-foreground">{formatPercent(s.value / Math.max(1, steps[i - 1]!.value))}</span> : null}
            </span>
          </div>
          <InlineBar value={s.value} max={steps[0]!.value} color={s.color} />
        </li>
      ))}
    </ul>
  )
}

const SEVERITY = {
  critical: { icon: AlertOctagon, className: "text-rose-600 dark:text-rose-400" },
  warning: { icon: AlertTriangle, className: "text-amber-600 dark:text-amber-400" },
  info: { icon: Info, className: "text-sky-600 dark:text-sky-400" },
}

function AttentionRow({ item, href }: { item: AttentionItem; href?: string }) {
  const S = SEVERITY[item.severity]
  const body = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white" style={{ backgroundColor: item.color }}>
        {item.initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="flex items-center gap-1 text-xs">
          <S.icon className={cn("size-3.5 shrink-0", S.className)} />
          <span className="font-medium">{item.reason}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
      </div>
      {href ? <ArrowRight className="size-4 shrink-0 text-muted-foreground" /> : null}
    </>
  )
  return (
    <li>
      {href ? (
        <Link href={href} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50">
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-3 py-2.5">{body}</div>
      )}
    </li>
  )
}
