// AUTO-SYNCED from web/src/lib — edit in web/, then run npm run sync-shared
/** Employee app — habit tracker (SCR-M-038 … SCR-M-041). Own data only. */
import type { HabitDefinition, UserHabit } from "@/lib/types"
import { DAY_MS, toLocalDate } from "@/lib/mock/series"
import { badRequest, endpoint, newId, notFound, type MockContext } from "../core"
import { awardPoints } from "./activity"

type Ctx = MockContext<"employee">
export type HabitUnit = HabitDefinition["unit"]

export const UNIT_RANGE: Record<HabitUnit, { min: number; max: number; step: number; label: string }> = {
  steps: { min: 1000, max: 30000, step: 500, label: "steps" },
  glasses: { min: 1, max: 20, step: 1, label: "glasses" },
  hours: { min: 4, max: 12, step: 0.5, label: "hours" },
  minutes: { min: 1, max: 180, step: 1, label: "min" },
  times: { min: 1, max: 20, step: 1, label: "times" },
  check: { min: 1, max: 1, step: 1, label: "" },
}

export interface TodayHabit {
  id: string
  habitId: string
  name: string
  description: string
  icon: string
  unit: HabitUnit
  target: number
  value: number
  done: boolean
  currentStreak: number
  bestStreak: number
  /** Habit points for completing it today (0 when the same activity already earns points elsewhere). */
  points: number
  /** Decision #19: the activity behind this habit earns points from its own source instead (no double points). */
  pointsVia: "steps" | "water" | "workout" | "meditation" | null
  /** Phase 2: completes automatically from tracked data. */
  auto: "steps" | "water" | "sleep" | "workout" | null
  custom: boolean
  reminderTime?: string
  pointsAwardedToday: boolean
}

export interface HabitsToday {
  date: string
  items: TodayHabit[]
  done: number
  total: number
  pointsToday: number
  perfectDays: number
}

export interface LibraryHabit extends HabitDefinition {
  selected: boolean
  target: number
  userHabitId?: string
}

export interface HabitDetail extends TodayHabit {
  month: string
  days: { date: string; value: number | null; done: boolean; future: boolean }[]
  completedThisMonth: number
  trackedDaysThisMonth: number
  totalCompletions: number
  hasHistory: boolean
  firstTrackedDate: string
}

// ─── Internals ──────────────────────────────────────────────────────────

const awards = (ctx: Ctx) => ctx.extra<Record<string, string[]>>("emp-habit-awards", () => ({}))
const anchors = (ctx: Ctx) => ctx.extra<Record<string, string>>("emp-habits-day", () => ({}))

/** Moves each habit's 35-day window forward when a new day starts. */
function rollover(ctx: Ctx) {
  const me = ctx.me()
  const store = anchors(ctx)
  const today = toLocalDate(new Date())
  const anchor = store[me.employeeId]
  if (!anchor) {
    store[me.employeeId] = today
    return
  }
  if (anchor >= today) return
  const days = Math.min(35, Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${anchor}T12:00:00`).getTime()) / DAY_MS))
  for (const h of me.habits) {
    for (let i = 0; i < days; i++) {
      h.history.push(0)
      h.history.shift()
    }
    h.todayValue = 0
  }
  store[me.employeeId] = today
  ctx.save()
}

function definition(ctx: Ctx, h: UserHabit): Pick<HabitDefinition, "name" | "description" | "icon" | "unit" | "points" | "autoCompleteFrom"> {
  if (h.custom) return { name: h.custom.name, description: "Your personal habit", icon: h.custom.icon, unit: h.custom.unit, points: 0 }
  const def = ctx.db.habits.find((d) => d.id === h.habitId)
  return def ?? { name: "Habit", description: "", icon: "✅", unit: "check", points: 0 }
}

function autoValue(ctx: Ctx, source: HabitDefinition["autoCompleteFrom"]): number | null {
  if (!source) return null
  const me = ctx.me()
  const today = toLocalDate(new Date())
  switch (source) {
    case "steps":
      return me.daily.find((d) => d.date === today)?.steps ?? 0
    case "water":
      return Math.floor(me.water.filter((w) => toLocalDate(new Date(w.at)) === today).reduce((a, w) => a + w.amountMl, 0) / 250)
    case "sleep": {
      const rec = me.sleep.find((r) => r.date === today)
      return rec ? Math.round((rec.durationMin / 60) * 10) / 10 : 0
    }
    case "workout":
      return me.workoutSessions.some((s) => s.completed && toLocalDate(new Date(s.completedAt ?? s.startedAt)) === today) ? 1 : 0
  }
}

/**
 * Client decision #19 — the same activity must never earn points twice. Habits that mirror an activity
 * with its own points rule (steps, water goal, workouts, meditation) don't award habit points.
 */
function linkedSource(def: Pick<HabitDefinition, "name" | "autoCompleteFrom">): TodayHabit["pointsVia"] {
  if (def.autoCompleteFrom === "steps" || def.autoCompleteFrom === "water" || def.autoCompleteFrom === "workout") return def.autoCompleteFrom
  if (/meditat/i.test(def.name)) return "meditation"
  return null
}

function streaks(h: UserHabit, doneToday: boolean) {
  let prev = 0
  for (let i = h.history.length - 2; i >= 0 && h.history[i]! >= h.target; i--) prev++
  const current = prev + (doneToday ? 1 : 0)
  return { current, best: Math.max(h.bestStreak, current) }
}

function toToday(ctx: Ctx, h: UserHabit): TodayHabit {
  const def = definition(ctx, h)
  const auto = autoValue(ctx, def.autoCompleteFrom)
  const value = Math.max(h.todayValue, auto ?? 0)
  const done = value >= h.target
  const s = streaks(h, done)
  const today = toLocalDate(new Date())
  const via = h.custom ? null : linkedSource(def)
  return {
    id: h.id,
    habitId: h.habitId,
    name: def.name,
    description: def.description,
    icon: def.icon,
    unit: def.unit,
    target: h.target,
    value,
    done,
    currentStreak: s.current,
    bestStreak: s.best,
    points: via ? 0 : def.points,
    pointsVia: via,
    auto: def.autoCompleteFrom ?? null,
    custom: !!h.custom,
    reminderTime: h.reminderTime,
    pointsAwardedToday: (awards(ctx)[ctx.me().employeeId] ?? []).includes(`${h.id}:${today}`),
  }
}

/** Awards habit points once per habit per day (rule cap applies). */
function maybeAward(ctx: Ctx, h: UserHabit) {
  const t = toToday(ctx, h)
  if (!t.done || t.points <= 0) return 0
  const me = ctx.me()
  const key = `${h.id}:${toLocalDate(new Date())}`
  const list = (awards(ctx)[me.employeeId] ??= [])
  if (list.includes(key)) return 0
  list.push(key)
  h.history[h.history.length - 1] = t.value
  h.bestStreak = Math.max(h.bestStreak, t.currentStreak)
  return awardPoints(ctx, "habit", `Habit: ${t.name}`, t.points)
}

function snapshot(ctx: Ctx): HabitsToday {
  rollover(ctx)
  const me = ctx.me()
  const active = me.habits.filter((h) => h.active)
  // Phase 2 auto-complete: award points for habits completed from tracked data.
  let changed = false
  for (const h of active) if (definition(ctx, h).autoCompleteFrom && maybeAward(ctx, h) > 0) changed = true
  if (changed) ctx.save()
  const items = active.map((h) => toToday(ctx, h))
  const today = toLocalDate(new Date())
  const len = Math.max(0, ...active.map((h) => h.history.length))
  let perfect = 0
  for (let i = 0; i < len - 1; i++) if (active.length && active.every((h) => (h.history[i] ?? 0) >= h.target)) perfect++
  return {
    date: today,
    items,
    done: items.filter((i) => i.done).length,
    total: items.length,
    pointsToday: me.transactions.filter((t) => t.source === "habit" && toLocalDate(new Date(t.createdAt)) === today).reduce((a, t) => a + t.points, 0),
    perfectDays: perfect,
  }
}

/** Done / total for today's active habits (used by Home). */
export function habitsProgress(ctx: Ctx) {
  rollover(ctx)
  const items = ctx
    .me()
    .habits.filter((h) => h.active)
    .map((h) => toToday(ctx, h))
  return { done: items.filter((i) => i.done).length, total: items.length }
}

function findHabit(ctx: Ctx, id: string) {
  const h = ctx.me().habits.find((x) => x.id === id)
  if (!h) throw notFound("Habit")
  return h
}

function checkTarget(unit: HabitUnit, target: number) {
  const r = UNIT_RANGE[unit]
  if (!Number.isFinite(target) || target < r.min || target > r.max) throw badRequest(`Choose a daily target between ${r.min.toLocaleString("en-IN")} and ${r.max.toLocaleString("en-IN")}${r.label ? ` ${r.label}` : ""}.`, { target: `${r.min}–${r.max}` })
}

// ─── Endpoints ──────────────────────────────────────────────────────────

export const habitsApi = {
  today: endpoint<void, HabitsToday, "employee">("employee", "GET", "/me/habits/today", (_i, ctx) => snapshot(ctx)),

  checkIn: endpoint<{ id: string; increment?: number; value?: number }, { habit: TodayHabit; pointsEarned: number }, "employee">(
    "employee",
    "POST",
    "/me/habits/:id/completions",
    ({ id, increment, value }, ctx) => {
      rollover(ctx)
      const h = findHabit(ctx, id)
      if (!h.active) throw badRequest("This habit is no longer in your list.")
      const def = definition(ctx, h)
      const max = Math.max(h.target * 3, h.target + 20)
      const next = value !== undefined ? value : h.todayValue + (increment ?? 1)
      if (!Number.isFinite(next) || next < 0) throw badRequest("Enter a valid value.")
      h.todayValue = def.unit === "check" ? Math.min(1, next) : Math.min(max, next)
      h.history[h.history.length - 1] = Math.max(h.todayValue, autoValue(ctx, def.autoCompleteFrom) ?? 0)
      const pointsEarned = maybeAward(ctx, h)
      ctx.save()
      return { habit: toToday(ctx, h), pointsEarned }
    },
  ),

  undo: endpoint<{ id: string; date: string }, TodayHabit, "employee">("employee", "DELETE", "/me/habits/:id/completions/:date", ({ id, date }, ctx) => {
    if (date !== toLocalDate(new Date())) throw badRequest("You can only undo today's check-in.")
    const h = findHabit(ctx, id)
    h.todayValue = 0
    h.history[h.history.length - 1] = autoValue(ctx, definition(ctx, h).autoCompleteFrom) ?? 0
    ctx.save()
    return toToday(ctx, h)
  }),

  library: endpoint<void, { habits: LibraryHabit[]; custom: TodayHabit[] }, "employee">("employee", "GET", "/habits", (_i, ctx) => {
    const me = ctx.me()
    return {
      habits: ctx.db.habits
        .filter((d) => d.status === "active")
        .map((d) => {
          const mine = me.habits.find((h) => h.habitId === d.id)
          return { ...d, selected: !!mine?.active, target: mine?.target ?? d.defaultTarget, userHabitId: mine?.id }
        }),
      custom: me.habits.filter((h) => h.custom && h.active).map((h) => toToday(ctx, h)),
    }
  }),

  saveSelection: endpoint<{ selections: { habitId: string; target: number }[] }, HabitsToday, "employee">("employee", "PUT", "/me/habits", ({ selections }, ctx) => {
    const me = ctx.me()
    const customActive = me.habits.filter((h) => h.custom && h.active).length
    if (selections.length + customActive < 1) throw badRequest("Choose at least one habit.", { selections: "Choose at least one habit" })
    for (const s of selections) {
      const def = ctx.db.habits.find((d) => d.id === s.habitId && d.status === "active")
      if (!def) throw badRequest("One of the habits is no longer available.")
      checkTarget(def.unit, s.target)
    }
    const chosen = new Set(selections.map((s) => s.habitId))
    for (const h of me.habits) if (!h.custom) h.active = chosen.has(h.habitId)
    for (const s of selections) {
      const existing = me.habits.find((h) => h.habitId === s.habitId)
      if (existing) {
        existing.active = true
        existing.target = s.target
      } else me.habits.push({ id: newId("uhb"), habitId: s.habitId, target: s.target, active: true, history: Array.from({ length: 35 }, () => 0), todayValue: 0, currentStreak: 0, bestStreak: 0 })
    }
    ctx.save()
    return snapshot(ctx)
  }),

  get: endpoint<{ id: string; month?: string }, HabitDetail, "employee">("employee", "GET", "/me/habits/:id", ({ id, month }, ctx) => {
    rollover(ctx)
    const h = findHabit(ctx, id)
    const t = toToday(ctx, h)
    const todayDate = new Date()
    const today = toLocalDate(todayDate)
    const m = month || today.slice(0, 7)
    const [y, mo] = m.split("-").map(Number) as [number, number]
    const daysInMonth = new Date(y, mo, 0).getDate()
    const valueOn = (date: string) => {
      const diff = Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${date}T12:00:00`).getTime()) / DAY_MS)
      if (diff < 0 || diff >= h.history.length) return null
      return diff === 0 ? t.value : h.history[h.history.length - 1 - diff]!
    }
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const date = `${m}-${String(i + 1).padStart(2, "0")}`
      const value = valueOn(date)
      return { date, value, done: value !== null && value >= h.target, future: date > today }
    })
    const firstTracked = toLocalDate(new Date(new Date(`${today}T12:00:00`).getTime() - (h.history.length - 1) * DAY_MS))
    return {
      ...t,
      month: m,
      days,
      completedThisMonth: days.filter((d) => d.done).length,
      trackedDaysThisMonth: days.filter((d) => d.value !== null && !d.future).length,
      totalCompletions: h.history.filter((v, i) => (i === h.history.length - 1 ? t.done : v >= h.target)).length,
      hasHistory: h.history.some((v) => v > 0) || t.value > 0,
      firstTrackedDate: firstTracked,
    }
  }),

  update: endpoint<{ id: string; target: number; reminderTime: string | null }, TodayHabit, "employee">("employee", "PATCH", "/me/habits/:id", ({ id, target, reminderTime }, ctx) => {
    const h = findHabit(ctx, id)
    checkTarget(definition(ctx, h).unit, target)
    if (reminderTime !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime)) throw badRequest("Enter a valid reminder time.", { reminderTime: "Enter a valid time" })
    h.target = target
    h.reminderTime = reminderTime ?? undefined
    ctx.save()
    return toToday(ctx, h)
  }),

  remove: endpoint<{ id: string }, { ok: true }, "employee">("employee", "DELETE", "/me/habits/:id", ({ id }, ctx) => {
    const h = findHabit(ctx, id)
    h.active = false
    ctx.save()
    return { ok: true }
  }),

  createCustom: endpoint<{ name: string; icon: string; unit: HabitUnit; target: number }, TodayHabit, "employee">("employee", "POST", "/me/habits/custom", ({ name, icon, unit, target }, ctx) => {
    const me = ctx.me()
    const clean = name.trim().replace(/\s+/g, " ")
    if (clean.length < 2 || clean.length > 40) throw badRequest("Habit name must be 2–40 characters.", { name: "2–40 characters" })
    if (!icon) throw badRequest("Pick an icon.", { icon: "Pick an icon" })
    if (!(unit in UNIT_RANGE) || unit === "steps") throw badRequest("Choose how you'll track it.", { unit: "Choose a target type" })
    checkTarget(unit, target)
    const lower = clean.toLowerCase()
    const clash =
      me.habits.some((h) => h.active && definition(ctx, h).name.toLowerCase() === lower) || ctx.db.habits.some((d) => d.status === "active" && d.name.toLowerCase() === lower)
    if (clash) throw badRequest("A habit with this name already exists.", { name: "A habit with this name already exists" })
    const h: UserHabit = {
      id: newId("uhb"),
      habitId: newId("custom"),
      target,
      active: true,
      custom: { name: clean, icon, unit },
      history: Array.from({ length: 35 }, () => 0),
      todayValue: 0,
      currentStreak: 0,
      bestStreak: 0,
    }
    me.habits.push(h)
    ctx.save()
    return toToday(ctx, h)
  }),
}
