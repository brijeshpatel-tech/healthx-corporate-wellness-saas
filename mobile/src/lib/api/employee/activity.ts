// AUTO-SYNCED from web/src/lib — edit in web/, then run npm run sync-shared
/**
 * Employee app — activity & steps (SCR-M-022, SCR-M-023, SCR-M-024), "Sync now" + sync status (#346),
 * manual activity approval (#365) and personalised daily goals (#362, Phase 2). Own data only.
 */
import type { ActivitySession, ActivityType, CompanySettings, DailyActivity, PointsSource } from "@/lib/types"
import { defaultCompanySettings } from "@/lib/mock/defaults"
import { DAY_MS, noise, toLocalDate } from "@/lib/mock/series"
import { ApiError, badRequest, endpoint, forbidden, newId, notFound, type MockContext } from "../core"

// ─── Shared helpers for the tracking services (points engine, settings) ─────

type Ctx = MockContext<"employee">

/** Points earned today (local day) from one source. */
export function pointsEarnedToday(ctx: Ctx, source: PointsSource) {
  const today = toLocalDate(new Date())
  return ctx
    .me()
    .transactions.filter((t) => t.source === source && t.type === "earn" && toLocalDate(new Date(t.createdAt)) === today)
    .reduce((a, t) => a + t.points, 0)
}

/**
 * Gamification engine (mock): awards points for an event, respecting the active
 * points rule and its daily cap. Updates the balance and the points ledger.
 * Returns the points actually awarded (0 when capped or the rule is off).
 */
export function awardPoints(ctx: Ctx, source: PointsSource, description: string, requested?: number) {
  const rule = ctx.db.pointsRules.find((r) => r.eventType === source)
  if (rule && !rule.active) return 0
  let points = requested ?? rule?.points ?? 0
  if (rule?.dailyCap != null) points = Math.min(points, Math.max(0, rule.dailyCap - pointsEarnedToday(ctx, source)))
  if (points <= 0) return 0
  const me = ctx.me()
  const emp = ctx.db.employees.find((e) => e.id === me.employeeId)
  if (!emp) return 0
  emp.stats.pointsBalance += points
  emp.stats.pointsLifetime += points
  emp.stats.pointsMonth += points
  me.transactions.unshift({
    id: newId("ptx"),
    employeeId: emp.id,
    type: "earn",
    source,
    points,
    description,
    balanceAfter: emp.stats.pointsBalance,
    createdAt: new Date().toISOString(),
  })
  return points
}

export function companySettings(ctx: Ctx): CompanySettings {
  const id = ctx.companyId()
  return ctx.db.settings[id] ?? defaultCompanySettings(id)
}

export function myEmployee(ctx: Ctx) {
  const me = ctx.me()
  const emp = ctx.db.employees.find((e) => e.id === me.employeeId)
  if (!emp) throw notFound("Employee")
  return emp
}

/** Ensures a daily row exists for a local date (the sample data covers 90 days). */
export function dailyRow(ctx: Ctx, date: string): DailyActivity {
  const me = ctx.me()
  let row = me.daily.find((d) => d.date === date)
  if (!row) {
    row = { date, steps: 0, distanceKm: 0, activeCalories: 0, activeMinutes: 0, goalSteps: me.profile.dailyStepGoal }
    me.daily.push(row)
    me.daily.sort((a, b) => a.date.localeCompare(b.date))
  }
  return row
}

// ─── Personalised daily goal (#362, Phase 2) ───────────────────────────

export type GoalMode = "personal" | "fixed"

export interface StepGoalInfo {
  mode: GoalMode
  /** Goal that applies today. */
  today: number
  fixedGoal: number
  /** Suggested personal goal (null until there are 3+ days of history). */
  personalGoal: number | null
  basedOnDays: number
  /** Bonus for reaching a personal goal (once a day). */
  bonusPoints: number
  /** Personal goal reached today (bonus already processed). */
  bonusEarnedToday: boolean
  /** Points actually added today for the bonus (0 when the daily steps cap was already used). */
  bonusAwardedToday: number
}

const GOAL_BONUS = 20
const goalStore = (ctx: Ctx) => ctx.extra<Record<string, { mode: GoalMode }>>("emp-step-goal", () => ({}))
const bonusStore = (ctx: Ctx) => ctx.extra<Record<string, Record<string, number>>>("emp-goal-bonus-v2", () => ({}))

/** Average of the last 14 complete days + 5 %, rounded to 100 (3,000–25,000). */
function personalGoalOf(ctx: Ctx) {
  const today = toLocalDate(new Date())
  const days = ctx
    .me()
    .daily.filter((d) => d.date < today && d.steps > 0)
    .slice(-14)
  if (days.length < 3) return { goal: null, days: days.length }
  const avg = days.reduce((a, d) => a + d.steps, 0) / days.length
  return { goal: Math.min(25_000, Math.max(3_000, Math.round((avg * 1.05) / 100) * 100)), days: days.length }
}

export function stepGoalInfo(ctx: Ctx): StepGoalInfo {
  const me = ctx.me()
  const mode = goalStore(ctx)[me.employeeId]?.mode ?? "personal"
  const p = personalGoalOf(ctx)
  const today = mode === "personal" && p.goal ? p.goal : me.profile.dailyStepGoal
  return {
    mode,
    today,
    fixedGoal: me.profile.dailyStepGoal,
    personalGoal: p.goal,
    basedOnDays: p.days,
    bonusPoints: GOAL_BONUS,
    bonusEarnedToday: toLocalDate(new Date()) in (bonusStore(ctx)[me.employeeId] ?? {}),
    bonusAwardedToday: bonusStore(ctx)[me.employeeId]?.[toLocalDate(new Date())] ?? 0,
  }
}

/**
 * Awards the personal-goal bonus once a day when today's steps reach the personal goal.
 * Uses the steps rule's daily cap so the same steps never earn more than the cap (decision #19).
 */
function maybeGoalBonus(ctx: Ctx): number {
  const info = stepGoalInfo(ctx)
  if (info.mode !== "personal" || !info.personalGoal || info.bonusEarnedToday) return 0
  const today = toLocalDate(new Date())
  const row = ctx.me().daily.find((d) => d.date === today)
  if (!row || row.steps < info.today) return 0
  const awarded = awardPoints(ctx, "steps", `Personal daily goal reached (${info.today.toLocaleString("en-IN")} steps)`, GOAL_BONUS)
  const map = (bonusStore(ctx)[ctx.me().employeeId] ??= {})
  map[today] = awarded
  return awarded
}

// ─── Manual activity approval (#365) ───────────────────────────────────

/** Review item shared with the Business Portal "Activity review" page (extra key "activity-review"). */
export interface ActivityReviewItem {
  id: string
  employeeId: string
  companyId: string
  sessionId: string
  kind: "manual"
  type: ActivityType
  /** Local date of the activity. */
  date: string
  value: number
  unit: string
  /** Points to award if approved (0 when the company doesn't award points for manual entries). */
  points: number
  note?: string
  status: "pending" | "approved" | "rejected"
  createdAt: string
  reviewedAt?: string
  reviewedBy?: string
  /** Reason given when rejected (or adjusted). */
  reason?: string
}

export interface ReviewStatus {
  status: ActivityReviewItem["status"]
  points: number
  reason?: string
}

const reviewStore = (ctx: Ctx) => ctx.extra<ActivityReviewItem[]>("activity-review", () => [])

function reviewMap(ctx: Ctx, sessionIds: string[]): Record<string, ReviewStatus> {
  const ids = new Set(sessionIds)
  const out: Record<string, ReviewStatus> = {}
  for (const r of reviewStore(ctx)) {
    if (!ids.has(r.sessionId)) continue
    const reason = r.reason ?? (r as { rejectionReason?: string }).rejectionReason
    out[r.sessionId] = { status: r.status, points: r.points, reason }
  }
  return out
}

// ─── Types ──────────────────────────────────────────────────────────────

/** Types an employee can log manually (SCR-M-024). */
export const ACTIVITY_TYPES: ActivityType[] = ["walking", "running", "cycling", "swimming", "yoga", "meditation", "strength"]

export interface SyncStatus {
  connected: boolean
  provider: { key: "apple_health" | "health_connect"; label: string } | null
  lastSyncAt?: string
  /** No sync for more than 24 hours. */
  stale: boolean
}

export interface ActivitySummary {
  date: string
  isToday: boolean
  steps: number
  stepGoal: number
  goal: StepGoalInfo
  distanceKm: number
  activeCalories: number
  activeMinutes: number
  hourly: { hour: number; steps: number }[]
  sessions: ActivitySession[]
  reviews: Record<string, ReviewStatus>
  sync: SyncStatus
  manual: { allowed: boolean; earnsPoints: boolean; requiresApproval: true }
  streakDays: number
  pointsToday: number
}

export interface ActivityHistoryQuery {
  from?: string
  to?: string
  type?: ActivityType | "all"
  page?: number
  pageSize?: number
}

export interface ActivityHistory {
  items: ActivitySession[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
  dayTotals: Record<string, { steps: number; activeMinutes: number; distanceKm: number }>
  reviews: Record<string, ReviewStatus>
}

export interface ManualActivityInput {
  type: ActivityType
  /** Local date YYYY-MM-DD */
  date: string
  /** HH:mm (local) */
  startTime: string
  durationMin: number
  distanceKm?: number | null
  notes?: string
  /** Save even if it overlaps another entry (FRM-13 flags overlaps). */
  allowOverlap?: boolean
}

export interface ManualActivityResult {
  session: ActivitySession
  review: ReviewStatus
}

const PROVIDER_LABEL = { apple_health: "Apple Health", health_connect: "Health Connect" } as const

// Steps/calories per minute used to update daily totals from a manual entry (estimates).
const STEPS_PER_MIN: Partial<Record<ActivityType, number>> = { walking: 105, running: 160, sports: 60 }
const KCAL_PER_MIN: Record<ActivityType, number> = { walking: 4.5, running: 11, cycling: 8, swimming: 9, yoga: 3, meditation: 1.2, strength: 6, sports: 7, other: 4 }

function hourlyFor(date: string, steps: number, isToday: boolean) {
  // Typical day shape: morning walk, lunch, evening peak.
  const shape = (h: number) => (h < 6 || h > 22 ? 0.02 : 0.3 + Math.exp(-((h - 8) ** 2) / 3) * 1.4 + Math.exp(-((h - 13) ** 2) / 2) * 0.9 + Math.exp(-((h - 19) ** 2) / 3) * 1.6)
  const lastHour = isToday ? new Date().getHours() : 23
  const hours = Array.from({ length: 24 }, (_, h) => h)
  const weights = hours.map((h) => (h > lastHour ? 0 : shape(h) * (0.55 + noise(date, h))))
  const total = weights.reduce((a, w) => a + w, 0) || 1
  const values = weights.map((w) => Math.round((w / total) * steps))
  const diff = steps - values.reduce((a, v) => a + v, 0)
  const peak = values.indexOf(Math.max(...values))
  if (peak >= 0) values[peak] = Math.max(0, values[peak]! + diff)
  return hours.map((h) => ({ hour: h, steps: values[h]! }))
}

const sessionDate = (s: ActivitySession) => toLocalDate(new Date(s.startedAt))

function activityStreak(ctx: Ctx, maxDays: number) {
  const sorted = [...ctx.me().daily].sort((a, b) => a.date.localeCompare(b.date))
  const today = toLocalDate(new Date())
  let streak = 0
  for (let i = sorted.length - 1; i >= 0 && streak < maxDays; i--) {
    const d = sorted[i]!
    const met = d.steps >= d.goalSteps * 0.8
    if (d.date === today && !met) continue
    if (!met) break
    streak++
  }
  return streak
}

export function syncStatusOf(ctx: Ctx): SyncStatus {
  const conn = ctx.me().healthConnections.find((h) => h.status === "connected" && (h.provider === "apple_health" || h.provider === "health_connect"))
  if (!conn) return { connected: false, provider: null, stale: false }
  const key = conn.provider as "apple_health" | "health_connect"
  return {
    connected: true,
    provider: { key, label: PROVIDER_LABEL[key] },
    lastSyncAt: conn.lastSyncAt,
    stale: !conn.lastSyncAt || Date.now() - new Date(conn.lastSyncAt).getTime() > DAY_MS,
  }
}

function applyToTotals(ctx: Ctx, s: ActivitySession, sign: 1 | -1) {
  const row = dailyRow(ctx, sessionDate(s))
  row.steps = Math.max(0, row.steps + sign * (s.steps ?? 0))
  row.distanceKm = Math.max(0, Number((row.distanceKm + sign * (s.distanceKm ?? 0)).toFixed(2)))
  row.activeCalories = Math.max(0, row.activeCalories + sign * (s.calories ?? 0))
  row.activeMinutes = Math.max(0, row.activeMinutes + sign * s.durationMin)
  if (toLocalDate(new Date()) === row.date) myEmployee(ctx).stats.stepsToday = row.steps
}

function validateManual(ctx: Ctx, input: ManualActivityInput, ignoreId?: string) {
  const errors: Record<string, string> = {}
  if (!ACTIVITY_TYPES.includes(input.type)) errors.type = "Choose an activity type"
  const start = new Date(`${input.date}T${input.startTime || "00:00"}:00`)
  if (Number.isNaN(start.getTime())) errors.date = "Enter a valid date and time"
  else {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const day = new Date(`${input.date}T00:00:00`)
    if (start.getTime() > Date.now()) errors.date = "Date and time can't be in the future"
    else if (today.getTime() - day.getTime() > 7 * DAY_MS) errors.date = "You can log activities from the last 7 days"
  }
  if (!Number.isFinite(input.durationMin) || input.durationMin < 1 || input.durationMin > 600) errors.durationMin = "Enter a duration between 1 and 600 minutes"
  if (input.distanceKm != null && (input.distanceKm < 0.1 || input.distanceKm > 300)) errors.distanceKm = "Enter a distance between 0.1 and 300 km"
  if (input.notes && input.notes.length > 200) errors.notes = "Keep notes under 200 characters"
  if (Object.keys(errors).length) throw badRequest(Object.values(errors)[0]!, errors)

  if (!input.allowOverlap) {
    const end = start.getTime() + input.durationMin * 60_000
    const clash = ctx
      .me()
      .sessions.find((s) => s.id !== ignoreId && new Date(s.startedAt).getTime() < end && new Date(s.startedAt).getTime() + s.durationMin * 60_000 > start.getTime())
    if (clash) {
      const at = new Date(clash.startedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })
      throw new ApiError(`This overlaps another activity at ${at}.`, 409, "activity_overlap", { startTime: `Overlaps an activity at ${at}` })
    }
  }
  return start
}

function buildSession(input: ManualActivityInput, start: Date, id = newId("act")): ActivitySession {
  const perMin = STEPS_PER_MIN[input.type]
  return {
    id,
    type: input.type,
    startedAt: start.toISOString(),
    durationMin: Math.round(input.durationMin),
    distanceKm: input.distanceKm ? Number(input.distanceKm.toFixed(2)) : undefined,
    calories: Math.round(input.durationMin * KCAL_PER_MIN[input.type]),
    steps: perMin ? Math.round(input.durationMin * perMin) : undefined,
    source: "manual",
    notes: input.notes?.trim() || undefined,
    points: 0,
  }
}

/** Points a manual entry would earn once approved (company setting + points rules). */
function eligiblePoints(ctx: Ctx, s: ActivitySession) {
  if (!companySettings(ctx).manualActivityEarnsPoints) return 0
  const rule = (src: PointsSource) => ctx.db.pointsRules.find((r) => r.eventType === src && r.active)
  if (s.type === "meditation") return s.durationMin >= 5 ? (rule("meditation")?.points ?? 0) : 0
  if (s.steps && s.steps >= 1000 && rule("steps")) return Math.floor(s.steps / 1000) * (rule("steps")!.points ?? 10)
  return 0
}

function queueReview(ctx: Ctx, s: ActivitySession): ReviewStatus {
  const me = ctx.me()
  const store = reviewStore(ctx)
  const points = eligiblePoints(ctx, s)
  const existing = store.find((r) => r.sessionId === s.id)
  const fields = {
    type: s.type,
    date: sessionDate(s),
    value: s.durationMin,
    unit: "min",
    points,
    note: [s.distanceKm ? `${s.distanceKm} km` : null, s.steps ? `≈${s.steps.toLocaleString("en-IN")} steps` : null, s.notes ?? null].filter(Boolean).join(" · ") || undefined,
  }
  if (existing) Object.assign(existing, fields, { status: "pending", reviewedAt: undefined, reviewedBy: undefined, reason: undefined })
  else store.unshift({ id: newId("arv"), employeeId: me.employeeId, companyId: ctx.companyId(), sessionId: s.id, kind: "manual", status: "pending", createdAt: new Date().toISOString(), ...fields })
  return { status: "pending", points }
}

function reviewOf(ctx: Ctx, sessionId: string) {
  return reviewStore(ctx).find((r) => r.sessionId === sessionId)
}

// ─── Endpoints ──────────────────────────────────────────────────────────

export const activityApi = {
  summary: endpoint<{ date?: string }, ActivitySummary, "employee">("employee", "GET", "/me/activity/summary", ({ date }, ctx) => {
    const me = ctx.me()
    const today = toLocalDate(new Date())
    const d = date || today
    if (d > today) throw badRequest("Pick today or an earlier day.")
    if (d === today && maybeGoalBonus(ctx) > 0) ctx.save()
    const goal = stepGoalInfo(ctx)
    const row = me.daily.find((x) => x.date === d) ?? { date: d, steps: 0, distanceKm: 0, activeCalories: 0, activeMinutes: 0, goalSteps: me.profile.dailyStepGoal }
    const settings = companySettings(ctx)
    const sessions = me.sessions.filter((s) => sessionDate(s) === d).sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    return {
      date: d,
      isToday: d === today,
      steps: row.steps,
      stepGoal: d === today ? goal.today : row.goalSteps || me.profile.dailyStepGoal,
      goal,
      distanceKm: row.distanceKm,
      activeCalories: row.activeCalories,
      activeMinutes: row.activeMinutes,
      hourly: hourlyFor(d, row.steps, d === today),
      sessions,
      reviews: reviewMap(
        ctx,
        sessions.map((s) => s.id),
      ),
      sync: syncStatusOf(ctx),
      manual: { allowed: settings.allowManualActivity, earnsPoints: settings.manualActivityEarnsPoints, requiresApproval: true },
      streakDays: myEmployee(ctx).stats.currentStreak || activityStreak(ctx, 30),
      pointsToday: me.transactions.filter((t) => t.type === "earn" && toLocalDate(new Date(t.createdAt)) === today).reduce((a, t) => a + t.points, 0),
    }
  }),

  daily: endpoint<{ from: string; to: string }, DailyActivity[], "employee">("employee", "GET", "/me/activity/daily", ({ from, to }, ctx) => {
    const me = ctx.me()
    const out: DailyActivity[] = []
    const start = new Date(`${from}T12:00:00`)
    const end = new Date(`${to}T12:00:00`)
    for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
      const date = toLocalDate(new Date(t))
      out.push(me.daily.find((d) => d.date === date) ?? { date, steps: 0, distanceKm: 0, activeCalories: 0, activeMinutes: 0, goalSteps: me.profile.dailyStepGoal })
    }
    return out
  }),

  syncStatus: endpoint<void, SyncStatus, "employee">("employee", "GET", "/me/activity/sync-status", (_i, ctx) => syncStatusOf(ctx)),

  sync: endpoint<void, SyncStatus & { newSteps: number; bonusPoints: number }, "employee">("employee", "POST", "/me/activity/sync", (_i, ctx) => {
    const me = ctx.me()
    const conn = me.healthConnections.find((h) => h.status === "connected" && (h.provider === "apple_health" || h.provider === "health_connect"))
    if (!conn) throw new ApiError("Connect Apple Health or Health Connect to sync your steps automatically.", 409, "not_connected")
    const now = new Date()
    const since = conn.lastSyncAt ? (now.getTime() - new Date(conn.lastSyncAt).getTime()) / 60_000 : 30
    const hour = now.getHours()
    const awake = hour >= 6 && hour <= 22
    // Sample data: a few new steps since the last sync (at least a handful so the refresh is visible).
    const newSteps = awake ? Math.max(40, Math.round(Math.min(since, 120) * (8 + noise(now.toISOString().slice(0, 16), 1) * 30))) : 0
    const row = dailyRow(ctx, toLocalDate(now))
    row.steps += newSteps
    row.distanceKm = Number((row.steps * 0.00076).toFixed(2))
    row.activeCalories = Math.round(row.steps * 0.042)
    row.activeMinutes = Math.round(row.steps / 150)
    conn.lastSyncAt = now.toISOString()
    const emp = myEmployee(ctx)
    emp.stats.stepsToday = row.steps
    emp.lastActiveAt = now.toISOString()
    const bonusPoints = maybeGoalBonus(ctx)
    ctx.save()
    return { ...syncStatusOf(ctx), newSteps, bonusPoints }
  }),

  goal: endpoint<void, StepGoalInfo, "employee">("employee", "GET", "/me/activity/goal", (_i, ctx) => stepGoalInfo(ctx)),

  setGoal: endpoint<{ mode: GoalMode; fixedGoal: number }, StepGoalInfo, "employee">("employee", "PUT", "/me/activity/goal", ({ mode, fixedGoal }, ctx) => {
    if (mode !== "personal" && mode !== "fixed") throw badRequest("Choose a goal type.")
    if (!Number.isFinite(fixedGoal) || fixedGoal < 2000 || fixedGoal > 30000) throw badRequest("Choose a daily step goal between 2,000 and 30,000.", { fixedGoal: "2,000–30,000 steps" })
    const me = ctx.me()
    me.profile.dailyStepGoal = Math.round(fixedGoal / 500) * 500
    goalStore(ctx)[me.employeeId] = { mode }
    const info = stepGoalInfo(ctx)
    dailyRow(ctx, toLocalDate(new Date())).goalSteps = info.today
    ctx.save()
    return info
  }),

  history: endpoint<ActivityHistoryQuery, ActivityHistory, "employee">("employee", "GET", "/me/activity", (q, ctx) => {
    const me = ctx.me()
    const page = q.page ?? 1
    const pageSize = q.pageSize ?? 20
    const items = me.sessions
      .filter((s) => (!q.type || q.type === "all" || s.type === q.type) && (!q.from || sessionDate(s) >= q.from) && (!q.to || sessionDate(s) <= q.to))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    const slice = items.slice(0, page * pageSize)
    const dayTotals: ActivityHistory["dayTotals"] = {}
    for (const s of slice) {
      const date = sessionDate(s)
      if (dayTotals[date]) continue
      const row = me.daily.find((d) => d.date === date)
      dayTotals[date] = { steps: row?.steps ?? 0, activeMinutes: row?.activeMinutes ?? 0, distanceKm: row?.distanceKm ?? 0 }
    }
    return {
      items: slice,
      total: items.length,
      page,
      pageSize,
      hasMore: slice.length < items.length,
      dayTotals,
      reviews: reviewMap(
        ctx,
        slice.map((s) => s.id),
      ),
    }
  }),

  get: endpoint<{ id: string }, ActivitySession & { review: ReviewStatus | null }, "employee">("employee", "GET", "/me/activity/:id", ({ id }, ctx) => {
    const s = ctx.me().sessions.find((x) => x.id === id)
    if (!s) throw notFound("Activity")
    return { ...s, review: reviewMap(ctx, [id])[id] ?? null }
  }),

  /** Manual entries never earn points straight away — they wait for HR approval (#365). */
  create: endpoint<ManualActivityInput, ManualActivityResult, "employee">("employee", "POST", "/me/activity", (input, ctx) => {
    if (!companySettings(ctx).allowManualActivity) throw forbidden("Your company doesn't allow manual activity entries. Connect a health app instead.")
    const start = validateManual(ctx, input)
    const session = buildSession(input, start)
    ctx.me().sessions.unshift(session)
    applyToTotals(ctx, session, 1)
    const review = queueReview(ctx, session)
    ctx.save()
    return { session, review }
  }),

  update: endpoint<ManualActivityInput & { id: string }, ActivitySession, "employee">("employee", "PATCH", "/me/activity/:id", (input, ctx) => {
    const me = ctx.me()
    const existing = me.sessions.find((s) => s.id === input.id)
    if (!existing) throw notFound("Activity")
    if (existing.source !== "manual") throw forbidden("Synced activities can't be edited.")
    if (reviewOf(ctx, existing.id)?.status === "approved") throw forbidden("This entry has been approved. Ask your HR team if it needs correcting.")
    const start = validateManual(ctx, input, input.id)
    applyToTotals(ctx, existing, -1)
    const next = buildSession(input, start, existing.id)
    me.sessions = me.sessions.map((s) => (s.id === existing.id ? next : s))
    applyToTotals(ctx, next, 1)
    // Edited entries go back for review.
    queueReview(ctx, next)
    ctx.save()
    return next
  }),

  remove: endpoint<{ id: string }, ActivitySession, "employee">("employee", "DELETE", "/me/activity/:id", ({ id }, ctx) => {
    const me = ctx.me()
    const existing = me.sessions.find((s) => s.id === id)
    if (!existing) throw notFound("Activity")
    if (existing.source !== "manual") throw forbidden("Synced activities can't be deleted. Remove them in your health app.")
    if (reviewOf(ctx, id)?.status === "approved") throw forbidden("This entry has been approved and its points added. Ask your HR team if it needs correcting.")
    me.sessions = me.sessions.filter((s) => s.id !== id)
    applyToTotals(ctx, existing, -1)
    // Withdraw the review request; keep the entry for 'Undo' (soft delete).
    const store = reviewStore(ctx)
    const idx = store.findIndex((r) => r.sessionId === id)
    if (idx >= 0) store.splice(idx, 1)
    const trash = ctx.extra<Record<string, ActivitySession>>("emp-activity-trash", () => ({}))
    trash[id] = existing
    ctx.save()
    return existing
  }),

  restore: endpoint<{ id: string }, ActivitySession, "employee">("employee", "POST", "/me/activity/:id/restore", ({ id }, ctx) => {
    const trash = ctx.extra<Record<string, ActivitySession>>("emp-activity-trash", () => ({}))
    const s = trash[id]
    if (!s) throw notFound("Deleted activity")
    const me = ctx.me()
    me.sessions.unshift(s)
    me.sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    applyToTotals(ctx, s, 1)
    queueReview(ctx, s)
    delete trash[id]
    ctx.save()
    return s
  }),
}
