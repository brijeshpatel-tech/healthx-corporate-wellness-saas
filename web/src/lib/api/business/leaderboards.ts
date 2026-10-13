/**
 * Business Portal — leaderboards (SCR-B-016). Same rankings as the Employee App, under the company's
 * name-display setting; employees who opted out appear as anonymous. Group rankings hide groups
 * smaller than the minimum analytics group size.
 */
import type { BusinessSession } from "@/lib/auth/session"
import type { Challenge, Employee, LeaderboardEntry, LeaderboardMetric, LeaderboardNameDisplay, LeaderboardScope } from "@/lib/types"
import { CHALLENGE_METRIC_UNIT } from "@/lib/types"
import { AVATAR_COLORS, hash, noise } from "@/lib/mock/series"
import { endpoint, forbidden, notFound } from "../core"
import { audienceMembers, challengeSettings, describeScoring, scoreOf } from "./challenges"
import { companyEmployees, companySettings, isJoined, type BusinessCtx } from "./common"

export type LeaderboardPeriodOption = "today" | "week" | "month" | "challenge"
type Period = "today" | "week" | "month"

/** How names and departments appear (company setting, or a stricter choice for a public board). */
export interface BoardView {
  nameDisplay: LeaderboardNameDisplay
  showDepartments: boolean
}

const PRIVACY_ORDER: LeaderboardNameDisplay[] = ["full_name", "first_name_initial", "anonymous"]
/** The more private of two name-display modes. */
export const stricterName = (a: LeaderboardNameDisplay, b: LeaderboardNameDisplay) => (PRIVACY_ORDER.indexOf(a) >= PRIVACY_ORDER.indexOf(b) ? a : b)

export interface LeaderboardQuery {
  scope: LeaderboardScope
  metric: LeaderboardMetric
  period: LeaderboardPeriodOption
  /** Department scope: rank people inside this department (omit to compare departments). */
  departmentId?: string
  /** Team scope: rank people inside this team (omit to compare teams). */
  teamId?: string
  challengeId?: string
  limit?: number
}

export type LeaderboardRow = LeaderboardEntry & { hiddenReason?: string; highlight?: boolean; completed?: boolean; progress?: number }

export interface LeaderboardResult {
  kind: "people" | "groups"
  title: string
  /** Unit label for values, e.g. "steps", "points", "workouts", "active days". */
  unit: string
  valueKind: "steps" | "points" | "count" | "metric"
  challengeMetric?: Challenge["metric"]
  challengeCustomLabel?: string
  entries: LeaderboardRow[]
  total: number
  nameDisplay: LeaderboardNameDisplay
  allowOptOut: boolean
  optedOut: number
  minGroupSize: number
  hiddenGroups: number
  periodLabel: string
  /** Team Managers: where their team stands among all teams on this metric/period. */
  myTeams?: { id: string; name: string; rank: number | null; of: number; value: number | null; members: number }[]
}

export interface LeaderboardOptions {
  role: BusinessSession["role"]
  departments: { id: string; name: string }[]
  teams: { id: string; name: string; departmentId: string; departmentName: string }[]
  challenges: { id: string; name: string; coverEmoji: string; status: Challenge["status"]; type: Challenge["type"]; endDate: string }[]
  nameDisplay: LeaderboardNameDisplay
}

const METRIC_UNIT: Record<LeaderboardMetric, string> = { steps: "steps", points: "points", workouts: "workouts", active_days: "active days" }

function metricValue(e: Employee, metric: LeaderboardMetric, period: Period, previous = false) {
  const s = e.stats
  const n = (i: number) => noise(`lb:${e.id}:${metric}`, i)
  let v: number
  if (period === "today") {
    if (metric === "steps") v = s.stepsToday
    else if (metric === "points") v = Math.round(Math.min(150, s.stepsToday / 100) + (n(2) < s.workoutsMonth / 30 ? 50 : 0))
    else if (metric === "workouts") v = n(2) < s.workoutsMonth / 30 ? 1 : 0
    else v = s.stepsToday >= 1000 ? 1 : 0
  } else if (metric === "steps") v = period === "week" ? s.stepsWeek : s.stepsMonth
  else if (metric === "points") v = period === "week" ? Math.round(s.pointsMonth * (0.18 + n(0) * 0.12)) : s.pointsMonth
  else if (metric === "workouts") v = period === "week" ? Math.min(s.workoutsMonth, Math.round(s.workoutsMonth * (0.15 + n(0) * 0.2))) : s.workoutsMonth
  else v = period === "week" ? Math.min(7, Math.round((s.activeDaysMonth * 7) / 30 + (n(0) - 0.4) * 2)) : s.activeDaysMonth
  if (!previous) return Math.max(0, v)
  // Value at the same point of the previous period (for movement arrows).
  return Math.max(0, Math.round(v * (0.9 + n(1) * 0.2)))
}

function displayFor(ctx: BusinessCtx, e: Employee, mode: LeaderboardNameDisplay) {
  const settings = companySettings(ctx)
  const optedOut = settings.allowLeaderboardOptOut && !!ctx.db.private[e.id]?.leaderboardOptOut
  const m = optedOut ? "anonymous" : mode
  return {
    optedOut,
    name: m === "full_name" ? `${e.firstName} ${e.lastName}` : m === "first_name_initial" ? `${e.firstName} ${e.lastName[0]}.` : "Anonymous colleague",
    color: m === "anonymous" ? "#94a3b8" : e.avatarColor,
    anonymous: m === "anonymous",
  }
}

function rankBy<T>(items: T[], value: (t: T) => number) {
  const sorted = [...items].sort((a, b) => value(b) - value(a))
  return new Map(sorted.map((t, i) => [t, i + 1]))
}

function peopleBoard(ctx: BusinessCtx, people: Employee[], metric: LeaderboardMetric, period: Period, limit: number, meId: string, view: BoardView) {
  const ranked = people.filter(isJoined).filter((e) => metricValue(e, metric, period) > 0)
  const current = [...ranked].sort((a, b) => metricValue(b, metric, period) - metricValue(a, metric, period))
  const prev = rankBy(ranked, (e) => metricValue(e, metric, period, true))
  const depts = new Map(ctx.db.departments.map((d) => [d.id, d.name]))
  let optedOut = 0
  const entries: LeaderboardRow[] = current.map((e, i) => {
    const d = displayFor(ctx, e, view.nameDisplay)
    if (d.optedOut) optedOut++
    return { rank: i + 1, previousRank: prev.get(e), id: e.id, name: d.name, subtitle: d.anonymous || !view.showDepartments ? undefined : depts.get(e.departmentId), avatarColor: d.color, value: metricValue(e, metric, period), isMe: e.id === meId }
  })
  return { entries: entries.slice(0, limit), total: entries.length, optedOut }
}

function groupBoard(
  ctx: BusinessCtx,
  groups: { id: string; name: string }[],
  members: (groupId: string) => Employee[],
  metric: LeaderboardMetric,
  period: Period,
  highlight: Set<string>,
) {
  const min = companySettings(ctx).minAnalyticsGroupSize
  const rows = groups.map((g, i) => {
    const m = members(g.id).filter(isJoined)
    const avg = (prev: boolean) => (m.length ? m.reduce((a, e) => a + metricValue(e, metric, period, prev), 0) / m.length : 0)
    return { g, i, size: m.length, value: avg(false), previous: avg(true), hidden: m.length < min }
  })
  const visible = rows.filter((r) => !r.hidden && r.size > 0)
  const cur = rankBy(visible, (r) => r.value)
  const prev = rankBy(visible, (r) => r.previous)
  const entries: LeaderboardRow[] = [...visible]
    .sort((a, b) => b.value - a.value)
    .map((r) => ({
      rank: cur.get(r)!,
      previousRank: prev.get(r),
      id: r.g.id,
      name: r.g.name,
      subtitle: `${r.size} ${r.size === 1 ? "member" : "members"} · average per person`,
      avatarColor: AVATAR_COLORS[hash(r.g.id) % AVATAR_COLORS.length]!,
      value: Math.round(r.value * 10) / 10,
      memberCount: r.size,
      highlight: highlight.has(r.g.id),
    }))
  return { entries, hiddenGroups: rows.filter((r) => r.hidden && r.size > 0).length, all: entries }
}

function challengeBoard(ctx: BusinessCtx, c: Challenge, scope: Set<string> | null, limit: number, meId: string, view: BoardView) {
  const rule = challengeSettings(ctx, c.id).scoring
  const parts = ctx.db.participants.filter((p) => p.challengeId === c.id && (!scope || scope.has(p.employeeId)))
  const byId = new Map(ctx.db.employees.map((e) => [e.id, e]))
  const depts = new Map(ctx.db.departments.map((d) => [d.id, d.name]))
  const score = new Map(parts.map((p) => [p, scoreOf(p, rule)]))
  const sorted = [...parts].sort((a, b) => score.get(b)! - score.get(a)!)
  const prev = rankBy(parts, (p) => scoreOf({ progress: p.progress - (p.daily.at(-1) ?? 0), daily: p.daily.slice(0, -1) }, rule))
  let optedOut = 0
  const entries: LeaderboardRow[] = sorted.map((p, i) => {
    const e = byId.get(p.employeeId)
    const d = e ? displayFor(ctx, e, view.nameDisplay) : { name: "Former employee", color: "#94a3b8", anonymous: true, optedOut: false }
    if (d.optedOut) optedOut++
    return {
      rank: i + 1,
      previousRank: prev.get(p),
      id: p.id,
      name: d.name,
      subtitle: d.anonymous || !e || !view.showDepartments ? undefined : depts.get(e.departmentId),
      avatarColor: d.color,
      value: Math.round(score.get(p)! * 100) / 100,
      isMe: p.employeeId === meId,
      completed: p.completed,
      progress: c.type === "collaborative" || c.target <= 0 ? undefined : Math.min(1, p.progress / c.target),
    }
  })
  return { entries: entries.slice(0, limit), total: entries.length, optedOut }
}

export const leaderboardsApi = {
  /** Pickers for the leaderboard filters (scoped for Team Managers). */
  options: endpoint<void, LeaderboardOptions, "business">("business", "GET", "/organization/leaderboards/options", (_i, ctx) => {
    const session = ctx.session() as BusinessSession
    const companyId = ctx.companyId()
    const isTm = session.role === "team_manager"
    const myTeamMembers = new Set(companyEmployees(ctx).filter((e) => session.teamIds.includes(e.teamId)).map((e) => e.id))
    const departments = ctx.db.departments.filter((d) => d.companyId === companyId)
    return {
      role: session.role,
      departments: isTm ? [] : departments.map((d) => ({ id: d.id, name: d.name })),
      teams: ctx.db.teams
        .filter((t) => t.companyId === companyId && (!isTm || session.teamIds.includes(t.id)))
        .map((t) => ({ id: t.id, name: t.name, departmentId: t.departmentId, departmentName: departments.find((d) => d.id === t.departmentId)?.name ?? "" })),
      challenges: ctx.db.challenges
        .filter((c) => c.companyId === companyId && (c.status === "active" || c.status === "completed"))
        .filter((c) => !isTm || audienceMembers(ctx, c).some((e) => myTeamMembers.has(e.id)))
        .sort((a, b) => (a.status === b.status ? b.endDate.localeCompare(a.endDate) : a.status === "active" ? -1 : 1))
        .map((c) => ({ id: c.id, name: c.name, coverEmoji: c.coverEmoji, status: c.status, type: c.type, endDate: c.endDate })),
      nameDisplay: companySettings(ctx).leaderboardNameDisplay,
    }
  }),

  get: endpoint<LeaderboardQuery, LeaderboardResult, "business">("business", "GET", "/organization/leaderboards", (q, ctx) => computeLeaderboard(ctx, q)),
}

/**
 * Rankings for a query. Shared by the portal and public TV boards (which pass a stricter `view`).
 * Uses `ctx.session()` for role scoping and "isMe".
 */
export function computeLeaderboard(ctx: BusinessCtx, q: LeaderboardQuery, viewOverride?: Partial<BoardView>): LeaderboardResult {
  const session = ctx.session() as BusinessSession
  const settings = companySettings(ctx)
  const view: BoardView = {
    nameDisplay: viewOverride?.nameDisplay ? stricterName(viewOverride.nameDisplay, settings.leaderboardNameDisplay) : settings.leaderboardNameDisplay,
    showDepartments: viewOverride?.showDepartments ?? true,
  }
  const isTm = session.role === "team_manager"
  const limit = Math.min(100, q.limit ?? 50)
  const period: Period = q.period === "week" ? "week" : q.period === "today" ? "today" : "month"
  const periodLabel = period === "week" ? "This week" : period === "today" ? "Today" : "Last 30 days"
  const all = companyEmployees(ctx)
  const companyId = ctx.companyId()
  const base = {
    unit: METRIC_UNIT[q.metric],
    valueKind: (q.metric === "steps" ? "steps" : q.metric === "points" ? "points" : "count") as LeaderboardResult["valueKind"],
    nameDisplay: view.nameDisplay,
    allowOptOut: settings.allowLeaderboardOptOut,
    minGroupSize: settings.minAnalyticsGroupSize,
    periodLabel,
    hiddenGroups: 0,
    optedOut: 0,
  }
  const teams = ctx.db.teams.filter((t) => t.companyId === companyId)

  // Team Managers only see their own teams' people (and their teams' position among all teams).
  if (isTm && (q.scope === "company" || q.scope === "department")) throw forbidden("Team Managers can view their team's leaderboard only.")
  const myTeams = isTm
    ? (() => {
        const board = groupBoard(ctx, teams, (id) => all.filter((e) => e.teamId === id), q.metric, period, new Set(session.teamIds))
        return teams
          .filter((t) => session.teamIds.includes(t.id))
          .map((t) => {
            const row = board.all.find((r) => r.id === t.id)
            return { id: t.id, name: t.name, rank: row?.rank ?? null, of: board.all.length, value: row?.value ?? null, members: all.filter((e) => e.teamId === t.id && isJoined(e)).length }
          })
      })()
    : undefined

  if (q.scope === "challenge") {
    const c = ctx.db.challenges.find((x) => x.id === q.challengeId && x.companyId === companyId)
    if (!c) throw notFound("Challenge")
    const scope = isTm ? new Set(all.filter((e) => session.teamIds.includes(e.teamId)).map((e) => e.id)) : null
    if (scope && !audienceMembers(ctx, c).some((e) => scope.has(e.id))) throw forbidden("This challenge isn't open to your team.")
    const rule = challengeSettings(ctx, c.id).scoring
    const unit = rule.method === "bands" ? "pts" : c.metric === "custom" ? c.customMetricLabel ?? "check-ins" : CHALLENGE_METRIC_UNIT[c.metric]
    if (c.type === "team" && !isTm) {
      const unitKey = c.teamUnit === "team" ? "teamId" : "departmentId"
      const groups = c.teamUnit === "team" ? teams : ctx.db.departments.filter((d) => d.companyId === companyId)
      const byId = new Map(all.map((e) => [e.id, e]))
      const parts = ctx.db.participants.filter((p) => p.challengeId === c.id)
      const rows = groups
        .map((g) => {
          const gp = parts.filter((p) => byId.get(p.employeeId)?.[unitKey] === g.id)
          const total = gp.reduce((a, p) => a + p.progress, 0)
          const prevTotal = gp.reduce((a, p) => a + p.progress - (p.daily.at(-1) ?? 0), 0)
          return { g, n: gp.length, avg: gp.length ? total / gp.length : 0, prev: gp.length ? prevTotal / gp.length : 0 }
        })
        .filter((r) => r.n > 0)
      const visible = rows.filter((r) => r.n >= settings.minAnalyticsGroupSize)
      const prev = rankBy(visible, (r) => r.prev)
      const entries: LeaderboardRow[] = [...visible]
        .sort((a, b) => b.avg - a.avg)
        .map((r, i) => ({
          rank: i + 1,
          previousRank: prev.get(r),
          id: r.g.id,
          name: r.g.name,
          subtitle: `${r.n} participants · average per person`,
          avatarColor: AVATAR_COLORS[hash(r.g.id) % AVATAR_COLORS.length]!,
          value: Math.round(r.avg),
          memberCount: r.n,
        }))
      return { ...base, kind: "groups", title: `${c.name} — ${c.teamUnit === "team" ? "team" : "department"} standings`, unit, valueKind: "metric", challengeMetric: c.metric, challengeCustomLabel: c.customMetricLabel, entries, total: entries.length, hiddenGroups: rows.length - visible.length, periodLabel: "Whole challenge", myTeams }
    }
    const board = challengeBoard(ctx, c, scope, limit, session.user.id, view)
    return {
      ...base,
      kind: "people",
      title: c.name,
      unit,
      valueKind: rule.method === "bands" ? "points" : "metric",
      challengeMetric: c.metric,
      challengeCustomLabel: c.customMetricLabel,
      ...board,
      periodLabel: rule.method === "total" ? "Whole challenge" : `Whole challenge · ${describeScoring(rule, unit).toLowerCase()}`,
      myTeams,
    }
  }

  if (q.scope === "company") {
    const board = peopleBoard(ctx, all, q.metric, period, limit, session.user.id, view)
    return { ...base, kind: "people", title: "Whole company", ...board }
  }

  if (q.scope === "department") {
    const departments = ctx.db.departments.filter((d) => d.companyId === companyId)
    if (q.departmentId) {
      const d = departments.find((x) => x.id === q.departmentId)
      if (!d) throw notFound("Department")
      const board = peopleBoard(ctx, all.filter((e) => e.departmentId === d.id), q.metric, period, limit, session.user.id, view)
      return { ...base, kind: "people", title: d.name, ...board }
    }
    const board = groupBoard(ctx, departments, (id) => all.filter((e) => e.departmentId === id), q.metric, period, new Set())
    return { ...base, kind: "groups", title: "Departments", entries: board.entries, total: board.entries.length, hiddenGroups: board.hiddenGroups }
  }

  // Team scope
  if (q.teamId) {
    const t = teams.find((x) => x.id === q.teamId)
    if (!t) throw notFound("Team")
    if (isTm && !session.teamIds.includes(t.id)) throw forbidden("You can only view your own team.")
    const board = peopleBoard(ctx, all.filter((e) => e.teamId === t.id), q.metric, period, limit, session.user.id, view)
    return { ...base, kind: "people", title: t.name, ...board, myTeams }
  }
  const board = groupBoard(ctx, teams, (id) => all.filter((e) => e.teamId === id), q.metric, period, new Set(isTm ? session.teamIds : []))
  return { ...base, kind: "groups", title: "Teams", entries: board.entries, total: board.entries.length, hiddenGroups: board.hiddenGroups, myTeams }
}
