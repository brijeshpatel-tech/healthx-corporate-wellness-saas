"use client"

import { ChevronRight, Coins, Gift, Package } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { StatusBadge } from "@/components/common/status-badge"
import { EmptyState } from "@/components/common/states"
import { ChipTabs, EngagePage, LoadError } from "@/components/employee/engage/page"
import { RewardImage } from "@/components/employee/engage/reward-ui"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ORDER_STATUS_LABEL, ordersApi, type OrderFilter } from "@/lib/api/employee/orders"
import { useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** SCR-M-057 My Orders. */
export default function OrdersPage() {
  const [status, setStatus] = useState<OrderFilter>("all")
  const q = useApiQuery(["employee", "orders", status], () => ordersApi.list({ status }), { placeholderData: (prev) => prev })
  const d = q.data

  return (
    <EngagePage
      size="narrow"
      title="My orders"
      description="Track your reward redemptions from request to delivery."
      backHref="/employee-app/wallet"
      backLabel="Wallet"
      actions={
        <Button asChild variant="outline" size="lg" className="rounded-xl">
          <Link href="/employee-app/rewards">
            <Gift data-icon="inline-start" /> Browse rewards
          </Link>
        </Button>
      }
    >
      <ChipTabs<OrderFilter>
        ariaLabel="Order status"
        value={status}
        onChange={setStatus}
        options={[
          { value: "all", label: "All", count: d?.counts.all },
          { value: "open", label: "In progress", count: d?.counts.open },
          { value: "fulfilled", label: "Fulfilled", count: d?.counts.fulfilled },
          { value: "closed", label: "Cancelled / rejected", count: d?.counts.closed },
        ]}
      />

      {q.error && !d ? (
        <LoadError title="Couldn't load orders." error={q.error} onRetry={() => q.refetch()} />
      ) : !d ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : d.items.length === 0 ? (
        d.counts.all === 0 ? (
          <EmptyState
            icon={Package}
            title="No orders yet. Redeem your points for a reward."
            action={
              <Button asChild>
                <Link href="/employee-app/rewards">Browse rewards</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState icon={Package} title="No orders with this status." action={<Button variant="outline" onClick={() => setStatus("all")}>Show all orders</Button>} />
        )
      ) : (
        <div className={cn("divide-y overflow-hidden rounded-2xl border bg-card shadow-xs", q.isFetching && "opacity-70 transition-opacity")}>
          {d.items.map((o) => (
            <Link key={o.id} href={`/employee-app/orders/${o.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50">
              <RewardImage emoji={o.emoji} color={o.color} size="sm" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-semibold">{o.rewardName}</p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span>{formatDate(o.createdAt, "d MMM yyyy")}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-0.5">
                    <Coins className="size-3" /> {formatNumber(o.points)}
                  </span>
                  <span className="hidden sm:inline">· {o.orderNumber}</span>
                </p>
              </div>
              <StatusBadge status={o.status} label={ORDER_STATUS_LABEL[o.status]} />
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </EngagePage>
  )
}
