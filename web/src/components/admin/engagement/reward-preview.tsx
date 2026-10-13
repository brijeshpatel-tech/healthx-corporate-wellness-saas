"use client"

import { Coins, Star } from "lucide-react"
import { CoverTile } from "@/components/admin/cover"
import { Badge } from "@/components/ui/badge"
import { formatNumber } from "@/lib/format"
import type { RewardDelivery } from "@/lib/types"
import { cn } from "@/lib/utils"
import { DELIVERY_META } from "./meta"

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)

/** Stock label used in the catalogue table and the preview. */
export function stockLabel(stock: number | null) {
  if (stock === null) return "Unlimited"
  if (stock <= 0) return "Out of stock"
  return `${formatNumber(stock)} left`
}

/** Live preview of a reward as employees see it in the Employee App rewards store. */
export function RewardPreview({
  value,
  categoryName,
  categoryIcon,
}: {
  value: {
    name: string
    description: string
    terms: string
    imageEmoji: string
    imageColor: string
    pointsCost: number | ""
    delivery: RewardDelivery
    unlimited: boolean
    stock: number | ""
    perEmployeeLimit: number | ""
    provider: string
    featured: boolean
  }
  categoryName?: string
  categoryIcon?: string
}) {
  const cost = num(value.pointsCost)
  const stock = value.unlimited ? null : num(value.stock)
  const limit = num(value.perEmployeeLimit)
  const DeliveryIcon = DELIVERY_META[value.delivery]?.icon
  const soldOut = !value.unlimited && stock !== null && stock <= 0
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="relative flex h-36 items-center justify-center" style={{ backgroundColor: `${value.imageColor}22` }}>
        <CoverTile emoji={value.imageEmoji || "🎁"} color={value.imageColor} size="xl" solid className="shadow-md" />
        {value.featured ? (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-amber-950">
            <Star className="size-3 fill-current" /> Featured
          </span>
        ) : null}
        {categoryName ? (
          <span className="absolute top-3 right-3 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium backdrop-blur">
            {categoryIcon} {categoryName}
          </span>
        ) : null}
      </div>
      <div className="space-y-3 p-4">
        <div className="space-y-1">
          <h3 className={cn("font-heading text-lg leading-snug font-semibold break-words", !value.name.trim() && "text-muted-foreground")}>{value.name.trim() || "Reward name"}</h3>
          {value.provider.trim() ? <p className="text-xs text-muted-foreground">by {value.provider.trim()}</p> : null}
        </div>
        <p className={cn("text-sm break-words", value.description.trim() ? "text-muted-foreground" : "text-muted-foreground/60 italic")}>{value.description.trim() || "Describe the reward in a sentence or two."}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {DeliveryIcon ? (
            <Badge variant="secondary" className="gap-1">
              <DeliveryIcon className="size-3" /> {DELIVERY_META[value.delivery].label}
            </Badge>
          ) : null}
          <Badge variant="outline" className={cn(soldOut && "border-amber-500/40 text-amber-700 dark:text-amber-400")}>
            {value.unlimited ? "Unlimited stock" : stock === null ? "Set stock" : stockLabel(stock)}
          </Badge>
          {limit ? <Badge variant="outline">Max {formatNumber(limit)} per person</Badge> : null}
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl bg-primary/8 px-3 py-2.5">
          <span className="inline-flex items-center gap-1.5 font-heading text-lg font-bold text-primary tabular-nums">
            <Coins className="size-4.5" /> {cost !== null && cost > 0 ? formatNumber(cost) : "—"} <span className="text-xs font-medium">pts</span>
          </span>
          <span className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", soldOut ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground")}>{soldOut ? "Out of stock" : "Redeem"}</span>
        </div>
        {value.terms.trim() ? <p className="text-[11px] leading-relaxed break-words text-muted-foreground">Terms: {value.terms.trim()}</p> : null}
      </div>
    </div>
  )
}
