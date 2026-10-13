"use client"

import { Eye, EyeOff } from "lucide-react"
import { KeyValueList } from "@/components/common/misc"
import { StatusBadge } from "@/components/common/status-badge"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import type { RewardRow } from "@/lib/api/business/rewards"
import { formatDate, formatNumber } from "@/lib/format"
import { DELIVERY_META, stockLabel } from "./reward-meta"
import { RewardPreview } from "./reward-preview"

/** Read-only details of a HealthX catalogue reward + the company visibility switch. */
export function CatalogueRewardSheet({
  reward,
  onOpenChange,
  visible,
  pending,
  onVisibleChange,
}: {
  reward: RewardRow | null
  onOpenChange: (open: boolean) => void
  visible: boolean
  pending: boolean
  onVisibleChange: (visible: boolean) => void
}) {
  return (
    <Sheet open={!!reward} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {reward ? (
          <>
            <SheetHeader className="pr-12">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="font-heading text-lg">{reward.name}</SheetTitle>
                {reward.status === "out_of_stock" ? <StatusBadge status="out_of_stock" /> : null}
              </div>
              <SheetDescription>HealthX catalogue reward · provided by {reward.provider ?? "HealthX"}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-6 px-4 pb-6">
              <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="catalogue-visible" className="flex items-center gap-1.5 text-sm font-medium">
                    {visible ? <Eye className="size-4 text-primary" /> : <EyeOff className="size-4 text-muted-foreground" />}
                    {visible ? "Visible to your employees" : "Hidden from your employees"}
                  </Label>
                  <p className="text-xs text-muted-foreground">Hidden rewards don&apos;t appear in the employee Rewards tab. Orders already placed are not affected.</p>
                </div>
                <Switch id="catalogue-visible" checked={visible} disabled={pending} onCheckedChange={onVisibleChange} />
              </div>
              <RewardPreview
                data={{
                  name: reward.name,
                  description: reward.description,
                  terms: reward.terms,
                  categoryName: reward.categoryName,
                  pointsCost: reward.pointsCost,
                  delivery: reward.delivery,
                  stock: reward.stock ?? "",
                  perEmployeeLimit: reward.perEmployeeLimit ?? "",
                  featured: reward.featured,
                  imageEmoji: reward.imageEmoji,
                  imageColor: reward.imageColor,
                }}
              />
              <KeyValueList
                items={[
                  { label: "Category", value: `${reward.categoryIcon} ${reward.categoryName}` },
                  { label: "Points cost", value: `${formatNumber(reward.pointsCost)} pts` },
                  { label: "Delivery", value: DELIVERY_META[reward.delivery].label },
                  { label: "Fulfilled by", value: reward.provider ?? "HealthX" },
                  { label: "Stock", value: stockLabel(reward.stock) },
                  { label: "Limit per employee", value: reward.perEmployeeLimit ? `${reward.perEmployeeLimit}` : "No limit" },
                  { label: "Orders from your company", value: formatNumber(reward.companyOrders) },
                  { label: "In the catalogue since", value: formatDate(reward.createdAt) },
                ]}
              />
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Description</p>
                <p className="text-sm">{reward.description}</p>
              </div>
              {reward.terms ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Terms</p>
                  <p className="text-sm text-muted-foreground">{reward.terms}</p>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
