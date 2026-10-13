/**
 * Platform Admin — dashboard (SCR-P-002). Cross-company aggregates only;
 * no individual employee health data is shown at platform level either.
 */
import { dailySeries, DAY_MS, noise } from "@/lib/mock/series"
import type { AuditLog, Company, CompanyStatus, OrderStatus } from "@/lib/types"
import { endpoint } from "../core"
import { PERIOD_DAYS, planOf, ratio, requireAdmin, sum, withinDays, type AdminCtx, type Period } from "./common"
import { adminCan } from "./permissions"

export interface PlatformDashboardQuery {
  period: Period
  planId?: string
}

export interface Kpi {
  value: number
  previous: number
}

export interface AttentionItem {
  id: string
  name: string
  planName: string
  reason: string
  detail: string
  severity: "critical" | "warning" | "info"
  status: CompanyStatus
  color: string
  initials: string
}

export interface PlatformDashboard {
  periodDays: number
  companies: Record<CompanyStatus | "total", number> & { newInPeriod: number }
  kpis: {
    employeesInvited: Kpi
    employeesRegistered: Kpi
    monthlyActiveUsers: Kpi
    monthlyActiveWellnessParticipants: Kpi
    wellnessEngagementRate: Kpi
    activeChallenges: Kpi
    pointsAwarded: Kpi
    rewardsRedeemed: Kpi
    pendingOrders: Kpi
    mrr: Kpi | null
  }
  onboarded: { month: string; label: string; companies: number; cumulative: number }[]
  activeUsersTrend: { date: string; active: number; participants: number }[]
  mrrByPlan: { planId: string; name: string; mrr: number; companies: number }[] | null
  funnel: { invited: number; registered: number; active: number }
  recentActivity: AuditLog[]
  attention: AttentionItem[]
}

const PENDING: OrderStatus[] = ["pending_approval", "approved", "processing"]

function liveCounts(ctx: AdminCtx, c: Company) {
  const emps = ctx.db.employees.filter((e) => e.companyId === c.id)
  if (!emps.length) return { invited: c.employeeCount, registered: c.registeredCount, active: c.activeCount, mawp: Math.round(c.activeCount * (0.82 + noise(`company:${c.id}`, 1) * 0.12)), points: Math.round(c.activeCount * (650 + noise(`company:${c.id}`, 3) * 500)) }
  return {
    invited: emps.filter((e) => e.status !== "deactivated").length,
    registered: emps.filter((e) => e.status === "registered" || e.status === "active" || e.status === "inactive").length,
    active: emps.filter((e) => e.status === "active").length,
    mawp: emps.filter((e) => (e.status === "active" || e.status === "registered") && e.stats.activeDaysMonth >= 1).length,
    points: emps.reduce((a, e) => a + e.stats.pointsMonth, 0),
  }
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")

/** Small deterministic "previous period" factor so deltas look plausible and stay stable. */
const prevOf = (value: number, key: string, growth = 0.08) => Math.max(0, Math.round(value / (1 + growth * (0.4 + noise(key, 0) * 1.2))))

export const platformDashboardApi = {
  get: endpoint<PlatformDashboardQuery, PlatformDashboard, "admin">("admin", "GET", "/platform/dashboard", (q, ctx) => {
    const session = requireAdmin(ctx)
    const days = PERIOD_DAYS[q.period]
    const scale = days / 30
    const companies = ctx.db.companies.filter((c) => !q.planId || q.planId === "all" || c.planId === q.planId)
    const ids = new Set(companies.map((c) => c.id))
    const key = `platform:${q.planId ?? "all"}`

    const statusCounts = { total: companies.length, active: 0, onboarding: 0, trial: 0, suspended: 0 } as Record<CompanyStatus | "total", number>
    companies.forEach((c) => statusCounts[c.status]++)
    const newInPeriod = companies.filter((c) => withinDays(c.createdAt, days)).length

    const counts = companies.map((c) => ({ c, ...liveCounts(ctx, c) }))
    const invited = sum(counts, (x) => x.invited)
    const registered = sum(counts, (x) => x.registered)
    const mau = sum(counts, (x) => (x.c.status === "suspended" ? 0 : x.active))
    const mawp = sum(counts, (x) => (x.c.status === "suspended" ? 0 : x.mawp))
    const points = Math.round(sum(counts, (x) => (x.c.status === "suspended" ? 0 : x.points)) * scale)

    const nimbusChallenges = ctx.db.challenges.filter((ch) => ch.companyId && ids.has(ch.companyId) && ch.status === "active").length
    const otherChallenges = sum(
      companies.filter((c) => !ctx.db.employees.some((e) => e.companyId === c.id) && (c.status === "active" || c.status === "trial")),
      (c) => 1 + Math.floor(noise(`company:${c.id}`, 2) * 5),
    )
    const orders = ctx.db.orders.filter((o) => ids.has(o.companyId))
    const redeemed = orders.filter((o) => withinDays(o.createdAt, days) && o.status !== "cancelled" && o.status !== "rejected").length
    const redeemedPrev = orders.filter((o) => !withinDays(o.createdAt, days) && withinDays(o.createdAt, days * 2) && o.status !== "cancelled" && o.status !== "rejected").length
    const pending = orders.filter((o) => PENDING.includes(o.status)).length

    const subs = ctx.db.subscriptions.filter((s) => ids.has(s.companyId))
    const mrr = sum(subs.filter((s) => s.status === "active" || s.status === "past_due"), (s) => s.mrr)
    const showRevenue = adminCan(session.role, "revenue.view")

    // Companies onboarded per month (last 12 months)
    const now = new Date()
    let cumulative = companies.filter((c) => new Date(c.createdAt) < new Date(now.getFullYear(), now.getMonth() - 11, 1)).length
    const onboarded = Array.from({ length: 12 }, (_, i) => {
      const start = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - 10 + i, 1)
      const n = companies.filter((c) => {
        const d = new Date(c.createdAt)
        return d >= start && d < end
      }).length
      cumulative += n
      return { month: start.toISOString().slice(0, 7), label: start.toLocaleString("en-IN", { month: "short" }), companies: n, cumulative }
    })

    // Active users trend (daily, weekly buckets for 12 months)
    const series = dailySeries(`${key}:dau`, days, { base: mau * 0.68, variance: 0.07, trend: 0.14, weekendDip: 0.32 })
    const participantsSeries = dailySeries(`${key}:dawp`, days, { base: mawp * 0.55, variance: 0.08, trend: 0.16, weekendDip: 0.36 })
    let activeUsersTrend = series.map((p, i) => ({ date: p.date, active: Math.round(p.value), participants: Math.round(participantsSeries[i]!.value) }))
    if (days > 120) {
      const weekly: typeof activeUsersTrend = []
      for (let i = 0; i < activeUsersTrend.length; i += 7) {
        const chunk = activeUsersTrend.slice(i, i + 7)
        weekly.push({ date: chunk[0]!.date, active: Math.round(sum(chunk, (x) => x.active) / chunk.length), participants: Math.round(sum(chunk, (x) => x.participants) / chunk.length) })
      }
      activeUsersTrend = weekly
    }

    const mrrByPlan = showRevenue
      ? ctx.db.plans
          .map((p) => {
            const planSubs = subs.filter((s) => s.planId === p.id && (s.status === "active" || s.status === "past_due"))
            return { planId: p.id, name: p.name, mrr: sum(planSubs, (s) => s.mrr), companies: companies.filter((c) => c.planId === p.id).length }
          })
          .filter((p) => p.companies > 0 || p.mrr > 0)
      : null

    // Companies needing attention
    const attention: AttentionItem[] = []
    for (const { c, invited: inv, registered: reg, active } of counts) {
      const sub = ctx.db.subscriptions.find((s) => s.companyId === c.id)
      const base = { id: c.id, name: c.name, planName: planOf(ctx, c.planId)?.name ?? "—", status: c.status, color: c.branding.primaryColor, initials: c.branding.logoInitials || initials(c.name) }
      if (c.status === "suspended") attention.push({ ...base, severity: "critical", reason: "Suspended", detail: "Users can't sign in until reactivated" })
      else if (sub?.status === "past_due") attention.push({ ...base, severity: "critical", reason: "Payment overdue", detail: "Latest invoice is past due" })
      else if (sub?.status === "trial" && sub.trialEndsAt) {
        const left = Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / DAY_MS)
        if (left <= 14) attention.push({ ...base, severity: "warning", reason: left <= 0 ? "Trial ended" : `Trial ends in ${left} day${left === 1 ? "" : "s"}`, detail: "Convert to a paid plan" })
      } else if (c.status === "onboarding" && ratio(reg, inv) < 0.35) attention.push({ ...base, severity: "warning", reason: "Slow onboarding", detail: `Only ${Math.round(ratio(reg, inv) * 100)}% of employees registered` })
      else if (c.status === "active" && reg > 0 && ratio(active, reg) < 0.6) attention.push({ ...base, severity: "warning", reason: "Low engagement", detail: `${Math.round(ratio(active, reg) * 100)}% of registered employees active` })
      else if (!withinDays(c.lastActivityAt, 14)) attention.push({ ...base, severity: "info", reason: "No recent activity", detail: "No admin activity in 14 days" })
    }
    const rank = { critical: 0, warning: 1, info: 2 }
    attention.sort((a, b) => rank[a.severity] - rank[b.severity] || a.name.localeCompare(b.name))

    const recentActivity = ctx.db.auditLogs.filter((l) => l.companyId === null || ids.has(l.companyId)).slice(0, 8)

    return {
      periodDays: days,
      companies: { ...statusCounts, newInPeriod },
      kpis: {
        employeesInvited: { value: invited, previous: prevOf(invited, `${key}:inv`, 0.06) },
        employeesRegistered: { value: registered, previous: prevOf(registered, `${key}:reg`, 0.07) },
        monthlyActiveUsers: { value: mau, previous: prevOf(mau, `${key}:mau`) },
        monthlyActiveWellnessParticipants: { value: mawp, previous: prevOf(mawp, `${key}:mawp`, 0.1) },
        wellnessEngagementRate: { value: ratio(mawp, invited), previous: Math.max(0, ratio(mawp, invited) - 0.021) },
        activeChallenges: { value: nimbusChallenges + otherChallenges, previous: Math.max(0, nimbusChallenges + otherChallenges - 3) },
        pointsAwarded: { value: points, previous: prevOf(points, `${key}:pts`, 0.09) },
        rewardsRedeemed: { value: redeemed, previous: redeemedPrev },
        pendingOrders: { value: pending, previous: pending },
        mrr: showRevenue ? { value: mrr, previous: prevOf(mrr, `${key}:mrr`, 0.05) } : null,
      },
      onboarded,
      activeUsersTrend,
      mrrByPlan,
      funnel: { invited, registered, active: mau },
      recentActivity,
      attention: attention.slice(0, 6),
    }
  }),
}
