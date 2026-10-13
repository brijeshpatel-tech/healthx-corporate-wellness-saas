/**
 * Business Portal — company-created workouts (#372, Phase 2).
 *
 * Company Owners and Wellness Managers build their own workouts from the HealthX exercise library
 * instead of relying only on HealthX. Workouts are stored in `db.workouts` with `companyId` set to the
 * company, so published ones appear in the Employee App next to the HealthX library. The HealthX library
 * (companyId = null) is read-only here and can be copied as a starting point.
 */
import type { Exercise, FitnessLevel, Workout, WorkoutExercise } from "@/lib/types"
import { audit, badRequest, endpoint, matchesSearch, newId, notFound } from "../core"
import { requireRole, type BusinessCtx } from "./common"

const WORKOUT_ROLES: Parameters<typeof requireRole>[1] = ["company_owner", "wellness_manager"]

// Same lists as the HealthX library (Platform Admin), so company workouts filter alongside it in the app.
export const WORKOUT_CATEGORIES = ["Full Body", "Strength", "Cardio / HIIT", "Core", "Yoga", "Mindfulness", "Desk & Office", "Mobility & Stretching"] as const
export const WORKOUT_EQUIPMENT = ["mat", "dumbbells", "chair", "resistance band", "kettlebell", "bench", "pull-up bar", "skipping rope"] as const
export const WORKOUT_MUSCLE_GROUPS = ["full body", "legs", "glutes", "core", "chest", "back", "arms", "shoulders", "neck", "mind"] as const
export const WORKOUT_LEVELS: FitnessLevel[] = ["beginner", "intermediate", "advanced"]
export const WORKOUT_LOCATIONS: Workout["location"][] = ["home", "gym", "outdoor", "office"]

export const WORKOUT_LIMITS = {
  nameMin: 3,
  nameMax: 80,
  descriptionMax: 500,
  maxExercises: 30,
  durationMin: 5,
  durationMax: 900,
  repsMax: 200,
  restMax: 300,
  caloriesMax: 2000,
  pointsMax: 500,
} as const

/** Seconds per rep used to estimate the length of rep-based steps (the app's player times them). */
export const SECONDS_PER_REP = 3

/** Work seconds of one step. */
export const stepWorkSec = (s: Pick<WorkoutExercise, "durationSec" | "reps">) => (s.reps ? s.reps * SECONDS_PER_REP : (s.durationSec ?? 0))

/** Total seconds: every step's work + rest between steps (rest after the last step isn't counted, as in the app). */
export function workoutTotalSec(steps: Pick<WorkoutExercise, "durationSec" | "reps" | "restSec">[]) {
  return steps.reduce((total, s, i) => total + stepWorkSec(s) + (i < steps.length - 1 ? s.restSec || 0 : 0), 0)
}

export const workoutDurationMin = (steps: Pick<WorkoutExercise, "durationSec" | "reps" | "restSec">[]) => Math.max(1, Math.ceil(workoutTotalSec(steps) / 60))

// ─── Types ──────────────────────────────────────────────────────────────

export type WorkoutSource = "company" | "healthx"
export type WorkoutScope = "company" | "library"

export interface WorkoutRow {
  id: string
  name: string
  description: string
  category: string
  level: FitnessLevel
  location: Workout["location"]
  equipment: string[]
  muscleGroups: string[]
  durationMin: number
  calories: number
  points: number
  coverEmoji: string
  coverColor: string
  exercisesCount: number
  completions: number
  status: Workout["status"]
  updatedAt: string
  source: WorkoutSource
}

export interface WorkoutQuery {
  scope: WorkoutScope
  /** Company scope only. */
  status?: Workout["status"] | "all"
  category?: string
  level?: FitnessLevel | "all"
  location?: Workout["location"] | "all"
  search?: string
}

export interface WorkoutList {
  items: WorkoutRow[]
  counts: { company: number; library: number; published: number; draft: number; archived: number }
  categories: string[]
}

export type ExerciseOption = Pick<Exercise, "id" | "name" | "mediaEmoji" | "level" | "muscleGroups" | "equipment" | "defaultDurationSec" | "defaultReps" | "instructions" | "status">

export interface WorkoutDetail {
  workout: Workout
  source: WorkoutSource
  /** Exercises used by the workout (also ones HealthX has since unpublished). */
  exercises: ExerciseOption[]
  canEdit: boolean
}

export interface WorkoutStepInput {
  exerciseId: string
  durationSec?: number
  reps?: number
  restSec: number
}

export interface WorkoutInput {
  name: string
  description: string
  category: string
  level: FitnessLevel
  location: Workout["location"]
  equipment: string[]
  muscleGroups: string[]
  calories: number
  points: number
  coverEmoji: string
  coverColor: string
  exercises: WorkoutStepInput[]
  /** Publish now (otherwise saved as a draft; published workouts stay published). */
  publish?: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────

const toRow = (w: Workout): WorkoutRow => ({
  id: w.id,
  name: w.name,
  description: w.description,
  category: w.category,
  level: w.level,
  location: w.location,
  equipment: w.equipment,
  muscleGroups: w.muscleGroups,
  durationMin: w.durationMin,
  calories: w.calories,
  points: w.points,
  coverEmoji: w.coverEmoji,
  coverColor: w.coverColor,
  exercisesCount: w.exercises.length,
  completions: w.completions,
  status: w.status,
  updatedAt: w.updatedAt,
  source: w.companyId === null ? "healthx" : "company",
})

const toExerciseOption = (e: Exercise): ExerciseOption => ({
  id: e.id,
  name: e.name,
  mediaEmoji: e.mediaEmoji,
  level: e.level,
  muscleGroups: e.muscleGroups,
  equipment: e.equipment,
  defaultDurationSec: e.defaultDurationSec,
  defaultReps: e.defaultReps,
  instructions: e.instructions,
  status: e.status,
})

const companyWorkouts = (ctx: BusinessCtx) => ctx.db.workouts.filter((w) => w.companyId === ctx.companyId())
const libraryWorkouts = (ctx: BusinessCtx) => ctx.db.workouts.filter((w) => w.companyId === null && w.status === "published")

function findCompanyWorkout(ctx: BusinessCtx, id: string) {
  const w = companyWorkouts(ctx).find((x) => x.id === id)
  if (!w) throw notFound("Workout")
  return w
}

const cleanTags = (values: string[] | undefined, allowed: readonly string[]) => [...new Set((values ?? []).map((t) => t.trim().toLowerCase()).filter((t) => allowed.includes(t)))]

function uniqueName(ctx: BusinessCtx, base: string, ignoreId?: string) {
  const taken = (n: string) => companyWorkouts(ctx).some((w) => w.id !== ignoreId && w.name.toLowerCase() === n.toLowerCase())
  if (!taken(base)) return base
  for (let n = 1; ; n++) {
    const candidate = `${base.slice(0, WORKOUT_LIMITS.nameMax - 10)} (copy${n > 1 ? ` ${n}` : ""})`
    if (!taken(candidate)) return candidate
  }
}

/** Validates a full workout and returns the cleaned steps. Field errors use the form's paths. */
function validate(ctx: BusinessCtx, w: WorkoutInput, publishing: boolean, ignoreId?: string): WorkoutExercise[] {
  const errors: Record<string, string> = {}
  const name = w.name?.trim() ?? ""
  if (name.length < WORKOUT_LIMITS.nameMin) errors.name = name ? `Use at least ${WORKOUT_LIMITS.nameMin} characters` : "Enter a workout name"
  else if (name.length > WORKOUT_LIMITS.nameMax) errors.name = `Keep the name under ${WORKOUT_LIMITS.nameMax} characters`
  else if (companyWorkouts(ctx).some((x) => x.id !== ignoreId && x.name.trim().toLowerCase() === name.toLowerCase())) errors.name = "You already have a workout with this name"
  if ((w.description ?? "").length > WORKOUT_LIMITS.descriptionMax) errors.description = `Keep the description under ${WORKOUT_LIMITS.descriptionMax} characters`
  if (!(WORKOUT_CATEGORIES as readonly string[]).includes(w.category)) errors.category = "Choose a category"
  if (!WORKOUT_LEVELS.includes(w.level)) errors.level = "Choose a level"
  if (!WORKOUT_LOCATIONS.includes(w.location)) errors.location = "Choose where it's done"
  if (!Number.isInteger(w.calories) || w.calories < 0 || w.calories > WORKOUT_LIMITS.caloriesMax) errors.calories = `Enter 0–${WORKOUT_LIMITS.caloriesMax.toLocaleString("en-IN")} kcal`
  if (!Number.isInteger(w.points) || w.points < 0 || w.points > WORKOUT_LIMITS.pointsMax) errors.points = `Enter 0–${WORKOUT_LIMITS.pointsMax} points`
  if (!w.coverEmoji?.trim()) errors.coverEmoji = "Choose a cover emoji"

  const steps: WorkoutExercise[] = []
  const list = w.exercises ?? []
  if (list.length === 0) errors.exercises = "Add at least one exercise"
  else if (list.length > WORKOUT_LIMITS.maxExercises) errors.exercises = `Up to ${WORKOUT_LIMITS.maxExercises} exercises`
  list.forEach((s, i) => {
    const exercise = ctx.db.exercises.find((e) => e.id === s.exerciseId)
    if (!exercise) {
      errors[`exercises.${i}.exerciseId`] = "This exercise is no longer available"
      return
    }
    if (publishing && exercise.status !== "published") errors[`exercises.${i}.exerciseId`] = `“${exercise.name}” is no longer published by HealthX — replace it to publish`
    const reps = s.reps !== undefined && s.reps !== null && Number(s.reps) > 0 ? Math.round(Number(s.reps)) : undefined
    const durationSec = reps ? reps * SECONDS_PER_REP : Math.round(Number(s.durationSec ?? 0))
    if (reps !== undefined && reps > WORKOUT_LIMITS.repsMax) errors[`exercises.${i}.reps`] = `Enter 1–${WORKOUT_LIMITS.repsMax} reps`
    if (!reps && (!(durationSec > 0) || durationSec < WORKOUT_LIMITS.durationMin || durationSec > WORKOUT_LIMITS.durationMax))
      errors[`exercises.${i}.durationSec`] = `Enter ${WORKOUT_LIMITS.durationMin}–${WORKOUT_LIMITS.durationMax} seconds`
    const restSec = Math.round(Number(s.restSec ?? 0))
    if (!Number.isFinite(restSec) || restSec < 0 || restSec > WORKOUT_LIMITS.restMax) errors[`exercises.${i}.restSec`] = `Rest must be 0–${WORKOUT_LIMITS.restMax} seconds`
    steps.push({ exerciseId: exercise.id, durationSec, reps, restSec })
  })

  const messages = Object.values(errors)
  if (messages.length) throw badRequest(errors.exercises && messages.length === 1 ? `${errors.exercises}.` : messages.length === 1 ? `${messages[0]}.` : "Please fix the highlighted fields.", errors)
  return steps
}

function applyInput(w: Workout, input: WorkoutInput, steps: WorkoutExercise[]) {
  w.name = input.name.trim()
  w.description = (input.description ?? "").trim()
  w.category = input.category
  w.level = input.level
  w.location = input.location
  w.equipment = cleanTags(input.equipment, WORKOUT_EQUIPMENT)
  w.muscleGroups = cleanTags(input.muscleGroups, WORKOUT_MUSCLE_GROUPS)
  w.calories = input.calories
  w.points = input.points
  w.coverEmoji = input.coverEmoji.trim()
  w.coverColor = input.coverColor
  w.exercises = steps
  w.durationMin = workoutDurationMin(steps)
  w.updatedAt = new Date().toISOString()
}

function detail(ctx: BusinessCtx, w: Workout): WorkoutDetail {
  const ids = new Set(w.exercises.map((s) => s.exerciseId))
  return {
    workout: w,
    source: w.companyId === null ? "healthx" : "company",
    exercises: ctx.db.exercises.filter((e) => ids.has(e.id)).map(toExerciseOption),
    canEdit: w.companyId !== null && w.status !== "archived",
  }
}

function setStatus(ctx: BusinessCtx, id: string, from: Workout["status"][], to: Workout["status"], action: string) {
  requireRole(ctx, WORKOUT_ROLES)
  const w = findCompanyWorkout(ctx, id)
  if (!from.includes(w.status)) throw badRequest(`This workout is ${w.status}.`)
  if (to === "published") validate(ctx, { ...w, publish: true }, true, w.id)
  w.status = to
  w.updatedAt = new Date().toISOString()
  audit(ctx, { action, entityType: "Workout", entityName: w.name, companyId: ctx.companyId() })
  ctx.save()
  return w
}

// ─── Endpoints ──────────────────────────────────────────────────────────

export const workoutsApi = {
  list: endpoint<WorkoutQuery, WorkoutList, "business">("business", "GET", "/organization/workouts", (q, ctx) => {
    requireRole(ctx, WORKOUT_ROLES)
    const company = companyWorkouts(ctx)
    const library = libraryWorkouts(ctx)
    const source = q.scope === "library" ? library : company
    const items = source
      .filter(
        (w) =>
          matchesSearch(q.search, w.name, w.description, w.category, ...w.muscleGroups, ...w.equipment) &&
          (q.scope === "library" || !q.status || q.status === "all" || w.status === q.status) &&
          (!q.category || q.category === "all" || w.category === q.category) &&
          (!q.level || q.level === "all" || w.level === q.level) &&
          (!q.location || q.location === "all" || w.location === q.location),
      )
      .sort((a, b) => (q.scope === "library" ? a.name.localeCompare(b.name) : b.updatedAt.localeCompare(a.updatedAt)))
      .map(toRow)
    return {
      items,
      counts: {
        company: company.length,
        library: library.length,
        published: company.filter((w) => w.status === "published").length,
        draft: company.filter((w) => w.status === "draft").length,
        archived: company.filter((w) => w.status === "archived").length,
      },
      categories: [...new Set([...WORKOUT_CATEGORIES, ...source.map((w) => w.category)])].sort(),
    }
  }),

  /** A company workout (any status) or a published HealthX library workout. */
  get: endpoint<{ id: string }, WorkoutDetail, "business">("business", "GET", "/organization/workouts/:id", ({ id }, ctx) => {
    requireRole(ctx, WORKOUT_ROLES)
    const w = companyWorkouts(ctx).find((x) => x.id === id) ?? libraryWorkouts(ctx).find((x) => x.id === id)
    if (!w) throw notFound("Workout")
    return detail(ctx, w)
  }),

  /** Published HealthX exercises — the building blocks for company workouts. */
  exercises: endpoint<void, ExerciseOption[], "business">("business", "GET", "/exercises", (_i, ctx) => {
    requireRole(ctx, WORKOUT_ROLES)
    return ctx.db.exercises
      .filter((e) => e.status === "published")
      .map(toExerciseOption)
      .sort((a, b) => a.name.localeCompare(b.name))
  }),

  create: endpoint<WorkoutInput, Workout, "business">("business", "POST", "/organization/workouts", (input, ctx) => {
    requireRole(ctx, WORKOUT_ROLES)
    const publish = !!input.publish
    const steps = validate(ctx, input, publish)
    const w: Workout = {
      id: newId("wo"),
      companyId: ctx.companyId(),
      name: "",
      description: "",
      category: input.category,
      level: input.level,
      location: input.location,
      equipment: [],
      muscleGroups: [],
      durationMin: 1,
      calories: 0,
      points: 0,
      coverEmoji: "",
      coverColor: "",
      exercises: [],
      status: publish ? "published" : "draft",
      completions: 0,
      updatedAt: new Date().toISOString(),
    }
    applyInput(w, input, steps)
    ctx.db.workouts.push(w)
    audit(ctx, { action: publish ? "Created and published company workout" : "Created company workout draft", entityType: "Workout", entityName: w.name, companyId: ctx.companyId() })
    ctx.save()
    return w
  }),

  update: endpoint<WorkoutInput & { id: string }, Workout, "business">("business", "PUT", "/organization/workouts/:id", (input, ctx) => {
    requireRole(ctx, WORKOUT_ROLES)
    const w = findCompanyWorkout(ctx, input.id)
    if (w.status === "archived") throw badRequest("Restore this workout before editing it.")
    const publishing = w.status === "published" || !!input.publish
    const steps = validate(ctx, input, publishing, w.id)
    const wasDraft = w.status === "draft"
    applyInput(w, input, steps)
    if (input.publish) w.status = "published"
    audit(ctx, {
      action: wasDraft && input.publish ? "Published company workout" : "Edited company workout",
      entityType: "Workout",
      entityName: w.name,
      companyId: ctx.companyId(),
    })
    ctx.save()
    return w
  }),

  publish: endpoint<{ id: string }, Workout, "business">("business", "POST", "/organization/workouts/:id/publish", ({ id }, ctx) =>
    setStatus(ctx, id, ["draft"], "published", "Published company workout"),
  ),

  /** Back to draft — employees stop seeing it; their history is kept. */
  unpublish: endpoint<{ id: string }, Workout, "business">("business", "POST", "/organization/workouts/:id/unpublish", ({ id }, ctx) =>
    setStatus(ctx, id, ["published"], "draft", "Unpublished company workout"),
  ),

  archive: endpoint<{ id: string }, Workout, "business">("business", "POST", "/organization/workouts/:id/archive", ({ id }, ctx) =>
    setStatus(ctx, id, ["published", "draft"], "archived", "Archived company workout"),
  ),

  /** Archived → draft, ready to edit or publish again. */
  restore: endpoint<{ id: string }, Workout, "business">("business", "POST", "/organization/workouts/:id/restore", ({ id }, ctx) =>
    setStatus(ctx, id, ["archived"], "draft", "Restored company workout"),
  ),

  /** Copy a company workout or a HealthX library workout into a new company draft. */
  duplicate: endpoint<{ id: string }, Workout, "business">("business", "POST", "/organization/workouts/:id/duplicate", ({ id }, ctx) => {
    requireRole(ctx, WORKOUT_ROLES)
    const source = companyWorkouts(ctx).find((x) => x.id === id) ?? libraryWorkouts(ctx).find((x) => x.id === id)
    if (!source) throw notFound("Workout")
    const copy: Workout = {
      ...structuredClone(source),
      id: newId("wo"),
      companyId: ctx.companyId(),
      name: uniqueName(ctx, source.name),
      status: "draft",
      completions: 0,
      updatedAt: new Date().toISOString(),
    }
    ctx.db.workouts.push(copy)
    audit(ctx, {
      action: source.companyId === null ? `Copied HealthX workout “${source.name}” to company workouts` : "Duplicated company workout",
      entityType: "Workout",
      entityName: copy.name,
      companyId: ctx.companyId(),
    })
    ctx.save()
    return copy
  }),

  /** Only drafts can be deleted (published or used workouts are archived instead). */
  remove: endpoint<{ id: string }, { id: string }, "business">("business", "DELETE", "/organization/workouts/:id", ({ id }, ctx) => {
    requireRole(ctx, WORKOUT_ROLES)
    const w = findCompanyWorkout(ctx, id)
    if (w.status !== "draft") throw badRequest("Only drafts can be deleted. Archive this workout instead.")
    if (w.completions > 0) throw badRequest("Employees have completed this workout, so it can't be deleted. Archive it instead.")
    ctx.db.workouts.splice(ctx.db.workouts.indexOf(w), 1)
    audit(ctx, { action: "Deleted company workout draft", entityType: "Workout", entityName: w.name, companyId: ctx.companyId(), severity: "warning" })
    ctx.save()
    return { id }
  }),
}
