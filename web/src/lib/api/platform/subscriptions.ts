/**
 * Platform Admin — Subscriptions (SCR-P-010). Viewing: Super Admin + Support Admin.
 * Changes need subscriptions.manage (Super Admin). One live subscription per company.
 * Changing the plan also updates the company's plan and module entitlements, so the
 * Business Portal / Employee App immediately reflect the new modules.
 */
import { DAY_MS } from "@/lib/mock/series"
import type { BillingCycle, Company, ModuleCode, Plan, Subscription, SubscriptionStatus } from "@/lib/types"
import { audit, badRequest, endpoint, matchesSearch, newId, notFound } from "../core"
import { snapshotInvoicePrices } from "./billing"
import { requireAdmin, sum, today, type AdminCtx } from "./common"

export interface SubscriptionRow extends Subscription {
  companyName: string
  companyCode: string
  companyInitials: string
  companyColor: string
  planName: string
  pricePerEmployee: number
  maxEmployees: number | null
  /** For cancelled rows: the company has no other live subscription, so a plan can be assigned. */
  canAssign: boolean
}

export interface SubscriptionQuery {
  search?: string
  status?: SubscriptionStatus | "all"
  planId?: string
}

export interface SubscriptionSummary {
  active: number
  trial: number
  pastDue: number
  paused: number
  cancelled: number
  totalMrr: number
  currency: "INR" | "USD"
  seats: number
  activeSeats: number
}

export interface SubscriptionList {
  items: SubscriptionRow[]
  summary: SubscriptionSummary
}

export interface PlanOption {
  id: string
  name: string
  pricePerEmployee: number
  currency: "INR" | "USD"
  billingCycle: BillingCycle
  minEmployees: number
  maxEmployees: number | null
  modules: ModuleCode[]
}

export interface SubscriptionLookups {
  plans: PlanOption[]
  /** Companies without a live subscription (all their subscriptions are cancelled, or none). */
  assignable: { id: string; name: string; activeCount: number; employeeCount: number }[]
}

export interface ChangePlanInput {
  id: string
  planId: string
  seats: number
  billingCycle: BillingCycle
  note?: string
}

export interface EditSubscriptionInput {
  id: string
  seats: number
  renewalDate: string
}

export interface AssignPlanInput {
  companyId: string
  planId: string
  seats: number
  billingCycle: BillingCycle
  startDate: string
  renewalDate: string
  trial: boolean
}

const LIVE: SubscriptionStatus[] = ["active", "trial", "past_due", "paused"]
const BILLABLE: SubscriptionStatus[] = ["active", "past_due"]

/** MRR = billable active employees × plan price; trial, paused and cancelled bring in nothing. */
export const mrrFor = (status: SubscriptionStatus, activeSeats: number, plan: Pick<Plan, "pricePerEmployee">) => (BILLABLE.includes(status) ? activeSeats * plan.pricePerEmployee : 0)

const addDays = (date: string, days: number) => new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10)

function findSub(ctx: AdminCtx, id: string) {
  const s = ctx.db.subscriptions.find((x) => x.id === id)
  if (!s) throw notFound("Subscription")
  return s
}

function findPlan(ctx: AdminCtx, id: string) {
  const p = ctx.db.plans.find((x) => x.id === id)
  if (!p) throw notFound("Plan")
  return p
}

const hasLive = (ctx: AdminCtx, companyId: string, exceptId?: string) => ctx.db.subscriptions.some((s) => s.companyId === companyId && s.id !== exceptId && LIVE.includes(s.status))

function toRow(ctx: AdminCtx, s: Subscription): SubscriptionRow {
  const c = ctx.db.companies.find((x) => x.id === s.companyId)
  const p = ctx.db.plans.find((x) => x.id === s.planId)
  return {
    ...s,
    companyName: c?.name ?? "Unknown company",
    companyCode: c?.companyCode ?? "—",
    companyInitials: c?.branding.logoInitials ?? "?",
    companyColor: c?.branding.primaryColor ?? "#64748b",
    planName: p?.name ?? "Unknown plan",
    pricePerEmployee: p?.pricePerEmployee ?? 0,
    maxEmployees: p?.maxEmployees ?? null,
    canAssign: s.status === "cancelled" && !hasLive(ctx, s.companyId),
  }
}

/** Keeps plan.companiesCount in step with company.planId. */
function syncPlanCounts(ctx: AdminCtx) {
  for (const p of ctx.db.plans) p.companiesCount = ctx.db.companies.filter((c) => c.planId === p.id).length
}

function applyPlanToCompany(company: Company | undefined, plan: Plan, subscriptionId: string) {
  if (!company) return
  company.planId = plan.id
  company.subscriptionId = subscriptionId
  company.modules = [...plan.modules]
}

function validateSeats(plan: Plan, seats: number, activeSeats: number, errors: Record<string, string>) {
  if (!Number.isInteger(seats) || seats < 1) errors.seats = "Enter at least 1 seat."
  else if (seats < activeSeats) errors.seats = `Seat limit can't be below the ${activeSeats.toLocaleString("en-IN")} employees already active.`
  else if (plan.maxEmployees !== null && seats > plan.maxEmployees) errors.seats = `${plan.name} allows up to ${plan.maxEmployees.toLocaleString("en-IN")} employees.`
}

function throwIfErrors(errors: Record<string, string>) {
  const messages = Object.values(errors)
  if (messages.length) throw badRequest(messages.length === 1 ? messages[0]! : "Please fix the highlighted fields.", errors)
}

export const subscriptionsApi = {
  list: endpoint<SubscriptionQuery, SubscriptionList, "admin">("admin", "GET", "/platform/subscriptions", (q, ctx) => {
    requireAdmin(ctx)
    const all = ctx.db.subscriptions.map((s) => toRow(ctx, s))
    const items = all
      .filter(
        (r) =>
          (!q.status || q.status === "all" || r.status === q.status) &&
          (!q.planId || q.planId === "all" || r.planId === q.planId) &&
          matchesSearch(q.search, r.companyName, r.companyCode, r.planName),
      )
      .sort((a, b) => {
        const order: Record<SubscriptionStatus, number> = { past_due: 0, active: 1, trial: 2, paused: 3, cancelled: 4 }
        return order[a.status] - order[b.status] || b.mrr - a.mrr || a.companyName.localeCompare(b.companyName)
      })
    const live = all.filter((s) => LIVE.includes(s.status))
    return {
      items,
      summary: {
        active: all.filter((s) => s.status === "active").length,
        trial: all.filter((s) => s.status === "trial").length,
        pastDue: all.filter((s) => s.status === "past_due").length,
        paused: all.filter((s) => s.status === "paused").length,
        cancelled: all.filter((s) => s.status === "cancelled").length,
        totalMrr: sum(all, (s) => s.mrr),
        currency: "INR",
        seats: sum(live, (s) => s.seats),
        activeSeats: sum(live, (s) => s.activeSeats),
      },
    }
  }),

  lookups: endpoint<void, SubscriptionLookups, "admin">("admin", "GET", "/platform/subscriptions/options", (_, ctx) => {
    requireAdmin(ctx)
    return {
      plans: ctx.db.plans
        .filter((p) => p.status === "active")
        .sort((a, b) => a.pricePerEmployee - b.pricePerEmployee)
        .map((p) => ({ id: p.id, name: p.name, pricePerEmployee: p.pricePerEmployee, currency: p.currency, billingCycle: p.billingCycle, minEmployees: p.minEmployees, maxEmployees: p.maxEmployees, modules: p.modules })),
      assignable: ctx.db.companies
        .filter((c) => !hasLive(ctx, c.id))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ id: c.id, name: c.name, activeCount: c.activeCount, employeeCount: c.employeeCount })),
    }
  }),

  changePlan: endpoint<ChangePlanInput, SubscriptionRow, "admin">("admin", "POST", "/platform/subscriptions/:id/change-plan", (input, ctx) => {
    requireAdmin(ctx, "subscriptions.manage")
    const sub = findSub(ctx, input.id)
    if (sub.status === "cancelled") throw badRequest("Cancelled subscriptions can't be changed. Assign a new plan instead.")
    const plan = findPlan(ctx, input.planId)
    const errors: Record<string, string> = {}
    if (plan.status !== "active") errors.planId = "Choose an active plan."
    validateSeats(plan, input.seats, sub.activeSeats, errors)
    if (plan.id === sub.planId && input.seats === sub.seats && input.billingCycle === sub.billingCycle) errors.planId = "Nothing changed — pick a different plan, seats or billing cycle."
    throwIfErrors(errors)

    const oldPlan = ctx.db.plans.find((p) => p.id === sub.planId)
    snapshotInvoicePrices(ctx)
    sub.planId = plan.id
    sub.seats = input.seats
    sub.billingCycle = input.billingCycle
    sub.currency = plan.currency
    sub.mrr = mrrFor(sub.status, sub.activeSeats, plan)
    const company = ctx.db.companies.find((c) => c.id === sub.companyId)
    applyPlanToCompany(company, plan, sub.id)
    syncPlanCounts(ctx)
    const what = oldPlan && oldPlan.id !== plan.id ? `Changed plan ${oldPlan.name} → ${plan.name}` : "Updated subscription terms"
    audit(ctx, {
      action: `${what} (${input.seats} seats, ${input.billingCycle})${input.note?.trim() ? ` — ${input.note.trim()}` : ""}`,
      entityType: "Subscription",
      entityName: company?.name ?? sub.id,
      companyId: sub.companyId,
      severity: "warning",
    })
    ctx.save()
    return toRow(ctx, sub)
  }),

  update: endpoint<EditSubscriptionInput, SubscriptionRow, "admin">("admin", "PATCH", "/platform/subscriptions/:id", (input, ctx) => {
    requireAdmin(ctx, "subscriptions.manage")
    const sub = findSub(ctx, input.id)
    if (sub.status === "cancelled") throw badRequest("Cancelled subscriptions can't be edited. Assign a new plan instead.")
    const plan = findPlan(ctx, sub.planId)
    const errors: Record<string, string> = {}
    validateSeats(plan, input.seats, sub.activeSeats, errors)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.renewalDate)) errors.renewalDate = "Choose a renewal date."
    else if (input.renewalDate <= sub.startDate) errors.renewalDate = "Renewal date must be after the start date."
    throwIfErrors(errors)
    const changes: string[] = []
    if (input.seats !== sub.seats) changes.push(`seats ${sub.seats} → ${input.seats}`)
    if (input.renewalDate !== sub.renewalDate) changes.push(`renewal ${sub.renewalDate} → ${input.renewalDate}`)
    sub.seats = input.seats
    sub.renewalDate = input.renewalDate
    if (changes.length) {
      audit(ctx, { action: `Updated subscription (${changes.join(", ")})`, entityType: "Subscription", entityName: toRow(ctx, sub).companyName, companyId: sub.companyId })
      ctx.save()
    }
    return toRow(ctx, sub)
  }),

  pause: endpoint<{ id: string }, SubscriptionRow, "admin">("admin", "POST", "/platform/subscriptions/:id/pause", ({ id }, ctx) => {
    requireAdmin(ctx, "subscriptions.manage")
    const sub = findSub(ctx, id)
    if (!(["active", "past_due"] as SubscriptionStatus[]).includes(sub.status)) throw badRequest("Only active or past-due subscriptions can be paused.")
    sub.status = "paused"
    sub.mrr = 0
    audit(ctx, { action: "Paused subscription", entityType: "Subscription", entityName: toRow(ctx, sub).companyName, companyId: sub.companyId, severity: "warning" })
    ctx.save()
    return toRow(ctx, sub)
  }),

  /** Resume a paused subscription, or convert a trial to a paid subscription. */
  activate: endpoint<{ id: string }, SubscriptionRow, "admin">("admin", "POST", "/platform/subscriptions/:id/activate", ({ id }, ctx) => {
    requireAdmin(ctx, "subscriptions.manage")
    const sub = findSub(ctx, id)
    if (sub.status !== "paused" && sub.status !== "trial") throw badRequest("Only paused or trial subscriptions can be activated.")
    const wasTrial = sub.status === "trial"
    sub.status = "active"
    sub.trialEndsAt = undefined
    sub.mrr = mrrFor(sub.status, sub.activeSeats, findPlan(ctx, sub.planId))
    audit(ctx, { action: wasTrial ? "Converted trial to paid subscription" : "Resumed subscription", entityType: "Subscription", entityName: toRow(ctx, sub).companyName, companyId: sub.companyId })
    ctx.save()
    return toRow(ctx, sub)
  }),

  cancel: endpoint<{ id: string; reason: string }, SubscriptionRow, "admin">("admin", "POST", "/platform/subscriptions/:id/cancel", ({ id, reason }, ctx) => {
    requireAdmin(ctx, "subscriptions.manage")
    const sub = findSub(ctx, id)
    if (sub.status === "cancelled") throw badRequest("This subscription is already cancelled.")
    if (!reason || reason.trim().length < 5) throw badRequest("Tell us why the subscription is being cancelled.", { reason: "Enter a reason (at least 5 characters)." })
    sub.status = "cancelled"
    sub.mrr = 0
    sub.trialEndsAt = undefined
    audit(ctx, { action: `Cancelled subscription — ${reason.trim()}`, entityType: "Subscription", entityName: toRow(ctx, sub).companyName, companyId: sub.companyId, severity: "critical" })
    ctx.save()
    return toRow(ctx, sub)
  }),

  assign: endpoint<AssignPlanInput, SubscriptionRow, "admin">("admin", "POST", "/platform/subscriptions", (input, ctx) => {
    requireAdmin(ctx, "subscriptions.manage")
    const company = ctx.db.companies.find((c) => c.id === input.companyId)
    if (!company) throw badRequest("Please fix the highlighted fields.", { companyId: "Choose a company" })
    if (hasLive(ctx, company.id)) throw badRequest("This company already has an active subscription.", { companyId: "This company already has an active subscription." })
    const plan = findPlan(ctx, input.planId)
    const errors: Record<string, string> = {}
    if (plan.status !== "active") errors.planId = "Choose an active plan."
    validateSeats(plan, input.seats, company.activeCount, errors)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) errors.startDate = "Choose a start date."
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.renewalDate)) errors.renewalDate = "Choose a renewal date."
    else if (input.renewalDate <= input.startDate) errors.renewalDate = "Renewal date must be after the start date."
    throwIfErrors(errors)

    const status: SubscriptionStatus = input.trial ? "trial" : "active"
    const activeSeats = company.activeCount
    const sub: Subscription = {
      id: newId("sub"),
      companyId: company.id,
      planId: plan.id,
      status,
      seats: input.seats,
      activeSeats,
      billingCycle: input.billingCycle,
      startDate: input.startDate,
      renewalDate: input.renewalDate,
      trialEndsAt: input.trial ? addDays(input.startDate, 30) : undefined,
      mrr: mrrFor(status, activeSeats, plan),
      currency: plan.currency,
    }
    ctx.db.subscriptions.push(sub)
    applyPlanToCompany(company, plan, sub.id)
    syncPlanCounts(ctx)
    audit(ctx, { action: `Assigned ${plan.name} plan${input.trial ? " (30-day trial)" : ""} — ${input.seats} seats`, entityType: "Subscription", entityName: company.name, companyId: company.id, severity: "warning" })
    ctx.save()
    return toRow(ctx, sub)
  }),
}

/** Default renewal date for a start date and billing cycle. */
export const defaultRenewal = (startDate: string, cycle: BillingCycle) => {
  const d = new Date(`${startDate || today()}T00:00:00Z`)
  if (cycle === "annual") d.setUTCFullYear(d.getUTCFullYear() + 1)
  else d.setUTCMonth(d.getUTCMonth() + 1)
  return d.toISOString().slice(0, 10)
}
