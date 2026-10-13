"use client"

import { Check, CreditCard, Download, Hourglass, IndianRupee, Landmark, LifeBuoy, MessageSquareText, Minus, Smartphone, Users, Wallet } from "lucide-react"
import { useState } from "react"
import { DataTable, type Column } from "@/components/common/data-table"
import { SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { ErrorState, PageSkeleton } from "@/components/common/states"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { billingApi, type SubscriptionOverview } from "@/lib/api/business/billing"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { downloadText } from "@/lib/download"
import { formatCurrency, formatDate, formatNumber, formatPercent, titleCase } from "@/lib/format"
import type { Invoice } from "@/lib/types"
import { cn } from "@/lib/utils"

/** SCR-B-044 — Subscription & invoices (Phase 2). Plan changes go through HealthX. */
export default function SubscriptionPage() {
  const sub = useApiQuery(["business", "subscription"], () => billingApi.subscription())
  const invoices = useApiQuery(["business", "invoices"], () => billingApi.invoices())
  const [changeOpen, setChangeOpen] = useState(false)
  const [paying, setPaying] = useState<Invoice | null>(null)
  const download = useApiMutation(billingApi.invoicePdf, { invalidate: false, success: "Invoice downloaded.", onSuccess: (r) => downloadText(r.fileName, r.html, "text/html;charset=utf-8") })

  const columns: Column<Invoice>[] = [
    { key: "number", header: "Invoice", sortValue: (i) => i.number, cell: (i) => <span className="font-mono text-sm font-medium">{i.number}</span> },
    { key: "period", header: "Period", sortValue: (i) => i.periodStart, cell: (i) => <span className="text-sm">{formatDate(i.periodStart, "MMM yyyy")}</span> },
    { key: "seats", header: "Active employees", align: "right", cell: (i) => <span className="tabular-nums">{formatNumber(i.seats)}</span>, hideOnMobile: true },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortValue: (i) => i.amount + i.tax,
      cell: (i) => (
        <div className="text-right">
          <div className="font-semibold tabular-nums">{formatCurrency(i.amount + i.tax, i.currency)}</div>
          <div className="text-xs text-muted-foreground">incl. {formatCurrency(i.tax, i.currency)} GST</div>
        </div>
      ),
    },
    { key: "status", header: "Status", cell: (i) => <StatusBadge status={i.status} /> },
    { key: "due", header: "Due", cell: (i) => <span className="text-sm text-muted-foreground">{i.paidAt ? `Paid ${formatDate(i.paidAt, "d MMM")}` : formatDate(i.dueAt)}</span>, hideOnMobile: true },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (i) => (
        <div className="flex justify-end gap-1">
          {i.status === "due" || i.status === "overdue" ? (
            <Button size="sm" onClick={() => setPaying(i)}>
              <Wallet data-icon="inline-start" /> Pay now
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => download.mutate({ id: i.id })} aria-label={`Download ${i.number}`}>
            <Download data-icon="inline-start" /> PDF
          </Button>
        </div>
      ),
    },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Subscription & invoices"
        badge={<PhaseBadge phase={2} />}
        description="Your plan, usage and invoices. To change your plan or number of employees, contact HealthX."
        actions={
          <Button variant="outline" onClick={() => setChangeOpen(true)} disabled={!sub.data}>
            <MessageSquareText data-icon="inline-start" /> Contact HealthX to change plan
          </Button>
        }
      />
      {sub.isLoading ? (
        <PageSkeleton kpis={3} />
      ) : sub.error ? (
        <ErrorState error={sub.error} onRetry={() => sub.refetch()} />
      ) : (
        <Overview data={sub.data!} onChangePlan={() => setChangeOpen(true)} />
      )}

      <section className="space-y-3">
        <div>
          <h2 className="font-heading text-base font-semibold">Invoices</h2>
          <p className="text-sm text-muted-foreground">Invoices are issued monthly for active employees. Pay online, or by bank transfer using the details on the invoice.</p>
        </div>
        {invoices.error ? (
          <ErrorState error={invoices.error} onRetry={() => invoices.refetch()} />
        ) : (
          <DataTable columns={columns} rows={invoices.data ?? []} getRowId={(i) => i.id} loading={invoices.isLoading} clientPageSize={8} emptyTitle="No invoices yet." emptyDescription="Your first invoice appears at the end of your first billing month." />
        )}
      </section>

      {sub.data ? <ChangePlanDialog open={changeOpen} onOpenChange={setChangeOpen} data={sub.data} /> : null}
      <PayDialog invoice={paying} onClose={() => setPaying(null)} />
    </PageContainer>
  )
}

function Overview({ data, onChangePlan }: { data: SubscriptionOverview; onChangePlan: () => void }) {
  const { plan, subscription: s, usage } = data
  const limit = usage.planLimit ?? s.seats
  const usedShare = limit ? usage.activeEmployees / limit : 0
  return (
    <div className="flex flex-col gap-6">
      {data.trial ? (
        <Alert className="border-violet-500/30 bg-violet-500/[0.06]">
          <Hourglass />
          <AlertTitle>
            Free trial — {data.trial.daysLeft} {data.trial.daysLeft === 1 ? "day" : "days"} left
          </AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>Your 30-day trial of the {plan.name} plan ends on {formatDate(data.trial.endsAt)}. Choose a plan to keep your data and challenges running.</span>
            <Button size="sm" onClick={onChangePlan}>
              Choose a plan
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {data.openRequest ? (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/[0.05] px-4 py-3 text-sm">
          <span className="font-semibold">Request {data.openRequest.number} is open</span> <span className="text-muted-foreground">— you asked to move to {data.openRequest.plan} on {formatDate(data.openRequest.createdAt)}. HealthX will be in touch.</span>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active employees" value={formatNumber(usage.activeEmployees)} icon={Users} tone="emerald" hint={`of ${formatNumber(limit)} ${usage.planLimit ? "plan limit" : "seats"}`} />
        <StatCard label="Price per active employee" value={formatCurrency(plan.pricePerEmployee, plan.currency)} icon={IndianRupee} tone="sky" hint={`per month · billed ${plan.billingCycle}`} />
        <StatCard label="Next invoice (estimate)" value={formatCurrency(data.nextInvoice.estimate, data.nextInvoice.currency)} icon={CreditCard} tone="violet" hint={`on ${formatDate(data.nextInvoice.date)}, incl. GST`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title={
            <span className="inline-flex items-center gap-2">
              {plan.name} plan <StatusBadge status={s.status} />
            </span>
          }
          description={plan.description}
        >
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {data.modules.map((m) => (
              <div key={m.code} className={cn("flex items-center gap-2 text-sm", !m.included && "text-muted-foreground")}>
                {m.included ? <Check className="size-4 shrink-0 text-emerald-600" /> : <Minus className="size-4 shrink-0" />}
                {m.label}
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Usage & renewal">
          <div className="space-y-4 text-sm">
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active employees</span>
                <span className="font-medium tabular-nums">
                  {formatNumber(usage.activeEmployees)} / {formatNumber(limit)}
                </span>
              </div>
              <Progress value={Math.min(100, usedShare * 100)} className="h-2" />
              <p className="text-xs text-muted-foreground">{formatPercent(usedShare)} of your limit · {formatNumber(usage.registeredEmployees)} registered</p>
            </div>
            <Row label={data.trial ? "Trial ends" : "Renews on"} value={formatDate(data.trial?.endsAt ?? s.renewalDate)} />
            <Row label="Started" value={formatDate(s.startDate)} />
            <Row label="Billing" value={titleCase(s.billingCycle)} />
            <Row
              label="Support"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <LifeBuoy className="size-3.5" /> {titleCase(plan.supportLevel)}
                </span>
              }
            />
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function ChangePlanDialog({ open, onOpenChange, data }: { open: boolean; onOpenChange: (o: boolean) => void; data: SubscriptionOverview }) {
  const [planId, setPlanId] = useState(data.otherPlans[0]?.id ?? data.plan.id)
  const [seats, setSeats] = useState("")
  const [message, setMessage] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const request = useApiMutation(billingApi.requestPlanChange, {
    success: (r) => `Request ${r.number} sent — HealthX will contact you shortly.`,
    onSuccess: () => {
      setMessage("")
      setErrors({})
      onOpenChange(false)
    },
    onError: (e) => setErrors(e.fieldErrors ?? {}),
  })
  const options = [{ id: data.plan.id, name: `${data.plan.name} (current)`, description: "Change seats or billing", pricePerEmployee: data.plan.pricePerEmployee, currency: data.plan.currency, minEmployees: data.plan.minEmployees, maxEmployees: data.plan.maxEmployees }, ...data.otherPlans]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Change your plan</DialogTitle>
          <DialogDescription>Tell us what you need and the HealthX team will get back to you within one business day.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <RadioGroup value={planId} onValueChange={setPlanId} className="gap-2">
            {options.map((p) => (
              <Label key={p.id} htmlFor={`plan-${p.id}`} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                <RadioGroupItem id={`plan-${p.id}`} value={p.id} className="mt-0.5" />
                <span className="flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="text-sm font-semibold tabular-nums">{formatCurrency(p.pricePerEmployee, p.currency)}/employee</span>
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {p.description} · {formatNumber(p.minEmployees)}
                    {p.maxEmployees ? `–${formatNumber(p.maxEmployees)}` : "+"} employees
                  </span>
                </span>
              </Label>
            ))}
          </RadioGroup>
          <div className="space-y-1.5">
            <Label htmlFor="seats" className="text-sm font-medium">
              Expected active employees <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id="seats" type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} className="h-9 w-40" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="msg" className="text-sm font-medium">
              Message<span className="text-destructive">*</span>
            </Label>
            <Textarea id="msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. We'd like integrations and the AI Coach for 1,200 employees from next month." aria-invalid={!!errors.message} />
            {errors.message ? <p className="text-xs font-medium text-destructive">{errors.message}</p> : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => request.mutate({ planId, seats: seats ? Number(seats) : undefined, message })} disabled={request.isPending}>
            {request.isPending ? <Spinner /> : <MessageSquareText data-icon="inline-start" />}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PayDialog({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const [method, setMethod] = useState<"upi" | "card" | "netbanking">("upi")
  const pay = useApiMutation(billingApi.payInvoice, { success: (i) => `Payment received for ${i.number}. Thank you!`, onSuccess: onClose })
  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            Pay invoice <PhaseBadge phase={2} />
          </DialogTitle>
          <DialogDescription>{invoice ? `${invoice.number} · ${formatCurrency(invoice.amount + invoice.tax, invoice.currency)} incl. GST` : ""}</DialogDescription>
        </DialogHeader>
        <RadioGroup value={method} onValueChange={(v) => setMethod(v as typeof method)} className="gap-2">
          {[
            { v: "upi", l: "UPI", d: "Pay with any UPI app", i: Smartphone },
            { v: "card", l: "Credit or debit card", d: "Visa, Mastercard, RuPay", i: CreditCard },
            { v: "netbanking", l: "Net banking", d: "All major Indian banks", i: Landmark },
          ].map((o) => (
            <Label key={o.v} htmlFor={`pm-${o.v}`} className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
              <RadioGroupItem id={`pm-${o.v}`} value={o.v} />
              <o.i className="size-4 text-muted-foreground" />
              <span>
                <span className="block text-sm font-medium">{o.l}</span>
                <span className="block text-xs text-muted-foreground">{o.d}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
        <p className="text-xs text-muted-foreground">Sample data: no money moves. In production you&apos;re taken to the secure payment page.</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => invoice && pay.mutate({ id: invoice.id, method })} disabled={pay.isPending}>
            {pay.isPending ? <Spinner /> : <Wallet data-icon="inline-start" />}
            Pay {invoice ? formatCurrency(invoice.amount + invoice.tax, invoice.currency) : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
