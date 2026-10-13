/** Shared helpers for Business Portal mock services. */
import type { BusinessSession } from "@/lib/auth/session"
import type { CompanySettings, Employee } from "@/lib/types"
import { defaultCompanySettings } from "@/lib/mock/defaults"
import { forbidden, type MockContext } from "../core"

export type BusinessCtx = MockContext<"business">

export const companyEmployees = (ctx: BusinessCtx, includeDeactivated = false) => {
  const companyId = ctx.companyId()
  return ctx.db.employees.filter((e) => e.companyId === companyId && (includeDeactivated || e.status !== "deactivated"))
}

export const companySettings = (ctx: BusinessCtx): CompanySettings => {
  const companyId = ctx.companyId()
  if (!ctx.db.settings[companyId]) ctx.db.settings[companyId] = defaultCompanySettings(companyId)
  return ctx.db.settings[companyId]!
}

/** Employees who have joined the app (eligible for participation figures). */
export const isJoined = (e: Employee) => e.status === "active" || e.status === "registered" || e.status === "inactive"

/**
 * Narrow employees to the scope a user may see:
 * Team Managers only ever see their own teams; others may filter by department/team.
 */
export function scopeEmployees(ctx: BusinessCtx, employees: Employee[], filter: { departmentId?: string; teamId?: string }) {
  const session = ctx.session() as BusinessSession
  let list = employees
  if (session.role === "team_manager") list = list.filter((e) => session.teamIds.includes(e.teamId))
  if (filter.departmentId) list = list.filter((e) => e.departmentId === filter.departmentId)
  if (filter.teamId) list = list.filter((e) => e.teamId === filter.teamId)
  return list
}

export function requireRole(ctx: BusinessCtx, roles: BusinessSession["role"][]) {
  const session = ctx.session() as BusinessSession
  if (!roles.includes(session.role)) throw forbidden()
  return session
}

/** Hide aggregates for groups smaller than the company's minimum group size. */
export function suppressed(count: number, ctx: BusinessCtx) {
  return count < companySettings(ctx).minAnalyticsGroupSize
}

export const ratio = (a: number, b: number) => (b > 0 ? a / b : 0)

export const PERIOD_DAYS = { "7d": 7, "30d": 30, "90d": 90 } as const
export type Period = keyof typeof PERIOD_DAYS
