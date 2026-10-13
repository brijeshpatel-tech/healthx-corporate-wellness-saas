/** Business Portal — office locations (SCR-B-046, Phase 2). */
import type { Location } from "@/lib/types"
import { audit, badRequest, endpoint, newId, notFound } from "../core"
import { companyEmployees, ratio, requireRole, suppressed, type BusinessCtx } from "./common"

export interface LocationRow extends Location {
  employeeCount: number
  activeCount: number
  /** Share of people active — null when the location is below the minimum group size. */
  activeShare: number | null
  departmentCount: number
}

export interface LocationInput {
  name: string
  address: string
  city: string
  country: string
  timezone: string
}

export const TIMEZONES = [
  { value: "Asia/Kolkata", label: "India (IST, UTC+5:30)" },
  { value: "Asia/Dubai", label: "Dubai (GST, UTC+4)" },
  { value: "Asia/Singapore", label: "Singapore (SGT, UTC+8)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
  { value: "America/New_York", label: "New York (ET)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PT)" },
  { value: "Australia/Sydney", label: "Sydney (AET)" },
] as const

const ROLES: ("company_owner" | "hr_admin")[] = ["company_owner", "hr_admin"]

function toRow(ctx: BusinessCtx, l: Location): LocationRow {
  const employees = companyEmployees(ctx).filter((e) => e.locationId === l.id)
  return {
    ...l,
    employeeCount: employees.length,
    activeCount: employees.filter((e) => e.status === "active").length,
    activeShare: suppressed(employees.length, ctx) ? null : ratio(employees.filter((e) => e.status === "active").length, employees.length),
    departmentCount: ctx.db.departments.filter((d) => d.locationId === l.id).length,
  }
}

function validate(ctx: BusinessCtx, input: LocationInput, id?: string) {
  const errors: Record<string, string> = {}
  const name = input.name.trim()
  if (name.length < 2) errors.name = "Enter a location name"
  else if (ctx.db.locations.some((l) => l.companyId === ctx.companyId() && l.id !== id && l.name.toLowerCase() === name.toLowerCase())) errors.name = "A location with this name already exists"
  if (!input.city.trim()) errors.city = "Enter a city"
  if (!input.country.trim()) errors.country = "Enter a country"
  if (!input.timezone) errors.timezone = "Choose a timezone"
  if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
}

function find(ctx: BusinessCtx, id: string) {
  const l = ctx.db.locations.find((x) => x.id === id && x.companyId === ctx.companyId())
  if (!l) throw notFound("Location")
  return l
}

export const locationsApi = {
  list: endpoint<void, LocationRow[], "business">("business", "GET", "/organization/locations", (_i, ctx) => {
    requireRole(ctx, ROLES)
    return ctx.db.locations
      .filter((l) => l.companyId === ctx.companyId())
      .map((l) => toRow(ctx, l))
      .sort((a, b) => b.employeeCount - a.employeeCount)
  }),

  create: endpoint<LocationInput, LocationRow, "business">("business", "POST", "/organization/locations", (input, ctx) => {
    requireRole(ctx, ROLES)
    validate(ctx, input)
    const l: Location = {
      id: newId("loc"),
      companyId: ctx.companyId(),
      name: input.name.trim(),
      address: input.address.trim(),
      city: input.city.trim(),
      country: input.country.trim(),
      timezone: input.timezone,
    }
    ctx.db.locations.push(l)
    audit(ctx, { action: "Added location", entityType: "Location", entityName: l.name, companyId: l.companyId })
    ctx.save()
    return toRow(ctx, l)
  }),

  update: endpoint<LocationInput & { id: string }, LocationRow, "business">("business", "PATCH", "/organization/locations/:id", (input, ctx) => {
    requireRole(ctx, ROLES)
    const l = find(ctx, input.id)
    validate(ctx, input, l.id)
    Object.assign(l, { name: input.name.trim(), address: input.address.trim(), city: input.city.trim(), country: input.country.trim(), timezone: input.timezone })
    audit(ctx, { action: "Updated location", entityType: "Location", entityName: l.name, companyId: l.companyId })
    ctx.save()
    return toRow(ctx, l)
  }),

  /** Move everyone at one location to another (so the first can be deleted). */
  reassign: endpoint<{ id: string; targetId: string }, { moved: number }, "business">("business", "POST", "/organization/locations/:id/reassign", ({ id, targetId }, ctx) => {
    requireRole(ctx, ROLES)
    const from = find(ctx, id)
    const to = find(ctx, targetId)
    if (from.id === to.id) throw badRequest("Choose a different location.", { targetId: "Choose a different location" })
    const people = ctx.db.employees.filter((e) => e.companyId === ctx.companyId() && e.locationId === from.id)
    people.forEach((e) => (e.locationId = to.id))
    ctx.db.departments.filter((d) => d.locationId === from.id).forEach((d) => (d.locationId = to.id))
    audit(ctx, { action: `Moved ${people.length} employees to ${to.name}`, entityType: "Location", entityName: from.name, companyId: from.companyId })
    ctx.save()
    return { moved: people.length }
  }),

  remove: endpoint<{ id: string }, { ok: true }, "business">("business", "DELETE", "/organization/locations/:id", ({ id }, ctx) => {
    requireRole(ctx, ROLES)
    const l = find(ctx, id)
    const count = companyEmployees(ctx).filter((e) => e.locationId === l.id).length
    if (count > 0) throw badRequest(`${count} ${count === 1 ? "employee is" : "employees are"} still assigned to ${l.name}. Move them before deleting.`)
    ctx.db.departments.filter((d) => d.locationId === l.id).forEach((d) => (d.locationId = undefined))
    ctx.db.employees.filter((e) => e.locationId === l.id).forEach((e) => (e.locationId = undefined))
    ctx.db.locations = ctx.db.locations.filter((x) => x.id !== l.id)
    audit(ctx, { action: "Deleted location", entityType: "Location", entityName: l.name, companyId: l.companyId, severity: "warning" })
    ctx.save()
    return { ok: true }
  }),
}
