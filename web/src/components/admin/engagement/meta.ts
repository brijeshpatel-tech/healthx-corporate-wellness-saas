import {
  Activity,
  Building2,
  Droplets,
  Dumbbell,
  Gift,
  HandHeart,
  Heart,
  ListChecks,
  Medal,
  Moon,
  Package,
  Sparkles,
  Flower2,
  Ticket,
  User,
  Users,
  type LucideIcon,
} from "lucide-react"
import { formatCompact, formatMl, formatNumber } from "@/lib/format"
import type { BadgeRarity, ChallengeMetric, ChallengeTemplate, ChallengeType, OrderStatus, PointsSource, RewardDelivery, WellnessScoreWeights } from "@/lib/types"
import { CHALLENGE_METRIC_UNIT } from "@/lib/types"

export const ADMIN = "/admin-portal"

// ─── Challenge templates ────────────────────────────────────────────────

export const TEMPLATE_CATEGORY_META: Record<ChallengeTemplate["category"], { label: string; emoji: string }> = {
  movement: { label: "Movement", emoji: "👟" },
  hydration: { label: "Hydration", emoji: "💧" },
  mindfulness: { label: "Mindfulness", emoji: "🧘" },
  fitness: { label: "Fitness", emoji: "🏋️" },
  habits: { label: "Habits", emoji: "🌱" },
  team: { label: "Team", emoji: "🤝" },
}

export const CHALLENGE_TYPE_META: Record<ChallengeType, { label: string; description: string; icon: LucideIcon }> = {
  individual: { label: "Individual goal", description: "Everyone works towards the same personal target.", icon: User },
  leaderboard: { label: "Leaderboard", description: "Highest total wins — rankings update daily.", icon: Medal },
  team: { label: "Team vs team", description: "Departments or teams compete on their average.", icon: Users },
  company: { label: "Company-wide", description: "One challenge for the whole company with personal targets.", icon: Building2 },
  collaborative: { label: "Collaborative", description: "Everyone adds to one shared company goal.", icon: HandHeart },
}

export const METRIC_META: Record<ChallengeMetric, { label: string; emoji: string }> = {
  steps: { label: "Steps", emoji: "👟" },
  distance: { label: "Distance", emoji: "📍" },
  calories: { label: "Active calories", emoji: "🔥" },
  active_minutes: { label: "Active minutes", emoji: "⏱️" },
  workouts: { label: "Workouts", emoji: "🏋️" },
  water: { label: "Water", emoji: "💧" },
  meditation: { label: "Meditation", emoji: "🧘" },
  custom: { label: "Custom check-in", emoji: "✅" },
}

/** "300,000 steps", "42 L", "12 workouts" */
export function formatTarget(value: number, metric: ChallengeMetric, compact = false) {
  if (!Number.isFinite(value)) return "—"
  if (metric === "water") return formatMl(value)
  return `${compact ? formatCompact(value) : formatNumber(value, metric === "distance" ? 1 : 0)} ${CHALLENGE_METRIC_UNIT[metric]}`
}

export function dailyHint(value: number, days: number, metric: ChallengeMetric) {
  if (!Number.isFinite(value) || !Number.isFinite(days) || value <= 0 || days <= 0) return undefined
  const perDay = value / days
  if (metric === "water") return `about ${formatMl(Math.round(perDay / 50) * 50)} a day`
  if (metric === "workouts") return `about ${formatNumber(perDay * 7, 1)} workouts a week`
  return `about ${formatNumber(perDay, perDay < 10 ? 1 : 0)} ${CHALLENGE_METRIC_UNIT[metric]} a day`
}

// ─── Rewards ────────────────────────────────────────────────────────────

export const DELIVERY_META: Record<RewardDelivery, { label: string; description: string; icon: LucideIcon }> = {
  physical: { label: "Physical item", description: "Shipped to the employee's address.", icon: Package },
  digital_voucher: { label: "Digital voucher", description: "Code emailed to the employee.", icon: Ticket },
  experience: { label: "Experience", description: "Booking or pass for an activity.", icon: Sparkles },
  donation: { label: "Donation", description: "We donate on the employee's behalf.", icon: Heart },
  company_perk: { label: "Company perk", description: "Handled by the employee's company.", icon: Gift },
}

export const REWARD_STATUS_LABEL: Record<string, string> = { active: "Active", draft: "Draft", out_of_stock: "Out of stock", archived: "Inactive" }

// ─── Orders ─────────────────────────────────────────────────────────────

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_approval: "Awaiting company approval",
  approved: "Approved",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  rejected: "Rejected",
}

// ─── Badges ─────────────────────────────────────────────────────────────

export const RARITY_META: Record<BadgeRarity, { label: string; className: string }> = {
  common: { label: "Common", className: "bg-slate-500/12 text-slate-700 dark:text-slate-300" },
  rare: { label: "Rare", className: "bg-sky-500/12 text-sky-700 dark:text-sky-300" },
  epic: { label: "Epic", className: "bg-violet-500/14 text-violet-700 dark:text-violet-300" },
  legendary: { label: "Legendary", className: "bg-amber-500/16 text-amber-800 dark:text-amber-300" },
}

export const CRITERIA_META: Record<"first_workout" | "streak" | "steps_total" | "water_goal" | "early_activity" | "challenge" | "custom", { label: string; one: string; many: string }> = {
  first_workout: { label: "Workouts completed", one: "workout", many: "workouts" },
  streak: { label: "Active-day streak", one: "day in a row", many: "days in a row" },
  steps_total: { label: "Lifetime steps", one: "step", many: "steps" },
  water_goal: { label: "Water goal days", one: "day", many: "days" },
  early_activity: { label: "Early activity days", one: "day", many: "days" },
  challenge: { label: "Challenges completed", one: "challenge", many: "challenges" },
  custom: { label: "Custom", one: "", many: "" },
}

/** "Active-day streak · 7 days in a row" */
export function criteriaSummary(b: { criteriaType: keyof typeof CRITERIA_META; threshold: number }) {
  const m = CRITERIA_META[b.criteriaType]
  if (b.criteriaType === "custom") return `Custom rule · target ${formatNumber(b.threshold)}`
  return `${m.label} · ${formatNumber(b.threshold)} ${b.threshold === 1 ? m.one : m.many}`
}

// ─── Points ─────────────────────────────────────────────────────────────

/** Points events shown in the admin. (No "expiry" — client decision #14: points never expire.) */
export const POINTS_SOURCE_META: Record<Exclude<PointsSource, "expiry">, { label: string; emoji: string }> = {
  steps: { label: "Steps synced", emoji: "👟" },
  workout: { label: "Workout completed", emoji: "🏋️" },
  meditation: { label: "Meditation logged", emoji: "🧘" },
  water: { label: "Water goal reached", emoji: "💧" },
  challenge: { label: "Challenge completed", emoji: "🏆" },
  streak: { label: "Streak reached", emoji: "🔥" },
  badge: { label: "Badge unlocked", emoji: "🏅" },
  habit: { label: "Habit completed", emoji: "✅" },
  manual_adjustment: { label: "Manual adjustment", emoji: "✏️" },
  redemption: { label: "Reward redeemed", emoji: "🎁" },
  refund: { label: "Refund", emoji: "↩️" },
}

export const pointsSourceMeta = (source: PointsSource) => (source === "expiry" ? { label: "Other", emoji: "⭐" } : POINTS_SOURCE_META[source])

// ─── Wellness score ─────────────────────────────────────────────────────

export const SCORE_COMPONENT_META: Record<keyof WellnessScoreWeights, { label: string; description: string; icon: LucideIcon; color: string }> = {
  activity: { label: "Activity", description: "Steps and active minutes vs goal", icon: Activity, color: "var(--chart-1)" },
  sleep: { label: "Sleep", description: "Hours and consistency of sleep", icon: Moon, color: "var(--chart-2)" },
  hydration: { label: "Hydration", description: "Water logged vs daily goal", icon: Droplets, color: "var(--chart-3)" },
  exercise: { label: "Exercise", description: "Workouts and training load", icon: Dumbbell, color: "var(--chart-4)" },
  habits: { label: "Habits", description: "Daily habits completed", icon: ListChecks, color: "var(--chart-5)" },
  mindfulness: { label: "Mindfulness", description: "Meditation and breathing minutes", icon: Flower2, color: "var(--chart-6)" },
}
