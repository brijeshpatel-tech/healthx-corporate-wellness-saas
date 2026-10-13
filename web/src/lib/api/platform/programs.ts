/** Platform Admin — wellness program templates (SCR-P-032, Phase 2). Companies copy active templates into their own programs. */
import type { ChallengeMetric, ProgramWeek, WellnessProgram } from "@/lib/types"
import { audit, badRequest, endpoint, matchesSearch, newId, notFound } from "../core"
import { requireAdmin, type AdminCtx } from "./common"

export type TemplateStatus = "draft" | "active" | "archived"
export type GoalMetric = ChallengeMetric | "habit"

export interface ProgramTemplateRow {
  id: string
  name: string
  description: string
  coverEmoji: string
  coverColor: string
  durationWeeks: number
  weeks: ProgramWeek[]
  goalsCount: number
  status: TemplateStatus
  /** Distinct companies running a program copied from this template. */
  companiesUsing: number
  enrolledCount: number
  /** Average completion across enrolled employees (0–1). */
  avgCompletion: number
}

export interface ProgramTemplateQuery {
  search?: string
  status?: TemplateStatus | "all"
}

export interface ProgramTemplateList {
  items: ProgramTemplateRow[]
  total: number
  counts: { all: number; active: number; draft: number; archived: number }
}

export interface ProgramGoalInput {
  id?: string
  label: string
  metric: GoalMetric
  target: number
}

export interface ProgramWeekInput {
  title: string
  goals: ProgramGoalInput[]
}

export interface ProgramTemplateInput {
  name: string
  description: string
  coverEmoji: string
  coverColor: string
  weeks: ProgramWeekInput[]
  status: TemplateStatus
}

export type ProgramTemplatePatch = { id: string } & Partial<ProgramTemplateInput>

const templates = (ctx: AdminCtx) => ctx.db.programs.filter((p) => p.companyId === null && p.isTemplate)

const asStatus = (s: WellnessProgram["status"]): TemplateStatus => (s === "active" || s === "archived" ? s : s === "draft" ? "draft" : "active")

function toRow(ctx: AdminCtx, p: WellnessProgram): ProgramTemplateRow {
  const copies = ctx.db.programs.filter((c) => c.companyId !== null && c.name.trim().toLowerCase() === p.name.trim().toLowerCase())
  const enrolled = p.enrolledCount + copies.reduce((a, c) => a + c.enrolledCount, 0)
  const weighted = p.enrolledCount * p.completionRate + copies.reduce((a, c) => a + c.enrolledCount * c.completionRate, 0)
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    coverEmoji: p.coverEmoji,
    coverColor: p.coverColor,
    durationWeeks: p.weeks.length || p.durationWeeks,
    weeks: p.weeks,
    goalsCount: p.weeks.reduce((a, w) => a + w.goals.length, 0),
    status: asStatus(p.status),
    companiesUsing: new Set(copies.map((c) => c.companyId)).size,
    enrolledCount: enrolled,
    avgCompletion: enrolled > 0 ? weighted / enrolled : 0,
  }
}

function findTemplate(ctx: AdminCtx, id: string) {
  const p = ctx.db.programs.find((x) => x.id === id && x.companyId === null && x.isTemplate)
  if (!p) throw notFound("Program template")
  return p
}

const METRICS: GoalMetric[] = ["steps", "distance", "calories", "active_minutes", "workouts", "water", "meditation", "custom", "habit"]

function validate(ctx: AdminCtx, v: ProgramTemplateInput, id?: string): ProgramWeek[] {
  const errors: Record<string, string> = {}
  const name = v.name?.trim() ?? ""
  if (!name) errors.name = "Enter a template name"
  else if (name.length > 80) errors.name = "Keep the name under 80 characters"
  else if (templates(ctx).some((p) => p.id !== id && p.name.trim().toLowerCase() === name.toLowerCase())) errors.name = "A template with this name already exists"
  if ((v.description ?? "").length > 400) errors.description = "Keep the description under 400 characters"
  if ((v.weeks ?? []).length > 12) errors.weeks = "Templates can have up to 12 weeks"
  const weeks: ProgramWeek[] = (v.weeks ?? []).map((w, wi) => {
    if (!w.title?.trim()) errors[`weeks.${wi}.title`] = "Give this week a title"
    return {
      week: wi + 1,
      title: w.title?.trim() ?? "",
      goals: (w.goals ?? []).map((g, gi) => {
        if (!g.label?.trim()) errors[`weeks.${wi}.goals.${gi}.label`] = "Describe the goal"
        if (!METRICS.includes(g.metric)) errors[`weeks.${wi}.goals.${gi}.metric`] = "Choose a metric"
        if (typeof g.target !== "number" || !(g.target > 0)) errors[`weeks.${wi}.goals.${gi}.target`] = "Target must be more than 0"
        return { id: g.id || newId("g"), label: g.label?.trim() ?? "", metric: g.metric, target: g.target }
      }),
    }
  })
  if (!weeks.some((w) => w.goals.length > 0)) errors.weeks = "At least 1 week with 1 goal"
  weeks.forEach((w, wi) => {
    if (w.goals.length === 0 && weeks.length > 0 && !errors.weeks) errors[`weeks.${wi}.goals`] = "Add a goal or remove this week"
  })
  if (Object.keys(errors).length) throw badRequest(errors.weeks === "At least 1 week with 1 goal" ? "At least 1 week with 1 goal." : "Please fix the highlighted fields.", errors)
  return weeks
}

const ACTION: Record<TemplateStatus, string> = { active: "Published program template", draft: "Moved program template to draft", archived: "Retired program template" }

export const programTemplatesApi = {
  list: endpoint<ProgramTemplateQuery, ProgramTemplateList, "admin">("admin", "GET", "/platform/program-templates", (q, ctx) => {
    requireAdmin(ctx)
    const all = templates(ctx).map((p) => toRow(ctx, p))
    const items = all.filter((p) => matchesSearch(q.search, p.name, p.description) && (!q.status || q.status === "all" || p.status === q.status))
    return {
      items,
      total: items.length,
      counts: {
        all: all.length,
        active: all.filter((p) => p.status === "active").length,
        draft: all.filter((p) => p.status === "draft").length,
        archived: all.filter((p) => p.status === "archived").length,
      },
    }
  }),

  get: endpoint<{ id: string }, ProgramTemplateRow, "admin">("admin", "GET", "/platform/program-templates/:id", (input, ctx) => {
    requireAdmin(ctx)
    return toRow(ctx, findTemplate(ctx, input.id))
  }),

  create: endpoint<ProgramTemplateInput, ProgramTemplateRow, "admin">("admin", "POST", "/platform/program-templates", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const weeks = validate(ctx, input)
    const program: WellnessProgram = {
      id: newId("prg"),
      companyId: null,
      name: input.name.trim(),
      description: input.description.trim(),
      coverEmoji: input.coverEmoji,
      coverColor: input.coverColor,
      durationWeeks: weeks.length,
      weeks,
      status: input.status === "active" ? "active" : "draft",
      audienceType: "all",
      audienceIds: [],
      enrolledCount: 0,
      completionRate: 0,
      isTemplate: true,
    }
    ctx.db.programs.push(program)
    audit(ctx, { action: program.status === "active" ? "Created and published program template" : "Created program template draft", entityType: "Program template", entityName: program.name })
    ctx.save()
    return toRow(ctx, program)
  }),

  /** PATCH — full edit or a status change (publish = active, retire = archived). */
  update: endpoint<ProgramTemplatePatch, ProgramTemplateRow, "admin">("admin", "PATCH", "/platform/program-templates/:id", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const { id, ...patch } = input
    const program = findTemplate(ctx, id)
    const merged: ProgramTemplateInput = {
      name: program.name,
      description: program.description,
      coverEmoji: program.coverEmoji,
      coverColor: program.coverColor,
      weeks: program.weeks,
      status: asStatus(program.status),
      ...patch,
    }
    const weeks = validate(ctx, merged, program.id)
    const previous = asStatus(program.status)
    Object.assign(program, {
      name: merged.name.trim(),
      description: merged.description.trim(),
      coverEmoji: merged.coverEmoji,
      coverColor: merged.coverColor,
      weeks,
      durationWeeks: weeks.length,
      status: merged.status,
    })
    audit(ctx, {
      action: previous === merged.status ? "Updated program template" : ACTION[merged.status],
      entityType: "Program template",
      entityName: program.name,
      severity: merged.status === "archived" && previous !== "archived" ? "warning" : "info",
    })
    ctx.save()
    return toRow(ctx, program)
  }),

  duplicate: endpoint<{ id: string }, ProgramTemplateRow, "admin">("admin", "POST", "/platform/program-templates/:id/duplicate", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const source = findTemplate(ctx, input.id)
    let name = `${source.name} (copy)`
    for (let n = 2; templates(ctx).some((p) => p.name === name); n++) name = `${source.name} (copy ${n})`
    const copy: WellnessProgram = {
      ...structuredClone(source),
      id: newId("prg"),
      name,
      status: "draft",
      enrolledCount: 0,
      completionRate: 0,
      weeks: source.weeks.map((w) => ({ ...w, goals: w.goals.map((g) => ({ ...g, id: newId("g") })) })),
    }
    ctx.db.programs.push(copy)
    audit(ctx, { action: "Duplicated program template", entityType: "Program template", entityName: copy.name })
    ctx.save()
    return toRow(ctx, copy)
  }),
}
