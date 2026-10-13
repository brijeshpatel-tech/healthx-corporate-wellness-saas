import { BellRing, CalendarDays, Gift, Lightbulb, Mail, Megaphone, Smartphone, Trophy } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { formatDate } from "@/lib/format"
import type { AnnouncementType, Channel } from "@/lib/types"

/** Every type that can exist (older announcements may use "event"). */
export const ANNOUNCEMENT_TYPES: AnnouncementType[] = ["general", "wellness_tip", "challenge", "reward", "event"]
/** Types offered in the composer (#196: wellness tip, challenge or reward announcement). */
export const COMPOSER_TYPES: AnnouncementType[] = ["general", "wellness_tip", "challenge", "reward"]
export const CHANNELS: Channel[] = ["push", "in_app", "email"]
/** Channels offered in the composer (#194 push, #195 in-app). */
export const COMPOSER_CHANNELS: Channel[] = ["push", "in_app"]

export const TYPE_META: Record<AnnouncementType, { label: string; employeeLabel: string; emoji: string; icon: LucideIcon; className: string }> = {
  general: { label: "General", employeeLabel: "Company news", emoji: "📣", icon: Megaphone, className: "bg-slate-500/12 text-slate-700 dark:text-slate-300" },
  wellness_tip: { label: "Wellness tip", employeeLabel: "Wellness tip", emoji: "💡", icon: Lightbulb, className: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" },
  challenge: { label: "Challenge", employeeLabel: "Challenge announcement", emoji: "🏆", icon: Trophy, className: "bg-violet-500/12 text-violet-700 dark:text-violet-300" },
  reward: { label: "Reward", employeeLabel: "Reward announcement", emoji: "🎁", icon: Gift, className: "bg-rose-500/12 text-rose-700 dark:text-rose-300" },
  event: { label: "Event", employeeLabel: "Event", emoji: "📅", icon: CalendarDays, className: "bg-sky-500/12 text-sky-700 dark:text-sky-300" },
}

export const CHANNEL_META: Record<Channel, { label: string; description: string; icon: LucideIcon }> = {
  push: { label: "Push", description: "Phone notification", icon: BellRing },
  in_app: { label: "In-app", description: "Announcements & notification centre", icon: Smartphone },
  email: { label: "Email", description: "Work email inbox", icon: Mail },
}

/** "Mon 6 Oct, 09:00" — the format used in toasts and schedule labels. */
export const formatSchedule = (value?: string | Date | null) => formatDate(value, "EEE d MMM, HH:mm")

/** Local "YYYY-MM-DDTHH:mm" for <input type="datetime-local">. */
export function toLocalInput(value: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`
}

/** Next occurrence of a weekday (0 = Sun … 6 = Sat) at a given hour, strictly in the future. */
export function nextAt(hour: number, weekday?: number) {
  const d = new Date()
  d.setSeconds(0, 0)
  d.setMinutes(0)
  d.setHours(hour)
  if (weekday === undefined) {
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1)
    return d
  }
  let add = (weekday - d.getDay() + 7) % 7
  if (add === 0 && d.getTime() <= Date.now()) add = 7
  d.setDate(d.getDate() + add)
  return d
}
