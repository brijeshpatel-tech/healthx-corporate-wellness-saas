/**
 * Platform Admin — Plans (SCR-P-008, SCR-P-009). Managing plans needs plans.manage (Super Admin).
 * Prices are never hard-coded in screens: everything comes from the plan record.
 * New prices apply to new billing periods (existing invoices are not changed).
 */
import type { BillingCycle, ModuleCode, Plan } from "@/lib/types"
import { audit, badRequest, endpoint, matchesSearch, newId, notFound } from "../core"
import { snapshotInvoicePrices } from "./billing"
import { requireAdmin, sum, type AdminCtx } from "./common"

export type PlanStatus = Plan["status"]
export type SupportLevel = Plan["supportLevel"]

export const SUPPORT_LEVEL_DESCRIPTION: Record<SupportLevel, string> = {
  standard: "Email support, replies within 2 business days.",
  priority: "Chat and email, same-day replies.",
  dedicated: "A named customer success manager and quarterly reviews.",
}

export const SUPPORT_LEVEL_SHORT: Record<SupportLevel, string> = { standard: "Standard", priority: "Priority", dedicated: "Dedicated" }

export interface PlanRow extends Plan {
  /** Companies whose current plan is this one. */
  companiesOnPlan: number
  /** Of those, companies with a live (active / trial / past due / paused) subscription. */
  activeCompanies: number
  /** Monthly recurring revenue from this plan's subscriptions. */
  mrr: number
  activeSeats: number
}

export interface PlanQuery {
  search?: string
  status?: PlanStatus | "all"
}

export interface PlanInput {
  name: string
  code: string
  description: string
  pricePerEmployee: number
  currency: "INR" | "USD"
  billingCycle: BillingCycle
  minEmployees: number
  maxEmployees: number | null
  modules: ModuleCode[]
  supportLevel: SupportLevel
  status: PlanStatus
}

export type UpdatePlanInput = { id: string } & Partial<PlanInput>

const LIVE = new Set(["active", "trial", "past_due", "paused"])

function toRow(ctx: AdminCtx, p: Plan): PlanRow {
  const companies = ctx.db.companies.filter((c) => c.planId === p.id)
  const subs = ctx.db.subscriptions.filter((s) => s.planId === p.id && LIVE.has(s.status))
  const activeCompanies = companies.filter((c) => subs.some((s) => s.companyId === c.id)).length
  return {
    ...p,
    companiesCount: companies.length,
    companiesOnPlan: companies.length,
    activeCompanies,
    mrr: sum(subs, (s) => s.mrr),
    activeSeats: sum(subs, (s) => s.activeSeats),
  }
}

function findPlan(ctx: AdminCtx, id: string) {
  const p = ctx.db.plans.find((x) => x.id === id)
  if (!p) throw notFound("Plan")
  return p
}

/** Validates a full plan (after merging an update). Throws field errors. */
function validate(ctx: AdminCtx, p: PlanInput, id?: string) {
  const errors: Record<string, string> = {}
  if (p.name.trim().length < 2) errors.name = "Enter a plan name"
  else if (ctx.db.plans.some((x) => x.id !== id && x.name.trim().toLowerCase() === p.name.trim().toLowerCase())) errors.name = "A plan with this name already exists."
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.code)) errors.code = "Use lowercase letters, numbers and dashes (e.g. growth-plus)."
  else if (ctx.db.plans.some((x) => x.id !== id && x.code === p.code)) errors.code = "This plan code is already in use."
  if (p.description.trim().length < 10) errors.description = "Describe who the plan is for (at least 10 characters)."
  if (!(p.pricePerEmployee >= 0)) errors.pricePerEmployee = "Price can't be negative."
  if (!Number.isInteger(p.minEmployees) || p.minEmployees < 1) errors.minEmployees = "Minimum must be at least 1."
  if (p.maxEmployees !== null && p.maxEmployees < p.minEmployees) errors.maxEmployees = "Maximum must be at least the minimum."
  if (!p.modules.length) errors.modules = "Include at least one module."
  const messages = Object.values(errors)
  if (messages.length) throw badRequest(messages.length === 1 ? messages[0]! : "Please fix the highlighted fields.", errors)
}

function assertCanArchive(ctx: AdminCtx, plan: Plan) {
  const row = toRow(ctx, plan)
  if (row.activeCompanies > 0)
    throw badRequest(`${row.activeCompanies} ${row.activeCompanies === 1 ? "company is" : "companies are"} still on ${plan.name}. Move them to another plan before archiving it.`, {
      status: "Plans with active companies can't be archived.",
    })
}

export const plansApi = {
  list: endpoint<PlanQuery, PlanRow[], "admin">("admin", "GET", "/platform/plans", (q, ctx) => {
    requireAdmin(ctx)
    const order: Record<PlanStatus, number> = { active: 0, draft: 1, archived: 2 }
    return ctx.db.plans
      .filter((p) => (!q.status || q.status === "all" || p.status === q.status) && matchesSearch(q.search, p.name, p.code, p.description))
      .sort((a, b) => order[a.status] - order[b.status] || a.pricePerEmployee - b.pricePerEmployee)
      .map((p) => toRow(ctx, p))
  }),

  get: endpoint<{ id: string }, PlanRow, "admin">("admin", "GET", "/platform/plans/:id", ({ id }, ctx) => {
    requireAdmin(ctx)
    return toRow(ctx, findPlan(ctx, id))
  }),

  create: endpoint<PlanInput, PlanRow, "admin">("admin", "POST", "/platform/plans", (input, ctx) => {
    requireAdmin(ctx, "plans.manage")
    const data: PlanInput = { ...input, name: input.name.trim(), code: input.code.trim().toLowerCase(), description: input.description.trim() }
    validate(ctx, data)
    const plan: Plan = { id: newId("plan"), ...data, companiesCount: 0, createdAt: new Date().toISOString() }
    ctx.db.plans.push(plan)
    audit(ctx, { action: `Created plan (${data.status})`, entityType: "Plan", entityName: plan.name })
    ctx.save()
    return toRow(ctx, plan)
  }),

  update: endpoint<UpdatePlanInput, PlanRow, "admin">("admin", "PATCH", "/platform/plans/:id", (input, ctx) => {
    requireAdmin(ctx, "plans.manage")
    const plan = findPlan(ctx, input.id)
    const { id: _id, ...patch } = input
    void _id
    const next: PlanInput = {
      name: plan.name,
      code: plan.code,
      description: plan.description,
      pricePerEmployee: plan.pricePerEmployee,
      currency: plan.currency,
      billingCycle: plan.billingCycle,
      minEmployees: plan.minEmployees,
      maxEmployees: plan.maxEmployees,
      modules: plan.modules,
      supportLevel: plan.supportLevel,
      status: plan.status,
      ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
    }
    next.name = next.name.trim()
    next.code = next.code.trim().toLowerCase()
    next.description = next.description.trim()
    validate(ctx, next, plan.id)
    if (next.status === "archived" && plan.status !== "archived") assertCanArchive(ctx, plan)

    const priceChanged = next.pricePerEmployee !== plan.pricePerEmployee || next.currency !== plan.currency
    const statusChanged = next.status !== plan.status
    const onlyStatus = statusChanged && Object.keys(patch).every((k) => k === "status")
    // Existing invoices keep the price they were issued with.
    if (priceChanged) snapshotInvoicePrices(ctx)
    Object.assign(plan, next)
    const action = onlyStatus
      ? next.status === "archived"
        ? "Archived plan"
        : next.status === "active"
          ? "Activated plan"
          : "Moved plan to draft"
      : priceChanged
        ? "Updated plan pricing (applies from next billing period)"
        : "Updated plan"
    audit(ctx, { action, entityType: "Plan", entityName: plan.name, severity: priceChanged || next.status === "archived" ? "warning" : "info" })
    ctx.save()
    return toRow(ctx, plan)
  }),
}
