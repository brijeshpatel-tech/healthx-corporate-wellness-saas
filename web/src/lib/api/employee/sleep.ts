/** Employee app — sleep tracking (SCR-M-027, SCR-M-028 — Phase 2). Sensitive, own data only. */
import type { SleepRecord } from "@/lib/types"
import { DAY_MS, toLocalDate } from "@/lib/mock/series"
import { badRequest, endpoint, forbidden, newId, notFound, type MockContext } from "../core"

export interface SleepNight {
  /** Night of (the evening's local date). */
  nightOf: string
  record: SleepRecord | null
}

export interface SleepSummary {
  weekStart: string
  weekEnd: string
  isCurrentWeek: boolean
  goalHours: number
  nights: SleepNight[]
  lastNight: SleepRecord | null
  avgDurationMin: number | null
  avgScore: number | null
  consistency: { label: "Great" | "Good" | "Irregular" | "Not enough data"; spreadMin: number | null }
  goalMetNights: number
  source: string | null
  hasAnyData: boolean
}

export interface SleepInput {
  /** Evening date the night starts (YYYY-MM-DD). */
  nightOf: string
  /** HH:mm */
  bedtime: string
  /** HH:mm */
  wakeTime: string
  quality: 1 | 2 | 3 | 4 | 5
}

type Ctx = MockContext<"employee">

const SOURCE_LABEL: Record<SleepRecord["source"], string> = { manual: "Logged manually", apple_health: "Apple Health", health_connect: "Health Connect" }

/** Night of = wake-up date minus one day. */
const nightOfRecord = (r: SleepRecord) => toLocalDate(new Date(new Date(`${r.date}T12:00:00`).getTime() - DAY_MS))

const minutesOfDay = (iso: string) => {
  const d = new Date(iso)
  // Shift so evening times (e.g. 23:00) and after-midnight (00:30) are comparable.
  const m = d.getHours() * 60 + d.getMinutes()
  return m < 12 * 60 ? m + 24 * 60 : m
}

/** Sleep score (TBC formula): duration vs goal (80%) + quality (20%). */
export const sleepScore = (durationMin: number, quality: number, goalHours: number) =>
  Math.max(0, Math.min(100, Math.round(Math.min(1, durationMin / (goalHours * 60)) * 80 + (quality / 5) * 20)))

function buildTimes(input: SleepInput) {
  const errors: Record<string, string> = {}
  const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.nightOf)) errors.nightOf = "Choose the night"
  if (!hhmm.test(input.bedtime)) errors.bedtime = "Enter your bedtime"
  if (!hhmm.test(input.wakeTime)) errors.wakeTime = "Enter your wake-up time"
  if (![1, 2, 3, 4, 5].includes(input.quality)) errors.quality = "Rate your sleep"
  if (Object.keys(errors).length) throw badRequest(Object.values(errors)[0]!, errors)
  const night = new Date(`${input.nightOf}T00:00:00`)
  const [bh, bm] = input.bedtime.split(":").map(Number) as [number, number]
  const [wh, wm] = input.wakeTime.split(":").map(Number) as [number, number]
  // Bedtimes before noon belong to the early hours after midnight.
  const bed = new Date(night.getTime() + (bh < 12 ? DAY_MS : 0))
  bed.setHours(bh, bm, 0, 0)
  let wake = new Date(bed)
  wake.setHours(wh, wm, 0, 0)
  if (wake.getTime() <= bed.getTime()) wake = new Date(wake.getTime() + DAY_MS)
  const durationMin = Math.round((wake.getTime() - bed.getTime()) / 60_000)
  if (durationMin < 60 || durationMin > 16 * 60) throw badRequest("Sleep must be between 1 and 16 hours. Check your bedtime and wake-up time.", { wakeTime: "Wake-up time must be after bedtime (1–16 h)" })
  if (wake.getTime() > Date.now() + 5 * 60_000) throw badRequest("Wake-up time can't be in the future.", { wakeTime: "Can't be in the future" })
  return { bed, wake, durationMin }
}

function summary(ctx: Ctx, weekStart?: string): SleepSummary {
  const me = ctx.me()
  const goal = me.profile.sleepGoalHours || 8
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Week = 7 nights ending last night (or the selected week starting on weekStart).
  const start = weekStart ? new Date(`${weekStart}T00:00:00`) : new Date(today.getTime() - 7 * DAY_MS)
  const nights: SleepNight[] = Array.from({ length: 7 }, (_, i) => {
    const nightOf = toLocalDate(new Date(start.getTime() + i * DAY_MS))
    return { nightOf, record: me.sleep.find((r) => nightOfRecord(r) === nightOf) ?? null }
  })
  const recs = nights.map((n) => n.record).filter((r): r is SleepRecord => !!r)
  const sorted = [...me.sleep].sort((a, b) => a.wakeTime.localeCompare(b.wakeTime))
  const lastNight = sorted[sorted.length - 1] ?? null
  let consistency: SleepSummary["consistency"] = { label: "Not enough data", spreadMin: null }
  if (recs.length >= 3) {
    const beds = recs.map((r) => minutesOfDay(r.bedtime))
    const mean = beds.reduce((a, b) => a + b, 0) / beds.length
    const sd = Math.round(Math.sqrt(beds.reduce((a, b) => a + (b - mean) ** 2, 0) / beds.length))
    consistency = { label: sd <= 30 ? "Great" : sd <= 60 ? "Good" : "Irregular", spreadMin: sd }
  }
  const end = toLocalDate(new Date(start.getTime() + 6 * DAY_MS))
  return {
    weekStart: toLocalDate(start),
    weekEnd: end,
    isCurrentWeek: end >= toLocalDate(new Date(today.getTime() - DAY_MS)),
    goalHours: goal,
    nights,
    lastNight,
    avgDurationMin: recs.length ? Math.round(recs.reduce((a, r) => a + r.durationMin, 0) / recs.length) : null,
    avgScore: recs.length ? Math.round(recs.reduce((a, r) => a + r.score, 0) / recs.length) : null,
    consistency,
    goalMetNights: recs.filter((r) => r.durationMin >= goal * 60).length,
    source: lastNight ? SOURCE_LABEL[lastNight.source] : null,
    hasAnyData: me.sleep.length > 0,
  }
}

export const sleepApi = {
  summary: endpoint<{ weekStart?: string }, SleepSummary, "employee">("employee", "GET", "/me/sleep/summary", ({ weekStart }, ctx) => summary(ctx, weekStart)),

  get: endpoint<{ id: string }, SleepRecord & { nightOf: string }, "employee">("employee", "GET", "/me/sleep/:id", ({ id }, ctx) => {
    const rec = ctx.me().sleep.find((r) => r.id === id)
    if (!rec) throw notFound("Sleep record")
    return { ...rec, nightOf: nightOfRecord(rec) }
  }),

  create: endpoint<SleepInput, SleepRecord, "employee">("employee", "POST", "/me/sleep", (input, ctx) => {
    const me = ctx.me()
    const { bed, wake, durationMin } = buildTimes(input)
    if (me.sleep.some((r) => nightOfRecord(r) === input.nightOf)) throw badRequest("You already have sleep recorded for this night.", { nightOf: "Already recorded — edit that night instead" })
    const overlap = me.sleep.find((r) => new Date(r.bedtime) < wake && new Date(r.wakeTime) > bed)
    if (overlap) throw badRequest("This overlaps another sleep record.", { bedtime: "Overlaps another record" })
    const record: SleepRecord = {
      id: newId("slp"),
      date: toLocalDate(wake),
      bedtime: bed.toISOString(),
      wakeTime: wake.toISOString(),
      durationMin,
      quality: input.quality,
      source: "manual",
      score: sleepScore(durationMin, input.quality, me.profile.sleepGoalHours || 8),
    }
    me.sleep.push(record)
    me.sleep.sort((a, b) => a.wakeTime.localeCompare(b.wakeTime))
    ctx.save()
    return record
  }),

  update: endpoint<SleepInput & { id: string }, SleepRecord, "employee">("employee", "PATCH", "/me/sleep/:id", (input, ctx) => {
    const me = ctx.me()
    const rec = me.sleep.find((r) => r.id === input.id)
    if (!rec) throw notFound("Sleep record")
    if (rec.source !== "manual") throw forbidden("Synced sleep can't be edited here. Change it in your health app.")
    const { bed, wake, durationMin } = buildTimes(input)
    if (me.sleep.some((r) => r.id !== rec.id && nightOfRecord(r) === input.nightOf)) throw badRequest("You already have sleep recorded for this night.", { nightOf: "Already recorded" })
    Object.assign(rec, {
      date: toLocalDate(wake),
      bedtime: bed.toISOString(),
      wakeTime: wake.toISOString(),
      durationMin,
      quality: input.quality,
      score: sleepScore(durationMin, input.quality, me.profile.sleepGoalHours || 8),
    })
    ctx.save()
    return rec
  }),

  remove: endpoint<{ id: string }, { ok: true }, "employee">("employee", "DELETE", "/me/sleep/:id", ({ id }, ctx) => {
    const me = ctx.me()
    const rec = me.sleep.find((r) => r.id === id)
    if (!rec) throw notFound("Sleep record")
    if (rec.source !== "manual") throw forbidden("Synced sleep can't be deleted here. Remove it in your health app.")
    me.sleep = me.sleep.filter((r) => r.id !== id)
    ctx.save()
    return { ok: true }
  }),

  setGoal: endpoint<{ hours: number }, { goalHours: number }, "employee">("employee", "PUT", "/me/sleep/goal", ({ hours }, ctx) => {
    if (!Number.isFinite(hours) || hours < 4 || hours > 12) throw badRequest("Choose a sleep goal between 4 and 12 hours.", { hours: "4–12 hours" })
    const me = ctx.me()
    me.profile.sleepGoalHours = Math.round(hours * 2) / 2
    ctx.save()
    return { goalHours: me.profile.sleepGoalHours }
  }),
}

export { nightOfRecord }
