/**
 * Business Portal — analytics & reporting (MOD-20). Aggregated figures only:
 * SCR-B-023 Adoption, SCR-B-024 Departments, SCR-B-025 Challenges (MVP),
 * SCR-B-026 Engagement, SCR-B-027 Wellness participation, SCR-B-028 Trends, SCR-B-029 Monthly report (Phase 2).
 * Groups smaller than the company's minimum group size are suppressed (returned as null).
 */
import type { BusinessSession } from "@/lib/auth/session"
import type { Challenge, ChallengeMetric, ChallengeType, Employee } from "@/lib/types"
import { CHALLENGE_METRIC_UNIT } from "@/lib/types"
import { dailySeries, DAY_MS, noise, toLocalDate } from "@/lib/mock/series"
import { audit, badRequest, endpoint, forbidden, notFound } from "../core"
import { companyEmployees, companySettings, isJoined, ratio, requireRole, type BusinessCtx } from "./common"
import { lowParticipationThreshold } from "./settings"

export type AnalyticsRange = "7d" | "30d" | "90d" | "180d" | "365d"
export const RANGE_DAYS: Record<AnalyticsRange, number> = { "7d": 7, "30d": 30, "90d": 90, "180d": 180, "365d": 365 }
export const RANGE_LABEL: Record<AnalyticsRange, string> = { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", "180d": "Last 6 months", "365d": "Last 12 months" }

export type AnalyticsTab = "adoption" | "departments" | "challenges" | "engagement" | "participation" | "trends"

export interface AnalyticsQuery {
  range: AnalyticsRange
  departmentId?: string
  teamId?: string
}

interface ScopeBase {
  scopeLabel: string
  suppressed: boolean
  minGroupSize: number
  groupSize: number
}

export interface AdoptionData extends ScopeBase {
  funnel: { invited: number; registered: number; active: number; inactive: number; pending: number; deactivated: number }
  rates: { registration: number; activation: number; inactive: number }
  newRegistrations: number
  trend: { date: string; registered: number; active: number }[]
  byDepartment: { id: string; name: string; employees: number; pending: number; registered: number; active: number; registrationRate: number | null; activationRate: number | null }[]
}

export interface DepartmentAnalyticsRow {
  id: string
  name: string
  employees: number
  joined: number
  active: number
  participation: number | null
  avgSteps: number | null
  challengeParticipation: number | null
  pointsPerActive: number | null
  trend: number[] | null
  low: boolean
  suppressed: boolean
}

export interface DepartmentAnalytics extends ScopeBase {
  threshold: number
  companyParticipation: number
  rows: DepartmentAnalyticsRow[]
}

export interface ChallengeAnalyticsRow {
  id: string
  name: string
  coverEmoji: string
  coverColor: string
  type: ChallengeType
  metric: ChallengeMetric
  unit: string
  status: Challenge["status"]
  startDate: string
  endDate: string
  eligible: number
  participants: number
  participationRate: number
  completionRate: number | null
  avgProgress: number | null
  avgValue: number | null
  topUnit?: { name: string; value: number }
}

export interface ChallengeAnalytics extends ScopeBase {
  totals: { challenges: number; participants: number; avgParticipation: number; avgCompletion: number }
  rows: ChallengeAnalyticsRow[]
  daily: { date: string; participants: number }[]
  byType: { type: ChallengeType; challenges: number; participants: number }[]
}

export interface EngagementData extends ScopeBase {
  current: { dau: number; wau: number; mau: number; stickiness: number; sessionsPerUserWeek: number; avgSessionMinutes: number }
  previous: { dau: number; wau: number; mau: number; stickiness: number; sessionsPerUserWeek: number; avgSessionMinutes: number }
  series: { date: string; dau: number; wau: number; mau: number }[]
  sessionsByWeekday: { day: string; sessions: number }[]
  featureUsage: { feature: string; users: number; share: number }[]
}

export interface ParticipationRow {
  id: string
  name: string
  employees: number
  avgSteps: number | null
  workout: number | null
  hydration: number | null
  sleep: number | null
  habit: number | null
}

export interface WellnessParticipation extends ScopeBase {
  optedOut: number
  groupedBy: "department" | "team"
  tiles: Record<"avgSteps" | "workout" | "hydration" | "sleep" | "habit", { value: number | null; previous: number | null }>
  trend: { date: string; workout: number; hydration: number; sleep: number; habit: number }[]
  rows: ParticipationRow[]
}

export type Granularity = "week" | "month"

export interface TrendPoint {
  period: string
  participation: number
  avgSteps: number
  challengeParticipation: number
  wellnessScore: number
  wau: number
  redemptions: number
  monthlyActive: number
}

export interface TrendsData extends ScopeBase {
  granularity: Granularity
  tooShort: boolean
  points: TrendPoint[]
}

// ─── Scope & helpers ────────────────────────────────────────────────────

const ADMIN: BusinessSession["role"][] = ["company_owner", "hr_admin"]
const ANALYTICS: BusinessSession["role"][] = ["company_owner", "hr_admin", "wellness_manager"]

/** Wellness Managers see challenge and wellness-participation analytics only. */
export const TAB_ROLES: Record<AnalyticsTab, BusinessSession["role"][]> = {
  adoption: ADMIN,
  departments: ADMIN,
  challenges: ANALYTICS,
  engagement: ADMIN,
  participation: ANALYTICS,
  trends: ADMIN,
}

interface Scope {
  all: Employee[]
  employees: Employee[]
  joined: Employee[]
  active: Employee[]
  label: string
  key: string
  days: number
  min: number
  suppressed: boolean
}

function scope(ctx: BusinessCtx, q: AnalyticsQuery): Scope {
  const companyId = ctx.companyId()
  const all = companyEmployees(ctx)
  let employees = all
  if (q.departmentId) employees = employees.filter((e) => e.departmentId === q.departmentId)
  if (q.teamId) employees = employees.filter((e) => e.teamId === q.teamId)
  const min = companySettings(ctx).minAnalyticsGroupSize
  const label = q.teamId
    ? ctx.db.teams.find((t) => t.id === q.teamId)?.name ?? "Team"
    : q.departmentId
      ? ctx.db.departments.find((d) => d.id === q.departmentId)?.name ?? "Department"
      : "Whole company"
  const days = RANGE_DAYS[q.range] ?? 30
  return {
    all,
    employees,
    joined: employees.filter(isJoined),
    // Client decision #6: active = a wellness activity or sign-in within the selected period.
    active: employees.filter((e) => isActiveWithin(e, days)),
    label,
    key: `${companyId}:${q.departmentId ?? ""}:${q.teamId ?? ""}`,
    days,
    min,
    suppressed: employees.length < min,
  }
}

/** Activity or sign-in within the last `days` days (eligible = joined employees). */
export const isActiveWithin = (e: Employee, days: number) => isJoined(e) && !!e.lastActiveAt && Date.now() - new Date(e.lastActiveAt).getTime() <= days * DAY_MS

const base = (s: Scope): ScopeBase => ({ scopeLabel: s.label, suppressed: s.suppressed, minGroupSize: s.min, groupSize: s.employees.length })

/** Average daily points into weekly buckets for long ranges (keeps charts readable). */
function bucket<T extends { date: string }>(points: T[], days: number, keys: (keyof T)[]): T[] {
  if (days <= 90) return points
  const out: T[] = []
  for (let i = 0; i < points.length; i += 7) {
    const chunk = points.slice(i, i + 7)
    const row = { ...chunk[0]! }
    for (const k of keys) (row as Record<string, unknown>)[k as string] = Math.round(chunk.reduce((a, p) => a + Number(p[k]), 0) / chunk.length)
    out.push(row)
  }
  return out
}

const between = (n: number, lo: number, hi: number) => lo + n * (hi - lo)
const avgStepsOf = (list: Employee[]) => (list.length ? Math.round(list.reduce((a, e) => a + e.stats.stepsMonth, 0) / list.length / 30) : 0)

function eligibleFor(c: Challenge, e: Employee) {
  if (c.audienceType === "departments") return c.audienceIds.includes(e.departmentId)
  if (c.audienceType === "teams") return c.audienceIds.includes(e.teamId)
  if (c.audienceType === "selected") return c.audienceIds.includes(e.id)
  return true
}

/** Deterministic per-group wellness rates (hydration / sleep / habit are not tracked per person for admins). */
function wellnessRates(key: string, active: Employee[], joined: Employee[]) {
  return {
    workout: ratio(active.filter((e) => e.stats.workoutsMonth > 0).length, joined.length),
    hydration: between(noise(`${key}:hyd`, 1), 0.46, 0.72) * ratio(active.length, joined.length || 1) + 0.1,
    sleep: between(noise(`${key}:slp`, 1), 0.22, 0.42),
    habit: between(noise(`${key}:hab`, 1), 0.52, 0.81),
  }
}

// ─── Builders (also used by CSV export) ─────────────────────────────────

function adoption(ctx: BusinessCtx, q: AnalyticsQuery): AdoptionData {
  const s = scope(ctx, q)
  const companyId = ctx.companyId()
  const deactivated = ctx.db.employees.filter((e) => e.companyId === companyId && e.status === "deactivated" && (!q.departmentId || e.departmentId === q.departmentId) && (!q.teamId || e.teamId === q.teamId)).length
  const pending = s.employees.filter((e) => e.status === "invited").length
  const inactive = s.employees.filter((e) => e.status === "inactive").length
  const since = Date.now() - s.days * DAY_MS
  const activeSeries = dailySeries(`${s.key}:adopt-active`, s.days, { base: s.active.length * 0.82, variance: 0.07, trend: 0.06, weekendDip: 0.3 })
  const daily = activeSeries.map((p) => {
    const end = new Date(`${p.date}T23:59:59`).getTime()
    const registered = s.employees.filter((e) => e.joinedAt && new Date(e.joinedAt).getTime() <= end).length
    return { date: p.date, registered, active: Math.min(registered, Math.round(p.value)) }
  })
  const departments = ctx.db.departments.filter((d) => d.companyId === companyId && (!q.departmentId || d.id === q.departmentId))
  return {
    ...base(s),
    funnel: { invited: s.employees.length, registered: s.joined.length, active: s.active.length, inactive, pending, deactivated },
    rates: { registration: ratio(s.joined.length, s.employees.length), activation: ratio(s.active.length, s.joined.length), inactive: ratio(inactive, s.joined.length) },
    newRegistrations: s.employees.filter((e) => e.joinedAt && new Date(e.joinedAt).getTime() >= since).length,
    trend: bucket(daily, s.days, ["registered", "active"]),
    byDepartment: departments
      .map((d) => {
        const m = s.employees.filter((e) => e.departmentId === d.id)
        const j = m.filter(isJoined)
        const a = m.filter((e) => isActiveWithin(e, s.days))
        const hide = m.length < s.min
        return {
          id: d.id,
          name: d.name,
          employees: m.length,
          pending: m.filter((e) => e.status === "invited").length,
          registered: j.length,
          active: a.length,
          registrationRate: hide ? null : ratio(j.length, m.length),
          activationRate: hide ? null : ratio(a.length, j.length),
        }
      })
      .filter((d) => d.employees > 0)
      .sort((a, b) => b.employees - a.employees),
  }
}

function departmentsData(ctx: BusinessCtx, q: AnalyticsQuery & { threshold?: number }): DepartmentAnalytics {
  const s = scope(ctx, { ...q, departmentId: undefined, teamId: undefined })
  const threshold = q.threshold ?? lowParticipationThreshold(ctx)
  const companyId = ctx.companyId()
  const activeChallengeIds = new Set(ctx.db.challenges.filter((c) => c.companyId === companyId && (c.status === "active" || c.status === "completed")).map((c) => c.id))
  const rows = ctx.db.departments
    .filter((d) => d.companyId === companyId)
    .map((d): DepartmentAnalyticsRow => {
      const m = s.employees.filter((e) => e.departmentId === d.id)
      const j = m.filter(isJoined)
      const a = m.filter((e) => isActiveWithin(e, s.days))
      const hide = m.length < s.min
      const participation = ratio(a.length, j.length)
      const inChallenge = j.filter((e) => ctx.db.participants.some((p) => p.employeeId === e.id && activeChallengeIds.has(p.challengeId))).length
      return {
        id: d.id,
        name: d.name,
        employees: m.length,
        joined: j.length,
        active: a.length,
        participation: hide ? null : participation,
        avgSteps: hide ? null : avgStepsOf(a),
        challengeParticipation: hide ? null : ratio(inChallenge, j.length),
        pointsPerActive: hide ? null : Math.round(a.reduce((x, e) => x + e.stats.pointsMonth, 0) / Math.max(1, a.length) * (s.days / 30)),
        trend: hide ? null : dailySeries(`${companyId}:dept:${d.id}:${q.range}`, 12, { base: participation * 100, variance: 0.06, trend: 0.04, max: 100 }).map((p) => p.value),
        low: !hide && participation < threshold,
        suppressed: hide,
      }
    })
    .filter((r) => r.employees > 0)
    .sort((a, b) => (b.participation ?? -1) - (a.participation ?? -1))
  return { ...base(s), threshold, companyParticipation: ratio(s.active.length, s.joined.length), rows }
}

function challengesData(ctx: BusinessCtx, q: AnalyticsQuery & { type?: ChallengeType }): ChallengeAnalytics {
  const s = scope(ctx, q)
  const companyId = ctx.companyId()
  const today = toLocalDate(new Date())
  const from = toLocalDate(new Date(Date.now() - s.days * DAY_MS))
  const ids = new Set(s.employees.map((e) => e.id))
  const list = ctx.db.challenges
    .filter((c) => c.companyId === companyId && (c.status === "active" || c.status === "completed") && c.startDate <= today && c.endDate >= from && (!q.type || c.type === q.type))
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
  const rows: ChallengeAnalyticsRow[] = list.map((c) => {
    const eligible = s.joined.filter((e) => eligibleFor(c, e)).length
    const parts = ctx.db.participants.filter((p) => p.challengeId === c.id && ids.has(p.employeeId))
    const hide = parts.length < s.min
    let topUnit: ChallengeAnalyticsRow["topUnit"]
    if (c.type === "team" && !hide) {
      const groups = new Map<string, number>()
      for (const p of parts) {
        const e = s.employees.find((x) => x.id === p.employeeId)
        if (!e) continue
        const key = c.teamUnit === "team" ? e.teamId : e.departmentId
        groups.set(key, (groups.get(key) ?? 0) + p.progress)
      }
      const best = [...groups.entries()].sort((a, b) => b[1] - a[1])[0]
      if (best) topUnit = { name: (c.teamUnit === "team" ? ctx.db.teams.find((t) => t.id === best[0])?.name : ctx.db.departments.find((d) => d.id === best[0])?.name) ?? "—", value: Math.round(best[1]) }
    }
    const avgProgress = c.type === "collaborative" ? ratio(parts.reduce((a, p) => a + p.progress, 0), c.target) : ratio(parts.reduce((a, p) => a + Math.min(1, p.progress / c.target), 0), parts.length)
    return {
      id: c.id,
      name: c.name,
      coverEmoji: c.coverEmoji,
      coverColor: c.coverColor,
      type: c.type,
      metric: c.metric,
      unit: c.metric === "custom" ? c.customMetricLabel ?? CHALLENGE_METRIC_UNIT.custom : CHALLENGE_METRIC_UNIT[c.metric],
      status: c.status,
      startDate: c.startDate,
      endDate: c.endDate,
      eligible,
      participants: parts.length,
      participationRate: ratio(parts.length, eligible),
      completionRate: hide ? null : ratio(parts.filter((p) => p.completed).length, parts.length),
      avgProgress: hide ? null : Math.min(1, avgProgress),
      avgValue: hide ? null : Math.round(parts.reduce((a, p) => a + p.progress, 0) / Math.max(1, parts.length)),
      topUnit,
    }
  })
  const visible = rows.filter((r) => r.completionRate !== null)
  const totalParticipants = new Set(ctx.db.participants.filter((p) => list.some((c) => c.id === p.challengeId) && ids.has(p.employeeId)).map((p) => p.employeeId)).size
  const daily = dailySeries(`${s.key}:chl-daily:${q.type ?? ""}`, s.days, { base: Math.max(0, totalParticipants * 0.62), variance: 0.1, weekendDip: 0.25, trend: 0.05, max: totalParticipants }).map((p) => ({ date: p.date, participants: Math.round(p.value) }))
  const types = [...new Set(list.map((c) => c.type))]
  return {
    ...base(s),
    totals: {
      challenges: rows.length,
      participants: totalParticipants,
      avgParticipation: ratio(rows.reduce((a, r) => a + r.participationRate, 0), rows.length),
      avgCompletion: ratio(visible.reduce((a, r) => a + (r.completionRate ?? 0), 0), visible.length),
    },
    rows,
    daily: bucket(daily, s.days, ["participants"]),
    byType: types.map((t) => ({ type: t, challenges: rows.filter((r) => r.type === t).length, participants: rows.filter((r) => r.type === t).reduce((a, r) => a + r.participants, 0) })),
  }
}

function engagementData(ctx: BusinessCtx, q: AnalyticsQuery): EngagementData {
  const s = scope(ctx, q)
  const mauBase = s.employees.filter((e) => (e.status === "active" || e.status === "registered") && e.stats.activeDaysMonth > 0).length
  const window = Math.max(s.days, 30)
  const dauSeries = dailySeries(`${s.key}:dau`, window * 2, { base: s.active.length * 0.58, variance: 0.1, weekendDip: 0.38, trend: 0.08, max: s.joined.length })
  const wauSeries = dailySeries(`${s.key}:wau`, window * 2, { base: s.active.length * 0.86, variance: 0.04, trend: 0.06, max: s.joined.length })
  const mauSeries = dailySeries(`${s.key}:mau`, window * 2, { base: mauBase * 0.97, variance: 0.02, trend: 0.05, max: s.joined.length })
  const series = dauSeries.map((p, i) => ({ date: p.date, dau: Math.round(p.value), wau: Math.round(wauSeries[i]!.value), mau: Math.round(mauSeries[i]!.value) }))
  const cur = series.slice(-s.days)
  const prev = series.slice(-2 * s.days, -s.days)
  const summarise = (list: typeof series, k: string) => {
    const avg = (key: "dau" | "wau" | "mau") => Math.round(list.reduce((a, p) => a + p[key], 0) / Math.max(1, list.length))
    const dau = avg("dau")
    const mau = Math.max(1, avg("mau"))
    return {
      dau,
      wau: avg("wau"),
      mau,
      stickiness: ratio(dau, mau),
      sessionsPerUserWeek: Number(between(noise(`${s.key}:spu:${k}`, 1), 4.1, 6.4).toFixed(1)),
      avgSessionMinutes: Number(between(noise(`${s.key}:asm:${k}`, 1), 3.2, 5.6).toFixed(1)),
    }
  }
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const sessionsTotal = s.active.length * 5.2
  const weekdayWeights = [1.18, 1.12, 1.1, 1.05, 0.98, 0.72, 0.66]
  const features = [
    ["Activity & steps", 0.94],
    ["Challenges", 0.71],
    ["Water tracking", 0.58],
    ["Workouts", 0.46],
    ["Habits", 0.41],
    ["Rewards", 0.33],
    ["Leaderboards", 0.52],
  ] as const
  return {
    ...base(s),
    current: summarise(cur, "c"),
    previous: summarise(prev.length ? prev : cur, "p"),
    series: bucket(cur, s.days, ["dau", "wau", "mau"]),
    sessionsByWeekday: days.map((day, i) => ({ day, sessions: Math.round((sessionsTotal / 7) * weekdayWeights[i]! * (0.95 + noise(`${s.key}:wd`, i) * 0.1)) })),
    featureUsage: features
      .map(([feature, share], i) => {
        const v = Math.min(1, share * (0.92 + noise(`${s.key}:feat`, i) * 0.16))
        return { feature, users: Math.round(s.active.length * v), share: v }
      })
      .sort((a, b) => b.share - a.share),
  }
}

function participationData(ctx: BusinessCtx, q: AnalyticsQuery): WellnessParticipation {
  const s = scope(ctx, q)
  const companyId = ctx.companyId()
  const rates = wellnessRates(s.key, s.active, s.joined)
  const prevKey = `${s.key}:prev`
  const prevRates = wellnessRates(prevKey, s.active, s.joined)
  const avgSteps = avgStepsOf(s.active)
  const hide = s.suppressed
  const tile = (value: number, previous: number) => ({ value: hide ? null : value, previous: hide ? null : previous })
  const groupedBy = q.departmentId ? ("team" as const) : ("department" as const)
  const groups = groupedBy === "team" ? ctx.db.teams.filter((t) => t.companyId === companyId && t.departmentId === q.departmentId) : ctx.db.departments.filter((d) => d.companyId === companyId)
  const rows: ParticipationRow[] = groups
    .map((g) => {
      const m = s.employees.filter((e) => (groupedBy === "team" ? e.teamId === g.id : e.departmentId === g.id))
      const a = m.filter((e) => isActiveWithin(e, s.days))
      const j = m.filter(isJoined)
      const r = wellnessRates(`${companyId}:${g.id}`, a, j)
      const h = m.length < s.min
      return { id: g.id, name: g.name, employees: m.length, avgSteps: h ? null : avgStepsOf(a), workout: h ? null : r.workout, hydration: h ? null : r.hydration, sleep: h ? null : r.sleep, habit: h ? null : r.habit }
    })
    .filter((r) => r.employees > 0)
    .sort((a, b) => (b.avgSteps ?? -1) - (a.avgSteps ?? -1))
  const weeks = Math.max(4, Math.round(s.days / 7))
  const mk = (k: string, v: number) => dailySeries(`${s.key}:wp:${k}`, weeks, { base: v * 100, variance: 0.06, trend: 0.07, max: 100, round: 1 })
  const w = mk("w", rates.workout)
  const hy = mk("h", rates.hydration)
  const sl = mk("s", rates.sleep)
  const hb = mk("b", rates.habit)
  const end = Date.now()
  return {
    ...base(s),
    optedOut: Math.round(s.joined.length * between(noise(`${s.key}:opt`, 1), 0.02, 0.05)),
    groupedBy,
    tiles: {
      avgSteps: tile(avgSteps, Math.round(avgSteps * (0.93 + noise(prevKey, 9) * 0.06))),
      workout: tile(rates.workout, Math.max(0, rates.workout - 0.03 + prevRates.workout * 0.02)),
      hydration: tile(rates.hydration, prevRates.hydration * 0.96),
      sleep: tile(rates.sleep, prevRates.sleep),
      habit: tile(rates.habit, prevRates.habit * 0.98),
    },
    trend: hide
      ? []
      : w.map((p, i) => ({
          date: toLocalDate(new Date(end - (weeks - 1 - i) * 7 * DAY_MS)),
          workout: p.value,
          hydration: hy[i]!.value,
          sleep: sl[i]!.value,
          habit: hb[i]!.value,
        })),
    rows,
  }
}

function trendsData(ctx: BusinessCtx, q: AnalyticsQuery & { granularity?: Granularity }): TrendsData {
  const s = scope(ctx, q)
  const granularity = q.granularity ?? (s.days > 90 ? "month" : "week")
  const step = granularity === "week" ? 7 : 30
  const count = Math.floor(s.days / step)
  const ids = new Set(s.employees.map((e) => e.id))
  const orders = ctx.db.orders.filter((o) => o.companyId === ctx.companyId() && ids.has(o.employeeId))
  const participation = ratio(s.active.length, s.joined.length)
  const k = `${s.key}:${granularity}`
  const series = (name: string, base: number, opts: { trend?: number; variance?: number; max?: number; round?: number } = {}) =>
    dailySeries(`${k}:${name}`, count, { base, variance: opts.variance ?? 0.06, trend: opts.trend ?? 0.08, max: opts.max, round: opts.round ?? 0 })
  const part = series("part", participation * 100, { max: 100, round: 1 })
  const steps = series("steps", avgStepsOf(s.active), { trend: 0.06 })
  const chl = series("chl", 54, { max: 100, round: 1, trend: 0.12 })
  const score = series("score", 63, { max: 100, trend: 0.07 })
  const wau = series("wau", s.active.length * 0.86, { max: s.joined.length, trend: 0.09 })
  const mae = series("mae", s.active.length * 0.97, { max: s.joined.length, trend: 0.1 })
  const now = Date.now()
  const points: TrendPoint[] = Array.from({ length: count }, (_, i) => {
    const endT = now - (count - 1 - i) * step * DAY_MS
    const startT = endT - step * DAY_MS
    return {
      period: toLocalDate(new Date(startT + DAY_MS)),
      participation: part[i]!.value / 100,
      avgSteps: steps[i]!.value,
      challengeParticipation: chl[i]!.value / 100,
      wellnessScore: score[i]!.value,
      wau: Math.round(wau[i]!.value),
      redemptions: orders.filter((o) => {
        const t = new Date(o.createdAt).getTime()
        return t > startT && t <= endT
      }).length + Math.round(noise(`${k}:red`, i) * (s.employees.length / 40)),
      monthlyActive: Math.round(mae[i]!.value),
    }
  })
  return { ...base(s), granularity, tooShort: count < 2, points: s.suppressed ? [] : points }
}

function assertTab(ctx: BusinessCtx, tab: AnalyticsTab) {
  const session = ctx.session() as BusinessSession
  if (!TAB_ROLES[tab].includes(session.role)) throw forbidden("Your role doesn't include this analytics view.")
}

// ─── CSV export ─────────────────────────────────────────────────────────

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const pct = (v: number | null) => (v === null ? "Hidden (< min group)" : `${Math.round(v * 100)}%`)
const csv = (header: string[], rows: unknown[][]) => [header.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n")

function exportRows(ctx: BusinessCtx, tab: AnalyticsTab, q: AnalyticsQuery & { type?: ChallengeType; threshold?: number; granularity?: Granularity }) {
  switch (tab) {
    case "adoption": {
      const d = adoption(ctx, q)
      return csv(
        ["Department", "Employees", "Invited (not joined)", "Registered", "Active", "Registration rate", "Activation rate"],
        d.byDepartment.map((r) => [r.name, r.employees, r.pending, r.registered, r.active, pct(r.registrationRate), pct(r.activationRate)]),
      )
    }
    case "departments": {
      const d = departmentsData(ctx, q)
      return csv(
        ["Department", "Employees", "Joined", "Active", "Participation", "Avg steps / day", "In a challenge", "Points per active employee", "Below threshold"],
        d.rows.map((r) => [r.name, r.employees, r.joined, r.active, pct(r.participation), r.avgSteps ?? "Hidden", pct(r.challengeParticipation), r.pointsPerActive ?? "Hidden", r.low ? "Yes" : "No"]),
      )
    }
    case "challenges": {
      const d = challengesData(ctx, q)
      return csv(
        ["Challenge", "Type", "Metric", "Status", "Start", "End", "Eligible", "Participants", "Participation", "Completion rate", "Average progress"],
        d.rows.map((r) => [r.name, r.type, r.metric, r.status, r.startDate, r.endDate, r.eligible, r.participants, pct(r.participationRate), pct(r.completionRate), pct(r.avgProgress)]),
      )
    }
    case "engagement": {
      const d = engagementData(ctx, q)
      return csv(["Date", "DAU", "WAU", "MAU"], d.series.map((p) => [p.date, p.dau, p.wau, p.mau]))
    }
    case "participation": {
      const d = participationData(ctx, q)
      return csv(
        [d.groupedBy === "team" ? "Team" : "Department", "Employees", "Avg steps / day", "Workout participation", "Hydration participation", "Sleep tracking", "Habit completion"],
        d.rows.map((r) => [r.name, r.employees, r.avgSteps ?? "Hidden", pct(r.workout), pct(r.hydration), pct(r.sleep), pct(r.habit)]),
      )
    }
    case "trends": {
      const d = trendsData(ctx, q)
      return csv(
        ["Period starting", "Participation", "Avg steps / day", "Challenge participation", "Avg wellness score", "Weekly active", "Reward redemptions", "Monthly active employees"],
        d.points.map((p) => [p.period, pct(p.participation), p.avgSteps, pct(p.challengeParticipation), p.wellnessScore, p.wau, p.redemptions, p.monthlyActive]),
      )
    }
  }
}

export const analyticsApi = {
  adoption: endpoint<AnalyticsQuery, AdoptionData, "business">("business", "GET", "/organization/analytics/adoption", (q, ctx) => {
    assertTab(ctx, "adoption")
    return adoption(ctx, q)
  }),
  departments: endpoint<AnalyticsQuery & { threshold?: number }, DepartmentAnalytics, "business">("business", "GET", "/organization/analytics/departments", (q, ctx) => {
    assertTab(ctx, "departments")
    return departmentsData(ctx, q)
  }),
  challenges: endpoint<AnalyticsQuery & { type?: ChallengeType }, ChallengeAnalytics, "business">("business", "GET", "/organization/analytics/challenges", (q, ctx) => {
    assertTab(ctx, "challenges")
    return challengesData(ctx, q)
  }),
  engagement: endpoint<AnalyticsQuery, EngagementData, "business">("business", "GET", "/organization/analytics/engagement", (q, ctx) => {
    assertTab(ctx, "engagement")
    return engagementData(ctx, q)
  }),
  participation: endpoint<AnalyticsQuery, WellnessParticipation, "business">("business", "GET", "/organization/analytics/wellness", (q, ctx) => {
    assertTab(ctx, "participation")
    return participationData(ctx, q)
  }),
  trends: endpoint<AnalyticsQuery & { granularity?: Granularity }, TrendsData, "business">("business", "GET", "/organization/analytics/trends", (q, ctx) => {
    assertTab(ctx, "trends")
    return trendsData(ctx, q)
  }),
  /** Aggregated CSV for the current tab; audit-logged. */
  exportCsv: endpoint<AnalyticsQuery & { tab: AnalyticsTab; type?: ChallengeType; threshold?: number; granularity?: Granularity }, { fileName: string; csv: string }, "business">(
    "business",
    "GET",
    "/organization/analytics/export",
    (q, ctx) => {
      requireRole(ctx, ANALYTICS)
      assertTab(ctx, q.tab)
      const content = exportRows(ctx, q.tab, q)
      audit(ctx, { action: `Exported analytics (CSV): ${q.tab}`, entityType: "Report", entityName: `${q.tab} · ${RANGE_LABEL[q.range]}`, companyId: ctx.companyId() })
      ctx.save()
      return { fileName: `healthx-${q.tab}-${q.range}-${toLocalDate(new Date())}.csv`, csv: content }
    },
  ),
}

// ─── Monthly report (SCR-B-029, Phase 2) ────────────────────────────────

export interface ReportMonth {
  id: string // YYYY-MM
  label: string
  status: "ready" | "not_generated" | "in_progress"
  partial: boolean
  generatedAt?: string
}

export interface ReportSchedule {
  enabled: boolean
  dayOfMonth: number
  recipientIds: string[]
  format: "pdf" | "csv"
  updatedAt?: string
}

export interface ReportKpi {
  key: string
  label: string
  value: number
  previous: number
  format: "number" | "percent" | "compact"
}

export interface MonthlyReport {
  id: string
  label: string
  companyName: string
  generatedAt: string
  partial: boolean
  periodStart: string
  periodEnd: string
  minGroupSize: number
  kpis: ReportKpi[]
  dailyActive: { date: string; active: number }[]
  departments: { name: string; employees: number; active: number; participation: number | null; avgSteps: number | null }[]
  challenges: { name: string; coverEmoji: string; participants: number; completionRate: number | null; status: string }[]
  adoption: { invited: number; registered: number; active: number }
  wellness: { workout: number; hydration: number; habit: number }
  highlights: string[]
}

interface ReportsStore {
  generated: Record<string, string>
  schedule: ReportSchedule
}

const monthLabel = (id: string) => {
  const [y, m] = id.split("-").map(Number) as [number, number]
  return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" })
}

const monthId = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`

function reportsStore(ctx: BusinessCtx): ReportsStore {
  const store = ctx.extra<Record<string, ReportsStore>>("biz-reports", () => ({}))
  const id = ctx.companyId()
  if (!store[id]) {
    const company = ctx.db.companies.find((c) => c.id === id)
    const generated: Record<string, string> = {}
    const start = new Date(company?.createdAt ?? Date.now())
    const cursor = new Date(start.getFullYear(), start.getMonth() + 1, 1)
    const now = new Date()
    while (cursor < new Date(now.getFullYear(), now.getMonth(), 1)) {
      const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 7, 0)
      generated[monthId(cursor)] = next.toISOString()
      cursor.setMonth(cursor.getMonth() + 1)
    }
    const admins = ctx.db.employees.filter((e) => e.companyId === id && (e.adminRole === "company_owner" || e.adminRole === "hr_admin")).map((e) => e.id)
    store[id] = { generated, schedule: { enabled: true, dayOfMonth: 2, recipientIds: admins, format: "pdf" } }
  }
  return store[id]!
}

function availableMonths(ctx: BusinessCtx) {
  const company = ctx.db.companies.find((c) => c.id === ctx.companyId())
  const start = new Date(company?.createdAt ?? Date.now())
  const now = new Date()
  const months: string[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  while (cursor <= now) {
    months.push(monthId(cursor))
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return months.reverse()
}

function buildReport(ctx: BusinessCtx, id: string, generatedAt: string): MonthlyReport {
  const [y, m] = id.split("-").map(Number) as [number, number]
  const start = new Date(y, m - 1, 1)
  const fullEnd = new Date(y, m, 0, 23, 59, 59)
  const now = new Date()
  const partial = fullEnd > now
  const end = partial ? now : fullEnd
  const companyId = ctx.companyId()
  const company = ctx.db.companies.find((c) => c.id === companyId)!
  const min = companySettings(ctx).minAnalyticsGroupSize
  const all = companyEmployees(ctx)
  const joinedBy = (t: Date) => all.filter((e) => e.joinedAt && new Date(e.joinedAt) <= t)
  const joined = joinedBy(end)
  const joinedPrev = joinedBy(new Date(y, m - 1, 0, 23, 59, 59))
  const activeShare = ratio(all.filter((e) => e.status === "active").length, all.filter(isJoined).length)
  const key = `${companyId}:report:${id}`
  const factor = 0.9 + noise(key, 0) * 0.1
  const active = Math.round(joined.length * activeShare * factor)
  const activePrev = Math.round(joinedPrev.length * activeShare * (0.9 + noise(`${companyId}:report:prev:${id}`, 0) * 0.1))
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS))
  const dailyActive = Array.from({ length: days }, (_, i) => {
    const d = new Date(start.getTime() + i * DAY_MS)
    const weekend = d.getDay() === 0 || d.getDay() === 6 ? 0.65 : 1
    return { date: toLocalDate(d), active: Math.round(active * 0.6 * weekend * (0.9 + noise(key, i + 1) * 0.2)) }
  })
  const activeEmployees = all.filter((e) => e.status === "active")
  const avgSteps = Math.round(avgStepsOf(activeEmployees) * (0.92 + noise(key, 50) * 0.12))
  const challengesInMonth = ctx.db.challenges.filter((c) => c.companyId === companyId && c.status !== "draft" && c.status !== "cancelled" && c.startDate <= toLocalDate(end) && c.endDate >= toLocalDate(start))
  const scaleOrders = ctx.db.orders.filter((o) => o.companyId === companyId && new Date(o.createdAt) >= start && new Date(o.createdAt) <= end).length
  const points = Math.round(activeEmployees.reduce((a, e) => a + e.stats.pointsMonth, 0) * ratio(joined.length, all.filter(isJoined).length || 1) * (days / 30))
  const workouts = Math.round(activeEmployees.reduce((a, e) => a + e.stats.workoutsMonth, 0) * ratio(joined.length, all.filter(isJoined).length || 1) * (days / 30))
  const rates = wellnessRates(key, activeEmployees, all.filter(isJoined))
  const departments = ctx.db.departments
    .filter((d) => d.companyId === companyId)
    .map((d) => {
      const mem = joined.filter((e) => e.departmentId === d.id)
      const share = ratio(activeEmployees.filter((e) => e.departmentId === d.id).length, all.filter((e) => e.departmentId === d.id && isJoined(e)).length)
      const hide = mem.length < min
      return { name: d.name, employees: mem.length, active: Math.round(mem.length * share), participation: hide ? null : share, avgSteps: hide ? null : avgStepsOf(activeEmployees.filter((e) => e.departmentId === d.id)) }
    })
    .filter((d) => d.employees > 0)
    .sort((a, b) => (b.participation ?? -1) - (a.participation ?? -1))
  const challenges = challengesInMonth.map((c) => {
    const parts = ctx.db.participants.filter((p) => p.challengeId === c.id)
    return { name: c.name, coverEmoji: c.coverEmoji, participants: parts.length, completionRate: parts.length < min ? null : ratio(parts.filter((p) => p.completed).length, parts.length), status: c.status }
  })
  const participation = ratio(active, joined.length)
  const participationPrev = ratio(activePrev, joinedPrev.length)
  const best = departments.find((d) => d.participation !== null)
  const topChallenge = [...challenges].sort((a, b) => b.participants - a.participants)[0]
  const highlights = [
    `${formatInt(active)} employees were active in ${monthLabel(id).split(" ")[0]} — ${Math.round(participation * 100)}% of everyone who has joined.`,
    best ? `${best.name} led participation at ${Math.round((best.participation ?? 0) * 100)}%.` : "",
    topChallenge ? `${topChallenge.coverEmoji} ${topChallenge.name} was the most popular challenge with ${formatInt(topChallenge.participants)} participants.` : "No challenges ran this month — launching one is the quickest way to lift participation.",
    joined.length > joinedPrev.length ? `${formatInt(joined.length - joinedPrev.length)} new employees joined HealthX.` : "",
    `Employees earned ${formatInt(points)} points and redeemed ${formatInt(scaleOrders)} rewards.`,
  ].filter(Boolean)
  return {
    id,
    label: monthLabel(id),
    companyName: company.name,
    generatedAt,
    partial,
    periodStart: toLocalDate(start),
    periodEnd: toLocalDate(end),
    minGroupSize: min,
    kpis: [
      { key: "registered", label: "Employees on HealthX", value: joined.length, previous: joinedPrev.length, format: "number" },
      { key: "active", label: "Active employees", value: active, previous: activePrev, format: "number" },
      { key: "participation", label: "Participation", value: participation, previous: participationPrev, format: "percent" },
      { key: "steps", label: "Avg steps / active employee / day", value: avgSteps, previous: Math.round(avgSteps * (0.94 + noise(key, 51) * 0.08)), format: "number" },
      { key: "workouts", label: "Workouts completed", value: workouts, previous: Math.round(workouts * (0.88 + noise(key, 52) * 0.15)), format: "number" },
      { key: "points", label: "Points awarded", value: points, previous: Math.round(points * (0.86 + noise(key, 53) * 0.16)), format: "compact" },
      { key: "challenges", label: "Challenges run", value: challenges.length, previous: Math.max(0, challenges.length - 1 + Math.round(noise(key, 54))), format: "number" },
      { key: "rewards", label: "Rewards redeemed", value: scaleOrders, previous: Math.round(scaleOrders * (0.8 + noise(key, 55) * 0.3)), format: "number" },
    ],
    dailyActive,
    departments,
    challenges,
    adoption: { invited: all.filter((e) => new Date(e.invitedAt) <= end).length, registered: joined.length, active },
    wellness: { workout: rates.workout, hydration: rates.hydration, habit: rates.habit },
    highlights,
  }
}

const formatInt = (n: number) => n.toLocaleString("en-IN")

export const reportsApi = {
  list: endpoint<void, { months: ReportMonth[]; schedule: ReportSchedule; recipients: { id: string; name: string; email: string; role: string }[] }, "business">(
    "business",
    "GET",
    "/organization/reports",
    (_i, ctx) => {
      requireRole(ctx, ADMIN)
      const store = reportsStore(ctx)
      const current = monthId(new Date())
      const months = availableMonths(ctx).map((id) => ({
        id,
        label: monthLabel(id),
        partial: id === current,
        status: store.generated[id] ? ("ready" as const) : ("not_generated" as const),
        generatedAt: store.generated[id],
      }))
      const recipients = companyEmployees(ctx)
        .filter((e) => e.adminRole)
        .map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, email: e.email, role: e.adminRole === "company_owner" ? "Company Owner" : e.adminRole === "hr_admin" ? "HR Admin" : "Wellness Manager" }))
      return { months, schedule: store.schedule, recipients }
    },
  ),

  get: endpoint<{ id: string }, MonthlyReport, "business">("business", "GET", "/organization/reports/:id", ({ id }, ctx) => {
    requireRole(ctx, ADMIN)
    if (!availableMonths(ctx).includes(id)) throw notFound("Report")
    const generatedAt = reportsStore(ctx).generated[id]
    if (!generatedAt) throw badRequest("This report hasn't been generated yet.")
    return buildReport(ctx, id, generatedAt)
  }),

  generate: endpoint<{ month: string }, ReportMonth, "business">("business", "POST", "/organization/reports", ({ month }, ctx) => {
    requireRole(ctx, ADMIN)
    if (!availableMonths(ctx).includes(month)) throw badRequest("Choose a month with data.", { month: "No data for this month" })
    const store = reportsStore(ctx)
    store.generated[month] = new Date().toISOString()
    audit(ctx, { action: "Generated monthly report", entityType: "Report", entityName: monthLabel(month), companyId: ctx.companyId() })
    ctx.save()
    return { id: month, label: monthLabel(month), status: "ready", partial: month === monthId(new Date()), generatedAt: store.generated[month] }
  }),

  saveSchedule: endpoint<ReportSchedule, ReportSchedule, "business">("business", "PUT", "/organization/reports/schedule", (input, ctx) => {
    requireRole(ctx, ADMIN)
    const admins = new Set(companyEmployees(ctx).filter((e) => e.adminRole).map((e) => e.id))
    if (input.enabled && input.recipientIds.length === 0) throw badRequest("Choose at least one recipient.", { recipientIds: "Choose at least one recipient" })
    if (input.recipientIds.some((r) => !admins.has(r))) throw badRequest("Recipients must be company administrators.", { recipientIds: "Recipients must be company administrators" })
    if (!Number.isInteger(input.dayOfMonth) || input.dayOfMonth < 1 || input.dayOfMonth > 28) throw badRequest("Choose a day between 1 and 28.", { dayOfMonth: "Choose a day between 1 and 28" })
    const store = reportsStore(ctx)
    store.schedule = { ...input, updatedAt: new Date().toISOString() }
    audit(ctx, { action: input.enabled ? `Scheduled monthly report email (day ${input.dayOfMonth}, ${input.recipientIds.length} recipients)` : "Turned off monthly report email", entityType: "Report", entityName: "Monthly report schedule", companyId: ctx.companyId() })
    ctx.save()
    return store.schedule
  }),
}
