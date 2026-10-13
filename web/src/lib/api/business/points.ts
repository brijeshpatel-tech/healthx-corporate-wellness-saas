/**
 * Business Portal — points administration (SCR-B-035 / #168, bulk award #352 — Phase 2).
 *
 * Client decision #18: company admins can NOT see an individual employee's points history.
 * This service therefore only returns company-level totals (by month and by source) and the
 * log of awards/adjustments that admins themselves made. Points never expire (decision #14).
 */
import type { AudienceType, Employee, Paginated, PointsSource, PointsTransaction } from "@/lib/types"
import { noise, toLocalDate } from "@/lib/mock/series"
import { audit, badRequest, endpoint, matchesSearch, newId, notFound, paginate } from "../core"
import { audienceMembers, describeAudience, notifyEmployees, type AudienceInput } from "./challenges"
import { companyEmployees, companySettings, isJoined, requireRole, type BusinessCtx } from "./common"

const ADMIN_ROLES: Parameters<typeof requireRole>[1] = ["company_owner", "hr_admin"]

export const MAX_ADJUSTMENT_POINTS = 10_000
export const MIN_REASON_LENGTH = 5
/** How far back an award date may go. */
export const MAX_AWARD_BACKDATE_DAYS = 60

// ─── Types ──────────────────────────────────────────────────────────────

export type AwardKind = "bulk" | "credit" | "debit"

/** One action by an admin: a bulk award or a single manual adjustment. */
export interface PointsAward {
  id: string
  companyId: string
  kind: AwardKind
  createdAt: string
  /** YYYY-MM-DD the award is for (shown to employees). */
  awardDate: string
  createdBy: string
  reason: string
  /** Audience label for bulk awards ("Engineering", "Everyone"), the employee's name for single adjustments. */
  recipientsLabel: string
  recipientsCount: number
  /** Points per person (always positive). */
  pointsEach: number
  /** Signed total (negative for deductions). */
  totalPoints: number
}

export type SourceKey = "steps" | "workout" | "water" | "meditation" | "habit" | "streak" | "challenge" | "badge" | "manual"
export type SourcePeriod = "this_month" | "last_month" | "last_6_months"

export interface SourceRow {
  key: SourceKey
  label: string
  points: number
  share: number
  /** Number of people the figure is based on. */
  people: number
  /** Hidden because fewer than the minimum group size contributed. */
  hidden: boolean
}

export interface PointsSummary {
  monthLabel: string
  awardedThisMonth: number
  awardedLastMonth: number
  redeemedThisMonth: number
  redeemedLastMonth: number
  redemptionsThisMonth: number
  outstanding: number
  employeesWithBalance: number
  awardsThisMonth: { count: number; credited: number; debited: number }
  /** Oldest → newest, last 6 calendar months (the current one is month-to-date). */
  monthly: { month: string; label: string; awarded: number; redeemed: number; partial: boolean }[]
  sources: { period: SourcePeriod; periodLabel: string; total: number; rows: SourceRow[] }
  minGroupSize: number
}

export interface AwardsQuery {
  kind?: AwardKind | "all"
  from?: string
  to?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface AwardsResult extends Paginated<PointsAward> {
  totals: { credited: number; debited: number }
}

export interface AdjustPointsInput {
  employeeId: string
  direction: "credit" | "debit"
  points: number
  reason: string
}

export interface AdjustPointsResult {
  award: PointsAward
  employeeName: string
  direction: "credit" | "debit"
  points: number
}

export interface BulkAwardInput extends AudienceInput {
  points: number
  reason: string
  awardDate: string
}

export interface BulkAwardPreview {
  label: string
  /** People who will receive the points (joined the app). */
  recipients: number
  /** In the audience but not using the app yet (no wallet) — skipped. */
  skipped: number
  totalPoints: number
}

export interface EligiblePerson {
  id: string
  name: string
  departmentName: string
  avatarColor: string
}

export interface PointsChange {
  type: PointsTransaction["type"]
  source: PointsSource
  description: string
  createdBy?: string
}

// ─── Helpers shared with other services (orders) ────────────────────────

const fullName = (e: Pick<Employee, "firstName" | "lastName">) => `${e.firstName} ${e.lastName}`
const fmt = (n: number) => n.toLocaleString("en-IN")

export const monthStart = (now = new Date()) => new Date(now.getFullYear(), now.getMonth(), 1)
export const isThisMonth = (iso: string, now = new Date()) => new Date(iso).getTime() >= monthStart(now).getTime()

/** CSV text from a header row and value rows (quotes values when needed). */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [header.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n")
}

/**
 * Apply a signed points change to one employee of the signed-in company:
 * updates the balance (and lifetime/month for earned points), writes the company
 * ledger and — when the employee has used the app — their wallet history (newest first).
 */
export function applyPoints(ctx: BusinessCtx, employeeId: string, delta: number, change: PointsChange): PointsTransaction {
  const e = ctx.db.employees.find((x) => x.id === employeeId && x.companyId === ctx.companyId())
  if (!e) throw notFound("Employee")
  const earned = delta > 0 && (change.type === "earn" || change.type === "adjust")
  e.stats.pointsBalance = Math.max(0, e.stats.pointsBalance + delta)
  if (earned) {
    e.stats.pointsLifetime += delta
    e.stats.pointsMonth += delta
  }
  const tx: PointsTransaction = {
    id: newId("ptx"),
    employeeId,
    type: change.type,
    source: change.source,
    points: delta,
    description: change.description,
    balanceAfter: e.stats.pointsBalance,
    createdAt: new Date().toISOString(),
    ...(change.createdBy ? { createdBy: change.createdBy } : {}),
  }
  ctx.db.pointsTransactions.unshift(tx)
  const wallet = ctx.db.private[employeeId]
  if (wallet) wallet.transactions.unshift({ ...tx })
  return tx
}

export const creditPoints = (ctx: BusinessCtx, employeeId: string, points: number, change: PointsChange) => applyPoints(ctx, employeeId, Math.abs(points), change)
export const debitPoints = (ctx: BusinessCtx, employeeId: string, points: number, change: PointsChange) => applyPoints(ctx, employeeId, -Math.abs(points), change)

// ─── Admin awards log (feature-owned sample data) ───────────────────────

/** The log starts with the manual adjustments already in the sample ledger. */
function awardsLog(ctx: BusinessCtx): PointsAward[] {
  const store = ctx.extra("biz-points-awards", () => {
    const awards: PointsAward[] = ctx.db.pointsTransactions
      .filter((t) => t.type === "adjust")
      .map((t) => {
        const e = ctx.db.employees.find((x) => x.id === t.employeeId)
        return {
          id: `awd_${t.id}`,
          companyId: e?.companyId ?? "",
          kind: t.points >= 0 ? "credit" : "debit",
          createdAt: t.createdAt,
          awardDate: toLocalDate(new Date(t.createdAt)),
          createdBy: t.createdBy ?? "HealthX",
          reason: t.description,
          recipientsLabel: e ? fullName(e) : "Employee",
          recipientsCount: 1,
          pointsEach: Math.abs(t.points),
          totalPoints: t.points,
        } satisfies PointsAward
      })
    return { awards }
  })
  return store.awards
}

function logAward(ctx: BusinessCtx, award: Omit<PointsAward, "id" | "companyId" | "createdAt">): PointsAward {
  const a: PointsAward = { id: newId("awd"), companyId: ctx.companyId(), createdAt: new Date().toISOString(), ...award }
  awardsLog(ctx).unshift(a)
  return a
}

function companyAwards(ctx: BusinessCtx, q: AwardsQuery) {
  const companyId = ctx.companyId()
  return awardsLog(ctx)
    .filter((a) => a.companyId === companyId)
    .filter((a) => (!q.kind || q.kind === "all" || a.kind === q.kind) && (!q.from || a.awardDate >= q.from) && (!q.to || a.awardDate <= q.to))
    .filter((a) => matchesSearch(q.search, a.reason, a.createdBy, a.recipientsLabel))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

// ─── Company-level figures ──────────────────────────────────────────────

const SOURCE_META: { key: Exclude<SourceKey, "manual">; label: string; weight: number; reach: number }[] = [
  { key: "steps", label: "Steps", weight: 0.42, reach: 0.9 },
  { key: "workout", label: "Workouts", weight: 0.16, reach: 0.45 },
  { key: "water", label: "Water goals", weight: 0.1, reach: 0.5 },
  { key: "challenge", label: "Challenges", weight: 0.09, reach: 0.5 },
  { key: "habit", label: "Habits", weight: 0.07, reach: 0.3 },
  { key: "streak", label: "Streak bonuses", weight: 0.07, reach: 0.25 },
  { key: "meditation", label: "Meditation", weight: 0.06, reach: 0.2 },
  { key: "badge", label: "Badges", weight: 0.03, reach: 0.15 },
]

interface MonthFigures {
  key: string
  start: Date
  end: Date
  label: string
  partial: boolean
  awarded: number
  redeemed: number
  manual: number
  manualPeople: number
  bySource: Record<Exclude<SourceKey, "manual">, number>
}

function monthFigures(ctx: BusinessCtx, now: Date): MonthFigures[] {
  const companyId = ctx.companyId()
  const people = companyEmployees(ctx)
  const orders = ctx.db.orders.filter((o) => o.companyId === companyId && o.status !== "rejected" && o.status !== "cancelled")
  const firstOrder = ctx.db.orders.filter((o) => o.companyId === companyId).reduce((m, o) => (o.createdAt < m ? o.createdAt : m), now.toISOString())
  const awards = awardsLog(ctx).filter((a) => a.companyId === companyId)
  const thisMonthAwarded = people.reduce((a, e) => a + e.stats.pointsMonth, 0)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const elapsed = Math.max(0.3, now.getDate() / daysInMonth)
  // A full month at today's pace — the basis for earlier (sample) months.
  const fullMonth = thisMonthAwarded / elapsed

  // Typical full month of redemptions, from complete months that have sample orders.
  const fullMonthsWithOrders = Array.from({ length: 5 }, (_, k) => new Date(now.getFullYear(), now.getMonth() - 1 - k, 1))
    .filter((d) => d.toISOString() >= firstOrder)
    .map((d) => {
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString()
      return orders.filter((o) => o.createdAt >= d.toISOString() && o.createdAt < next).reduce((s, o) => s + o.points, 0)
    })
  const typicalRedeemed = fullMonthsWithOrders.length ? fullMonthsWithOrders.reduce((a, b) => a + b, 0) / fullMonthsWithOrders.length : fullMonth * 0.06

  return Array.from({ length: 6 }, (_, i) => {
    const back = 5 - i
    const start = new Date(now.getFullYear(), now.getMonth() - back, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - back + 1, 1)
    const key = toLocalDate(start).slice(0, 7)
    const inMonth = (iso: string) => iso >= start.toISOString() && iso < end.toISOString()
    const credits = awards.filter((a) => a.totalPoints > 0 && inMonth(a.createdAt))
    const manual = credits.reduce((s, a) => s + a.totalPoints, 0)
    const awarded = back === 0 ? thisMonthAwarded : Math.round(fullMonth * (0.78 + 0.04 * i + noise(`${companyId}:awarded`, back) * 0.14))
    const earnedOnly = Math.max(0, awarded - manual)
    const raw = SOURCE_META.map((s) => s.weight * (0.8 + noise(`${companyId}:${s.key}`, back) * 0.4))
    const sum = raw.reduce((a, b) => a + b, 0)
    const bySource = Object.fromEntries(SOURCE_META.map((s, j) => [s.key, Math.round((earnedOnly * raw[j]!) / sum)])) as MonthFigures["bySource"]
    const actualRedeemed = orders.filter((o) => inMonth(o.createdAt)).reduce((s, o) => s + o.points, 0)
    // Before the first sample order, redemptions are estimated from a typical month.
    const redeemed = start.toISOString() < firstOrder ? Math.round(typicalRedeemed * (0.75 + noise(`${companyId}:redeemed`, back) * 0.4)) : actualRedeemed
    const manualPeople = credits.reduce((s, a) => s + a.recipientsCount, 0)
    return {
      key,
      start,
      end,
      label: start.toLocaleString("en-IN", { month: "short" }),
      partial: back === 0,
      awarded,
      redeemed,
      manual,
      manualPeople,
      bySource,
    }
  })
}

const PERIOD_LABEL: Record<SourcePeriod, string> = { this_month: "this month", last_month: "last month", last_6_months: "the last 6 months" }

function sourceBreakdown(ctx: BusinessCtx, months: MonthFigures[], period: SourcePeriod): PointsSummary["sources"] {
  const picked = period === "this_month" ? months.slice(-1) : period === "last_month" ? months.slice(-2, -1) : months
  const joined = companyEmployees(ctx).filter(isJoined).length
  const min = companySettings(ctx).minAnalyticsGroupSize
  const rows: SourceRow[] = SOURCE_META.map((s) => {
    const points = picked.reduce((a, m) => a + m.bySource[s.key], 0)
    const people = Math.round(joined * s.reach * (0.85 + noise(`${ctx.companyId()}:${s.key}:reach`, picked.length) * 0.15))
    return { key: s.key, label: s.label, points, share: 0, people, hidden: points > 0 && people < min }
  })
  const manual = picked.reduce((a, m) => a + m.manual, 0)
  rows.push({ key: "manual", label: "Admin awards & adjustments", points: manual, share: 0, people: picked.reduce((a, m) => a + m.manualPeople, 0), hidden: false })
  const total = rows.reduce((a, r) => a + r.points, 0)
  rows.forEach((r) => (r.share = total ? r.points / total : 0))
  return { period, periodLabel: PERIOD_LABEL[period], total, rows: rows.sort((a, b) => b.points - a.points) }
}

// ─── Validation ─────────────────────────────────────────────────────────

function validatePointsAndReason(points: number, reason: string, errors: Record<string, string>) {
  if (!Number.isInteger(points) || points < 1 || points > MAX_ADJUSTMENT_POINTS) errors.points = `Enter a whole number from 1 to ${fmt(MAX_ADJUSTMENT_POINTS)}`
  const r = (reason ?? "").trim()
  if (r.length < MIN_REASON_LENGTH) errors.reason = `Give a reason (at least ${MIN_REASON_LENGTH} characters)`
  else if (r.length > 200) errors.reason = "Keep the reason under 200 characters"
  return r
}

function cleanAudience(a: AudienceInput): AudienceInput {
  const types: AudienceType[] = ["all", "departments", "teams", "selected"]
  const ids = Array.isArray(a.audienceIds) ? a.audienceIds : a.audienceIds ? [a.audienceIds as unknown as string] : []
  return { audienceType: types.includes(a.audienceType) ? a.audienceType : "all", audienceIds: ids }
}

function preview(ctx: BusinessCtx, input: AudienceInput & { points?: number }): BulkAwardPreview & { members: Employee[] } {
  const a = cleanAudience(input)
  const all = a.audienceType !== "all" && a.audienceIds.length === 0 ? [] : audienceMembers(ctx, a)
  const members = all.filter(isJoined)
  const each = Number.isInteger(Number(input.points)) && Number(input.points) > 0 ? Number(input.points) : 0
  return { label: describeAudience(ctx, a), recipients: members.length, skipped: all.length - members.length, totalPoints: members.length * each, members }
}

// ─── Endpoints ──────────────────────────────────────────────────────────

export const pointsApi = {
  /** Company-level totals only — never per-employee figures. */
  summary: endpoint<{ period?: SourcePeriod }, PointsSummary, "business">("business", "GET", "/organization/points/summary", (q, ctx) => {
    requireRole(ctx, ADMIN_ROLES)
    const now = new Date()
    const people = companyEmployees(ctx)
    const months = monthFigures(ctx, now)
    const cur = months.at(-1)!
    const prev = months.at(-2)!
    const companyId = ctx.companyId()
    const ordersThisMonth = ctx.db.orders.filter((o) => o.companyId === companyId && isThisMonth(o.createdAt, now) && o.status !== "rejected" && o.status !== "cancelled")
    const awards = companyAwards(ctx, {}).filter((a) => isThisMonth(a.createdAt, now))
    return {
      monthLabel: now.toLocaleString("en-IN", { month: "long", year: "numeric" }),
      awardedThisMonth: cur.awarded,
      awardedLastMonth: prev.awarded,
      redeemedThisMonth: cur.redeemed,
      redeemedLastMonth: prev.redeemed,
      redemptionsThisMonth: ordersThisMonth.length,
      outstanding: people.reduce((a, e) => a + e.stats.pointsBalance, 0),
      employeesWithBalance: people.filter((e) => e.stats.pointsBalance > 0).length,
      awardsThisMonth: {
        count: awards.length,
        credited: awards.filter((a) => a.totalPoints > 0).reduce((s, a) => s + a.totalPoints, 0),
        debited: awards.filter((a) => a.totalPoints < 0).reduce((s, a) => s - a.totalPoints, 0),
      },
      monthly: months.map((m) => ({ month: m.key, label: m.partial ? `${m.label} (to date)` : m.label, awarded: m.awarded, redeemed: m.redeemed, partial: m.partial })),
      sources: sourceBreakdown(ctx, months, q?.period ?? "this_month"),
      minGroupSize: companySettings(ctx).minAnalyticsGroupSize,
    }
  }),

  /** Log of bulk awards and manual adjustments made by admins. */
  awards: endpoint<AwardsQuery, AwardsResult, "business">("business", "GET", "/organization/points/adjustments", (q, ctx) => {
    requireRole(ctx, ADMIN_ROLES)
    const rows = companyAwards(ctx, q)
    return {
      ...paginate(rows, q.page ?? 1, q.pageSize ?? 10),
      totals: {
        credited: rows.filter((a) => a.totalPoints > 0).reduce((s, a) => s + a.totalPoints, 0),
        debited: rows.filter((a) => a.totalPoints < 0).reduce((s, a) => s - a.totalPoints, 0),
      },
    }
  }),

  /** Employees who can receive points (joined the app). Names only — no points figures. */
  eligibleEmployees: endpoint<void, EligiblePerson[], "business">("business", "GET", "/organization/points/eligible-employees", (_i, ctx) => {
    requireRole(ctx, ADMIN_ROLES)
    const depts = new Map(ctx.db.departments.map((d) => [d.id, d.name]))
    return companyEmployees(ctx)
      .filter(isJoined)
      .map((e) => ({ id: e.id, name: fullName(e), departmentName: depts.get(e.departmentId) ?? "—", avatarColor: e.avatarColor }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }),

  /** Single manual credit / debit with a reason (FRM-43). */
  adjust: endpoint<AdjustPointsInput, AdjustPointsResult, "business">("business", "POST", "/organization/points/adjustments", (input, ctx) => {
    const session = requireRole(ctx, ADMIN_ROLES)
    const errors: Record<string, string> = {}
    const e = ctx.db.employees.find((x) => x.id === input.employeeId && x.companyId === ctx.companyId())
    if (!e) errors.employeeId = "Choose an employee"
    else if (!isJoined(e)) errors.employeeId = "Points can only be adjusted for employees who use the app"
    if (input.direction !== "credit" && input.direction !== "debit") errors.direction = "Choose add or deduct"
    const points = Number(input.points)
    const reason = validatePointsAndReason(points, input.reason, errors)
    // The balance itself is never shown to admins (decision #18) — only whether a debit fits.
    if (!errors.points && e && input.direction === "debit" && points > e.stats.pointsBalance)
      errors.points = "That's more than this employee has available. A deduction can't take a balance below zero."
    if (Object.keys(errors).length || !e) throw badRequest("Couldn't save the adjustment. Please fix the highlighted fields.", errors)

    const change: PointsChange = { type: "adjust", source: "manual_adjustment", description: reason, createdBy: session.user.name }
    if (input.direction === "credit") creditPoints(ctx, e.id, points, change)
    else debitPoints(ctx, e.id, points, change)
    const award = logAward(ctx, {
      kind: input.direction,
      awardDate: toLocalDate(new Date()),
      createdBy: session.user.name,
      reason,
      recipientsLabel: fullName(e),
      recipientsCount: 1,
      pointsEach: points,
      totalPoints: input.direction === "credit" ? points : -points,
    })
    notifyEmployees(ctx, [e.id], {
      type: "points",
      title: input.direction === "credit" ? `You received ${fmt(points)} points 🎉` : `${fmt(points)} points were deducted`,
      body: reason,
      href: "/employee-app/wallet",
    })
    audit(ctx, { action: `${input.direction === "credit" ? "Added" : "Deducted"} ${fmt(points)} points — ${reason}`, entityType: "Points", entityName: fullName(e), companyId: ctx.companyId(), severity: "warning" })
    ctx.save()
    return { award, employeeName: fullName(e), direction: input.direction, points }
  }),

  bulkPreview: endpoint<AudienceInput & { points?: number }, BulkAwardPreview, "business">("business", "GET", "/organization/points/bulk-awards/preview", (input, ctx) => {
    requireRole(ctx, ADMIN_ROLES)
    const { label, recipients, skipped, totalPoints } = preview(ctx, input)
    return { label, recipients, skipped, totalPoints }
  }),

  /** #352 Bulk award: the same bonus to selected employees, teams, departments or everyone. */
  bulkAward: endpoint<BulkAwardInput, { award: PointsAward; recipients: number; totalPoints: number }, "business">("business", "POST", "/organization/points/bulk-awards", (input, ctx) => {
    const session = requireRole(ctx, ADMIN_ROLES)
    const errors: Record<string, string> = {}
    const audience = cleanAudience(input)
    if (audience.audienceType !== "all" && audience.audienceIds.length === 0)
      errors.audience = audience.audienceType === "selected" ? "Choose at least one employee" : `Choose at least one ${audience.audienceType === "teams" ? "team" : "department"}`
    const points = Number(input.points)
    const reason = validatePointsAndReason(points, input.reason, errors)
    const today = toLocalDate(new Date())
    const oldest = toLocalDate(new Date(Date.now() - MAX_AWARD_BACKDATE_DAYS * 86_400_000))
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.awardDate ?? "")) errors.awardDate = "Choose the award date"
    else if (input.awardDate > today) errors.awardDate = "The award date can't be in the future"
    else if (input.awardDate < oldest) errors.awardDate = `Choose a date in the last ${MAX_AWARD_BACKDATE_DAYS} days`
    const p = preview(ctx, { ...audience, points })
    if (!errors.audience && p.recipients === 0) errors.audience = "Nobody in this group uses the app yet, so there's no one to award"
    if (Object.keys(errors).length) throw badRequest("Couldn't award the points. Please fix the highlighted fields.", errors)

    const dateNote = input.awardDate === today ? "" : ` (for ${new Date(`${input.awardDate}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})`
    for (const m of p.members) creditPoints(ctx, m.id, points, { type: "adjust", source: "manual_adjustment", description: `Bonus: ${reason}${dateNote}`, createdBy: session.user.name })
    const award = logAward(ctx, {
      kind: "bulk",
      awardDate: input.awardDate,
      createdBy: session.user.name,
      reason,
      recipientsLabel: p.label,
      recipientsCount: p.recipients,
      pointsEach: points,
      totalPoints: p.totalPoints,
    })
    notifyEmployees(
      ctx,
      p.members.map((m) => m.id),
      { type: "points", title: `You received ${fmt(points)} bonus points 🎉`, body: `${reason}${dateNote}`, href: "/employee-app/wallet" },
    )
    audit(ctx, {
      action: `Awarded ${fmt(points)} points each to ${fmt(p.recipients)} employees (${fmt(p.totalPoints)} in total) — ${reason}`,
      entityType: "Points",
      entityName: p.label,
      companyId: ctx.companyId(),
      severity: "warning",
    })
    ctx.save()
    return { award, recipients: p.recipients, totalPoints: p.totalPoints }
  }),

  exportAwards: endpoint<AwardsQuery, { fileName: string; csv: string }, "business">("business", "GET", "/organization/points/adjustments/export", (q, ctx) => {
    requireRole(ctx, ADMIN_ROLES)
    const rows = companyAwards(ctx, q)
    const csv = toCsv(
      ["Award date", "Recorded at", "Type", "Recipients", "People", "Points each", "Total points", "Reason", "By"],
      rows.map((a) => [a.awardDate, a.createdAt.slice(0, 16).replace("T", " "), a.kind === "bulk" ? "Bulk award" : a.kind === "credit" ? "Added" : "Deducted", a.recipientsLabel, a.recipientsCount, a.pointsEach, a.totalPoints, a.reason, a.createdBy]),
    )
    audit(ctx, { action: "Exported points awards log (CSV)", entityType: "Report", entityName: `${rows.length} entries`, companyId: ctx.companyId() })
    ctx.save()
    return { fileName: `points-awards-${toLocalDate(new Date())}.csv`, csv }
  }),

  exportSummary: endpoint<void, { fileName: string; csv: string }, "business">("business", "GET", "/organization/points/summary/export", (_i, ctx) => {
    requireRole(ctx, ADMIN_ROLES)
    const months = monthFigures(ctx, new Date())
    const csv = toCsv(
      ["Month", "Awarded", "Redeemed", ...SOURCE_META.map((s) => s.label), "Admin awards"],
      months.map((m) => [m.partial ? `${m.key} (to date)` : m.key, m.awarded, m.redeemed, ...SOURCE_META.map((s) => m.bySource[s.key]), m.manual]),
    )
    audit(ctx, { action: "Exported points summary (CSV)", entityType: "Report", entityName: "Monthly points summary", companyId: ctx.companyId() })
    ctx.save()
    return { fileName: `points-summary-${toLocalDate(new Date())}.csv`, csv }
  }),
}
