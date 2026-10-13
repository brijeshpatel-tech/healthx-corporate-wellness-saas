/** Labels, emoji and icons for activity types and sources. */
import { Activity, Bike, Dumbbell, Footprints, Leaf, PersonStanding, Trophy, Waves, Zap, type LucideIcon } from "lucide-react-native"
import type { ActivitySession, ActivityType } from "@/lib/types"

export const ACTIVITY_META: Record<ActivityType, { label: string; emoji: string; icon: LucideIcon }> = {
  walking: { label: "Walking", emoji: "🚶", icon: Footprints },
  running: { label: "Running", emoji: "🏃", icon: Zap },
  cycling: { label: "Cycling", emoji: "🚴", icon: Bike },
  swimming: { label: "Swimming", emoji: "🏊", icon: Waves },
  yoga: { label: "Yoga", emoji: "🧘", icon: PersonStanding },
  meditation: { label: "Meditation", emoji: "🌿", icon: Leaf },
  strength: { label: "Workout", emoji: "🏋️", icon: Dumbbell },
  sports: { label: "Sports", emoji: "🏸", icon: Trophy },
  other: { label: "Other", emoji: "✨", icon: Activity },
}

export const SOURCE_LABEL: Record<ActivitySession["source"], string> = {
  apple_health: "Synced",
  health_connect: "Synced",
  workout: "Workout",
  manual: "Manual",
}
