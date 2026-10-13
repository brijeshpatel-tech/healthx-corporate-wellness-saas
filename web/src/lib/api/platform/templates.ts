/**
 * Platform Admin — global challenge templates (SCR-P-011, SCR-P-012).
 * Companies pick published templates in the Business Portal challenge composer.
 */
import type { ChallengeMetric, ChallengeTemplate, ChallengeType } from "@/lib/types"
import { audit, badRequest, endpoint, matchesSearch, newId, notFound } from "../core"
import { requireAdmin, type AdminCtx } from "./common"

export type TemplateCategory = ChallengeTemplate["category"]
export type TemplateStatus = ChallengeTemplate["status"]

export interface TemplateQuery {
  search?: string
  category?: TemplateCategory | "all"
  type?: ChallengeType | "all"
  status?: TemplateStatus | "all"
}

export interface TemplateList {
  items: ChallengeTemplate[]
  /** Counts over all templates (ignores filters). */
  counts: Record<TemplateStatus | "all", number>
}

export interface TemplateInput {
  name: string
  description: string
  category: TemplateCategory
  type: ChallengeType
  metric: ChallengeMetric
  target: number
  durationDays: number
  points: number
  coverEmoji: string
  coverColor: string
  rules: string[]
  status: "draft" | "published"
}

const CATEGORIES: TemplateCategory[] = ["movement", "hydration", "mindfulness", "fitness", "habits", "team"]
const TYPES: ChallengeType[] = ["individual", "leaderboard", "team", "company", "collaborative"]
const METRICS: ChallengeMetric[] = ["steps", "distance", "calories", "active_minutes", "workouts", "water", "meditation", "custom"]

function findTemplate(ctx: AdminCtx, id: string) {
  const t = ctx.db.challengeTemplates.find((x) => x.id === id)
  if (!t) throw notFound("Template")
  return t
}

function validate(ctx: AdminCtx, input: TemplateInput, id?: string) {
  const errors: Record<string, string> = {}
  const name = input.name?.trim() ?? ""
  if (name.length < 3) errors.name = "Enter a template name (at least 3 characters)."
  else if (name.length > 80) errors.name = "Keep the name under 80 characters."
  else if (ctx.db.challengeTemplates.some((t) => t.id !== id && t.name.trim().toLowerCase() === name.toLowerCase())) errors.name = "A template with this name already exists."
  if (!input.description?.trim()) errors.description = "Add a short description."
  if (!CATEGORIES.includes(input.category)) errors.category = "Choose a category."
  if (!TYPES.includes(input.type)) errors.type = "Choose a challenge type."
  if (!METRICS.includes(input.metric)) errors.metric = "Choose a metric."
  if (!Number.isFinite(input.target) || input.target <= 0) errors.target = "Target must be greater than 0."
  if (!Number.isInteger(input.durationDays) || input.durationDays < 1 || input.durationDays > 90) errors.durationDays = "Duration must be between 1 and 90 days."
  if (!Number.isInteger(input.points) || input.points < 0 || input.points > 5000) errors.points = "Points must be between 0 and 5,000."
  const rules = (input.rules ?? []).map((r) => r.trim()).filter(Boolean)
  if (rules.length === 0) errors.rules = "Add at least one rule."
  if (!input.coverEmoji?.trim()) errors.coverEmoji = "Pick a cover icon."
  if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
  return { ...input, name, description: input.description.trim(), rules }
}

export const templatesApi = {
  list: endpoint<TemplateQuery, TemplateList, "admin">("admin", "GET", "/platform/challenge-templates", (q, ctx) => {
    requireAdmin(ctx)
    const all = ctx.db.challengeTemplates
    const counts: TemplateList["counts"] = { all: all.length, published: 0, draft: 0, archived: 0 }
    all.forEach((t) => counts[t.status]++)
    const order: Record<TemplateStatus, number> = { published: 0, draft: 1, archived: 2 }
    const items = all
      .filter(
        (t) =>
          matchesSearch(q.search, t.name, t.description) &&
          (!q.category || q.category === "all" || t.category === q.category) &&
          (!q.type || q.type === "all" || t.type === q.type) &&
          (!q.status || q.status === "all" || t.status === q.status),
      )
      .sort((a, b) => order[a.status] - order[b.status] || b.usageCount - a.usageCount || a.name.localeCompare(b.name))
    return { items, counts }
  }),

  get: endpoint<{ id: string }, ChallengeTemplate, "admin">("admin", "GET", "/platform/challenge-templates/:id", ({ id }, ctx) => {
    requireAdmin(ctx)
    return findTemplate(ctx, id)
  }),

  create: endpoint<TemplateInput, ChallengeTemplate, "admin">("admin", "POST", "/platform/challenge-templates", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const v = validate(ctx, input)
    const t: ChallengeTemplate = { id: newId("tpl"), ...v, usageCount: 0, updatedAt: new Date().toISOString() }
    ctx.db.challengeTemplates.unshift(t)
    audit(ctx, { action: v.status === "published" ? "Published challenge template" : "Created challenge template (draft)", entityType: "Template", entityName: t.name })
    ctx.save()
    return t
  }),

  update: endpoint<TemplateInput & { id: string }, ChallengeTemplate, "admin">("admin", "PATCH", "/platform/challenge-templates/:id", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const t = findTemplate(ctx, input.id)
    const v = validate(ctx, input, t.id)
    const wasPublished = t.status === "published"
    Object.assign(t, v, { updatedAt: new Date().toISOString() })
    const action = v.status === "published" ? (wasPublished ? "Updated challenge template" : "Published challenge template") : wasPublished ? "Unpublished challenge template" : "Updated challenge template (draft)"
    audit(ctx, { action, entityType: "Template", entityName: t.name })
    ctx.save()
    return t
  }),

  setStatus: endpoint<{ id: string; status: TemplateStatus }, ChallengeTemplate, "admin">("admin", "PATCH", "/platform/challenge-templates/:id/status", ({ id, status }, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const t = findTemplate(ctx, id)
    if (!["published", "draft", "archived"].includes(status)) throw badRequest("Unknown status.")
    if (t.status === status) return t
    if (status === "published" && t.rules.length === 0) throw badRequest("Add at least one rule before publishing.")
    t.status = status
    t.updatedAt = new Date().toISOString()
    const action = status === "published" ? "Published challenge template" : status === "archived" ? "Retired challenge template" : "Unpublished challenge template"
    audit(ctx, { action, entityType: "Template", entityName: t.name, severity: status === "archived" ? "warning" : "info" })
    ctx.save()
    return t
  }),

  duplicate: endpoint<{ id: string }, ChallengeTemplate, "admin">("admin", "POST", "/platform/challenge-templates/:id/duplicate", ({ id }, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const src = findTemplate(ctx, id)
    const names = new Set(ctx.db.challengeTemplates.map((t) => t.name.trim().toLowerCase()))
    let name = `${src.name} (copy)`
    for (let i = 2; names.has(name.toLowerCase()); i++) name = `${src.name} (copy ${i})`
    const copy: ChallengeTemplate = { ...src, id: newId("tpl"), name, rules: [...src.rules], status: "draft", usageCount: 0, updatedAt: new Date().toISOString() }
    const idx = ctx.db.challengeTemplates.findIndex((t) => t.id === src.id)
    ctx.db.challengeTemplates.splice(idx + 1, 0, copy)
    audit(ctx, { action: "Duplicated challenge template", entityType: "Template", entityName: `${src.name} → ${name}` })
    ctx.save()
    return copy
  }),
}
