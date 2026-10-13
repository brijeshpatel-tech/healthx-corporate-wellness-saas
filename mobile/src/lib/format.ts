// AUTO-SYNCED from web/src/lib — edit in web/, then run npm run sync-shared
/** Display formatting helpers (Indian locale by default). */
import { format, formatDistanceToNowStrict, isToday, isYesterday, parseISO } from "date-fns"

const LOCALE = "en-IN"

export const formatNumber = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined || Number.isNaN(value)
    ? "—"
    : value.toLocaleString(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: 0 })

/** 1.2K, 3.4M — for tiles and charts. */
export const formatCompact = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value)

export const formatCurrency = (value: number, currency: "INR" | "USD" = "INR", compact = false) =>
  new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
  }).format(value)

export const formatPercent = (ratio: number | null | undefined, digits = 0) =>
  ratio === null || ratio === undefined || Number.isNaN(ratio) ? "—" : `${(ratio * 100).toFixed(digits)}%`

export const formatPoints = (value: number) => `${formatNumber(value)} pts`

const toDate = (value: string | Date) => (typeof value === "string" ? parseISO(value) : value)

export const formatDate = (value?: string | Date | null, pattern = "d MMM yyyy") => (value ? format(toDate(value), pattern) : "—")
export const formatShortDate = (value?: string | Date | null) => formatDate(value, "d MMM")
export const formatDateTime = (value?: string | Date | null) => formatDate(value, "d MMM yyyy, h:mm a")
export const formatTime = (value?: string | Date | null) => formatDate(value, "h:mm a")

/** "5 min ago", "Yesterday, 4:10 PM", "12 Oct" */
export const formatRelative = (value?: string | Date | null) => {
  if (!value) return "—"
  const d = toDate(value)
  const diff = Date.now() - d.getTime()
  if (diff >= 0 && diff < 60_000) return "Just now"
  if (diff < 0) return `in ${formatDistanceToNowStrict(d)}`
  if (isToday(d)) return `${formatDistanceToNowStrict(d)} ago`
  if (isYesterday(d)) return `Yesterday, ${format(d, "h:mm a")}`
  if (diff < 6 * 86_400_000) return format(d, "EEE, h:mm a")
  return format(d, d.getFullYear() === new Date().getFullYear() ? "d MMM" : "d MMM yyyy")
}

export const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (!h) return `${m} min`
  return m ? `${h}h ${m}m` : `${h}h`
}

export const formatDistanceKm = (km: number) => `${formatNumber(km, 1)} km`
export const formatMl = (ml: number) => (ml >= 1000 ? `${formatNumber(ml / 1000, 2)} L` : `${formatNumber(ml)} ml`)

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")

export const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`

/** Leaderboard name according to the company's privacy setting. */
export const displayName = (
  p: { firstName: string; lastName: string },
  mode: "full_name" | "first_name_initial" | "anonymous",
  fallback = "Colleague",
) => (mode === "full_name" ? fullName(p) : mode === "first_name_initial" ? `${p.firstName} ${p.lastName[0]}.` : fallback)

export const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${formatNumber(count)} ${count === 1 ? singular : plural}`

export const titleCase = (value: string) => value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

/** Days between two YYYY-MM-DD dates (inclusive of start, exclusive of end). */
export const daysBetween = (start: string, end: string) => Math.round((parseISO(end).getTime() - parseISO(start).getTime()) / 86_400_000)
