/**
 * Business Portal — redemption orders and fulfilment (SCR-B-019 / SCR-B-020).
 * Company Owner and HR Admin. Employee name and delivery details are shown only for fulfilment.
 * Every redemption needs company-admin approval (client decision #13), so orders start as "pending_approval".
 *
 * Every action sends the status the admin saw (`fromStatus`). If another admin changed the
 * order in the meantime the call fails with 409 "conflict" and nothing is changed.
 */
import type { EmployeeStatus, OrderStatus, Paginated, RedemptionOrder, Reward, RewardDelivery } from "@/lib/types"
import { toLocalDate } from "@/lib/mock/series"
import { ApiError, audit, badRequest, endpoint, matchesSearch, notFound, paginate } from "../core"
import { notifyEmployees } from "./challenges"
import { requireRole, type BusinessCtx } from "./common"
import { creditPoints, toCsv } from "./points"
import { syncRewardStockStatus } from "./rewards"

const ADMIN_ROLES: Parameters<typeof requireRole>[1] = ["company_owner", "hr_admin"]

export const ORDER_STATUSES: OrderStatus[] = ["pending_approval", "approved", "processing", "shipped", "delivered", "rejected", "cancelled"]

export type OrderAction = "approve" | "reject" | "process" | "ship" | "deliver" | "cancel"

/** Next steps an admin can take for an order (status + reward delivery method). */
export function allowedOrderActions(status: OrderStatus, delivery: RewardDelivery): OrderAction[] {
  switch (status) {
    case "pending_approval":
      return ["approve", "reject"]
    case "approved":
      return delivery === "physical" ? ["process", "cancel"] : ["process", "deliver", "cancel"]
    case "processing":
      return delivery === "physical" ? ["ship", "deliver", "cancel"] : ["deliver", "cancel"]
    case "shipped":
      return ["deliver", "cancel"]
    default:
      return []
  }
}

export interface OrderQuery {
  status?: OrderStatus | "all"
  rewardId?: string
  /** YYYY-MM-DD, inclusive. */
  from?: string
  to?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface OrderRow {
  id: string
  orderNumber: string
  employeeId: string
  employeeName: string
  avatarColor: string
  rewardId: string
  rewardName: string
  rewardEmoji: string
  rewardColor: string
  delivery: RewardDelivery
  isCompanyReward: boolean
  points: number
  quantity: number
  status: OrderStatus
  createdAt: string
  updatedAt: string
}

export interface OrderListResult extends Paginated<OrderRow> {
  counts: Record<OrderStatus | "all", number>
  rewards: { id: string; name: string; emoji: string; color: string }[]
}

export interface OrderDetail extends RedemptionOrder {
  employee: { id: string; name: string; email: string; avatarColor: string; departmentName: string; status: EmployeeStatus } | null
  reward: {
    id: string
    name: string
    emoji: string
    color: string
    delivery: RewardDelivery
    categoryName: string
    isCompanyReward: boolean
    provider?: string
    terms: string
    stock: number | null
  }
  actions: OrderAction[]
}

interface ActionBase {
  id: string
  /** The status the admin saw — guards against two admins updating at once. */
  fromStatus: OrderStatus
  /** Optional note to the employee (shown in the timeline and notification). */
  note?: string
}

export type ApproveOrderInput = ActionBase
export interface ReasonOrderInput extends ActionBase {
  reason: string
}
export interface FulfilOrderInput extends ActionBase {
  step: "processing" | "shipped" | "delivered"
  trackingNumber?: string
  voucherCode?: string
}

export const CONFLICT_MESSAGE = "This order was already updated by another admin. Refresh to see the latest status."

// ─── Helpers ────────────────────────────────────────────────────────────

const fullName = (e: { firstName: string; lastName: string }) => `${e.firstName} ${e.lastName}`

function companyOrders(ctx: BusinessCtx) {
  const companyId = ctx.companyId()
  return ctx.db.orders.filter((o) => o.companyId === companyId)
}

function toRow(ctx: BusinessCtx, o: RedemptionOrder): OrderRow {
  const e = ctx.db.employees.find((x) => x.id === o.employeeId)
  const r = ctx.db.rewards.find((x) => x.id === o.rewardId)
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    employeeId: o.employeeId,
    employeeName: e ? fullName(e) : o.delivery.name,
    avatarColor: e?.avatarColor ?? "#64748b",
    rewardId: o.rewardId,
    rewardName: r?.name ?? "Reward no longer available",
    rewardEmoji: r?.imageEmoji ?? "🎁",
    rewardColor: r?.imageColor ?? "#64748b",
    delivery: r?.delivery ?? "physical",
    isCompanyReward: !!r?.companyId,
    points: o.points,
    quantity: o.quantity,
    status: o.status,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  }
}

function detail(ctx: BusinessCtx, o: RedemptionOrder): OrderDetail {
  const e = ctx.db.employees.find((x) => x.id === o.employeeId)
  const r = ctx.db.rewards.find((x) => x.id === o.rewardId)
  const delivery = r?.delivery ?? "physical"
  return {
    ...o,
    employee: e
      ? { id: e.id, name: fullName(e), email: e.email, avatarColor: e.avatarColor, departmentName: ctx.db.departments.find((d) => d.id === e.departmentId)?.name ?? "—", status: e.status }
      : null,
    reward: {
      id: o.rewardId,
      name: r?.name ?? "Reward no longer available",
      emoji: r?.imageEmoji ?? "🎁",
      color: r?.imageColor ?? "#64748b",
      delivery,
      categoryName: ctx.db.rewardCategories.find((c) => c.id === r?.categoryId)?.name ?? "Other",
      isCompanyReward: !!r?.companyId,
      provider: r?.provider,
      terms: r?.terms ?? "",
      stock: r?.stock ?? null,
    },
    actions: allowedOrderActions(o.status, delivery),
  }
}

function filterOrders(ctx: BusinessCtx, q: OrderQuery, ignoreStatus = false) {
  return companyOrders(ctx)
    .map((o) => toRow(ctx, o))
    .filter((r) => {
      if (!ignoreStatus && q.status && q.status !== "all" && r.status !== q.status) return false
      if (q.rewardId && r.rewardId !== q.rewardId) return false
      const day = toLocalDate(new Date(r.createdAt))
      if (q.from && day < q.from) return false
      if (q.to && day > q.to) return false
      return matchesSearch(q.search, r.orderNumber, r.employeeName, r.rewardName)
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Loads an order of this company and checks nobody else changed it since the admin looked. */
function loadForAction(ctx: BusinessCtx, id: string, fromStatus: OrderStatus) {
  const order = companyOrders(ctx).find((o) => o.id === id)
  if (!order) throw notFound("Order")
  if (fromStatus && order.status !== fromStatus) throw new ApiError(CONFLICT_MESSAGE, 409, "conflict")
  const reward = ctx.db.rewards.find((r) => r.id === order.rewardId)
  return { order, reward, delivery: reward?.delivery ?? ("physical" as RewardDelivery) }
}

function cleanNote(note: string | undefined, errors: Record<string, string>) {
  const n = (note ?? "").trim()
  if (n.length > 300) errors.note = "Keep the note under 300 characters"
  return n || undefined
}

function pushStep(ctx: BusinessCtx, order: RedemptionOrder, status: OrderStatus, note?: string) {
  const at = new Date().toISOString()
  order.status = status
  order.timeline.push({ status, at, note, by: ctx.session().user.name })
  order.updatedAt = at
}

/** Gives the points back, restores limited stock and the redemption count. */
function refund(ctx: BusinessCtx, order: RedemptionOrder, reward: Reward | undefined, why: string) {
  const name = reward?.name ?? "Reward"
  if (ctx.db.employees.some((e) => e.id === order.employeeId && e.companyId === ctx.companyId()))
    creditPoints(ctx, order.employeeId, order.points, { type: "refund", source: "refund", description: `Refund: ${name} (${order.orderNumber}) — ${why}`, createdBy: ctx.session().user.name })
  if (reward) {
    if (reward.stock !== null) reward.stock += order.quantity
    reward.redemptionsCount = Math.max(0, reward.redemptionsCount - order.quantity)
    syncRewardStockStatus(reward)
  }
}

function notify(ctx: BusinessCtx, order: RedemptionOrder, title: string, body: string) {
  notifyEmployees(ctx, [order.employeeId], { type: "reward", title, body, href: "/employee-app/orders" }, "rewards")
}

const withNote = (text: string, note?: string) => (note ? `${text} Note from your HR team: ${note}` : text)
const pts = (n: number) => n.toLocaleString("en-IN")

function approveOne(ctx: BusinessCtx, order: RedemptionOrder, reward: Reward | undefined, note?: string) {
  pushStep(ctx, order, "approved", note)
  notify(ctx, order, "Your reward order was approved ✅", withNote(`${reward?.name ?? "Your reward"} (${order.orderNumber}) is approved and will be fulfilled soon.`, note))
}

// ─── Endpoints ──────────────────────────────────────────────────────────

export const ordersApi = {
  list: endpoint<OrderQuery, OrderListResult, "business">("business", "GET", "/organization/redemptions", (q, ctx) => {
    requireRole(ctx, ADMIN_ROLES)
    const base = filterOrders(ctx, q, true)
    const counts = Object.fromEntries([["all", base.length], ...ORDER_STATUSES.map((s) => [s, base.filter((r) => r.status === s).length])]) as OrderListResult["counts"]
    const rows = q.status && q.status !== "all" ? base.filter((r) => r.status === q.status) : base
    const rewards = new Map<string, OrderListResult["rewards"][number]>()
    for (const o of companyOrders(ctx)) {
      if (rewards.has(o.rewardId)) continue
      const r = ctx.db.rewards.find((x) => x.id === o.rewardId)
      if (r) rewards.set(r.id, { id: r.id, name: r.name, emoji: r.imageEmoji, color: r.imageColor })
    }
    return {
      ...paginate(rows, q.page ?? 1, q.pageSize ?? 15),
      counts,
      rewards: [...rewards.values()].sort((a, b) => a.name.localeCompare(b.name)),
    }
  }),

  get: endpoint<{ id: string }, OrderDetail, "business">("business", "GET", "/organization/redemptions/:id", ({ id }, ctx) => {
    requireRole(ctx, ADMIN_ROLES)
    const o = companyOrders(ctx).find((x) => x.id === id)
    if (!o) throw notFound("Order")
    return detail(ctx, o)
  }),

  approve: endpoint<ApproveOrderInput, OrderDetail, "business">("business", "POST", "/organization/redemptions/:id/approve", (input, ctx) => {
    requireRole(ctx, ADMIN_ROLES)
    const { order, reward, delivery } = loadForAction(ctx, input.id, input.fromStatus)
    if (!allowedOrderActions(order.status, delivery).includes("approve")) throw badRequest("Only orders waiting for approval can be approved.")
    const errors: Record<string, string> = {}
    const note = cleanNote(input.note, errors)
    if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
    approveOne(ctx, order, reward, note)
    audit(ctx, { action: "Approved reward order", entityType: "Order", entityName: order.orderNumber, companyId: ctx.companyId() })
    ctx.save()
    return detail(ctx, order)
  }),

  bulkApprove: endpoint<{ ids: string[] }, { approved: number; skipped: number }, "business">("business", "POST", "/organization/redemptions/bulk-approve", ({ ids }, ctx) => {
    requireRole(ctx, ADMIN_ROLES)
    let approved = 0
    const numbers: string[] = []
    for (const id of new Set(ids)) {
      const order = companyOrders(ctx).find((o) => o.id === id)
      if (!order || order.status !== "pending_approval") continue
      approveOne(ctx, order, ctx.db.rewards.find((r) => r.id === order.rewardId))
      numbers.push(order.orderNumber)
      approved++
    }
    if (!approved) throw badRequest("None of the selected orders are waiting for approval. Refresh to see the latest status.")
    audit(ctx, { action: `Approved ${approved} reward orders (bulk)`, entityType: "Order", entityName: numbers.length > 3 ? `${numbers.slice(0, 3).join(", ")} +${numbers.length - 3} more` : numbers.join(", "), companyId: ctx.companyId() })
    ctx.save()
    return { approved, skipped: new Set(ids).size - approved }
  }),

  reject: endpoint<ReasonOrderInput, OrderDetail, "business">("business", "POST", "/organization/redemptions/:id/reject", (input, ctx) => {
    requireRole(ctx, ADMIN_ROLES)
    const { order, reward, delivery } = loadForAction(ctx, input.id, input.fromStatus)
    if (!allowedOrderActions(order.status, delivery).includes("reject")) throw badRequest("Only orders waiting for approval can be rejected.")
    const reason = (input.reason ?? "").trim()
    if (reason.length < 5) throw badRequest("Please fix the highlighted fields.", { reason: "Tell the employee why (at least 5 characters)" })
    if (reason.length > 300) throw badRequest("Please fix the highlighted fields.", { reason: "Keep the reason under 300 characters" })
    pushStep(ctx, order, "rejected", `${reason} — ${pts(order.points)} points refunded.`)
    refund(ctx, order, reward, "order rejected")
    notify(ctx, order, "Your reward order was not approved", `${reward?.name ?? "Your reward"} (${order.orderNumber}): ${reason} ${pts(order.points)} points are back in your wallet.`)
    audit(ctx, { action: `Rejected reward order and refunded ${pts(order.points)} points`, entityType: "Order", entityName: order.orderNumber, companyId: ctx.companyId(), severity: "warning" })
    ctx.save()
    return detail(ctx, order)
  }),

  fulfil: endpoint<FulfilOrderInput, OrderDetail, "business">("business", "POST", "/organization/redemptions/:id/fulfil", (input, ctx) => {
    requireRole(ctx, ADMIN_ROLES)
    const { order, reward, delivery } = loadForAction(ctx, input.id, input.fromStatus)
    const action: OrderAction = input.step === "processing" ? "process" : input.step === "shipped" ? "ship" : "deliver"
    if (!allowedOrderActions(order.status, delivery).includes(action)) throw badRequest(`This order can't be marked as ${input.step} right now.`)
    const errors: Record<string, string> = {}
    const note = cleanNote(input.note, errors)
    const tracking = (input.trackingNumber ?? "").trim()
    const voucher = (input.voucherCode ?? "").trim()
    if (input.step === "shipped") {
      if (!tracking) errors.trackingNumber = "Enter the courier tracking number"
      else if (!/^[A-Za-z0-9-]{4,40}$/.test(tracking)) errors.trackingNumber = "Use 4–40 letters, numbers or dashes"
    }
    if (input.step === "delivered" && delivery === "digital_voucher") {
      if (!voucher) errors.voucherCode = "Enter the voucher code — it's required for e-voucher rewards"
      else if (!/^[A-Za-z0-9-]{4,40}$/.test(voucher)) errors.voucherCode = "Use 4–40 letters, numbers or dashes"
    }
    if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)

    const name = reward?.name ?? "Your reward"
    if (input.step === "processing") {
      pushStep(ctx, order, "processing", note)
      notify(ctx, order, "Your reward is being prepared", withNote(`${name} (${order.orderNumber}) is being processed.`, note))
    } else if (input.step === "shipped") {
      order.trackingNumber = tracking
      pushStep(ctx, order, "shipped", note ? `Tracking number ${tracking}. ${note}` : `Tracking number ${tracking}`)
      notify(ctx, order, "Your reward is on its way 📦", withNote(`${name} (${order.orderNumber}) has shipped. Tracking number: ${tracking}.`, note))
    } else {
      if (voucher) order.voucherCode = voucher
      pushStep(ctx, order, "delivered", note ?? (voucher ? "Voucher code sent to the employee" : undefined))
      notify(
        ctx,
        order,
        "Your reward has been delivered 🎉",
        withNote(voucher ? `Your voucher code for ${name} is ready — open My orders to see it.` : `${name} (${order.orderNumber}) has been delivered. Enjoy!`, note),
      )
    }
    const label = input.step === "processing" ? "processing" : input.step
    audit(ctx, { action: `Marked reward order as ${label}`, entityType: "Order", entityName: order.orderNumber, companyId: ctx.companyId() })
    ctx.save()
    return detail(ctx, order)
  }),

  cancel: endpoint<ReasonOrderInput, OrderDetail, "business">("business", "POST", "/organization/redemptions/:id/cancel", (input, ctx) => {
    requireRole(ctx, ADMIN_ROLES)
    const { order, reward, delivery } = loadForAction(ctx, input.id, input.fromStatus)
    if (!allowedOrderActions(order.status, delivery).includes("cancel")) throw badRequest("This order can no longer be cancelled.")
    const reason = (input.reason ?? "").trim()
    if (reason.length < 5) throw badRequest("Please fix the highlighted fields.", { reason: "Tell the employee why (at least 5 characters)" })
    if (reason.length > 300) throw badRequest("Please fix the highlighted fields.", { reason: "Keep the reason under 300 characters" })
    pushStep(ctx, order, "cancelled", `${reason} — ${pts(order.points)} points refunded.`)
    refund(ctx, order, reward, "order cancelled")
    notify(ctx, order, "Your reward order was cancelled", `${reward?.name ?? "Your reward"} (${order.orderNumber}): ${reason} ${pts(order.points)} points are back in your wallet.`)
    audit(ctx, { action: `Cancelled reward order and refunded ${pts(order.points)} points`, entityType: "Order", entityName: order.orderNumber, companyId: ctx.companyId(), severity: "warning" })
    ctx.save()
    return detail(ctx, order)
  }),

  exportCsv: endpoint<OrderQuery, { fileName: string; csv: string }, "business">("business", "GET", "/organization/redemptions/export", (q, ctx) => {
    requireRole(ctx, ADMIN_ROLES)
    const rows = filterOrders(ctx, q)
    const byId = new Map(companyOrders(ctx).map((o) => [o.id, o]))
    const csv = toCsv(
      ["Order no.", "Placed", "Employee", "Reward", "Delivery method", "Points", "Status", "Tracking number", "Last updated"],
      rows.map((r) => [r.orderNumber, r.createdAt.slice(0, 10), r.employeeName, r.rewardName, r.delivery.replace(/_/g, " "), r.points, r.status.replace(/_/g, " "), byId.get(r.id)?.trackingNumber ?? "", r.updatedAt.slice(0, 10)]),
    )
    audit(ctx, { action: "Exported reward orders (CSV)", entityType: "Report", entityName: `${rows.length} orders`, companyId: ctx.companyId() })
    ctx.save()
    return { fileName: `reward-orders-${new Date().toISOString().slice(0, 10)}.csv`, csv }
  }),
}
