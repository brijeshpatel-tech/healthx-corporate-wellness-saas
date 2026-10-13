/** Platform Admin — habit library (SCR-P-019). Only active habits can be picked by employees in the app. */
import type { HabitDefinition } from "@/lib/types"
import { audit, badRequest, endpoint, matchesSearch, newId, notFound } from "../core"
import { requireAdmin, type AdminCtx } from "./common"

export type HabitAutoComplete = NonNullable<HabitDefinition["autoCompleteFrom"]> | "none"

/** Optional min / max daily target employees may choose (kept beside the habit definition). */
interface TargetRange {
  minTarget?: number
  maxTarget?: number
}

export interface HabitRow extends HabitDefinition, TargetRange {}

export interface HabitQuery {
  search?: string
  category?: HabitDefinition["category"] | "all"
  status?: HabitDefinition["status"] | "all"
  autoComplete?: HabitAutoComplete | "all"
}

export interface HabitList {
  items: HabitRow[]
  total: number
  counts: { all: number; active: number; draft: number; archived: number }
}

export interface HabitInput {
  name: string
  description: string
  icon: string
  category: HabitDefinition["category"]
  unit: HabitDefinition["unit"]
  defaultTarget: number
  minTarget?: number | null
  maxTarget?: number | null
  points: number
  autoCompleteFrom: HabitAutoComplete
  status: HabitDefinition["status"]
}

export type HabitPatch = { id: string } & Partial<HabitInput>

const ranges = (ctx: AdminCtx) => ctx.extra<Record<string, TargetRange>>("admin-habit-target-ranges", () => ({}))

const toRow = (ctx: AdminCtx, h: HabitDefinition): HabitRow => ({ ...h, ...ranges(ctx)[h.id] })

function validate(ctx: AdminCtx, v: HabitInput, id?: string) {
  const errors: Record<string, string> = {}
  const name = v.name?.trim() ?? ""
  if (!name) errors.name = "Enter a habit name"
  else if (name.length > 50) errors.name = "Keep the name under 50 characters"
  else if (ctx.db.habits.some((h) => h.id !== id && h.name.trim().toLowerCase() === name.toLowerCase())) errors.name = "A habit with this name already exists"
  if ((v.description ?? "").length > 160) errors.description = "Keep the description under 160 characters"
  if (!v.icon?.trim()) errors.icon = "Choose an icon"
  if (typeof v.defaultTarget !== "number" || !(v.defaultTarget > 0)) errors.defaultTarget = "Default target must be more than 0"
  else if (v.unit === "check" && v.defaultTarget !== 1) errors.defaultTarget = "Yes / no habits have a target of 1"
  if (!Number.isInteger(v.points) || v.points < 0 || v.points > 100) errors.points = "Enter 0–100 points"
  const min = v.minTarget ?? undefined
  const max = v.maxTarget ?? undefined
  if (min !== undefined && !(min > 0)) errors.minTarget = "Must be more than 0"
  if (max !== undefined && !(max > 0)) errors.maxTarget = "Must be more than 0"
  if (!errors.defaultTarget && min !== undefined && min > v.defaultTarget) errors.minTarget = "Can't be above the default target"
  if (!errors.defaultTarget && max !== undefined && max < v.defaultTarget) errors.maxTarget = "Can't be below the default target"
  if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
  return { name, min: v.unit === "check" ? undefined : min, max: v.unit === "check" ? undefined : max }
}

const fromRow = (h: HabitRow): HabitInput => ({
  name: h.name,
  description: h.description,
  icon: h.icon,
  category: h.category,
  unit: h.unit,
  defaultTarget: h.defaultTarget,
  minTarget: h.minTarget,
  maxTarget: h.maxTarget,
  points: h.points,
  autoCompleteFrom: h.autoCompleteFrom ?? "none",
  status: h.status,
})

export const habitsApi = {
  list: endpoint<HabitQuery, HabitList, "admin">("admin", "GET", "/platform/habits", (q, ctx) => {
    requireAdmin(ctx)
    const all = ctx.db.habits
    const items = all
      .filter(
        (h) =>
          matchesSearch(q.search, h.name, h.description) &&
          (!q.category || q.category === "all" || h.category === q.category) &&
          (!q.status || q.status === "all" || h.status === q.status) &&
          (!q.autoComplete || q.autoComplete === "all" || (h.autoCompleteFrom ?? "none") === q.autoComplete),
      )
      .map((h) => toRow(ctx, h))
    return {
      items,
      total: items.length,
      counts: {
        all: all.length,
        active: all.filter((h) => h.status === "active").length,
        draft: all.filter((h) => h.status === "draft").length,
        archived: all.filter((h) => h.status === "archived").length,
      },
    }
  }),

  create: endpoint<HabitInput, HabitRow, "admin">("admin", "POST", "/platform/habits", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const { name, min, max } = validate(ctx, input)
    const habit: HabitDefinition = {
      id: newId("hab"),
      name,
      description: input.description.trim(),
      icon: input.icon.trim(),
      category: input.category,
      unit: input.unit,
      defaultTarget: input.defaultTarget,
      points: input.points,
      status: input.status,
      usersCount: 0,
      autoCompleteFrom: input.autoCompleteFrom === "none" ? undefined : input.autoCompleteFrom,
    }
    ctx.db.habits.push(habit)
    ranges(ctx)[habit.id] = { minTarget: min, maxTarget: max }
    audit(ctx, { action: "Created habit", entityType: "Habit", entityName: habit.name })
    ctx.save()
    return toRow(ctx, habit)
  }),

  /** PATCH — full edit or a status change (deactivate = archived, reactivate = active). */
  update: endpoint<HabitPatch, HabitRow, "admin">("admin", "PATCH", "/platform/habits/:id", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const { id, ...patch } = input
    const habit = ctx.db.habits.find((h) => h.id === id)
    if (!habit) throw notFound("Habit")
    const merged: HabitInput = { ...fromRow(toRow(ctx, habit)), ...patch }
    const { name, min, max } = validate(ctx, merged, habit.id)
    const previous = habit.status
    Object.assign(habit, {
      name,
      description: merged.description.trim(),
      icon: merged.icon.trim(),
      category: merged.category,
      unit: merged.unit,
      defaultTarget: merged.defaultTarget,
      points: merged.points,
      status: merged.status,
      autoCompleteFrom: merged.autoCompleteFrom === "none" ? undefined : merged.autoCompleteFrom,
    })
    ranges(ctx)[habit.id] = { minTarget: min, maxTarget: max }
    const action =
      previous === habit.status ? "Updated habit" : habit.status === "archived" ? "Deactivated habit" : habit.status === "active" ? "Activated habit" : "Moved habit to draft"
    audit(ctx, { action, entityType: "Habit", entityName: habit.name, severity: habit.status === "archived" && previous !== "archived" ? "warning" : "info" })
    ctx.save()
    return toRow(ctx, habit)
  }),
}
