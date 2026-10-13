// AUTO-SYNCED from web/src/lib — edit in web/, then run npm run sync-shared
/**
 * Employee app — Corporate Wellness Programs (SCR-M-064, SCR-M-065). Phase 2.
 * Progress is computed from the employee's own module data (steps, water,
 * workouts, meditation, sleep) inside each week's window.
 */
import type { Employee, ProgramEnrollment, WellnessProgram } from "@/lib/types"
import { DAY_MS, toLocalDate } from "@/lib/mock/series"
import { ApiError, endpoint, newId, notFound, type MockContext } from "../core"

type Ctx = MockContext<"employee">

export type ProgramTab = "available" | "mine" | "completed"
export type GoalMetric = WellnessProgram["weeks"][number]["goals"][number]["metric"]

export interface ProgramGoalProgress {
  id: string
  label: string
  metric: GoalMetric
  target: number
  value: number
  /** 0..1 */
  pct: number
  done: boolean
  unit: string
  href: string
  moduleLabel: string
}

export interface ProgramWeekProgress {
  week: number
  title: string
  startDate: string
  endDate: string
  status: "locked" | "current" | "completed" | "ended" | "upcoming"
  /** 0..1 — average of goal progress. */
  pct: number
  goals: ProgramGoalProgress[]
}

export interface ProgramCard {
  id: string
  name: string
  description: string
  coverEmoji: string
  coverColor: string
  durationWeeks: number
  /** company = run by the employer on fixed dates; healthx = self-paced template. */
  kind: "company" | "healthx"
  companyName?: string
  programStatus: WellnessProgram["status"]
  startDate?: string
  endDate?: string
  enrolled: boolean
  enrolledAt?: string
  /** Week the employee is in (1-based), 0 before the start. */
  currentWeek: number
  /** 0..1 */
  progress: number
  goalsTotal: number
  goalsDone: number
  enrolledCount: number
  completionPoints: number
  tab: ProgramTab
  /** Finished because every goal was met (vs. the window ended). */
  achieved: boolean
  completedAt?: string
}

export interface ProgramDetail extends ProgramCard {
  weeks: ProgramWeekProgress[]
  eligible: boolean
  ineligibleReason?: string
  /** Completion just happened and the celebration hasn't been shown yet. */
  celebrate: boolean
  pointsAwarded: number
}

export interface ProgramList {
  items: ProgramCard[]
  counts: Record<ProgramTab, number>
}

const POINTS_PER_WEEK = 50

const METRIC_META: Record<GoalMetric, { unit: string; href: string; module: string }> = {
  steps: { unit: "steps", href: "/employee-app/activity", module: "Activity" },
  distance: { unit: "km", href: "/employee-app/activity", module: "Activity" },
  calories: { unit: "kcal", href: "/employee-app/activity", module: "Activity" },
  active_minutes: { unit: "min", href: "/employee-app/activity", module: "Activity" },
  workouts: { unit: "workouts", href: "/employee-app/workouts", module: "Workouts" },
  water: { unit: "ml", href: "/employee-app/water", module: "Water" },
  meditation: { unit: "min", href: "/employee-app/activity", module: "Activity" },
  custom: { unit: "check-ins", href: "/employee-app/habits", module: "Habits" },
  habit: { unit: "days", href: "/employee-app/habits", module: "Habits" },
}

// ─── Helpers ────────────────────────────────────────────────────────────

function myEmployee(ctx: Ctx): Employee {
  const me = ctx.me()
  const emp = ctx.db.employees.find((e) => e.id === me.employeeId)
  if (!emp) throw new ApiError("Your session has expired. Please sign in again.", 401, "unauthorized")
  return emp
}

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + n)
  return toLocalDate(d)
}

function inAudience(p: WellnessProgram, emp: Employee) {
  switch (p.audienceType) {
    case "all":
      return true
    case "departments":
      return p.audienceIds.includes(emp.departmentId)
    case "teams":
      return p.audienceIds.includes(emp.teamId)
    case "selected":
      return p.audienceIds.includes(emp.id)
    default:
      return false
  }
}

/** Company programs (scheduled/active/completed, audience incl. me) + HealthX self-paced templates. */
function visiblePrograms(ctx: Ctx) {
  const emp = myEmployee(ctx)
  const company = ctx.db.programs.filter((p) => p.companyId === emp.companyId && ["scheduled", "active", "completed"].includes(p.status) && inAudience(p, emp))
  const names = new Set(company.map((p) => p.name.toLowerCase()))
  // A template the company already runs as its own program is hidden to avoid duplicates.
  const templates = ctx.db.programs.filter((p) => p.companyId === null && p.status === "active" && !names.has(p.name.toLowerCase()))
  return [...company, ...templates]
}

interface CompletionRecord {
  completedAt: string
  points: number
  celebrated: boolean
}

/** Completion log (guards the one-off points award). */
const completions = (ctx: Ctx) => ctx.extra<Record<string, CompletionRecord>>("emp-program-completions", () => ({}))
const completionKey = (employeeId: string, programId: string) => `${employeeId}:${programId}`

/** Window start: fixed start for company programs, enrolment date for self-paced ones. */
function windowStart(p: WellnessProgram, enrollment?: ProgramEnrollment) {
  if (p.companyId !== null && p.startDate) return p.startDate
  if (enrollment) return toLocalDate(new Date(enrollment.enrolledAt))
  return undefined
}

function metricValue(ctx: Ctx, metric: GoalMetric, label: string, from: string, to: string) {
  const me = ctx.me()
  const today = toLocalDate(new Date())
  const end = to < today ? to : today
  if (from > end) return 0
  const inRange = (date: string) => date >= from && date <= end
  const dayOf = (iso: string) => toLocalDate(new Date(iso))
  switch (metric) {
    case "steps":
      return me.daily.filter((d) => inRange(d.date)).reduce((a, d) => a + d.steps, 0)
    case "distance":
      return Number(me.daily.filter((d) => inRange(d.date)).reduce((a, d) => a + d.distanceKm, 0).toFixed(1))
    case "calories":
      return me.daily.filter((d) => inRange(d.date)).reduce((a, d) => a + d.activeCalories, 0)
    case "active_minutes":
      return me.daily.filter((d) => inRange(d.date)).reduce((a, d) => a + d.activeMinutes, 0)
    case "water": {
      // Today's total comes straight from the logs (the daily row may lag behind).
      const past = me.waterDaily.filter((d) => inRange(d.date) && d.date !== today).reduce((a, d) => a + d.totalMl, 0)
      const todayMl = inRange(today) ? me.water.filter((w) => dayOf(w.at) === today).reduce((a, w) => a + w.amountMl, 0) : 0
      return past + todayMl
    }
    case "workouts":
      return me.workoutSessions.filter((s) => s.completed && inRange(dayOf(s.completedAt ?? s.startedAt))).length
    case "meditation":
      return me.sessions.filter((s) => s.type === "meditation" && inRange(dayOf(s.startedAt))).reduce((a, s) => a + s.durationMin, 0)
    case "habit":
      if (/sleep/i.test(label)) return me.sleep.filter((s) => s.durationMin >= 420 && inRange(s.date)).length
      return 0
    default:
      return 0
  }
}

function goalHref(metric: GoalMetric, label: string) {
  if (metric === "habit" && /sleep/i.test(label)) return { href: "/employee-app/sleep", module: "Sleep", unit: "nights" }
  const m = METRIC_META[metric]
  return { href: m.href, module: m.module, unit: m.unit }
}

interface Computed {
  card: ProgramCard
  weeks: ProgramWeekProgress[]
  enrollment?: ProgramEnrollment
}

function compute(ctx: Ctx, p: WellnessProgram): Computed {
  const me = ctx.me()
  const emp = myEmployee(ctx)
  const enrollment = me.enrollments.find((e) => e.programId === p.id)
  const today = toLocalDate(new Date())
  const start = windowStart(p, enrollment)
  const end = start ? addDays(start, p.durationWeeks * 7 - 1) : undefined
  const tracking = !!enrollment && !!start

  const weeks: ProgramWeekProgress[] = p.weeks.map((w) => {
    const ws = start ? addDays(start, (w.week - 1) * 7) : ""
    const we = start ? addDays(start, w.week * 7 - 1) : ""
    const goals = w.goals.map((g) => {
      const meta = goalHref(g.metric, g.label)
      const value = tracking && ws <= today ? metricValue(ctx, g.metric, g.label, ws, we) : 0
      const pct = g.target > 0 ? Math.min(1, value / g.target) : 0
      return { id: g.id, label: g.label, metric: g.metric, target: g.target, value, pct, done: tracking && value >= g.target, unit: meta.unit, href: meta.href, moduleLabel: meta.module }
    })
    const pct = goals.length ? goals.reduce((a, g) => a + g.pct, 0) / goals.length : 0
    const allDone = goals.every((g) => g.done)
    let status: ProgramWeekProgress["status"]
    if (!start) status = w.week === 1 ? "upcoming" : "locked"
    else if (today < ws) status = w.week === 1 ? "upcoming" : "locked"
    else if (today > we) status = allDone ? "completed" : "ended"
    else status = allDone ? "completed" : "current"
    return { week: w.week, title: w.title, startDate: ws, endDate: we, status, pct, goals }
  })

  const allGoals = weeks.flatMap((w) => w.goals)
  const goalsDone = allGoals.filter((g) => g.done).length
  const progress = tracking && allGoals.length ? allGoals.reduce((a, g) => a + g.pct, 0) / allGoals.length : 0
  const achieved = tracking && allGoals.length > 0 && goalsDone === allGoals.length
  const windowOver = !!end && today > end
  const currentWeek = start && today >= start ? Math.min(p.durationWeeks, Math.floor((new Date(`${today}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / (7 * DAY_MS)) + 1) : 0
  const record = completions(ctx)[completionKey(emp.id, p.id)]

  let tab: ProgramTab = "available"
  if (enrollment) tab = achieved || windowOver || record ? "completed" : "mine"

  const company = p.companyId ? ctx.db.companies.find((c) => c.id === p.companyId) : undefined
  const card: ProgramCard = {
    id: p.id,
    name: p.name,
    description: p.description,
    coverEmoji: p.coverEmoji,
    coverColor: p.coverColor,
    durationWeeks: p.durationWeeks,
    kind: p.companyId === null ? "healthx" : "company",
    companyName: company?.name,
    programStatus: p.status,
    startDate: start,
    endDate: end,
    enrolled: !!enrollment,
    enrolledAt: enrollment?.enrolledAt,
    currentWeek,
    progress,
    goalsTotal: allGoals.length,
    goalsDone,
    enrolledCount: p.enrolledCount,
    completionPoints: p.durationWeeks * POINTS_PER_WEEK,
    tab,
    achieved: achieved || !!record,
    completedAt: record?.completedAt,
  }
  return { card, weeks, enrollment }
}

/** Keeps the enrolment record in step with computed progress and credits completion points once. */
function syncEnrollment(ctx: Ctx, p: WellnessProgram, c: Computed) {
  const { enrollment, weeks, card } = c
  if (!enrollment) return { celebrate: false, pointsAwarded: 0 }
  const emp = myEmployee(ctx)
  const me = ctx.me()
  let changed = false
  const doneIds = weeks.flatMap((w) => w.goals.filter((g) => g.done).map((g) => g.id))
  const nextWeek = Math.max(1, card.currentWeek)
  if (doneIds.join(",") !== enrollment.completedGoalIds.join(",") || enrollment.currentWeek !== nextWeek) {
    enrollment.completedGoalIds = doneIds
    enrollment.currentWeek = nextWeek
    changed = true
  }
  const log = completions(ctx)
  const key = completionKey(emp.id, p.id)
  const allDone = card.goalsTotal > 0 && card.goalsDone === card.goalsTotal
  if (allDone && !log[key]) {
    const points = card.completionPoints
    emp.stats.pointsBalance += points
    emp.stats.pointsLifetime += points
    emp.stats.pointsMonth += points
    me.transactions.unshift({
      id: newId("ptx"),
      employeeId: emp.id,
      type: "earn",
      source: "challenge",
      points,
      description: `Program completed: ${p.name}`,
      balanceAfter: emp.stats.pointsBalance,
      createdAt: new Date().toISOString(),
    })
    log[key] = { completedAt: new Date().toISOString(), points, celebrated: false }
    card.completedAt = log[key].completedAt
    card.achieved = true
    card.tab = "completed"
    changed = true
  }
  if (changed) ctx.save()
  const record = log[key]
  return { celebrate: !!record && !record.celebrated, pointsAwarded: record?.points ?? 0 }
}

function eligibility(ctx: Ctx, p: WellnessProgram, c: Computed): { eligible: boolean; reason?: string } {
  if (c.enrollment) return { eligible: true }
  if (p.companyId !== null) {
    if (p.status === "completed") return { eligible: false, reason: "This program has ended." }
    if (c.card.endDate && toLocalDate(new Date()) > c.card.endDate) return { eligible: false, reason: "This program has ended." }
    if (!["scheduled", "active"].includes(p.status)) return { eligible: false, reason: "This program isn't open for joining." }
  }
  return { eligible: true }
}

function detail(ctx: Ctx, id: string): ProgramDetail {
  const p = visiblePrograms(ctx).find((x) => x.id === id)
  if (!p) throw notFound("Program")
  const c = compute(ctx, p)
  const sync = syncEnrollment(ctx, p, c)
  const elig = eligibility(ctx, p, c)
  return { ...c.card, weeks: c.weeks, eligible: elig.eligible, ineligibleReason: elig.reason, celebrate: sync.celebrate, pointsAwarded: sync.pointsAwarded }
}

// ─── Service ────────────────────────────────────────────────────────────

export const programsApi = {
  /** SCR-M-064 — all programs visible to me, split into tabs. */
  list: endpoint<{ status?: ProgramTab } | void, ProgramList, "employee">("employee", "GET", "/programs", (input, ctx) => {
    const items = visiblePrograms(ctx).map((p) => {
      const c = compute(ctx, p)
      syncEnrollment(ctx, p, c)
      return c.card
    })
    const counts: Record<ProgramTab, number> = { available: 0, mine: 0, completed: 0 }
    items.forEach((i) => counts[i.tab]++)
    const order = (i: ProgramCard) => (i.kind === "company" ? 0 : 1)
    const sorted = [...items].sort((a, b) => order(a) - order(b) || b.progress - a.progress || a.name.localeCompare(b.name))
    const status = input ? input.status : undefined
    return { items: status ? sorted.filter((i) => i.tab === status) : sorted, counts }
  }),

  /** SCR-M-065 — overview, weeks and my progress. */
  get: endpoint<{ id: string }, ProgramDetail, "employee">("employee", "GET", "/programs/:id", ({ id }, ctx) => detail(ctx, id)),

  progress: endpoint<{ id: string }, ProgramDetail, "employee">("employee", "GET", "/programs/:id/progress", ({ id }, ctx) => detail(ctx, id)),

  enrol: endpoint<{ id: string }, ProgramDetail, "employee">("employee", "POST", "/programs/:id/enrol", ({ id }, ctx) => {
    const p = visiblePrograms(ctx).find((x) => x.id === id)
    if (!p) throw new ApiError("You can't join this program.", 403, "not_eligible")
    const c = compute(ctx, p)
    const elig = eligibility(ctx, p, c)
    if (!elig.eligible) throw new ApiError("You can't join this program.", 403, "not_eligible")
    const me = ctx.me()
    if (!me.enrollments.some((e) => e.programId === id)) {
      me.enrollments.push({ programId: id, enrolledAt: new Date().toISOString(), currentWeek: 1, completedGoalIds: [] })
      p.enrolledCount += 1
      ctx.save()
    }
    return detail(ctx, id)
  }),

  leave: endpoint<{ id: string }, { ok: true }, "employee">("employee", "POST", "/programs/:id/leave", ({ id }, ctx) => {
    const me = ctx.me()
    if (!me.enrollments.some((e) => e.programId === id)) throw new ApiError("You're not in this program.", 409, "not_enrolled")
    me.enrollments = me.enrollments.filter((e) => e.programId !== id)
    const p = ctx.db.programs.find((x) => x.id === id)
    if (p) p.enrolledCount = Math.max(0, p.enrolledCount - 1)
    ctx.save()
    return { ok: true }
  }),

  /** Marks the completion celebration as shown (so it appears only once). */
  acknowledgeCompletion: endpoint<{ id: string }, { ok: true }, "employee">("employee", "POST", "/programs/:id/completion/ack", ({ id }, ctx) => {
    const emp = myEmployee(ctx)
    const record = completions(ctx)[completionKey(emp.id, id)]
    if (record && !record.celebrated) {
      record.celebrated = true
      ctx.save()
    }
    return { ok: true }
  }),
}
