import { Building2, Flag, HandHeart, Medal, User, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { formatCompact, formatMl, formatNumber } from "@/lib/format"
import type { ChallengeMetric, ChallengeStatus, ChallengeType } from "@/lib/types"

export const TYPE_META: Record<ChallengeType, { label: string; description: string; icon: LucideIcon }> = {
  individual: { label: "Individual goal", description: "Everyone works towards the same personal target.", icon: User },
  leaderboard: { label: "Leaderboard", description: "Highest total wins — rankings update daily.", icon: Medal },
  team: { label: "Team vs team", description: "Departments or teams compete on their average.", icon: Users },
  company: { label: "Company-wide", description: "One challenge for the whole company with personal targets.", icon: Building2 },
  collaborative: { label: "Collaborative", description: "Everyone adds to one shared company goal.", icon: HandHeart },
}

export const METRIC_META: Record<ChallengeMetric, { label: string; emoji: string; unit: string; step: number; dailyHint?: (perDay: number) => string }> = {
  steps: { label: "Steps", emoji: "👟", unit: "steps", step: 1000, dailyHint: (d) => `about ${formatNumber(Math.round(d / 100) * 100)} steps a day` },
  distance: { label: "Distance", emoji: "📍", unit: "km", step: 1, dailyHint: (d) => `about ${formatNumber(d, 1)} km a day` },
  calories: { label: "Active calories", emoji: "🔥", unit: "kcal", step: 100, dailyHint: (d) => `about ${formatNumber(Math.round(d))} kcal a day` },
  active_minutes: { label: "Active minutes", emoji: "⏱️", unit: "min", step: 10, dailyHint: (d) => `about ${formatNumber(Math.round(d))} active minutes a day` },
  workouts: { label: "Workouts", emoji: "🏋️", unit: "workouts", step: 1, dailyHint: (d) => `about ${formatNumber(d * 7, 1)} workouts a week` },
  water: { label: "Water", emoji: "💧", unit: "ml", step: 1000, dailyHint: (d) => `about ${formatMl(Math.round(d / 50) * 50)} a day` },
  meditation: { label: "Meditation", emoji: "🧘", unit: "min", step: 10, dailyHint: (d) => `about ${formatNumber(Math.round(d))} minutes a day` },
  custom: { label: "Custom check-in", emoji: "✅", unit: "check-ins", step: 1, dailyHint: (d) => `about ${formatNumber(d, 1)} check-ins a day` },
}

export const STATUS_ORDER: ChallengeStatus[] = ["active", "scheduled", "draft", "completed", "cancelled"]

export const STATUS_LABEL: Record<ChallengeStatus, string> = {
  active: "Active",
  scheduled: "Scheduled",
  draft: "Draft",
  completed: "Completed",
  cancelled: "Cancelled",
}

export const TeamIcon = Flag

export function metricUnit(metric: ChallengeMetric, customLabel?: string) {
  return metric === "custom" ? customLabel?.trim() || "check-ins" : METRIC_META[metric].unit
}

/** Formats a challenge value with its unit, e.g. "300,000 steps", "2.5 L", "42 km". */
export function formatMetricValue(value: number, metric: ChallengeMetric, customLabel?: string, compact = false) {
  if (metric === "water") return formatMl(value)
  const n = compact ? formatCompact(value) : formatNumber(value, metric === "distance" ? 1 : 0)
  return `${n} ${metricUnit(metric, customLabel)}`
}

export function typeLabel(type: ChallengeType, teamUnit?: "department" | "team") {
  if (type === "team") return teamUnit === "team" ? "Team vs team" : "Department vs department"
  return TYPE_META[type].label
}
