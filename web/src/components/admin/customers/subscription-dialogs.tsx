"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight, Ban, CalendarClock, Info, Repeat, Save } from "lucide-react"
import { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { SelectField, SwitchField, TextareaField, TextField } from "@/components/common/form-fields"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { defaultRenewal, subscriptionsApi, type PlanOption, type SubscriptionRow } from "@/lib/api/platform/subscriptions"
import { formatCurrency, formatDate, formatNumber } from "@/lib/format"
import { MODULE_LABEL, type ModuleCode } from "@/lib/types"

const DATE = /^\d{4}-\d{2}-\d{2}$/
const todayLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Maps API field errors onto the form. */
function fieldErrorMapper<T extends Record<string, unknown>>(setError: (name: keyof T & string, e: { message: string }) => void) {
  return (err: ApiError) => {
    if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => setError(k as keyof T & string, { message }))
  }
}

const useLookups = (enabled: boolean) => useApiQuery(["admin", "subscriptions", "lookups"], () => subscriptionsApi.lookups(), { enabled })

const planLabel = (p: PlanOption) => `${p.name} — ${formatCurrency(p.pricePerEmployee, p.currency)} / employee`

function ModuleDiff({ from, to }: { from: ModuleCode[]; to: ModuleCode[] }) {
  const added = to.filter((m) => !from.includes(m))
  const removed = from.filter((m) => !to.includes(m))
  if (!added.length && !removed.length) return <span className="text-muted-foreground">Same modules as today.</span>
  return (
    <div className="flex flex-wrap gap-1">
      {added.map((m) => (
        <Badge key={m} className="bg-emerald-500/12 font-normal text-emerald-700 dark:text-emerald-300">
          + {MODULE_LABEL[m].split(" (")[0]}
        </Badge>
      ))}
      {removed.map((m) => (
        <Badge key={m} className="bg-rose-500/12 font-normal text-rose-700 dark:text-rose-300">
          − {MODULE_LABEL[m].split(" (")[0]}
        </Badge>
      ))}
    </div>
  )
}

// ─── Change plan ─────────────────────────────────────────────────────────

const changeSchema = z.object({
  planId: z.string().min(1, "Choose a plan"),
  seats: z.number({ error: "Enter the number of seats" }).int("Use a whole number").min(1, "Enter at least 1 seat."),
  billingCycle: z.enum(["monthly", "annual"]),
  note: z.string().trim().max(200, "Keep the note under 200 characters"),
})
type ChangeValues = z.infer<typeof changeSchema>

export function ChangePlanDialog({ sub, onOpenChange }: { sub: SubscriptionRow | null; onOpenChange: (open: boolean) => void }) {
  const lookups = useLookups(!!sub)
  const form = useForm<ChangeValues>({ resolver: zodResolver(changeSchema), defaultValues: { planId: "", seats: 1, billingCycle: "monthly", note: "" } })
  const [planId, seats] = useWatch({ control: form.control, name: ["planId", "seats"] })

  useEffect(() => {
    if (sub) form.reset({ planId: sub.planId, seats: sub.seats, billingCycle: sub.billingCycle, note: "" })
  }, [sub, form])

  const change = useApiMutation(subscriptionsApi.changePlan, {
    success: "Subscription updated.",
    onSuccess: () => onOpenChange(false),
    onError: fieldErrorMapper<ChangeValues>(form.setError),
  })

  const plans = lookups.data?.plans ?? []
  const current = plans.find((p) => p.id === sub?.planId)
  const next = plans.find((p) => p.id === planId)
  const newMrr = sub && next ? (sub.status === "active" || sub.status === "past_due" ? sub.activeSeats * next.pricePerEmployee : 0) : 0

  const submit = form.handleSubmit((v) => {
    if (!sub) return
    if (v.seats < sub.activeSeats) return form.setError("seats", { message: `Seat limit can't be below the ${formatNumber(sub.activeSeats)} employees already active.` })
    const plan = plans.find((p) => p.id === v.planId)
    if (plan?.maxEmployees && v.seats > plan.maxEmployees) return form.setError("seats", { message: `${plan.name} allows up to ${formatNumber(plan.maxEmployees)} employees.` })
    change.mutate({ id: sub.id, ...v })
  })

  return (
    <Dialog open={!!sub} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Change plan</DialogTitle>
          <DialogDescription>{sub ? `${sub.companyName} is on ${sub.planName} with ${formatNumber(sub.seats)} seats.` : null}</DialogDescription>
        </DialogHeader>
        <form id="change-plan-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          {/* Archived/draft current plans are not in the list; keep them selectable as "current". */}
          <SelectField
            control={form.control}
            name="planId"
            label="New plan"
            required
            className="sm:col-span-2"
            disabled={lookups.isLoading}
            placeholder={lookups.isLoading ? "Loading plans…" : "Choose a plan"}
            options={[
              ...(sub && !current ? [{ value: sub.planId, label: `${sub.planName} (current, no longer offered)` }] : []),
              ...plans.map((p) => ({ value: p.id, label: `${planLabel(p)}${p.id === sub?.planId ? " (current)" : ""}` })),
            ]}
          />
          <TextField
            control={form.control}
            name="seats"
            label="Seat limit"
            type="number"
            required
            description={sub ? `${formatNumber(sub.activeSeats)} employees are active today.` : undefined}
          />
          <SelectField
            control={form.control}
            name="billingCycle"
            label="Billing cycle"
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "annual", label: "Annual" },
            ]}
          />
          {sub && next ? (
            <div className="space-y-3 rounded-xl border bg-muted/30 p-3 text-sm sm:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">MRR</span>
                <span className="font-medium tabular-nums">{formatCurrency(sub.mrr, sub.currency)}</span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
                <span className="font-semibold tabular-nums">{formatCurrency(newMrr, next.currency)}</span>
                {sub.status === "trial" ? <span className="text-xs text-muted-foreground">(trial — no charge until converted)</span> : null}
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Module access</div>
                <ModuleDiff from={current?.modules ?? []} to={next.modules} />
              </div>
              {next.maxEmployees && typeof seats === "number" && seats > next.maxEmployees ? (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  {next.name} is designed for up to {formatNumber(next.maxEmployees)} employees.
                </p>
              ) : null}
            </div>
          ) : null}
          <TextareaField control={form.control} name="note" label="Internal note" rows={2} maxLength={200} placeholder="Optional — e.g. upgrade agreed on call with HR" className="sm:col-span-2" />
          <p className="flex items-start gap-2 text-xs text-muted-foreground sm:col-span-2">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Takes effect immediately: module access changes for everyone at the company, and the new price applies from the next billing period.
          </p>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="change-plan-form" disabled={change.isPending || lookups.isLoading}>
            {change.isPending ? <Spinner /> : <Repeat data-icon="inline-start" />}
            Change plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit seats / renewal ───────────────────────────────────────────────

const editSchema = z.object({
  seats: z.number({ error: "Enter the number of seats" }).int("Use a whole number").min(1, "Enter at least 1 seat."),
  renewalDate: z.string().regex(DATE, "Choose a renewal date."),
})
type EditValues = z.infer<typeof editSchema>

export function EditSubscriptionDialog({ sub, onOpenChange }: { sub: SubscriptionRow | null; onOpenChange: (open: boolean) => void }) {
  const form = useForm<EditValues>({ resolver: zodResolver(editSchema), defaultValues: { seats: 1, renewalDate: "" } })
  useEffect(() => {
    if (sub) form.reset({ seats: sub.seats, renewalDate: sub.renewalDate })
  }, [sub, form])
  const update = useApiMutation(subscriptionsApi.update, { success: "Subscription updated.", onSuccess: () => onOpenChange(false), onError: fieldErrorMapper<EditValues>(form.setError) })

  const submit = form.handleSubmit((v) => {
    if (!sub) return
    let ok = true
    if (v.seats < sub.activeSeats) {
      form.setError("seats", { message: `Seat limit can't be below the ${formatNumber(sub.activeSeats)} employees already active.` })
      ok = false
    }
    if (v.renewalDate <= sub.startDate) {
      form.setError("renewalDate", { message: "Renewal date must be after the start date." })
      ok = false
    }
    if (ok) update.mutate({ id: sub.id, ...v })
  })

  return (
    <Dialog open={!!sub} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit subscription</DialogTitle>
          <DialogDescription>{sub ? `${sub.companyName} · ${sub.planName} · started ${formatDate(sub.startDate)}` : null}</DialogDescription>
        </DialogHeader>
        <form id="edit-sub-form" onSubmit={submit} className="grid gap-4" noValidate>
          <TextField
            control={form.control}
            name="seats"
            label="Seat limit"
            type="number"
            required
            description={sub ? `${formatNumber(sub.activeSeats)} active employees${sub.maxEmployees ? ` · plan allows up to ${formatNumber(sub.maxEmployees)}` : ""}` : undefined}
          />
          <TextField control={form.control} name="renewalDate" label="Renewal date" type="date" required description={sub ? `Must be after the start date (${formatDate(sub.startDate)}).` : undefined} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="edit-sub-form" disabled={update.isPending}>
            {update.isPending ? <Spinner /> : <Save data-icon="inline-start" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Cancel ─────────────────────────────────────────────────────────────

const cancelSchema = z.object({ reason: z.string().trim().min(5, "Enter a reason (at least 5 characters).").max(300, "Keep the reason under 300 characters") })
type CancelValues = z.infer<typeof cancelSchema>

export function CancelSubscriptionDialog({ sub, onOpenChange }: { sub: SubscriptionRow | null; onOpenChange: (open: boolean) => void }) {
  const form = useForm<CancelValues>({ resolver: zodResolver(cancelSchema), defaultValues: { reason: "" } })
  useEffect(() => {
    if (sub) form.reset({ reason: "" })
  }, [sub, form])
  const cancel = useApiMutation(subscriptionsApi.cancel, {
    success: (s) => `${s.companyName}'s subscription was cancelled`,
    onSuccess: () => onOpenChange(false),
    onError: fieldErrorMapper<CancelValues>(form.setError),
  })
  return (
    <Dialog open={!!sub} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel {sub?.companyName}&apos;s subscription?</DialogTitle>
          <DialogDescription>
            Billing stops{sub && sub.mrr ? ` and MRR drops by ${formatCurrency(sub.mrr, sub.currency)}` : ""}. The company keeps its data, and you can assign a plan again later.
          </DialogDescription>
        </DialogHeader>
        <form id="cancel-sub-form" onSubmit={form.handleSubmit((v) => sub && cancel.mutate({ id: sub.id, reason: v.reason }))} noValidate>
          <TextareaField control={form.control} name="reason" label="Reason" required rows={3} maxLength={300} placeholder="e.g. Customer chose not to renew after the pilot" />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep subscription
          </Button>
          <Button type="submit" form="cancel-sub-form" variant="destructive" disabled={cancel.isPending}>
            {cancel.isPending ? <Spinner /> : <Ban data-icon="inline-start" />}
            Cancel subscription
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Assign plan ────────────────────────────────────────────────────────

const assignSchema = z
  .object({
    companyId: z.string().min(1, "Choose a company"),
    planId: z.string().min(1, "Choose a plan"),
    seats: z.number({ error: "Enter the number of seats" }).int("Use a whole number").min(1, "Enter at least 1 seat."),
    billingCycle: z.enum(["monthly", "annual"]),
    startDate: z.string().regex(DATE, "Choose a start date."),
    renewalDate: z.string().regex(DATE, "Choose a renewal date."),
    trial: z.boolean(),
  })
  .refine((v) => !DATE.test(v.startDate) || !DATE.test(v.renewalDate) || v.renewalDate > v.startDate, { path: ["renewalDate"], message: "Renewal date must be after the start date." })
type AssignValues = z.infer<typeof assignSchema>

const blankAssign = (companyId?: string): AssignValues => {
  const start = todayLocal()
  return { companyId: companyId ?? "", planId: "", seats: 50, billingCycle: "monthly", startDate: start, renewalDate: defaultRenewal(start, "monthly"), trial: false }
}

export function AssignPlanDialog({ open, onOpenChange, companyId }: { open: boolean; onOpenChange: (open: boolean) => void; companyId?: string }) {
  const lookups = useLookups(open)
  const form = useForm<AssignValues>({ resolver: zodResolver(assignSchema), defaultValues: blankAssign(companyId) })
  const [selectedCompany, planId, cycle, startDate, trial] = useWatch({ control: form.control, name: ["companyId", "planId", "billingCycle", "startDate", "trial"] })

  useEffect(() => {
    if (open) form.reset(blankAssign(companyId))
  }, [open, companyId, form])

  // Pre-fill seats from the company's size, and plan billing cycle from the plan.
  const company = lookups.data?.assignable.find((c) => c.id === selectedCompany)
  const plan = lookups.data?.plans.find((p) => p.id === planId)
  useEffect(() => {
    if (company && !form.getFieldState("seats").isDirty) form.setValue("seats", Math.max(1, company.employeeCount))
  }, [company, form])
  useEffect(() => {
    if (plan && !form.getFieldState("billingCycle").isDirty) form.setValue("billingCycle", plan.billingCycle)
  }, [plan, form])
  useEffect(() => {
    if (DATE.test(startDate ?? "") && !form.getFieldState("renewalDate").isDirty) form.setValue("renewalDate", defaultRenewal(startDate, cycle))
  }, [startDate, cycle, form])

  const assign = useApiMutation(subscriptionsApi.assign, {
    success: (s) => `${s.planName} assigned to ${s.companyName}`,
    onSuccess: () => onOpenChange(false),
    onError: fieldErrorMapper<AssignValues>(form.setError),
  })

  const submit = form.handleSubmit((v) => {
    if (company && v.seats < company.activeCount) return form.setError("seats", { message: `Seat limit can't be below the ${formatNumber(company.activeCount)} employees already active.` })
    assign.mutate(v)
  })

  const options = lookups.data?.assignable ?? []
  const nothingToAssign = lookups.data && options.length === 0
  const estMrr = company && plan && !trial ? company.activeCount * plan.pricePerEmployee : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Assign plan</DialogTitle>
          <DialogDescription>Start a new subscription for a company. Each company can have one active subscription.</DialogDescription>
        </DialogHeader>
        {nothingToAssign ? (
          <div className="flex items-start gap-3 rounded-xl border border-dashed bg-muted/30 p-4 text-sm">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <div className="font-medium">Every company already has an active subscription.</div>
              <p className="text-muted-foreground">To move a company to another plan, use “Change plan” on its subscription.</p>
            </div>
          </div>
        ) : (
          <form id="assign-plan-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
            <SelectField
              control={form.control}
              name="companyId"
              label="Company"
              required
              className="sm:col-span-2"
              disabled={lookups.isLoading || !!companyId}
              placeholder={lookups.isLoading ? "Loading…" : "Choose a company"}
              options={options.map((c) => ({ value: c.id, label: c.name }))}
            />
            <SelectField
              control={form.control}
              name="planId"
              label="Plan"
              required
              className="sm:col-span-2"
              disabled={lookups.isLoading}
              placeholder="Choose a plan"
              options={(lookups.data?.plans ?? []).map((p) => ({ value: p.id, label: planLabel(p) }))}
            />
            <TextField
              control={form.control}
              name="seats"
              label="Seat limit"
              type="number"
              required
              description={company ? `${formatNumber(company.employeeCount)} employees · ${formatNumber(company.activeCount)} active` : undefined}
            />
            <SelectField
              control={form.control}
              name="billingCycle"
              label="Billing cycle"
              options={[
                { value: "monthly", label: "Monthly" },
                { value: "annual", label: "Annual" },
              ]}
            />
            <TextField control={form.control} name="startDate" label="Start date" type="date" required />
            <TextField control={form.control} name="renewalDate" label="Renewal date" type="date" required />
            <SwitchField control={form.control} name="trial" label="Start with a 30-day trial" description="No charge during the trial. Convert it to paid from the subscriptions list." className="sm:col-span-2" />
            {plan ? (
              <div className="rounded-xl border bg-muted/30 p-3 text-sm sm:col-span-2">
                <span className="text-muted-foreground">Estimated MRR: </span>
                <span className="font-semibold tabular-nums">{formatCurrency(estMrr, plan.currency)}</span>
                <span className="text-muted-foreground"> · {plan.modules.length} modules switched on for the company</span>
              </div>
            ) : null}
          </form>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {nothingToAssign ? "Close" : "Cancel"}
          </Button>
          {nothingToAssign ? null : (
            <Button type="submit" form="assign-plan-form" disabled={assign.isPending || lookups.isLoading}>
              {assign.isPending ? <Spinner /> : <Save data-icon="inline-start" />}
              Assign plan
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

