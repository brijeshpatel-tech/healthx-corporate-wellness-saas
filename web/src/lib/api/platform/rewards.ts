/**
 * Platform Admin — global rewards catalogue and reward categories (SCR-P-013, SCR-P-014).
 * Only global rewards (companyId === null) are managed here; companies add their own in the Business Portal.
 * Category order is the array order of db.rewardCategories.
 */
import type { Reward, RewardCategory, RewardDelivery } from "@/lib/types"
import { audit, badRequest, endpoint, matchesSearch, newId, notFound } from "../core"
import { requireAdmin, type AdminCtx } from "./common"

export type RewardStatus = Reward["status"]

export interface RewardQuery {
  search?: string
  categoryId?: string
  status?: RewardStatus | "all"
  delivery?: RewardDelivery | "all"
}

export interface RewardRow extends Reward {
  categoryName: string
  categoryIcon: string
}

export interface RewardList {
  items: RewardRow[]
  counts: { all: number; active: number; draft: number; out_of_stock: number; archived: number; featured: number }
}

export interface RewardInput {
  name: string
  categoryId: string
  description: string
  terms: string
  imageEmoji: string
  imageColor: string
  pointsCost: number
  delivery: RewardDelivery
  /** null = unlimited */
  stock: number | null
  perEmployeeLimit: number | null
  provider: string
  featured: boolean
  status: "active" | "draft" | "archived"
}

export interface CategoryRow extends RewardCategory {
  order: number
  rewardsCount: number
  globalCount: number
  companyCount: number
}

export interface CategoryInput {
  name: string
  icon: string
}

const DELIVERIES: RewardDelivery[] = ["physical", "digital_voucher", "experience", "donation", "company_perk"]

function findReward(ctx: AdminCtx, id: string) {
  const r = ctx.db.rewards.find((x) => x.id === id && x.companyId === null)
  if (!r) throw notFound("Reward")
  return r
}

function findCategory(ctx: AdminCtx, id: string) {
  const c = ctx.db.rewardCategories.find((x) => x.id === id)
  if (!c) throw notFound("Category")
  return c
}

const toRow = (ctx: AdminCtx, r: Reward): RewardRow => {
  const c = ctx.db.rewardCategories.find((x) => x.id === r.categoryId)
  return { ...r, categoryName: c?.name ?? "Uncategorised", categoryIcon: c?.icon ?? "🏷️" }
}

/** Stock 0 → out of stock; restocking an out-of-stock reward makes it active again. */
const effectiveStatus = (status: RewardInput["status"], stock: number | null): RewardStatus => (status === "active" && stock !== null && stock <= 0 ? "out_of_stock" : status)

function validateReward(ctx: AdminCtx, input: RewardInput, id?: string) {
  const errors: Record<string, string> = {}
  const name = input.name?.trim() ?? ""
  if (name.length < 3) errors.name = "Enter a reward name (at least 3 characters)."
  else if (name.length > 80) errors.name = "Keep the name under 80 characters."
  else if (ctx.db.rewards.some((r) => r.companyId === null && r.id !== id && r.name.trim().toLowerCase() === name.toLowerCase())) errors.name = "A global reward with this name already exists."
  if (!ctx.db.rewardCategories.some((c) => c.id === input.categoryId)) errors.categoryId = "Choose a category."
  if (!input.description?.trim()) errors.description = "Add a short description."
  if (!Number.isInteger(input.pointsCost) || input.pointsCost <= 0) errors.pointsCost = "Points cost must be greater than 0."
  else if (input.pointsCost > 1_000_000) errors.pointsCost = "Points cost looks too high."
  if (!DELIVERIES.includes(input.delivery)) errors.delivery = "Choose a delivery method."
  if (input.stock !== null && (!Number.isInteger(input.stock) || input.stock < 0)) errors.stock = "Stock must be 0 or more."
  if (input.perEmployeeLimit !== null && (!Number.isInteger(input.perEmployeeLimit) || input.perEmployeeLimit < 1)) errors.perEmployeeLimit = "Limit must be at least 1 (or leave empty)."
  if (!input.imageEmoji?.trim()) errors.imageEmoji = "Pick an image."
  if (!["active", "draft", "archived"].includes(input.status)) errors.status = "Choose a status."
  if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
  return {
    name,
    categoryId: input.categoryId,
    description: input.description.trim(),
    terms: input.terms?.trim() ?? "",
    imageEmoji: input.imageEmoji.trim(),
    imageColor: input.imageColor,
    pointsCost: input.pointsCost,
    delivery: input.delivery,
    stock: input.stock,
    perEmployeeLimit: input.perEmployeeLimit,
    provider: input.provider?.trim() || undefined,
    featured: input.featured,
    status: effectiveStatus(input.status, input.stock),
  }
}

function validateCategory(ctx: AdminCtx, input: CategoryInput, id?: string) {
  const errors: Record<string, string> = {}
  const name = input.name?.trim() ?? ""
  if (name.length < 2) errors.name = "Enter a category name."
  else if (name.length > 40) errors.name = "Keep the name under 40 characters."
  else if (ctx.db.rewardCategories.some((c) => c.id !== id && c.name.trim().toLowerCase() === name.toLowerCase())) errors.name = "A category with this name already exists."
  if (!input.icon?.trim()) errors.icon = "Pick an icon."
  if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
  return { name, icon: input.icon.trim() }
}

export const rewardsApi = {
  list: endpoint<RewardQuery, RewardList, "admin">("admin", "GET", "/platform/rewards", (q, ctx) => {
    requireAdmin(ctx)
    const global = ctx.db.rewards.filter((r) => r.companyId === null)
    const counts: RewardList["counts"] = { all: global.length, active: 0, draft: 0, out_of_stock: 0, archived: 0, featured: 0 }
    global.forEach((r) => {
      counts[r.status]++
      if (r.featured && r.status !== "archived") counts.featured++
    })
    const order: Record<RewardStatus, number> = { active: 0, out_of_stock: 1, draft: 2, archived: 3 }
    const items = global
      .filter(
        (r) =>
          matchesSearch(q.search, r.name, r.description, r.provider) &&
          (!q.categoryId || q.categoryId === "all" || r.categoryId === q.categoryId) &&
          (!q.status || q.status === "all" || r.status === q.status) &&
          (!q.delivery || q.delivery === "all" || r.delivery === q.delivery),
      )
      .sort((a, b) => order[a.status] - order[b.status] || Number(b.featured) - Number(a.featured) || b.redemptionsCount - a.redemptionsCount)
      .map((r) => toRow(ctx, r))
    return { items, counts }
  }),

  get: endpoint<{ id: string }, RewardRow, "admin">("admin", "GET", "/platform/rewards/:id", ({ id }, ctx) => {
    requireAdmin(ctx)
    return toRow(ctx, findReward(ctx, id))
  }),

  create: endpoint<RewardInput, Reward, "admin">("admin", "POST", "/platform/rewards", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const v = validateReward(ctx, input)
    const r: Reward = { id: newId("rwd"), companyId: null, ...v, redemptionsCount: 0, createdAt: new Date().toISOString() }
    ctx.db.rewards.unshift(r)
    audit(ctx, { action: "Created global reward", entityType: "Reward", entityName: r.name })
    ctx.save()
    return r
  }),

  update: endpoint<RewardInput & { id: string }, Reward, "admin">("admin", "PATCH", "/platform/rewards/:id", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const r = findReward(ctx, input.id)
    const v = validateReward(ctx, input, r.id)
    Object.assign(r, v)
    audit(ctx, { action: "Updated global reward", entityType: "Reward", entityName: r.name })
    ctx.save()
    return r
  }),

  setFeatured: endpoint<{ id: string; featured: boolean }, Reward, "admin">("admin", "PATCH", "/platform/rewards/:id/featured", ({ id, featured }, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const r = findReward(ctx, id)
    if (featured && r.status === "archived") throw badRequest("Activate this reward before featuring it.")
    r.featured = featured
    audit(ctx, { action: featured ? "Featured reward" : "Unfeatured reward", entityType: "Reward", entityName: r.name })
    ctx.save()
    return r
  }),

  setStatus: endpoint<{ id: string; status: "active" | "archived" }, Reward, "admin">("admin", "PATCH", "/platform/rewards/:id/status", ({ id, status }, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const r = findReward(ctx, id)
    if (status === "archived") {
      r.status = "archived"
      r.featured = false
    } else r.status = effectiveStatus("active", r.stock)
    audit(ctx, { action: status === "archived" ? "Deactivated global reward" : "Activated global reward", entityType: "Reward", entityName: r.name, severity: status === "archived" ? "warning" : "info" })
    ctx.save()
    return r
  }),
}

export const rewardCategoriesApi = {
  list: endpoint<void, CategoryRow[], "admin">("admin", "GET", "/platform/reward-categories", (_i, ctx) => {
    requireAdmin(ctx)
    return ctx.db.rewardCategories.map((c, i) => {
      const used = ctx.db.rewards.filter((r) => r.categoryId === c.id)
      const globalCount = used.filter((r) => r.companyId === null).length
      return { ...c, order: i + 1, rewardsCount: used.length, globalCount, companyCount: used.length - globalCount }
    })
  }),

  create: endpoint<CategoryInput, RewardCategory, "admin">("admin", "POST", "/platform/reward-categories", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const v = validateCategory(ctx, input)
    const c: RewardCategory = { id: newId("rcat"), ...v }
    ctx.db.rewardCategories.push(c)
    audit(ctx, { action: "Created reward category", entityType: "Reward category", entityName: c.name })
    ctx.save()
    return c
  }),

  update: endpoint<CategoryInput & { id: string }, RewardCategory, "admin">("admin", "PATCH", "/platform/reward-categories/:id", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const c = findCategory(ctx, input.id)
    Object.assign(c, validateCategory(ctx, input, c.id))
    audit(ctx, { action: "Updated reward category", entityType: "Reward category", entityName: c.name })
    ctx.save()
    return c
  }),

  /** Moves a category one place up or down. */
  move: endpoint<{ id: string; direction: "up" | "down" }, RewardCategory[], "admin">("admin", "PATCH", "/platform/reward-categories/:id/order", ({ id, direction }, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const list = ctx.db.rewardCategories
    const i = list.findIndex((c) => c.id === id)
    if (i < 0) throw notFound("Category")
    const j = direction === "up" ? i - 1 : i + 1
    if (j < 0 || j >= list.length) return list
    ;[list[i], list[j]] = [list[j]!, list[i]!]
    audit(ctx, { action: `Moved reward category ${direction}`, entityType: "Reward category", entityName: list[j]!.name })
    ctx.save()
    return list
  }),

  remove: endpoint<{ id: string }, { id: string }, "admin">("admin", "DELETE", "/platform/reward-categories/:id", ({ id }, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const c = findCategory(ctx, id)
    const used = ctx.db.rewards.filter((r) => r.categoryId === id).length
    if (used > 0) throw badRequest(`“${c.name}” is used by ${used} reward${used === 1 ? "" : "s"}. Move them to another category first.`)
    ctx.db.rewardCategories = ctx.db.rewardCategories.filter((x) => x.id !== id)
    audit(ctx, { action: "Deleted reward category", entityType: "Reward category", entityName: c.name, severity: "warning" })
    ctx.save()
    return { id }
  }),
}
