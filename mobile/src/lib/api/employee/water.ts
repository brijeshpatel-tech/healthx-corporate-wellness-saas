// AUTO-SYNCED from web/src/lib — edit in web/, then run npm run sync-shared
/** Employee app — water / hydration (SCR-M-025, SCR-M-026). Own data only. */
import type { WaterLog, WaterSettings } from "@/lib/types"
import { toLocalDate } from "@/lib/mock/series"
import { badRequest, endpoint, newId, notFound, type MockContext } from "../core"
import { awardPoints, pointsEarnedToday } from "./activity"

export interface WaterToday {
  date: string
  totalMl: number
  goalMl: number
  logs: WaterLog[]
  streakDays: number
  history: { date: string; totalMl: number; goalMl: number }[]
  settings: WaterSettings
  /** Points for reaching the daily goal (0 when the rule is off). */
  goalPoints: number
  /** Points already earned from water today. */
  pointsToday: number
}

/** Daily total that counts towards points (ASSUMPTION: capped at 10 L). */
const POINTS_TOTAL_CAP_ML = 10_000

function syncToday(ctx: MockContext<"employee">) {
  const me = ctx.me()
  const today = toLocalDate(new Date())
  const todays = me.water.filter((w) => toLocalDate(new Date(w.at)) === today)
  const total = todays.reduce((a, w) => a + w.amountMl, 0)
  const row = me.waterDaily.find((d) => d.date === today)
  if (row) {
    row.totalMl = total
    row.goalMl = me.waterSettings.goalMl
  } else me.waterDaily.push({ date: today, totalMl: total, goalMl: me.waterSettings.goalMl })
  return { me, today, todays, total }
}

function snapshot(ctx: MockContext<"employee">): WaterToday {
  const { me, today, todays, total } = syncToday(ctx)
  let streak = 0
  const hist = [...me.waterDaily].sort((a, b) => a.date.localeCompare(b.date))
  for (let i = hist.length - (total >= me.waterSettings.goalMl ? 1 : 2); i >= 0 && hist[i]!.totalMl >= hist[i]!.goalMl; i--) streak++
  const rule = ctx.db.pointsRules.find((r) => r.eventType === "water")
  return {
    date: today,
    totalMl: total,
    goalMl: me.waterSettings.goalMl,
    logs: [...todays].sort((a, b) => b.at.localeCompare(a.at)),
    streakDays: streak,
    history: hist.slice(-30),
    settings: me.waterSettings,
    goalPoints: rule?.active ? rule.points : 0,
    pointsToday: pointsEarnedToday(ctx, "water"),
  }
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export const waterApi = {
  today: endpoint<void, WaterToday, "employee">("employee", "GET", "/me/water/today", (_i, ctx) => snapshot(ctx)),

  add: endpoint<{ amountMl: number; at?: string }, WaterToday & { pointsEarned: number }, "employee">("employee", "POST", "/me/water", ({ amountMl, at }, ctx) => {
    if (!amountMl || amountMl < 50 || amountMl > 2000) throw badRequest("Enter an amount between 50 ml and 2,000 ml.", { amountMl: "50–2,000 ml" })
    if (at && new Date(at).getTime() > Date.now() + 60_000) throw badRequest("You can't log water in the future.", { at: "Time can't be in the future" })
    const before = snapshot(ctx).totalMl
    const me = ctx.me()
    me.water.push({ id: newId("wat"), amountMl, at: at ?? new Date().toISOString() })
    const after = snapshot(ctx)
    let pointsEarned = 0
    // Goal points once a day (the rule's daily cap prevents a second award after delete + re-add).
    if (before < after.goalMl && after.totalMl >= after.goalMl && before < POINTS_TOTAL_CAP_ML) {
      pointsEarned = awardPoints(ctx, "water", "Hit daily water goal")
    }
    ctx.save()
    return { ...snapshot(ctx), pointsEarned }
  }),

  remove: endpoint<{ id: string }, WaterToday, "employee">("employee", "DELETE", "/me/water/:id", ({ id }, ctx) => {
    const me = ctx.me()
    if (!me.water.some((w) => w.id === id)) throw notFound("Water entry")
    me.water = me.water.filter((w) => w.id !== id)
    ctx.save()
    return snapshot(ctx)
  }),

  update: endpoint<{ id: string; amountMl: number }, WaterToday, "employee">("employee", "PATCH", "/me/water/:id", ({ id, amountMl }, ctx) => {
    const log = ctx.me().water.find((w) => w.id === id)
    if (!log) throw notFound("Water entry")
    if (!amountMl || amountMl < 50 || amountMl > 2000) throw badRequest("Enter an amount between 50 ml and 2,000 ml.", { amountMl: "50–2,000 ml" })
    log.amountMl = amountMl
    ctx.save()
    return snapshot(ctx)
  }),

  updateSettings: endpoint<Partial<WaterSettings>, WaterSettings, "employee">("employee", "PUT", "/me/water/settings", (patch, ctx) => {
    const me = ctx.me()
    const errors: Record<string, string> = {}
    if (patch.goalMl !== undefined && (patch.goalMl < 1000 || patch.goalMl > 5000 || patch.goalMl % 100 !== 0)) errors.goalMl = "Choose a goal between 1 and 5 litres."
    if (patch.reminderStart !== undefined && !HHMM.test(patch.reminderStart)) errors.reminderStart = "Enter a valid time"
    if (patch.reminderEnd !== undefined && !HHMM.test(patch.reminderEnd)) errors.reminderEnd = "Enter a valid time"
    const start = patch.reminderStart ?? me.waterSettings.reminderStart
    const end = patch.reminderEnd ?? me.waterSettings.reminderEnd
    if ((patch.remindersEnabled ?? me.waterSettings.remindersEnabled) && !errors.reminderEnd && end <= start) errors.reminderEnd = "End time must be after start time"
    if (patch.reminderEveryMin !== undefined && (patch.reminderEveryMin < 30 || patch.reminderEveryMin > 240)) errors.reminderEveryMin = "Choose an interval between 30 minutes and 4 hours"
    if (Object.keys(errors).length) throw badRequest(Object.values(errors)[0]!, errors)
    me.waterSettings = { ...me.waterSettings, ...patch }
    if (patch.goalMl) me.profile.dailyWaterGoalMl = patch.goalMl
    if (patch.remindersEnabled !== undefined) me.notificationPreferences.waterReminders = patch.remindersEnabled
    syncToday(ctx)
    ctx.save()
    return me.waterSettings
  }),
}
