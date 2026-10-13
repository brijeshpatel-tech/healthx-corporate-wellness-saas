/**
 * Business Portal — Activity review.
 *  - #365 (Phase 1) Manual activity approval & correction: manually entered activities wait for an
 *    admin before they earn points; admins can correct incorrect records or add a missing one.
 *  - #349 (Phase 2) Suspicious-data review queue: unusual synced records are held back until an admin
 *    accepts, adjusts or rejects them.
 *
 * Shared store: `ctx.extra("activity-review")`. The Employee App pushes manual entries into the same key
 * (see `api/employee/activity.ts`), so the item shape below must stay compatible with it.
 *
 * Privacy: reviewers only ever see the records that need verification (type, date, value, note) and the
 * employee's name. Nothing else about an employee's health data is returned.
 */
import type { ActivitySession, Employee, PointsSource } from "@/lib/types"
import { DAY_MS, daysAgo, isoAt, noise, toLocalDate } from "@/lib/mock/series"
import { formatDuration, formatNumber, formatShortDate } from "@/lib/format"
import { audit, badRequest, endpoint, matchesSearch, newId, notFound } from "../core"
import { notifyEmployees } from "./challenges"
import { companyEmployees, requireRole, type BusinessCtx } from "./common"
import { creditPoints } from "./points"

const REVIEW_ROLES: Parameters<typeof requireRole>[1] = ["company_owner", "hr_admin", "wellness_manager"]
const STORE_KEY = "activity-review"
const SEEDED_KEY = "activity-review:seeded"

export const REVIEW_LIMITS = {
  reasonMin: 5,
  reasonMax: 300,
  maxPoints: 500,
  /** Records older than this can't be added as "missing". */
  missingMaxDaysAgo: 30,
} as const

// ─── Types ──────────────────────────────────────────────────────────────

export type ReviewKind = "manual" | "suspicious"
export type ReviewStatus = "pending" | "approved" | "rejected" | "adjusted"
export type ReviewUnit = "min" | "km" | "steps"

/** One record waiting for (or having had) an admin decision. Shape shared with the Employee App. */
export interface ActivityReviewItem {
  id: string
  employeeId: string
  /** Linked activity in the employee's private history, when there is one. */
  sessionId?: string
  kind: ReviewKind
  /** Activity type, e.g. "walking", "running", "cycling", "yoga", "steps". */
  type: string
  /** "YYYY-MM-DD" or an ISO timestamp. */
  date: string
  value: number
  unit: string
  /** Points at stake (awarded only on approval). */
  points: number
  /** Employee's note (manual) or why the record was flagged (suspicious). */
  note?: string
  status: ReviewStatus
  handledBy?: string
  handledAt?: string
  /** Rejection or correction reason. */
  reason?: string
  // Optional extras — never required by readers.
  companyId?: string
  createdAt?: string
  /** Value and points before an admin correction. */
  originalValue?: number
  originalPoints?: number
  /** "admin" when an admin recorded a missing activity. */
  origin?: "employee" | "admin"
}

export interface ActivityReviewRow extends ActivityReviewItem {
  employeeName: string
  avatarColor: string
  departmentName: string
  /** Activity day (local YYYY-MM-DD). */
  day: string
}

export type ReviewTab = "manual" | "suspicious" | "handled"

export interface ActivityReviewQuery {
  tab: ReviewTab
  search?: string
  type?: string
  /** Handled tab only. */
  outcome?: "approved" | "adjusted" | "rejected" | "all"
}

export interface ActivityReviewKpis {
  pendingManual: number
  pendingSuspicious: number
  /** Approved, accepted or corrected since Monday. */
  approvedThisWeek: number
  /** Points awarded through reviews (all time) and this month. */
  pointsAwarded: number
  pointsAwardedMonth: number
  /** Pending items older than 3 days. */
  overdue: number
}

export interface ActivityReviewList {
  items: ActivityReviewRow[]
  counts: Record<ReviewTab, number>
  kpis: ActivityReviewKpis
  /** Activity types present in this tab (for the filter). */
  types: string[]
}

export interface ReviewEmployeeOption {
  id: string
  name: string
  departmentName: string
  avatarColor: string
}

export interface CorrectInput {
  id: string
  value: number
  reason: string
}

export interface MissingActivityInput {
  employeeId: string
  type: string
  /** Local date YYYY-MM-DD. */
  date: string
  value: number
  unit: ReviewUnit
  points: number
  reason: string
}

// ─── Display helpers (pure — safe to use in components) ─────────────────

export const ACTIVITY_TYPE_META: Record<string, { label: string; emoji: string; units: ReviewUnit[] }> = {
  walking: { label: "Walking", emoji: "🚶", units: ["min", "km", "steps"] },
  running: { label: "Running", emoji: "🏃", units: ["min", "km", "steps"] },
  cycling: { label: "Cycling", emoji: "🚴", units: ["min", "km"] },
  swimming: { label: "Swimming", emoji: "🏊", units: ["min", "km"] },
  yoga: { label: "Yoga", emoji: "🧘", units: ["min"] },
  meditation: { label: "Meditation", emoji: "🧠", units: ["min"] },
  strength: { label: "Strength", emoji: "🏋️", units: ["min"] },
  sports: { label: "Sports", emoji: "🏸", units: ["min"] },
  steps: { label: "Daily steps", emoji: "👟", units: ["steps"] },
  other: { label: "Other", emoji: "⚡", units: ["min"] },
}

export const UNIT_LABEL: Record<ReviewUnit, string> = { min: "minutes", km: "km", steps: "steps" }

export const activityMeta = (type: string) => ACTIVITY_TYPE_META[type] ?? { label: type.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase()), emoji: "⚡", units: ["min"] as ReviewUnit[] }

/** "45 min", "1h 20m", "5.2 km", "60,000 steps". */
export function formatActivityValue(value: number, unit: string) {
  if (unit === "min") return formatDuration(value)
  if (unit === "km") return `${formatNumber(value, 1)} km`
  if (unit === "steps") return `${formatNumber(value)} steps`
  return `${formatNumber(value, 1)} ${unit}`
}

/** Short phrase used in notifications and audit entries, e.g. "45 min walk", "60,000 steps". */
export function activityPhrase(type: string, value: number, unit: string) {
  const noun: Record<string, string> = { walking: "walk", running: "run", cycling: "ride", swimming: "swim", yoga: "yoga session", meditation: "meditation", strength: "strength session", sports: "sports session" }
  if (type === "steps" || unit === "steps") return formatActivityValue(value, "steps")
  return `${formatActivityValue(value, unit)} ${noun[type] ?? "activity"}`
}

/** Points scale with the corrected value (rounded, never negative). */
export const proportionalPoints = (points: number, from: number, to: number) => (from > 0 && to > 0 ? Math.max(0, Math.round((points * to) / from)) : 0)

/**
 * Suggested points for a missing activity, following the default points rules:
 * 10 points per 1,000 steps (max 150 a day), 20 for a meditation of 5+ min, 50 for a 30-min workout.
 */
export function suggestedPoints(type: string, value: number, unit: string) {
  if (!(value > 0)) return 0
  const STEPS_PER_MIN: Record<string, number> = { walking: 105, running: 160 }
  const STEPS_PER_KM: Record<string, number> = { walking: 1300, running: 1100 }
  let steps = 0
  if (unit === "steps") steps = value
  else if (unit === "min" && STEPS_PER_MIN[type]) steps = value * STEPS_PER_MIN[type]
  else if (unit === "km" && STEPS_PER_KM[type]) steps = value * STEPS_PER_KM[type]
  if (steps > 0) return Math.min(150, Math.floor(steps / 1000) * 10)
  if (type === "meditation") return value >= 5 ? 20 : 0
  const minutes = unit === "min" ? value : unit === "km" ? value * (type === "cycling" ? 3 : type === "swimming" ? 30 : 10) : 0
  return Math.min(50, Math.round(((minutes / 30) * 50) / 5) * 5)
}

/** Earning source used for the points ledger (wellness sources stay private in the company ledger). */
function sourceFor(type: string, unit: string): PointsSource {
  if (type === "meditation") return "meditation"
  if (type === "steps" || unit === "steps" || type === "walking" || type === "running") return "steps"
  return "workout"
}

const VALUE_LIMITS: Record<ReviewUnit, { max: number; label: string }> = {
  min: { max: 600, label: "1–600 minutes" },
  km: { max: 300, label: "0.1–300 km" },
  steps: { max: 100_000, label: "1–100,000 steps" },
}

function validateValue(value: number, unit: string): string | null {
  const limit = VALUE_LIMITS[unit as ReviewUnit]
  if (!Number.isFinite(value) || value <= 0) return "Enter a value greater than 0"
  if (limit && value > limit.max) return `Enter ${limit.label}`
  if (unit === "steps" && !Number.isInteger(value)) return "Use whole steps"
  return null
}

function validateReason(reason: string | undefined, required: string): string | null {
  const r = (reason ?? "").trim()
  if (r.length < REVIEW_LIMITS.reasonMin) return r ? `Add a little more detail (at least ${REVIEW_LIMITS.reasonMin} characters)` : required
  if (r.length > REVIEW_LIMITS.reasonMax) return `Keep it under ${REVIEW_LIMITS.reasonMax} characters`
  return null
}

// ─── Store & sample data ────────────────────────────────────────────────

const itemDay = (date: string) => (date.length > 10 ? toLocalDate(new Date(date)) : date)
const fullName = (e: Pick<Employee, "firstName" | "lastName">) => `${e.firstName} ${e.lastName}`

function store(ctx: BusinessCtx) {
  const items = ctx.extra<ActivityReviewItem[]>(STORE_KEY, () => [])
  const seeded = ctx.extra<Record<string, boolean>>(SEEDED_KEY, () => ({}))
  const companyId = ctx.companyId()
  if (!seeded[companyId]) {
    // Seed once per company (the Employee App may already have pushed real entries — keep them).
    items.push(...seedItems(ctx))
    seeded[companyId] = true
    ctx.save()
  }
  return items
}

/** Items that belong to the signed-in company (by employee). */
function companyItems(ctx: BusinessCtx) {
  const employees = new Map(companyEmployees(ctx, true).map((e) => [e.id, e]))
  return store(ctx).filter((i) => employees.has(i.employeeId) && (!i.companyId || i.companyId === ctx.companyId()))
}

function findItem(ctx: BusinessCtx, id: string) {
  const item = companyItems(ctx).find((i) => i.id === id)
  if (!item) throw notFound("Activity record")
  return item
}

type SeedSpec = Omit<ActivityReviewItem, "id" | "employeeId" | "date" | "companyId" | "createdAt"> & { ago: number }

function seedItems(ctx: BusinessCtx): ActivityReviewItem[] {
  const companyId = ctx.companyId()
  const all = companyEmployees(ctx)
  const active = all.filter((e) => e.status === "active" && !e.adminRole).sort((a, b) => a.id.localeCompare(b.id))
  if (active.length === 0) return []
  const admins = all.filter((e) => e.adminRole === "hr_admin" || e.adminRole === "company_owner" || e.adminRole === "wellness_manager")
  const reviewer = (i: number) => (admins.length ? fullName(admins[i % admins.length]!) : "HR Admin")

  const pending: SeedSpec[] = [
    { kind: "manual", type: "walking", value: 45, unit: "min", points: 40, note: "Evening walk in the park — forgot my phone at home.", status: "pending", ago: 0 },
    { kind: "manual", type: "running", value: 5.2, unit: "km", points: 50, note: "Treadmill run at the office gym, my watch was charging.", status: "pending", ago: 1 },
    { kind: "manual", type: "cycling", value: 60, unit: "min", points: 50, note: "Cycled to work. Phone was in my bag so nothing tracked.", status: "pending", ago: 1 },
    { kind: "manual", type: "yoga", value: 30, unit: "min", points: 50, note: "Saturday yoga class at the community centre.", status: "pending", ago: 2 },
    { kind: "manual", type: "swimming", value: 40, unit: "min", points: 50, note: "Swimming isn't picked up by my phone.", status: "pending", ago: 2 },
    { kind: "manual", type: "walking", value: 8500, unit: "steps", points: 80, note: "Steps missing after my phone was reset.", status: "pending", ago: 3 },
    { kind: "manual", type: "strength", value: 50, unit: "min", points: 50, note: "Gym session, no wearable.", status: "pending", ago: 4 },
    { kind: "manual", type: "meditation", value: 15, unit: "min", points: 20, note: "Guided meditation in the wellness room.", status: "pending", ago: 5 },
  ]
  const suspicious: SeedSpec[] = [
    { kind: "suspicious", type: "steps", value: 60000, unit: "steps", points: 150, note: "60,000 steps in one day — above the 40,000-step daily limit.", status: "pending", ago: 1 },
    { kind: "suspicious", type: "running", value: 75, unit: "km", points: 150, note: "3 h run at an average of 25 km/h — faster than the 20 km/h limit for running.", status: "pending", ago: 2 },
    { kind: "suspicious", type: "cycling", value: 95, unit: "km", points: 50, note: "95 km in 1 h 30 min (63 km/h) — possibly a car or train journey.", status: "pending", ago: 3 },
    { kind: "suspicious", type: "steps", value: 48200, unit: "steps", points: 150, note: "38,000 steps synced within 10 minutes — possible duplicate sync.", status: "pending", ago: 4 },
  ]
  const handled: (SeedSpec & { handledAgo: number; by: number })[] = [
    { kind: "manual", type: "walking", value: 30, unit: "min", points: 30, note: "Lunch walk around the campus.", status: "approved", ago: 6, handledAgo: 5, by: 0 },
    { kind: "manual", type: "running", value: 12, unit: "km", points: 0, note: "Sunday long run.", status: "rejected", reason: "Duplicate — the same run already synced from Apple Health.", ago: 7, handledAgo: 6, by: 1 },
    { kind: "suspicious", type: "steps", value: 14000, unit: "steps", points: 140, originalValue: 52000, originalPoints: 150, note: "52,000 steps in one day — above the 40,000-step daily limit.", status: "adjusted", reason: "Confirmed with the employee: phone was in a washing-machine bag. Corrected to the watch count.", ago: 9, handledAgo: 8, by: 0 },
    { kind: "suspicious", type: "cycling", value: 82, unit: "km", points: 50, note: "82 km in one ride — longer than usual for this group.", status: "approved", reason: "Weekend charity ride — confirmed.", ago: 10, handledAgo: 9, by: 2 },
    { kind: "manual", type: "yoga", value: 45, unit: "min", points: 50, note: "Office yoga session.", status: "approved", ago: 3, handledAgo: 2, by: 1 },
  ]

  const pick = (i: number, salt: string) => active[Math.floor(noise(`${companyId}:${salt}`, i) * active.length)]!
  const now = Date.now()
  const out: ActivityReviewItem[] = []
  const push = (spec: SeedSpec, i: number, salt: string, extra: Partial<ActivityReviewItem> = {}) => {
    const { ago, ...rest } = spec
    const employee = pick(i, salt)
    out.push({
      ...rest,
      id: `arv_seed_${salt}${i}`,
      employeeId: employee.id,
      companyId,
      date: toLocalDate(daysAgo(ago)),
      createdAt: isoAt(ago, 18 + (i % 4), (i * 13) % 60),
      origin: "employee",
      ...extra,
    })
  }
  pending.forEach((s, i) => push(s, i, "m"))
  suspicious.forEach((s, i) => push(s, i, "s"))
  handled.forEach((s, i) => {
    const { handledAgo, by, ...spec } = s
    push(spec, i, "h", { handledBy: reviewer(by), handledAt: new Date(now - handledAgo * DAY_MS + (i + 1) * 3_600_000).toISOString() })
  })
  return out
}

function toRow(item: ActivityReviewItem, employees: Map<string, Employee>, departments: Map<string, string>): ActivityReviewRow {
  const e = employees.get(item.employeeId)
  return {
    ...item,
    employeeName: e ? fullName(e) : "Former employee",
    avatarColor: e?.avatarColor ?? "#64748b",
    departmentName: e ? (departments.get(e.departmentId) ?? "") : "",
    day: itemDay(item.date),
  }
}

// ─── Side effects: points, employee activity, notifications ────────────

function reviewerName(ctx: BusinessCtx) {
  return requireRole(ctx, REVIEW_ROLES).user.name
}

function employeeOf(ctx: BusinessCtx, id: string) {
  const e = ctx.db.employees.find((x) => x.id === id && x.companyId === ctx.companyId())
  if (!e) throw notFound("Employee")
  return e
}

function award(ctx: BusinessCtx, item: ActivityReviewItem, description: string, by: string) {
  if (item.points <= 0) return
  creditPoints(ctx, item.employeeId, item.points, { type: "earn", source: sourceFor(item.type, item.unit), description, createdBy: by })
}

/** Daily totals in the employee's own data include manual sessions — keep them consistent with an edit. */
function shiftDailyTotals(ctx: BusinessCtx, employeeId: string, day: string, before: Partial<ActivitySession>, after: Partial<ActivitySession>) {
  const p = ctx.db.private[employeeId]
  const row = p?.daily.find((d) => d.date === day)
  if (!row) return
  row.steps = Math.max(0, row.steps + (after.steps ?? 0) - (before.steps ?? 0))
  row.distanceKm = Math.max(0, Number((row.distanceKm + (after.distanceKm ?? 0) - (before.distanceKm ?? 0)).toFixed(2)))
  row.activeCalories = Math.max(0, row.activeCalories + (after.calories ?? 0) - (before.calories ?? 0))
  row.activeMinutes = Math.max(0, row.activeMinutes + (after.durationMin ?? 0) - (before.durationMin ?? 0))
  if (day === toLocalDate(new Date())) {
    const e = ctx.db.employees.find((x) => x.id === employeeId)
    if (e) e.stats.stepsToday = row.steps
  }
}

function linkedSession(ctx: BusinessCtx, item: ActivityReviewItem) {
  if (!item.sessionId) return undefined
  return ctx.db.private[item.employeeId]?.sessions.find((s) => s.id === item.sessionId)
}

/** Apply a corrected value to the linked session (and the day's totals for manual entries). */
function syncCorrection(ctx: BusinessCtx, item: ActivityReviewItem, from: number, to: number) {
  const f = from > 0 ? to / from : 1
  const scale = (n: number | undefined, digits = 0) => (n === undefined ? undefined : Number((n * f).toFixed(digits)))
  const session = linkedSession(ctx, item)
  if (session) {
    const before = { ...session }
    if (item.unit === "min") session.durationMin = Math.round(to)
    if (item.unit === "km") session.distanceKm = Number(to.toFixed(2))
    else session.distanceKm = scale(session.distanceKm, 2)
    if (item.unit === "steps") session.steps = Math.round(to)
    else session.steps = scale(session.steps)
    session.calories = scale(session.calories)
    session.points = item.points
    if (session.source === "manual") shiftDailyTotals(ctx, item.employeeId, itemDay(item.date), before, session)
    return
  }
  // A whole day's step count (no single session): correct the day's synced total.
  if (item.unit === "steps") {
    const row = ctx.db.private[item.employeeId]?.daily.find((d) => d.date === itemDay(item.date))
    if (!row) return
    row.steps = Math.round(to)
    row.distanceKm = Number((row.steps * 0.00076).toFixed(2))
    row.activeCalories = Math.round(row.steps * 0.042)
    row.activeMinutes = Math.round(row.steps / 150)
    if (row.date === toLocalDate(new Date())) employeeOf(ctx, item.employeeId).stats.stepsToday = row.steps
  }
}

function notify(ctx: BusinessCtx, employeeId: string, title: string, body: string) {
  notifyEmployees(ctx, [employeeId], { type: "points", title, body, href: "/employee-app/activity" }, "reminders")
}

const auditName = (ctx: BusinessCtx, item: ActivityReviewItem) => {
  const e = ctx.db.employees.find((x) => x.id === item.employeeId)
  return `${e ? fullName(e) : "Employee"} · ${activityMeta(item.type).label}, ${formatShortDate(itemDay(item.date))}`
}

function approveOne(ctx: BusinessCtx, item: ActivityReviewItem, by: string) {
  if (item.status !== "pending") throw badRequest(`This record was already ${item.status === "adjusted" ? "corrected" : item.status}.`)
  const phrase = activityPhrase(item.type, item.value, item.unit)
  item.status = "approved"
  item.handledBy = by
  item.handledAt = new Date().toISOString()
  item.reason = undefined
  award(ctx, item, item.kind === "manual" ? `Manual activity approved: ${phrase}` : `Activity verified: ${phrase}`, by)
  const session = linkedSession(ctx, item)
  if (session) session.points = item.points
  const pts = item.points > 0 ? ` — +${formatNumber(item.points)} points added.` : "."
  notify(
    ctx,
    item.employeeId,
    item.kind === "manual" ? "Activity approved" : "Activity verified",
    `Your ${phrase} on ${formatShortDate(itemDay(item.date))} was ${item.kind === "manual" ? "approved" : "verified"}${pts}`,
  )
}

// ─── Endpoints ──────────────────────────────────────────────────────────

const weekStart = (now: Date) => {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

export const activityReviewApi = {
  list: endpoint<ActivityReviewQuery, ActivityReviewList, "business">("business", "GET", "/organization/activity-review", (q, ctx) => {
    requireRole(ctx, REVIEW_ROLES)
    const items = companyItems(ctx)
    const employees = new Map(companyEmployees(ctx, true).map((e) => [e.id, e]))
    const departments = new Map(ctx.db.departments.filter((d) => d.companyId === ctx.companyId()).map((d) => [d.id, d.name]))
    const inTab = (i: ActivityReviewItem, tab: ReviewTab) => (tab === "handled" ? i.status !== "pending" : i.status === "pending" && i.kind === tab)

    const tabItems = items.filter((i) => inTab(i, q.tab))
    const rows = tabItems
      .filter((i) => !q.type || q.type === "all" || i.type === q.type)
      .filter((i) => q.tab !== "handled" || !q.outcome || q.outcome === "all" || i.status === q.outcome)
      .map((i) => toRow(i, employees, departments))
      .filter((r) => matchesSearch(q.search, r.employeeName, r.departmentName, activityMeta(r.type).label, r.note, r.reason, r.handledBy))
      .sort((a, b) =>
        q.tab === "handled" ? (b.handledAt ?? "").localeCompare(a.handledAt ?? "") : a.day.localeCompare(b.day) || (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
      )

    const now = new Date()
    const since = weekStart(now)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const awarded = items.filter((i) => i.status === "approved" || i.status === "adjusted")
    const pendingAll = items.filter((i) => i.status === "pending")
    return {
      items: rows,
      counts: {
        manual: pendingAll.filter((i) => i.kind === "manual").length,
        suspicious: pendingAll.filter((i) => i.kind === "suspicious").length,
        handled: items.length - pendingAll.length,
      },
      kpis: {
        pendingManual: pendingAll.filter((i) => i.kind === "manual").length,
        pendingSuspicious: pendingAll.filter((i) => i.kind === "suspicious").length,
        approvedThisWeek: awarded.filter((i) => i.handledAt && new Date(i.handledAt).getTime() >= since).length,
        pointsAwarded: awarded.reduce((a, i) => a + i.points, 0),
        pointsAwardedMonth: awarded.filter((i) => i.handledAt && new Date(i.handledAt).getTime() >= monthStart).reduce((a, i) => a + i.points, 0),
        overdue: pendingAll.filter((i) => now.getTime() - new Date(`${itemDay(i.date)}T00:00:00`).getTime() > 3 * DAY_MS).length,
      },
      types: [...new Set(tabItems.map((i) => i.type))].sort((a, b) => activityMeta(a).label.localeCompare(activityMeta(b).label)),
    }
  }),

  /** Approve a manual entry or accept a flagged record — points are awarded now. */
  approve: endpoint<{ id: string }, ActivityReviewItem, "business">("business", "POST", "/organization/activity-review/:id/approve", ({ id }, ctx) => {
    const by = reviewerName(ctx)
    const item = findItem(ctx, id)
    approveOne(ctx, item, by)
    audit(ctx, { action: item.kind === "manual" ? "Approved manual activity" : "Accepted flagged activity", entityType: "Activity review", entityName: auditName(ctx, item), companyId: ctx.companyId() })
    ctx.save()
    return item
  }),

  bulkApprove: endpoint<{ ids: string[] }, { approved: number; skipped: number; points: number }, "business">(
    "business",
    "POST",
    "/organization/activity-review/bulk-approve",
    ({ ids }, ctx) => {
      const by = reviewerName(ctx)
      if (!ids?.length) throw badRequest("Select at least one entry to approve.")
      const wanted = new Set(ids)
      const items = companyItems(ctx).filter((i) => wanted.has(i.id))
      let approved = 0
      let points = 0
      for (const item of items) {
        if (item.status !== "pending" || item.kind !== "manual") continue
        approveOne(ctx, item, by)
        approved++
        points += item.points
      }
      if (approved === 0) throw badRequest("None of the selected entries are waiting for approval any more.")
      audit(ctx, { action: `Bulk approved ${approved} manual ${approved === 1 ? "activity" : "activities"} (${formatNumber(points)} points)`, entityType: "Activity review", entityName: `${approved} entries`, companyId: ctx.companyId() })
      ctx.save()
      return { approved, skipped: ids.length - approved, points }
    },
  ),

  /**
   * Reject — no points. The linked activity stays in the employee's history (the app labels it "Rejected"
   * with the reason) rather than being deleted, so the employee can see what happened; it earns 0 points.
   * The employee's own daily totals are left to the Employee App, which owns them.
   */
  reject: endpoint<{ id: string; reason: string }, ActivityReviewItem, "business">("business", "POST", "/organization/activity-review/:id/reject", ({ id, reason }, ctx) => {
    const by = reviewerName(ctx)
    const item = findItem(ctx, id)
    if (item.status !== "pending") throw badRequest(`This record was already ${item.status === "adjusted" ? "corrected" : item.status}.`)
    const error = validateReason(reason, "Tell the employee why it was rejected")
    if (error) throw badRequest(error, { reason: error })
    item.status = "rejected"
    item.handledBy = by
    item.handledAt = new Date().toISOString()
    item.reason = reason.trim()
    const session = linkedSession(ctx, item)
    if (session) session.points = 0
    notify(
      ctx,
      item.employeeId,
      "Activity not approved",
      `Your ${activityPhrase(item.type, item.value, item.unit)} on ${formatShortDate(itemDay(item.date))} wasn't approved, so no points were added. Reason: ${item.reason}`,
    )
    audit(ctx, { action: item.kind === "manual" ? "Rejected manual activity" : "Rejected flagged activity", entityType: "Activity review", entityName: auditName(ctx, item), companyId: ctx.companyId() })
    ctx.save()
    return item
  }),

  /** Correct the value, recompute points proportionally and award them on the corrected value. */
  correct: endpoint<CorrectInput, ActivityReviewItem, "business">("business", "POST", "/organization/activity-review/:id/correct", ({ id, value, reason }, ctx) => {
    const by = reviewerName(ctx)
    const item = findItem(ctx, id)
    if (item.status !== "pending") throw badRequest(`This record was already ${item.status === "adjusted" ? "corrected" : item.status}.`)
    const errors: Record<string, string> = {}
    const valueError = validateValue(Number(value), item.unit)
    if (valueError) errors.value = valueError
    else if (Number(value) === item.value) errors.value = "Enter a different value — or approve it as it is"
    const reasonError = validateReason(reason, "Say what was corrected and why")
    if (reasonError) errors.reason = reasonError
    if (Object.keys(errors).length) throw badRequest(Object.values(errors)[0]!, errors)

    const from = item.value
    const to = item.unit === "steps" ? Math.round(Number(value)) : Number(Number(value).toFixed(2))
    item.originalValue = from
    item.originalPoints = item.points
    item.points = proportionalPoints(item.points, from, to)
    item.value = to
    item.status = "adjusted"
    item.handledBy = by
    item.handledAt = new Date().toISOString()
    item.reason = reason.trim()
    syncCorrection(ctx, item, from, to)
    const phrase = activityPhrase(item.type, to, item.unit)
    award(ctx, item, `Activity corrected and approved: ${phrase}`, by)
    notify(
      ctx,
      item.employeeId,
      "Activity corrected",
      `Your ${activityMeta(item.type).label.toLowerCase()} on ${formatShortDate(itemDay(item.date))} was corrected from ${formatActivityValue(from, item.unit)} to ${formatActivityValue(to, item.unit)}${
        item.points > 0 ? ` — +${formatNumber(item.points)} points added` : ""
      }. Reason: ${item.reason}`,
    )
    audit(ctx, { action: `Corrected activity record (${formatActivityValue(from, item.unit)} → ${formatActivityValue(to, item.unit)})`, entityType: "Activity review", entityName: auditName(ctx, item), companyId: ctx.companyId() })
    ctx.save()
    return item
  }),

  /** Employees an admin can add a missing activity for (name + department only). */
  employeeOptions: endpoint<void, ReviewEmployeeOption[], "business">("business", "GET", "/organization/activity-review/employees", (_i, ctx) => {
    requireRole(ctx, REVIEW_ROLES)
    const departments = new Map(ctx.db.departments.map((d) => [d.id, d.name]))
    return companyEmployees(ctx)
      .filter((e) => e.status === "active" || e.status === "registered" || e.status === "inactive")
      .map((e) => ({ id: e.id, name: fullName(e), departmentName: departments.get(e.departmentId) ?? "", avatarColor: e.avatarColor }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }),

  /** #365 — record an activity the tracker missed (e.g. outage); approved straight away with a reason. */
  addMissing: endpoint<MissingActivityInput, ActivityReviewItem, "business">("business", "POST", "/organization/activity-review/records", (input, ctx) => {
    const by = reviewerName(ctx)
    const errors: Record<string, string> = {}
    const employee = companyEmployees(ctx).find((e) => e.id === input.employeeId)
    if (!employee) errors.employeeId = "Choose an employee"
    const meta = ACTIVITY_TYPE_META[input.type]
    if (!meta) errors.type = "Choose an activity type"
    else if (!meta.units.includes(input.unit)) errors.unit = `Use ${meta.units.map((u) => UNIT_LABEL[u]).join(" or ")} for ${meta.label.toLowerCase()}`
    const today = toLocalDate(new Date())
    const oldest = toLocalDate(daysAgo(REVIEW_LIMITS.missingMaxDaysAgo))
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "")) errors.date = "Choose a date"
    else if (input.date > today) errors.date = "The date can't be in the future"
    else if (input.date < oldest) errors.date = `Only the last ${REVIEW_LIMITS.missingMaxDaysAgo} days can be added`
    const valueError = validateValue(Number(input.value), input.unit)
    if (valueError) errors.value = valueError
    if (!Number.isInteger(input.points) || input.points < 0 || input.points > REVIEW_LIMITS.maxPoints) errors.points = `Enter 0–${REVIEW_LIMITS.maxPoints} points`
    const reasonError = validateReason(input.reason, "Say why this record is being added")
    if (reasonError) errors.reason = reasonError
    if (Object.keys(errors).length) throw badRequest(Object.values(errors)[0]!, errors)

    const value = input.unit === "steps" ? Math.round(input.value) : Number(Number(input.value).toFixed(2))
    const now = new Date().toISOString()
    const item: ActivityReviewItem = {
      id: newId("arv"),
      employeeId: employee!.id,
      kind: "manual",
      type: input.type,
      date: input.date,
      value,
      unit: input.unit,
      points: input.points,
      note: "Added by an admin — missing from the employee's tracker.",
      status: "approved",
      handledBy: by,
      handledAt: now,
      reason: input.reason.trim(),
      companyId: ctx.companyId(),
      createdAt: now,
      origin: "admin",
    }
    // Add the activity to the employee's own history when they use the app.
    const priv = ctx.db.private[employee!.id]
    if (priv && input.type !== "steps") {
      const minutes = input.unit === "min" ? Math.round(value) : input.unit === "km" ? Math.max(1, Math.round(value * (input.type === "cycling" ? 3 : input.type === "running" ? 6 : input.type === "swimming" ? 30 : 12))) : Math.max(1, Math.round(value / 105))
      const steps = input.unit === "steps" ? Math.round(value) : input.type === "walking" ? minutes * 105 : input.type === "running" ? minutes * 160 : undefined
      const session: ActivitySession = {
        id: newId("act"),
        type: (["walking", "running", "cycling", "swimming", "yoga", "meditation", "strength", "sports", "other"].includes(input.type) ? input.type : "other") as ActivitySession["type"],
        startedAt: new Date(`${input.date}T12:00:00`).toISOString(),
        durationMin: minutes,
        distanceKm: input.unit === "km" ? value : undefined,
        steps,
        source: "manual",
        notes: `Added by your HR team: ${item.reason}`,
        points: item.points,
      }
      priv.sessions.unshift(session)
      priv.sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      shiftDailyTotals(ctx, employee!.id, input.date, {}, session)
      item.sessionId = session.id
    }
    store(ctx).unshift(item)
    const phrase = activityPhrase(item.type, item.value, item.unit)
    award(ctx, item, `Missing activity added: ${phrase}`, by)
    notify(
      ctx,
      employee!.id,
      "Activity added to your history",
      `Your HR team added a ${phrase} on ${formatShortDate(input.date)} that your tracker missed${item.points > 0 ? ` — +${formatNumber(item.points)} points` : ""}.`,
    )
    audit(ctx, { action: "Recorded missing activity", entityType: "Activity review", entityName: auditName(ctx, item), companyId: ctx.companyId() })
    ctx.save()
    return item
  }),
}
