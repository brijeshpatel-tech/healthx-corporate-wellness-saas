"use client"

import { ArrowLeft, Check, CircleDashed, Coins, Copy, Eye, EyeOff, LifeBuoy, PackageCheck, RotateCcw, Truck, XCircle } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/common/misc"
import { StatusBadge } from "@/components/common/status-badge"
import { EmptyState } from "@/components/common/states"
import { EngagePage, LoadError } from "@/components/employee/engage/page"
import { RewardImage } from "@/components/employee/engage/reward-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ORDER_STATUS_LABEL, ordersApi, type OrderDetail } from "@/lib/api/employee/orders"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatDateTime, formatNumber } from "@/lib/format"
import type { OrderStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const STEP_TEXT: Record<OrderStatus, string> = {
  pending_approval: "Requested",
  approved: "Approved",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Fulfilled",
  cancelled: "Cancelled",
  rejected: "Rejected",
}

/** SCR-M-058 Order Detail — timeline, voucher code / tracking, cancel if pending. */
export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const q = useApiQuery(["employee", "order", id], () => ordersApi.detail({ id }))
  return (
    <EngagePage size="narrow">
      <Link href="/employee-app/orders" className="-mb-2 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> My orders
      </Link>
      {q.error ? (
        q.error.status === 404 ? (
          <EmptyState icon={PackageCheck} title="Couldn't find this order." action={<Button asChild variant="outline"><Link href="/employee-app/orders">Back to my orders</Link></Button>} />
        ) : (
          <LoadError title="Couldn't load this order." error={q.error} onRetry={() => q.refetch()} />
        )
      ) : !q.data ? (
        <>
          <Skeleton className="h-36 rounded-3xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </>
      ) : (
        <Order o={q.data} />
      )}
    </EngagePage>
  )
}

function Order({ o }: { o: OrderDetail }) {
  const [revealed, setRevealed] = useState(false)
  const cancel = useApiMutation(ordersApi.cancel, { success: (r) => `Order cancelled – ${formatNumber(r.refunded)} points refunded.` })
  const delivered = o.status === "delivered"
  const lastAt = o.timeline[o.timeline.length - 1]?.at

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${what} copied`)
    } catch {
      toast.error("Couldn't copy — select the text instead.")
    }
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl border bg-card p-5 shadow-sm" style={{ background: `radial-gradient(110% 90% at 0% 0%, ${o.color}26, transparent 60%)` }}>
        <div className="flex items-start gap-4">
          <RewardImage emoji={o.emoji} color={o.color} size="sm" className="size-16 rounded-2xl text-3xl" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <StatusBadge status={o.status} label={ORDER_STATUS_LABEL[o.status]} />
            <h1 className="font-heading text-xl font-bold tracking-tight">{o.rewardName}</h1>
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span>Order {o.orderNumber}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Coins className="size-3.5" /> {formatNumber(o.points)} pts
              </span>
            </p>
          </div>
        </div>
        {delivered ? (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <PackageCheck className="size-4" /> Delivered on {formatDate(lastAt, "d MMM")}.
          </p>
        ) : o.refunded ? (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm font-medium">
            <RotateCcw className="size-4" /> {o.status === "rejected" ? "Rejected" : "Cancelled"} – {formatNumber(o.points)} points refunded.
          </p>
        ) : null}
      </div>

      {o.voucherCode ? (
        <Card className="gap-0 py-0">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <p className="text-sm font-semibold">Your voucher code</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-xl border border-dashed bg-muted/50 px-4 py-3 font-mono text-lg tracking-widest">
                {revealed ? o.voucherCode : `${o.voucherCode.slice(0, 2)}${"•".repeat(Math.max(4, o.voucherCode.length - 4))}${o.voucherCode.slice(-2)}`}
              </code>
              <Button variant="outline" size="icon-lg" className="size-12 rounded-xl" onClick={() => setRevealed((v) => !v)} aria-label={revealed ? "Hide code" : "Reveal code"}>
                {revealed ? <EyeOff /> : <Eye />}
              </Button>
              <Button variant="outline" size="icon-lg" className="size-12 rounded-xl" onClick={() => copy(o.voucherCode!, "Code")} aria-label="Copy code">
                <Copy />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Only you can see this code. Keep it private until you use it.</p>
          </CardContent>
        </Card>
      ) : null}

      {o.trackingNumber ? (
        <Card className="gap-0 py-0">
          <CardContent className="flex items-center gap-3 p-4 sm:p-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/12 text-violet-600 dark:text-violet-400">
              <Truck className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Tracking reference</p>
              <p className="font-mono text-sm font-semibold">{o.trackingNumber}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => copy(o.trackingNumber!, "Tracking number")} aria-label="Copy tracking number">
              <Copy />
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="gap-0 py-0">
        <CardContent className="p-4 sm:p-5">
          <h2 className="mb-4 font-heading text-base font-semibold">Status</h2>
          <ol className="relative space-y-0">
            {o.timeline.map((t, i) => {
              const bad = t.status === "cancelled" || t.status === "rejected"
              const last = i === o.timeline.length - 1 && o.upcoming.length === 0
              return (
                <li key={`${t.status}-${t.at}`} className="relative flex gap-3 pb-5 last:pb-0">
                  {!last ? <span className="absolute top-7 bottom-0 left-[13px] w-0.5 bg-primary/30" aria-hidden /> : null}
                  <span className={cn("relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-white", bad ? "bg-rose-500" : "bg-primary")}>
                    {bad ? <XCircle className="size-4" /> : <Check className="size-4" strokeWidth={3} />}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm font-semibold">{STEP_TEXT[t.status]}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(t.at)}
                      {t.by ? ` · ${t.by}` : ""}
                    </p>
                    {t.note ? <p className="mt-0.5 text-sm text-muted-foreground">{t.note}</p> : null}
                  </div>
                </li>
              )
            })}
            {o.upcoming.map((s, i) => (
              <li key={s} className="relative flex gap-3 pb-5 last:pb-0">
                {i < o.upcoming.length - 1 ? <span className="absolute top-7 bottom-0 left-[13px] w-0.5 bg-border" aria-hidden /> : null}
                <span className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-dashed bg-card text-muted-foreground">
                  <CircleDashed className="size-3.5" />
                </span>
                <p className="pt-1 text-sm text-muted-foreground">{STEP_TEXT[s]}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardContent className="p-0">
          <h2 className="px-4 pt-4 font-heading text-base font-semibold sm:px-5">Delivery details</h2>
          <dl className="divide-y text-sm">
            {[
              ["Method", o.deliveryLabel],
              ["Recipient", o.details.name],
              ["Email", o.details.email],
              ...(o.details.phone ? [["Phone", o.details.phone]] : []),
              ...(o.details.address ? [["Address", o.details.address]] : []),
              ...(o.details.notes ? [["Notes", o.details.notes]] : []),
              ["Points spent", `${formatNumber(o.points)} pts`],
              ["Ordered", formatDateTime(o.createdAt)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4 px-4 py-3 sm:px-5">
                <dt className="shrink-0 text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium break-words">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button asChild variant="outline" size="lg" className="h-11 rounded-xl">
          <Link href="/employee-app/help">
            <LifeBuoy data-icon="inline-start" /> Contact support
          </Link>
        </Button>
        {o.canCancel ? (
          <ConfirmDialog
            trigger={
              <Button variant="destructive" size="lg" className="h-11 rounded-xl" disabled={cancel.isPending}>
                {cancel.isPending ? <Spinner /> : <XCircle data-icon="inline-start" />}
                Cancel order
              </Button>
            }
            title="Cancel this order?"
            description={`${formatNumber(o.points)} points will be refunded to your wallet straight away. This can't be undone.`}
            confirmLabel="Cancel order"
            cancelLabel="Keep order"
            destructive
            onConfirm={() => cancel.mutate({ id: o.id })}
          />
        ) : null}
      </div>
    </>
  )
}
