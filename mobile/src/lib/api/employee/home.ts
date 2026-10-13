// AUTO-SYNCED from web/src/lib — edit in web/, then run npm run sync-shared
/** Employee app — Home dashboard (SCR-M-018) and Customise Home (SCR-M-021, Phase 2). */
import type { Branding, ModuleCode, WeeklySummary, WellnessScoreWeights } from "@/lib/types"
import { toLocalDate } from "@/lib/mock/series"
import { badRequest, endpoint, type MockContext } from "../core"
import { stepGoalInfo, syncStatusOf, type StepGoalInfo, type SyncStatus } from "./activity"
import { habitsProgress } from "./habits"

export type HomeCardKey = "score" | "steps" | "water" | "workout" | "habits" | "sleep" | "challenge" | "rank" | "summary"

export interface HomeCardDef {
  key: HomeCardKey
  label: string
  description: string
  /** Mandatory cards can't be hidden (ASSUMPTION). */
  mandatory?: boolean
  /** Company module the card depends on. */
  module?: ModuleCode
  size: "large" | "tile" | "wide"
  phase?: 2
}

export const HOME_CARDS: HomeCardDef[] = [
  { key: "score", label: "Wellness Score", description: "Your score ring and what makes it up", size: "large" },
  { key: "steps", label: "Today's progress", description: "Steps, distance, calories and active minutes", mandatory: true, module: "activity", size: "large" },
  { key: "water", label: "Water", description: "Today's water with one-tap logging", module: "water", size: "tile" },
  { key: "workout", label: "Workout", description: "Today's workout or a suggestion", module: "workouts", size: "tile" },
  { key: "habits", label: "Habits", description: "How many habits you've done today", module: "habits", size: "tile" },
  { key: "sleep", label: "Sleep", description: "Last night's sleep", module: "sleep", size: "tile", phase: 2 },
  { key: "challenge", label: "Today's challenge", description: "Your top challenge and progress", module: "challenges", size: "large" },
  { key: "rank", label: "This week & rank", description: "Steps this week and your current rank", size: "large" },
  { key: "summary", label: "Weekly insight", description: "Your weekly wellness summary", size: "wide" },
]

const DEFAULT_ORDER: HomeCardKey[] = ["score", "steps", "water", "workout", "habits", "sleep", "challenge", "rank", "summary"]

export interface HomeLayout {
  cards: (HomeCardDef & { visible: boolean; available: boolean })[]
  customised: boolean
}

type Ctx = MockContext<"employee">
const layoutStore = (ctx: Ctx) => ctx.extra<Record<string, { order: HomeCardKey[]; hidden: HomeCardKey[] }>>("emp-home-layout", () => ({}))

function resolveLayout(ctx: Ctx) {
  const me = ctx.me()
  const saved = layoutStore(ctx)[me.employeeId]
  const known = new Set<string>(DEFAULT_ORDER)
  if (saved) {
    const order = [...saved.order.filter((k) => known.has(k)), ...DEFAULT_ORDER.filter((k) => !saved.order.includes(k))]
    return { order, hidden: saved.hidden.filter((k) => known.has(k)), customised: true }
  }
  const fromMe = me.homeCards.filter((k): k is HomeCardKey => known.has(k))
  const order = [...fromMe, ...DEFAULT_ORDER.filter((k) => !fromMe.includes(k))]
  // Keep the default order when the stored list is the untouched seed default.
  return { order: fromMe.length >= 8 ? DEFAULT_ORDER : order, hidden: [] as HomeCardKey[], customised: false }
}

function modulesOf(ctx: Ctx) {
  const emp = ctx.db.employees.find((e) => e.id === ctx.me().employeeId)
  return ctx.db.companies.find((c) => c.id === emp?.companyId)?.modules ?? []
}

function layoutView(ctx: Ctx): HomeLayout {
  const { order, hidden, customised } = resolveLayout(ctx)
  const modules = modulesOf(ctx)
  return {
    cards: order.map((k) => {
      const def = HOME_CARDS.find((c) => c.key === k)!
      return { ...def, visible: !hidden.includes(k), available: !def.module || modules.includes(def.module) }
    }),
    customised,
  }
}

export interface HomeDashboard {
  firstName: string
  companyName: string
  branding: Branding
  modules: ModuleCode[]
  /** Visible cards in display order (modules not enabled are removed). */
  homeCards: HomeCardKey[]
  pointsBalance: number
  streak: number
  healthConnected: boolean
  lastSyncAt?: string
  /** Sync status for the compact "Sync now" row (#346). */
  sync: SyncStatus
  /** Today's step goal — personal (Phase 2, #362) or fixed. */
  goal: StepGoalInfo
  score: { total: number; weekChange: number; components: Record<keyof WellnessScoreWeights, number> }
  today: {
    steps: number
    stepGoal: number
    distanceKm: number
    activeCalories: number
    activeMinutes: number
    waterMl: number
    waterGoalMl: number
    workoutDone: { name: string; at: string } | null
    sleepMin: number | null
    habitsDone: number
    habitsTotal: number
  }
  challenge: { id: string; name: string; emoji: string; color: string; progress: number; target: number; unit: string; points: number; rank: number; participants: number; daysLeft: number } | null
  week: { date: string; steps: number; goal: number }[]
  rank: { position: number; total: number; scope: string; change: number }
  summary: WeeklySummary | null
  suggestedWorkout: { id: string; name: string; durationMin: number; emoji: string; color: string } | null
  unreadNotifications: number
}

const UNIT: Record<string, string> = { steps: "steps", distance: "km", calories: "kcal", active_minutes: "min", workouts: "workouts", water: "ml", meditation: "min", custom: "check-ins" }

export const homeApi = {
  dashboard: endpoint<void, HomeDashboard, "employee">("employee", "GET", "/me/dashboard", (_i, ctx) => {
    const me = ctx.me()
    const emp = ctx.db.employees.find((e) => e.id === me.employeeId)!
    const company = ctx.db.companies.find((c) => c.id === emp.companyId)!
    const today = toLocalDate(new Date())
    const day = me.daily.find((d) => d.date === today) ?? me.daily[me.daily.length - 1]!
    const waterMl = me.water.filter((w) => toLocalDate(new Date(w.at)) === today).reduce((a, w) => a + w.amountMl, 0)
    const workoutToday = me.workoutSessions.find((w) => w.completed && toLocalDate(new Date(w.completedAt ?? w.startedAt)) === today)
    const lastSleep = me.sleep[me.sleep.length - 1]
    const score = me.scores[me.scores.length - 1]!
    const weekAgo = me.scores[me.scores.length - 8] ?? score

    // Best active challenge the employee has joined
    const joined = ctx.db.participants
      .filter((p) => p.employeeId === emp.id)
      .map((p) => ({ p, c: ctx.db.challenges.find((c) => c.id === p.challengeId)! }))
      .filter(({ c }) => c && c.status === "active")
      .sort((a, b) => b.p.progress / b.c.target - a.p.progress / a.c.target)
    const best = joined[0]

    // Rank by steps this week within the department
    const dept = ctx.db.departments.find((d) => d.id === emp.departmentId)
    const peers = ctx.db.employees.filter((e) => e.departmentId === emp.departmentId && e.status === "active")
    const sorted = [...peers].sort((a, b) => b.stats.stepsWeek - a.stats.stepsWeek)
    const position = Math.max(1, sorted.findIndex((e) => e.id === emp.id) + 1)

    const habits = habitsProgress(ctx)
    const goal = stepGoalInfo(ctx)

    const recentWorkoutIds = new Set(me.workoutSessions.slice(0, 5).map((w) => w.workoutId))
    const suggestion = ctx.db.workouts.find((w) => w.status === "published" && !recentWorkoutIds.has(w.id) && (me.preferences.workoutLocation === "any" || w.location === me.preferences.workoutLocation || w.location === "office"))

    return {
      firstName: emp.firstName,
      companyName: company.name,
      branding: company.branding,
      modules: company.modules,
      homeCards: layoutView(ctx)
        .cards.filter((c) => c.visible && c.available)
        .map((c) => c.key),
      pointsBalance: emp.stats.pointsBalance,
      streak: emp.stats.currentStreak,
      healthConnected: me.healthConnections.some((h) => h.status === "connected"),
      lastSyncAt: me.healthConnections.find((h) => h.status === "connected")?.lastSyncAt,
      sync: syncStatusOf(ctx),
      goal,
      score: { total: score.total, weekChange: score.total - weekAgo.total, components: score.components },
      today: {
        steps: day.steps,
        stepGoal: goal.today,
        distanceKm: day.distanceKm,
        activeCalories: day.activeCalories,
        activeMinutes: day.activeMinutes,
        waterMl,
        waterGoalMl: me.waterSettings.goalMl,
        workoutDone: workoutToday ? { name: ctx.db.workouts.find((w) => w.id === workoutToday.workoutId)?.name ?? "Workout", at: workoutToday.completedAt ?? workoutToday.startedAt } : null,
        sleepMin: lastSleep ? lastSleep.durationMin : null,
        habitsDone: habits.done,
        habitsTotal: habits.total,
      },
      challenge: best
        ? {
            id: best.c.id,
            name: best.c.name,
            emoji: best.c.coverEmoji,
            color: best.c.coverColor,
            progress: best.p.progress,
            target: best.c.target,
            unit: best.c.customMetricLabel ?? UNIT[best.c.metric] ?? "",
            points: best.c.points,
            rank: best.p.rank,
            participants: best.c.participantsCount,
            daysLeft: Math.max(0, Math.round((new Date(best.c.endDate).getTime() - new Date(today).getTime()) / 86_400_000)),
          }
        : null,
      week: me.daily.slice(-7).map((d) => ({ date: d.date, steps: d.steps, goal: d.date === today ? goal.today : d.goalSteps || me.profile.dailyStepGoal })),
      rank: { position, total: sorted.length, scope: dept?.name ?? "your department", change: (position % 4) - 1 },
      summary: me.weeklySummaries[0] ?? null,
      suggestedWorkout: suggestion ? { id: suggestion.id, name: suggestion.name, durationMin: suggestion.durationMin, emoji: suggestion.coverEmoji, color: suggestion.coverColor } : null,
      unreadNotifications: me.notifications.filter((n) => !n.read).length,
    }
  }),
  layout: endpoint<void, HomeLayout, "employee">("employee", "GET", "/me/home-layout", (_i, ctx) => layoutView(ctx)),

  saveLayout: endpoint<{ cards: { key: HomeCardKey; visible: boolean }[] }, HomeLayout, "employee">("employee", "PUT", "/me/home-layout", ({ cards }, ctx) => {
    const known = new Set<string>(DEFAULT_ORDER)
    const keys = cards.map((c) => c.key)
    if (keys.some((k) => !known.has(k)) || new Set(keys).size !== keys.length) throw badRequest("Couldn't save your layout.")
    const hiddenMandatory = cards.find((c) => !c.visible && HOME_CARDS.find((d) => d.key === c.key)?.mandatory)
    if (hiddenMandatory) throw badRequest(`${HOME_CARDS.find((d) => d.key === hiddenMandatory.key)!.label} can't be hidden.`)
    const me = ctx.me()
    const order = [...keys, ...DEFAULT_ORDER.filter((k) => !keys.includes(k))]
    const hidden = cards.filter((c) => !c.visible).map((c) => c.key)
    layoutStore(ctx)[me.employeeId] = { order, hidden }
    me.homeCards = order.filter((k) => !hidden.includes(k))
    ctx.save()
    return layoutView(ctx)
  }),

  resetLayout: endpoint<void, HomeLayout, "employee">("employee", "DELETE", "/me/home-layout", (_i, ctx) => {
    const me = ctx.me()
    delete layoutStore(ctx)[me.employeeId]
    me.homeCards = [...DEFAULT_ORDER]
    ctx.save()
    return layoutView(ctx)
  }),
}
