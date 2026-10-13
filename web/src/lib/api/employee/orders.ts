/**
 * Employee app — My orders (SCR-M-057) and Order detail (SCR-M-058).
 * Orders live in the shared db.orders table, so changes show up in the Business Portal.
 */
import type { OrderStatus, RedemptionOrder, RewardDelivery } from "@/lib/types"
import { ApiError, badRequest, endpoint, newId, type MockContext } from "../core"
import { meEmployee } from "./challenges"
import { DELIVERY_LABEL } from "./rewards"

type Ctx = MockContext<"employee">

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_approval: "Pending approval",
  approved: "Approved",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Fulfilled",
  cancelled: "Cancelled",
  rejected: "Rejected",
}

export type OrderFilter = "all" | "open" | "fulfilled" | "closed"

export interface OrderRow {
  id: string
  orderNumber: string
  rewardId: string
  rewardName: string
  emoji: string
  color: string
  delivery: RewardDelivery
  points: number
  status: OrderStatus
  createdAt: string
  updatedAt: string
}

export interface OrderDetail extends OrderRow {
  deliveryLabel: string
  details: RedemptionOrder["delivery"]
  voucherCode: string | null
  trackingNumber: string | null
  timeline: RedemptionOrder["timeline"]
  /** Remaining steps (for the timeline). */
  upcoming: OrderStatus[]
  canCancel: boolean
  refunded: boolean
  terms: string | null
}

const FLOW: OrderStatus[] = ["pending_approval", "approved", "processing", "shipped", "delivered"]

function row(ctx: Ctx, o: RedemptionOrder): OrderRow {
  const r = ctx.db.rewards.find((x) => x.id === o.rewardId)
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    rewardId: o.rewardId,
    rewardName: r?.name ?? "Reward",
    emoji: r?.imageEmoji ?? "🎁",
    color: r?.imageColor ?? "#10b981",
    delivery: r?.delivery ?? "digital_voucher",
    points: o.points,
    status: o.status,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  }
}

function myOrder(ctx: Ctx, id: string) {
  const { emp } = meEmployee(ctx)
  const o = ctx.db.orders.find((x) => x.id === id && x.employeeId === emp.id)
  if (!o) throw new ApiError("Couldn't find this order.", 404, "not_found")
  return o
}

export const ordersApi = {
  /** SCR-M-057 — newest first. */
  list: endpoint<{ status?: OrderFilter }, { items: OrderRow[]; counts: Record<OrderFilter, number> }, "employee">("employee", "GET", "/me/redemptions", ({ status = "all" }, ctx) => {
    const { emp } = meEmployee(ctx)
    const mine = ctx.db.orders.filter((o) => o.employeeId === emp.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const group = (s: OrderStatus): OrderFilter => (s === "delivered" ? "fulfilled" : s === "cancelled" || s === "rejected" ? "closed" : "open")
    const counts: Record<OrderFilter, number> = { all: mine.length, open: 0, fulfilled: 0, closed: 0 }
    mine.forEach((o) => counts[group(o.status)]++)
    return { items: mine.filter((o) => status === "all" || group(o.status) === status).map((o) => row(ctx, o)), counts }
  }),

  /** SCR-M-058 — voucher codes are only returned to the order owner. */
  detail: endpoint<{ id: string }, OrderDetail, "employee">("employee", "GET", "/me/redemptions/:id", ({ id }, ctx) => {
    const o = myOrder(ctx, id)
    const r = ctx.db.rewards.find((x) => x.id === o.rewardId)
    const base = row(ctx, o)
    const closed = o.status === "cancelled" || o.status === "rejected"
    const idx = FLOW.indexOf(o.status)
    const upcoming = closed || idx < 0 ? [] : FLOW.slice(idx + 1).filter((s) => !(s === "shipped" && base.delivery !== "physical"))
    return {
      ...base,
      deliveryLabel: DELIVERY_LABEL[base.delivery],
      details: o.delivery,
      voucherCode: o.voucherCode ?? null,
      trackingNumber: o.trackingNumber ?? null,
      timeline: o.timeline,
      upcoming,
      canCancel: o.status === "pending_approval",
      refunded: closed,
      terms: r?.terms ?? null,
    }
  }),

  /** Cancel a pending order — points are refunded and stock released. */
  cancel: endpoint<{ id: string; reason?: string }, { refunded: number; balance: number }, "employee">("employee", "POST", "/me/redemptions/:id/cancel", ({ id, reason }, ctx) => {
    const { me, emp } = meEmployee(ctx)
    const o = myOrder(ctx, id)
    if (o.status !== "pending_approval") throw badRequest("Only orders waiting for approval can be cancelled.")
    const r = ctx.db.rewards.find((x) => x.id === o.rewardId)
    const now = new Date().toISOString()
    o.status = "cancelled"
    o.updatedAt = now
    o.timeline.push({ status: "cancelled", at: now, note: reason?.trim() ? `Cancelled by employee: ${reason.trim()} — points refunded.` : "Cancelled by employee — points refunded.", by: `${emp.firstName} ${emp.lastName}` })
    emp.stats.pointsBalance += o.points
    me.transactions.unshift({ id: newId("ptx"), employeeId: emp.id, type: "refund", source: "refund", points: o.points, description: `Refund: ${r?.name ?? "Reward"}`, balanceAfter: emp.stats.pointsBalance, createdAt: now })
    if (r && r.stock !== null) {
      r.stock += o.quantity
      if (r.status === "out_of_stock") r.status = "active"
    }
    ctx.save()
    return { refunded: o.points, balance: emp.stats.pointsBalance }
  }),
}
