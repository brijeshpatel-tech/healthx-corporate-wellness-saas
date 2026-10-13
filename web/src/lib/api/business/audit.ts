/**
 * Business Portal — company audit log viewer (SCR-B-043, Phase 2) incl. the
 * personal-data access log (#361): who viewed, changed, exported or removed personal data. Read-only.
 */
import type { AuditLog, Paginated } from "@/lib/types"
import { audit, endpoint, paginate } from "../core"
import { requireRole, type BusinessCtx } from "./common"

export type PersonalAccess = "viewed" | "modified" | "exported" | "removed"

export interface AuditQuery {
  from?: string // YYYY-MM-DD
  to?: string // YYYY-MM-DD
  actor?: string
  entityType?: string
  severity?: AuditLog["severity"]
  /** "personal_data" = only entries that touch an individual's personal data. */
  scope?: "all" | "personal_data"
  access?: PersonalAccess
  search?: string
  page?: number
  pageSize?: number
}

export interface AuditRow extends AuditLog {
  personalData: boolean
  access?: PersonalAccess
}

export interface AuditPage extends Paginated<AuditRow> {
  actors: string[]
  entityTypes: string[]
  personalCount: number
}

const OWNER: "company_owner"[] = ["company_owner"]
const PERSONAL_TYPES = new Set(["Employee", "Administrator", "Import"])

function classify(l: AuditLog): AuditRow {
  const personal = PERSONAL_TYPES.has(l.entityType) || (l.entityType === "Report" && /employee/i.test(l.action))
  if (!personal) return { ...l, personalData: false }
  const a = l.action.toLowerCase()
  const access: PersonalAccess = a.includes("viewed") ? "viewed" : a.includes("export") ? "exported" : /deactivat|delet|remov|revok/.test(a) ? "removed" : "modified"
  return { ...l, personalData: true, access }
}

function filtered(ctx: BusinessCtx, q: AuditQuery) {
  const companyId = ctx.companyId()
  const from = q.from ? new Date(`${q.from}T00:00:00`).getTime() : null
  const to = q.to ? new Date(`${q.to}T23:59:59.999`).getTime() : null
  const search = q.search?.trim().toLowerCase()
  const all = ctx.db.auditLogs.filter((l) => l.companyId === companyId).map(classify)
  const rows = all.filter((l) => {
    const t = new Date(l.createdAt).getTime()
    if (from !== null && t < from) return false
    if (to !== null && t > to) return false
    if (q.scope === "personal_data" && !l.personalData) return false
    if (q.access && l.access !== q.access) return false
    if (q.actor && l.actorName !== q.actor) return false
    if (q.entityType && l.entityType !== q.entityType) return false
    if (q.severity && l.severity !== q.severity) return false
    if (search && !`${l.action} ${l.entityName} ${l.actorName} ${l.ip}`.toLowerCase().includes(search)) return false
    return true
  })
  return { all, rows: rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }
}

export const auditApi = {
  list: endpoint<AuditQuery, AuditPage, "business">("business", "GET", "/organization/audit-logs", (q, ctx) => {
    requireRole(ctx, OWNER)
    const { all, rows } = filtered(ctx, q)
    return {
      ...paginate(rows, q.page ?? 1, q.pageSize ?? 20),
      actors: [...new Set(all.map((l) => l.actorName))].sort(),
      entityTypes: [...new Set(all.map((l) => l.entityType))].sort(),
      personalCount: all.filter((l) => l.personalData).length,
    }
  }),

  /** The export itself is recorded in the log. */
  exportCsv: endpoint<AuditQuery, { fileName: string; csv: string; count: number }, "business">("business", "GET", "/organization/audit-logs/export", (q, ctx) => {
    requireRole(ctx, OWNER)
    const { rows } = filtered(ctx, q)
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    const header = ["Date/time (UTC)", "User", "Role", "Action", "Target type", "Target", "Personal data", "IP address", "Severity"]
    const lines = rows.map((l) => [l.createdAt, l.actorName, l.actorRole, l.action, l.entityType, l.entityName, l.personalData ? l.access ?? "yes" : "", l.ip, l.severity].map(esc).join(","))
    const label = q.scope === "personal_data" ? "personal-data-access-log" : "audit-log"
    audit(ctx, { action: `Exported ${q.scope === "personal_data" ? "personal-data access log" : "audit log"} (CSV)`, entityType: "Report", entityName: `${rows.length} entries`, companyId: ctx.companyId() })
    ctx.save()
    return { fileName: `${label}-${new Date().toISOString().slice(0, 10)}.csv`, csv: [header.join(","), ...lines].join("\n"), count: rows.length }
  }),
}
