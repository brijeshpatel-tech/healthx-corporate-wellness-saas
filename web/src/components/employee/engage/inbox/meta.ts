import type { LucideIcon } from "lucide-react"
import { AlarmClock, Award, CalendarDays, Coins, Gift, Info, Lightbulb, Megaphone, Sparkles, Trophy } from "lucide-react"
import type { Tone } from "@/components/employee/engage/page"
import type { AnnouncementType, NotificationType } from "@/lib/types"

export interface AnnouncementTypeMeta {
  /** Full label (detail page, badges). */
  label: string
  /** Short plural label for filter chips. */
  chip: string
  icon: LucideIcon
  tone: Tone
  emoji: string
  color: string
}

export const ANNOUNCEMENT_TYPE: Record<AnnouncementType, AnnouncementTypeMeta> = {
  general: { label: "General", chip: "General", icon: Megaphone, tone: "sky", emoji: "📣", color: "#0ea5e9" },
  wellness_tip: { label: "Wellness tip", chip: "Wellness tips", icon: Lightbulb, tone: "emerald", emoji: "💡", color: "#10b981" },
  challenge: { label: "Challenge announcement", chip: "Challenges", icon: Trophy, tone: "amber", emoji: "🏆", color: "#f59e0b" },
  reward: { label: "Reward announcement", chip: "Rewards", icon: Gift, tone: "pink", emoji: "🎁", color: "#ec4899" },
  event: { label: "Event", chip: "Events", icon: CalendarDays, tone: "violet", emoji: "📅", color: "#8b5cf6" },
}

export const ANNOUNCEMENT_TYPE_ORDER: AnnouncementType[] = ["general", "wellness_tip", "challenge", "reward", "event"]

/** Badge pill classes per tone (tinted background + readable text in both themes). */
export const TONE_PILL: Record<Tone, string> = {
  emerald: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  sky: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  violet: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  rose: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
  cyan: "bg-cyan-500/12 text-cyan-700 dark:text-cyan-300",
  indigo: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300",
  slate: "bg-slate-500/12 text-slate-700 dark:text-slate-300",
  orange: "bg-orange-500/12 text-orange-700 dark:text-orange-300",
  teal: "bg-teal-500/12 text-teal-700 dark:text-teal-300",
  pink: "bg-pink-500/12 text-pink-700 dark:text-pink-300",
  lime: "bg-lime-500/15 text-lime-700 dark:text-lime-300",
}

export const NOTIFICATION_TYPE: Record<NotificationType, { label: string; icon: LucideIcon; tone: Tone }> = {
  challenge: { label: "Challenge", icon: Trophy, tone: "emerald" },
  reward: { label: "Reward", icon: Gift, tone: "pink" },
  badge: { label: "Badge", icon: Award, tone: "violet" },
  announcement: { label: "Announcement", icon: Megaphone, tone: "sky" },
  reminder: { label: "Reminder", icon: AlarmClock, tone: "cyan" },
  points: { label: "Points", icon: Coins, tone: "amber" },
  insight: { label: "Insight", icon: Sparkles, tone: "indigo" },
  system: { label: "HealthX", icon: Info, tone: "slate" },
}
