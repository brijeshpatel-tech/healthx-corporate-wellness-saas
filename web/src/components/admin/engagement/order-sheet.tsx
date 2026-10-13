"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CircleX, Coins, Hourglass, PackageCheck, Truck, Wrench } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { CoverTile } from "@/components/admin/cover"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { TextareaField, TextField } from "@/components/common/form-fields"
import { KeyValueList } from "@/components/common/misc"
import { StatusBadge } from "@/components/common/status-badge"
import { ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { CANCELLABLE, ordersApi, type FulfilStatus, type OrderDetail } from "@/lib/api/platform/orders"
import { formatDateTime, formatNumber } from "@/lib/format"
import { DELIVERY_META, ORDER_STATUS_LABEL } from "./meta"
import { OrderTimeline } from "./order-timeline"

/** The single next fulfilment step for an order (null when the order is closed). */
function nextStep(o: OrderDetail): FulfilStatus | null {
  if (o.status === "approved") return "processing"
  if (o.status === "processing") return o.rewardDelivery === "physical" ? "shipped" : "delivered"
  if (o.status === "shipped") return "delivered"
  return null
}

const STEP_UI: Record<FulfilStatus, { title: string; label: string; help: string; icon: typeof Truck; success: string }> = {
  processing: { title: "Start fulfilment", label: "Mark processing", help: "Use when the fulfilment team starts preparing the reward.", icon: Wrench, success: "Order marked as processing." },
  shipped: { title: "Ship the item", label: "Mark shipped", help: "Add the courier tracking number — it's shared with the employee.", icon: Truck, success: "Order shipped – employee notified." },
  delivered: { title: "Deliver the reward", label: "Mark delivered", help: "Completes the order and notifies the employee.", icon: PackageCheck, success: "Order fulfilled – employee notified." },
}

const fulfilSchema = z
  .object({
    step: z.enum(["processing", "shipped", "delivered"]),
    needsVoucher: z.boolean(),
    trackingNumber: z.string().trim().max(40, "Keep this under 40 characters."),
    voucherCode: z.string().trim().max(60, "Keep this under 60 characters."),
    note: z.string().trim().max(300, "Keep the note under 300 characters."),
  })
  .superRefine((v, ctx) => {
    if (v.step === "shipped" && v.trackingNumber.length < 6) ctx.addIssue({ code: "custom", path: ["trackingNumber"], message: v.trackingNumber ? "Tracking number looks too short." : "Enter the courier tracking number." })
    if (v.step === "delivered" && v.needsVoucher && !v.voucherCode) ctx.addIssue({ code: "custom", path: ["voucherCode"], message: "Enter the voucher code sent to the employee." })
  })
type FulfilValues = z.infer<typeof fulfilSchema>

function FulfilPanel({ order, onCancel }: { order: OrderDetail; onCancel: () => void }) {
  const step = nextStep(order)
  const needsVoucher = step === "delivered" && order.rewardDelivery === "digital_voucher" && !order.voucherCode
  const form = useForm<FulfilValues>({
    resolver: zodResolver(fulfilSchema),
    defaultValues: { step: step ?? "processing", needsVoucher, trackingNumber: "", voucherCode: "", note: "" },
  })
  const fulfil = useApiMutation(ordersApi.fulfil, {
    success: (_o, i) => STEP_UI[i.status].success,
    errorTitle: "Couldn't update order.",
    onSuccess: () => form.reset({ step: step ?? "processing", needsVoucher, trackingNumber: "", voucherCode: "", note: "" }),
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof FulfilValues, { message }))
    },
  })
  if (!step) return null
  const ui = STEP_UI[step]
  const Icon = ui.icon
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((v) =>
        fulfil.mutate({ id: order.id, status: step, trackingNumber: v.trackingNumber || undefined, voucherCode: v.voucherCode || undefined, note: v.note || undefined }),
      )}
      className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4"
    >
      <div>
        <p className="text-sm font-semibold">Next step: {ui.title}</p>
        <p className="text-xs text-muted-foreground">{ui.help}</p>
      </div>
      {step === "shipped" ? <TextField control={form.control} name="trackingNumber" label="Tracking number" placeholder="e.g. DL123456789IN" required /> : null}
      {step === "delivered" && order.rewardDelivery === "digital_voucher" ? (
        <TextField
          control={form.control}
          name="voucherCode"
          label="Voucher code"
          placeholder={order.voucherCode ?? "e.g. HXAB12CD34EF"}
          required={needsVoucher}
          description={order.voucherCode ? "A code is already on file — leave empty to keep it." : "Emailed to the employee."}
        />
      ) : null}
      <TextareaField control={form.control} name="note" label="Note (optional)" rows={2} maxLength={300} placeholder="Shown in the order timeline." />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={fulfil.isPending}>
          {fulfil.isPending ? <Spinner /> : <Icon data-icon="inline-start" />}
          {ui.label}
        </Button>
        {CANCELLABLE.includes(order.status) ? (
          <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={onCancel} disabled={fulfil.isPending}>
            <CircleX data-icon="inline-start" /> Cancel &amp; refund
          </Button>
        ) : null}
      </div>
    </form>
  )
}

const cancelSchema = z.object({ reason: z.string().trim().min(5, "Tell the employee why the order is cancelled (at least 5 characters).").max(300, "Keep the reason under 300 characters.") })

function CancelDialog({ order, open, onOpenChange }: { order: OrderDetail; open: boolean; onOpenChange: (open: boolean) => void }) {
  const form = useForm<z.infer<typeof cancelSchema>>({ resolver: zodResolver(cancelSchema), defaultValues: { reason: "" } })
  useEffect(() => {
    if (open) form.reset({ reason: "" })
  }, [open, form])
  const refund = order.points * Math.max(1, order.quantity)
  const cancel = useApiMutation(ordersApi.cancel, {
    success: `Order cancelled – ${formatNumber(refund)} points refunded.`,
    errorTitle: "Couldn't update order.",
    onSuccess: () => onOpenChange(false),
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors?.reason) form.setError("reason", { message: err.fieldErrors.reason })
    },
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel order {order.orderNumber}?</DialogTitle>
          <DialogDescription>
            {formatNumber(refund)} points go back to {order.delivery.name}&apos;s wallet and they&apos;re notified with your reason. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <form id="cancel-order-form" noValidate onSubmit={form.handleSubmit((v) => cancel.mutate({ id: order.id, reason: v.reason }))}>
          <TextareaField control={form.control} name="reason" label="Cancellation reason" rows={3} maxLength={300} placeholder="e.g. Item discontinued by the supplier." required />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep order
          </Button>
          <Button type="submit" form="cancel-order-form" disabled={cancel.isPending} className="bg-destructive text-white hover:bg-destructive/90">
            {cancel.isPending ? <Spinner /> : <CircleX data-icon="inline-start" />}
            Cancel &amp; refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Decision #13: the company admin approves redemptions in the Business Portal — HealthX only waits. */
function AwaitingCompany({ order }: { order: OrderDetail }) {
  const days = order.daysSincePlaced
  return (
    <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 p-3.5 text-sm">
      <Hourglass className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="space-y-1">
        <p className="font-semibold text-amber-900 dark:text-amber-200">Awaiting {order.companyName}&apos;s approval</p>
        <p className="text-amber-900/80 dark:text-amber-200/80">
          Company admins approve redemptions in their Business Portal. HealthX can start fulfilment as soon as it&apos;s approved.
        </p>
        {days >= 3 ? (
          <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
            Waiting {days} days — consider reminding the company&apos;s HR admin through your usual account contact.
          </p>
        ) : null}
      </div>
    </div>
  )
}

/** SCR-P-015 order drawer: summary, delivery details, timeline and fulfilment actions. */
export function OrderSheet({ orderId, onOpenChange }: { orderId: string | null; onOpenChange: (open: boolean) => void }) {
  const can = useAdminCan()
  const [cancelOpen, setCancelOpen] = useState(false)
  const q = useApiQuery(["admin", "order", orderId], () => ordersApi.get({ id: orderId! }), { enabled: !!orderId })
  const o = q.data
  const DeliveryIcon = o ? DELIVERY_META[o.rewardDelivery].icon : null

  return (
    <Sheet open={!!orderId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <SheetTitle className="font-heading text-lg">{o ? `Order ${o.orderNumber}` : "Order"}</SheetTitle>
            {o ? <StatusBadge status={o.status} /> : null}
          </div>
          <SheetDescription>{o ? `Placed ${formatDateTime(o.createdAt)} · ${o.companyName}` : "Loading order…"}</SheetDescription>
        </SheetHeader>

        {q.isLoading ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : q.error ? (
          <div className="p-4">
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          </div>
        ) : o ? (
          <div className="flex flex-col gap-6 p-4">
            <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <CoverTile emoji={o.rewardEmoji} color={o.rewardColor} size="md" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{o.rewardName}</div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {DeliveryIcon ? <DeliveryIcon className="size-3.5" /> : null}
                  {DELIVERY_META[o.rewardDelivery].label}
                  {o.rewardProvider ? ` · ${o.rewardProvider}` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-1 font-heading text-lg font-bold tabular-nums">
                  <Coins className="size-4 text-amber-500" /> {formatNumber(o.points * Math.max(1, o.quantity))}
                </div>
                <div className="text-xs text-muted-foreground">points{o.quantity > 1 ? ` · qty ${o.quantity}` : ""}</div>
              </div>
            </div>

            {can("orders.manage") ? <FulfilPanel key={`${o.id}-${o.status}`} order={o} onCancel={() => setCancelOpen(true)} /> : null}
            {o.status === "pending_approval" ? <AwaitingCompany order={o} /> : null}
            {o.status === "delivered" ? (
              <p className="rounded-xl bg-emerald-500/8 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">This order is complete. The employee was notified.</p>
            ) : o.status === "cancelled" || o.status === "rejected" ? (
              <p className="rounded-xl bg-rose-500/8 px-3 py-2 text-sm text-rose-800 dark:text-rose-300">This order was {ORDER_STATUS_LABEL[o.status].toLowerCase()} and the points were refunded.</p>
            ) : null}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Order summary</h3>
              <KeyValueList
                items={[
                  { label: "Order no.", value: <span className="font-mono">{o.orderNumber}</span> },
                  { label: "Company", value: o.companyName },
                  { label: "Status", value: ORDER_STATUS_LABEL[o.status] },
                  { label: "Last update", value: formatDateTime(o.updatedAt) },
                  ...(o.voucherCode ? [{ label: "Voucher code", value: <span className="font-mono">{o.voucherCode}</span> }] : []),
                  ...(o.trackingNumber ? [{ label: "Tracking number", value: <span className="font-mono">{o.trackingNumber}</span> }] : []),
                ]}
              />
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Delivery details</h3>
              <KeyValueList
                items={[
                  { label: "Employee", value: o.delivery.name },
                  { label: "Email", value: o.delivery.email },
                  { label: "Phone", value: o.delivery.phone ?? "—" },
                  { label: "Address", value: o.delivery.address ?? (o.rewardDelivery === "physical" ? "—" : "Not needed (digital delivery)") },
                  ...(o.delivery.notes ? [{ label: "Notes", value: o.delivery.notes }] : []),
                ]}
              />
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Timeline</h3>
              <OrderTimeline order={o} delivery={o.rewardDelivery} />
            </section>

            <CancelDialog order={o} open={cancelOpen} onOpenChange={setCancelOpen} />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
