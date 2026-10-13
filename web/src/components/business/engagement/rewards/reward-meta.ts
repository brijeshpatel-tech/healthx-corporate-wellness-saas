import { HandHeart, Package, Sparkles, Star, Ticket } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { RewardDelivery } from "@/lib/types"
import { formatNumber } from "@/lib/format"

export const DELIVERY_META: Record<RewardDelivery, { label: string; description: string; icon: LucideIcon }> = {
  physical: { label: "Physical item", description: "Shipped to the employee or collected at the office.", icon: Package },
  digital_voucher: { label: "Digital voucher", description: "A voucher code is sent to the employee.", icon: Ticket },
  experience: { label: "Experience", description: "An event, class or outing.", icon: Sparkles },
  donation: { label: "Donation", description: "Points become a donation to a cause.", icon: HandHeart },
  company_perk: { label: "Company perk", description: "Time off, parking or other benefits HR arranges.", icon: Star },
}

export const REWARD_EMOJIS = ["🎁", "🧥", "👕", "🎧", "⌚", "🏖️", "🌴", "🍽️", "🥘", "☕", "🎟️", "🎬", "🧘", "🏋️", "🚲", "📚", "🪴", "💚", "🅿️", "⭐"]

export const REWARD_STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Deactivated" },
] as const

/** "Unlimited" / "12 left" / "Out of stock". */
export function stockLabel(stock: number | null) {
  if (stock === null) return "Unlimited"
  if (stock === 0) return "Out of stock"
  return `${formatNumber(stock)} left`
}
