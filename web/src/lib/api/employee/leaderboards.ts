/**
 * Employee app — company / department / team leaderboards (SCR-M-048) and My Rank (SCR-M-049).
 * Names follow the company's leaderboardNameDisplay setting; people who opted out are masked.
 * The viewer's own figures come from their private data; colleagues' from leaderboard stats only.
 */
import { DAY_MS, noise, toLocalDate } from "@/lib/mock/series"
import type { Employee, LeaderboardMetric, LeaderboardNameDisplay } from "@/lib/types"
import { endpoint, type MockContext } from "../core"
import { companySettings, lastRefreshIso, meEmployee, previousRankFor, rankAlert, rankName, type RankedEntry } from "./challenges"

type Ctx = MockContext<"employee">

export type LbScope = "company" | "department" | "team"
export type LbPeriod = "today" | "week" | "month"
export type LbView = "people" | "groups"

export const LB_METRIC_LABEL: Record<LeaderboardMetric, string> = { steps: "Steps", points: "Points", workouts: "Workouts", active_days: "Active days" }
export const LB_METRIC_UNIT: Record<LeaderboardMetric, string> = { steps: "steps", points: "pts", workouts: "workouts", active_days: "days" }
export const LB_PERIOD_LABEL: Record<LbPeriod, string> = { today: "Today", week: "This week", month: "This month" }

export interface LeaderboardResult {
  scope: LbScope
  metric: LeaderboardMetric
  period: LbPeriod
  view: LbView
  unit: string
  scopeLabel: string
  entries: RankedEntry[]
  me: RankedEntry | null
  total: number
  updatedAt: string
  nameDisplay: LeaderboardNameDisplay
  optedOut: boolean
  hiddenGroups: number
  minGroupSize: number
  /** #348 — set when the viewer's rank changed since they last looked. */
  rankAlert: string | null
}

export interface MyRankResult {
  metric: LeaderboardMetric
  period: LbPeriod
  unit: string
  myValue: number
  optedOut: boolean
  ranks: { scope: LbScope; label: string; rank: number; total: number; nextRank: number | null; gapToNext: number | null; change: number; topPercent: number }[]
  trend: { label: string; rank: number }[]
}

const GROUP_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#14b8a6", "#f97316", "#8b5cf6", "#84cc16", "#06b6d4"]

function since(period: LbPeriod) {
  const days = period === "today" ? 1 : period === "week" ? 7 : 30
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return new Date(d.getTime() - (days - 1) * DAY_MS)
}

/** My own figure from private data (always accurate for the viewer). */
function myValue(ctx: Ctx, metric: LeaderboardMetric, period: LbPeriod) {
  const me = ctx.me()
  const from = since(period)
  const fromDate = toLocalDate(from)
  switch (metric) {
    case "steps":
      return me.daily.filter((d) => d.date >= fromDate).reduce((a, d) => a + d.steps, 0)
    case "points":
      return me.transactions.filter((t) => t.points > 0 && (t.type === "earn" || t.type === "adjust") && t.description !== "Points earned before this period" && new Date(t.createdAt) >= from).reduce((a, t) => a + t.points, 0)
    case "workouts":
      return me.workoutSessions.filter((w) => w.completed && new Date(w.completedAt ?? w.startedAt) >= from).length
    case "active_days":
      return me.daily.filter((d) => d.date >= fromDate && d.steps >= 5000).length
  }
}

/** Colleague figure from the leaderboard stats (no private health data). */
function statValue(e: Employee, metric: LeaderboardMetric, period: LbPeriod) {
  const s = e.stats
  const n = noise(`lb:${e.id}:${metric}`, period === "today" ? 1 : period === "week" ? 7 : 30)
  switch (metric) {
    case "steps":
      return period === "today" ? s.stepsToday : period === "week" ? s.stepsWeek : s.stepsMonth
    case "points":
      return period === "month" ? s.pointsMonth : period === "week" ? Math.round((s.pointsMonth / 4.3) * (0.75 + n * 0.5)) : Math.round((s.pointsMonth / 30) * (0.4 + n * 1.2))
    case "workouts":
      return period === "month" ? s.workoutsMonth : period === "week" ? Math.round((s.workoutsMonth / 4.3) * (0.6 + n * 0.8)) : n < s.workoutsMonth / 30 ? 1 : 0
    case "active_days":
      return period === "month" ? s.activeDaysMonth : period === "week" ? Math.min(7, Math.round((s.activeDaysMonth / 30) * 7 * (0.8 + n * 0.4))) : s.stepsToday >= 3000 ? 1 : 0
  }
}

function population(ctx: Ctx, companyId: string) {
  return ctx.db.employees.filter((e) => e.companyId === companyId && (e.status === "active" || e.status === "registered" || e.status === "inactive"))
}

function rankPeople(ctx: Ctx, people: Employee[], viewer: Employee, metric: LeaderboardMetric, period: LbPeriod, scopeKey: string): RankedEntry[] {
  const mode = companySettings(ctx, viewer.companyId).leaderboardNameDisplay
  const rows = people
    .map((p) => ({ p, value: p.id === viewer.id ? myValue(ctx, metric, period) : statValue(p, metric, period) }))
    .sort((a, b) => b.value - a.value || a.p.firstName.localeCompare(b.p.firstName))
  return rows.map(({ p, value }, i) => {
    const n = rankName(ctx, p, viewer.id, mode)
    const team = ctx.db.teams.find((t) => t.id === p.teamId)
    return {
      rank: i + 1,
      previousRank: previousRankFor(`${scopeKey}:${metric}:${period}:${p.id}`, i + 1, rows.length),
      id: p.id,
      name: n.name,
      subtitle: n.masked && p.id !== viewer.id ? undefined : team?.name,
      avatarColor: p.avatarColor,
      value,
      isMe: p.id === viewer.id,
      masked: n.masked,
    }
  })
}

function rankGroups(
  ctx: Ctx,
  viewer: Employee,
  groups: { id: string; name: string; members: Employee[] }[],
  metric: LeaderboardMetric,
  period: LbPeriod,
  myGroupId: string,
  minSize: number,
) {
  const eligible = groups.filter((g) => g.members.length >= minSize)
  const rows = eligible
    .map((g) => {
      const total = g.members.reduce((a, m) => a + (m.id === viewer.id ? myValue(ctx, metric, period) : statValue(m, metric, period)), 0)
      return { g, value: Math.round(total / g.members.length) }
    })
    .sort((a, b) => b.value - a.value)
  const entries: RankedEntry[] = rows.map(({ g, value }, i) => ({
    rank: i + 1,
    previousRank: previousRankFor(`grp:${metric}:${period}:${g.id}`, i + 1, rows.length),
    id: g.id,
    name: g.name,
    subtitle: `${g.members.length} members · average per person`,
    avatarColor: GROUP_COLORS[i % GROUP_COLORS.length]!,
    value,
    memberCount: g.members.length,
    isMe: g.id === myGroupId,
    group: true,
  }))
  return { entries, hidden: groups.length - eligible.length }
}

export const leaderboardsApi = {
  /** SCR-M-048 — rankings for a scope, metric and period. */
  list: endpoint<{ scope: LbScope; metric: LeaderboardMetric; period: LbPeriod; view?: LbView }, LeaderboardResult, "employee">(
    "employee",
    "GET",
    "/leaderboards",
    ({ scope, metric, period, view }, ctx) => {
      const { me, emp } = meEmployee(ctx)
      const settings = companySettings(ctx, emp.companyId)
      const people = population(ctx, emp.companyId)
      const company = ctx.db.companies.find((c) => c.id === emp.companyId)
      const dept = ctx.db.departments.find((d) => d.id === emp.departmentId)
      const team = ctx.db.teams.find((t) => t.id === emp.teamId)
      const v: LbView = scope === "company" ? "people" : (view ?? "groups")
      const base = {
        scope,
        metric,
        period,
        view: v,
        unit: LB_METRIC_UNIT[metric],
        updatedAt: lastRefreshIso(),
        nameDisplay: settings.leaderboardNameDisplay,
        optedOut: me.leaderboardOptOut,
        minGroupSize: settings.minAnalyticsGroupSize,
      }

      if (v === "groups") {
        const groups =
          scope === "department"
            ? ctx.db.departments.filter((d) => d.companyId === emp.companyId).map((d) => ({ id: d.id, name: d.name, members: people.filter((p) => p.departmentId === d.id) }))
            : ctx.db.teams.filter((t) => t.companyId === emp.companyId).map((t) => ({ id: t.id, name: t.name, members: people.filter((p) => p.teamId === t.id) }))
        const { entries, hidden } = rankGroups(ctx, emp, groups, metric, period, scope === "department" ? emp.departmentId : emp.teamId, settings.minAnalyticsGroupSize)
        return {
          ...base,
          scopeLabel: scope === "department" ? "Departments" : "Teams",
          entries,
          me: entries.find((e) => e.isMe) ?? null,
          total: entries.length,
          hiddenGroups: hidden,
          rankAlert: null,
        }
      }

      const scoped = scope === "company" ? people : scope === "department" ? people.filter((p) => p.departmentId === emp.departmentId) : people.filter((p) => p.teamId === emp.teamId)
      const entries = rankPeople(ctx, scoped, emp, metric, period, scope)
      const mine = entries.find((e) => e.isMe)
      const scopeName = scope === "company" ? (company?.name ?? "Company") : scope === "department" ? (dept?.name ?? "Department") : (team?.name ?? "Team")
      // Rank-change alerts follow the main board (steps, this week) for each scope.
      const alert =
        mine && metric === "steps" && period === "week"
          ? rankAlert(ctx, `lb:${scope}`, `${scopeName} steps leaderboard`, mine.rank, `/employee-app/leaderboards${scope === "company" ? "" : `?scope=${scope}&view=people`}`, mine.previousRank)
          : null
      return {
        ...base,
        scopeLabel: scope === "company" ? (company?.name ?? "Company") : scope === "department" ? (dept?.name ?? "Department") : (team?.name ?? "Team"),
        entries: entries.slice(0, 100),
        me: mine ?? null,
        total: entries.length,
        hiddenGroups: 0,
        rankAlert: alert,
      }
    },
  ),

  /** SCR-M-049 — personal rank across company, department and team. */
  myRank: endpoint<{ metric: LeaderboardMetric; period: LbPeriod }, MyRankResult, "employee">("employee", "GET", "/me/rank", ({ metric, period }, ctx) => {
    const { me, emp } = meEmployee(ctx)
    const people = population(ctx, emp.companyId)
    const company = ctx.db.companies.find((c) => c.id === emp.companyId)
    const dept = ctx.db.departments.find((d) => d.id === emp.departmentId)
    const team = ctx.db.teams.find((t) => t.id === emp.teamId)
    const scopes: { scope: LbScope; label: string; members: Employee[] }[] = [
      { scope: "company", label: company?.name ?? "Company", members: people },
      { scope: "department", label: dept?.name ?? "Department", members: people.filter((p) => p.departmentId === emp.departmentId) },
      { scope: "team", label: team?.name ?? "Team", members: people.filter((p) => p.teamId === emp.teamId) },
    ]
    const ranks = scopes.map(({ scope, label, members }) => {
      const entries = rankPeople(ctx, members, emp, metric, period, scope)
      const mine = entries.find((e) => e.isMe)!
      const next = entries.find((e) => e.rank === mine.rank - 1)
      return {
        scope,
        label,
        rank: mine.rank,
        total: entries.length,
        nextRank: next ? next.rank : null,
        gapToNext: next ? Math.max(1, next.value - mine.value) : null,
        change: (mine.previousRank ?? mine.rank) - mine.rank,
        topPercent: Math.max(1, Math.round((mine.rank / entries.length) * 100)),
      }
    })
    const companyRank = ranks[0]!
    const trend = Array.from({ length: 6 }, (_, i) => {
      const weeksAgo = 5 - i
      const wobble = weeksAgo === 0 ? 0 : Math.round((noise(`myrank:${emp.id}:${metric}`, weeksAgo) - 0.45) * Math.max(4, companyRank.rank * 0.5) * (weeksAgo / 5 + 0.3))
      return { label: weeksAgo === 0 ? "This wk" : `${weeksAgo} wk ago`, rank: Math.min(companyRank.total, Math.max(1, companyRank.rank + wobble)) }
    })
    return { metric, period, unit: LB_METRIC_UNIT[metric], myValue: myValue(ctx, metric, period), optedOut: me.leaderboardOptOut, ranks, trend }
  }),
}
