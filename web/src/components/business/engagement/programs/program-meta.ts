import { formatMl, formatNumber } from "@/lib/format"
import type { ProgramMetric, ProgramStatus } from "@/lib/api/business/programs"

export const PROGRAM_METRICS: ProgramMetric[] = ["steps", "distance", "calories", "active_minutes", "workouts", "water", "meditation", "habit"]

export const PROGRAM_METRIC_META: Record<ProgramMetric, { label: string; emoji: string; unit: string; defaultTarget: number; verb: (target: string) => string }> = {
  steps: { label: "Steps", emoji: "👟", unit: "steps", defaultTarget: 49000, verb: (t) => `Walk ${t} this week` },
  distance: { label: "Distance", emoji: "📍", unit: "km", defaultTarget: 20, verb: (t) => `Cover ${t} this week` },
  calories: { label: "Active calories", emoji: "🔥", unit: "kcal", defaultTarget: 2000, verb: (t) => `Burn ${t} of active calories` },
  active_minutes: { label: "Active minutes", emoji: "⏱️", unit: "min", defaultTarget: 150, verb: (t) => `Be active for ${t}` },
  workouts: { label: "Workouts", emoji: "🏋️", unit: "workouts", defaultTarget: 3, verb: (t) => `Complete ${t}` },
  water: { label: "Water", emoji: "💧", unit: "ml", defaultTarget: 14000, verb: (t) => `Drink ${t} this week` },
  meditation: { label: "Meditation", emoji: "🧘", unit: "min", defaultTarget: 50, verb: (t) => `Meditate for ${t}` },
  habit: { label: "Habit check-ins", emoji: "✅", unit: "days", defaultTarget: 5, verb: (t) => `Keep the habit on ${t}` },
  // Not offered in the goal builder; kept so older data still renders.
  custom: { label: "Custom check-in", emoji: "☑️", unit: "check-ins", defaultTarget: 5, verb: (t) => `Check in ${t}` },
}

/** "49,000 steps", "14 L", "3 workouts", "5 days". */
export function formatGoalTarget(target: number, metric: ProgramMetric) {
  if (!(target > 0)) return "—"
  if (metric === "water") return formatMl(target)
  const unit = PROGRAM_METRIC_META[metric]?.unit ?? ""
  const singular = target === 1 && unit.endsWith("s") ? unit.slice(0, -1) : unit
  return `${formatNumber(target, metric === "distance" ? 1 : 0)} ${singular}`
}

export const suggestGoalLabel = (target: number, metric: ProgramMetric) => (target > 0 ? PROGRAM_METRIC_META[metric].verb(formatGoalTarget(target, metric)) : "")

export const PROGRAM_STATUS_LABEL: Record<ProgramStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  active: "Active",
  completed: "Completed",
  archived: "Archived",
}

/** Next Monday (or today if it is Monday) as YYYY-MM-DD. */
export function nextMonday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const add = (8 - d.getDay()) % 7
  d.setDate(d.getDate() + (add === 0 ? 7 : add))
  return toYmd(d)
}

export const todayYmd = () => toYmd(new Date())

export function toYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function addDaysYmd(date: string, days: number) {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toYmd(d)
}

/** End date (inclusive) of a program that starts on `start` and runs for `weeks` weeks. */
export const programEnd = (start: string, weeks: number) => (start && weeks > 0 ? addDaysYmd(start, weeks * 7 - 1) : "")
