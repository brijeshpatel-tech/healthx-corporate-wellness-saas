/**
 * Platform Admin — exercise library (SCR-P-018). Exercises are the building blocks of global workouts.
 * Media (client decision #16): a short MP4 video + an image + instruction steps. Media files go through
 * POST /files first; the exercise stores the returned URLs. The emoji stays as the fallback thumbnail.
 */
import type { Exercise, FitnessLevel } from "@/lib/types"
import { audit, badRequest, endpoint, matchesSearch, newId, notFound } from "../core"
import { requireAdmin, type AdminCtx } from "./common"

export const EXERCISE_MUSCLE_GROUPS = ["full body", "legs", "glutes", "core", "chest", "back", "arms", "shoulders", "neck", "mind"] as const
export const EXERCISE_EQUIPMENT = ["mat", "dumbbells", "chair", "resistance band", "kettlebell", "bench", "pull-up bar", "skipping rope"] as const
export const EXERCISE_EMOJIS = ["🤸", "🦵", "💪", "🧱", "🚶", "⛰️", "🔥", "🌉", "🚴", "🏋️", "🙆", "🪑", "✋", "🌞", "🧎", "🏃", "🫁", "🧘", "🥊", "🧗", "🏊", "⚡", "🦶", "🤾"] as const

export const VIDEO_MAX_MB = 100
export const IMAGE_MAX_MB = 5
export const VIDEO_ERROR = "Video must be MP4 under 100 MB."
export const IMAGE_ERROR = "Image must be JPG, PNG or WebP under 5 MB."
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]

/** An uploaded or linked media file. */
export interface MediaFile {
  url: string
  /** Set for uploaded files (absent for pasted links). */
  fileName?: string
  sizeBytes?: number
}

/** Exercise media stored next to the base Exercise fields (optional — older exercises only have the emoji). */
export interface ExerciseMedia {
  video?: MediaFile
  image?: MediaFile
}

export type ExerciseWithMedia = Exercise & ExerciseMedia

export interface UploadInput {
  fileName: string
  contentType: string
  sizeBytes: number
  purpose: "exercise_video" | "exercise_image"
}

export interface ExerciseRow extends ExerciseWithMedia {
  /** Workouts (global or company) that include this exercise, any status. */
  usedIn: number
  /** Published global or company workouts that include it — blocks deletion. */
  usedInPublished: number
}

export interface ExerciseQuery {
  search?: string
  muscleGroup?: string
  level?: FitnessLevel | "all"
  status?: Exercise["status"] | "all"
}

export interface ExerciseList {
  items: ExerciseRow[]
  total: number
  counts: { all: number; published: number; draft: number }
  muscleGroups: string[]
  equipment: string[]
}

export interface ExerciseInput {
  name: string
  instructions: string[]
  muscleGroups: string[]
  equipment: string[]
  level: FitnessLevel
  defaultDurationSec: number
  defaultReps?: number | null
  mediaEmoji: string
  video?: MediaFile | null
  image?: MediaFile | null
  status: Exercise["status"]
}

const isUrl = (value: string) => {
  try {
    const u = new URL(value)
    return u.protocol === "https:" || u.protocol === "http:"
  } catch {
    return false
  }
}

const cleanMedia = (m: MediaFile | null | undefined): MediaFile | undefined =>
  m?.url?.trim() ? { url: m.url.trim(), fileName: m.fileName || undefined, sizeBytes: m.sizeBytes || undefined } : undefined

const usage = (ctx: AdminCtx, id: string) => {
  const workouts = ctx.db.workouts.filter((w) => w.exercises.some((s) => s.exerciseId === id))
  return {
    usedIn: workouts.length,
    usedInPublished: workouts.filter((w) => w.status === "published").length,
    workouts,
  }
}

const toRow = (ctx: AdminCtx, e: Exercise): ExerciseRow => {
  const u = usage(ctx, e.id)
  return { ...e, usedIn: u.usedIn, usedInPublished: u.usedInPublished }
}

function validate(ctx: AdminCtx, input: ExerciseInput, id?: string) {
  const errors: Record<string, string> = {}
  const name = input.name?.trim() ?? ""
  if (!name) errors.name = "Enter an exercise name"
  else if (name.length > 60) errors.name = "Keep the name under 60 characters"
  else if (ctx.db.exercises.some((e) => e.id !== id && e.name.toLowerCase() === name.toLowerCase())) errors.name = "An exercise with this name already exists"
  const steps = (input.instructions ?? []).map((s) => s.trim()).filter(Boolean)
  if (steps.length === 0) errors.instructions = "Add at least one instruction step"
  if ((input.muscleGroups ?? []).length === 0) errors.muscleGroups = "Add at least one muscle group"
  if (!Number.isInteger(input.defaultDurationSec) || input.defaultDurationSec < 5 || input.defaultDurationSec > 600) errors.defaultDurationSec = "Enter 5–600 seconds"
  if (input.defaultReps !== undefined && input.defaultReps !== null && (!Number.isInteger(input.defaultReps) || input.defaultReps < 1 || input.defaultReps > 200)) errors.defaultReps = "Enter 1–200 reps or leave empty"
  if (!input.mediaEmoji?.trim()) errors.mediaEmoji = "Choose a fallback icon"
  if (input.video?.url && !isUrl(input.video.url)) errors.video = "Enter a valid video URL starting with https://"
  else if (input.video?.sizeBytes && input.video.sizeBytes > VIDEO_MAX_MB * 1024 * 1024) errors.video = VIDEO_ERROR
  if (input.image?.url && !isUrl(input.image.url)) errors.image = "Enter a valid image URL starting with https://"
  else if (input.image?.sizeBytes && input.image.sizeBytes > IMAGE_MAX_MB * 1024 * 1024) errors.image = IMAGE_ERROR
  if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
  return { name, steps }
}

const normalizeTags = (tags: string[]) => [...new Set((tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))]

export const exercisesApi = {
  list: endpoint<ExerciseQuery, ExerciseList, "admin">("admin", "GET", "/platform/exercises", (q, ctx) => {
    requireAdmin(ctx)
    const all = ctx.db.exercises
    const items = all
      .filter(
        (e) =>
          matchesSearch(q.search, e.name, ...e.muscleGroups, ...e.equipment) &&
          (!q.muscleGroup || q.muscleGroup === "all" || e.muscleGroups.includes(q.muscleGroup)) &&
          (!q.level || q.level === "all" || e.level === q.level) &&
          (!q.status || q.status === "all" || e.status === q.status),
      )
      .map((e) => toRow(ctx, e))
      .sort((a, b) => a.name.localeCompare(b.name))
    return {
      items,
      total: items.length,
      counts: { all: all.length, published: all.filter((e) => e.status === "published").length, draft: all.filter((e) => e.status === "draft").length },
      muscleGroups: [...new Set([...EXERCISE_MUSCLE_GROUPS, ...all.flatMap((e) => e.muscleGroups)])].sort(),
      equipment: [...new Set([...EXERCISE_EQUIPMENT, ...all.flatMap((e) => e.equipment)])].sort(),
    }
  }),

  create: endpoint<ExerciseInput, Exercise, "admin">("admin", "POST", "/platform/exercises", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const { name, steps } = validate(ctx, input)
    const exercise: ExerciseWithMedia = {
      id: newId("ex"),
      name,
      instructions: steps,
      muscleGroups: normalizeTags(input.muscleGroups),
      equipment: normalizeTags(input.equipment),
      level: input.level,
      defaultDurationSec: input.defaultDurationSec,
      defaultReps: input.defaultReps ?? undefined,
      mediaEmoji: input.mediaEmoji.trim(),
      video: cleanMedia(input.video),
      image: cleanMedia(input.image),
      status: input.status,
    }
    ctx.db.exercises.push(exercise)
    audit(ctx, { action: "Created exercise", entityType: "Exercise", entityName: exercise.name })
    ctx.save()
    return exercise
  }),

  update: endpoint<ExerciseInput & { id: string }, Exercise, "admin">("admin", "PATCH", "/platform/exercises/:id", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const exercise = ctx.db.exercises.find((e) => e.id === input.id)
    if (!exercise) throw notFound("Exercise")
    const { name, steps } = validate(ctx, input, exercise.id)
    if (input.status === "draft" && exercise.status === "published" && usage(ctx, exercise.id).usedInPublished > 0) {
      throw badRequest("This exercise is used in published workouts, so it must stay published.", { status: "Used in published workouts — unpublish those first" })
    }
    Object.assign(exercise, {
      name,
      instructions: steps,
      muscleGroups: normalizeTags(input.muscleGroups),
      equipment: normalizeTags(input.equipment),
      level: input.level,
      defaultDurationSec: input.defaultDurationSec,
      defaultReps: input.defaultReps ?? undefined,
      mediaEmoji: input.mediaEmoji.trim(),
      video: cleanMedia(input.video),
      image: cleanMedia(input.image),
      status: input.status,
    })
    audit(ctx, { action: "Updated exercise", entityType: "Exercise", entityName: exercise.name })
    ctx.save()
    return exercise
  }),

  /** POST /files — uploads exercise media (multipart in the real API). The mock checks type/size and returns a CDN URL. */
  upload: endpoint<UploadInput, MediaFile, "admin">("admin", "POST", "/files", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    if (input.purpose === "exercise_video" && (input.contentType !== "video/mp4" || input.sizeBytes > VIDEO_MAX_MB * 1024 * 1024)) throw badRequest(VIDEO_ERROR, { video: VIDEO_ERROR })
    if (input.purpose === "exercise_image" && (!IMAGE_TYPES.includes(input.contentType) || input.sizeBytes > IMAGE_MAX_MB * 1024 * 1024)) throw badRequest(IMAGE_ERROR, { image: IMAGE_ERROR })
    const safe = input.fileName.toLowerCase().replace(/[^a-z0-9.]+/g, "-")
    return { url: `https://media.healthx.life/exercises/${newId("file")}-${safe}`, fileName: input.fileName, sizeBytes: input.sizeBytes }
  }),

  remove: endpoint<{ id: string }, { id: string; removedFromDrafts: number }, "admin">("admin", "DELETE", "/platform/exercises/:id", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const exercise = ctx.db.exercises.find((e) => e.id === input.id)
    if (!exercise) throw notFound("Exercise")
    const u = usage(ctx, exercise.id)
    if (u.usedInPublished > 0) throw badRequest("This exercise is used in published workouts and can't be deleted.")
    // Unpublished (draft / archived) workouts simply lose the step.
    for (const w of u.workouts) w.exercises = w.exercises.filter((s) => s.exerciseId !== exercise.id)
    ctx.db.exercises.splice(ctx.db.exercises.indexOf(exercise), 1)
    audit(ctx, { action: "Deleted exercise", entityType: "Exercise", entityName: exercise.name, severity: "warning" })
    ctx.save()
    return { id: exercise.id, removedFromDrafts: u.workouts.length }
  }),
}
