/** Platform Admin — global workout library (SCR-P-016, SCR-P-017). Only published workouts appear in the Employee App. */
import type { FitnessLevel, Workout, WorkoutExercise } from "@/lib/types"
import { audit, badRequest, endpoint, matchesSearch, newId, notFound } from "../core"
import { requireAdmin, type AdminCtx } from "./common"
import type { ExerciseWithMedia } from "./exercises"

export const WORKOUT_CATEGORIES = ["Full Body", "Strength", "Cardio / HIIT", "Core", "Yoga", "Mindfulness", "Desk & Office", "Mobility & Stretching"] as const
export const WORKOUT_EQUIPMENT = ["mat", "dumbbells", "chair", "resistance band", "kettlebell", "bench", "pull-up bar", "skipping rope"] as const
export const WORKOUT_MUSCLE_GROUPS = ["full body", "legs", "glutes", "core", "chest", "back", "arms", "shoulders", "neck", "mind"] as const

/** Seconds per rep used to estimate the length of rep-based steps. */
export const SECONDS_PER_REP = 3

/** Work seconds of one step (reps are estimated at ~3 s each). */
export const stepWorkSec = (s: Pick<WorkoutExercise, "durationSec" | "reps">) => (s.reps ? s.reps * SECONDS_PER_REP : (s.durationSec ?? 0))

/** Total seconds: work of every step + rest between steps (rest after the last step is not counted, as in the app). */
export function workoutTotalSec(steps: Pick<WorkoutExercise, "durationSec" | "reps" | "restSec">[]) {
  return steps.reduce((total, s, i) => total + stepWorkSec(s) + (i < steps.length - 1 ? s.restSec || 0 : 0), 0)
}

export const workoutDurationMin = (steps: Pick<WorkoutExercise, "durationSec" | "reps" | "restSec">[]) => Math.max(1, Math.ceil(workoutTotalSec(steps) / 60))

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
}

export interface WorkoutQuery {
  search?: string
  category?: string
  level?: FitnessLevel | "all"
  location?: Workout["location"] | "all"
  status?: Workout["status"] | "all"
}

export interface WorkoutList {
  items: WorkoutRow[]
  total: number
  counts: { all: number; published: number; draft: number; archived: number }
  categories: string[]
}

export interface WorkoutDetail {
  workout: Workout
  /** Exercises referenced by the workout (so drafts with unpublished exercises still render). */
  exercises: ExerciseWithMedia[]
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
  status: Workout["status"]
}

export type WorkoutPatch = { id: string } & Partial<WorkoutInput>

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
})

const globalWorkouts = (ctx: AdminCtx) => ctx.db.workouts.filter((w) => w.companyId === null)

function findGlobal(ctx: AdminCtx, id: string) {
  const w = ctx.db.workouts.find((x) => x.id === id && x.companyId === null)
  if (!w) throw notFound("Workout")
  return w
}

const tags = (values: string[] | undefined) => [...new Set((values ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))]

/** Validates the full workout (after merging a patch) and returns the cleaned steps. */
function validate(ctx: AdminCtx, w: WorkoutInput): WorkoutExercise[] {
  const errors: Record<string, string> = {}
  const name = w.name?.trim() ?? ""
  if (!name) errors.name = "Enter a workout title"
  else if (name.length > 80) errors.name = "Keep the title under 80 characters"
  if ((w.description ?? "").length > 500) errors.description = "Keep the description under 500 characters"
  if (!w.category?.trim()) errors.category = "Choose a category"
  if (!Number.isInteger(w.calories) || w.calories < 0 || w.calories > 2000) errors.calories = "Enter 0–2,000 kcal"
  if (!Number.isInteger(w.points) || w.points < 0 || w.points > 1000) errors.points = "Enter 0–1,000 points"
  const steps: WorkoutExercise[] = []
  ;(w.exercises ?? []).forEach((s, i) => {
    const exercise = ctx.db.exercises.find((e) => e.id === s.exerciseId)
    if (!exercise) {
      errors[`exercises.${i}.exerciseId`] = "This exercise no longer exists"
      return
    }
    const reps = s.reps && s.reps > 0 ? Math.round(s.reps) : undefined
    const durationSec = reps ? reps * SECONDS_PER_REP : Math.round(s.durationSec ?? 0)
    if (!reps && (durationSec < 5 || durationSec > 900)) errors[`exercises.${i}.durationSec`] = "Enter 5–900 seconds"
    if (reps && reps > 200) errors[`exercises.${i}.reps`] = "Enter 1–200 reps"
    const restSec = Math.round(s.restSec ?? 0)
    if (restSec < 0 || restSec > 300) errors[`exercises.${i}.restSec`] = "Rest must be 0–300 seconds"
    if (w.status === "published" && exercise.status !== "published") errors[`exercises.${i}.exerciseId`] = `Publish “${exercise.name}” first`
    steps.push({ exerciseId: exercise.id, durationSec, reps, restSec })
  })
  if (steps.length === 0 && !errors.exercises) errors.exercises = "Add at least one exercise"
  const messages = Object.values(errors)
  if (messages.length) throw badRequest(errors.exercises ? "Add at least one exercise." : messages.length === 1 ? `${messages[0]}.` : "Please fix the highlighted fields.", errors)
  return steps
}

const STATUS_ACTION: Record<Workout["status"], string> = { published: "Published workout", draft: "Unpublished workout", archived: "Archived workout" }

export const workoutsApi = {
  list: endpoint<WorkoutQuery, WorkoutList, "admin">("admin", "GET", "/platform/workouts", (q, ctx) => {
    requireAdmin(ctx)
    const all = globalWorkouts(ctx)
    const items = all
      .filter(
        (w) =>
          matchesSearch(q.search, w.name, w.description, w.category, ...w.muscleGroups) &&
          (!q.category || q.category === "all" || w.category === q.category) &&
          (!q.level || q.level === "all" || w.level === q.level) &&
          (!q.location || q.location === "all" || w.location === q.location) &&
          (!q.status || q.status === "all" || w.status === q.status),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(toRow)
    return {
      items,
      total: items.length,
      counts: {
        all: all.length,
        published: all.filter((w) => w.status === "published").length,
        draft: all.filter((w) => w.status === "draft").length,
        archived: all.filter((w) => w.status === "archived").length,
      },
      categories: [...new Set([...WORKOUT_CATEGORIES, ...all.map((w) => w.category)])].sort(),
    }
  }),

  get: endpoint<{ id: string }, WorkoutDetail, "admin">("admin", "GET", "/platform/workouts/:id", (input, ctx) => {
    requireAdmin(ctx)
    const workout = findGlobal(ctx, input.id)
    const ids = new Set(workout.exercises.map((s) => s.exerciseId))
    return { workout, exercises: ctx.db.exercises.filter((e) => ids.has(e.id)) }
  }),

  create: endpoint<WorkoutInput, Workout, "admin">("admin", "POST", "/platform/workouts", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const steps = validate(ctx, input)
    const workout: Workout = {
      id: newId("wo"),
      companyId: null,
      name: input.name.trim(),
      description: input.description.trim(),
      category: input.category.trim(),
      level: input.level,
      location: input.location,
      equipment: tags(input.equipment),
      muscleGroups: tags(input.muscleGroups),
      durationMin: workoutDurationMin(steps),
      calories: input.calories,
      points: input.points,
      coverEmoji: input.coverEmoji,
      coverColor: input.coverColor,
      exercises: steps,
      status: input.status === "published" ? "published" : "draft",
      completions: 0,
      updatedAt: new Date().toISOString(),
    }
    ctx.db.workouts.push(workout)
    audit(ctx, { action: workout.status === "published" ? "Created and published workout" : "Created workout draft", entityType: "Workout", entityName: workout.name })
    ctx.save()
    return workout
  }),

  /** PATCH — full edit from the editor, or a status-only change (publish / unpublish / archive). */
  update: endpoint<WorkoutPatch, Workout, "admin">("admin", "PATCH", "/platform/workouts/:id", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const { id, ...patch } = input
    const workout = findGlobal(ctx, id)
    const merged: WorkoutInput = {
      name: workout.name,
      description: workout.description,
      category: workout.category,
      level: workout.level,
      location: workout.location,
      equipment: workout.equipment,
      muscleGroups: workout.muscleGroups,
      calories: workout.calories,
      points: workout.points,
      coverEmoji: workout.coverEmoji,
      coverColor: workout.coverColor,
      exercises: workout.exercises,
      status: workout.status,
      ...patch,
    }
    const steps = validate(ctx, merged)
    const statusOnly = Object.keys(patch).length === 1 && patch.status !== undefined
    const previous = workout.status
    Object.assign(workout, {
      name: merged.name.trim(),
      description: merged.description.trim(),
      category: merged.category.trim(),
      level: merged.level,
      location: merged.location,
      equipment: tags(merged.equipment),
      muscleGroups: tags(merged.muscleGroups),
      calories: merged.calories,
      points: merged.points,
      coverEmoji: merged.coverEmoji,
      coverColor: merged.coverColor,
      exercises: statusOnly ? workout.exercises : steps,
      durationMin: statusOnly ? workout.durationMin : workoutDurationMin(steps),
      status: merged.status,
      updatedAt: new Date().toISOString(),
    })
    const action = previous !== workout.status ? STATUS_ACTION[workout.status] : "Updated workout"
    audit(ctx, { action, entityType: "Workout", entityName: workout.name, severity: workout.status === "archived" ? "warning" : "info" })
    ctx.save()
    return workout
  }),

  duplicate: endpoint<{ id: string }, Workout, "admin">("admin", "POST", "/platform/workouts/:id/duplicate", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const source = findGlobal(ctx, input.id)
    const base = `${source.name} (copy)`
    let name = base
    for (let n = 2; ctx.db.workouts.some((w) => w.companyId === null && w.name === name); n++) name = `${source.name} (copy ${n})`
    const copy: Workout = {
      ...structuredClone(source),
      id: newId("wo"),
      name,
      status: "draft",
      completions: 0,
      updatedAt: new Date().toISOString(),
    }
    ctx.db.workouts.push(copy)
    audit(ctx, { action: "Duplicated workout", entityType: "Workout", entityName: copy.name })
    ctx.save()
    return copy
  }),

  /** Deletes a workout. Workouts with completions are archived instead so history stays intact. */
  remove: endpoint<{ id: string }, { id: string; archived: boolean; name: string }, "admin">("admin", "DELETE", "/platform/workouts/:id", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const workout = findGlobal(ctx, input.id)
    if (workout.completions > 0) {
      workout.status = "archived"
      workout.updatedAt = new Date().toISOString()
      audit(ctx, { action: "Archived workout (has completions)", entityType: "Workout", entityName: workout.name, severity: "warning" })
      ctx.save()
      return { id: workout.id, archived: true, name: workout.name }
    }
    ctx.db.workouts.splice(ctx.db.workouts.indexOf(workout), 1)
    audit(ctx, { action: "Deleted workout", entityType: "Workout", entityName: workout.name, severity: "warning" })
    ctx.save()
    return { id: workout.id, archived: false, name: workout.name }
  }),
}
