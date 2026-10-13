/**
 * Employee app — rewards catalogue, detail and redemption (SCR-M-054 … SCR-M-056).
 * Redeeming deducts points exactly once (idempotency key), creates an order that the
 * Business Portal sees in its orders list, and decrements stock.
 */
import type { RedemptionOrder, Reward, RewardDelivery } from "@/lib/types"
import { ApiError, badRequest, endpoint, newId, type MockContext } from "../core"
import { companySettings, meEmployee } from "./challenges"

type Ctx = MockContext<"employee">

export const DELIVERY_LABEL: Record<RewardDelivery, string> = {
  digital_voucher: "E-voucher by email",
  physical: "Physical delivery",
  experience: "Experience — code by email",
  donation: "Donation on your behalf",
  company_perk: "Company benefit — HR will contact you",
}

/** Physical items need a postal address; everything else is delivered by email. */
export const needsAddress = (d: RewardDelivery) => d === "physical"

export interface RewardCard {
  id: string
  name: string
  emoji: string
  color: string
  pointsCost: number
  categoryId: string
  categoryName: string
  delivery: RewardDelivery
  companyReward: boolean
  featured: boolean
  stock: number | null
  lowStock: boolean
  needMore: number
}

export interface RewardsCatalogue {
  balance: number
  categories: { id: string; name: string; icon: string; count: number }[]
  items: RewardCard[]
  totalVisible: number
}

export interface RewardDetail extends RewardCard {
  description: string
  terms: string
  deliveryLabel: string
  provider: string | null
  perEmployeeLimit: number | null
  myRedemptions: number
  balance: number
  balanceAfter: number
  canRedeem: boolean
  blockedReason: string | null
  approvalRequired: boolean
  outOfStock: boolean
  defaults: { name: string; email: string; phone: string }
}

export interface RedeemInput {
  id: string
  idempotencyKey: string
  confirm: boolean
  delivery: { name: string; email: string; phone?: string; address?: string; notes?: string }
}

export interface RedeemResult {
  orderId: string
  orderNumber: string
  status: RedemptionOrder["status"]
  pointsDeducted: number
  balanceAfter: number
  approvalRequired: boolean
}

const ACTIVE_ORDER = (o: RedemptionOrder) => o.status !== "cancelled" && o.status !== "rejected"

function visibleRewards(ctx: Ctx, companyId: string) {
  const hidden = new Set(ctx.db.rewardSettings[companyId]?.hiddenGlobalRewardIds ?? [])
  return ctx.db.rewards.filter((r) => (r.companyId === null ? !hidden.has(r.id) : r.companyId === companyId) && r.status !== "archived" && r.status !== "draft")
}

const inStock = (r: Reward) => r.status === "active" && r.stock !== 0

function toCard(ctx: Ctx, r: Reward, balance: number): RewardCard {
  return {
    id: r.id,
    name: r.name,
    emoji: r.imageEmoji,
    color: r.imageColor,
    pointsCost: r.pointsCost,
    categoryId: r.categoryId,
    categoryName: ctx.db.rewardCategories.find((c) => c.id === r.categoryId)?.name ?? "Rewards",
    delivery: r.delivery,
    companyReward: r.companyId !== null,
    featured: r.featured,
    stock: r.stock,
    lowStock: r.stock !== null && r.stock > 0 && r.stock <= 10,
    needMore: Math.max(0, r.pointsCost - balance),
  }
}

const unavailable = () => new ApiError("This reward is no longer available.", 404, "not_found")

export const rewardsApi = {
  /** SCR-M-054 — rewards visible to the company and in stock. */
  catalogue: endpoint<{ categoryId?: string; affordable?: boolean; search?: string }, RewardsCatalogue, "employee">("employee", "GET", "/rewards", ({ categoryId, affordable, search }, ctx) => {
    const { emp } = meEmployee(ctx)
    const balance = emp.stats.pointsBalance
    const all = visibleRewards(ctx, emp.companyId).filter(inStock)
    const q = search?.trim().toLowerCase()
    const items = all
      .filter((r) => (!categoryId || categoryId === "all" || r.categoryId === categoryId) && (!affordable || r.pointsCost <= balance) && (!q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)))
      .sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.companyId !== null) - Number(a.companyId !== null) || a.pointsCost - b.pointsCost)
      .map((r) => toCard(ctx, r, balance))
    const categories = ctx.db.rewardCategories
      .map((c) => ({ id: c.id, name: c.name, icon: c.icon, count: all.filter((r) => r.categoryId === c.id).length }))
      .filter((c) => c.count > 0)
    return { balance, categories, items, totalVisible: all.length }
  }),

  /** SCR-M-055 (reward_viewed) */
  detail: endpoint<{ id: string }, RewardDetail, "employee">("employee", "GET", "/rewards/:id", ({ id }, ctx) => {
    const { emp } = meEmployee(ctx)
    const r = visibleRewards(ctx, emp.companyId).find((x) => x.id === id)
    if (!r) throw unavailable()
    const balance = emp.stats.pointsBalance
    const mine = ctx.db.orders.filter((o) => o.employeeId === emp.id && o.rewardId === r.id && ACTIVE_ORDER(o)).length
    const outOfStock = !inStock(r)
    const limitReached = r.perEmployeeLimit !== null && mine >= r.perEmployeeLimit
    const blockedReason = outOfStock
      ? "Sorry, this reward is out of stock."
      : limitReached
        ? `You've reached the limit of ${r.perEmployeeLimit} for this reward.`
        : balance < r.pointsCost
          ? `You need ${(r.pointsCost - balance).toLocaleString("en-IN")} more points.`
          : null
    return {
      ...toCard(ctx, r, balance),
      description: r.description,
      terms: r.terms,
      deliveryLabel: DELIVERY_LABEL[r.delivery],
      provider: r.provider ?? null,
      perEmployeeLimit: r.perEmployeeLimit,
      myRedemptions: mine,
      balance,
      balanceAfter: balance - r.pointsCost,
      canRedeem: !blockedReason,
      blockedReason,
      approvalRequired: companySettings(ctx, emp.companyId).redemptionApprovalRequired,
      outOfStock,
      defaults: { name: `${emp.firstName} ${emp.lastName}`, email: emp.email, phone: emp.phone ?? "" },
    }
  }),

  /** SCR-M-056 — create order, deduct points exactly once (reward_redeemed). */
  redeem: endpoint<RedeemInput, RedeemResult, "employee">("employee", "POST", "/rewards/:id/redeem", (input, ctx) => {
    const { me, emp } = meEmployee(ctx)
    const keys = ctx.extra("emp-redeem-keys", () => ({}) as Record<string, string>)
    const replay = keys[input.idempotencyKey]
    if (replay) {
      const existing = ctx.db.orders.find((o) => o.id === replay)
      if (existing)
        return { orderId: existing.id, orderNumber: existing.orderNumber, status: existing.status, pointsDeducted: existing.points, balanceAfter: emp.stats.pointsBalance, approvalRequired: existing.status === "pending_approval" }
    }

    const r = visibleRewards(ctx, emp.companyId).find((x) => x.id === input.id)
    if (!r) throw unavailable()
    if (!input.confirm) throw badRequest("Please confirm the points deduction.", { confirm: "Tick to confirm" })
    if (!inStock(r)) throw new ApiError("Sorry, this reward just went out of stock.", 409, "out_of_stock")
    const mine = ctx.db.orders.filter((o) => o.employeeId === emp.id && o.rewardId === r.id && ACTIVE_ORDER(o)).length
    if (r.perEmployeeLimit !== null && mine >= r.perEmployeeLimit) throw new ApiError(`You've reached the limit of ${r.perEmployeeLimit} for this reward.`, 409, "limit_reached")
    if (emp.stats.pointsBalance < r.pointsCost) throw new ApiError("Not enough points.", 409, "insufficient_points")

    // Delivery details (FRM-21)
    const d = input.delivery
    const errors: Record<string, string> = {}
    if (!d.name || d.name.trim().length < 2) errors["delivery.name"] = "Enter the recipient's name"
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email ?? "")) errors["delivery.email"] = "Enter a valid email address"
    if (needsAddress(r.delivery)) {
      if (!/^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/.test((d.phone ?? "").trim())) errors["delivery.phone"] = "Enter a valid 10-digit mobile number"
      if (!d.address || d.address.trim().length < 15) errors["delivery.address"] = "Enter the full address with PIN code"
    }
    if (Object.keys(errors).length) throw badRequest("Please check the delivery details.", errors)

    const approvalRequired = companySettings(ctx, emp.companyId).redemptionApprovalRequired
    const now = new Date().toISOString()
    const name = `${emp.firstName} ${emp.lastName}`

    // Deduct once
    emp.stats.pointsBalance -= r.pointsCost
    me.transactions.unshift({ id: newId("ptx"), employeeId: emp.id, type: "redeem", source: "redemption", points: -r.pointsCost, description: `Redeemed: ${r.name}`, balanceAfter: emp.stats.pointsBalance, createdAt: now })

    const maxNumber = ctx.db.orders.reduce((m, o) => Math.max(m, Number(o.orderNumber.replace(/\D/g, "")) || 0), 24800)
    const order: RedemptionOrder = {
      id: newId("ord"),
      orderNumber: `HX-${maxNumber + 1}`,
      companyId: emp.companyId,
      employeeId: emp.id,
      rewardId: r.id,
      points: r.pointsCost,
      quantity: 1,
      status: approvalRequired ? "pending_approval" : "approved",
      delivery: {
        name: d.name.trim(),
        email: d.email.trim(),
        phone: d.phone?.trim() || undefined,
        address: needsAddress(r.delivery) ? d.address?.trim() : undefined,
        notes: d.notes?.trim() || undefined,
      },
      timeline: [
        { status: "pending_approval", at: now, note: "Order placed", by: name },
        ...(approvalRequired ? [] : [{ status: "approved" as const, at: now, note: "Approved automatically", by: "HealthX" }]),
      ],
      createdAt: now,
      updatedAt: now,
    }
    ctx.db.orders.unshift(order)

    if (r.stock !== null) {
      r.stock = Math.max(0, r.stock - 1)
      if (r.stock === 0) r.status = "out_of_stock"
    }
    r.redemptionsCount++
    keys[input.idempotencyKey] = order.id
    me.notifications.unshift({
      id: newId("ntf"),
      type: "reward",
      title: approvalRequired ? "Order placed — waiting for approval" : "Order placed 🎁",
      body: `${r.name} · ${r.pointsCost.toLocaleString("en-IN")} points deducted.`,
      createdAt: now,
      read: true,
      href: `/employee-app/orders/${order.id}`,
    })
    ctx.save()
    return { orderId: order.id, orderNumber: order.orderNumber, status: order.status, pointsDeducted: r.pointsCost, balanceAfter: emp.stats.pointsBalance, approvalRequired }
  }),
}
