"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Coins, Mail, Package, ShieldCheck, Truck } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { CheckboxField, TextareaField, TextField } from "@/components/common/form-fields"
import { EmptyState } from "@/components/common/states"
import { Confetti } from "@/components/employee/engage/celebration"
import { EngagePage, LoadError } from "@/components/employee/engage/page"
import { RewardImage } from "@/components/employee/engage/reward-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { needsAddress, rewardsApi, type RedeemResult, type RewardDetail } from "@/lib/api/employee/rewards"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"

/** SCR-M-056 Redeem Reward — confirm & delivery details. */
export default function RedeemPage() {
  const { id } = useParams<{ id: string }>()
  const q = useApiQuery(["employee", "reward", id], () => rewardsApi.detail({ id }))
  const [result, setResult] = useState<RedeemResult | null>(null)
  return (
    <EngagePage size="narrow">
      {!result ? (
        <Link href={`/employee-app/rewards/${id}`} className="-mb-2 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to reward
        </Link>
      ) : null}
      {result && q.data ? (
        <Success r={q.data} result={result} />
      ) : q.error ? (
        q.error.status === 404 ? (
          <EmptyState icon={Package} title="This reward is no longer available." action={<Button asChild><Link href="/employee-app/rewards">Browse rewards</Link></Button>} />
        ) : (
          <LoadError title="Couldn't load this reward." error={q.error} onRetry={() => q.refetch()} />
        )
      ) : !q.data ? (
        <>
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </>
      ) : !q.data.canRedeem ? (
        <EmptyState
          icon={AlertTriangle}
          title={q.data.blockedReason ?? "You can't redeem this reward right now."}
          action={
            <Button asChild variant="outline">
              <Link href="/employee-app/rewards">Browse other rewards</Link>
            </Button>
          }
        />
      ) : (
        <RedeemForm r={q.data} onDone={setResult} />
      )}
    </EngagePage>
  )
}

function buildSchema(physical: boolean) {
  return z.object({
    delivery: z.object({
      name: z.string().trim().min(2, "Enter the recipient's name").max(80, "Keep it under 80 characters"),
      email: z.string().trim().email("Enter a valid email address"),
      phone: physical
        ? z
            .string()
            .trim()
            .regex(/^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/, "Enter a valid 10-digit mobile number")
        : z.string().trim().optional(),
      address: physical ? z.string().trim().min(15, "Enter the full address with PIN code").max(300, "Keep it under 300 characters").regex(/\d{6}/, "Include the 6-digit PIN code") : z.string().optional(),
      notes: z.string().trim().max(200, "Keep notes under 200 characters").optional(),
    }),
    confirm: z.boolean().refine((v) => v, "Please confirm the points deduction"),
  })
}
type Values = z.infer<ReturnType<typeof buildSchema>>

function RedeemForm({ r, onDone }: { r: RewardDetail; onDone: (res: RedeemResult) => void }) {
  const physical = needsAddress(r.delivery)
  const schema = useMemo(() => buildSchema(physical), [physical])
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { delivery: { name: r.defaults.name, email: r.defaults.email, phone: r.defaults.phone, address: "", notes: "" }, confirm: false },
  })
  const key = useRef<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const qc = useQueryClient()
  const redeem = useApiMutation(rewardsApi.redeem, {
    errorTitle: "Redemption failed",
    // Show the success panel first, then refresh balances everywhere (avoids a flash of the "limit reached" state).
    invalidate: false,
    onSuccess: (res) => {
      onDone(res)
      void qc.invalidateQueries()
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) {
        Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as never, { message }))
      }
      setApiError(err instanceof ApiError && err.status !== 0 && err.status < 500 ? err.message : "Something went wrong – no points were deducted.")
    },
  })

  const onValid = (v: Values) => {
    setApiError(null)
    // One idempotency key per redemption attempt on this screen → points are deducted exactly once.
    if (!key.current) key.current = `rdm_${r.id}_${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString(36)}`
    redeem.mutate({ id: r.id, idempotencyKey: key.current, confirm: v.confirm, delivery: { ...v.delivery, phone: v.delivery.phone || undefined, address: v.delivery.address || undefined } })
  }

  return (
    <>
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Redeem reward</h1>
        <p className="text-sm text-muted-foreground">Check the details below — points are deducted once you confirm.</p>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="flex items-center gap-4 p-4">
          <RewardImage emoji={r.emoji} color={r.color} size="sm" className="size-16 rounded-2xl text-3xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{r.name}</p>
            <p className="text-xs text-muted-foreground">{r.deliveryLabel}</p>
          </div>
        </CardContent>
        <div className="grid grid-cols-3 border-t text-center">
          <div className="p-3">
            <p className="text-[11px] text-muted-foreground">Balance</p>
            <p className="font-heading font-bold tabular-nums">{formatNumber(r.balance)}</p>
          </div>
          <div className="border-x p-3">
            <p className="text-[11px] text-muted-foreground">Cost</p>
            <p className="font-heading font-bold text-amber-600 tabular-nums dark:text-amber-400">−{formatNumber(r.pointsCost)}</p>
          </div>
          <div className="p-3">
            <p className="text-[11px] text-muted-foreground">Balance after</p>
            <p className="font-heading font-bold tabular-nums">{formatNumber(r.balanceAfter)}</p>
          </div>
        </div>
      </Card>

      <form onSubmit={(e) => void form.handleSubmit(onValid)(e)} noValidate className="flex flex-col gap-5">
        <Card className="gap-0 py-0">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              {physical ? <Truck className="size-4 text-primary" /> : <Mail className="size-4 text-primary" />}
              <h2 className="font-heading text-base font-semibold">{physical ? "Delivery address" : "Where should we send it?"}</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="delivery.name" label="Recipient name" autoComplete="name" required />
              <TextField control={form.control} name="delivery.email" label={physical ? "Email for updates" : "Delivery email"} type="email" autoComplete="email" required description={physical ? undefined : "Your code or confirmation is sent here."} />
              {physical ? (
                <>
                  <TextField control={form.control} name="delivery.phone" label="Mobile number" type="tel" autoComplete="tel" placeholder="+91 98765 43210" required className="sm:col-span-2" />
                  <TextareaField control={form.control} name="delivery.address" label="Full address" placeholder="Flat / house, street, area, city, PIN code" rows={3} maxLength={300} required className="sm:col-span-2" />
                </>
              ) : null}
              <TextareaField control={form.control} name="delivery.notes" label="Notes (optional)" placeholder={physical ? "Landmark or delivery instructions" : "Anything we should know?"} rows={2} maxLength={200} className="sm:col-span-2" />
            </div>
            {physical ? (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
                Your phone and address are encrypted and only visible to the team fulfilling your order.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="rounded-2xl border bg-card p-4">
          <CheckboxField control={form.control} name="confirm" label={`I understand ${formatNumber(r.pointsCost)} points will be deducted from my balance.`} description={r.approvalRequired ? "Your company approves orders first. If it's rejected, your points are refunded." : undefined} />
        </div>

        {apiError ? (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/8 px-3.5 py-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {apiError}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button asChild variant="outline" size="lg" className="h-11 rounded-xl">
            <Link href={`/employee-app/rewards/${r.id}`}>Cancel</Link>
          </Button>
          <Button type="submit" size="lg" className="h-11 rounded-xl px-6 font-semibold" disabled={redeem.isPending}>
            {redeem.isPending ? <Spinner /> : <Coins data-icon="inline-start" />}
            Confirm redemption
          </Button>
        </div>
      </form>
    </>
  )
}

function Success({ r, result }: { r: RewardDetail; result: RedeemResult }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border bg-card px-6 pt-10 pb-8 text-center shadow-sm" style={{ background: `radial-gradient(120% 70% at 50% 0%, ${r.color}33, transparent 70%)` }}>
      <Confetti pieces={80} />
      <div className="relative flex flex-col items-center gap-4">
        <div className="animate-in duration-700 zoom-in-50 fade-in-0">
          <RewardImage emoji={r.emoji} color={r.color} size="sm" className="size-28 rounded-3xl text-6xl shadow-lg" />
        </div>
        {result.approvalRequired ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <Clock className="size-3.5" /> Waiting for approval
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-3.5" /> Approved
          </span>
        )}
        <div className="space-y-1.5">
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">Order placed!</h1>
          <p className="text-sm text-muted-foreground">
            {formatNumber(result.pointsDeducted)} points deducted. Track it in My Orders.
            {result.approvalRequired ? " Your company will review it shortly — if it's rejected, your points come back." : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            Order {result.orderNumber} · New balance {formatNumber(result.balanceAfter)} pts
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 pt-2 sm:w-auto sm:flex-row">
          <Button asChild size="lg" className="h-11 rounded-xl px-6">
            <Link href={`/employee-app/orders/${result.orderId}`}>View order</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11 rounded-xl px-6">
            <Link href="/employee-app/rewards">Back to rewards</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
