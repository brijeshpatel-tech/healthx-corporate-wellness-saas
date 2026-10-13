/**
 * Platform Admin — Wellness Score component weights (SCR-P-022).
 * Each save creates a new version in db.scoreConfigs (the Employee App uses the highest version).
 * Effective date and missing-component handling per version live in extra "admin-score-meta".
 */
import type { WellnessScoreConfig, WellnessScoreWeights } from "@/lib/types"
import { audit, badRequest, endpoint } from "../core"
import { requireAdmin, today, type AdminCtx } from "./common"

export type MissingHandling = "redistribute" | "zero"

export interface ScoreVersion extends WellnessScoreConfig {
  effectiveFrom: string
  missingHandling: MissingHandling
  current: boolean
}

export interface ScoreWeightsData {
  current: ScoreVersion
  versions: ScoreVersion[]
  defaults: WellnessScoreWeights
}

export interface SaveWeightsInput {
  weights: WellnessScoreWeights
  effectiveFrom: string
  missingHandling: MissingHandling
  note: string
}

export const SCORE_COMPONENTS = ["activity", "sleep", "hydration", "exercise", "habits", "mindfulness"] as const satisfies readonly (keyof WellnessScoreWeights)[]

export const DEFAULT_WEIGHTS: WellnessScoreWeights = { activity: 25, sleep: 20, hydration: 15, exercise: 20, habits: 10, mindfulness: 10 }

type Meta = Record<string, { effectiveFrom: string; missingHandling: MissingHandling }>

const meta = (ctx: AdminCtx) =>
  ctx.extra<Meta>("admin-score-meta", () =>
    Object.fromEntries(ctx.db.scoreConfigs.map((c) => [String(c.version), { effectiveFrom: c.updatedAt.slice(0, 10), missingHandling: "redistribute" as const }])),
  )

const total = (w: WellnessScoreWeights) => SCORE_COMPONENTS.reduce((a, k) => a + (w[k] ?? 0), 0)

function versions(ctx: AdminCtx): ScoreVersion[] {
  const m = meta(ctx)
  const sorted = [...ctx.db.scoreConfigs].sort((a, b) => b.version - a.version)
  const latest = sorted[0]?.version
  return sorted.map((c) => ({
    ...c,
    effectiveFrom: m[String(c.version)]?.effectiveFrom ?? c.updatedAt.slice(0, 10),
    missingHandling: m[String(c.version)]?.missingHandling ?? "redistribute",
    current: c.version === latest,
  }))
}

export const scoreApi = {
  get: endpoint<void, ScoreWeightsData, "admin">("admin", "GET", "/platform/wellness-score/weights", (_i, ctx) => {
    requireAdmin(ctx)
    const list = versions(ctx)
    const current = list[0] ?? { version: 0, weights: DEFAULT_WEIGHTS, updatedAt: new Date().toISOString(), updatedBy: "HealthX", effectiveFrom: today(), missingHandling: "redistribute" as const, current: true }
    return { current, versions: list, defaults: DEFAULT_WEIGHTS }
  }),

  save: endpoint<SaveWeightsInput, ScoreVersion, "admin">("admin", "PUT", "/platform/wellness-score/weights", (input, ctx) => {
    const admin = requireAdmin(ctx, "score.manage")
    const errors: Record<string, string> = {}
    for (const k of SCORE_COMPONENTS) {
      const v = input.weights?.[k]
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 100) errors[`weights.${k}`] = "Use a whole number from 0 to 100."
    }
    const sum = total(input.weights)
    if (Object.keys(errors).length === 0 && sum !== 100) errors.weights = `Weights must add up to 100% (currently ${sum}%).`
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom ?? "")) errors.effectiveFrom = "Choose the date the new weights apply from."
    else if (input.effectiveFrom < today()) errors.effectiveFrom = "Effective date can't be in the past."
    if (!["redistribute", "zero"].includes(input.missingHandling)) errors.missingHandling = "Choose how missing data is handled."
    const note = input.note?.trim() ?? ""
    if (note.length < 5) errors.note = "Add a short note explaining the change (at least 5 characters)."
    else if (note.length > 300) errors.note = "Keep the note under 300 characters."
    if (Object.keys(errors).length) throw badRequest(errors.weights ?? "Please fix the highlighted fields.", errors)

    const [latest] = versions(ctx)
    if (latest && SCORE_COMPONENTS.every((k) => latest.weights[k] === input.weights[k]) && latest.missingHandling === input.missingHandling) {
      throw badRequest("Nothing changed — these are already the current weights.")
    }
    const version = (latest?.version ?? 0) + 1
    const config: WellnessScoreConfig = {
      version,
      weights: Object.fromEntries(SCORE_COMPONENTS.map((k) => [k, input.weights[k]])) as unknown as WellnessScoreWeights,
      updatedAt: new Date().toISOString(),
      updatedBy: admin.user.name,
      note,
    }
    ctx.db.scoreConfigs.push(config)
    meta(ctx)[String(version)] = { effectiveFrom: input.effectiveFrom, missingHandling: input.missingHandling }
    const w = config.weights
    audit(ctx, {
      action: `Saved wellness score weights v${version} (A${w.activity}/S${w.sleep}/H${w.hydration}/E${w.exercise}/Hb${w.habits}/M${w.mindfulness}) from ${input.effectiveFrom}`,
      entityType: "Wellness score",
      entityName: `Weights v${version}`,
      severity: "warning",
    })
    ctx.save()
    return { ...config, effectiveFrom: input.effectiveFrom, missingHandling: input.missingHandling, current: true }
  }),
}
