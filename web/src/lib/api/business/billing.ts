/** Business Portal — subscription & invoices (SCR-B-044, Phase 2). Read-only for the company; plan changes go through HealthX. */
import type { Invoice, ModuleCode, Plan, Subscription } from "@/lib/types"
import { MODULE_LABEL } from "@/lib/types"
import { audit, badRequest, endpoint, notFound } from "../core"
import { companyEmployees, requireRole, type BusinessCtx } from "./common"

export interface SubscriptionOverview {
  subscription: Subscription
  plan: Plan
  companyName: string
  modules: { code: ModuleCode; label: string; included: boolean }[]
  usage: { activeEmployees: number; registeredEmployees: number; totalEmployees: number; seats: number; planLimit: number | null }
  nextInvoice: { date: string; estimate: number; currency: Subscription["currency"] }
  otherPlans: Pick<Plan, "id" | "name" | "description" | "pricePerEmployee" | "currency" | "minEmployees" | "maxEmployees">[]
  openRequest?: { number: string; createdAt: string; plan: string }
  /** Set while the company is on the 30-day free trial (client decision #17). */
  trial?: { endsAt: string; daysLeft: number }
}

const OWNER: ("company_owner")[] = ["company_owner"]

function company(ctx: BusinessCtx) {
  const c = ctx.db.companies.find((x) => x.id === ctx.companyId())
  if (!c) throw notFound("Company")
  return c
}

function subscription(ctx: BusinessCtx) {
  const c = company(ctx)
  const sub = ctx.db.subscriptions.find((s) => s.id === c.subscriptionId || s.companyId === c.id)
  if (!sub) throw notFound("Subscription")
  return sub
}

const requests = (ctx: BusinessCtx) => ctx.extra<Record<string, { number: string; createdAt: string; plan: string }>>("biz-plan-requests", () => ({}))

const money = (value: number, currency: "INR" | "USD") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value)

function invoiceHtml(inv: Invoice, companyName: string, legalName: string, planName: string) {
  const total = inv.amount + inv.tax
  const row = (label: string, value: string) => `<tr><td>${label}</td><td style="text-align:right">${value}</td></tr>`
  return `<!doctype html><html><head><meta charset="utf-8"><title>${inv.number}</title>
<style>body{font-family:Inter,Arial,sans-serif;color:#0f172a;max-width:720px;margin:40px auto;padding:0 24px}h1{font-size:22px;margin:0}table{width:100%;border-collapse:collapse;margin-top:24px}td,th{padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:14px}th{text-align:left;color:#64748b;font-weight:600}.muted{color:#64748b;font-size:13px}.total td{font-weight:700;font-size:16px;border-bottom:none}.badge{display:inline-block;padding:2px 10px;border-radius:999px;background:${inv.status === "paid" ? "#d1fae5" : "#fef3c7"};font-size:12px;font-weight:600;text-transform:uppercase}</style></head>
<body><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><h1>HealthX Technologies Pvt Ltd</h1><p class="muted">GSTIN 29AAHCH1234K1Z5 · billing@healthx.life</p></div><div style="text-align:right"><h1>Tax invoice</h1><p class="muted">${inv.number}</p><span class="badge">${inv.status}</span></div></div>
<p style="margin-top:32px"><strong>Billed to</strong><br>${legalName}<br><span class="muted">${companyName}</span></p>
<p class="muted">Issued ${inv.issuedAt.slice(0, 10)} · Due ${inv.dueAt.slice(0, 10)}${inv.paidAt ? ` · Paid ${inv.paidAt.slice(0, 10)}` : ""}</p>
<table><thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead><tbody>
${row(`HealthX ${planName} plan — ${inv.seats} active employees (${inv.periodStart} to ${inv.periodEnd})`, money(inv.amount, inv.currency))}
${row("GST (18%)", money(inv.tax, inv.currency))}
<tr class="total"><td>Total</td><td style="text-align:right">${money(total, inv.currency)}</td></tr></tbody></table>
<p class="muted" style="margin-top:40px">Thank you for choosing HealthX. Questions about this invoice? Write to billing@healthx.life.</p></body></html>`
}

export const billingApi = {
  subscription: endpoint<void, SubscriptionOverview, "business">("business", "GET", "/organization/subscription", (_i, ctx) => {
    requireRole(ctx, OWNER)
    const c = company(ctx)
    const sub = subscription(ctx)
    const plan = ctx.db.plans.find((p) => p.id === sub.planId)
    if (!plan) throw notFound("Plan")
    const employees = companyEmployees(ctx)
    const active = employees.filter((e) => e.status === "active").length
    const registered = employees.filter((e) => e.status === "active" || e.status === "registered" || e.status === "inactive").length
    const billable = Math.max(active, sub.activeSeats)
    const renewal = new Date()
    renewal.setMonth(renewal.getMonth() + 1, 1)
    return {
      subscription: sub,
      plan,
      companyName: c.name,
      modules: (Object.keys(MODULE_LABEL) as ModuleCode[]).map((code) => ({ code, label: MODULE_LABEL[code], included: plan.modules.includes(code) || c.modules.includes(code) })),
      usage: { activeEmployees: active, registeredEmployees: registered, totalEmployees: employees.length, seats: sub.seats, planLimit: plan.maxEmployees },
      nextInvoice: { date: renewal.toISOString().slice(0, 10), estimate: Math.round(billable * plan.pricePerEmployee * 1.18), currency: sub.currency },
      otherPlans: ctx.db.plans
        .filter((p) => p.status === "active" && p.id !== plan.id)
        .map((p) => ({ id: p.id, name: p.name, description: p.description, pricePerEmployee: p.pricePerEmployee, currency: p.currency, minEmployees: p.minEmployees, maxEmployees: p.maxEmployees })),
      openRequest: requests(ctx)[c.id],
      trial:
        sub.status === "trial" && sub.trialEndsAt
          ? { endsAt: sub.trialEndsAt, daysLeft: Math.max(0, Math.ceil((new Date(`${sub.trialEndsAt}T23:59:59`).getTime() - Date.now()) / 86_400_000)) }
          : undefined,
    }
  }),

  invoices: endpoint<void, Invoice[], "business">("business", "GET", "/organization/invoices", (_i, ctx) => {
    requireRole(ctx, OWNER)
    return ctx.db.invoices.filter((i) => i.companyId === ctx.companyId()).sort((a, b) => b.periodStart.localeCompare(a.periodStart))
  }),

  /** Real API returns a PDF; the sample data returns a printable HTML invoice. */
  invoicePdf: endpoint<{ id: string }, { fileName: string; html: string }, "business">("business", "GET", "/organization/invoices/:id/pdf", ({ id }, ctx) => {
    requireRole(ctx, OWNER)
    const inv = ctx.db.invoices.find((i) => i.id === id && i.companyId === ctx.companyId())
    if (!inv) throw notFound("Invoice")
    const c = company(ctx)
    const plan = ctx.db.plans.find((p) => p.id === c.planId)
    audit(ctx, { action: "Downloaded invoice", entityType: "Invoice", entityName: inv.number, companyId: c.id })
    ctx.save()
    return { fileName: `${inv.number}.html`, html: invoiceHtml(inv, c.name, c.legalName, plan?.name ?? "") }
  }),

  /** Phase 2 (#313): pay a due/overdue invoice online. MVP invoices are paid offline (client decision #8). */
  payInvoice: endpoint<{ id: string; method: "card" | "upi" | "netbanking" }, Invoice, "business">("business", "POST", "/organization/invoices/:id/pay", ({ id, method }, ctx) => {
    requireRole(ctx, OWNER)
    const inv = ctx.db.invoices.find((i) => i.id === id && i.companyId === ctx.companyId())
    if (!inv) throw notFound("Invoice")
    if (inv.status === "paid") throw badRequest("This invoice is already paid.")
    if (inv.status === "void") throw badRequest("This invoice was cancelled and can't be paid.")
    inv.status = "paid"
    inv.paidAt = new Date().toISOString()
    const sub = ctx.db.subscriptions.find((x) => x.id === inv.subscriptionId)
    if (sub?.status === "past_due" && !ctx.db.invoices.some((i) => i.subscriptionId === sub.id && i.status === "overdue")) sub.status = "active"
    audit(ctx, { action: `Paid invoice online (${method === "upi" ? "UPI" : method === "card" ? "card" : "net banking"})`, entityType: "Invoice", entityName: inv.number, companyId: inv.companyId })
    ctx.save()
    return inv
  }),

  /** "Contact HealthX to change plan" — opens a support request for the HealthX team. */
  requestPlanChange: endpoint<{ planId: string; seats?: number; message: string }, { number: string }, "business">(
    "business",
    "POST",
    "/organization/subscription/change-request",
    ({ planId, seats, message }, ctx) => {
      const session = requireRole(ctx, OWNER)
      const c = company(ctx)
      const plan = ctx.db.plans.find((p) => p.id === planId)
      if (!plan) throw badRequest("Choose a plan.", { planId: "Choose a plan" })
      if (message.trim().length < 10) throw badRequest("Tell us a little more (at least 10 characters).", { message: "At least 10 characters" })
      const number = `SUP-${3100 + ctx.db.supportTickets.length + 1}`
      const now = new Date().toISOString()
      ctx.db.supportTickets.unshift({
        id: `tkt_${Date.now().toString(36)}`,
        number,
        companyId: c.id,
        subject: `Plan change request: ${plan.name}${seats ? ` (${seats} seats)` : ""}`,
        requester: session.user.name,
        priority: "medium",
        status: "open",
        category: "billing",
        createdAt: now,
        updatedAt: now,
        messages: [{ from: session.user.name, body: message.trim(), at: now }],
      })
      requests(ctx)[c.id] = { number, createdAt: now, plan: plan.name }
      audit(ctx, { action: `Requested plan change to ${plan.name}`, entityType: "Subscription", entityName: c.name, companyId: c.id })
      ctx.save()
      return { number }
    },
  ),
}
