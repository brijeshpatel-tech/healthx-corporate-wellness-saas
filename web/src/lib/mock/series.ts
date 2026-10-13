/**
 * Date and series helpers for sample data. No faker dependency, so mock services
 * can use these without pulling the data generator into page bundles.
 */

export const AVATAR_COLORS = [
  "#10b981",
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
  "#6366f1",
  "#f97316",
  "#84cc16",
  "#06b6d4",
  "#a855f7",
] as const

export const COVER_COLORS = [
  "#10b981",
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#f43f5e",
  "#14b8a6",
  "#6366f1",
  "#f97316",
] as const

// ─── Dates ──────────────────────────────────────────────────────────────

export const DAY_MS = 86_400_000

export const startOfToday = (now = new Date()) => {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Local calendar date (YYYY-MM-DD) for a Date. */
export const toLocalDate = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export const daysAgo = (n: number, now = new Date()) => new Date(startOfToday(now).getTime() - n * DAY_MS)
export const daysFromNow = (n: number, now = new Date()) => new Date(startOfToday(now).getTime() + n * DAY_MS)
export const localDaysAgo = (n: number) => toLocalDate(daysAgo(n))
export const localDaysFromNow = (n: number) => toLocalDate(daysFromNow(n))

/** ISO timestamp on a given day ago at a given hour/minute (local time). */
export const isoAt = (daysAgoN: number, hour: number, minute = 0) => {
  const d = daysAgo(daysAgoN)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

// ─── Series ─────────────────────────────────────────────────────────────

/** Tiny hash so the same key always yields the same series. */
export const hash = (key: string) => {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.codePointAt(i) ?? 0
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Deterministic pseudo-random number in [0,1) for (key, index). Independent of faker state. */
export const noise = (key: string, index: number) => {
  let x = hash(`${key}:${index}`) || 1
  x ^= x << 13
  x ^= x >>> 17
  x ^= x << 5
  return ((x >>> 0) % 10_000) / 10_000
}

export interface SeriesOptions {
  base: number
  variance?: number // 0..1 relative swing
  trend?: number // total relative change from first to last point, e.g. 0.15 = +15%
  weekendDip?: number // 0..1 relative drop on Sat/Sun
  min?: number
  max?: number
  round?: number // decimals
}

/**
 * Deterministic daily series ending today (oldest → newest).
 * Use for analytics charts so numbers are realistic and stable.
 */
export function dailySeries(key: string, days: number, opts: SeriesOptions) {
  const { base, variance = 0.12, trend = 0, weekendDip = 0, min = 0, max = Number.POSITIVE_INFINITY, round = 0 } = opts
  const points: { date: string; value: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = daysAgo(i)
    const progress = days > 1 ? (days - 1 - i) / (days - 1) : 1
    const dow = date.getDay()
    const weekend = dow === 0 || dow === 6 ? 1 - weekendDip : 1
    const jitter = 1 + (noise(key, i) * 2 - 1) * variance
    const raw = base * (1 + trend * progress) * weekend * jitter
    const value = Math.min(max, Math.max(min, Number(raw.toFixed(round))))
    points.push({ date: toLocalDate(date), value })
  }
  return points
}
