import type { HabitUnit, TodayHabit } from "@/lib/api/employee/habits"
import { formatNumber } from "@/lib/format"

export const UNIT_LABEL: Record<HabitUnit, string> = { steps: "steps", glasses: "glasses", hours: "hours", minutes: "min", times: "times", check: "" }

export const AUTO_LABEL: Record<NonNullable<TodayHabit["auto"]>, string> = { steps: "From your steps", water: "From water log", sleep: "From sleep", workout: "From workouts" }

/** "2/3 times", "6,240/10,000 steps", "Done" */
export function habitProgressText(h: Pick<TodayHabit, "unit" | "value" | "target" | "done">) {
  if (h.unit === "check") return h.done ? "Done" : "Not yet"
  const v = h.unit === "hours" ? formatNumber(h.value, 1) : formatNumber(h.value)
  return `${v}/${formatNumber(h.target)} ${UNIT_LABEL[h.unit]}`.trim()
}

export function targetText(unit: HabitUnit, target: number) {
  if (unit === "check") return "Once a day"
  return `${formatNumber(target, unit === "hours" ? 1 : 0)} ${UNIT_LABEL[unit]} a day`
}

export const HABIT_CATEGORY_LABEL: Record<string, string> = {
  movement: "Movement",
  hydration: "Hydration",
  sleep: "Sleep",
  mindfulness: "Mindfulness",
  nutrition: "Nutrition",
  productivity: "Focus & productivity",
}

/** Where the points for a linked habit come from (decision #19 — no double points). */
export const POINTS_VIA_LABEL: Record<NonNullable<TodayHabit["pointsVia"]>, string> = {
  steps: "Points via your steps",
  water: "Points via your water goal",
  workout: "Points via workouts",
  meditation: "Points via meditation",
}
