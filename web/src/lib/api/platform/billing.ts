/**
 * Platform Admin — Revenue & invoices (SCR-P-026, Phase 2). Super Admin only (revenue.view / billing.manage).
 * Bills are calculated from billable active employees × the plan's price per employee, plus GST 18%.
 * Revenue history is deterministic (derived from the current MRR) so charts are stable.
 */
import { formatCurrency, formatDate, formatNumber } from "@/lib/format"
import { noise } from "@/lib/mock/series"
import type { Invoice, InvoiceStatus } from "@/lib/types"
import { audit, badRequest, endpoint, matchesSearch, newId, notFound } from "../core"
import { requireAdmin, round, sum, toCsv, today, type AdminCtx } from "./common"

export const GST_RATE = 0.18

// ─── Revenue ────────────────────────────────────────────────────────────

export interface RevenueSummary {
  currency: "INR"
  mrr: number
  mrrPrevious: number
  arr: number
  /** Average revenue per paying company (monthly). */
  arpu: number
  payingCompanies: number
  billableEmployees: number
  revenuePerEmployee: number
  expansionMrr: number
  /** Logo churn over the last 12 months (cancelled ÷ all subscriptions). */
  churnRate: number
  churnedCompanies: number
  trend: { month: string; mrr: number }[]
  byPlan: { planId: string; name: string; mrr: number; companies: number }[]
  topCompanies: { companyId: string; name: string; planName: string; mrr: number; activeSeats: number }[]
  outstanding: { due: number; dueCount: number; overdue: number; overdueCount: number }
  /** Paid in the last 30 days (incl. GST). */
  collectedLast30Days: number
}

const BILLABLE = new Set(["active", "past_due"])
const monthStart = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1)
const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/**
 * Billing period of an invoice as calendar dates. Sample invoices were stored with a time-zone
 * shift (e.g. "2026-09-30" for the October period), so a start date late in a month means the next month.
 */
function periodOf(inv: Pick<Invoice, "periodStart" | "periodEnd">) {
  const [y, m, d] = inv.periodStart.split("-").map(Number) as [number, number, number]
  if (d === 1) return { periodStart: inv.periodStart, periodEnd: inv.periodEnd }
  const start = d > 15 ? new Date(y, m, 1) : new Date(y, m - 1, 1)
  return { periodStart: localDay(start), periodEnd: localDay(new Date(start.getFullYear(), start.getMonth() + 1, 0)) }
}

/** Monthly MRR for the last 12 months, ending with the current MRR (≈5.5% monthly growth). */
function mrrTrend(current: number) {
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const back = 11 - i
    const month = localDay(new Date(now.getFullYear(), now.getMonth() - back, 1))
    if (back === 0) return { month, mrr: current }
    const jitter = 1 + (noise("admin-revenue-mrr", back) - 0.5) * 0.05
    return { month, mrr: Math.round(current * Math.pow(1 / 1.055, back) * jitter) }
  })
}

// ─── Invoices ───────────────────────────────────────────────────────────

export interface InvoiceRow extends Invoice {
  companyName: string
  planName: string
  total: number
}

export interface InvoiceQuery {
  search?: string
  status?: InvoiceStatus | "all"
  companyId?: string
  /** "YYYY-MM" of the billing period. */
  period?: string
}

export interface InvoiceList {
  items: InvoiceRow[]
  periods: string[]
  summary: { count: number; outstanding: number; overdue: number; paidThisMonth: number }
}

export interface InvoiceLine {
  description: string
  quantity: number
  unitPrice: number
  amount: number
}

export interface InvoiceDetail extends InvoiceRow {
  companyLegalName: string
  companyCity: string
  companyCountry: string
  lines: InvoiceLine[]
  subtotal: number
  taxRate: number
  /** "Invoice totals must match line items" check. */
  totalsMatch: boolean
}

type PriceSnapshot = Record<string, { planName: string; unitPrice: number }>

/** Plan price at invoice time — snapshotted so later price changes don't rewrite old invoices. */
const priceStore = (ctx: AdminCtx) => ctx.extra<PriceSnapshot>("admin-invoice-prices", () => ({}))

/** Records the current plan price for every invoice that has no snapshot yet. Call before changing plan prices or a subscription's plan. */
export function snapshotInvoicePrices(ctx: AdminCtx) {
  const store = priceStore(ctx)
  for (const inv of ctx.db.invoices) {
    if (store[inv.id]) continue
    const sub = ctx.db.subscriptions.find((s) => s.id === inv.subscriptionId)
    const plan = ctx.db.plans.find((p) => p.id === sub?.planId)
    if (plan) store[inv.id] = { planName: plan.name, unitPrice: plan.pricePerEmployee }
  }
}

function priceOf(ctx: AdminCtx, inv: Invoice) {
  const snap = priceStore(ctx)[inv.id]
  if (snap) return snap
  const sub = ctx.db.subscriptions.find((s) => s.id === inv.subscriptionId)
  const plan = ctx.db.plans.find((p) => p.id === sub?.planId)
  return { planName: plan?.name ?? "Plan", unitPrice: plan?.pricePerEmployee ?? 0 }
}

function toRow(ctx: AdminCtx, inv: Invoice): InvoiceRow {
  return {
    ...inv,
    ...periodOf(inv),
    companyName: ctx.db.companies.find((c) => c.id === inv.companyId)?.name ?? "Unknown company",
    planName: priceOf(ctx, inv).planName,
    total: inv.amount + inv.tax,
  }
}

function toDetail(ctx: AdminCtx, inv: Invoice): InvoiceDetail {
  const company = ctx.db.companies.find((c) => c.id === inv.companyId)
  const { planName, unitPrice } = priceOf(ctx, inv)
  const base = inv.seats * unitPrice
  const lines: InvoiceLine[] = [{ description: `${planName} plan — billable active employees`, quantity: inv.seats, unitPrice, amount: base }]
  const diff = inv.amount - base
  if (diff !== 0) lines.push({ description: diff > 0 ? "Pro-rated seat additions during the period" : "Pro-rated credit for seats removed during the period", quantity: 1, unitPrice: diff, amount: diff })
  const subtotal = sum(lines, (l) => l.amount)
  return {
    ...toRow(ctx, inv),
    companyLegalName: company?.legalName ?? "—",
    companyCity: company?.city ?? "",
    companyCountry: company?.country ?? "",
    lines,
    subtotal,
    taxRate: GST_RATE,
    totalsMatch: subtotal === inv.amount && Math.abs(inv.tax - Math.round(inv.amount * GST_RATE)) <= 1,
  }
}

function findInvoice(ctx: AdminCtx, id: string) {
  const inv = ctx.db.invoices.find((x) => x.id === id)
  if (!inv) throw notFound("Invoice")
  return inv
}

function filterInvoices(ctx: AdminCtx, q: InvoiceQuery) {
  return ctx.db.invoices
    .map((i) => toRow(ctx, i))
    .filter(
      (r) =>
        (!q.status || q.status === "all" || r.status === q.status) &&
        (!q.companyId || q.companyId === "all" || r.companyId === q.companyId) &&
        (!q.period || q.period === "all" || r.periodStart.startsWith(q.period)) &&
        matchesSearch(q.search, r.number, r.companyName),
    )
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart) || b.number.localeCompare(a.number))
}

const nextNumber = (ctx: AdminCtx, period: string) => {
  const max = ctx.db.invoices.reduce((m, i) => Math.max(m, Number(i.number.slice(-4)) || 0), 100)
  return `INV-${period.replace("-", "")}-${String(max + 1).padStart(4, "0")}`
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

function invoiceHtml(d: InvoiceDetail) {
  const money = (v: number) => esc(formatCurrency(v, d.currency))
  const rows = d.lines
    .map((l) => `<tr><td>${esc(l.description)}</td><td class="r">${formatNumber(l.quantity)}</td><td class="r">${money(l.unitPrice)}</td><td class="r">${money(l.amount)}</td></tr>`)
    .join("")
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.number)}</title>
<style>body{font-family:Inter,Arial,sans-serif;color:#0f172a;max-width:760px;margin:40px auto;padding:0 24px}h1{font-size:22px;margin:0}.muted{color:#64748b;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:24px;font-size:14px}th,td{padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:left}th{font-size:12px;text-transform:uppercase;color:#64748b}.r{text-align:right}.tot td{border:0;padding:6px 8px}.grand td{font-weight:700;font-size:16px;border-top:2px solid #0f172a}.head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}.badge{display:inline-block;padding:2px 10px;border-radius:99px;background:#ecfdf5;color:#047857;font-size:12px;font-weight:600;text-transform:uppercase}</style>
</head><body>
<div class="head"><div><h1>HealthX</h1><div class="muted">HealthX Technologies Pvt Ltd · billing@healthx.life</div></div><div style="text-align:right"><h1>Tax invoice</h1><div class="muted">${esc(d.number)}</div><div style="margin-top:6px"><span class="badge">${esc(d.status)}</span></div></div></div>
<div class="head" style="margin-top:28px"><div><div class="muted">Bill to</div><strong>${esc(d.companyLegalName)}</strong><div class="muted">${esc([d.companyCity, d.companyCountry].filter(Boolean).join(", "))}</div></div>
<div style="text-align:right"><div class="muted">Billing period</div><strong>${esc(formatDate(d.periodStart))} – ${esc(formatDate(d.periodEnd))}</strong><div class="muted">Issued ${esc(formatDate(d.issuedAt))} · Due ${esc(formatDate(d.dueAt))}</div></div></div>
<table><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<table><tbody><tr class="tot"><td class="r" style="width:75%">Subtotal</td><td class="r">${money(d.subtotal)}</td></tr><tr class="tot"><td class="r">GST ${Math.round(d.taxRate * 100)}%</td><td class="r">${money(d.tax)}</td></tr><tr class="grand"><td class="r">Total</td><td class="r">${money(d.total)}</td></tr></tbody></table>
<p class="muted" style="margin-top:32px">Charges are based on billable active employees during the period. ${d.paidAt ? `Paid on ${esc(formatDate(d.paidAt))}.` : "Please pay by the due date."}</p>
</body></html>`
}

export const revenueApi = {
  summary: endpoint<void, RevenueSummary, "admin">("admin", "GET", "/platform/revenue", (_, ctx) => {
    requireAdmin(ctx, "revenue.view")
    const subs = ctx.db.subscriptions
    const paying = subs.filter((s) => BILLABLE.has(s.status))
    const mrr = sum(paying, (s) => s.mrr)
    const trend = mrrTrend(mrr)
    const billableEmployees = sum(paying, (s) => s.activeSeats)
    const companiesWithSubs = new Set(subs.map((s) => s.companyId))
    const cancelled = new Set(subs.filter((s) => s.status === "cancelled" && !subs.some((x) => x.companyId === s.companyId && x.status !== "cancelled")).map((s) => s.companyId))
    const name = (id: string) => ctx.db.companies.find((c) => c.id === id)?.name ?? "Unknown company"
    const planName = (id: string) => ctx.db.plans.find((p) => p.id === id)?.name ?? "Unknown plan"
    const byPlan = ctx.db.plans
      .map((p) => ({ planId: p.id, name: p.name, mrr: sum(paying.filter((s) => s.planId === p.id), (s) => s.mrr), companies: paying.filter((s) => s.planId === p.id).length }))
      .filter((p) => p.mrr > 0 || p.companies > 0)
      .sort((a, b) => b.mrr - a.mrr)
    const topCompanies = [...paying]
      .sort((a, b) => b.mrr - a.mrr)
      .slice(0, 8)
      .map((s) => ({ companyId: s.companyId, name: name(s.companyId), planName: planName(s.planId), mrr: s.mrr, activeSeats: s.activeSeats }))
    const open = ctx.db.invoices.filter((i) => i.status === "due" || i.status === "overdue")
    return {
      currency: "INR",
      mrr,
      mrrPrevious: trend[10]?.mrr ?? mrr,
      arr: mrr * 12,
      arpu: paying.length ? Math.round(mrr / paying.length) : 0,
      payingCompanies: paying.length,
      billableEmployees,
      revenuePerEmployee: billableEmployees ? round(mrr / billableEmployees, 1) : 0,
      expansionMrr: Math.round(mrr * (0.018 + noise("admin-revenue-expansion", new Date().getMonth()) * 0.022)),
      churnRate: companiesWithSubs.size ? cancelled.size / companiesWithSubs.size : 0,
      churnedCompanies: cancelled.size,
      trend,
      byPlan,
      topCompanies,
      outstanding: {
        due: sum(open.filter((i) => i.status === "due"), (i) => i.amount + i.tax),
        dueCount: open.filter((i) => i.status === "due").length,
        overdue: sum(open.filter((i) => i.status === "overdue"), (i) => i.amount + i.tax),
        overdueCount: open.filter((i) => i.status === "overdue").length,
      },
      collectedLast30Days: sum(
        ctx.db.invoices.filter((i) => i.status === "paid" && !!i.paidAt && Date.now() - new Date(i.paidAt).getTime() <= 30 * 86_400_000),
        (i) => i.amount + i.tax,
      ),
    }
  }),
}

export const invoicesApi = {
  list: endpoint<InvoiceQuery, InvoiceList, "admin">("admin", "GET", "/platform/invoices", (q, ctx) => {
    requireAdmin(ctx, "revenue.view")
    const items = filterInvoices(ctx, q)
    const thisMonth = localDay(monthStart()).slice(0, 7)
    const periods = [...new Set(ctx.db.invoices.map((i) => periodOf(i).periodStart.slice(0, 7)))].sort().reverse()
    return {
      items,
      periods,
      summary: {
        count: items.length,
        outstanding: sum(items.filter((i) => i.status === "due" || i.status === "overdue"), (i) => i.total),
        overdue: sum(items.filter((i) => i.status === "overdue"), (i) => i.total),
        paidThisMonth: sum(items.filter((i) => i.status === "paid" && i.paidAt?.slice(0, 7) === thisMonth), (i) => i.total),
      },
    }
  }),

  get: endpoint<{ id: string }, InvoiceDetail, "admin">("admin", "GET", "/platform/invoices/:id", ({ id }, ctx) => {
    requireAdmin(ctx, "revenue.view")
    return toDetail(ctx, findInvoice(ctx, id))
  }),

  /** Creates "due" invoices for the current month for every billable subscription that has none yet. */
  generate: endpoint<void, { created: number; period: string }, "admin">("admin", "POST", "/platform/invoices", (_, ctx) => {
    requireAdmin(ctx, "billing.manage")
    snapshotInvoicePrices(ctx)
    const start = monthStart()
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
    const periodStart = localDay(start)
    const period = periodStart.slice(0, 7)
    let created = 0
    for (const sub of ctx.db.subscriptions) {
      if (!BILLABLE.has(sub.status)) continue
      if (ctx.db.invoices.some((i) => i.subscriptionId === sub.id && periodOf(i).periodStart === periodStart && i.status !== "void")) continue
      const plan = ctx.db.plans.find((p) => p.id === sub.planId)
      if (!plan) continue
      const amount = sub.activeSeats * plan.pricePerEmployee
      const issued = new Date()
      const inv: Invoice = {
        id: newId("invc"),
        number: nextNumber(ctx, period),
        companyId: sub.companyId,
        subscriptionId: sub.id,
        periodStart,
        periodEnd: localDay(end),
        seats: sub.activeSeats,
        amount,
        tax: Math.round(amount * GST_RATE),
        currency: sub.currency,
        status: "due",
        issuedAt: issued.toISOString(),
        dueAt: new Date(issued.getTime() + 15 * 86_400_000).toISOString(),
      }
      ctx.db.invoices.push(inv)
      priceStore(ctx)[inv.id] = { planName: plan.name, unitPrice: plan.pricePerEmployee }
      created++
    }
    if (created) {
      audit(ctx, { action: `Generated ${created} invoice${created === 1 ? "" : "s"} for ${formatDate(start, "MMMM yyyy")}`, entityType: "Invoice", entityName: "Monthly billing run" })
      ctx.save()
    }
    return { created, period: formatDate(start, "MMMM yyyy") }
  }),

  markPaid: endpoint<{ id: string }, InvoiceRow, "admin">("admin", "PATCH", "/platform/invoices/:id", ({ id }, ctx) => {
    requireAdmin(ctx, "billing.manage")
    const inv = findInvoice(ctx, id)
    if (inv.status === "paid") throw badRequest("This invoice is already paid.")
    if (inv.status === "void") throw badRequest("A void invoice can't be marked as paid.")
    inv.status = "paid"
    inv.paidAt = new Date().toISOString()
    // A past-due subscription with nothing left overdue is back in good standing.
    const sub = ctx.db.subscriptions.find((s) => s.id === inv.subscriptionId)
    if (sub?.status === "past_due" && !ctx.db.invoices.some((i) => i.subscriptionId === sub.id && i.status === "overdue")) sub.status = "active"
    const row = toRow(ctx, inv)
    audit(ctx, { action: `Marked invoice ${inv.number} as paid`, entityType: "Invoice", entityName: row.companyName, companyId: inv.companyId })
    ctx.save()
    return row
  }),

  void: endpoint<{ id: string; reason?: string }, InvoiceRow, "admin">("admin", "PATCH", "/platform/invoices/:id", ({ id, reason }, ctx) => {
    requireAdmin(ctx, "billing.manage")
    const inv = findInvoice(ctx, id)
    if (inv.status === "void") throw badRequest("This invoice is already void.")
    if (inv.status === "paid") throw badRequest("Paid invoices can't be voided. Issue a credit note instead.")
    inv.status = "void"
    const row = toRow(ctx, inv)
    audit(ctx, { action: `Voided invoice ${inv.number}${reason ? ` — ${reason}` : ""}`, entityType: "Invoice", entityName: row.companyName, companyId: inv.companyId, severity: "warning" })
    ctx.save()
    return row
  }),

  /** Printable invoice (HTML in demo mode; the real API returns a PDF). */
  document: endpoint<{ id: string }, { fileName: string; html: string }, "admin">("admin", "GET", "/platform/invoices/:id/pdf", ({ id }, ctx) => {
    requireAdmin(ctx, "revenue.view")
    const d = toDetail(ctx, findInvoice(ctx, id))
    return { fileName: `${d.number}.html`, html: invoiceHtml(d) }
  }),

  exportCsv: endpoint<InvoiceQuery, { fileName: string; csv: string }, "admin">("admin", "GET", "/platform/invoices/export", (q, ctx) => {
    requireAdmin(ctx, "revenue.view")
    const rows = filterInvoices(ctx, q)
    const csv = toCsv(
      ["Number", "Company", "Plan", "Period start", "Period end", "Seats", "Amount", "GST", "Total", "Currency", "Status", "Issued", "Due", "Paid"],
      rows.map((r) => [r.number, r.companyName, r.planName, r.periodStart, r.periodEnd, r.seats, r.amount, r.tax, r.total, r.currency, r.status, r.issuedAt.slice(0, 10), r.dueAt.slice(0, 10), r.paidAt?.slice(0, 10) ?? ""]),
    )
    return { fileName: `healthx-invoices-${today()}.csv`, csv }
  }),
}
