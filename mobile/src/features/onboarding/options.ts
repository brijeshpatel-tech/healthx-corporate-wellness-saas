/** Option lists for onboarding / profile forms (goal list and levels are TBC with the client). */
import type { WellnessGoal } from "@/lib/api/employee/onboarding"
import type { WellnessProfile } from "@/lib/types"

export const GOAL_OPTIONS: { value: WellnessGoal; label: string; emoji: string }[] = [
  { value: "stay_active", label: "Be more active", emoji: "🏃" },
  { value: "lose_weight", label: "Lose weight", emoji: "⚖️" },
  { value: "build_strength", label: "Build strength", emoji: "💪" },
  { value: "reduce_stress", label: "Reduce stress", emoji: "🧘" },
  { value: "sleep_better", label: "Sleep better", emoji: "😴" },
  { value: "eat_healthier", label: "Eat healthier", emoji: "🥗" },
]

export const ACTIVITY_LEVEL_OPTIONS: { value: WellnessProfile["activityLevel"]; label: string; description: string }[] = [
  { value: "sedentary", label: "Mostly sitting", description: "Desk job, little walking" },
  { value: "light", label: "Lightly active", description: "Some walking most days" },
  { value: "moderate", label: "Moderately active", description: "Exercise 2–4 times a week" },
  { value: "very_active", label: "Very active", description: "Exercise most days" },
]

export const FITNESS_LEVEL_OPTIONS: { value: WellnessProfile["fitnessLevel"]; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
]

/** "1990-04-23" ⇄ "23/04/1990" */
export const isoToDisplayDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "")
export function displayToIsoDate(display: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display.trim())
  if (!m) return null
  const iso = `${m[3]}-${m[2]}-${m[1]}`
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) || d.getDate() !== Number(m[1]) ? null : iso
}

/** Inserts slashes while typing a date: 2304 → 23/04 */
export function maskDate(input: string) {
  const digits = input.replace(/\D/g, "").slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}
