import { Check, Circle, X } from "lucide-react"
import { formatDateTime } from "@/lib/format"
import type { OrderStatus, RedemptionOrder, RewardDelivery } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ORDER_STATUS_LABEL } from "./meta"

const FLOW: OrderStatus[] = ["pending_approval", "approved", "processing", "shipped", "delivered"]

const STEP_LABEL: Partial<Record<OrderStatus, string>> = { pending_approval: "Order placed" }

/** Vertical order timeline (oldest first) with the remaining expected steps shown as pending. */
export function OrderTimeline({ order, delivery }: { order: Pick<RedemptionOrder, "status" | "timeline">; delivery: RewardDelivery }) {
  const flow = FLOW.filter((s) => delivery === "physical" || s !== "shipped")
  const events = [...order.timeline].sort((a, b) => a.at.localeCompare(b.at))
  const closed = order.status === "cancelled" || order.status === "rejected" || order.status === "delivered"
  const reached = new Set(events.map((e) => e.status))
  const upcoming = closed ? [] : flow.filter((s) => !reached.has(s) && flow.indexOf(s) > flow.indexOf(order.status))

  return (
    <ol className="relative space-y-0">
      {events.map((e, i) => {
        const failed = e.status === "cancelled" || e.status === "rejected"
        const last = i === events.length - 1 && upcoming.length === 0
        const current = i === events.length - 1
        return (
          <li key={`${e.status}-${e.at}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
            {!last ? <span className="absolute top-7 bottom-0 left-[13px] w-px bg-border" aria-hidden /> : null}
            <span
              className={cn(
                "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-background",
                failed ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : current && !closed ? "bg-primary text-primary-foreground" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
              )}
            >
              {failed ? <X className="size-3.5" /> : <Check className="size-3.5" />}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-sm font-semibold">{STEP_LABEL[e.status] ?? ORDER_STATUS_LABEL[e.status]}</span>
                <time className="text-xs text-muted-foreground tabular-nums" dateTime={e.at}>
                  {formatDateTime(e.at)}
                </time>
              </div>
              {e.note ? <p className="mt-0.5 text-sm break-words text-muted-foreground">{e.note}</p> : null}
              {e.by ? <p className="mt-0.5 text-xs text-muted-foreground">by {e.by}</p> : null}
            </div>
          </li>
        )
      })}
      {upcoming.map((s, i) => (
        <li key={s} className="relative flex gap-3 pb-5 last:pb-0">
          {i < upcoming.length - 1 ? <span className="absolute top-7 bottom-0 left-[13px] w-px border-l border-dashed" aria-hidden /> : null}
          <span className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed bg-background text-muted-foreground">
            <Circle className="size-2.5" />
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <span className="text-sm text-muted-foreground">{ORDER_STATUS_LABEL[s]}</span>
            <span className="ml-2 text-xs text-muted-foreground/70">Pending</span>
          </div>
        </li>
      ))}
    </ol>
  )
}
