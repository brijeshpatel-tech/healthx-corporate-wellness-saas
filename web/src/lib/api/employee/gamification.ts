/**
 * Employee app — gamification: badges & streaks (SCR-M-050/051), points wallet & history (SCR-M-052/053).
 * Badge progress is re-evaluated from the employee's own data; a newly earned badge credits its
 * bonus points once and is celebrated once.
 */
import { DAY_MS, toLocalDate } from "@/lib/mock/series"
import type { Badge, BadgeRarity, Paginated, PointsSource, PointsTransaction } from "@/lib/types"
import { endpoint, newId, notFound, paginate, type MockContext } from "../core"
import { meEmployee } from "./challenges"

type Ctx = MockContext<"employee">

// ─── Types ──────────────────────────────────────────────────────────────

export interface BadgeView {
  id: string
  name: string
  description: string
  icon: string
  color: string
  criteria: string
  rarity: BadgeRarity
  points: number
  earned: boolean
  earnedAt: string | null
  progress: number
  current: number
  threshold: number
  progressLabel: string
  unseen: boolean
  earnedByCount: number
}

export interface StreakView {
  key: "activity" | "hydration" | "habits"
  label: string
  current: number
  best: number
  hint: string
}

export interface BadgesResult {
  badges: BadgeView[]
  earned: number
  total: number
  streaks: StreakView[]
  /** Newly unlocked badge to celebrate (shown once). */
  celebrate: BadgeView | null
}

export interface TxView extends PointsTransaction {
  sourceLabel: string
  reversed: boolean
  link: string | null
}

export interface WalletSummary {
  available: number
  lifetime: number
  redeemed: number
  adjustments: number
  earnedThisMonth: number
  openOrders: number
  recent: TxView[]
  weekly: { week: string; earned: number; spent: number }[]
  nextReward: { id: string; name: string; emoji: string; color: string; pointsCost: number; needMore: number } | null
}

export type TxFilter = "all" | "earned" | "spent"
export type TxRange = "all" | "7d" | "30d" | "month" | "custom"

// ─── Badges ─────────────────────────────────────────────────────────────

const OPENING_DESC = "Points earned before this period"

export const SOURCE_LABEL: Record<PointsSource, string> = {
  steps: "Steps",
  workout: "Workout",
  meditation: "Meditation",
  water: "Hydration",
  challenge: "Challenge",
  streak: "Streak bonus",
  badge: "Badge",
  habit: "Habit",
  manual_adjustment: "Adjustment",
  redemption: "Reward redeemed",
  refund: "Refund",
  expiry: "Expired",
}

const SOURCE_LINK: Partial<Record<PointsSource, string>> = {
  steps: "/employee-app/activity",
  workout: "/employee-app/workouts/history",
  meditation: "/employee-app/activity",
  water: "/employee-app/water",
  challenge: "/employee-app/challenges",
  streak: "/employee-app/badges",
  badge: "/employee-app/badges",
  habit: "/employee-app/habits",
  redemption: "/employee-app/orders",
  refund: "/employee-app/orders",
}

function seenStore(ctx: Ctx, employeeId: string, earnedIds: { id: string; at: string }[]) {
  const store = ctx.extra("emp-badge-seen", () => ({}) as Record<string, string[]>)
  if (!store[employeeId]) {
    // First visit: everything already earned counts as seen, except the latest unlock — celebrate that once.
    const sorted = [...earnedIds].sort((a, b) => b.at.localeCompare(a.at))
    store[employeeId] = sorted.slice(1).map((b) => b.id)
    ctx.save()
  }
  return store
}

function longestRun(values: boolean[]) {
  let best = 0
  let run = 0
  for (const v of values) {
    run = v ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

/** Current value toward a badge from the employee's own data (null = keep stored progress). */
function computeCurrent(ctx: Ctx, b: Badge): number | null {
  const { me, emp } = meEmployee(ctx)
  switch (b.criteriaType) {
    case "first_workout":
      return me.workoutSessions.filter((w) => w.completed).length
    case "streak":
      return emp.stats.currentStreak
    case "steps_total":
      // 90 days are kept on the device; earlier history is included in the lifetime total.
      return Math.round(me.daily.reduce((a, d) => a + d.steps, 0) * 2.2)
    case "water_goal":
      return me.waterDaily.filter((w) => w.totalMl >= w.goalMl).length
    case "early_activity":
      return new Set(me.sessions.filter((s) => new Date(s.startedAt).getHours() < 7).map((s) => toLocalDate(new Date(s.startedAt)))).size
    case "challenge":
      return b.id === "badge_challenge_champ" ? ctx.db.participants.filter((p) => p.employeeId === emp.id && p.completed).length : null
    case "custom":
      if (b.id === "badge_zen") return me.sessions.filter((s) => s.type === "meditation").reduce((a, s) => a + s.durationMin, 0)
      if (b.id === "badge_marathoner") {
        let best = 0
        for (let i = 0; i + 7 <= me.daily.length; i++) best = Math.max(best, me.daily.slice(i, i + 7).reduce((a, d) => a + d.distanceKm, 0))
        return Math.floor(best)
      }
      if (b.id === "badge_habit_builder") {
        const active = me.habits.filter((h) => h.active)
        if (!active.length) return 0
        const len = Math.min(...active.map((h) => h.history.length))
        let perfect = 0
        for (let i = 0; i < len; i++) if (active.every((h) => h.history[h.history.length - len + i]! >= h.target)) perfect++
        return perfect
      }
      return null
  }
}

function unitFor(b: Badge) {
  switch (b.criteriaType) {
    case "first_workout":
      return "workout"
    case "streak":
    case "water_goal":
    case "early_activity":
      return "days"
    case "steps_total":
      return "steps"
    case "challenge":
      return b.threshold === 1 ? "win" : "challenges"
    default:
      return b.id === "badge_zen" ? "min" : b.id === "badge_marathoner" ? "km" : "days"
  }
}

function creditPoints(ctx: Ctx, points: number, source: PointsSource, description: string) {
  const { me, emp } = meEmployee(ctx)
  if (points <= 0) return
  emp.stats.pointsBalance += points
  emp.stats.pointsLifetime += points
  emp.stats.pointsMonth += points
  me.transactions.unshift({ id: newId("ptx"), employeeId: emp.id, type: "earn", source, points, description, balanceAfter: emp.stats.pointsBalance, createdAt: new Date().toISOString() })
}

function evaluateBadges(ctx: Ctx): BadgesResult {
  const { me, emp } = meEmployee(ctx)
  const defs = ctx.db.badges.filter((b) => b.status === "active")
  let changed = false

  for (const def of defs) {
    let ub = me.badges.find((x) => x.badgeId === def.id)
    if (!ub) {
      ub = { badgeId: def.id, progress: 0 }
      me.badges.push(ub)
      changed = true
    }
    const current = computeCurrent(ctx, def)
    if (current !== null) {
      const p = Math.min(1, current / def.threshold)
      if (p > ub.progress + 1e-6) {
        ub.progress = p
        changed = true
      }
    }
    if (ub.progress >= 1 && !ub.earnedAt) {
      ub.earnedAt = new Date().toISOString()
      creditPoints(ctx, def.points, "badge", `Badge unlocked: ${def.name}`)
      emp.stats.badgesCount = me.badges.filter((b) => b.earnedAt).length
      me.notifications.unshift({ id: newId("ntf"), type: "badge", title: `Badge unlocked: ${def.name} ${def.icon}`, body: `${def.description}${def.points ? ` +${def.points} points.` : ""}`, createdAt: ub.earnedAt, read: false, href: "/employee-app/badges" })
      changed = true
    }
  }

  const earnedList = me.badges.filter((b) => b.earnedAt).map((b) => ({ id: b.badgeId, at: b.earnedAt! }))
  const seen = seenStore(ctx, emp.id, earnedList)[emp.id]!
  if (changed) ctx.save()

  const badges: BadgeView[] = defs.map((def) => {
    const ub = me.badges.find((x) => x.badgeId === def.id)!
    const current = Math.min(def.threshold, computeCurrent(ctx, def) ?? Math.round(ub.progress * def.threshold))
    const earned = !!ub.earnedAt
    const unit = unitFor(def)
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      icon: def.icon,
      color: def.color,
      criteria: def.criteria,
      rarity: def.rarity,
      points: def.points,
      earned,
      earnedAt: ub.earnedAt ?? null,
      progress: earned ? 1 : ub.progress,
      current: earned ? def.threshold : current,
      threshold: def.threshold,
      progressLabel: `${(earned ? def.threshold : current).toLocaleString("en-IN")} / ${def.threshold.toLocaleString("en-IN")} ${unit}`,
      unseen: earned && !seen.includes(def.id),
      earnedByCount: def.earnedCount,
    }
  })

  // Streaks
  const goal = me.profile.dailyStepGoal
  const activityBest = Math.max(emp.stats.currentStreak, longestRun(me.daily.map((d) => d.steps >= Math.min(goal, 5000))))
  const water = [...me.waterDaily].sort((a, b) => a.date.localeCompare(b.date))
  const today = toLocalDate(new Date())
  let hydration = 0
  for (let i = water.length - 1; i >= 0; i--) {
    const w = water[i]!
    if (w.totalMl >= w.goalMl) hydration++
    else if (w.date !== today) break
  }
  const habitsActive = me.habits.filter((h) => h.active)
  const streaks: StreakView[] = [
    { key: "activity", label: "Activity", current: emp.stats.currentStreak, best: activityBest, hint: "Days in a row you were active" },
    { key: "hydration", label: "Hydration", current: hydration, best: Math.max(hydration, longestRun(water.map((w) => w.totalMl >= w.goalMl))), hint: "Days in a row you hit your water goal" },
    { key: "habits", label: "Habits", current: Math.max(0, ...habitsActive.map((h) => h.currentStreak)), best: Math.max(0, ...habitsActive.map((h) => h.bestStreak)), hint: "Your longest-running daily habit" },
  ]

  const celebrate = badges.filter((b) => b.unseen).sort((a, b) => (b.earnedAt ?? "").localeCompare(a.earnedAt ?? ""))[0] ?? null
  return { badges, earned: badges.filter((b) => b.earned).length, total: badges.length, streaks, celebrate }
}

// ─── Wallet ─────────────────────────────────────────────────────────────

function toViews(list: PointsTransaction[]): TxView[] {
  // Pair refunds with the redemption they reverse (by reward name).
  const reversedIdx = new Set<number>()
  list.forEach((t, i) => {
    if (t.type !== "refund") return
    const name = t.description.replace(/^Refund:\s*/, "")
    const j = list.findIndex((x, k) => k > i && !reversedIdx.has(k) && x.type === "redeem" && x.description.replace(/^Redeemed:\s*/, "") === name)
    if (j >= 0) reversedIdx.add(j)
  })
  return list.map((t, i) => ({ ...t, sourceLabel: SOURCE_LABEL[t.source] ?? t.source, reversed: reversedIdx.has(i), link: SOURCE_LINK[t.source] ?? null }))
}

function isEarned(t: PointsTransaction) {
  return t.type === "earn" || (t.type === "adjust" && t.points > 0)
}

export const gamificationApi = {
  /** SCR-M-050 — badges (earned + locked with progress) and streaks. */
  badges: endpoint<void, BadgesResult, "employee">("employee", "GET", "/me/badges", (_i, ctx) => evaluateBadges(ctx)),

  /** SCR-M-051 — mark a badge celebration as seen (shown once per badge). */
  markBadgeSeen: endpoint<{ id: string }, { ok: true }, "employee">("employee", "POST", "/me/badges/:id/seen", ({ id }, ctx) => {
    const { me, emp } = meEmployee(ctx)
    if (!me.badges.some((b) => b.badgeId === id && b.earnedAt)) throw notFound("Badge")
    const store = seenStore(ctx, emp.id, [])
    if (!store[emp.id]!.includes(id)) store[emp.id]!.push(id)
    ctx.save()
    return { ok: true }
  }),

  /** SCR-M-052 — balances from the points ledger. Available = Lifetime − Redeemed ± adjustments. */
  wallet: endpoint<void, WalletSummary, "employee">("employee", "GET", "/me/wallet", (_i, ctx) => {
    const { me, emp } = meEmployee(ctx)
    const tx = me.transactions
    const redeemed = -tx.filter((t) => t.type === "redeem").reduce((a, t) => a + t.points, 0) - tx.filter((t) => t.type === "refund").reduce((a, t) => a + t.points, 0)
    const adjustments = tx.filter((t) => t.type === "adjust" || t.type === "expire").reduce((a, t) => a + t.points, 0)
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const weekly = Array.from({ length: 8 }, (_, i) => {
      const end = new Date()
      end.setHours(23, 59, 59, 999)
      const to = new Date(end.getTime() - (7 - i) * 7 * DAY_MS)
      const from = new Date(to.getTime() - 7 * DAY_MS)
      const inWeek = tx.filter((t) => t.description !== OPENING_DESC && new Date(t.createdAt) > from && new Date(t.createdAt) <= to)
      return {
        week: to.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        earned: inWeek.filter(isEarned).reduce((a, t) => a + t.points, 0),
        spent: -inWeek.filter((t) => t.type === "redeem").reduce((a, t) => a + t.points, 0),
      }
    })
    const hidden = new Set(ctx.db.rewardSettings[emp.companyId]?.hiddenGlobalRewardIds ?? [])
    const next = ctx.db.rewards
      .filter((r) => (r.companyId === null ? !hidden.has(r.id) : r.companyId === emp.companyId) && r.status === "active" && r.stock !== 0 && r.pointsCost > emp.stats.pointsBalance)
      .sort((a, b) => a.pointsCost - b.pointsCost)[0]
    return {
      available: emp.stats.pointsBalance,
      lifetime: emp.stats.pointsLifetime,
      redeemed,
      adjustments,
      earnedThisMonth: tx.filter((t) => isEarned(t) && t.description !== OPENING_DESC && new Date(t.createdAt) >= monthStart).reduce((a, t) => a + t.points, 0),
      openOrders: ctx.db.orders.filter((o) => o.employeeId === emp.id && ["pending_approval", "approved", "processing", "shipped"].includes(o.status)).length,
      recent: toViews(tx).slice(0, 8),
      weekly,
      nextReward: next ? { id: next.id, name: next.name, emoji: next.imageEmoji, color: next.imageColor, pointsCost: next.pointsCost, needMore: next.pointsCost - emp.stats.pointsBalance } : null,
    }
  }),

  /** SCR-M-053 — paginated ledger, newest first. */
  transactions: endpoint<{ type?: TxFilter; range?: TxRange; from?: string; to?: string; page?: number; pageSize?: number }, Paginated<TxView> & { totals: { earned: number; spent: number } }, "employee">(
    "employee",
    "GET",
    "/me/wallet/transactions",
    ({ type = "all", range = "all", page = 1, pageSize = 20, ...rest }, ctx) => {
      const { me } = meEmployee(ctx)
      let { from, to } = rest
      if (range !== "custom") {
        to = undefined
        const now = new Date()
        if (range === "7d") from = toLocalDate(new Date(now.getTime() - 6 * DAY_MS))
        else if (range === "30d") from = toLocalDate(new Date(now.getTime() - 29 * DAY_MS))
        else if (range === "month") from = toLocalDate(new Date(now.getFullYear(), now.getMonth(), 1))
        else from = undefined
      }
      const views = toViews(me.transactions).filter((t) => {
        const day = toLocalDate(new Date(t.createdAt))
        if (from && day < from) return false
        if (to && day > to) return false
        if (type === "earned") return isEarned(t)
        if (type === "spent") return !isEarned(t)
        return true
      })
      const totals = {
        earned: views.filter(isEarned).reduce((a, t) => a + t.points, 0),
        spent: -views.filter((t) => t.type === "redeem").reduce((a, t) => a + t.points, 0),
      }
      return { ...paginate(views, page, pageSize), totals }
    },
  ),
}
