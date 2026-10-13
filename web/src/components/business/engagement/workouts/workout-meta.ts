import { Building2, Dumbbell, Home, Trees, type LucideIcon } from "lucide-react"
import type { FitnessLevel, Workout } from "@/lib/types"

export const LEVEL_META: Record<FitnessLevel, { label: string; description: string; bars: 1 | 2 | 3 }> = {
  beginner: { label: "Beginner", description: "New to exercise or getting back into it", bars: 1 },
  intermediate: { label: "Intermediate", description: "Exercises a few times a week", bars: 2 },
  advanced: { label: "Advanced", description: "Fit and looking for a challenge", bars: 3 },
}

export const LOCATION_META: Record<Workout["location"], { label: string; icon: LucideIcon }> = {
  home: { label: "Home", icon: Home },
  gym: { label: "Gym", icon: Dumbbell },
  outdoor: { label: "Outdoor", icon: Trees },
  office: { label: "Office", icon: Building2 },
}

export const WORKOUT_EMOJIS = ["💪", "🏋️", "🔥", "⚡", "🧘", "🤸", "🏃", "🚴", "🦵", "🧱", "🪑", "🌅", "🌙", "⏱️", "🫁", "🎯", "❤️", "🌱", "🥊", "🏆"]

export const STATUS_LABEL: Record<Workout["status"], string> = { published: "Published", draft: "Draft", archived: "Archived" }

/** "45 s", "1 min", "1 min 30 s". */
export function formatSeconds(sec: number) {
  const s = Math.max(0, Math.round(sec))
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m} min ${r} s` : `${m} min`
}

export const capitalize = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s)
