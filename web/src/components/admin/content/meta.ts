/** Labels and option lists shared by the wellness-content admin screens. */
import type { ContentItem, ContentType, FitnessLevel, HabitDefinition, Workout } from "@/lib/types"
import type { GoalMetric, TemplateStatus } from "@/lib/api/platform/programs"
import { formatNumber } from "@/lib/format"

export const LEVEL_LABEL: Record<FitnessLevel, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" }
export const LEVEL_OPTIONS = (Object.keys(LEVEL_LABEL) as FitnessLevel[]).map((value) => ({ value, label: LEVEL_LABEL[value] }))
/** Number of filled bars in the level meter. */
export const LEVEL_BARS: Record<FitnessLevel, number> = { beginner: 1, intermediate: 2, advanced: 3 }

export const LOCATION_LABEL: Record<Workout["location"], string> = { home: "Home", gym: "Gym", outdoor: "Outdoor", office: "Office" }
export const LOCATION_ICON: Record<Workout["location"], string> = { home: "🏠", gym: "🏋️", outdoor: "🌳", office: "🏢" }
export const LOCATION_OPTIONS = (Object.keys(LOCATION_LABEL) as Workout["location"][]).map((value) => ({ value, label: LOCATION_LABEL[value] }))

export const WORKOUT_STATUS_OPTIONS = [
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
]

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = { article: "Article", video: "Video", tip: "Tip", link: "Link" }
export const CONTENT_TYPE_OPTIONS = (Object.keys(CONTENT_TYPE_LABEL) as ContentType[]).map((value) => ({ value, label: CONTENT_TYPE_LABEL[value] }))

export const CONTENT_CATEGORY_LABEL: Record<ContentItem["category"], string> = {
  movement: "Movement",
  nutrition: "Nutrition",
  sleep: "Sleep",
  mindfulness: "Mindfulness",
  hydration: "Hydration",
  general: "General wellbeing",
}
export const CONTENT_CATEGORY_OPTIONS = (Object.keys(CONTENT_CATEGORY_LABEL) as ContentItem["category"][]).map((value) => ({ value, label: CONTENT_CATEGORY_LABEL[value] }))

export const CONTENT_STATUS_OPTIONS = [
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Unpublished" },
]
/** Content "archived" is shown as "Unpublished". */
export const contentStatusLabel = (s: ContentItem["status"]) => (s === "archived" ? "Unpublished" : s === "published" ? "Published" : "Draft")

export const HABIT_CATEGORY_LABEL: Record<HabitDefinition["category"], string> = {
  movement: "Movement",
  hydration: "Hydration",
  sleep: "Sleep",
  mindfulness: "Mindfulness",
  nutrition: "Nutrition",
  productivity: "Productivity",
}
export const HABIT_CATEGORY_OPTIONS = (Object.keys(HABIT_CATEGORY_LABEL) as HabitDefinition["category"][]).map((value) => ({ value, label: HABIT_CATEGORY_LABEL[value] }))

export const HABIT_UNIT_LABEL: Record<HabitDefinition["unit"], string> = {
  times: "Times",
  minutes: "Minutes",
  glasses: "Glasses",
  hours: "Hours",
  steps: "Steps",
  check: "Yes / no",
}
export const HABIT_UNIT_OPTIONS = (Object.keys(HABIT_UNIT_LABEL) as HabitDefinition["unit"][]).map((value) => ({ value, label: HABIT_UNIT_LABEL[value] }))

/** "8 glasses", "10,000 steps", "Done once". */
export function habitTargetLabel(target: number, unit: HabitDefinition["unit"]) {
  if (unit === "check") return "Done (yes / no)"
  const word = unit === "times" ? (target === 1 ? "time" : "times") : unit === "hours" && target === 1 ? "hour" : unit === "minutes" && target === 1 ? "minute" : unit === "glasses" && target === 1 ? "glass" : unit
  return `${formatNumber(target, target % 1 ? 1 : 0)} ${word}`
}

export const HABIT_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Deactivated" },
]
export const habitStatusLabel = (s: HabitDefinition["status"]) => (s === "archived" ? "Deactivated" : s === "active" ? "Active" : "Draft")

export const AUTO_COMPLETE_LABEL: Record<NonNullable<HabitDefinition["autoCompleteFrom"]> | "none", string> = {
  none: "Manual check-in",
  steps: "Steps",
  water: "Water log",
  sleep: "Sleep log",
  workout: "Workout completed",
}
export const AUTO_COMPLETE_OPTIONS = (Object.keys(AUTO_COMPLETE_LABEL) as (keyof typeof AUTO_COMPLETE_LABEL)[]).map((value) => ({ value, label: AUTO_COMPLETE_LABEL[value] }))

export const GOAL_METRIC_LABEL: Record<GoalMetric, string> = {
  steps: "Steps",
  distance: "Distance (km)",
  calories: "Calories (kcal)",
  active_minutes: "Active minutes",
  workouts: "Workouts",
  water: "Water (ml)",
  meditation: "Meditation (min)",
  custom: "Check-ins",
  habit: "Habit days",
}
export const GOAL_METRIC_OPTIONS = (Object.keys(GOAL_METRIC_LABEL) as GoalMetric[]).map((value) => ({ value, label: GOAL_METRIC_LABEL[value] }))
export const GOAL_METRIC_UNIT: Record<GoalMetric, string> = {
  steps: "steps",
  distance: "km",
  calories: "kcal",
  active_minutes: "min",
  workouts: "workouts",
  water: "ml",
  meditation: "min",
  custom: "check-ins",
  habit: "days",
}

export const TEMPLATE_STATUS_LABEL: Record<TemplateStatus, string> = { active: "Published", draft: "Draft", archived: "Retired" }
export const TEMPLATE_STATUS_OPTIONS = (Object.keys(TEMPLATE_STATUS_LABEL) as TemplateStatus[]).map((value) => ({ value, label: TEMPLATE_STATUS_LABEL[value] }))

/** 75 → "1:15", 40 → "40 s". */
export function formatSeconds(totalSec: number) {
  const s = Math.max(0, Math.round(totalSec))
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m} min ${r} s` : `${m} min`
}
