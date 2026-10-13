/**
 * Platform Admin — Platform analytics & KPIs (SCR-P-024).
 * Aggregates only. Figures are derived from the real company counts in the sample DB
 * (companies, employeeCount / registeredCount / activeCount, subscriptions) and spread
 * over time with deterministic series so charts are stable.
 */
import { DAY_MS, dailySeries, noise } from "@/lib/mock/series"
import type { Company } from "@/lib/types"
import { audit, endpoint } from "../core"
import { PERIOD_DAYS, PERIOD_LABEL, planOf, ratio, requireAdmin, round, sum, toCsv, today, type AdminCtx, type Period } from "./common"
import { adminCan } from "./permissions"

export interface AnalyticsQuery {
  period: Period
  companyId?: string
  planId?: string
}

export interface Kpi {
  value: number
  previous: number | null
}

export interface AnalyticsData {
  scope: { label: string; companies: number }
  periodLabel: string
  enoughData: boolean
  acquisition: {
    companiesOnboarded: Kpi
    employeesInvited: Kpi
    employeesRegistered: Kpi
    activeUsers: Kpi
    monthly: { month: string; companies: number; invited: number; registered: number }[]
  }
  funnel: { key: string; label: string; value: number; ofPrevious: number; ofInvited: number }[]
  engagement: {
    series: { date: string; dau: number; wau: number; mau: number }[]
    avgDau: number
    avgWau: number
    mau: number
    stickiness: number
    stickinessPrevious: number
    activitiesPerUser: Kpi
    challengeParticipation: Kpi
  }
  retention: { cohort: string; size: number; d7: number | null; d30: number | null; d90: number | null }[]
  wellness: {
    /** #334 (Phase 1) */
    mawp: Kpi
    /** #335 (Phase 1): active wellness employees / eligible x 100 */
    engagementRate: Kpi
    eligible: number
    /** #332 (Phase 2) */
    avgDailySteps: Kpi
    workoutsPerUser: Kpi
    habitCompletion: Kpi
    challengeCompletion: Kpi
    hydrationGoalsHit: Kpi
    avgWellnessScore: Kpi
    modules: { module: string; share: number }[]
  }
  /** Only for roles with revenue.view. */
  revenue: null | {
    mrr: number
    arr: number
    /** Average revenue per paying company (account) per month. */
    arpu: number
    /** MRR / billable active employees. */
    revenuePerEmployee: number
    expansionMrr: number
    /** Monthly MRR churn rate. */
    churn: number
    payingCompanies: number
    mrrTrend: { month: string; mrr: number }[]
  }
}

interface Counts {
  invited: number
  registered: number
  active: number
  healthConnected: number
  active7d: number
  mawp: number
}

const hasEmployees = (ctx: AdminCtx, c: Company) => ctx.db.employees.some((e) => e.companyId === c.id)

/** Live counts for a company (real records for Nimbus, stored counts for the rest). */
function countsFor(ctx: AdminCtx, c: Company): Counts {
  if (hasEmployees(ctx, c)) {
    const list = ctx.db.employees.filter((e) => e.companyId === c.id)
    const joined = list.filter((e) => e.status === "registered" || e.status === "active" || e.status === "inactive")
    return {
      invited: list.filter((e) => e.status !== "deactivated").length,
      registered: joined.length,
      active: list.filter((e) => e.status === "active").length,
      healthConnected: joined.filter((e) => e.healthConnected).length,
      active7d: joined.filter((e) => e.lastActiveAt && Date.now() - new Date(e.lastActiveAt).getTime() <= 7 * DAY_MS).length,
      mawp: joined.filter((e) => e.stats.activeDaysMonth >= 1).length,
    }
  }
  const connected = Math.round(c.registeredCount * (0.76 + noise(`hc:${c.id}`, 1) * 0.14))
  const active = c.status === "suspended" ? 0 : c.activeCount
  return {
    invited: c.employeeCount,
    registered: c.registeredCount,
    active,
    healthConnected: connected,
    active7d: Math.min(connected, Math.round(active * (0.86 + noise(`a7:${c.id}`, 1) * 0.08))),
    mawp: Math.round(active * (0.93 + noise(`mawp:${c.id}`, 1) * 0.05)),
  }
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
const monthLabel = (key: string) => new Date(`${key}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })

/** Daily invitations/registrations since the company was created (front-loaded onboarding wave). */
function dailyJoins(c: Company, total: number, lagDays: number) {
  const created = new Date(c.createdAt).getTime()
  const days = Math.max(1, Math.floor((Date.now() - created) / DAY_MS) - lagDays)
  const weights = Array.from({ length: days }, (_, d) => Math.exp(-d / 18) + 0.015)
  const w = weights.reduce((a, x) => a + x, 0)
  // [timestamp, count]
  return weights.map((x, d) => [created + (d + lagDays) * DAY_MS, (x / w) * total] as const)
}

function withinWindow(ts: number, fromDaysAgo: number, toDaysAgo: number) {
  const age = (Date.now() - ts) / DAY_MS
  return age < fromDaysAgo && age >= toDaysAgo
}

function compute(ctx: AdminCtx, q: AnalyticsQuery): AnalyticsData {
  const session = requireAdmin(ctx)
  const days = PERIOD_DAYS[q.period]
  const companies = ctx.db.companies.filter((c) => (!q.companyId || c.id === q.companyId) && (!q.planId || c.planId === q.planId))
  const key = `${q.companyId ?? "all"}:${q.planId ?? "all"}`
  const counts = companies.map((c) => ({ c, n: countsFor(ctx, c) }))
  const tot = (get: (n: Counts) => number) => sum(counts, (x) => get(x.n))
  const invited = tot((n) => n.invited)
  const registered = tot((n) => n.registered)
  const active = tot((n) => n.active)
  const connected = tot((n) => n.healthConnected)
  const active7d = tot((n) => n.active7d)
  const mawp = tot((n) => n.mawp)
  const vary = (k: string, lo = 0.84, hi = 0.97) => lo + noise(`${key}:${q.period}:${k}`, 1) * (hi - lo)
  // Client decision #6: active = a defined activity or sign-in within the selected period.
  const periodFactor = { "7d": 0.86, "30d": 1, "90d": 1.07, "12m": 1.14 }[q.period]
  const activeInPeriod = Math.min(registered, Math.round(active * periodFactor))
  const scale = days / 30

  // ── Acquisition ──
  const inv = companies.flatMap((c) => dailyJoins(c, countsFor(ctx, c).invited, 0))
  const reg = companies.flatMap((c) => dailyJoins(c, countsFor(ctx, c).registered, 3))
  const inWindow = (list: (readonly [number, number])[], from: number, to: number) => Math.round(sum(list.filter(([t]) => withinWindow(t, from, to)), ([, v]) => v))
  const onboarded = (from: number, to: number) => companies.filter((c) => withinWindow(new Date(c.createdAt).getTime(), from, to)).length

  const months: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    months.push(monthKey(d))
  }
  const monthly = months.map((m) => ({
    month: monthLabel(m),
    companies: companies.filter((c) => monthKey(new Date(c.createdAt)) === m).length,
    invited: Math.round(sum(inv.filter(([t]) => monthKey(new Date(t)) === m), ([, v]) => v)),
    registered: Math.round(sum(reg.filter(([t]) => monthKey(new Date(t)) === m), ([, v]) => v)),
  }))

  // ── Funnel ──
  const profileDone = Math.min(registered, Math.max(connected, Math.round(registered * vary("profile", 0.9, 0.97))))
  const firstActivity = Math.min(connected, Math.round(connected * vary("first", 0.88, 0.95)))
  const firstChallenge = Math.min(firstActivity, Math.max(Math.round(active7d * 0.7), Math.round(firstActivity * vary("chal1", 0.58, 0.72))))
  const steps = [
    { key: "invited", label: "Invited", value: invited },
    { key: "registered", label: "Registered", value: registered },
    { key: "profile", label: "Profile completed", value: profileDone },
    { key: "connected", label: "Health data connected", value: connected },
    { key: "first", label: "First activity", value: firstActivity },
    { key: "challenge", label: "Joined first challenge", value: firstChallenge },
  ]
  const funnel = steps.map((s, i) => ({ ...s, ofPrevious: i === 0 ? 1 : ratio(s.value, steps[i - 1]!.value), ofInvited: ratio(s.value, invited) }))

  // ── Engagement ──
  const weekly = q.period === "12m"
  const points = weekly ? 52 : days
  const mauSeries = dailySeries(`${key}:mau`, points, { base: active * 0.94, variance: 0.03, trend: 0.08, max: registered })
  const dauSeries = dailySeries(`${key}:dau`, points, { base: active * 0.44, variance: 0.1, trend: 0.1, weekendDip: weekly ? 0 : 0.38 })
  const wauSeries = dailySeries(`${key}:wau`, points, { base: active * 0.74, variance: 0.05, trend: 0.08 })
  const series = mauSeries.map((p, i) => ({
    date: weekly ? new Date(Date.now() - (points - 1 - i) * 7 * DAY_MS).toISOString().slice(0, 10) : p.date,
    dau: Math.round(dauSeries[i]!.value),
    wau: Math.round(Math.min(wauSeries[i]!.value, p.value)),
    mau: Math.round(p.value),
  }))
  const avgDau = series.length ? sum(series, (s) => s.dau) / series.length : 0
  const avgWau = series.length ? sum(series, (s) => s.wau) / series.length : 0
  const mau = series.at(-1)?.mau ?? 0
  const stickiness = ratio(avgDau, series.length ? sum(series, (s) => s.mau) / series.length : 0)

  // ── Retention cohorts (last 6 signup months) ──
  const retention = months.slice(-6).map((m, i) => {
    const size = Math.round(sum(reg.filter(([t]) => monthKey(new Date(t)) === m), ([, v]) => v))
    const monthEnd = new Date(`${m}-01T00:00:00`)
    monthEnd.setMonth(monthEnd.getMonth() + 1)
    const age = (Date.now() - monthEnd.getTime()) / DAY_MS
    const base = 0.8 + noise(`${key}:coh`, i) * 0.1
    return {
      cohort: monthLabel(m),
      size,
      d7: size && age >= -23 ? round(base, 3) : null,
      d30: size && age >= 0 ? round(base * (0.8 + noise(`${key}:coh30`, i) * 0.08), 3) : null,
      d90: size && age >= 60 ? round(base * (0.66 + noise(`${key}:coh90`, i) * 0.08), 3) : null,
    }
  })

  // ── Wellness ──
  const prevMawp = Math.round(mawp * vary("mawp", 0.88, 0.98))
  const wellness = {
    mawp: { value: mawp, previous: prevMawp },
    engagementRate: { value: ratio(mawp, invited), previous: ratio(prevMawp, invited) },
    eligible: invited,
    avgDailySteps: { value: Math.round(6800 + noise(`${key}:steps`, 1) * 1400), previous: Math.round(6600 + noise(`${key}:steps`, 2) * 1300) },
    workoutsPerUser: { value: round(3.1 * scale * (0.9 + noise(`${key}:wo`, 1) * 0.2), 1), previous: round(3.1 * scale * (0.85 + noise(`${key}:wo`, 2) * 0.2), 1) },
    habitCompletion: { value: round(0.56 + noise(`${key}:hab`, 1) * 0.14, 3), previous: round(0.53 + noise(`${key}:hab`, 2) * 0.14, 3) },
    challengeCompletion: { value: round(0.38 + noise(`${key}:chc`, 1) * 0.16, 3), previous: round(0.35 + noise(`${key}:chc`, 2) * 0.16, 3) },
    hydrationGoalsHit: { value: Math.round(activeInPeriod * 0.41 * days), previous: Math.round(activeInPeriod * 0.41 * days * vary("hy")) },
    avgWellnessScore: { value: round(62 + noise(`${key}:score`, 1) * 9, 1), previous: round(60 + noise(`${key}:score`, 2) * 8, 1) },
    modules: [
      { module: "Steps & activity", share: 0.91 },
      { module: "Challenges", share: 0.52 },
      { module: "Water", share: 0.47 },
      { module: "Workouts", share: 0.38 },
      { module: "Habits", share: 0.33 },
      { module: "Rewards", share: 0.29 },
    ].map((m, i) => ({ ...m, share: round(Math.min(1, m.share * (0.92 + noise(`${key}:mod`, i) * 0.14)), 3) })),
  }

  // ── Revenue (Super Admin only) ──
  let revenue: AnalyticsData["revenue"] = null
  if (adminCan(session.role, "revenue.view")) {
    const ids = new Set(companies.map((c) => c.id))
    const subs = ctx.db.subscriptions.filter((s) => ids.has(s.companyId) && (s.status === "active" || s.status === "past_due"))
    const mrr = sum(subs, (s) => s.mrr)
    const seats = sum(subs, (s) => s.activeSeats)
    const mrrTrend = months.map((m, i) => {
      const end = new Date(`${m}-01T00:00:00`)
      end.setMonth(end.getMonth() + 1)
      const live = subs.filter((s) => new Date(ctx.db.companies.find((c) => c.id === s.companyId)?.createdAt ?? 0).getTime() < end.getTime())
      const ramp = 0.82 + (i / 11) * 0.18
      return { month: monthLabel(m), mrr: Math.round(sum(live, (s) => s.mrr) * (i === 11 ? 1 : ramp)) }
    })
    revenue = {
      mrr,
      arr: mrr * 12,
      arpu: Math.round(ratio(mrr, subs.length)),
      revenuePerEmployee: round(ratio(mrr, seats), 2),
      expansionMrr: Math.round(mrr * (0.03 + noise(`${key}:exp`, 1) * 0.04)),
      churn: round(0.006 + noise(`${key}:churn`, 1) * 0.014, 4),
      payingCompanies: subs.length,
      mrrTrend,
    }
  }

  const company = q.companyId ? ctx.db.companies.find((c) => c.id === q.companyId) : undefined
  const plan = q.planId ? planOf(ctx, q.planId) : undefined
  return {
    scope: { label: company?.name ?? (plan ? `${plan.name} plan companies` : "All companies"), companies: companies.length },
    periodLabel: PERIOD_LABEL[q.period],
    enoughData: companies.length > 0 && registered > 0,
    acquisition: {
      companiesOnboarded: { value: onboarded(days, 0), previous: onboarded(days * 2, days) },
      employeesInvited: { value: inWindow(inv, days, 0), previous: inWindow(inv, days * 2, days) },
      employeesRegistered: { value: inWindow(reg, days, 0), previous: inWindow(reg, days * 2, days) },
      activeUsers: { value: activeInPeriod, previous: Math.round(activeInPeriod * vary("active", 0.9, 0.99)) },
      monthly,
    },
    funnel,
    engagement: {
      series,
      avgDau: Math.round(avgDau),
      avgWau: Math.round(avgWau),
      mau,
      stickiness,
      stickinessPrevious: stickiness * vary("stick", 0.92, 1.02),
      activitiesPerUser: { value: round(18 * scale * (0.9 + noise(`${key}:apu`, 1) * 0.25), 1), previous: round(18 * scale * (0.85 + noise(`${key}:apu`, 2) * 0.25), 1) },
      challengeParticipation: { value: round(0.44 + noise(`${key}:chal`, 1) * 0.16, 3), previous: round(0.4 + noise(`${key}:chal`, 2) * 0.14, 3) },
    },
    retention,
    wellness,
    revenue,
  }
}

export const analyticsApi = {
  get: endpoint<AnalyticsQuery, AnalyticsData, "admin">("admin", "GET", "/platform/analytics", (q, ctx) => compute(ctx, q)),

  exportCsv: endpoint<AnalyticsQuery, { fileName: string; csv: string }, "admin">("admin", "GET", "/platform/analytics/export", (q, ctx) => {
    const d = compute(ctx, q)
    const rows: unknown[][] = [
      ["Scope", "", d.scope.label],
      ["Period", "", d.periodLabel],
      ["Acquisition", "Companies onboarded", d.acquisition.companiesOnboarded.value],
      ["Acquisition", "Employees invited", d.acquisition.employeesInvited.value],
      ["Acquisition", "Employees registered", d.acquisition.employeesRegistered.value],
      ["Acquisition", "Active employees (activity or sign-in in period)", d.acquisition.activeUsers.value],
      ...d.funnel.map((f) => ["Activation funnel", f.label, `${f.value} (${Math.round(f.ofInvited * 100)}% of invited)`]),
      ["Engagement", "Average DAU", d.engagement.avgDau],
      ["Engagement", "Average WAU", d.engagement.avgWau],
      ["Engagement", "MAU", d.engagement.mau],
      ["Engagement", "Stickiness (DAU/MAU)", `${Math.round(d.engagement.stickiness * 100)}%`],
      ["Engagement", "Activities per active user", d.engagement.activitiesPerUser.value],
      ["Engagement", "Challenge participation", `${Math.round(d.engagement.challengeParticipation.value * 100)}%`],
      ...d.retention.map((r) => ["Retention", `Cohort ${r.cohort} (${r.size})`, [r.d7, r.d30, r.d90].map((v) => (v === null ? "—" : `${Math.round(v * 100)}%`)).join(" / ")]),
      ["Wellness", "Monthly Active Wellness Participants", d.wellness.mawp.value],
      ["Wellness", "Wellness Engagement Rate (active / eligible x 100)", `${Math.round(d.wellness.engagementRate.value * 100)}%`],
      ["Wellness", "Average daily steps per active employee", d.wellness.avgDailySteps.value],
      ["Wellness", "Workouts per active employee", d.wellness.workoutsPerUser.value],
      ["Wellness", "Habit completion", `${Math.round(d.wellness.habitCompletion.value * 100)}%`],
      ["Wellness", "Challenge completion", `${Math.round(d.wellness.challengeCompletion.value * 100)}%`],
      ["Wellness", "Hydration goals hit (employee-days)", d.wellness.hydrationGoalsHit.value],
      ["Wellness", "Average wellness score", d.wellness.avgWellnessScore.value],
      ...(d.revenue
        ? [
            ["Revenue", "MRR (INR)", d.revenue.mrr],
            ["Revenue", "ARR (INR)", d.revenue.arr],
            ["Revenue", "ARPU (INR per company / month)", d.revenue.arpu],
            ["Revenue", "Revenue per employee (INR / month)", d.revenue.revenuePerEmployee],
            ["Revenue", "Expansion MRR (INR)", d.revenue.expansionMrr],
            ["Revenue", "MRR churn (monthly)", `${(d.revenue.churn * 100).toFixed(1)}%`],
          ]
        : []),
      ...d.acquisition.monthly.map((m) => ["Monthly", m.month, `${m.companies} companies, ${m.invited} invited, ${m.registered} registered`]),
    ]
    audit(ctx, { action: "Exported platform analytics (CSV)", entityType: "Report", entityName: `Platform analytics · ${d.scope.label}` })
    ctx.save()
    return { fileName: `healthx-platform-analytics-${q.period}-${today()}.csv`, csv: toCsv(["Section", "Metric", "Value"], rows) }
  }),

  lookups: endpoint<void, { companies: { id: string; name: string }[]; plans: { id: string; name: string }[] }, "admin">("admin", "GET", "/platform/analytics/filters", (_, ctx) => {
    requireAdmin(ctx)
    return {
      companies: [...ctx.db.companies].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, name: c.name })),
      plans: ctx.db.plans.filter((p) => p.status !== "archived").map((p) => ({ id: p.id, name: p.name })),
    }
  }),
}
