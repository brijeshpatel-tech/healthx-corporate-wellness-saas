/**
 * Business Portal — wellness programs (Phase 2, #186–#192): SCR-B-030 list, SCR-B-031 create / edit,
 * SCR-B-032 detail & analytics. Wellness campaigns (#191) are handled as programs.
 *
 * A program is a multi-week plan with weekly goals. Templates are platform programs
 * (`companyId === null && isTemplate`). Extra fields that the domain type doesn't carry
 * (completion points, combined challenge, timestamps) live in `extra["biz-programs"]`.
 *
 * Analytics are aggregated only; departments with fewer than `minAnalyticsGroupSize`
 * people are suppressed.
 */
import type { BusinessSession } from "@/lib/auth/session"
import type { Challenge, ProgramWeek, WellnessProgram } from "@/lib/types"
import { DAY_MS, hash, noise, toLocalDate } from "@/lib/mock/series"
import { audit, badRequest, endpoint, matchesSearch, newId, notFound } from "../core"
import { audienceMembers, audienceNames, describeAudience, notifyEmployees, validateAudience, type AudienceInput } from "./challenges"
import { companySettings, ratio, requireRole, suppressed, type BusinessCtx } from "./common"

// ─── Types ──────────────────────────────────────────────────────────────

export type ProgramStatus = WellnessProgram["status"]
export type ProgramMetric = ProgramWeek["goals"][number]["metric"]

export const PROGRAM_LIMITS = { name: 80, description: 600, weekTitle: 60, goalLabel: 80, maxWeeks: 12, maxGoals: 5, maxPoints: 5000 } as const

export interface ProgramQuery {
  status?: ProgramStatus | "all"
  search?: string
}

export interface ProgramChallengeRef {
  id: string
  name: string
  coverEmoji: string
  coverColor: string
  status: Challenge["status"]
  startDate: string
  endDate: string
}

export interface ProgramRow extends WellnessProgram {
  endDate: string | null
  audienceLabel: string
  /** People in the audience who use the app. */
  eligibleCount: number
  completionPoints: number
  combinedChallenge?: ProgramChallengeRef
  goalCount: number
  /** 1-based week number while active. */
  currentWeek: number | null
  daysToStart: number | null
  daysLeft: number | null
  createdBy?: string
  updatedAt: string
  canEdit: boolean
  canPublish: boolean
  canArchive: boolean
  canDelete: boolean
}

export interface ProgramListResult {
  items: ProgramRow[]
  counts: Record<ProgramStatus | "all", number>
}

export interface ProgramDetail extends ProgramRow {
  audienceNames: string[]
  template?: { id: string; name: string }
  /** Fields that can no longer change because the program has started. */
  lockedFields: (keyof ProgramInput)[]
}

export interface ProgramTemplate {
  id: string
  name: string
  description: string
  coverEmoji: string
  coverColor: string
  durationWeeks: number
  weeks: ProgramWeek[]
  goalCount: number
  /** People enrolled across HealthX companies (social proof). */
  enrolledCount: number
  completionRate: number
}

export interface ProgramGoalInput {
  id?: string
  label: string
  metric: ProgramMetric
  target: number
}

export interface ProgramWeekInput {
  title: string
  goals: ProgramGoalInput[]
}

export interface ProgramInput extends AudienceInput {
  name: string
  description: string
  coverEmoji: string
  coverColor: string
  startDate: string
  weeks: ProgramWeekInput[]
  completionPoints: number
  combinedChallengeId?: string | null
  templateId?: string | null
  /** Save and publish in one step (Scheduled or Active depending on the start date). */
  publish?: boolean
}

export interface ProgramAnalytics {
  started: boolean
  status: ProgramStatus
  startDate: string | null
  minGroupSize: number
  kpis: {
    enrolled: number
    eligible: number
    enrollmentRate: number
    activeThisWeek: number
    activeRate: number
    completionRate: number
    avgGoalsCompleted: number
    totalGoals: number
    finishedCount: number
  }
  byWeek: { week: number; label: string; title: string; completion: number | null; state: "done" | "current" | "upcoming" }[]
  enrollmentTrend: { date: string; enrolled: number }[]
  byDepartment: { id: string; name: string; eligible: number; enrolled: number | null; rate: number | null; suppressed: boolean }[]
}

// ─── Internals ──────────────────────────────────────────────────────────

const MANAGE_ROLES: BusinessSession["role"][] = ["company_owner", "hr_admin", "wellness_manager"]
const METRICS: ProgramMetric[] = ["steps", "distance", "calories", "active_minutes", "workouts", "water", "meditation", "habit"]
const LOCKED_WHEN_ACTIVE: (keyof ProgramInput)[] = ["startDate", "weeks", "audienceType", "audienceIds"]

interface ProgramMeta {
  completionPoints: number
  combinedChallengeId?: string
  templateId?: string
  createdAt: string
  updatedAt: string
  createdBy?: string
  publishedAt?: string
}

const today = () => toLocalDate(new Date())
const dayDiff = (from: string, to: string) => Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / DAY_MS)
const addDays = (date: string, days: number) => toLocalDate(new Date(new Date(`${date}T00:00:00`).getTime() + days * DAY_MS))
const endDateOf = (p: Pick<WellnessProgram, "startDate" | "durationWeeks">) => (p.startDate ? addDays(p.startDate, p.durationWeeks * 7 - 1) : null)
const goalCount = (p: Pick<WellnessProgram, "weeks">) => p.weeks.reduce((a, w) => a + w.goals.length, 0)
const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })

const metaStore = (ctx: BusinessCtx) => ctx.extra<Record<string, ProgramMeta>>("biz-programs", () => ({}))

function metaOf(ctx: BusinessCtx, p: WellnessProgram): ProgramMeta {
  const store = metaStore(ctx)
  if (!store[p.id]) {
    // Sample programs: sensible defaults derived from the program itself.
    const created = p.startDate ? new Date(new Date(`${p.startDate}T09:00:00`).getTime() - 21 * DAY_MS).toISOString() : new Date().toISOString()
    store[p.id] = { completionPoints: p.durationWeeks * 50, createdAt: created, updatedAt: created }
  }
  return store[p.id]!
}

function findProgram(ctx: BusinessCtx, id: string) {
  const p = ctx.db.programs.find((x) => x.id === id && x.companyId === ctx.companyId() && !x.isTemplate)
  if (!p) throw notFound("Program")
  return p
}

const companyPrograms = (ctx: BusinessCtx) => ctx.db.programs.filter((p) => p.companyId === ctx.companyId() && !p.isTemplate)

/** Employees (ids) with a real enrolment from the Employee App. */
function realEnrollees(ctx: BusinessCtx, programId: string) {
  const ids: string[] = []
  for (const [employeeId, priv] of Object.entries(ctx.db.private)) {
    if (priv?.enrollments?.some((e) => e.programId === programId)) ids.push(employeeId)
  }
  return ids
}

function currentWeekOf(p: WellnessProgram) {
  if (!p.startDate || (p.status !== "active" && p.status !== "completed")) return null
  if (p.status === "completed") return p.durationWeeks
  return Math.min(p.durationWeeks, Math.max(1, Math.floor(dayDiff(p.startDate, today()) / 7) + 1))
}

/**
 * Deterministic progress model shared by the list and the analytics:
 * weekly goal-completion rates for weeks that have started, and the overall completion.
 */
function progressModel(ctx: BusinessCtx, p: WellnessProgram) {
  const m = metaOf(ctx, p)
  const week = currentWeekOf(p)
  const started = week !== null && !!p.startDate
  const total = goalCount(p) || 1
  const daysIn = started ? Math.max(0, dayDiff(p.startDate!, today())) : 0
  const weekly = p.weeks.map((w, i) => {
    if (!started || i + 1 > week!) return null
    const base = Math.min(0.92, Math.max(0.18, 0.74 - i * 0.07 + (noise(p.id, 20 + i) - 0.5) * 0.12))
    const isCurrent = p.status === "active" && i + 1 === week
    const elapsed = isCurrent ? ((daysIn % 7) + 1) / 7 : 1
    return base * elapsed
  })
  let overall = weekly.reduce<number>((a, v, i) => a + (v ?? 0) * p.weeks[i]!.goals.length, 0) / total
  // Sample programs keep their published completion figure; scale the weeks to match it.
  if (!m.publishedAt && p.completionRate > 0 && overall > 0) {
    const k = p.completionRate / overall
    for (let i = 0; i < weekly.length; i++) if (weekly[i] !== null) weekly[i] = Math.min(0.98, weekly[i]! * k)
    overall = p.completionRate
  }
  return { started, week, weekly, overall: Math.min(1, overall) }
}

/** Enrolment = max(stored figure, real enrolments, gradual uptake after publishing). */
function enrolledOf(ctx: BusinessCtx, p: WellnessProgram, eligible: number) {
  const m = metaOf(ctx, p)
  const real = realEnrollees(ctx, p.id).length
  let simulated = 0
  if (m.publishedAt && p.status !== "draft") {
    const hours = (Date.now() - new Date(m.publishedAt).getTime()) / 3_600_000
    simulated = Math.floor(eligible * (0.22 + noise(p.id, 5) * 0.18) * (1 - Math.exp(-hours / 30)))
  }
  return Math.min(Math.max(eligible, real), Math.max(p.enrolledCount, real, simulated))
}

/** Scheduler + figures refresh: start/finish programs by date and keep enrolment figures in step. */
function sync(ctx: BusinessCtx) {
  const t = today()
  let changed = false
  for (const p of companyPrograms(ctx)) {
    if (p.status === "scheduled" && p.startDate && p.startDate <= t) {
      p.status = "active"
      changed = true
    }
    const end = endDateOf(p)
    if (p.status === "active" && end && end < t) {
      p.status = "completed"
      changed = true
    }
    if (p.status === "draft" || p.status === "archived") continue
    const eligible = audienceMembers(ctx, p, true).length
    const enrolled = enrolledOf(ctx, p, eligible)
    if (enrolled !== p.enrolledCount) {
      p.enrolledCount = enrolled
      changed = true
    }
    if (metaOf(ctx, p).publishedAt) {
      const overall = Number(progressModel(ctx, p).overall.toFixed(3))
      if (overall !== p.completionRate) {
        p.completionRate = overall
        changed = true
      }
    }
  }
  if (changed) ctx.save()
}

function challengeRef(ctx: BusinessCtx, id?: string): ProgramChallengeRef | undefined {
  if (!id) return undefined
  const c = ctx.db.challenges.find((x) => x.id === id && x.companyId === ctx.companyId())
  return c ? { id: c.id, name: c.name, coverEmoji: c.coverEmoji, coverColor: c.coverColor, status: c.status, startDate: c.startDate, endDate: c.endDate } : undefined
}

function toRow(ctx: BusinessCtx, p: WellnessProgram): ProgramRow {
  const m = metaOf(ctx, p)
  const t = today()
  const end = endDateOf(p)
  return {
    ...p,
    endDate: end,
    audienceLabel: describeAudience(ctx, p),
    eligibleCount: audienceMembers(ctx, p, true).length,
    completionPoints: m.completionPoints,
    combinedChallenge: challengeRef(ctx, m.combinedChallengeId),
    goalCount: goalCount(p),
    currentWeek: p.status === "active" ? currentWeekOf(p) : null,
    daysToStart: (p.status === "scheduled" || p.status === "draft") && p.startDate ? dayDiff(t, p.startDate) : null,
    daysLeft: p.status === "active" && end ? Math.max(0, dayDiff(t, end)) : null,
    createdBy: m.createdBy,
    updatedAt: m.updatedAt,
    canEdit: p.status === "draft" || p.status === "scheduled" || p.status === "active",
    canPublish: p.status === "draft",
    canArchive: p.status !== "archived",
    canDelete: p.status === "draft",
  }
}

function detailOf(ctx: BusinessCtx, p: WellnessProgram): ProgramDetail {
  const m = metaOf(ctx, p)
  const tpl = m.templateId ? ctx.db.programs.find((x) => x.id === m.templateId) : undefined
  return {
    ...toRow(ctx, p),
    audienceNames: audienceNames(ctx, p),
    template: tpl ? { id: tpl.id, name: tpl.name } : undefined,
    lockedFields: p.status === "active" ? LOCKED_WHEN_ACTIVE : [],
  }
}

/** Company challenges a program may be combined with. */
const combinableChallenges = (ctx: BusinessCtx) =>
  ctx.db.challenges.filter((c) => c.companyId === ctx.companyId() && (c.status === "draft" || c.status === "scheduled" || c.status === "active"))

function validateInput(ctx: BusinessCtx, input: ProgramInput, existing?: WellnessProgram) {
  const errors: Record<string, string> = {}
  const t = today()
  const name = input.name?.trim() ?? ""
  if (name.length < 3) errors.name = "Name must be at least 3 characters"
  else if (name.length > PROGRAM_LIMITS.name) errors.name = `Keep the name under ${PROGRAM_LIMITS.name} characters`
  if ((input.description ?? "").trim().length > PROGRAM_LIMITS.description) errors.description = "Keep the description under 600 characters"
  const startLocked = existing?.status === "active"
  if (!startLocked) {
    if (!input.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) errors.startDate = "Choose a start date"
    else if (input.startDate < t && (!existing || existing.status === "draft" || existing.status === "scheduled")) {
      // Drafts may keep an old date while being edited, but can't be published with it.
      if (!existing || input.publish || existing.status === "scheduled") errors.startDate = "Start date can't be in the past"
    } else if (dayDiff(t, input.startDate) > 365) errors.startDate = "Start within the next 12 months"
  }
  const weeks = input.weeks ?? []
  if (weeks.length === 0) errors.weeks = "Add at least one week with one goal"
  else if (weeks.length > PROGRAM_LIMITS.maxWeeks) errors.weeks = `Programs can run for up to ${PROGRAM_LIMITS.maxWeeks} weeks`
  weeks.forEach((w, i) => {
    const title = w.title?.trim() ?? ""
    if (!title) errors[`weeks.${i}.title`] = "Give this week a title"
    else if (title.length > PROGRAM_LIMITS.weekTitle) errors[`weeks.${i}.title`] = `Keep it under ${PROGRAM_LIMITS.weekTitle} characters`
    if (!w.goals?.length) errors[`weeks.${i}.goals`] = "Add at least one goal"
    else if (w.goals.length > PROGRAM_LIMITS.maxGoals) errors[`weeks.${i}.goals`] = `Up to ${PROGRAM_LIMITS.maxGoals} goals per week`
    ;(w.goals ?? []).forEach((g, j) => {
      const label = g.label?.trim() ?? ""
      if (!label) errors[`weeks.${i}.goals.${j}.label`] = "Describe the goal"
      else if (label.length > PROGRAM_LIMITS.goalLabel) errors[`weeks.${i}.goals.${j}.label`] = `Keep it under ${PROGRAM_LIMITS.goalLabel} characters`
      if (!METRICS.includes(g.metric)) errors[`weeks.${i}.goals.${j}.metric`] = "Choose a metric"
      if (!(g.target > 0)) errors[`weeks.${i}.goals.${j}.target`] = "Target must be greater than 0"
      else if (g.target > 10_000_000) errors[`weeks.${i}.goals.${j}.target`] = "That target is too large"
    })
  })
  if (!(input.completionPoints >= 0) || input.completionPoints > PROGRAM_LIMITS.maxPoints) errors.completionPoints = `Points must be between 0 and ${PROGRAM_LIMITS.maxPoints.toLocaleString("en-IN")}`
  if (input.combinedChallengeId) {
    const ok = combinableChallenges(ctx).some((c) => c.id === input.combinedChallengeId) || metaStore(ctx)[existing?.id ?? ""]?.combinedChallengeId === input.combinedChallengeId
    if (!ok) errors.combinedChallengeId = "Choose a draft, scheduled or active challenge"
  }
  if (!startLocked) {
    const audienceError = validateAudience(ctx, input)
    if (audienceError) errors.audienceIds = audienceError
  }
  return errors
}

function normaliseWeeks(weeks: ProgramWeekInput[], programId: string): ProgramWeek[] {
  const used = new Set<string>()
  return weeks.map((w, i) => ({
    week: i + 1,
    title: w.title.trim(),
    goals: w.goals.map((g, j) => {
      let id = g.id && !used.has(g.id) ? g.id : `g${hash(`${programId}:${i}:${j}:${g.label}`).toString(36).slice(0, 6)}`
      while (used.has(id)) id = `${id}x`
      used.add(id)
      return { id, label: g.label.trim(), metric: g.metric, target: Math.round(g.target * 100) / 100 }
    }),
  }))
}

function applyInput(ctx: BusinessCtx, p: WellnessProgram, input: ProgramInput, locked: Set<string>) {
  p.name = input.name.trim()
  p.description = input.description?.trim() ?? ""
  p.coverEmoji = input.coverEmoji || "🌱"
  p.coverColor = input.coverColor || "#10b981"
  if (!locked.has("startDate")) p.startDate = input.startDate
  if (!locked.has("weeks")) {
    p.weeks = normaliseWeeks(input.weeks, p.id)
    p.durationWeeks = p.weeks.length
  }
  if (!locked.has("audienceType")) {
    p.audienceType = input.audienceType
    p.audienceIds = input.audienceType === "all" ? [] : [...new Set(input.audienceIds)]
  }
  const m = metaOf(ctx, p)
  m.completionPoints = Math.round(input.completionPoints)
  m.combinedChallengeId = input.combinedChallengeId || undefined
  m.updatedAt = new Date().toISOString()
}

function doPublish(ctx: BusinessCtx, p: WellnessProgram) {
  const t = today()
  if (!p.startDate || p.startDate < t) throw badRequest("The start date is in the past. Choose a new start date before publishing.", { startDate: "Start date can't be in the past" })
  if (goalCount(p) === 0) throw badRequest("Add at least one week with one goal before publishing.", { weeks: "Add at least one week with one goal" })
  p.status = p.startDate > t ? "scheduled" : "active"
  const m = metaOf(ctx, p)
  m.publishedAt = new Date().toISOString()
  const members = audienceMembers(ctx, p, true)
  notifyEmployees(
    ctx,
    members.map((e) => e.id),
    {
      type: "system",
      title: `${p.status === "active" ? "New wellness program" : "Coming up"}: ${p.name} ${p.coverEmoji}`,
      body: `${p.durationWeeks} ${p.durationWeeks === 1 ? "week" : "weeks"} of weekly goals${m.completionPoints ? ` · earn ${m.completionPoints} points` : ""}. ${p.status === "active" ? "Enrol now in Programs." : `Starts ${fmtDay(p.startDate)} — enrol early in Programs.`}`,
      href: `/employee-app/programs/${p.id}`,
    },
    "announcements",
  )
}

/** Deterministic sample of who enrolled — real enrolees first — for the department breakdown. */
function enrolledSample(ctx: BusinessCtx, p: WellnessProgram, enrolled: number) {
  const eligible = audienceMembers(ctx, p, true)
  const real = new Set(realEnrollees(ctx, p.id))
  const ordered = [...eligible].sort((a, b) => {
    const ra = real.has(a.id) ? 0 : 1
    const rb = real.has(b.id) ? 0 : 1
    return ra - rb || noise(`${p.id}:${a.id}`, 0) - noise(`${p.id}:${b.id}`, 0)
  })
  return { eligible, enrolled: ordered.slice(0, Math.min(enrolled, ordered.length)) }
}

// ─── Endpoints ──────────────────────────────────────────────────────────

export const programsApi = {
  list: endpoint<ProgramQuery, ProgramListResult, "business">("business", "GET", "/organization/programs", (q, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    sync(ctx)
    const base = companyPrograms(ctx).filter((p) => matchesSearch(q.search, p.name, p.description))
    const counts: ProgramListResult["counts"] = { all: base.length, draft: 0, scheduled: 0, active: 0, completed: 0, archived: 0 }
    base.forEach((p) => counts[p.status]++)
    const order: Record<ProgramStatus, number> = { active: 0, scheduled: 1, draft: 2, completed: 3, archived: 4 }
    const items = base
      .filter((p) => !q.status || q.status === "all" || p.status === q.status)
      .sort((a, b) => order[a.status] - order[b.status] || (a.startDate ?? "9999").localeCompare(b.startDate ?? "9999"))
      .map((p) => toRow(ctx, p))
    return { items, counts }
  }),

  get: endpoint<{ id: string }, ProgramDetail, "business">("business", "GET", "/organization/programs/:id", ({ id }, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    sync(ctx)
    return detailOf(ctx, findProgram(ctx, id))
  }),

  templates: endpoint<void, ProgramTemplate[], "business">("business", "GET", "/program-templates", (_i, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    return ctx.db.programs
      .filter((p) => p.companyId === null && p.isTemplate)
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        coverEmoji: p.coverEmoji,
        coverColor: p.coverColor,
        durationWeeks: p.durationWeeks,
        weeks: p.weeks,
        goalCount: goalCount(p),
        enrolledCount: p.enrolledCount,
        completionRate: p.completionRate,
      }))
  }),

  /** Challenges that can be combined with a program (draft, scheduled or active). */
  challengeOptions: endpoint<void, ProgramChallengeRef[], "business">("business", "GET", "/organization/programs/challenge-options", (_i, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const order: Record<string, number> = { active: 0, scheduled: 1, draft: 2 }
    return combinableChallenges(ctx)
      .sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || a.startDate.localeCompare(b.startDate))
      .map((c) => challengeRef(ctx, c.id)!)
  }),

  create: endpoint<ProgramInput, ProgramDetail, "business">("business", "POST", "/organization/programs", (input, ctx) => {
    const session = requireRole(ctx, MANAGE_ROLES)
    const errors = validateInput(ctx, input)
    if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
    const now = new Date().toISOString()
    const p: WellnessProgram = {
      id: newId("prg"),
      companyId: ctx.companyId(),
      name: "",
      description: "",
      coverEmoji: "🌱",
      coverColor: "#10b981",
      durationWeeks: 0,
      weeks: [],
      startDate: input.startDate,
      status: "draft",
      audienceType: "all",
      audienceIds: [],
      enrolledCount: 0,
      completionRate: 0,
      isTemplate: false,
    }
    metaStore(ctx)[p.id] = { completionPoints: 0, createdAt: now, updatedAt: now, createdBy: session.user.name, templateId: input.templateId || undefined }
    applyInput(ctx, p, input, new Set())
    if (input.publish) doPublish(ctx, p)
    ctx.db.programs.push(p)
    audit(ctx, { action: input.publish ? "Published program" : "Created program", entityType: "Program", entityName: p.name, companyId: p.companyId })
    ctx.save()
    return detailOf(ctx, p)
  }),

  update: endpoint<ProgramInput & { id: string }, ProgramDetail, "business">("business", "PATCH", "/organization/programs/:id", (input, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    sync(ctx)
    const p = findProgram(ctx, input.id)
    if (p.status === "completed" || p.status === "archived") throw badRequest(`This program is ${p.status} and can no longer be edited.`)
    const locked = new Set<string>(p.status === "active" ? LOCKED_WHEN_ACTIVE : [])
    const errors = validateInput(ctx, input, p)
    if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
    applyInput(ctx, p, input, locked)
    if (input.publish && p.status === "draft") doPublish(ctx, p)
    else if (p.status === "scheduled" && p.startDate && p.startDate <= today()) p.status = "active"
    audit(ctx, { action: input.publish ? "Published program" : "Updated program", entityType: "Program", entityName: p.name, companyId: p.companyId })
    ctx.save()
    return detailOf(ctx, p)
  }),

  publish: endpoint<{ id: string }, ProgramDetail & { message: string }, "business">("business", "POST", "/organization/programs/:id/publish", ({ id }, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const p = findProgram(ctx, id)
    if (p.status !== "draft") throw badRequest("Only draft programs can be published.")
    const audienceError = validateAudience(ctx, p)
    if (audienceError) throw badRequest(`${audienceError}. Edit the program and try again.`, { audienceIds: audienceError })
    doPublish(ctx, p)
    audit(ctx, { action: "Published program", entityType: "Program", entityName: p.name, companyId: p.companyId })
    ctx.save()
    return { ...detailOf(ctx, p), message: (p.status as ProgramStatus) === "active" ? "Program published – it's live now." : `Program published – starts ${fmtDay(p.startDate!)}.` }
  }),

  archive: endpoint<{ id: string }, ProgramDetail, "business">("business", "POST", "/organization/programs/:id/archive", ({ id }, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const p = findProgram(ctx, id)
    if (p.status === "archived") throw badRequest("This program is already archived.")
    const wasLive = p.status === "active" || p.status === "scheduled"
    p.status = "archived"
    metaOf(ctx, p).updatedAt = new Date().toISOString()
    audit(ctx, { action: wasLive ? "Archived live program" : "Archived program", entityType: "Program", entityName: p.name, companyId: p.companyId, severity: wasLive ? "warning" : "info" })
    ctx.save()
    return detailOf(ctx, p)
  }),

  remove: endpoint<{ id: string }, { ok: true }, "business">("business", "DELETE", "/organization/programs/:id", ({ id }, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const p = findProgram(ctx, id)
    if (p.status !== "draft") throw badRequest("Only draft programs can be deleted. Archive it instead.")
    ctx.db.programs = ctx.db.programs.filter((x) => x.id !== p.id)
    delete metaStore(ctx)[p.id]
    audit(ctx, { action: "Deleted program draft", entityType: "Program", entityName: p.name, companyId: p.companyId, severity: "warning" })
    ctx.save()
    return { ok: true }
  }),

  analytics: endpoint<{ id: string }, ProgramAnalytics, "business">("business", "GET", "/organization/programs/:id/analytics", ({ id }, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    sync(ctx)
    const p = findProgram(ctx, id)
    const minGroupSize = companySettings(ctx).minAnalyticsGroupSize
    const model = progressModel(ctx, p)
    const totalGoals = goalCount(p)
    const sample = enrolledSample(ctx, p, p.enrolledCount)
    const eligible = sample.eligible.length
    const enrolled = sample.enrolled.length
    const started = model.started
    const isActive = p.status === "active"
    const activeThisWeek = isActive ? Math.round(enrolled * (0.5 + noise(p.id, 3) * 0.25)) : 0
    const finishedCount = p.status === "completed" || (p.status === "archived" && started) ? Math.round(enrolled * Math.max(0, model.overall - 0.08)) : 0

    const byWeek: ProgramAnalytics["byWeek"] = p.weeks.map((w, i) => ({
      week: w.week,
      label: `Week ${w.week}`,
      title: w.title,
      completion: model.weekly[i] === null || model.weekly[i] === undefined ? null : Number(model.weekly[i]!.toFixed(3)),
      state: model.week === null || i + 1 > model.week ? "upcoming" : isActive && i + 1 === model.week ? "current" : "done",
    }))

    // Cumulative enrolment from a week before the start until today (or the end).
    const enrollmentTrend: ProgramAnalytics["enrollmentTrend"] = []
    if (started && p.startDate) {
      const from = addDays(p.startDate, -7)
      const end = endDateOf(p)!
      const to = end < today() ? end : today()
      const days = Math.min(70, Math.max(2, dayDiff(from, to) + 1))
      const first = addDays(to, -(days - 1))
      const curve = (x: number) => (1 - Math.exp(-4 * x)) / (1 - Math.exp(-4))
      let prev = 0
      for (let i = 0; i < days; i++) {
        const x = days > 1 ? i / (days - 1) : 1
        const jitter = 1 + (noise(p.id, 100 + i) - 0.5) * 0.06
        const value = i === days - 1 ? enrolled : Math.min(enrolled, Math.max(prev, Math.round(enrolled * curve(x) * jitter)))
        enrollmentTrend.push({ date: addDays(first, i), enrolled: value })
        prev = value
      }
    }

    const enrolledByDept = new Map<string, number>()
    sample.enrolled.forEach((e) => enrolledByDept.set(e.departmentId, (enrolledByDept.get(e.departmentId) ?? 0) + 1))
    const eligibleByDept = new Map<string, number>()
    sample.eligible.forEach((e) => eligibleByDept.set(e.departmentId, (eligibleByDept.get(e.departmentId) ?? 0) + 1))
    const byDepartment: ProgramAnalytics["byDepartment"] = [...eligibleByDept.entries()]
      .map(([deptId, el]) => {
        const en = enrolledByDept.get(deptId) ?? 0
        const hidden = suppressed(el, ctx) || (en > 0 && suppressed(en, ctx))
        return {
          id: deptId,
          name: ctx.db.departments.find((d) => d.id === deptId)?.name ?? "No department",
          eligible: el,
          enrolled: hidden ? null : en,
          rate: hidden ? null : ratio(en, el),
          suppressed: hidden,
        }
      })
      .sort((a, b) => (a.suppressed === b.suppressed ? (b.rate ?? 0) - (a.rate ?? 0) || a.name.localeCompare(b.name) : a.suppressed ? 1 : -1))

    return {
      started,
      status: p.status,
      startDate: p.startDate ?? null,
      minGroupSize,
      kpis: {
        enrolled,
        eligible,
        enrollmentRate: ratio(enrolled, eligible),
        activeThisWeek,
        activeRate: ratio(activeThisWeek, enrolled),
        completionRate: started ? model.overall : 0,
        avgGoalsCompleted: started ? Number((model.overall * totalGoals).toFixed(1)) : 0,
        totalGoals,
        finishedCount,
      },
      byWeek,
      enrollmentTrend,
      byDepartment,
    }
  }),
}
