/**
 * Platform Admin — AI configuration & usage (SCR-P-033).
 * Per-company toggles write `db.settings[companyId]` (read by the Business Portal and Employee App);
 * global defaults and limits live in extra storage. Usage is aggregate only —
 * platform staff never see conversation content.
 */
import { dailySeries, noise } from "@/lib/mock/series"
import { defaultCompanySettings } from "@/lib/mock/defaults"
import type { CompanySettings } from "@/lib/types"
import { audit, badRequest, endpoint } from "../core"
import { findCompany, PERIOD_DAYS, planOf, ratio, requireAdmin, round, sum, toCsv, today, type AdminCtx, type Period } from "./common"

export interface AiGlobalSettings {
  aiCoachEnabled: boolean
  weeklyInsightEnabled: boolean
  monthlyLimitPerEmployee: number
  defaultCompanyBudget: number
  blockMedicalDiagnosis: boolean
  piiRedaction: boolean
  crisisEscalationMessage: string
}

export interface AiCompanyRow {
  companyId: string
  name: string
  status: string
  planName: string
  /** The plan includes the AI Wellness Coach module. */
  inPlan: boolean
  aiCoachEnabled: boolean
  aiInsightsEnabled: boolean
  monthlyLimitPerEmployee: number
  monthlyBudget: number
  /** True when the company uses the platform defaults for limits. */
  usesDefaults: boolean
  costThisMonth: number
  budgetUsed: number
}

export interface AiSettingsData {
  global: AiGlobalSettings
  companies: AiCompanyRow[]
}

export interface AiUsageQuery {
  period: Period
  companyId?: string
}

export interface AiUsageData {
  totals: { requests: number; tokens: number; cost: number; activeUsers: number; insightsSent: number }
  previous: { requests: number; cost: number }
  trend: { date: string; requests: number; cost: number }[]
  byCompany: { companyId: string; name: string; requests: number; tokens: number; cost: number; budget: number; budgetUsed: number; activeUsers: number }[]
}

const DEFAULT_GLOBAL: AiGlobalSettings = {
  aiCoachEnabled: true,
  weeklyInsightEnabled: true,
  monthlyLimitPerEmployee: 60,
  defaultCompanyBudget: 25000,
  blockMedicalDiagnosis: true,
  piiRedaction: true,
  crisisEscalationMessage:
    "It sounds like you're going through a lot. I'm not able to help with this, but you don't have to face it alone — please reach out to your company's Employee Assistance Programme or call the Tele-MANAS helpline at 14416.",
}

type Limits = Record<string, { monthlyLimitPerEmployee: number; monthlyBudget: number }>

const globalStore = (ctx: AdminCtx) => ctx.extra<AiGlobalSettings>("admin-ai-global", () => ({ ...DEFAULT_GLOBAL }))
const limitsStore = (ctx: AdminCtx) => ctx.extra<Limits>("admin-ai-limits", () => ({}))

function companySettings(ctx: AdminCtx, companyId: string, create = false): CompanySettings {
  const existing = ctx.db.settings[companyId]
  if (existing) return existing
  const s = defaultCompanySettings(companyId)
  if (create) ctx.db.settings[companyId] = s
  return s
}

const TOKENS_PER_REQUEST = 1450
const COST_PER_1K_TOKENS = 0.42 // ₹, blended model cost

/** Monthly AI requests a company makes (deterministic, scaled from active employees). */
function monthlyRequests(ctx: AdminCtx, companyId: string) {
  const c = ctx.db.companies.find((x) => x.id === companyId)
  if (!c || c.status === "suspended") return { coach: 0, insights: 0, users: 0 }
  const s = companySettings(ctx, companyId)
  const g = globalStore(ctx)
  const coachOn = g.aiCoachEnabled && s.aiCoachEnabled
  const insightsOn = g.weeklyInsightEnabled && s.aiInsightsEnabled
  const active = c.id === "org_nimbus" ? ctx.db.employees.filter((e) => e.companyId === c.id && e.status === "active").length : c.activeCount
  const adoption = 0.18 + noise(`ai-adopt:${companyId}`, 1) * 0.22
  const users = coachOn ? Math.round(active * adoption) : 0
  const coach = coachOn ? Math.round(users * (6 + noise(`ai-req:${companyId}`, 2) * 10)) : 0
  const insights = insightsOn ? Math.round(active * 4.3) : 0
  return { coach, insights, users }
}

const costOf = (requests: number) => round(((requests * TOKENS_PER_REQUEST) / 1000) * COST_PER_1K_TOKENS, 2)

function rows(ctx: AdminCtx): AiCompanyRow[] {
  const g = globalStore(ctx)
  const limits = limitsStore(ctx)
  return [...ctx.db.companies]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => {
      const s = companySettings(ctx, c.id)
      const l = limits[c.id]
      const m = monthlyRequests(ctx, c.id)
      const dayOfMonth = new Date().getDate()
      const cost = costOf(((m.coach + m.insights) * dayOfMonth) / 30)
      const budget = l?.monthlyBudget ?? g.defaultCompanyBudget
      return {
        companyId: c.id,
        name: c.name,
        status: c.status,
        planName: planOf(ctx, c.planId)?.name ?? "—",
        inPlan: c.modules.includes("ai_coach"),
        aiCoachEnabled: s.aiCoachEnabled,
        aiInsightsEnabled: s.aiInsightsEnabled,
        monthlyLimitPerEmployee: l?.monthlyLimitPerEmployee ?? g.monthlyLimitPerEmployee,
        monthlyBudget: budget,
        usesDefaults: !l,
        costThisMonth: cost,
        budgetUsed: ratio(cost, budget),
      }
    })
}

const positiveInt = (v: unknown, field: string, errors: Record<string, string>, max: number) => {
  if (typeof v !== "number" || !Number.isFinite(v)) errors[field] = "Enter a number"
  else if (!Number.isInteger(v)) errors[field] = "Use a whole number"
  else if (v <= 0) errors[field] = "Limits must be positive numbers"
  else if (v > max) errors[field] = `Must be ${max.toLocaleString("en-IN")} or less`
}

function computeUsage(ctx: AdminCtx, q: AiUsageQuery): AiUsageData {
  const days = PERIOD_DAYS[q.period]
  const limits = limitsStore(ctx)
  const g = globalStore(ctx)
  const companies = ctx.db.companies.filter((c) => !q.companyId || c.id === q.companyId)
  const byCompany = companies
    .map((c) => {
      const m = monthlyRequests(ctx, c.id)
      const requests = Math.round(((m.coach + m.insights) * days) / 30)
      const budget = limits[c.id]?.monthlyBudget ?? g.defaultCompanyBudget
      const cost = costOf(requests)
      return { companyId: c.id, name: c.name, requests, tokens: requests * TOKENS_PER_REQUEST, cost, budget, budgetUsed: ratio(costOf(m.coach + m.insights), budget), activeUsers: m.users }
    })
    .filter((r) => r.requests > 0)
    .sort((a, b) => b.cost - a.cost)
  const totalRequests = sum(byCompany, (r) => r.requests)
  const insightsSent = Math.round((sum(companies, (c) => monthlyRequests(ctx, c.id).insights) * days) / 30)
  const points = q.period === "12m" ? 52 : days
  const step = q.period === "12m" ? 7 : 1
  const perPoint = totalRequests / points
  const series = dailySeries(`ai:${q.companyId ?? "all"}`, points, { base: perPoint, variance: 0.14, trend: 0.18, weekendDip: step === 1 ? 0.3 : 0 })
  const scale = series.length ? totalRequests / Math.max(1, sum(series, (p) => p.value)) : 0
  const trend = series.map((p, i) => {
    const requests = Math.round(p.value * scale)
    const date = step === 1 ? p.date : new Date(Date.now() - (points - 1 - i) * 7 * 86_400_000).toISOString().slice(0, 10)
    return { date, requests, cost: costOf(requests) }
  })
  const prevFactor = 0.84 + noise(`ai-prev:${q.companyId ?? "all"}:${q.period}`, 1) * 0.1
  return {
    totals: { requests: totalRequests, tokens: totalRequests * TOKENS_PER_REQUEST, cost: costOf(totalRequests), activeUsers: sum(byCompany, (r) => r.activeUsers), insightsSent },
    previous: { requests: Math.round(totalRequests * prevFactor), cost: costOf(Math.round(totalRequests * prevFactor)) },
    trend,
    byCompany,
  }
}

export const aiApi = {
  settings: endpoint<void, AiSettingsData, "admin">("admin", "GET", "/platform/ai-settings", (_, ctx) => {
    requireAdmin(ctx)
    return { global: { ...globalStore(ctx) }, companies: rows(ctx) }
  }),

  updateGlobal: endpoint<AiGlobalSettings, AiGlobalSettings, "admin">("admin", "PUT", "/platform/ai-settings", (input, ctx) => {
    requireAdmin(ctx, "ai.manage")
    const errors: Record<string, string> = {}
    positiveInt(input.monthlyLimitPerEmployee, "monthlyLimitPerEmployee", errors, 1000)
    positiveInt(input.defaultCompanyBudget, "defaultCompanyBudget", errors, 10_000_000)
    const msg = String(input.crisisEscalationMessage ?? "").trim()
    if (msg.length < 20) errors.crisisEscalationMessage = "Write a supportive message (at least 20 characters)"
    if (msg.length > 500) errors.crisisEscalationMessage = "Keep it under 500 characters"
    if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
    const g = globalStore(ctx)
    const before = { ...g }
    Object.assign(g, {
      aiCoachEnabled: !!input.aiCoachEnabled,
      weeklyInsightEnabled: !!input.weeklyInsightEnabled,
      monthlyLimitPerEmployee: input.monthlyLimitPerEmployee,
      defaultCompanyBudget: input.defaultCompanyBudget,
      blockMedicalDiagnosis: !!input.blockMedicalDiagnosis,
      piiRedaction: !!input.piiRedaction,
      crisisEscalationMessage: msg,
    })
    const changed = (Object.keys(g) as (keyof AiGlobalSettings)[]).filter((k) => g[k] !== before[k])
    const safety = changed.some((k) => k === "blockMedicalDiagnosis" || k === "piiRedaction" || k === "crisisEscalationMessage")
    audit(ctx, { action: "Updated global AI settings", entityType: "AI settings", entityName: "Platform defaults", severity: safety ? "critical" : "warning" })
    ctx.db.auditLogs[0]!.details = changed.length ? `Changed: ${changed.join(", ")}` : "No changes"
    ctx.save()
    return { ...g }
  }),

  updateCompany: endpoint<
    { companyId: string; aiCoachEnabled?: boolean; aiInsightsEnabled?: boolean; monthlyLimitPerEmployee?: number; monthlyBudget?: number; resetLimits?: boolean },
    AiCompanyRow,
    "admin"
  >("admin", "PUT", "/platform/ai-settings/companies/:companyId", (input, ctx) => {
    requireAdmin(ctx, "ai.manage")
    const c = findCompany(ctx, input.companyId)
    const s = companySettings(ctx, c.id, true)
    const changes: string[] = []
    if (input.aiCoachEnabled !== undefined && input.aiCoachEnabled !== s.aiCoachEnabled) {
      if (input.aiCoachEnabled && !c.modules.includes("ai_coach")) throw badRequest(`${c.name}'s plan doesn't include the AI Wellness Coach. Add the module first.`)
      s.aiCoachEnabled = input.aiCoachEnabled
      changes.push(`AI coach ${input.aiCoachEnabled ? "on" : "off"}`)
    }
    if (input.aiInsightsEnabled !== undefined && input.aiInsightsEnabled !== s.aiInsightsEnabled) {
      s.aiInsightsEnabled = input.aiInsightsEnabled
      changes.push(`weekly insight ${input.aiInsightsEnabled ? "on" : "off"}`)
    }
    const limits = limitsStore(ctx)
    if (input.resetLimits) {
      if (limits[c.id]) changes.push("limits reset to platform defaults")
      delete limits[c.id]
    } else if (input.monthlyLimitPerEmployee !== undefined || input.monthlyBudget !== undefined) {
      const g = globalStore(ctx)
      const current = limits[c.id] ?? { monthlyLimitPerEmployee: g.monthlyLimitPerEmployee, monthlyBudget: g.defaultCompanyBudget }
      const next = { monthlyLimitPerEmployee: input.monthlyLimitPerEmployee ?? current.monthlyLimitPerEmployee, monthlyBudget: input.monthlyBudget ?? current.monthlyBudget }
      const errors: Record<string, string> = {}
      positiveInt(next.monthlyLimitPerEmployee, "monthlyLimitPerEmployee", errors, 1000)
      positiveInt(next.monthlyBudget, "monthlyBudget", errors, 10_000_000)
      if (Object.keys(errors).length) throw badRequest("Limits must be positive numbers.", errors)
      limits[c.id] = next
      changes.push(`limit ${next.monthlyLimitPerEmployee}/employee, budget ₹${next.monthlyBudget}`)
    }
    if (changes.length) {
      audit(ctx, { action: "Updated company AI settings", entityType: "AI settings", entityName: c.name, severity: "warning" })
      ctx.db.auditLogs[0]!.details = changes.join("; ")
    }
    ctx.save()
    return rows(ctx).find((r) => r.companyId === c.id)!
  }),

  usage: endpoint<AiUsageQuery, AiUsageData, "admin">("admin", "GET", "/platform/ai-usage", (q, ctx) => {
    requireAdmin(ctx)
    return computeUsage(ctx, q)
  }),

  exportUsage: endpoint<AiUsageQuery, { fileName: string; csv: string }, "admin">("admin", "GET", "/platform/ai-usage/export", (q, ctx) => {
    requireAdmin(ctx)
    const data = computeUsage(ctx, q)
    if (!data.byCompany.length) throw badRequest("No AI usage yet for this period.")
    const csv = toCsv(
      ["Company", "Requests", "Tokens", "Cost (INR)", "Monthly budget (INR)", "Budget used this month", "Active AI users"],
      data.byCompany.map((r) => [r.name, r.requests, r.tokens, r.cost.toFixed(2), r.budget, `${Math.round(r.budgetUsed * 100)}%`, r.activeUsers]),
    )
    audit(ctx, { action: "Exported AI usage (CSV)", entityType: "Report", entityName: "AI usage" })
    ctx.save()
    return { fileName: `healthx-ai-usage-${q.period}-${today()}.csv`, csv }
  }),
}
