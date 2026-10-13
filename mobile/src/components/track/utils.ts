/** Date / time helpers shared by the tracking screens (habits, sleep, workouts, nutrition). */
import { formatDate } from "@/lib/format"

const pad = (n: number) => String(n).padStart(2, "0")

/** Local YYYY-MM-DD (not UTC). */
export const localDate = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Adds n days to a YYYY-MM-DD date. */
export const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + n)
  return localDate(d)
}

/** "Today", "Yesterday" or "Mon, 12 Oct". */
export function dayLabel(date: string) {
  const today = localDate()
  if (date === today) return "Today"
  if (date === addDays(today, -1)) return "Yesterday"
  return formatDate(`${date}T12:00:00`, "EEE, d MMM")
}

/** 452 → "7h 32m". */
export const formatHM = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h ? `${h}h ${pad(m)}m` : `${m}m`
}

/** 75 → "1:15". */
export const formatClock = (sec: number) => `${Math.floor(sec / 60)}:${pad(Math.max(0, Math.floor(sec % 60)))}`

/** "2026-10" ± n months. */
export const shiftMonth = (m: string, n: number) => {
  const d = new Date(`${m}-15T12:00:00`)
  d.setMonth(d.getMonth() + n)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** "2026-10" → "October 2026". */
export const monthLabel = (m: string) => formatDate(`${m}-15T12:00:00`, "MMMM yyyy")

/** "07:30" ± minutes, wrapping around midnight. */
export const shiftTime = (hhmm: string, minutes: number) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number]
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

/** "23:00" → "11:00 PM". */
export const formatHHMM = (hhmm: string) => {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return hhmm
  const [h, m] = hhmm.split(":").map(Number) as [number, number]
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`
}

/** "07:30" from an ISO date (local time). */
export const toHHMM = (iso: string) => {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Masks typed digits as HH:MM. */
export const maskTime = (t: string) => {
  const d = t.replace(/\D/g, "").slice(0, 4)
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`
}

export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/** Adds alpha to a #rrggbb colour (cover colours from the API). */
export const withAlpha = (hex: string, alpha: number) => {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0")
  return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${a}` : hex
}
