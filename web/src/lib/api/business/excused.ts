/**
 * Business Portal — excused dates (#364): company holidays / office shutdowns and individual sick days,
 * so streaks and challenge daily targets don't penalise people. Individual entries are private:
 * only the reason's author and company admins on this screen see them; they are never shown to colleagues.
 */
import type { BusinessSession } from "@/lib/auth/session"
import { localDaysAgo, localDaysFromNow } from "@/lib/mock/series"
import { audit, badRequest, endpoint, newId, notFound } from "../core"
import { companyEmployees, requireRole, type BusinessCtx } from "./common"

export type ExcusedKind = "holiday" | "shutdown"

export interface CompanyExcusedDate {
  id: string
  name: string
  kind: ExcusedKind
  startDate: string
  endDate: string
  appliesTo: "all" | "departments" | "locations"
  targetIds: string[]
  createdBy: string
  createdAt: string
}

export interface IndividualExcusedDate {
  id: string
  employeeId: string
  startDate: string
  endDate: string
  reason?: string
  createdBy: string
  createdAt: string
}

export interface ExcusedOverview {
  company: (CompanyExcusedDate & { targetNames: string[]; days: number })[]
  individual: (IndividualExcusedDate & { employeeName: string; employeeEmail: string; avatarColor: string; departmentName: string; days: number })[]
}

export type CompanyExcusedInput = Omit<CompanyExcusedDate, "id" | "createdBy" | "createdAt">
export type IndividualExcusedInput = Omit<IndividualExcusedDate, "id" | "createdBy" | "createdAt">

interface Store {
  company: CompanyExcusedDate[]
  individual: IndividualExcusedDate[]
}

const ROLES: BusinessSession["role"][] = ["company_owner", "hr_admin"]
const DATE = /^\d{4}-\d{2}-\d{2}$/
const dayCount = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86_400_000) + 1

function store(ctx: BusinessCtx): Store {
  const all = ctx.extra<Record<string, Store>>("biz-excused-dates", () => ({}))
  const id = ctx.companyId()
  if (!all[id]) {
    const year = new Date().getFullYear()
    const employees = companyEmployees(ctx).filter((e) => e.status === "active")
    const seedDate = (m: number, d: number) => `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    all[id] = {
      company: [
        { id: "exc_c1", name: "Independence Day", kind: "holiday", startDate: seedDate(8, 15), endDate: seedDate(8, 15), appliesTo: "all", targetIds: [], createdBy: "Vikram Mehta", createdAt: `${year}-03-25T10:00:00.000Z` },
        { id: "exc_c2", name: "Gandhi Jayanti", kind: "holiday", startDate: seedDate(10, 2), endDate: seedDate(10, 2), appliesTo: "all", targetIds: [], createdBy: "Vikram Mehta", createdAt: `${year}-03-25T10:00:00.000Z` },
        { id: "exc_c3", name: "Diwali break", kind: "shutdown", startDate: seedDate(11, 9), endDate: seedDate(11, 11), appliesTo: "all", targetIds: [], createdBy: "Vikram Mehta", createdAt: `${year}-03-25T10:00:00.000Z` },
        { id: "exc_c4", name: "Pune office maintenance shutdown", kind: "shutdown", startDate: localDaysFromNow(18), endDate: localDaysFromNow(19), appliesTo: "locations", targetIds: ["loc_pune"], createdBy: "Ananya Iyer", createdAt: new Date(Date.now() - 4 * 86_400_000).toISOString() },
        { id: "exc_c5", name: "Christmas", kind: "holiday", startDate: seedDate(12, 25), endDate: seedDate(12, 25), appliesTo: "all", targetIds: [], createdBy: "Vikram Mehta", createdAt: `${year}-03-25T10:00:00.000Z` },
      ],
      individual: employees.slice(8, 11).map((e, i) => ({
        id: `exc_i${i + 1}`,
        employeeId: e.id,
        startDate: localDaysAgo(9 - i * 3),
        endDate: localDaysAgo(8 - i * 3),
        reason: i === 0 ? "Fever — doctor's note received" : undefined,
        createdBy: "Vikram Mehta",
        createdAt: new Date(Date.now() - (7 - i) * 86_400_000).toISOString(),
      })),
    }
  }
  return all[id]!
}

function validateRange(start: string, end: string, errors: Record<string, string>) {
  if (!DATE.test(start)) errors.startDate = "Choose a start date"
  if (!DATE.test(end)) errors.endDate = "Choose an end date"
  else if (DATE.test(start) && end < start) errors.endDate = "End date must be on or after the start date"
  else if (DATE.test(start) && dayCount(start, end) > 31) errors.endDate = "Excused periods can be up to 31 days"
}

export const excusedApi = {
  list: endpoint<void, ExcusedOverview, "business">("business", "GET", "/organization/excused-dates", (_i, ctx) => {
    requireRole(ctx, ROLES)
    const s = store(ctx)
    return {
      company: [...s.company]
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .map((c) => ({
          ...c,
          days: dayCount(c.startDate, c.endDate),
          targetNames:
            c.appliesTo === "departments"
              ? c.targetIds.map((id) => ctx.db.departments.find((d) => d.id === id)?.name ?? "Removed department")
              : c.appliesTo === "locations"
                ? c.targetIds.map((id) => ctx.db.locations.find((l) => l.id === id)?.name ?? "Removed location")
                : [],
        })),
      individual: [...s.individual]
        .sort((a, b) => b.startDate.localeCompare(a.startDate))
        .map((x) => {
          const e = ctx.db.employees.find((emp) => emp.id === x.employeeId)
          return {
            ...x,
            days: dayCount(x.startDate, x.endDate),
            employeeName: e ? `${e.firstName} ${e.lastName}` : "Former employee",
            employeeEmail: e?.email ?? "",
            avatarColor: e?.avatarColor ?? "#94a3b8",
            departmentName: ctx.db.departments.find((d) => d.id === e?.departmentId)?.name ?? "—",
          }
        }),
    }
  }),

  saveCompanyDate: endpoint<CompanyExcusedInput & { id?: string }, CompanyExcusedDate, "business">("business", "POST", "/organization/excused-dates", (input, ctx) => {
    const session = requireRole(ctx, ROLES)
    const errors: Record<string, string> = {}
    if (input.name.trim().length < 2) errors.name = "Enter a name, e.g. Diwali"
    validateRange(input.startDate, input.endDate, errors)
    if (input.appliesTo !== "all" && input.targetIds.length === 0) errors.targetIds = input.appliesTo === "departments" ? "Choose at least one department" : "Choose at least one location"
    if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
    const s = store(ctx)
    const record: CompanyExcusedDate = {
      id: input.id ?? newId("exc"),
      name: input.name.trim(),
      kind: input.kind,
      startDate: input.startDate,
      endDate: input.endDate,
      appliesTo: input.appliesTo,
      targetIds: input.appliesTo === "all" ? [] : input.targetIds,
      createdBy: session.user.name,
      createdAt: new Date().toISOString(),
    }
    const idx = input.id ? s.company.findIndex((c) => c.id === input.id) : -1
    if (input.id && idx < 0) throw notFound("Excused date")
    if (idx >= 0) s.company[idx] = { ...record, createdBy: s.company[idx]!.createdBy, createdAt: s.company[idx]!.createdAt }
    else s.company.push(record)
    audit(ctx, { action: `${idx >= 0 ? "Updated" : "Added"} excused ${input.kind === "holiday" ? "holiday" : "shutdown"} (${input.startDate}${input.endDate !== input.startDate ? ` to ${input.endDate}` : ""})`, entityType: "Excused date", entityName: record.name, companyId: ctx.companyId() })
    ctx.save()
    return record
  }),

  deleteCompanyDate: endpoint<{ id: string }, { ok: true }, "business">("business", "DELETE", "/organization/excused-dates/:id", ({ id }, ctx) => {
    requireRole(ctx, ROLES)
    const s = store(ctx)
    const item = s.company.find((c) => c.id === id)
    if (!item) throw notFound("Excused date")
    s.company = s.company.filter((c) => c.id !== id)
    audit(ctx, { action: "Deleted excused date", entityType: "Excused date", entityName: item.name, companyId: ctx.companyId(), severity: "warning" })
    ctx.save()
    return { ok: true }
  }),

  saveIndividual: endpoint<IndividualExcusedInput & { id?: string }, IndividualExcusedDate, "business">("business", "POST", "/organization/excused-dates/individual", (input, ctx) => {
    const session = requireRole(ctx, ROLES)
    const errors: Record<string, string> = {}
    const e = companyEmployees(ctx).find((x) => x.id === input.employeeId)
    if (!e) errors.employeeId = "Choose an employee"
    validateRange(input.startDate, input.endDate, errors)
    if (input.reason && input.reason.length > 200) errors.reason = "Keep it under 200 characters"
    if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
    const s = store(ctx)
    const overlap = s.individual.find((x) => x.id !== input.id && x.employeeId === input.employeeId && !(input.endDate < x.startDate || input.startDate > x.endDate))
    if (overlap) throw badRequest("These dates overlap an existing excused period for this person.", { startDate: "Overlaps an existing entry" })
    const record: IndividualExcusedDate = {
      id: input.id ?? newId("exi"),
      employeeId: input.employeeId,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason?.trim() || undefined,
      createdBy: session.user.name,
      createdAt: new Date().toISOString(),
    }
    const idx = input.id ? s.individual.findIndex((x) => x.id === input.id) : -1
    if (idx >= 0) s.individual[idx] = record
    else s.individual.push(record)
    // The reason stays private: the audit entry records the change, not the reason.
    audit(ctx, { action: `${idx >= 0 ? "Updated" : "Added"} individual excused days (${dayCount(input.startDate, input.endDate)})`, entityType: "Employee", entityName: `${e!.firstName} ${e!.lastName}`, companyId: ctx.companyId() })
    ctx.save()
    return record
  }),

  deleteIndividual: endpoint<{ id: string }, { ok: true }, "business">("business", "DELETE", "/organization/excused-dates/individual/:id", ({ id }, ctx) => {
    requireRole(ctx, ROLES)
    const s = store(ctx)
    const item = s.individual.find((x) => x.id === id)
    if (!item) throw notFound("Excused date")
    s.individual = s.individual.filter((x) => x.id !== id)
    const e = ctx.db.employees.find((x) => x.id === item.employeeId)
    audit(ctx, { action: "Removed individual excused days", entityType: "Employee", entityName: e ? `${e.firstName} ${e.lastName}` : "Former employee", companyId: ctx.companyId(), severity: "warning" })
    ctx.save()
    return { ok: true }
  }),
}
