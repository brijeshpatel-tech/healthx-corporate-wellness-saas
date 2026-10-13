import { Coins, Info, Star } from "lucide-react"
import { PhoneFrame } from "@/components/business/engagement/phone-frame"
import { formatNumber } from "@/lib/format"
import type { RewardDelivery } from "@/lib/types"
import { DELIVERY_META, stockLabel } from "./reward-meta"

export interface RewardPreviewData {
  name: string
  description: string
  terms: string
  categoryName?: string
  pointsCost: number | ""
  delivery: RewardDelivery
  stock: number | ""
  perEmployeeLimit: number | ""
  featured: boolean
  imageEmoji: string
  imageColor: string
}

/** "As employees will see it" — reward detail card inside a phone frame. */
export function RewardPreview({ data, balance = 4200 }: { data: RewardPreviewData; balance?: number }) {
  const cost = typeof data.pointsCost === "number" ? data.pointsCost : 0
  const stock = data.stock === "" ? null : data.stock
  const canAfford = cost > 0 && balance >= cost
  const Delivery = DELIVERY_META[data.delivery]?.icon ?? Info
  return (
    <PhoneFrame label="How employees will see it">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
          <span>Rewards</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/14 px-2 py-0.5 text-amber-700 dark:text-amber-300">
            <Coins className="size-3" /> {formatNumber(balance)}
          </span>
        </div>
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="relative flex h-28 items-center justify-center text-5xl" style={{ background: `linear-gradient(135deg, ${data.imageColor}, ${data.imageColor}aa)` }}>
            <span className="drop-shadow">{data.imageEmoji || "🎁"}</span>
            {data.featured ? (
              <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                <Star className="size-3 fill-current" /> Featured
              </span>
            ) : null}
            <span className="absolute right-2 bottom-2 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">{stockLabel(stock)}</span>
          </div>
          <div className="space-y-2.5 p-3">
            <div>
              {data.categoryName ? <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{data.categoryName}</p> : null}
              <p className="font-heading text-sm leading-snug font-bold break-words">{data.name.trim() || "Reward name"}</p>
            </div>
            <p className="line-clamp-4 text-xs leading-relaxed break-words text-muted-foreground">{data.description.trim() || "A short description helps employees decide what to save their points for."}</p>
            <div className="flex flex-wrap gap-1.5 text-[10px] font-medium">
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5">
                <Delivery className="size-3" /> {DELIVERY_META[data.delivery]?.label ?? "Reward"}
              </span>
              {data.perEmployeeLimit !== "" ? <span className="rounded-md bg-muted px-1.5 py-0.5">Max {data.perEmployeeLimit} per person</span> : null}
            </div>
            <div className="flex items-center justify-between gap-2 border-t pt-2.5">
              <span className="inline-flex items-center gap-1 font-heading text-base font-bold text-amber-600 tabular-nums dark:text-amber-400">
                <Coins className="size-4" /> {cost ? formatNumber(cost) : "—"}
              </span>
              <span
                className={
                  canAfford && stock !== 0
                    ? "rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground"
                    : "rounded-lg bg-muted px-3 py-1.5 text-[11px] font-semibold text-muted-foreground"
                }
              >
                {stock === 0 ? "Out of stock" : canAfford ? "Redeem" : cost ? `${formatNumber(cost - balance)} more pts` : "Redeem"}
              </span>
            </div>
            {data.terms.trim() ? <p className="line-clamp-3 rounded-lg bg-muted/60 p-2 text-[10px] leading-relaxed break-words text-muted-foreground">{data.terms.trim()}</p> : null}
          </div>
        </div>
      </div>
    </PhoneFrame>
  )
}
