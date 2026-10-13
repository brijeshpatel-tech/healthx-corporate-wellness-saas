/**
 * Platform Admin — badges, icons and criteria (SCR-P-020). Shared by every company's Employee App.
 */
import type { Badge, BadgeRarity } from "@/lib/types"
import { audit, badRequest, endpoint, matchesSearch, newId, notFound } from "../core"
import { requireAdmin, type AdminCtx } from "./common"

export type BadgeStatus = Badge["status"]
export type BadgeCriteriaType = Badge["criteriaType"]

export interface BadgeQuery {
  search?: string
  rarity?: BadgeRarity | "all"
  status?: BadgeStatus | "all"
}

export interface BadgeList {
  items: Badge[]
  counts: { all: number; active: number; draft: number; archived: number; awarded: number }
}

export interface BadgeInput {
  name: string
  description: string
  icon: string
  color: string
  criteriaType: BadgeCriteriaType
  threshold: number
  criteria: string
  rarity: BadgeRarity
  points: number
  status: BadgeStatus
}

const CRITERIA: BadgeCriteriaType[] = ["first_workout", "streak", "steps_total", "water_goal", "early_activity", "challenge", "custom"]
const RARITIES: BadgeRarity[] = ["common", "rare", "epic", "legendary"]
const RARITY_ORDER: Record<BadgeRarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 }

function findBadge(ctx: AdminCtx, id: string) {
  const b = ctx.db.badges.find((x) => x.id === id)
  if (!b) throw notFound("Badge")
  return b
}

function validate(ctx: AdminCtx, input: BadgeInput, id?: string) {
  const errors: Record<string, string> = {}
  const name = input.name?.trim() ?? ""
  if (name.length < 2) errors.name = "Enter a badge name."
  else if (name.length > 40) errors.name = "Keep the name under 40 characters."
  else if (ctx.db.badges.some((b) => b.id !== id && b.name.trim().toLowerCase() === name.toLowerCase())) errors.name = "A badge with this name already exists."
  if (!input.description?.trim()) errors.description = "Add a short description employees will see."
  if (!input.icon?.trim()) errors.icon = "Pick an icon."
  if (!CRITERIA.includes(input.criteriaType)) errors.criteriaType = "Choose a criteria type."
  if (!Number.isFinite(input.threshold) || input.threshold <= 0) errors.threshold = "Threshold must be greater than 0."
  if (!input.criteria?.trim()) errors.criteria = "Describe how the badge is earned."
  if (!RARITIES.includes(input.rarity)) errors.rarity = "Choose a rarity."
  if (!Number.isInteger(input.points) || input.points < 0 || input.points > 1000) errors.points = "Bonus points must be between 0 and 1,000."
  if (!["active", "draft", "archived"].includes(input.status)) errors.status = "Choose a status."
  if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
  return { ...input, name, description: input.description.trim(), criteria: input.criteria.trim(), icon: input.icon.trim() }
}

export const badgesApi = {
  list: endpoint<BadgeQuery, BadgeList, "admin">("admin", "GET", "/platform/badges", (q, ctx) => {
    requireAdmin(ctx)
    const all = ctx.db.badges
    const counts: BadgeList["counts"] = { all: all.length, active: 0, draft: 0, archived: 0, awarded: 0 }
    all.forEach((b) => {
      counts[b.status]++
      counts.awarded += b.earnedCount
    })
    const statusOrder: Record<BadgeStatus, number> = { active: 0, draft: 1, archived: 2 }
    const items = all
      .filter(
        (b) =>
          matchesSearch(q.search, b.name, b.description, b.criteria) &&
          (!q.rarity || q.rarity === "all" || b.rarity === q.rarity) &&
          (!q.status || q.status === "all" || b.status === q.status),
      )
      .sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || b.earnedCount - a.earnedCount)
    return { items, counts }
  }),

  create: endpoint<BadgeInput, Badge, "admin">("admin", "POST", "/platform/badges", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const v = validate(ctx, input)
    const b: Badge = { id: newId("badge"), ...v, earnedCount: 0 }
    ctx.db.badges.push(b)
    audit(ctx, { action: "Created badge", entityType: "Badge", entityName: b.name })
    ctx.save()
    return b
  }),

  update: endpoint<BadgeInput & { id: string }, Badge, "admin">("admin", "PATCH", "/platform/badges/:id", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const b = findBadge(ctx, input.id)
    const { id: _id, ...rest } = input
    void _id
    Object.assign(b, validate(ctx, rest, b.id))
    audit(ctx, { action: "Updated badge", entityType: "Badge", entityName: b.name })
    ctx.save()
    return b
  }),

  setStatus: endpoint<{ id: string; status: BadgeStatus }, Badge, "admin">("admin", "PATCH", "/platform/badges/:id/status", ({ id, status }, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const b = findBadge(ctx, id)
    if (!["active", "draft", "archived"].includes(status)) throw badRequest("Unknown status.")
    b.status = status
    audit(ctx, { action: status === "archived" ? "Deactivated badge" : status === "active" ? "Activated badge" : "Moved badge to draft", entityType: "Badge", entityName: b.name, severity: status === "archived" ? "warning" : "info" })
    ctx.save()
    return b
  }),
}
