/**
 * Platform Admin — Audit logs (SCR-P-025, #327) incl. the personal-data access log (#361, Phase 2).
 * Read-only, immutable entries across the platform. Exporting is itself audit-logged
 * (as a personal-data access event, because the export contains names and IP addresses).
 */
import type { AuditLog } from "@/lib/types"
import { DAY_MS, noise } from "@/lib/mock/series"
import { audit, badRequest, endpoint, matchesSearch, notFound, paginate } from "../core"
import { companyName, requireAdmin, syntheticPerson, toCsv, today, type AdminCtx } from "./common"

export type AuditRange = "24h" | "7d" | "30d" | "90d" | "all" | "custom"
export const AUDIT_RANGE_LABEL: Record<AuditRange, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
  custom: "Custom range",
}

export interface AuditQuery {
  search?: string
  /** Company id, or "platform" for platform-level entries only. */
  org?: string
  actor?: string
  action?: string
  severity?: AuditLog["severity"]
  /** "personal_data" = only personal-data access events (#361). */
  category?: "personal_data"
  range?: AuditRange
  /** YYYY-MM-DD (custom range). */
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export interface AuditRow extends AuditLog {
  companyName: string
  portal: string
  /** Someone viewed, changed, deleted or exported personal data (#361). */
  personalData: boolean
}

export interface AuditFacets {
  actors: { name: string; role: string }[]
  actions: string[]
  companies: { id: string; name: string }[]
}

const PERSONAL_DATA_RE =
  /personal data|exported (employees|employee list|users|user directory|audit logs)|(viewed|updated|changed|deactivated|reactivated|deleted|anonymi[sz]ed|unlocked).*(employee|user|account|profile)/i

/** True when the entry records access to, or a change/deletion/export of, personal data. */
export const isPersonalDataEvent = (l: Pick<AuditLog, "action" | "entityType">) => l.entityType === "Personal data" || PERSONAL_DATA_RE.test(l.action)

const portalOf = (l: AuditLog) =>
  l.companyId === null ? "Platform Admin Portal" : /employee/i.test(l.actorRole) ? "Employee App" : /admin$/i.test(l.actorRole) && /super|support|content/i.test(l.actorRole) ? "Platform Admin Portal" : "Business Portal"

const toRow = (ctx: AdminCtx, l: AuditLog): AuditRow => ({
  ...l,
  companyName: l.companyId ? companyName(ctx, l.companyId) : "Platform",
  portal: portalOf(l),
  personalData: isPersonalDataEvent(l),
})

/** Sample personal-data access events (#361), added once to the shared audit log. */
function ensurePersonalDataEvents(ctx: AdminCtx) {
  ctx.extra("admin-audit-personal-data-seeded", () => {
    const staff = [
      { name: "Meera Joshi", role: "Support Admin" },
      { name: "Ishaan Gupta", role: "Support Admin" },
      { name: "Arjun Nair", role: "Super Admin" },
    ]
    const hr = [
      { name: "Vikram Mehta", role: "HR Admin" },
      { name: "Ananya Iyer", role: "Company Owner" },
    ]
    const nimbus = ctx.db.employees.filter((e) => e.companyId === "org_nimbus")
    const others = ctx.db.companies.filter((c) => c.id !== "org_nimbus" && c.status !== "onboarding")
    const pick = <T,>(list: T[], i: number, salt: string) => list[Math.floor(noise(`pda:${salt}`, i) * list.length)]!
    const ip = (i: number, prefix: number) => `${prefix}.${Math.floor(noise("pda:ip1", i) * 240) + 10}.${Math.floor(noise("pda:ip2", i) * 255)}.${Math.floor(noise("pda:ip3", i) * 250) + 1}`
    const when = (i: number) => new Date(Date.now() - (0.3 + noise("pda:t", i) * 44) * DAY_MS).toISOString()

    const events: AuditLog[] = []
    for (let i = 0; i < 26; i++) {
      const kind = i % 6
      const nimbusSide = i % 2 === 0 && nimbus.length > 0
      const company = nimbusSide ? ctx.db.companies.find((c) => c.id === "org_nimbus") : pick(others, i, "co")
      if (!company) continue
      const e = nimbusSide ? pick(nimbus, i, "emp") : undefined
      const person = e ? `${e.firstName} ${e.lastName}` : syntheticPerson(company.id, 40 + i).name
      const byHr = nimbusSide && kind !== 2 && kind !== 5
      const actor = byHr ? pick(hr, i, "hr") : pick(staff, i, "staff")
      const base = { companyId: company.id, actorName: actor.name, actorRole: actor.role, entityType: "Personal data", ip: ip(i, byHr ? 49 : 103), createdAt: when(i) }
      const id = `aud_pda_${String(i + 1).padStart(3, "0")}`
      if (kind === 0)
        events.push({ ...base, id, action: "Viewed personal data", entityName: `Employee profile · ${person}`, severity: "info", details: byHr ? "Fields: name, work email, employee ID, department, team, status. No health data." : `Fields: name, work email, phone, account status, last sign-in. Reason: support ticket SUP-${3100 + (i % 14)}.` })
      else if (kind === 1)
        events.push({ ...base, id, action: "Exported personal data", entityName: byHr ? "Employee list (CSV)" : `User directory · ${company.name}`, severity: "warning", details: `Fields: name, work email, employee ID, department, team, status. ${Math.round(40 + noise("pda:n", i) * 600)} records. No health data.` })
      else if (kind === 2)
        events.push({ ...base, id, action: "Viewed personal data", entityName: `Account lookup · ${person}`, severity: "info", details: "Searched by work email from Employee support tools. Fields: name, email, company, account status, tracker connection status." })
      else if (kind === 3)
        events.push({ ...base, id, action: "Updated personal data", entityName: `Employee profile · ${person}`, severity: "warning", details: byHr ? "Changed: job title, team." : "Changed: work email (typo correction) at the employee's request." })
      else if (kind === 4)
        events.push({ ...base, id, action: "Deleted personal data", entityName: `Employee account · ${person}`, severity: "critical", details: "Account deletion request completed after the 30-day grace period. Profile, health data and consent records removed; anonymised points history kept." })
      else
        events.push({ ...base, id, action: "Unlocked account", entityName: `Employee account · ${person}`, severity: "warning", details: "Sign-in unlocked after 5 failed attempts. Identity confirmed via work email." })
    }
    ctx.db.auditLogs.push(...events)
    ctx.db.auditLogs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return true
  })
}

const RANGE_DAYS: Partial<Record<AuditRange, number>> = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 }

function filterLogs(ctx: AdminCtx, q: AuditQuery) {
  ensurePersonalDataEvents(ctx)
  if (q.range === "custom" && q.from && q.to && q.from > q.to) throw badRequest("The start date must be before the end date.", { from: "Start must be before end" })
  const now = Date.now()
  const days = q.range ? RANGE_DAYS[q.range] : undefined
  const fromMs = q.range === "custom" && q.from ? new Date(`${q.from}T00:00:00`).getTime() : undefined
  const toMs = q.range === "custom" && q.to ? new Date(`${q.to}T23:59:59.999`).getTime() : undefined
  return ctx.db.auditLogs.filter((l) => {
    const t = new Date(l.createdAt).getTime()
    if (days !== undefined && now - t > days * DAY_MS) return false
    if (fromMs !== undefined && t < fromMs) return false
    if (toMs !== undefined && t > toMs) return false
    if (q.org === "platform" ? l.companyId !== null : q.org && l.companyId !== q.org) return false
    if (q.actor && l.actorName !== q.actor) return false
    if (q.action && l.action !== q.action) return false
    if (q.severity && l.severity !== q.severity) return false
    if (q.category === "personal_data" && !isPersonalDataEvent(l)) return false
    return matchesSearch(q.search, l.action, l.actorName, l.entityName, l.entityType, l.ip, l.details, l.companyId ? companyName(ctx, l.companyId) : "Platform")
  })
}

export const auditApi = {
  list: endpoint<AuditQuery, { items: AuditRow[]; total: number; page: number; pageSize: number }, "admin">(
    "admin",
    "GET",
    "/platform/audit-logs",
    (q, ctx) => {
      requireAdmin(ctx)
      const rows = [...filterLogs(ctx, q)].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      const page = paginate(rows, q.page ?? 1, q.pageSize ?? 20)
      return { ...page, items: page.items.map((l) => toRow(ctx, l)) }
    },
  ),

  facets: endpoint<void, AuditFacets, "admin">("admin", "GET", "/platform/audit-logs/facets", (_, ctx) => {
    requireAdmin(ctx)
    ensurePersonalDataEvents(ctx)
    const actors = new Map<string, string>()
    const actions = new Set<string>()
    for (const l of ctx.db.auditLogs) {
      if (!actors.has(l.actorName)) actors.set(l.actorName, l.actorRole)
      actions.add(l.action)
    }
    return {
      actors: [...actors].map(([name, role]) => ({ name, role })).sort((a, b) => a.name.localeCompare(b.name)),
      actions: [...actions].sort((a, b) => a.localeCompare(b)),
      companies: ctx.db.companies.map((c) => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name)),
    }
  }),

  get: endpoint<{ id: string }, AuditRow, "admin">("admin", "GET", "/platform/audit-logs/:id", ({ id }, ctx) => {
    requireAdmin(ctx)
    const l = ctx.db.auditLogs.find((x) => x.id === id)
    if (!l) throw notFound("Audit entry")
    return toRow(ctx, l)
  }),

  exportCsv: endpoint<AuditQuery, { fileName: string; csv: string; count: number }, "admin">("admin", "GET", "/platform/audit-logs/export", (q, ctx) => {
    requireAdmin(ctx, "audit.export")
    const rows = [...filterLogs(ctx, q)].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (!rows.length) throw badRequest("There are no entries to export for these filters.")
    const csv = toCsv(
      ["Date/time (UTC)", "Company", "Actor", "Actor role", "Action", "Target type", "Target", "Severity", "Personal data access", "IP address", "Details", "Entry ID"],
      rows.map((l) => [l.createdAt, l.companyId ? companyName(ctx, l.companyId) : "Platform", l.actorName, l.actorRole, l.action, l.entityType, l.entityName, l.severity, isPersonalDataEvent(l) ? "Yes" : "No", l.ip, l.details ?? "", l.id]),
    )
    // The export contains names and IP addresses, so it is itself a personal-data access event (#361).
    audit(ctx, { action: "Exported audit logs (CSV)", entityType: "Personal data", entityName: `Audit log export · ${rows.length} entries`, severity: "warning" })
    ctx.db.auditLogs[0]!.details = `Contains actor names, roles and IP addresses for ${rows.length} entries${q.category === "personal_data" ? " (personal-data access only)" : ""}.`
    ctx.save()
    return { fileName: `healthx-audit-logs-${q.category === "personal_data" ? "personal-data-" : ""}${today()}.csv`, csv, count: rows.length }
  }),
}
