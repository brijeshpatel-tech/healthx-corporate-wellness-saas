"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Coins } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { CoverTile } from "@/components/business/engagement/cover-picker"
import { TextareaField, TextField } from "@/components/common/form-fields"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { ordersApi, type OrderAction, type OrderDetail } from "@/lib/api/business/orders"
import { useApiMutation } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import type { RewardDelivery } from "@/lib/types"
import { ACTION_META } from "./order-meta"

const CODE = /^[A-Za-z0-9-]{4,40}$/

function schemaFor(action: OrderAction, delivery: RewardDelivery) {
  return z
    .object({
      reason: z.string(),
      note: z.string().max(300, "Keep the note under 300 characters"),
      trackingNumber: z.string(),
      voucherCode: z.string(),
    })
    .superRefine((v, ctx) => {
      if (action === "reject" || action === "cancel") {
        const r = v.reason.trim()
        if (r.length < 5) ctx.addIssue({ code: "custom", path: ["reason"], message: "Tell the employee why (at least 5 characters)" })
        else if (r.length > 300) ctx.addIssue({ code: "custom", path: ["reason"], message: "Keep the reason under 300 characters" })
      }
      if (action === "ship") {
        const t = v.trackingNumber.trim()
        if (!t) ctx.addIssue({ code: "custom", path: ["trackingNumber"], message: "Enter the courier tracking number" })
        else if (!CODE.test(t)) ctx.addIssue({ code: "custom", path: ["trackingNumber"], message: "Use 4–40 letters, numbers or dashes" })
      }
      if (action === "deliver" && delivery === "digital_voucher") {
        const c = v.voucherCode.trim()
        if (!c) ctx.addIssue({ code: "custom", path: ["voucherCode"], message: "Enter the voucher code — it's required for e-voucher rewards" })
        else if (!CODE.test(c)) ctx.addIssue({ code: "custom", path: ["voucherCode"], message: "Use 4–40 letters, numbers or dashes" })
      }
    })
}
type Values = z.infer<ReturnType<typeof schemaFor>>

const SUCCESS: Record<OrderAction, (o: OrderDetail) => string> = {
  approve: () => "Order approved – employee notified.",
  reject: (o) => `Order rejected – ${formatNumber(o.points)} points refunded.`,
  process: () => "Order marked as processing – employee notified.",
  ship: () => "Order marked as shipped – employee notified.",
  deliver: () => "Order marked as delivered – employee notified.",
  cancel: (o) => `Order cancelled – ${formatNumber(o.points)} points refunded.`,
}

/** Confirms an order action and collects what it needs (reason, tracking number, voucher code, note). */
export function OrderActionDialog({
  order,
  action,
  onOpenChange,
  onConflict,
}: {
  order: OrderDetail
  action: OrderAction | null
  onOpenChange: (open: boolean) => void
  /** Called when another admin changed the order first (409). */
  onConflict: () => void
}) {
  return (
    <Dialog open={!!action} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {action ? <ActionForm key={`${action}-${order.status}`} order={order} action={action} onClose={() => onOpenChange(false)} onConflict={onConflict} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function ActionForm({ order, action, onClose, onConflict }: { order: OrderDetail; action: OrderAction; onClose: () => void; onConflict: () => void }) {
  const meta = ACTION_META[action]
  const delivery = order.reward.delivery
  const form = useForm<Values>({
    resolver: zodResolver(schemaFor(action, delivery)),
    defaultValues: { reason: "", note: "", trackingNumber: order.trackingNumber ?? "", voucherCode: order.voucherCode ?? "" },
  })

  const run = (v: Values) => {
    const base = { id: order.id, fromStatus: order.status, note: v.note.trim() || undefined }
    switch (action) {
      case "approve":
        return ordersApi.approve(base)
      case "reject":
        return ordersApi.reject({ ...base, reason: v.reason })
      case "cancel":
        return ordersApi.cancel({ ...base, reason: v.reason })
      case "process":
        return ordersApi.fulfil({ ...base, step: "processing" })
      case "ship":
        return ordersApi.fulfil({ ...base, step: "shipped", trackingNumber: v.trackingNumber })
      case "deliver":
        return ordersApi.fulfil({ ...base, step: "delivered", voucherCode: delivery === "digital_voucher" ? v.voucherCode : undefined })
    }
  }

  const mutation = useApiMutation(run, {
    success: (o) => SUCCESS[action](o),
    onSuccess: onClose,
    onError: (err) => {
      if (err instanceof ApiError && err.code === "conflict") {
        onClose()
        onConflict()
        return
      }
      if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
    },
  })

  const needsReason = action === "reject" || action === "cancel"
  const Icon = meta.icon

  return (
    <>
      <DialogHeader>
        <DialogTitle>{meta.title}</DialogTitle>
        <DialogDescription>{meta.hint}</DialogDescription>
      </DialogHeader>
      <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
        <CoverTile emoji={order.reward.emoji} color={order.reward.color} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{order.reward.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {order.orderNumber} · {order.employee?.name ?? order.delivery.name}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-amber-600 tabular-nums dark:text-amber-400">
          <Coins className="size-4" /> {formatNumber(order.points)}
        </span>
      </div>
      <form id="order-action-form" noValidate className="grid gap-4" onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
        {needsReason ? (
          <TextareaField
            control={form.control}
            name="reason"
            label={action === "reject" ? "Reason for rejecting" : "Reason for cancelling"}
            placeholder={action === "reject" ? "e.g. This reward is limited to one per person per year." : "e.g. The item is no longer available from our supplier."}
            description="The employee sees this in their notification."
            rows={3}
            maxLength={300}
            required
          />
        ) : null}
        {action === "ship" ? <TextField control={form.control} name="trackingNumber" label="Tracking number" placeholder="e.g. DL123456789IN" required autoComplete="off" /> : null}
        {action === "deliver" && delivery === "digital_voucher" ? (
          <TextField control={form.control} name="voucherCode" label="Voucher code" placeholder="e.g. HX7Q2M9KDL4P" required autoComplete="off" description="Shown to the employee in My orders." />
        ) : null}
        {!needsReason ? <TextareaField control={form.control} name="note" label="Note to employee" placeholder="Optional — e.g. Collect it from reception on the 3rd floor." rows={2} maxLength={300} /> : null}
        {needsReason ? (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            {formatNumber(order.points)} points go back to the employee&apos;s wallet{order.reward.stock !== null ? " and the item returns to stock" : ""}. This can&apos;t be undone.
          </p>
        ) : null}
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Keep as is
        </Button>
        <Button type="submit" form="order-action-form" variant={meta.destructive ? "destructive" : "default"} disabled={mutation.isPending}>
          {mutation.isPending ? <Spinner /> : <Icon data-icon="inline-start" />}
          {meta.label}
        </Button>
      </DialogFooter>
    </>
  )
}
