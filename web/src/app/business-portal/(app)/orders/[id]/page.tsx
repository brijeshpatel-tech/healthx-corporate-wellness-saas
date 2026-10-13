"use client"

import { CheckCircle2, Coins, Copy, Info, Package, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { CoverTile } from "@/components/business/engagement/cover-picker"
import { ACTION_META, nextStepHint } from "@/components/business/engagement/orders/order-meta"
import { OrderActionDialog } from "@/components/business/engagement/orders/order-action-dialog"
import { OrderTimeline } from "@/components/business/engagement/orders/order-timeline"
import { DELIVERY_META } from "@/components/business/engagement/rewards/reward-meta"
import { KeyValueList, SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { EmptyState, ErrorState } from "@/components/common/states"
import { PersonCell } from "@/components/common/user-avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api/core"
import { ordersApi, type OrderAction, type OrderDetail } from "@/lib/api/business/orders"
import { useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format"

function DetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <div className="flex flex-col gap-6">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  )
}

function CopyValue({ value, label }: { value: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-sm">{value}</span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Copy ${label}`}
        onClick={() => {
          void navigator.clipboard?.writeText(value)
          toast.success(`${label} copied`)
        }}
      >
        <Copy />
      </Button>
    </span>
  )
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const order = useApiQuery(["business", "orders", "detail", id], () => ordersApi.get({ id }))
  const o = order.data

  return (
    <PageContainer>
      <PageHeader
        backHref="/business-portal/orders"
        backLabel="Redemption orders"
        title={o ? `Order ${o.orderNumber}` : "Order"}
        badge={o ? <StatusBadge status={o.status} /> : null}
        description={o ? `Placed ${formatDateTime(o.createdAt)} · last updated ${formatRelative(o.updatedAt)}` : "Order details and fulfilment."}
      />
      {order.isLoading ? (
        <DetailSkeleton />
      ) : order.error ? (
        order.error instanceof ApiError && order.error.status === 404 ? (
          <EmptyState
            icon={Package}
            title="Order not found"
            description="It may belong to another company or the link is wrong."
            action={
              <Button asChild>
                <Link href="/business-portal/orders">Back to orders</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState error={order.error} onRetry={() => order.refetch()} />
        )
      ) : o ? (
        <OrderBody order={o} refetch={() => order.refetch()} />
      ) : null}
    </PageContainer>
  )
}

function OrderBody({ order: o, refetch }: { order: OrderDetail; refetch: () => void }) {
  const can = useCan()
  const [action, setAction] = useState<OrderAction | null>(null)
  const delivery = DELIVERY_META[o.reward.delivery]
  const actions = can("orders.manage") ? o.actions : []
  const primary = actions.filter((a) => !ACTION_META[a].destructive)
  const destructive = actions.filter((a) => ACTION_META[a].destructive)

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
        <SectionCard title="Order summary">
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-4">
              <CoverTile emoji={o.reward.emoji} color={o.reward.color} size="xl" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="font-heading text-lg leading-snug font-bold">{o.reward.name}</p>
                <p className="text-sm text-muted-foreground">
                  {o.reward.categoryName} · {o.reward.isCompanyReward ? "Company reward" : `HealthX catalogue${o.reward.provider ? ` · ${o.reward.provider}` : ""}`}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-xs font-medium">
                    <delivery.icon className="size-3.5" /> {delivery.label}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/12 px-2 py-1 text-xs font-semibold text-amber-700 tabular-nums dark:text-amber-300">
                    <Coins className="size-3.5" /> {formatNumber(o.points)} points
                  </span>
                </div>
              </div>
            </div>
            <KeyValueList
              columns={3}
              items={[
                { label: "Order number", value: <span className="font-mono">{o.orderNumber}</span> },
                { label: "Employee", value: o.employee ? <PersonCell name={o.employee.name} color={o.employee.avatarColor} size="xs" /> : o.delivery.name },
                { label: "Quantity", value: formatNumber(o.quantity) },
                { label: "Placed", value: formatDateTime(o.createdAt) },
                { label: "Last updated", value: formatDateTime(o.updatedAt) },
                { label: "Points", value: `${formatNumber(o.points)} pts` },
                ...(o.trackingNumber ? [{ label: "Tracking number", value: <CopyValue value={o.trackingNumber} label="Tracking number" /> }] : []),
                ...(o.voucherCode ? [{ label: "Voucher code", value: <CopyValue value={o.voucherCode} label="Voucher code" /> }] : []),
              ]}
            />
            {o.reward.terms ? (
              <p className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" /> {o.reward.terms}
              </p>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Status timeline" description="Every change is recorded with who made it and when.">
          <OrderTimeline order={o} />
        </SectionCard>
      </div>

      <div className="order-first flex min-w-0 flex-col gap-6 lg:order-none">
        <SectionCard title={actions.length ? "Next step" : "Status"}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{nextStepHint(o.status, o.reward.delivery)}</p>
            {actions.length ? (
              <div className="flex flex-col gap-2">
                {primary.map((a, i) => {
                  const m = ACTION_META[a]
                  return (
                    <Button key={a} variant={i === 0 ? "default" : "outline"} className="h-9 w-full" onClick={() => setAction(a)}>
                      <m.icon data-icon="inline-start" /> {m.label}
                    </Button>
                  )
                })}
                {destructive.map((a) => {
                  const m = ACTION_META[a]
                  return (
                    <Button key={a} variant="destructive" className="h-9 w-full" onClick={() => setAction(a)}>
                      <m.icon data-icon="inline-start" /> {m.label}
                    </Button>
                  )
                })}
              </div>
            ) : o.status === "delivered" ? (
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-4" /> Completed
              </p>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          title="Delivery details"
          description={
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-primary" /> Shown only to fulfil this order.
            </span>
          }
        >
          <KeyValueList
            columns={1}
            items={[
              { label: "Name", value: o.delivery.name },
              { label: "Email", value: <a href={`mailto:${o.delivery.email}`} className="text-primary hover:underline">{o.delivery.email}</a> },
              { label: "Phone", value: o.delivery.phone ? <a href={`tel:${o.delivery.phone}`} className="hover:underline">{o.delivery.phone}</a> : <span className="text-muted-foreground">Not provided</span> },
              {
                label: "Address",
                value: o.delivery.address ? (
                  <span className="whitespace-pre-line">{o.delivery.address}</span>
                ) : (
                  <span className="text-muted-foreground">{o.reward.delivery === "physical" ? "Not provided" : `Not needed — ${delivery.label.toLowerCase()}`}</span>
                ),
              },
              { label: "Notes from the employee", value: o.delivery.notes ? o.delivery.notes : <span className="text-muted-foreground">None</span> },
            ]}
          />
        </SectionCard>
      </div>

      <OrderActionDialog order={o} action={action} onOpenChange={(open) => !open && setAction(null)} onConflict={refetch} />
    </div>
  )
}
