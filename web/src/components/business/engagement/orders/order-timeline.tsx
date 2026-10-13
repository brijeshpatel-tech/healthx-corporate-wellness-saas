import { Circle } from "lucide-react"
import type { OrderDetail } from "@/lib/api/business/orders"
import { formatDateTime, formatRelative } from "@/lib/format"
import type { OrderStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ORDER_STATUS_ICON, ORDER_STATUS_LABEL, orderFlow } from "./order-meta"

const TONE: Partial<Record<OrderStatus, string>> = {
  rejected: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
  cancelled: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
  delivered: "bg-emerald-500/14 text-emerald-600 dark:text-emerald-400",
}

/** Status history (who / when / note) followed by the steps still to come. */
export function OrderTimeline({ order }: { order: OrderDetail }) {
  const done = order.timeline
  const reached = new Set(done.map((s) => s.status))
  const terminal = order.status === "delivered" || order.status === "rejected" || order.status === "cancelled"
  const upcoming = terminal ? [] : orderFlow(order.reward.delivery).filter((s) => !reached.has(s))

  return (
    <ol className="relative space-y-0">
      {done.map((step, i) => {
        const Icon = ORDER_STATUS_ICON[step.status]
        const isLast = i === done.length - 1
        const label = i === 0 && step.status === "pending_approval" ? "Order placed" : ORDER_STATUS_LABEL[step.status]
        return (
          <li key={`${step.status}-${step.at}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast || upcoming.length ? <span className="absolute top-9 bottom-0 left-[17px] w-px bg-border" aria-hidden /> : null}
            <span className={cn("relative z-[1] flex size-9 shrink-0 items-center justify-center rounded-full", TONE[step.status] ?? "bg-primary/12 text-primary")}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-sm font-semibold">{label}</p>
                <time dateTime={step.at} title={formatDateTime(step.at)} className="text-xs text-muted-foreground">
                  {formatDateTime(step.at)}
                </time>
              </div>
              {step.by ? <p className="text-xs text-muted-foreground">by {step.by} · {formatRelative(step.at)}</p> : null}
              {step.note && !(i === 0 && step.note === "Order placed") ? <p className="mt-1.5 rounded-lg bg-muted/60 px-3 py-2 text-sm break-words">{step.note}</p> : null}
            </div>
          </li>
        )
      })}
      {upcoming.map((status, i) => (
        <li key={status} className="relative flex gap-3 pb-5 last:pb-0">
          {i < upcoming.length - 1 ? <span className="absolute top-9 bottom-0 left-[17px] w-0 border-l border-dashed border-muted-foreground/40" aria-hidden /> : null}
          <span className="relative z-[1] flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed bg-card text-muted-foreground">
            <Circle className="size-3" />
          </span>
          <div className="pt-2">
            <p className="text-sm text-muted-foreground">{ORDER_STATUS_LABEL[status]}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
