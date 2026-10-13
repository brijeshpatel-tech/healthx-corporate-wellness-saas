import type { EmployeePreferences, WellnessProfile } from "@/lib/types"

export const GOAL_OPTIONS: { value: WellnessProfile["mainGoal"]; label: string; emoji: string; description: string }[] = [
  { value: "stay_active", label: "Stay active", emoji: "🏃", description: "Move more every day" },
  { value: "lose_weight", label: "Lose weight", emoji: "⚖️", description: "Reach a healthier weight" },
  { value: "build_strength", label: "Build strength", emoji: "💪", description: "Get fitter and stronger" },
  { value: "reduce_stress", label: "Reduce stress", emoji: "🧘", description: "Feel calmer and focused" },
  { value: "sleep_better", label: "Sleep better", emoji: "😴", description: "More rest, more energy" },
  { value: "eat_healthier", label: "Eat healthier", emoji: "🥗", description: "Build better food habits" },
]

export const ACTIVITY_LEVEL_OPTIONS: { value: WellnessProfile["activityLevel"]; label: string; description: string }[] = [
  { value: "sedentary", label: "Mostly sitting", description: "Desk job, little exercise" },
  { value: "light", label: "Lightly active", description: "Short walks, exercise 1–2× a week" },
  { value: "moderate", label: "Moderately active", description: "On your feet often, exercise 3–4× a week" },
  { value: "very_active", label: "Very active", description: "Hard exercise 5+ times a week" },
]

export const FITNESS_LEVEL_OPTIONS: { value: WellnessProfile["fitnessLevel"]; label: string; description: string }[] = [
  { value: "beginner", label: "Beginner", description: "Just getting started" },
  { value: "intermediate", label: "Intermediate", description: "Exercise regularly" },
  { value: "advanced", label: "Advanced", description: "Train hard and often" },
]

export const WORKOUT_LOCATION_OPTIONS: { value: EmployeePreferences["workoutLocation"]; label: string; emoji: string }[] = [
  { value: "home", label: "At home", emoji: "🏠" },
  { value: "gym", label: "At the gym", emoji: "🏋️" },
  { value: "outdoor", label: "Outdoors", emoji: "🌳" },
  { value: "any", label: "Anywhere", emoji: "✨" },
]

export const DURATION_OPTIONS: { value: string; label: string }[] = [
  { value: "10", label: "10 min" },
  { value: "20", label: "20 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
]

export const FOOD_OPTIONS: { value: EmployeePreferences["foodPreference"]; label: string; emoji: string }[] = [
  { value: "vegetarian", label: "Vegetarian", emoji: "🥦" },
  { value: "vegan", label: "Vegan", emoji: "🌱" },
  { value: "eggetarian", label: "Eggetarian", emoji: "🥚" },
  { value: "non_vegetarian", label: "Non-vegetarian", emoji: "🍗" },
  { value: "jain", label: "Jain", emoji: "🪷" },
  { value: "no_preference", label: "No preference", emoji: "🍽️" },
]

export const THEME_LABEL: Record<EmployeePreferences["theme"], string> = { system: "System", light: "Light", dark: "Dark" }

export const labelOf = <T extends string>(options: { value: T; label: string }[], value: T | undefined) => options.find((o) => o.value === value)?.label ?? "—"
