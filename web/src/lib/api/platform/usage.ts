/**
 * Platform Admin — Feature usage (SCR-P-027) and API usage (SCR-P-028). Phase 2.
 * Deterministic figures scaled from each company's active users and enabled modules.
 */
import { DAY_MS, dailySeries, noise } from "@/lib/mock/series"
import type { Company, ModuleCode } from "@/lib/types"
import { MODULE_LABEL } from "@/lib/types"
import { audit, badRequest, endpoint } from "../core"
import { PERIOD_DAYS, PERIOD_LABEL, ratio, requireAdmin, round, sum, toCsv, today, type AdminCtx, type Period } from "./common"

// ─── Feature usage ──────────────────────────────────────────────────────

/** Share of a company's active users who use the feature, and events per user per day. */
const FEATURES: { module: ModuleCode; adoption: number; eventsPerUserDay: number; phase: 1 | 2 }[] = [
  { module: "activity", adoption: 0.93, eventsPerUserDay: 3.2, phase: 1 },
  { module: "water", adoption: 0.54, eventsPerUserDay: 2.6, phase: 1 },
  { module: "challenges", adoption: 0.58, eventsPerUserDay: 1.1, phase: 1 },
  { module: "leaderboards", adoption: 0.49, eventsPerUserDay: 0.9, phase: 1 },
  { module: "workouts", adoption: 0.36, eventsPerUserDay: 0.5, phase: 1 },
  { module: "habits", adoption: 0.31, eventsPerUserDay: 1.4, phase: 1 },
  { module: "rewards", adoption: 0.27, eventsPerUserDay: 0.2, phase: 1 },
  { module: "announcements", adoption: 0.62, eventsPerUserDay: 0.3, phase: 1 },
  { module: "analytics", adoption: 0.04, eventsPerUserDay: 0.6, phase: 1 },
  { module: "sleep", adoption: 0.29, eventsPerUserDay: 0.9, phase: 2 },
  { module: "nutrition", adoption: 0.18, eventsPerUserDay: 1.8, phase: 2 },
  { module: "programs", adoption: 0.21, eventsPerUserDay: 0.6, phase: 2 },
  { module: "content", adoption: 0.33, eventsPerUserDay: 0.7, phase: 2 },
  { module: "ai_coach", adoption: 0.24, eventsPerUserDay: 0.5, phase: 2 },
  { module: "integrations", adoption: 0.12, eventsPerUserDay: 0.4, phase: 2 },
]

export interface FeatureUsageQuery {
  period: Period
  companyId?: string
  feature?: ModuleCode
}

export interface FeatureUsageRow {
  module: ModuleCode
  label: string
  phase: 1 | 2
  users: number
  companies: number
  enabledCompanies: number
  events: number
  adoption: number
  delta: number
  trend: number[]
}

export interface FeatureUsageData {
  periodLabel: string
  totals: { users: number; events: number; activeUsers: number; featuresInUse: number }
  rows: FeatureUsageRow[]
  daily: { date: string; events: number }[]
}

const activeOf = (ctx: AdminCtx, c: Company) =>
  c.status === "suspended" ? 0 : ctx.db.employees.some((e) => e.companyId === c.id) ? ctx.db.employees.filter((e) => e.companyId === c.id && e.status === "active").length : c.activeCount

function featureUsage(ctx: AdminCtx, q: FeatureUsageQuery): FeatureUsageData {
  const days = PERIOD_DAYS[q.period]
  const companies = ctx.db.companies.filter((c) => !q.companyId || c.id === q.companyId)
  const activeUsers = sum(companies, (c) => activeOf(ctx, c))
  const sparkPoints = q.period === "7d" ? 7 : 12
  const rows = FEATURES.filter((f) => !q.feature || f.module === q.feature).map((f) => {
    const enabled = companies.filter((c) => c.modules.includes(f.module))
    const per = enabled.map((c) => {
      const users = Math.round(activeOf(ctx, c) * Math.min(1, f.adoption * (0.8 + noise(`fu:${f.module}:${c.id}`, 1) * 0.4)))
      return { c, users }
    })
    const users = sum(per, (p) => p.users)
    const usingCompanies = per.filter((p) => p.users > 0).length
    const events = Math.round(users * f.eventsPerUserDay * days * (0.9 + noise(`fe:${f.module}:${q.companyId ?? "all"}`, days) * 0.2))
    const trendSeries = dailySeries(`ft:${f.module}:${q.companyId ?? "all"}:${q.period}`, sparkPoints, { base: Math.max(1, events / sparkPoints), variance: 0.12, trend: f.phase === 2 ? 0.35 : 0.1 })
    return {
      module: f.module,
      label: MODULE_LABEL[f.module],
      phase: f.phase,
      users,
      companies: usingCompanies,
      enabledCompanies: enabled.length,
      events,
      adoption: ratio(users, activeUsers),
      delta: round((f.phase === 2 ? 0.08 : -0.02) + noise(`fd:${f.module}:${q.period}:${q.companyId ?? "all"}`, 1) * 0.16, 3),
      trend: trendSeries.map((p) => Math.round(p.value)),
    }
  })
  rows.sort((a, b) => b.users - a.users)
  const totalEvents = sum(rows, (r) => r.events)
  const daily = dailySeries(`fdaily:${q.companyId ?? "all"}:${q.feature ?? "all"}`, Math.min(days, 90), { base: totalEvents / days, variance: 0.1, trend: 0.08, weekendDip: 0.32 }).map((p) => ({ date: p.date, events: Math.round(p.value) }))
  return {
    periodLabel: PERIOD_LABEL[q.period],
    totals: { users: Math.max(0, ...rows.map((r) => r.users)), events: totalEvents, activeUsers, featuresInUse: rows.filter((r) => r.users > 0).length },
    rows,
    daily,
  }
}

// ─── API usage ──────────────────────────────────────────────────────────

export const ENDPOINT_GROUPS = [
  { id: "auth", label: "Auth & sessions", share: 0.09, errorRate: 0.012, p95: 180 },
  { id: "health_sync", label: "Health data sync", share: 0.38, errorRate: 0.018, p95: 420 },
  { id: "activity", label: "Activity & goals", share: 0.17, errorRate: 0.006, p95: 210 },
  { id: "challenges", label: "Challenges & leaderboards", share: 0.14, errorRate: 0.008, p95: 340 },
  { id: "rewards", label: "Points & rewards", share: 0.06, errorRate: 0.01, p95: 260 },
  { id: "organization", label: "Organisation & employees", share: 0.07, errorRate: 0.009, p95: 290 },
  { id: "analytics", label: "Analytics & reports", share: 0.04, errorRate: 0.014, p95: 880 },
  { id: "integrations", label: "Integrations & webhooks", share: 0.05, errorRate: 0.031, p95: 640 },
] as const

export type EndpointGroup = (typeof ENDPOINT_GROUPS)[number]["id"]

export const API_CLIENTS = ["Employee mobile app", "Business Portal", "HRMS integration", "Slack / Teams", "Public API"] as const

export type ApiGroupBy = "company" | "client" | "endpoint"

export interface ApiUsageQuery {
  period: Period
  companyId?: string
  group?: EndpointGroup
  groupBy?: ApiGroupBy
}

export interface ApiUsageRow {
  id: string
  name: string
  detail?: string
  requests: number
  errors: number
  errorRate: number
  p95: number
  rateLimitHits: number
}

export interface ApiUsageData {
  periodLabel: string
  totals: { requests: number; errors: number; errorRate: number; p95: number; rateLimitHits: number }
  previous: { requests: number; errorRate: number; p95: number }
  series: { date: string; requests: number; errorRate: number; p95: number }[]
  rows: ApiUsageRow[]
}

/** Requests per active user per day for each API client. */
const CLIENT_MIX: Record<(typeof API_CLIENTS)[number], number> = {
  "Employee mobile app": 38,
  "Business Portal": 0.9,
  "HRMS integration": 0.6,
  "Slack / Teams": 0.3,
  "Public API": 0.2,
}

function apiUsage(ctx: AdminCtx, q: ApiUsageQuery): ApiUsageData {
  const days = PERIOD_DAYS[q.period]
  const companies = ctx.db.companies.filter((c) => (!q.companyId || c.id === q.companyId) && c.status !== "suspended")
  const groups = ENDPOINT_GROUPS.filter((g) => !q.group || g.id === q.group)

  // Base cells: company × client × endpoint group
  type Cell = { company: Company; client: string; group: (typeof ENDPOINT_GROUPS)[number]; requests: number; errors: number; p95: number; rateLimitHits: number }
  const cells: Cell[] = []
  for (const c of companies) {
    const active = activeOf(ctx, c)
    const hasIntegration = c.modules.includes("integrations") || c.id === "org_nimbus"
    for (const [client, perUser] of Object.entries(CLIENT_MIX)) {
      if ((client === "HRMS integration" || client === "Slack / Teams" || client === "Public API") && !hasIntegration) continue
      const clientTotal = active * perUser * days * (0.85 + noise(`api:${c.id}:${client}`, 1) * 0.3)
      for (const g of groups) {
        const fit = client === "Employee mobile app" ? 1 : client === "Business Portal" ? (g.id === "health_sync" ? 0 : 1) : g.id === "integrations" || g.id === "organization" ? 3 : 0
        if (!fit) continue
        const requests = Math.round(clientTotal * g.share * fit)
        if (!requests) continue
        const errRate = g.errorRate * (0.6 + noise(`apierr:${c.id}:${client}:${g.id}`, 1) * 0.9) * (c.id === "org_nimbus" && g.id === "integrations" ? 3 : 1)
        const p95 = Math.round(g.p95 * (0.85 + noise(`apip95:${c.id}:${g.id}`, 1) * 0.35))
        const rl = Math.round(requests * (g.id === "health_sync" || g.id === "integrations" ? 0.0011 : 0.0002) * noise(`apirl:${c.id}:${client}:${g.id}`, 1))
        cells.push({ company: c, client, group: g, requests, errors: Math.round(requests * errRate), p95, rateLimitHits: rl })
      }
    }
  }

  const groupBy = q.groupBy ?? "company"
  const keyOf = (cell: Cell) => (groupBy === "company" ? cell.company.id : groupBy === "client" ? cell.client : cell.group.id)
  const nameOf = (cell: Cell) => (groupBy === "company" ? cell.company.name : groupBy === "client" ? cell.client : cell.group.label)
  const agg = new Map<string, ApiUsageRow & { p95w: number }>()
  for (const cell of cells) {
    const k = keyOf(cell)
    const row = agg.get(k) ?? { id: k, name: nameOf(cell), detail: groupBy === "company" ? cell.company.industry : undefined, requests: 0, errors: 0, errorRate: 0, p95: 0, rateLimitHits: 0, p95w: 0 }
    row.requests += cell.requests
    row.errors += cell.errors
    row.rateLimitHits += cell.rateLimitHits
    row.p95w += cell.p95 * cell.requests
    agg.set(k, row)
  }
  const rows = [...agg.values()]
    .map(({ p95w, ...r }) => ({ ...r, errorRate: ratio(r.errors, r.requests), p95: Math.round(ratio(p95w, r.requests)) }))
    .sort((a, b) => b.requests - a.requests)

  const requests = sum(cells, (c) => c.requests)
  const errors = sum(cells, (c) => c.errors)
  const p95 = Math.round(ratio(sum(cells, (c) => c.p95 * c.requests), requests))
  const weekly = q.period === "12m"
  const points = weekly ? 52 : days
  const key = `api:${q.companyId ?? "all"}:${q.group ?? "all"}`
  const reqSeries = dailySeries(`${key}:req`, points, { base: requests / points, variance: 0.1, trend: 0.12, weekendDip: weekly ? 0 : 0.3 })
  const reqScale = requests / Math.max(1, sum(reqSeries, (p) => p.value))
  const errSeries = dailySeries(`${key}:err`, points, { base: ratio(errors, requests), variance: 0.2, round: 5 })
  const latSeries = dailySeries(`${key}:p95`, points, { base: p95, variance: 0.12 })
  const series = reqSeries.map((p, i) => ({
    date: weekly ? new Date(Date.now() - (points - 1 - i) * 7 * DAY_MS).toISOString().slice(0, 10) : p.date,
    requests: Math.round(p.value * reqScale),
    errorRate: errSeries[i]!.value,
    p95: Math.round(latSeries[i]!.value),
  }))
  return {
    periodLabel: PERIOD_LABEL[q.period],
    totals: { requests, errors, errorRate: ratio(errors, requests), p95, rateLimitHits: sum(cells, (c) => c.rateLimitHits) },
    previous: { requests: Math.round(requests * (0.86 + noise(`${key}:prev`, days) * 0.08)), errorRate: ratio(errors, requests) * (0.9 + noise(`${key}:preve`, days) * 0.3), p95: Math.round(p95 * (0.94 + noise(`${key}:prevp`, days) * 0.12)) },
    series,
    rows,
  }
}

// ─── Service ────────────────────────────────────────────────────────────

export const usageApi = {
  features: endpoint<FeatureUsageQuery, FeatureUsageData, "admin">("admin", "GET", "/platform/usage/features", (q, ctx) => {
    requireAdmin(ctx)
    return featureUsage(ctx, q)
  }),

  exportFeatures: endpoint<FeatureUsageQuery, { fileName: string; csv: string }, "admin">("admin", "GET", "/platform/usage/features/export", (q, ctx) => {
    requireAdmin(ctx)
    const d = featureUsage(ctx, q)
    if (!d.rows.some((r) => r.users > 0)) throw badRequest("No usage data yet.")
    const csv = toCsv(
      ["Feature", "Phase", "Users", "Companies using", "Companies with module", "Events", "Adoption (% of active users)", "Change vs previous period"],
      d.rows.map((r) => [r.label, r.phase === 2 ? "Phase 2" : "MVP", r.users, r.companies, r.enabledCompanies, r.events, `${Math.round(r.adoption * 100)}%`, `${Math.round(r.delta * 100)}%`]),
    )
    audit(ctx, { action: "Exported feature usage (CSV)", entityType: "Report", entityName: `Feature usage · ${d.periodLabel}` })
    ctx.save()
    return { fileName: `healthx-feature-usage-${q.period}-${today()}.csv`, csv }
  }),

  api: endpoint<ApiUsageQuery, ApiUsageData, "admin">("admin", "GET", "/platform/usage/api", (q, ctx) => {
    requireAdmin(ctx)
    return apiUsage(ctx, q)
  }),

  exportApi: endpoint<ApiUsageQuery, { fileName: string; csv: string }, "admin">("admin", "GET", "/platform/usage/api/export", (q, ctx) => {
    requireAdmin(ctx)
    const d = apiUsage(ctx, q)
    if (!d.rows.length) throw badRequest("No data for this period.")
    const by = q.groupBy ?? "company"
    const csv = toCsv(
      [by === "company" ? "Company" : by === "client" ? "Client / integration" : "Endpoint group", "Requests", "Errors", "Error rate", "p95 (ms)", "Rate-limit hits"],
      d.rows.map((r) => [r.name, r.requests, r.errors, `${(r.errorRate * 100).toFixed(2)}%`, r.p95, r.rateLimitHits]),
    )
    audit(ctx, { action: "Exported API usage (CSV)", entityType: "Report", entityName: `API usage · ${d.periodLabel}` })
    ctx.save()
    return { fileName: `healthx-api-usage-${by}-${q.period}-${today()}.csv`, csv }
  }),
}
