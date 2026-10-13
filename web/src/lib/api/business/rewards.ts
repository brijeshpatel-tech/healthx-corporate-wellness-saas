/**
 * Business Portal — company rewards and HealthX catalogue visibility
 * (SCR-B-017 / SCR-B-018). Company Owner only.
 */
import type { MockDB } from "@/lib/mock/db"
import type { Reward, RewardCategory, RewardDelivery } from "@/lib/types"
import { audit, badRequest, endpoint, matchesSearch, newId, notFound } from "../core"
import { requireRole, type BusinessCtx } from "./common"

const OWNER: Parameters<typeof requireRole>[1] = ["company_owner"]

export type RewardStatus = Reward["status"]
export type EditableRewardStatus = "draft" | "active" | "archived"

export const REWARD_DELIVERIES: RewardDelivery[] = ["physical", "digital_voucher", "experience", "donation", "company_perk"]

export const REWARD_LIMITS = {
  nameMin: 3,
  nameMax: 80,
  descriptionMin: 10,
  descriptionMax: 500,
  termsMax: 500,
  pointsMin: 50,
  pointsMax: 1_000_000,
  stockMax: 100_000,
  perEmployeeMax: 100,
} as const

export interface RewardRow extends Reward {
  categoryName: string
  categoryIcon: string
  isCompanyReward: boolean
  /** HealthX catalogue only: hidden from this company's employees. */
  hidden: boolean
  /** Orders by this company's employees that are not rejected/cancelled. */
  companyOrders: number
  pendingOrders: number
}

export interface RewardQuery {
  scope: "company" | "catalogue"
  categoryId?: string
  /** Company: reward status. Catalogue: "visible" / "hidden" also allowed. */
  status?: RewardStatus | "visible" | "hidden" | "all"
  search?: string
}

export interface RewardListResult {
  items: RewardRow[]
  counts: { company: number; catalogue: number; hidden: number; pendingOrders: number }
}

export interface RewardInput {
  name: string
  description: string
  terms: string
  categoryId: string
  pointsCost: number
  delivery: RewardDelivery
  stock: number | null
  perEmployeeLimit: number | null
  featured: boolean
  status: EditableRewardStatus
  imageEmoji: string
  imageColor: string
}

type RewardSettings = MockDB["rewardSettings"][string]

/** Per-company catalogue visibility. Points never expire and there is no rewards budget (client decision #14). */
function rewardSettings(ctx: BusinessCtx): Pick<RewardSettings, "hiddenGlobalRewardIds"> {
  const companyId = ctx.companyId()
  if (!ctx.db.rewardSettings[companyId]) ctx.db.rewardSettings[companyId] = { hiddenGlobalRewardIds: [] } as Partial<RewardSettings> as RewardSettings
  return ctx.db.rewardSettings[companyId]!
}

/** Keeps "out of stock" in line with the stock level (active ⇄ out_of_stock). */
export function syncRewardStockStatus(r: Reward) {
  if (r.status === "active" && r.stock === 0) r.status = "out_of_stock"
  else if (r.status === "out_of_stock" && (r.stock === null || r.stock > 0)) r.status = "active"
}

function toRow(ctx: BusinessCtx, r: Reward): RewardRow {
  const companyId = ctx.companyId()
  const cat = ctx.db.rewardCategories.find((c) => c.id === r.categoryId)
  const orders = ctx.db.orders.filter((o) => o.companyId === companyId && o.rewardId === r.id)
  return {
    ...r,
    categoryName: cat?.name ?? "Other",
    categoryIcon: cat?.icon ?? "🎁",
    isCompanyReward: r.companyId !== null,
    hidden: r.companyId === null && rewardSettings(ctx).hiddenGlobalRewardIds.includes(r.id),
    companyOrders: orders.filter((o) => o.status !== "rejected" && o.status !== "cancelled").length,
    pendingOrders: orders.filter((o) => o.status === "pending_approval").length,
  }
}

function findCompanyReward(ctx: BusinessCtx, id: string) {
  const r = ctx.db.rewards.find((x) => x.id === id && x.companyId === ctx.companyId())
  if (!r) throw notFound("Reward")
  return r
}

function validate(ctx: BusinessCtx, input: RewardInput, id?: string) {
  const L = REWARD_LIMITS
  const errors: Record<string, string> = {}
  const name = (input.name ?? "").trim()
  if (name.length < L.nameMin) errors.name = `Enter a name (at least ${L.nameMin} characters)`
  else if (name.length > L.nameMax) errors.name = `Keep the name under ${L.nameMax} characters`
  else if (ctx.db.rewards.some((r) => r.companyId === ctx.companyId() && r.id !== id && r.status !== "archived" && r.name.trim().toLowerCase() === name.toLowerCase()))
    errors.name = "You already have a reward with this name"
  const description = (input.description ?? "").trim()
  if (description.length < L.descriptionMin) errors.description = `Describe the reward (at least ${L.descriptionMin} characters)`
  else if (description.length > L.descriptionMax) errors.description = `Keep the description under ${L.descriptionMax} characters`
  if ((input.terms ?? "").trim().length > L.termsMax) errors.terms = `Keep the terms under ${L.termsMax} characters`
  if (!ctx.db.rewardCategories.some((c) => c.id === input.categoryId)) errors.categoryId = "Choose a category"
  if (!REWARD_DELIVERIES.includes(input.delivery)) errors.delivery = "Choose how the reward is delivered"
  if (!Number.isInteger(input.pointsCost) || input.pointsCost < L.pointsMin || input.pointsCost > L.pointsMax)
    errors.pointsCost = `Enter a whole number from ${L.pointsMin} to ${L.pointsMax.toLocaleString("en-IN")}`
  if (input.stock !== null && (!Number.isInteger(input.stock) || input.stock < 0 || input.stock > L.stockMax))
    errors.stock = `Enter 0 to ${L.stockMax.toLocaleString("en-IN")}, or leave blank for unlimited`
  if (input.perEmployeeLimit !== null && (!Number.isInteger(input.perEmployeeLimit) || input.perEmployeeLimit < 1 || input.perEmployeeLimit > L.perEmployeeMax))
    errors.perEmployeeLimit = `Enter 1 to ${L.perEmployeeMax}, or leave blank for no limit`
  if (!["draft", "active", "archived"].includes(input.status)) errors.status = "Choose a status"
  if (!input.imageEmoji?.trim()) errors.imageEmoji = "Pick an image"
  if (!/^#[0-9a-f]{6}$/i.test(input.imageColor ?? "")) errors.imageColor = "Pick a colour"
  if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
}

function applyInput(r: Reward, input: RewardInput) {
  r.name = input.name.trim()
  r.description = input.description.trim()
  r.terms = input.terms.trim()
  r.categoryId = input.categoryId
  r.pointsCost = input.pointsCost
  r.delivery = input.delivery
  r.stock = input.stock
  r.perEmployeeLimit = input.perEmployeeLimit
  r.featured = input.featured
  r.status = input.status
  r.imageEmoji = input.imageEmoji.trim()
  r.imageColor = input.imageColor
  syncRewardStockStatus(r)
}

const STATUS_ACTION: Record<EditableRewardStatus, string> = { active: "Activated reward", archived: "Deactivated reward", draft: "Moved reward to draft" }

// ─── Endpoints ──────────────────────────────────────────────────────────

export const rewardsApi = {
  categories: endpoint<void, RewardCategory[], "business">("business", "GET", "/organization/reward-categories", (_i, ctx) => {
    requireRole(ctx, OWNER)
    return ctx.db.rewardCategories
  }),

  list: endpoint<RewardQuery, RewardListResult, "business">("business", "GET", "/organization/rewards", (q, ctx) => {
    requireRole(ctx, OWNER)
    const companyId = ctx.companyId()
    const hidden = rewardSettings(ctx).hiddenGlobalRewardIds
    const company = ctx.db.rewards.filter((r) => r.companyId === companyId)
    const catalogue = ctx.db.rewards.filter((r) => r.companyId === null && r.status !== "archived" && r.status !== "draft")
    const base = q.scope === "catalogue" ? catalogue : company
    const items = base
      .map((r) => toRow(ctx, r))
      .filter((r) => {
        if (q.categoryId && r.categoryId !== q.categoryId) return false
        if (q.status && q.status !== "all") {
          if (q.status === "visible" && r.hidden) return false
          if (q.status === "hidden" && !r.hidden) return false
          if (q.status !== "visible" && q.status !== "hidden" && r.status !== q.status) return false
        }
        return matchesSearch(q.search, r.name, r.description, r.categoryName, r.provider)
      })
      .sort((a, b) => {
        const rank = (s: RewardStatus) => ({ active: 0, out_of_stock: 1, draft: 2, archived: 3 })[s]
        return q.scope === "company" ? rank(a.status) - rank(b.status) || Number(b.featured) - Number(a.featured) || b.createdAt.localeCompare(a.createdAt) : Number(a.hidden) - Number(b.hidden) || a.pointsCost - b.pointsCost
      })
    const pendingOrders = ctx.db.orders.filter((o) => o.companyId === companyId && o.status === "pending_approval").length
    return { items, counts: { company: company.length, catalogue: catalogue.length, hidden: catalogue.filter((r) => hidden.includes(r.id)).length, pendingOrders } }
  }),

  get: endpoint<{ id: string }, RewardRow, "business">("business", "GET", "/organization/rewards/:id", ({ id }, ctx) => {
    requireRole(ctx, OWNER)
    const r = ctx.db.rewards.find((x) => x.id === id && (x.companyId === ctx.companyId() || x.companyId === null))
    if (!r) throw notFound("Reward")
    return toRow(ctx, r)
  }),

  create: endpoint<RewardInput, RewardRow, "business">("business", "POST", "/organization/rewards", (input, ctx) => {
    requireRole(ctx, OWNER)
    validate(ctx, input)
    const r: Reward = {
      id: newId("rwd"),
      companyId: ctx.companyId(),
      categoryId: input.categoryId,
      name: "",
      description: "",
      terms: "",
      pointsCost: 0,
      delivery: input.delivery,
      imageEmoji: "🎁",
      imageColor: "#10b981",
      stock: null,
      perEmployeeLimit: null,
      status: "draft",
      featured: false,
      redemptionsCount: 0,
      createdAt: new Date().toISOString(),
    }
    applyInput(r, input)
    ctx.db.rewards.push(r)
    audit(ctx, { action: r.status === "active" || r.status === "out_of_stock" ? "Created and activated reward" : "Created reward", entityType: "Reward", entityName: r.name, companyId: ctx.companyId() })
    ctx.save()
    return toRow(ctx, r)
  }),

  update: endpoint<RewardInput & { id: string }, RewardRow, "business">("business", "PATCH", "/organization/rewards/:id", (input, ctx) => {
    requireRole(ctx, OWNER)
    const r = findCompanyReward(ctx, input.id)
    validate(ctx, input, r.id)
    const before = r.status
    applyInput(r, input)
    const changedStatus = before !== r.status && !(before === "out_of_stock" && r.status === "active") && !(before === "active" && r.status === "out_of_stock")
    audit(ctx, { action: changedStatus ? `Updated reward (${STATUS_ACTION[input.status].toLowerCase()})` : "Updated reward", entityType: "Reward", entityName: r.name, companyId: ctx.companyId() })
    ctx.save()
    return toRow(ctx, r)
  }),

  /** Activate / deactivate (archive) / move to draft from the list. */
  setStatus: endpoint<{ id: string; status: EditableRewardStatus }, RewardRow, "business">("business", "PATCH", "/organization/rewards/:id/status", ({ id, status }, ctx) => {
    requireRole(ctx, OWNER)
    const r = findCompanyReward(ctx, id)
    if (!["draft", "active", "archived"].includes(status)) throw badRequest("Choose a valid status.")
    r.status = status
    syncRewardStockStatus(r)
    audit(ctx, { action: STATUS_ACTION[status], entityType: "Reward", entityName: r.name, companyId: ctx.companyId(), severity: status === "archived" ? "warning" : "info" })
    ctx.save()
    return toRow(ctx, r)
  }),

  setVisibility: endpoint<{ id: string; visible: boolean }, RewardRow, "business">("business", "PATCH", "/organization/catalogue-rewards/:id/visibility", ({ id, visible }, ctx) => {
    requireRole(ctx, OWNER)
    const r = ctx.db.rewards.find((x) => x.id === id && x.companyId === null)
    if (!r) throw notFound("Catalogue reward")
    const settings = rewardSettings(ctx)
    settings.hiddenGlobalRewardIds = visible ? settings.hiddenGlobalRewardIds.filter((x) => x !== id) : [...new Set([...settings.hiddenGlobalRewardIds, id])]
    audit(ctx, { action: visible ? "Showed HealthX catalogue reward to employees" : "Hid HealthX catalogue reward from employees", entityType: "Reward", entityName: r.name, companyId: ctx.companyId() })
    ctx.save()
    return toRow(ctx, r)
  }),
}
