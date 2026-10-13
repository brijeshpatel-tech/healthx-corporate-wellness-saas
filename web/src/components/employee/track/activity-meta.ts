/** Labels, emoji and tones for activity types and habit units. */
import type { ActivityType, FitnessLevel, Workout } from "@/lib/types"
import type { Tone } from "./track-ui"

export const ACTIVITY_META: Record<ActivityType, { label: string; emoji: string; tone: Tone; hasDistance: boolean }> = {
  walking: { label: "Walking", emoji: "🚶", tone: "sky", hasDistance: true },
  running: { label: "Running", emoji: "🏃", tone: "orange", hasDistance: true },
  cycling: { label: "Cycling", emoji: "🚴", tone: "emerald", hasDistance: true },
  swimming: { label: "Swimming", emoji: "🏊", tone: "cyan", hasDistance: true },
  yoga: { label: "Yoga", emoji: "🧘", tone: "violet", hasDistance: false },
  meditation: { label: "Meditation", emoji: "🪷", tone: "teal", hasDistance: false },
  strength: { label: "Workout", emoji: "🏋️", tone: "indigo", hasDistance: false },
  sports: { label: "Sports", emoji: "🏸", tone: "amber", hasDistance: true },
  other: { label: "Other", emoji: "✨", tone: "slate", hasDistance: true },
}

export const SOURCE_LABEL: Record<string, string> = {
  apple_health: "Synced · Apple Health",
  health_connect: "Synced · Health Connect",
  manual: "Manual",
  workout: "HealthX workout",
}

export const LEVEL_LABEL: Record<FitnessLevel, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" }

export const LOCATION_LABEL: Record<Workout["location"], string> = { home: "Home", gym: "Gym", outdoor: "Outdoor", office: "Office" }

export const EQUIPMENT_LABEL = (e: string) => (e === "none" ? "No equipment" : e.charAt(0).toUpperCase() + e.slice(1))

export const titleWord = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
