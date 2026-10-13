"use client"

import { Ban, CalendarClock, CheckCircle2, CircleDollarSign, CreditCard, Eye, Hourglass, MoreHorizontal, PauseCircle, Pencil, PlayCircle, Plus, Repeat, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { CompanyCell } from "@/components/admin/customers/company-cell"
import { AssignPlanDialog, CancelSubscriptionDialog, ChangePlanDialog, EditSubscriptionDialog } from "@/components/admin/customers/subscription-dialogs"
import { FilterSelect } from "@/components/admin/filter-select"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { DataTable, type Column } from "@/components/common/data-table"
import { ConfirmDialog, InlineBar, SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { StatusBadge } from "@/components/common/status-badge"
import { ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { plansApi } from "@/lib/api/platform/plans"
import { subscriptionsApi, type SubscriptionQuery, type SubscriptionRow } from "@/lib/api/platform/subscriptions"
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/format"
import type { SubscriptionStatus } from "@/lib/types"

const STATUS_OPTIONS: { value: SubscriptionStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "trial", label: "Trial" },
  { value: "past_due", label: "Past due" },
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
]

const trialDaysLeft = (end: string) => Math.max(0, Math.ceil((new Date(`${end}T23:59:59`).getTime() - Date.now()) / 86_400_000))

type DialogState = { kind: "change" | "edit" | "cancel" | "pause"; sub: SubscriptionRow } | { kind: "assign"; companyId?: string } | null

/** SCR-P-010 Subscriptions. Super Admin manages; Support Admin has read-only access. */
export default function SubscriptionsPage() {
  const can = useAdminCan()
  const canManage = can("subscriptions.manage")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [planId, setPlanId] = useState("all")
  const [dialog, setDialog] = useState<DialogState>(null)

  const query: SubscriptionQuery = { search: search || undefined, status: status as SubscriptionQuery["status"], planId: planId === "all" ? undefined : planId }
  const list = useApiQuery(["admin", "subscriptions", query], () => subscriptionsApi.list(query), { placeholderData: (prev) => prev })
  const plans = useApiQuery(["admin", "plans", { status: "all" }], () => plansApi.list({ status: "all" }))
  const activate = useApiMutation(subscriptionsApi.activate, {
    success: (s) => (s.status === "active" ? `${s.companyName}'s subscription is active` : "Subscription updated."),
  })
  const pause = useApiMutation(subscriptionsApi.pause, { success: (s) => `${s.companyName}'s subscription is paused` })

  const summary = list.data?.summary
  const subDialog = dialog && dialog.kind !== "assign" ? dialog : null
  const close = (open: boolean) => !open && setDialog(null)
  const filtered = !!search || status !== "all" || planId !== "all"

  const columns: Column<SubscriptionRow>[] = [
    {
      key: "company",
      header: "Company",
      cell: (s) => (
        <CompanyCell
          name={s.companyName}
          href={`/admin-portal/companies/${s.companyId}`}
          initials={s.companyInitials}
          color={s.companyColor}
          subtitle={
            <>
              <span className="md:hidden">
                {s.planName} · {s.status === "trial" && s.trialEndsAt ? `trial ends ${formatDate(s.trialEndsAt, "d MMM")}` : formatCurrency(s.mrr, s.currency)}
              </span>
              <span className="hidden font-mono md:inline">{s.companyCode}</span>
            </>
          }
        />
      ),
      className: "max-w-60",
      sortValue: (s) => s.companyName,
    },
    {
      key: "plan",
      header: "Plan",
      cell: (s) => (
        <div className="min-w-0">
          <div className="text-sm font-medium">{s.planName}</div>
          <div className="text-xs text-muted-foreground">
            {formatCurrency(s.pricePerEmployee, s.currency)}/emp · {s.billingCycle === "annual" ? "Annual" : "Monthly"}
          </div>
        </div>
      ),
      hideOnMobile: true,
      sortValue: (s) => s.planName,
    },
    { key: "status", header: "Status", cell: (s) => <StatusBadge status={s.status} />, sortValue: (s) => s.status },
    {
      key: "seats",
      header: "Seats (active / limit)",
      cell: (s) => (
        <div className="w-36 space-y-1">
          <div className="flex justify-between text-xs tabular-nums">
            <span className="font-medium">{formatNumber(s.activeSeats)}</span>
            <span className="text-muted-foreground">/ {formatNumber(s.seats)}</span>
          </div>
          <InlineBar value={s.activeSeats} max={s.seats} color={s.activeSeats / Math.max(1, s.seats) > 0.95 ? "var(--chart-4)" : undefined} />
        </div>
      ),
      hideOnMobile: true,
      sortValue: (s) => s.activeSeats / Math.max(1, s.seats),
    },
    {
      key: "mrr",
      header: "MRR",
      align: "right",
      cell: (s) => <span className={`text-sm font-medium tabular-nums ${s.mrr ? "" : "text-muted-foreground"}`}>{formatCurrency(s.mrr, s.currency)}</span>,
      hideOnMobile: true,
      sortValue: (s) => s.mrr,
    },
    { key: "start", header: "Start", cell: (s) => <span className="text-sm whitespace-nowrap text-muted-foreground">{formatDate(s.startDate)}</span>, hideOnMobile: true, sortValue: (s) => s.startDate },
    {
      key: "renewal",
      header: "Renewal",
      cell: (s) =>
        s.status === "cancelled" ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : s.status === "trial" && s.trialEndsAt ? (
          <div className="text-sm whitespace-nowrap">
            <div>Trial ends {formatDate(s.trialEndsAt, "d MMM")}</div>
            <div className="text-xs text-muted-foreground">{trialDaysLeft(s.trialEndsAt)} of 30 days left</div>
          </div>
        ) : (
          <span className="text-sm whitespace-nowrap">{formatDate(s.renewalDate)}</span>
        ),
      hideOnMobile: true,
      sortValue: (s) => s.renewalDate,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (s) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${s.companyName}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <Link href={`/admin-portal/companies/${s.companyId}`}>
                <Eye /> Open company
              </Link>
            </DropdownMenuItem>
            {canManage ? (
              s.status === "cancelled" ? (
                <DropdownMenuItem disabled={!s.canAssign} onClick={() => setDialog({ kind: "assign", companyId: s.companyId })}>
                  <Plus /> Assign plan
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => setDialog({ kind: "change", sub: s })}>
                    <Repeat /> Change plan
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDialog({ kind: "edit", sub: s })}>
                    <Pencil /> Edit seats & renewal
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {s.status === "trial" ? (
                    <DropdownMenuItem onClick={() => activate.mutate({ id: s.id })}>
                      <CheckCircle2 /> Convert to paid
                    </DropdownMenuItem>
                  ) : null}
                  {s.status === "paused" ? (
                    <DropdownMenuItem onClick={() => activate.mutate({ id: s.id })}>
                      <PlayCircle /> Resume
                    </DropdownMenuItem>
                  ) : null}
                  {s.status === "active" || s.status === "past_due" ? (
                    <DropdownMenuItem onClick={() => setDialog({ kind: "pause", sub: s })}>
                      <PauseCircle /> Pause
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem variant="destructive" onClick={() => setDialog({ kind: "cancel", sub: s })}>
                    <Ban /> Cancel subscription
                  </DropdownMenuItem>
                </>
              )
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Subscriptions"
        description="Which plan each company is on, its seats, status and renewal. Changing a plan updates the company's modules straight away."
        actions={
          canManage ? (
            <Button onClick={() => setDialog({ kind: "assign" })}>
              <Plus data-icon="inline-start" /> Assign plan
            </Button>
          ) : null
        }
      />

      {!canManage ? (
        <div className="flex items-start gap-2.5 rounded-xl border bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground">
          <Eye className="mt-0.5 size-4 shrink-0" />
          <p>You have view-only access. Only a Super Admin can change plans, seats or subscription status.</p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Active" value={formatNumber(summary?.active)} icon={CreditCard} tone="emerald" loading={!summary} hint={summary ? `${formatPercent(summary.activeSeats / Math.max(1, summary.seats))} seats used` : undefined} />
        <StatCard label="Trial" value={formatNumber(summary?.trial)} icon={Hourglass} tone="violet" loading={!summary} hint="30-day free trial" />
        <StatCard label="Past due" value={formatNumber(summary?.pastDue)} icon={TriangleAlert} tone="rose" loading={!summary} hint={summary?.pastDue ? "Follow up on payment" : "All paid up"} />
        <StatCard label="Paused / cancelled" value={summary ? `${formatNumber(summary.paused)} / ${formatNumber(summary.cancelled)}` : "—"} icon={CalendarClock} tone="slate" loading={!summary} />
        <StatCard
          label="Total MRR"
          value={summary ? formatCurrency(summary.totalMrr, summary.currency, true) : "—"}
          icon={CircleDollarSign}
          tone="sky"
          loading={!summary}
          hint={summary ? formatCurrency(summary.totalMrr, summary.currency) : undefined}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {list.error && !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={list.data?.items ?? []}
          getRowId={(s) => s.id}
          loading={list.isLoading}
          clientPageSize={12}
          emptyTitle={filtered ? "No subscriptions match these filters" : "No subscriptions yet."}
          emptyDescription={filtered ? "Try a different search, status or plan." : "Assign a plan to a company to start its subscription."}
          emptyAction={
            filtered ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("")
                  setStatus("all")
                  setPlanId("all")
                }}
              >
                Clear filters
              </Button>
            ) : canManage ? (
              <Button onClick={() => setDialog({ kind: "assign" })}>
                <Plus data-icon="inline-start" /> Assign plan
              </Button>
            ) : undefined
          }
          className={list.isFetching && !list.isLoading ? "opacity-80 transition-opacity" : "transition-opacity"}
          toolbar={
            <>
              <SearchInput value={search} onChange={setSearch} placeholder="Search company or plan…" />
              <FilterSelect value={status} onChange={setStatus} allLabel="All statuses" options={STATUS_OPTIONS} />
              <FilterSelect value={planId} onChange={setPlanId} allLabel="All plans" options={(plans.data ?? []).map((p) => ({ value: p.id, label: p.name }))} />
              <span className="ml-auto text-sm text-muted-foreground">{list.data ? `${formatNumber(list.data.items.length)} subscriptions` : ""}</span>
            </>
          }
        />
      )}

      <ChangePlanDialog sub={subDialog?.kind === "change" ? subDialog.sub : null} onOpenChange={close} />
      <EditSubscriptionDialog sub={subDialog?.kind === "edit" ? subDialog.sub : null} onOpenChange={close} />
      <CancelSubscriptionDialog sub={subDialog?.kind === "cancel" ? subDialog.sub : null} onOpenChange={close} />
      <AssignPlanDialog open={dialog?.kind === "assign"} companyId={dialog?.kind === "assign" ? dialog.companyId : undefined} onOpenChange={close} />
      <ConfirmDialog
        open={subDialog?.kind === "pause"}
        onOpenChange={close}
        destructive
        title={subDialog ? `Pause ${subDialog.sub.companyName}'s subscription?` : ""}
        description="Billing stops while paused and MRR for this company drops to zero. Employees keep access to their data; you can resume at any time."
        confirmLabel="Pause subscription"
        onConfirm={() => {
          if (subDialog) pause.mutate({ id: subDialog.sub.id })
          setDialog(null)
        }}
      />
    </PageContainer>
  )
}
