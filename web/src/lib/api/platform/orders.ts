/**
 * Platform Admin — redemption orders across all companies (SCR-P-015).
 * Client decision #13: redemptions are approved by the COMPANY admin (Business Portal). HealthX only sees
 * "Awaiting company approval" orders read-only; fulfilment starts once approved:
 * approved → processing → shipped (physical) → delivered, or cancel & refund.
 * Refunds return points to employees that have full records (Nimbus); other companies' wallets
 * live in their own tenant, so the refund is only recorded on the order and in the audit log.
 */
import type { OrderStatus, PointsTransaction, RedemptionOrder, RewardDelivery } from "@/lib/types"
import { audit, badRequest, endpoint, matchesSearch, newId, notFound, sortBy } from "../core"
import { companyName, requireAdmin, toCsv, type AdminCtx } from "./common"

export interface OrderQuery {
  search?: string
  companyId?: string
  /** "to_fulfil" = approved or processing. */
  status?: OrderStatus | "to_fulfil" | "all"
  delivery?: RewardDelivery | "all"
}

export interface OrderRow {
  id: string
  orderNumber: string
  companyId: string
  companyName: string
  employeeName: string
  employeeEmail: string
  rewardId: string
  rewardName: string
  rewardEmoji: string
  rewardColor: string
  delivery: RewardDelivery
  points: number
  quantity: number
  status: OrderStatus
  createdAt: string
  updatedAt: string
}

export interface OrderKpis {
  awaitingApproval: number
  toFulfil: number
  shipped: number
  deliveredThisMonth: number
}

export interface OrderList {
  items: OrderRow[]
  kpis: OrderKpis
  /** Companies that have orders (for the company filter). */
  companies: { id: string; name: string }[]
}

export interface OrderDetail extends RedemptionOrder {
  companyName: string
  rewardName: string
  rewardEmoji: string
  rewardColor: string
  rewardDelivery: RewardDelivery
  rewardProvider?: string
  /** Employee has a full record on HealthX (points can be refunded to their wallet). */
  walletLinked: boolean
  /** Whole days since the order was placed. */
  daysSincePlaced: number
}

export type FulfilStatus = "processing" | "shipped" | "delivered"

export interface FulfilInput {
  id: string
  status: FulfilStatus
  trackingNumber?: string
  voucherCode?: string
  note?: string
}

/** Which next steps are allowed from each status. */
export const NEXT_STEPS: Record<OrderStatus, FulfilStatus[]> = {
  pending_approval: [], // approved by the company in the Business Portal
  approved: ["processing"],
  processing: ["shipped", "delivered"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
  rejected: [],
}

export const CANCELLABLE: OrderStatus[] = ["approved", "processing"]

function rewardOf(ctx: AdminCtx, o: RedemptionOrder) {
  return ctx.db.rewards.find((r) => r.id === o.rewardId)
}

function toRow(ctx: AdminCtx, o: RedemptionOrder): OrderRow {
  const r = rewardOf(ctx, o)
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    companyId: o.companyId,
    companyName: companyName(ctx, o.companyId),
    employeeName: o.delivery.name,
    employeeEmail: o.delivery.email,
    rewardId: o.rewardId,
    rewardName: r?.name ?? "Removed reward",
    rewardEmoji: r?.imageEmoji ?? "🎁",
    rewardColor: r?.imageColor ?? "#64748b",
    delivery: r?.delivery ?? "digital_voucher",
    points: o.points,
    quantity: o.quantity,
    status: o.status,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  }
}

/** Decision #14: there is no company rewards budget — older sample notes that mention one are shown neutrally. */
const cleanNote = (note?: string) => (note && /budget/i.test(note) ? "Rejected by the company admin — points refunded." : note)

function toDetail(ctx: AdminCtx, o: RedemptionOrder): OrderDetail {
  const r = rewardOf(ctx, o)
  return {
    ...o,
    timeline: o.timeline.map((t) => ({ ...t, note: cleanNote(t.note) })),
    companyName: companyName(ctx, o.companyId),
    rewardName: r?.name ?? "Removed reward",
    rewardEmoji: r?.imageEmoji ?? "🎁",
    rewardColor: r?.imageColor ?? "#64748b",
    rewardDelivery: r?.delivery ?? "digital_voucher",
    rewardProvider: r?.provider,
    walletLinked: ctx.db.employees.some((e) => e.id === o.employeeId),
    daysSincePlaced: Math.max(0, Math.floor((ctx.now.getTime() - new Date(o.createdAt).getTime()) / 86_400_000)),
  }
}

function findOrder(ctx: AdminCtx, id: string) {
  const o = ctx.db.orders.find((x) => x.id === id)
  if (!o) throw notFound("Order")
  return o
}

function filterOrders(ctx: AdminCtx, q: OrderQuery) {
  return sortBy(
    ctx.db.orders
      .map((o) => toRow(ctx, o))
      .filter(
        (o) =>
          matchesSearch(q.search, o.orderNumber, o.employeeName, o.employeeEmail, o.rewardName, o.companyName) &&
          (!q.companyId || q.companyId === "all" || o.companyId === q.companyId) &&
          (!q.status || q.status === "all" || o.status === q.status || (q.status === "to_fulfil" && (o.status === "approved" || o.status === "processing"))) &&
          (!q.delivery || q.delivery === "all" || o.delivery === q.delivery),
      ),
    (o) => o.createdAt,
    "desc",
  )
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_approval: "Awaiting company approval",
  approved: "Approved",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  rejected: "Rejected",
}

export const ordersApi = {
  list: endpoint<OrderQuery, OrderList, "admin">("admin", "GET", "/platform/redemptions", (q, ctx) => {
    requireAdmin(ctx)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const all = ctx.db.orders
    const kpis: OrderKpis = {
      awaitingApproval: all.filter((o) => o.status === "pending_approval").length,
      toFulfil: all.filter((o) => o.status === "approved" || o.status === "processing").length,
      shipped: all.filter((o) => o.status === "shipped").length,
      deliveredThisMonth: all.filter((o) => {
        if (o.status !== "delivered") return false
        const at = [...o.timeline].reverse().find((t) => t.status === "delivered")?.at ?? o.updatedAt
        return new Date(at).getTime() >= monthStart
      }).length,
    }
    const companyIds = [...new Set(all.map((o) => o.companyId))]
    // Keep a pre-selected company (e.g. linked from a company page) in the filter even without orders.
    if (q.companyId && q.companyId !== "all" && !companyIds.includes(q.companyId) && ctx.db.companies.some((c) => c.id === q.companyId)) companyIds.push(q.companyId)
    const companies = companyIds.map((id) => ({ id, name: companyName(ctx, id) })).sort((a, b) => a.name.localeCompare(b.name))
    return { items: filterOrders(ctx, q), kpis, companies }
  }),

  get: endpoint<{ id: string }, OrderDetail, "admin">("admin", "GET", "/platform/redemptions/:id", ({ id }, ctx) => {
    requireAdmin(ctx)
    return toDetail(ctx, findOrder(ctx, id))
  }),

  /** Moves an order to its next fulfilment step (approve, processing, shipped, delivered). */
  fulfil: endpoint<FulfilInput, OrderDetail, "admin">("admin", "POST", "/platform/redemptions/:id/fulfil", (input, ctx) => {
    const admin = requireAdmin(ctx, "orders.manage")
    const o = findOrder(ctx, input.id)
    const reward = rewardOf(ctx, o)
    const delivery = reward?.delivery ?? "digital_voucher"
    if (o.status === "pending_approval") throw badRequest("Couldn't update order. It's waiting for the company admin's approval in the Business Portal.")
    if (!NEXT_STEPS[o.status].includes(input.status)) throw badRequest(`This order is ${STATUS_LABEL[o.status].toLowerCase()} and can't be marked as ${STATUS_LABEL[input.status].toLowerCase()}.`)
    const errors: Record<string, string> = {}
    const tracking = input.trackingNumber?.trim()
    const voucher = input.voucherCode?.trim()
    if (input.status === "shipped") {
      if (delivery !== "physical") throw badRequest("Only physical rewards are shipped. Mark this order as delivered instead.")
      if (!tracking) errors.trackingNumber = "Enter the courier tracking number."
      else if (tracking.length < 6) errors.trackingNumber = "Tracking number looks too short."
    }
    if (input.status === "delivered" && o.status === "processing" && delivery === "physical") throw badRequest("Mark this order as shipped first.")
    if (input.status === "delivered" && delivery === "digital_voucher" && !voucher && !o.voucherCode) errors.voucherCode = "Enter the voucher code sent to the employee."
    if (input.note && input.note.length > 300) errors.note = "Keep the note under 300 characters."
    if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)

    const at = new Date().toISOString()
    if (tracking) o.trackingNumber = tracking
    if (voucher) o.voucherCode = voucher
    const defaultNote =
      input.status === "processing"
          ? "Being prepared by the fulfilment team"
          : input.status === "shipped"
            ? `Shipped — tracking ${tracking}`
            : delivery === "digital_voucher"
              ? "Voucher code emailed to the employee"
              : "Delivered to the employee"
    o.status = input.status
    o.timeline.push({ status: input.status, at, note: input.note?.trim() || defaultNote, by: admin.user.name })
    o.updatedAt = at
    audit(ctx, {
      action: input.status === "delivered" ? "Fulfilled redemption order" : `Marked order as ${STATUS_LABEL[input.status].toLowerCase()}`,
      entityType: "Order",
      entityName: o.orderNumber,
      companyId: o.companyId,
    })
    ctx.save()
    return toDetail(ctx, o)
  }),

  /** Cancels an order and refunds the points. */
  cancel: endpoint<{ id: string; reason: string }, OrderDetail, "admin">("admin", "POST", "/platform/redemptions/:id/cancel", ({ id, reason }, ctx) => {
    const admin = requireAdmin(ctx, "orders.manage")
    const o = findOrder(ctx, id)
    if (!CANCELLABLE.includes(o.status)) throw badRequest(`This order is ${STATUS_LABEL[o.status].toLowerCase()} and can no longer be cancelled.`)
    const text = reason?.trim() ?? ""
    if (text.length < 5) throw badRequest("Please fix the highlighted fields.", { reason: "Tell the employee why the order is cancelled (at least 5 characters)." })
    if (text.length > 300) throw badRequest("Please fix the highlighted fields.", { reason: "Keep the reason under 300 characters." })

    const at = new Date().toISOString()
    const refund = o.points * Math.max(1, o.quantity)
    const employee = ctx.db.employees.find((e) => e.id === o.employeeId)
    if (employee) {
      employee.stats.pointsBalance += refund
      const tx: PointsTransaction = {
        id: newId("ptx"),
        employeeId: employee.id,
        type: "refund",
        source: "refund",
        points: refund,
        description: `Refund for order ${o.orderNumber}`,
        balanceAfter: employee.stats.pointsBalance,
        createdAt: at,
        createdBy: admin.user.name,
      }
      ctx.db.pointsTransactions.unshift(tx)
    }
    // Put the item back in stock.
    const reward = rewardOf(ctx, o)
    if (reward && reward.stock !== null) {
      reward.stock += Math.max(1, o.quantity)
      if (reward.status === "out_of_stock") reward.status = "active"
    }
    o.status = "cancelled"
    o.timeline.push({ status: "cancelled", at, note: `${text} — ${refund.toLocaleString("en-IN")} points refunded.`, by: admin.user.name })
    o.updatedAt = at
    audit(ctx, { action: `Cancelled order and refunded ${refund} points`, entityType: "Order", entityName: o.orderNumber, companyId: o.companyId, severity: "warning" })
    ctx.save()
    return toDetail(ctx, o)
  }),

  exportCsv: endpoint<OrderQuery, { fileName: string; csv: string; count: number }, "admin">("admin", "GET", "/platform/redemptions/export", (q, ctx) => {
    requireAdmin(ctx)
    const rows = filterOrders(ctx, q)
    const csv = toCsv(
      ["Order no.", "Company", "Employee", "Email", "Reward", "Delivery", "Points", "Quantity", "Status", "Placed", "Last update"],
      rows.map((o) => [o.orderNumber, o.companyName, o.employeeName, o.employeeEmail, o.rewardName, o.delivery, o.points, o.quantity, STATUS_LABEL[o.status], o.createdAt, o.updatedAt]),
    )
    audit(ctx, { action: `Exported ${rows.length} redemption orders`, entityType: "Order", entityName: "Orders export" })
    ctx.save()
    return { fileName: `healthx-redemption-orders-${new Date().toISOString().slice(0, 10)}.csv`, csv, count: rows.length }
  }),
}
