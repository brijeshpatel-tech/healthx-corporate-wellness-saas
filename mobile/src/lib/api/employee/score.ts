// AUTO-SYNCED from web/src/lib — edit in web/, then run npm run sync-shared
/** Employee app — Wellness Score (SCR-M-019) and Weekly Wellness Summary (SCR-M-020). Own data only. */
import type { WellnessScoreWeights } from "@/lib/types"
import { DAY_MS, toLocalDate } from "@/lib/mock/series"
import { endpoint, type MockContext } from "../core"
import { companySettings } from "./activity"

export type ScoreComponentKey = keyof WellnessScoreWeights

export interface ScoreComponent {
  key: ScoreComponentKey
  label: string
  /** Weight in % (from the platform score configuration). */
  weight: number
  /** Component value 0–100. */
  value: number
  /** Points this component adds to the total (value × weight). */
  contribution: number
  /** Average over the selected period. */
  average: number
  phase: 1 | 2
  tip: string
  href: string
}

export interface WellnessScoreDetail {
  hasData: boolean
  date: string
  total: number
  change: number
  periodAverage: number
  best: { date: string; total: number } | null
  components: ScoreComponent[]
  history: { date: string; total: number }[]
  configVersion: number
  configUpdatedAt: string
}

const META: Record<ScoreComponentKey, { label: string; phase: 1 | 2; href: string; tips: [string, string] }> = {
  activity: { label: "Activity", phase: 1, href: "/employee-app/activity", tips: ["Add a 10-minute walk after lunch to close your step gap.", "Great movement this week — keep your daily step goal streak going."] },
  sleep: { label: "Sleep", phase: 2, href: "/employee-app/sleep", tips: ["Aim for a consistent bedtime, even on weekends.", "Your sleep is steady — a wind-down routine helps keep it that way."] },
  hydration: { label: "Hydration", phase: 1, href: "/employee-app/water", tips: ["Keep a bottle at your desk and log a glass every couple of hours.", "You're hydrating well — turn on smart reminders to stay on track."] },
  exercise: { label: "Exercise", phase: 1, href: "/employee-app/workouts", tips: ["Try a 10-minute workout — even short sessions count.", "Nice work on workouts — mix in strength and stretching."] },
  habits: { label: "Habits", phase: 1, href: "/employee-app/habits", tips: ["Pick one easy habit and tick it off every day.", "Your habits are on a roll — protect the streak!"] },
  mindfulness: { label: "Mindfulness", phase: 2, href: "/employee-app/workouts?category=Mindfulness", tips: ["A 5-minute breathing break can lower stress.", "Mindful minutes are paying off — keep a short daily practice."] },
}

const ORDER: ScoreComponentKey[] = ["activity", "sleep", "hydration", "exercise", "habits", "mindfulness"]

export interface WeeklySummaryDetail {
  weekStart: string
  weekEnd: string
  isCurrent: boolean
  workouts: number
  steps: number
  stepGoalDays: number
  hydrationGoalsHit: number
  activeDays: number
  avgSleepHours: number
  scoreChange: number
  highlights: string[]
  days: { date: string; steps: number; goal: number; waterMet: boolean; workout: boolean }[]
  insight: { opportunity: string; recommendation: string; actionLabel: string; actionHref: string; feedback: "helpful" | "not_helpful" | null } | null
}

export interface WeeklySummaryList {
  weeks: WeeklySummaryDetail[]
  aiInsights: { enabledByCompany: boolean; consented: boolean }
  nextSummaryOn: string
}

function actionFor(recommendation: string) {
  const r = recommendation.toLowerCase()
  if (r.includes("walk")) return { actionLabel: "Log a walk", actionHref: "/employee-app/activity/log" }
  if (r.includes("bottle") || r.includes("litre") || r.includes("water")) return { actionLabel: "Open water tracker", actionHref: "/employee-app/water" }
  if (r.includes("wind-down") || r.includes("sleep")) return { actionLabel: "Open sleep", actionHref: "/employee-app/sleep" }
  return { actionLabel: "Browse workouts", actionHref: "/employee-app/workouts" }
}

const feedbackStore = (ctx: MockContext<"employee">) => ctx.extra<Record<string, "helpful" | "not_helpful">>("emp-insight-feedback", () => ({}))

export const wellnessScoreApi = {
  get: endpoint<{ period: "7d" | "30d" }, WellnessScoreDetail, "employee">("employee", "GET", "/me/wellness-score", ({ period }, ctx) => {
    const me = ctx.me()
    const config = [...ctx.db.scoreConfigs].sort((a, b) => b.version - a.version)[0]
    const weights: WellnessScoreWeights = config?.weights ?? { activity: 25, sleep: 20, hydration: 15, exercise: 20, habits: 10, mindfulness: 10 }
    const days = period === "30d" ? 30 : 7
    const scores = [...me.scores].sort((a, b) => a.date.localeCompare(b.date))
    const withData = scores.filter((s) => s.total > 0)
    const latest = withData[withData.length - 1]
    if (!latest) {
      return { hasData: false, date: toLocalDate(new Date()), total: 0, change: 0, periodAverage: 0, best: null, components: [], history: [], configVersion: config?.version ?? 1, configUpdatedAt: config?.updatedAt ?? new Date().toISOString() }
    }
    const window = withData.slice(-days)
    const before = withData[withData.length - 1 - days] ?? withData[0]!
    const avg = (k: ScoreComponentKey) => Math.round(window.reduce((a, s) => a + s.components[k], 0) / window.length)
    const best = window.reduce((b, s) => (s.total > b.total ? s : b), window[0]!)
    return {
      hasData: true,
      date: latest.date,
      total: latest.total,
      change: latest.total - before.total,
      periodAverage: Math.round(window.reduce((a, s) => a + s.total, 0) / window.length),
      best: { date: best.date, total: best.total },
      components: ORDER.map((key) => {
        const value = latest.components[key]
        const m = META[key]
        return {
          key,
          label: m.label,
          weight: weights[key],
          value,
          contribution: Math.round((value * weights[key]) / 10) / 10,
          average: avg(key),
          phase: m.phase,
          tip: value >= 75 ? m.tips[1] : m.tips[0],
          href: m.href,
        }
      }),
      history: window.map((s) => ({ date: s.date, total: s.total })),
      configVersion: config?.version ?? 1,
      configUpdatedAt: config?.updatedAt ?? new Date().toISOString(),
    }
  }),
}

export const weeklySummaryApi = {
  list: endpoint<void, WeeklySummaryList, "employee">("employee", "GET", "/me/weekly-summary", (_i, ctx) => {
    const me = ctx.me()
    const settings = companySettings(ctx)
    const consented = me.consents.find((c) => c.key === "ai_personalisation")?.granted ?? false
    const feedback = feedbackStore(ctx)
    const today = toLocalDate(new Date())
    const weeks = [...me.weeklySummaries]
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
      .filter((w) => me.daily.some((d) => d.date >= w.weekStart && d.steps > 0))
      .map((w): WeeklySummaryDetail => {
        const start = new Date(`${w.weekStart}T00:00:00`)
        const dates = Array.from({ length: 7 }, (_, i) => toLocalDate(new Date(start.getTime() + i * DAY_MS)))
        const days = dates.map((date) => {
          const d = me.daily.find((x) => x.date === date)
          const water = me.waterDaily.find((x) => x.date === date)
          const workout = me.workoutSessions.some((s) => s.completed && toLocalDate(new Date(s.completedAt ?? s.startedAt)) === date)
          return { date, steps: d?.steps ?? 0, goal: me.profile.dailyStepGoal, waterMet: !!water && water.totalMl >= water.goalMl, workout }
        })
        const weekEnd = dates[6]!
        // Rule-based counts from the tracked data (MVP — no AI).
        const nights = me.sleep.filter((r) => r.date > w.weekStart && r.date <= toLocalDate(new Date(start.getTime() + 7 * DAY_MS)))
        const steps = days.reduce((a, d) => a + d.steps, 0)
        return {
          weekStart: w.weekStart,
          weekEnd,
          isCurrent: today >= w.weekStart && today <= weekEnd,
          workouts: me.workoutSessions.filter((x) => x.completed && dates.includes(toLocalDate(new Date(x.completedAt ?? x.startedAt)))).length,
          steps,
          stepGoalDays: days.filter((d) => d.steps >= d.goal).length,
          hydrationGoalsHit: days.filter((d) => d.waterMet).length,
          activeDays: days.filter((d) => d.steps >= 5000).length,
          avgSleepHours: nights.length ? Math.round((nights.reduce((a, r) => a + r.durationMin, 0) / nights.length / 60) * 10) / 10 : w.avgSleepHours,
          scoreChange: w.scoreChange,
          highlights: [`${steps.toLocaleString("en-IN")} steps`],
          days,
          insight: settings.aiInsightsEnabled && consented ? { opportunity: w.opportunity, recommendation: w.recommendation, ...actionFor(w.recommendation), feedback: feedback[w.weekStart] ?? null } : null,
        }
      })
    const next = new Date()
    next.setDate(next.getDate() + ((8 - next.getDay()) % 7 || 7))
    return { weeks, aiInsights: { enabledByCompany: settings.aiInsightsEnabled, consented }, nextSummaryOn: toLocalDate(next) }
  }),

  /** Turns on AI personalisation consent (FEAT-275) so Phase 2 insights can be shown. */
  enableAiInsights: endpoint<{ key: "ai_personalisation"; granted: boolean }, { ok: true }, "employee">("employee", "POST", "/me/consents", ({ granted }, ctx) => {
    const c = ctx.me().consents.find((x) => x.key === "ai_personalisation")
    if (c) {
      c.granted = granted
      c.updatedAt = new Date().toISOString()
    }
    ctx.save()
    return { ok: true }
  }),

  feedback: endpoint<{ weekStart: string; value: "helpful" | "not_helpful" }, { ok: true }, "employee">("employee", "POST", "/me/insights/weekly/feedback", ({ weekStart, value }, ctx) => {
    feedbackStore(ctx)[weekStart] = value
    ctx.save()
    return { ok: true }
  }),
}
