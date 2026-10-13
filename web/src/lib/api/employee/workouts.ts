/** Employee app — workouts (SCR-M-029 … SCR-M-035). Library is shared content; sessions are own data. */
import type { Exercise, FitnessLevel, Workout, WorkoutSession } from "@/lib/types"
import { toLocalDate } from "@/lib/mock/series"
import { ApiError, badRequest, endpoint, newId, notFound, type MockContext } from "../core"
import { awardPoints, myEmployee } from "./activity"

type Ctx = MockContext<"employee">

export type DurationBucket = "short" | "medium" | "long"
export const DURATION_LABEL: Record<DurationBucket, string> = { short: "Under 10 min", medium: "10–20 min", long: "Over 20 min" }

export interface WorkoutQuery {
  q?: string
  category?: string
  level?: FitnessLevel[]
  location?: Workout["location"][]
  equipment?: string[]
  duration?: DurationBucket[]
  muscle?: string[]
}

export interface WorkoutCard {
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
  exerciseCount: number
  companyMade: boolean
  doneCount: number
}

export interface WorkoutFilterValues {
  categories: string[]
  levels: FitnessLevel[]
  locations: Workout["location"][]
  equipment: string[]
  durations: DurationBucket[]
  muscles: string[]
}

export interface WorkoutStep {
  index: number
  exercise: Exercise
  durationSec: number
  reps?: number
  restSec: number
}

export interface WorkoutDetail extends WorkoutCard {
  steps: WorkoutStep[]
  totalWorkSec: number
  totalRestSec: number
  lastCompletedAt?: string
  /** Saved to "My workouts" (Phase 2). */
  saved: boolean
  /** Minimum share of exercises to finish to earn points (ASSUMPTION — TBC). */
  minCompletionForPoints: number
}

export interface CompleteInput {
  id: string
  exercisesCompleted: number
  totalExercises: number
  durationSec: number
  endedEarly: boolean
}

export interface CompleteResult {
  sessionId: string
  workoutId: string
  workoutName: string
  coverEmoji: string
  coverColor: string
  completed: boolean
  exercisesCompleted: number
  totalExercises: number
  durationMin: number
  calories: number
  pointsEarned: number
  pointsEligible: boolean
  pointsCapped: boolean
  badge: { id: string; name: string; icon: string; color: string; points: number; description: string } | null
  streakDays: number
  workoutsThisMonth: number
}

export interface WorkoutHistoryRow {
  id: string
  workoutId: string
  name: string
  coverEmoji: string
  coverColor: string
  category: string
  startedAt: string
  completedAt?: string
  durationMin: number
  calories: number
  points: number
}

export interface WorkoutHistory {
  month: string
  items: WorkoutHistoryRow[]
  summary: { workouts: number; minutes: number; points: number; calories: number }
  months: string[]
  totalCompleted: number
}

const MIN_COMPLETION = 0.5

function available(ctx: Ctx) {
  const companyId = ctx.companyId()
  return ctx.db.workouts.filter((w) => w.status === "published" && (w.companyId === null || w.companyId === companyId))
}

const bucket = (min: number): DurationBucket => (min < 10 ? "short" : min <= 20 ? "medium" : "long")

function toCard(ctx: Ctx, w: Workout): WorkoutCard {
  const done = ctx.me().workoutSessions.filter((s) => s.workoutId === w.id && s.completed).length
  return {
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
    exerciseCount: w.exercises.length,
    companyMade: w.companyId !== null,
    doneCount: done,
  }
}

const uniq = <T,>(xs: T[]) => [...new Set(xs)]

export function filterWorkouts(cards: WorkoutCard[], q: WorkoutQuery) {
  const text = q.q?.trim().toLowerCase()
  return cards.filter(
    (w) =>
      (!text || text.length < 2 || [w.name, w.description, w.category, ...w.muscleGroups].some((f) => f.toLowerCase().includes(text))) &&
      (!q.category || q.category === "all" || w.category === q.category) &&
      (!q.level?.length || q.level.includes(w.level)) &&
      (!q.location?.length || q.location.includes(w.location)) &&
      (!q.equipment?.length || q.equipment.some((e) => (e === "none" ? w.equipment.length === 0 : w.equipment.includes(e)))) &&
      (!q.duration?.length || q.duration.includes(bucket(w.durationMin))) &&
      (!q.muscle?.length || q.muscle.some((m) => w.muscleGroups.includes(m))),
  )
}

function workoutStreak(ctx: Ctx) {
  const days = new Set(ctx.me().workoutSessions.filter((s) => s.completed).map((s) => toLocalDate(new Date(s.completedAt ?? s.startedAt))))
  let streak = 0
  const d = new Date()
  if (!days.has(toLocalDate(d))) d.setDate(d.getDate() - 1)
  while (days.has(toLocalDate(d))) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

/** Unlocks a badge once (adds its bonus points and a notification). */
function unlockBadge(ctx: Ctx, badgeId: string) {
  const me = ctx.me()
  const def = ctx.db.badges.find((b) => b.id === badgeId && b.status === "active")
  if (!def) return null
  let ub = me.badges.find((b) => b.badgeId === badgeId)
  if (ub?.earnedAt) return null
  if (!ub) {
    ub = { badgeId, progress: 0 }
    me.badges.push(ub)
  }
  ub.progress = 1
  ub.earnedAt = new Date().toISOString()
  def.earnedCount += 1
  const emp = myEmployee(ctx)
  emp.stats.badgesCount += 1
  if (def.points > 0) awardPoints(ctx, "badge", `Badge unlocked: ${def.name}`, def.points)
  me.notifications.unshift({ id: newId("ntf"), type: "badge", title: `Badge unlocked: ${def.name} ${def.icon}`, body: `${def.description}${def.points ? ` +${def.points} points.` : ""}`, createdAt: new Date().toISOString(), read: false, href: "/employee-app/badges" })
  return { id: def.id, name: def.name, icon: def.icon, color: def.color, points: def.points, description: def.description }
}

export const workoutsApi = {
  filters: endpoint<void, WorkoutFilterValues, "employee">("employee", "GET", "/workouts/filters", (_i, ctx) => {
    const list = available(ctx)
    const levelOrder: FitnessLevel[] = ["beginner", "intermediate", "advanced"]
    return {
      categories: uniq(list.map((w) => w.category)).sort(),
      levels: levelOrder.filter((l) => list.some((w) => w.level === l)),
      locations: uniq(list.map((w) => w.location)),
      equipment: ["none", ...uniq(list.flatMap((w) => w.equipment)).sort()],
      durations: ["short", "medium", "long"],
      muscles: uniq(list.flatMap((w) => w.muscleGroups)).sort(),
    }
  }),

  list: endpoint<WorkoutQuery, { items: WorkoutCard[]; total: number; all: WorkoutCard[] }, "employee">("employee", "GET", "/workouts", (q, ctx) => {
    const all = available(ctx)
      .map((w) => toCard(ctx, w))
      .sort((a, b) => Number(b.companyMade) - Number(a.companyMade) || a.durationMin - b.durationMin)
    const items = filterWorkouts(all, q)
    return { items, total: items.length, all }
  }),

  get: endpoint<{ id: string }, WorkoutDetail, "employee">("employee", "GET", "/workouts/:id", ({ id }, ctx) => {
    const w = ctx.db.workouts.find((x) => x.id === id)
    if (!w || w.status !== "published" || (w.companyId !== null && w.companyId !== ctx.companyId())) throw new ApiError("This workout is no longer available.", 410, "workout_unavailable")
    const steps: WorkoutStep[] = []
    for (const we of w.exercises) {
      const exercise = ctx.db.exercises.find((e) => e.id === we.exerciseId)
      if (exercise) steps.push({ index: steps.length, exercise, durationSec: we.durationSec ?? exercise.defaultDurationSec, reps: we.reps ?? exercise.defaultReps, restSec: we.restSec })
    }
    const last = ctx.me().workoutSessions.find((s) => s.workoutId === id && s.completed)
    return {
      ...toCard(ctx, w),
      steps,
      totalWorkSec: steps.reduce((a, s) => a + s.durationSec, 0),
      totalRestSec: steps.slice(0, -1).reduce((a, s) => a + s.restSec, 0),
      lastCompletedAt: last?.completedAt,
      saved: ctx.me().bookmarks.includes(`workout:${id}`),
      minCompletionForPoints: MIN_COMPLETION,
    }
  }),

  toggleSave: endpoint<{ id: string; saved: boolean }, { saved: boolean }, "employee">("employee", "PUT", "/me/saved-workouts/:id", ({ id, saved }, ctx) => {
    const me = ctx.me()
    const key = `workout:${id}`
    me.bookmarks = me.bookmarks.filter((b) => b !== key)
    if (saved) me.bookmarks.push(key)
    ctx.save()
    return { saved }
  }),

  start: endpoint<{ workoutId: string }, { sessionId: string; startedAt: string }, "employee">("employee", "POST", "/me/workout-sessions", ({ workoutId }, ctx) => {
    const w = available(ctx).find((x) => x.id === workoutId)
    if (!w) throw new ApiError("This workout is no longer available.", 410, "workout_unavailable")
    const session: WorkoutSession = { id: newId("wss"), workoutId, startedAt: new Date().toISOString(), durationMin: 0, calories: 0, points: 0, completed: false }
    ctx.me().workoutSessions.unshift(session)
    ctx.save()
    return { sessionId: session.id, startedAt: session.startedAt }
  }),

  progress: endpoint<{ id: string; exerciseIndex: number; phase: "exercise" | "rest"; paused: boolean }, { ok: true }, "employee">(
    "employee",
    "PATCH",
    "/me/workout-sessions/:id",
    ({ id, exerciseIndex, phase, paused }, ctx) => {
      if (!ctx.me().workoutSessions.some((s) => s.id === id)) throw notFound("Workout session")
      const store = ctx.extra<Record<string, { exerciseIndex: number; phase: string; paused: boolean; at: string }>>("emp-workout-progress", () => ({}))
      store[id] = { exerciseIndex, phase, paused, at: new Date().toISOString() }
      ctx.save()
      return { ok: true }
    },
  ),

  complete: endpoint<CompleteInput, CompleteResult, "employee">("employee", "POST", "/me/workout-sessions/:id/complete", (input, ctx) => {
    const me = ctx.me()
    const session = me.workoutSessions.find((s) => s.id === input.id)
    if (!session) throw notFound("Workout session")
    const w = ctx.db.workouts.find((x) => x.id === session.workoutId)
    if (!w) throw notFound("Workout")
    if (input.totalExercises <= 0 || input.exercisesCompleted < 0 || input.exercisesCompleted > input.totalExercises) throw badRequest("Invalid workout progress.")
    const ratio = input.exercisesCompleted / input.totalExercises
    const durationMin = Math.max(1, Math.round(input.durationSec / 60))
    const already = !!session.completedAt
    let pointsEarned = session.points
    let badge: CompleteResult["badge"] = null
    let pointsCapped = false
    const eligible = ratio >= MIN_COMPLETION
    if (!already) {
      session.completedAt = new Date().toISOString()
      session.durationMin = durationMin
      session.calories = Math.round(w.calories * Math.min(1, ratio))
      session.completed = eligible
      if (eligible) {
        // Points once per completed workout, within the rule's daily cap.
        pointsEarned = awardPoints(ctx, "workout", `Workout: ${w.name}`, w.points)
        pointsCapped = pointsEarned < w.points
        session.points = pointsEarned
        w.completions += 1
        const emp = myEmployee(ctx)
        emp.stats.workoutsMonth += 1
        emp.lastActiveAt = session.completedAt
        // Also appears in activity history.
        const type = /yoga/i.test(w.category) ? "yoga" : /mindful/i.test(w.category) ? "meditation" : "strength"
        me.sessions.unshift({ id: newId("act"), type, startedAt: session.startedAt, durationMin, calories: session.calories, source: "workout", notes: w.name, points: pointsEarned })
        const row = me.daily.find((d) => d.date === toLocalDate(new Date()))
        if (row) {
          row.activeMinutes += durationMin
          row.activeCalories += session.calories
        }
        if (me.workoutSessions.filter((s) => s.completed).length === 1) badge = unlockBadge(ctx, "badge_first_workout")
        if (!badge && new Date(session.startedAt).getHours() < 7) {
          const early = new Set(me.workoutSessions.filter((s) => s.completed && new Date(s.startedAt).getHours() < 7).map((s) => toLocalDate(new Date(s.startedAt))))
          if (early.size >= 5) badge = unlockBadge(ctx, "badge_early_bird")
        }
      }
      ctx.save()
    }
    const month = toLocalDate(new Date()).slice(0, 7)
    return {
      sessionId: session.id,
      workoutId: w.id,
      workoutName: w.name,
      coverEmoji: w.coverEmoji,
      coverColor: w.coverColor,
      completed: session.completed,
      exercisesCompleted: input.exercisesCompleted,
      totalExercises: input.totalExercises,
      durationMin: session.durationMin,
      calories: session.calories,
      pointsEarned,
      pointsEligible: eligible,
      pointsCapped,
      badge,
      streakDays: workoutStreak(ctx),
      workoutsThisMonth: me.workoutSessions.filter((s) => s.completed && toLocalDate(new Date(s.completedAt ?? s.startedAt)).startsWith(month)).length,
    }
  }),

  history: endpoint<{ month?: string }, WorkoutHistory, "employee">("employee", "GET", "/me/workout-sessions", ({ month }, ctx) => {
    const me = ctx.me()
    const completed = me.workoutSessions.filter((s) => s.completed).sort((a, b) => (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt))
    const monthOf = (s: WorkoutSession) => toLocalDate(new Date(s.completedAt ?? s.startedAt)).slice(0, 7)
    const current = toLocalDate(new Date()).slice(0, 7)
    const m = month || current
    const months = uniq([current, ...completed.map(monthOf)]).sort().reverse()
    const items = completed
      .filter((s) => monthOf(s) === m)
      .map((s): WorkoutHistoryRow => {
        const w = ctx.db.workouts.find((x) => x.id === s.workoutId)
        return {
          id: s.id,
          workoutId: s.workoutId,
          name: w?.name ?? "Workout",
          coverEmoji: w?.coverEmoji ?? "💪",
          coverColor: w?.coverColor ?? "#10b981",
          category: w?.category ?? "",
          startedAt: s.startedAt,
          completedAt: s.completedAt,
          durationMin: s.durationMin,
          calories: s.calories,
          points: s.points,
        }
      })
    return {
      month: m,
      items,
      summary: { workouts: items.length, minutes: items.reduce((a, r) => a + r.durationMin, 0), points: items.reduce((a, r) => a + r.points, 0), calories: items.reduce((a, r) => a + r.calories, 0) },
      months,
      totalCompleted: completed.length,
    }
  }),
}
