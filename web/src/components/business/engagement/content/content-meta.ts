import { FileText, Lightbulb, Link2, PlayCircle } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ContentCategory } from "@/lib/api/business/content"
import type { ContentType } from "@/lib/types"

export const CONTENT_TYPES: ContentType[] = ["article", "video", "tip", "link"]
export const CONTENT_CATEGORIES: ContentCategory[] = ["movement", "nutrition", "sleep", "mindfulness", "hydration", "general"]

export const CONTENT_TYPE_META: Record<ContentType, { label: string; description: string; icon: LucideIcon; minutesLabel: string }> = {
  article: { label: "Article", description: "Text with a cover", icon: FileText, minutesLabel: "Read time" },
  video: { label: "Video", description: "YouTube, Vimeo or MP4 link", icon: PlayCircle, minutesLabel: "Watch time" },
  tip: { label: "Tip", description: "A short daily tip", icon: Lightbulb, minutesLabel: "Read time" },
  link: { label: "Link", description: "An external web page", icon: Link2, minutesLabel: "Read time" },
}

export const CATEGORY_META: Record<ContentCategory, { label: string; emoji: string }> = {
  movement: { label: "Movement", emoji: "🏃" },
  nutrition: { label: "Nutrition", emoji: "🥗" },
  sleep: { label: "Sleep", emoji: "😴" },
  mindfulness: { label: "Mindfulness", emoji: "🧘" },
  hydration: { label: "Hydration", emoji: "💧" },
  general: { label: "General", emoji: "✨" },
}

export const CONTENT_EMOJIS = ["📰", "💡", "🎬", "🔗", "🏃", "🥗", "😴", "🧘", "💧", "❤️", "🧠", "🏢", "💬", "🌱", "🍎", "🚶", "🏋️", "☀️", "🎧", "📣"]
