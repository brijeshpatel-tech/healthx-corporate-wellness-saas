/** Business Portal — dashboard (SCR-B-005). Aggregated, privacy-safe figures only. */
import type { BusinessSession } from "@/lib/auth/session"
import type { Challenge } from "@/lib/types"
import { dailySeries, DAY_MS } from "@/lib/mock/series"
import { endpoint } from "../core"
import { companyEmployees, companySettings, isJoined, PERIOD_DAYS, ratio, scopeEmployees, suppressed, type Period } from "./common"

export interface DashboardQuery {
  period: Period
  departmentId?: string
  teamId?: string
}

export interface DashboardKpi {
  value: number
  previous: number
}

export interface DashboardData {
  scopeLabel: string
  kpis: {
    totalEmployees: DashboardKpi
    activeEmployees: DashboardKpi
    participationRate: DashboardKpi
    activeChallenges: DashboardKpi
    pointsAwarded: DashboardKpi
    rewardsRedeemed: DashboardKpi
    monthlyActiveWellnessParticipants: DashboardKpi
    wellnessEngagementRate: DashboardKpi
  }
  activityTrend: { date: string; activeEmployees: number; avgSteps: number }[]
  departments: { id: string; name: string; employees: number; active: number; participation: number | null; avgStepsPerDay: number | null }[]
  lowParticipation: { id: string; name: string; kind: "department" | "team"; participation: number; employees: number }[]
  activeChallenges: (Pick<Challenge, "id" | "name" | "coverEmoji" | "coverColor" | "endDate" | "metric" | "type" | "target"> & { participants: number; eligible: number; avgProgress: number })[]
  onboarding: { invited: number; registered: number; active: number; inactive: number }
  pendingOrders: number
  pendingInvites: number
  minGroupSize: number
}

export const dashboardApi = {
  get: endpoint<DashboardQuery, DashboardData, "business">("business", "GET", "/organization/dashboard", (q, ctx) => {
    const session = ctx.session() as BusinessSession
    const settings = companySettings(ctx)
    const days = PERIOD_DAYS[q.period]
    const all = companyEmployees(ctx)
    const scoped = scopeEmployees(ctx, all, q)
    const joined = scoped.filter(isJoined)
    const active = scoped.filter((e) => e.status === "active")
    const scale = days / 30
    const key = `${ctx.companyId()}:${q.departmentId ?? ""}:${q.teamId ?? ""}`
    const companyId = ctx.companyId()

    const scopeLabel =
      session.role === "team_manager"
        ? ctx.db.teams.filter((t) => session.teamIds.includes(t.id)).map((t) => t.name).join(", ") || "My team"
        : q.teamId
          ? ctx.db.teams.find((t) => t.id === q.teamId)?.name ?? "Team"
          : q.departmentId
            ? ctx.db.departments.find((d) => d.id === q.departmentId)?.name ?? "Department"
            : "Whole company"

    const ids = new Set(scoped.map((e) => e.id))
    const pointsAwarded = Math.round(scoped.reduce((a, e) => a + e.stats.pointsMonth, 0) * scale)
    const ordersInPeriod = ctx.db.orders.filter((o) => o.companyId === companyId && ids.has(o.employeeId) && Date.now() - new Date(o.createdAt).getTime() < days * DAY_MS)
    const challenges = ctx.db.challenges.filter((c) => c.companyId === companyId && c.status === "active")
    const mawp = scoped.filter((e) => e.stats.activeDaysMonth >= 1 && (e.status === "active" || e.status === "registered")).length

    const prev = (v: number, k: string) => Math.max(0, Math.round(v * (0.86 + dailySeries(`${key}:${k}`, 1, { base: 1, variance: 0.12 })[0]!.value * 0.08)))

    const trend = dailySeries(`${key}:active`, days, { base: active.length * 0.78, variance: 0.08, trend: 0.08, weekendDip: 0.35, max: joined.length })
    const steps = dailySeries(`${key}:steps`, days, { base: 7400, variance: 0.1, trend: 0.05, weekendDip: 0.18 })

    const departments = ctx.db.departments
      .filter((d) => d.companyId === companyId)
      .map((d) => {
        const members = scoped.filter((e) => e.departmentId === d.id)
        const joinedM = members.filter(isJoined)
        const activeM = members.filter((e) => e.status === "active")
        const hide = suppressed(members.length, ctx)
        return {
          id: d.id,
          name: d.name,
          employees: members.length,
          active: activeM.length,
          participation: hide ? null : ratio(activeM.length, joinedM.length || members.length),
          avgStepsPerDay: hide ? null : Math.round(activeM.reduce((a, e) => a + e.stats.stepsMonth, 0) / Math.max(1, activeM.length) / 30),
        }
      })
      .filter((d) => d.employees > 0)
      .sort((a, b) => (b.participation ?? -1) - (a.participation ?? -1))

    const lowTeams = ctx.db.teams
      .filter((t) => t.companyId === companyId)
      .map((t) => {
        const members = scoped.filter((e) => e.teamId === t.id)
        const activeM = members.filter((e) => e.status === "active").length
        return { id: t.id, name: t.name, kind: "team" as const, employees: members.length, participation: ratio(activeM, members.length) }
      })
      .filter((t) => t.employees >= settings.minAnalyticsGroupSize && t.participation < 0.6)
      .sort((a, b) => a.participation - b.participation)
      .slice(0, 4)

    const activeChallenges = challenges.slice(0, 5).map((c) => {
      const parts = ctx.db.participants.filter((p) => p.challengeId === c.id && ids.has(p.employeeId))
      const avgProgress = c.type === "collaborative" ? ratio(parts.reduce((a, p) => a + p.progress, 0), c.target) : ratio(parts.reduce((a, p) => a + Math.min(1, p.progress / c.target), 0), parts.length)
      return {
        id: c.id,
        name: c.name,
        coverEmoji: c.coverEmoji,
        coverColor: c.coverColor,
        endDate: c.endDate,
        metric: c.metric,
        type: c.type,
        target: c.target,
        participants: parts.length,
        eligible: session.role === "team_manager" || q.departmentId || q.teamId ? joined.length : c.eligibleCount,
        avgProgress: Math.min(1, avgProgress),
      }
    })

    const participationRate = ratio(active.length, joined.length)
    const engagement = ratio(mawp, scoped.length)

    return {
      scopeLabel,
      kpis: {
        totalEmployees: { value: scoped.length, previous: Math.round(scoped.length * 0.96) },
        activeEmployees: { value: active.length, previous: prev(active.length, "act") },
        participationRate: { value: participationRate, previous: Math.max(0, participationRate - 0.04) },
        activeChallenges: { value: challenges.length, previous: Math.max(0, challenges.length - 1) },
        pointsAwarded: { value: pointsAwarded, previous: prev(pointsAwarded, "pts") },
        rewardsRedeemed: { value: ordersInPeriod.length, previous: prev(ordersInPeriod.length, "ord") },
        monthlyActiveWellnessParticipants: { value: mawp, previous: prev(mawp, "mawp") },
        wellnessEngagementRate: { value: engagement, previous: Math.max(0, engagement - 0.03) },
      },
      activityTrend: trend.map((p, i) => ({ date: p.date, activeEmployees: Math.round(p.value), avgSteps: Math.round(steps[i]!.value) })),
      departments,
      lowParticipation: lowTeams,
      activeChallenges,
      onboarding: {
        invited: scoped.filter((e) => e.status === "invited").length,
        registered: scoped.filter((e) => e.status === "registered").length,
        active: active.length,
        inactive: scoped.filter((e) => e.status === "inactive").length,
      },
      pendingOrders: ctx.db.orders.filter((o) => o.companyId === companyId && o.status === "pending_approval" && ids.has(o.employeeId)).length,
      pendingInvites: ctx.db.invitations.filter((i) => i.companyId === companyId && i.status === "pending").length,
      minGroupSize: settings.minAnalyticsGroupSize,
    }
  }),
}
