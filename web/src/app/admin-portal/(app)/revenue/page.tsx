"use client"

import { Ban, Building2, CheckCircle2, CircleDollarSign, Download, Eye, FilePlus2, MoreHorizontal, Percent, Receipt, TrendingDown, TrendingUp, UserRound } from "lucide-react"
import { useState } from "react"
import { InvoiceSheet, type InvoiceActions } from "@/components/admin/customers/invoice-sheet"
import { FilterSelect } from "@/components/admin/filter-select"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { DonutChart, TrendChart } from "@/components/common/charts"
import { DataTable, type Column } from "@/components/common/data-table"
import { ConfirmDialog, InlineBar, SearchInput, SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { EmptyState, ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { invoicesApi, revenueApi, type InvoiceQuery, type InvoiceRow, type RevenueSummary } from "@/lib/api/platform/billing"
import { usersApi } from "@/lib/api/platform/users"
import { downloadText } from "@/lib/download"
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/format"
import type { InvoiceStatus } from "@/lib/types"

const STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: "due", label: "Due" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
]

const inr = (v: number) => formatCurrency(v, "INR")
const inrCompact = (v: number) => formatCurrency(v, "INR", true)

function RevenueKpis({ r }: { r: RevenueSummary }) {
  const growth = r.mrrPrevious ? (r.mrr - r.mrrPrevious) / r.mrrPrevious : 0
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard label="MRR" value={inrCompact(r.mrr)} icon={CircleDollarSign} tone="emerald" delta={growth} deltaLabel="vs last month" hint={inr(r.mrr)} />
      <StatCard label="ARR" value={inrCompact(r.arr)} icon={TrendingUp} tone="sky" hint="MRR × 12" />
      <StatCard label="ARPU (per company)" value={inr(r.arpu)} icon={Building2} tone="violet" hint={`${formatNumber(r.payingCompanies)} paying companies`} />
      <StatCard label="Revenue per active employee" value={formatCurrency(r.revenuePerEmployee, "INR")} icon={UserRound} tone="amber" hint={`${formatNumber(r.billableEmployees)} billable employees`} />
      <StatCard label="Expansion MRR" value={inrCompact(r.expansionMrr)} icon={Percent} tone="emerald" hint="Seat growth & upgrades this month" />
      <StatCard
        label="Churn rate (12 months)"
        value={formatPercent(r.churnRate, 1)}
        icon={TrendingDown}
        tone={r.churnRate > 0.05 ? "rose" : "slate"}
        hint={r.churnedCompanies ? `${formatNumber(r.churnedCompanies)} ${r.churnedCompanies === 1 ? "company" : "companies"} cancelled` : "No cancellations"}
      />
    </div>
  )
}

function RevenueCharts({ r }: { r: RevenueSummary }) {
  const trend = r.trend.map((t) => ({ date: t.month, mrr: t.mrr }))
  const topMax = Math.max(1, ...r.topCompanies.map((c) => c.mrr))
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="MRR trend" description="Monthly recurring revenue, last 12 months" className="lg:col-span-2">
          <TrendChart
            data={trend}
            series={[{ key: "mrr", label: "MRR" }]}
            valueFormatter={inrCompact}
            xFormatter={(v) => formatDate(v, "MMM")}
            tooltipLabelFormatter={(v) => formatDate(v, "MMMM yyyy")}
            height={260}
          />
        </SectionCard>
        <SectionCard title="Revenue by plan" description="Share of current MRR">
          {r.byPlan.length ? (
            <DonutChart data={r.byPlan.map((p) => ({ name: p.name, value: p.mrr }))} centerValue={inrCompact(r.mrr)} centerLabel="MRR" valueFormatter={inrCompact} height={170} className="sm:flex-col" />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">No paying subscriptions yet.</p>
          )}
        </SectionCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Top companies by MRR" description="Largest paying customers right now" className="lg:col-span-2">
          {r.topCompanies.length ? (
            <ol className="space-y-3">
              {r.topCompanies.map((c, i) => (
                <li key={c.companyId} className="space-y-1.5">
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="w-4 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                      {c.planName} · {formatNumber(c.activeSeats)} employees
                    </span>
                    <span className="w-20 shrink-0 text-right font-semibold tabular-nums">{inrCompact(c.mrr)}</span>
                  </div>
                  <InlineBar value={c.mrr} max={topMax} className="ml-6 h-1.5 w-auto" />
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">No paying subscriptions yet.</p>
          )}
        </SectionCard>
        <SectionCard title="Collections" description="All open invoices, incl. GST">
          <dl className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-sm text-muted-foreground">Due ({formatNumber(r.outstanding.dueCount)})</dt>
              <dd className="font-heading text-lg font-semibold tabular-nums">{inr(r.outstanding.due)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-sm text-muted-foreground">Overdue ({formatNumber(r.outstanding.overdueCount)})</dt>
              <dd className={`font-heading text-lg font-semibold tabular-nums ${r.outstanding.overdue ? "text-rose-600 dark:text-rose-400" : ""}`}>{inr(r.outstanding.overdue)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-t pt-4">
              <dt className="text-sm text-muted-foreground">Collected, last 30 days</dt>
              <dd className="font-heading text-lg font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">{inr(r.collectedLast30Days)}</dd>
            </div>
          </dl>
        </SectionCard>
      </div>
    </>
  )
}

/** SCR-P-026 Revenue & invoices (Phase 2) — Super Admin only. */
export default function RevenuePage() {
  const can = useAdminCan()
  const canBill = can("billing.manage")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [companyId, setCompanyId] = useState("all")
  const [period, setPeriod] = useState("all")
  const [openId, setOpenId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ kind: "void"; inv: InvoiceRow } | { kind: "generate" } | null>(null)

  const query: InvoiceQuery = { search: search || undefined, status: status as InvoiceQuery["status"], companyId: companyId === "all" ? undefined : companyId, period: period === "all" ? undefined : period }
  const revenue = useApiQuery(["admin", "revenue"], () => revenueApi.summary())
  const invoices = useApiQuery(["admin", "invoices", query], () => invoicesApi.list(query), { placeholderData: (prev) => prev })
  const companies = useApiQuery(["admin", "company-options"], () => usersApi.companies())

  const generate = useApiMutation(invoicesApi.generate, {
    success: (r) => (r.created ? `${r.created} ${r.created === 1 ? "invoice" : "invoices"} issued for ${r.period}` : `All active subscriptions already have an invoice for ${r.period}.`),
  })
  const markPaid = useApiMutation(invoicesApi.markPaid, { success: (i) => `${i.number} marked as paid` })
  const voidInvoice = useApiMutation(invoicesApi.void, { success: (i) => `${i.number} was voided` })
  const download = useApiMutation(invoicesApi.document, { invalidate: false, onSuccess: (r) => downloadText(r.fileName, r.html, "text/html;charset=utf-8") })
  const exportCsv = useApiMutation(invoicesApi.exportCsv, { success: "Export ready", invalidate: false, onSuccess: (r) => downloadText(r.fileName, r.csv) })

  const actions: InvoiceActions = {
    canManage: canBill,
    busy: markPaid.isPending || voidInvoice.isPending || download.isPending,
    onDownload: (i) => download.mutate({ id: i.id }),
    onMarkPaid: (i) => markPaid.mutate({ id: i.id }),
    onVoid: (i) => setConfirm({ kind: "void", inv: i }),
  }
  const filtered = !!search || status !== "all" || companyId !== "all" || period !== "all"
  const thisMonth = formatDate(new Date(), "MMMM yyyy")

  const columns: Column<InvoiceRow>[] = [
    {
      key: "number",
      header: "Invoice",
      cell: (i) => (
        <div className="min-w-0">
          <div className="font-mono text-sm font-medium">{i.number}</div>
          <div className="truncate text-xs text-muted-foreground md:hidden">{i.companyName}</div>
        </div>
      ),
      sortValue: (i) => i.number,
    },
    { key: "company", header: "Company", cell: (i) => <span className="block max-w-48 truncate text-sm">{i.companyName}</span>, hideOnMobile: true, sortValue: (i) => i.companyName },
    { key: "period", header: "Period", cell: (i) => <span className="text-sm whitespace-nowrap">{formatDate(i.periodStart, "MMM yyyy")}</span>, hideOnMobile: true, sortValue: (i) => i.periodStart },
    { key: "seats", header: "Seats", align: "right", cell: (i) => <span className="text-sm tabular-nums">{formatNumber(i.seats)}</span>, hideOnMobile: true, sortValue: (i) => i.seats },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (i) => (
        <div className="whitespace-nowrap">
          <div className="text-sm font-medium tabular-nums">{formatCurrency(i.total, i.currency)}</div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {formatCurrency(i.amount, i.currency)} + GST
          </div>
        </div>
      ),
      sortValue: (i) => i.total,
    },
    { key: "status", header: "Status", cell: (i) => <StatusBadge status={i.status} />, sortValue: (i) => i.status },
    { key: "issued", header: "Issued", cell: (i) => <span className="text-sm whitespace-nowrap text-muted-foreground">{formatDate(i.issuedAt)}</span>, hideOnMobile: true, sortValue: (i) => i.issuedAt },
    {
      key: "due",
      header: "Due",
      cell: (i) => (
        <span className={`text-sm whitespace-nowrap ${i.status === "overdue" ? "font-medium text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>{i.paidAt ? `Paid ${formatDate(i.paidAt, "d MMM")}` : formatDate(i.dueAt)}</span>
      ),
      hideOnMobile: true,
      sortValue: (i) => i.dueAt,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (i) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${i.number}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setOpenId(i.id)}>
                <Eye /> View invoice
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.onDownload(i)}>
                <Download /> Download
              </DropdownMenuItem>
              {canBill && (i.status === "due" || i.status === "overdue") ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => actions.onMarkPaid(i)}>
                    <CheckCircle2 /> Mark paid
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => actions.onVoid(i)}>
                    <Ban /> Void
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Revenue & invoices"
        badge={<PhaseBadge phase={2} />}
        description="Recurring revenue by plan and company, and monthly invoices calculated from billable active employees × plan price + GST."
        actions={
          <>
            <Button variant="outline" onClick={() => exportCsv.mutate(query)} disabled={exportCsv.isPending || !invoices.data?.items.length}>
              <Download data-icon="inline-start" /> Export CSV
            </Button>
            {canBill ? (
              <Button onClick={() => setConfirm({ kind: "generate" })} disabled={generate.isPending}>
                <FilePlus2 data-icon="inline-start" /> Generate invoices
              </Button>
            ) : null}
          </>
        }
      />

      {revenue.isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-80 rounded-xl lg:col-span-2" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        </div>
      ) : revenue.error || !revenue.data ? (
        <ErrorState error={new Error("Couldn't load revenue.")} onRetry={() => revenue.refetch()} />
      ) : (
        <>
          <RevenueKpis r={revenue.data} />
          <RevenueCharts r={revenue.data} />
        </>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-heading text-lg font-semibold">Invoices</h2>
            <p className="text-sm text-muted-foreground">
              {invoices.data
                ? `${formatNumber(invoices.data.summary.count)} invoices · ${inr(invoices.data.summary.outstanding)} outstanding${invoices.data.summary.overdue ? ` · ${inr(invoices.data.summary.overdue)} overdue` : ""}`
                : "Monthly invoices for every paying subscription."}
            </p>
            <p className="text-xs text-muted-foreground">Billing is offline for now: invoices are sent manually and marked paid when the bank transfer arrives.</p>
          </div>
        </div>
        {invoices.error && !invoices.data ? (
          <ErrorState error={invoices.error} onRetry={() => invoices.refetch()} />
        ) : !invoices.isLoading && invoices.data && invoices.data.items.length === 0 && !filtered ? (
          <EmptyState
            icon={Receipt}
            title="No invoices yet."
            description="Generate this month's invoices for every active subscription."
            action={
              canBill ? (
                <Button onClick={() => setConfirm({ kind: "generate" })}>
                  <FilePlus2 data-icon="inline-start" /> Generate invoices
                </Button>
              ) : undefined
            }
          />
        ) : (
          <DataTable
            columns={columns}
            rows={invoices.data?.items ?? []}
            getRowId={(i) => i.id}
            loading={invoices.isLoading}
            clientPageSize={12}
            onRowClick={(i) => setOpenId(i.id)}
            emptyTitle="No invoices match these filters"
            emptyDescription="Try a different search, status, company or period."
            emptyAction={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("")
                  setStatus("all")
                  setCompanyId("all")
                  setPeriod("all")
                }}
              >
                Clear filters
              </Button>
            }
            className={invoices.isFetching && !invoices.isLoading ? "opacity-80 transition-opacity" : "transition-opacity"}
            toolbar={
              <>
                <SearchInput value={search} onChange={setSearch} placeholder="Search invoice # or company…" className="sm:w-64" />
                <FilterSelect value={status} onChange={setStatus} allLabel="All statuses" options={STATUS_OPTIONS} />
                <FilterSelect value={companyId} onChange={setCompanyId} allLabel="All companies" className="sm:w-48" options={(companies.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
                <FilterSelect
                  value={period}
                  onChange={setPeriod}
                  allLabel="All periods"
                  options={(invoices.data?.periods ?? []).map((p) => ({ value: p, label: formatDate(`${p}-01`, "MMM yyyy") }))}
                />
              </>
            }
          />
        )}
      </div>

      <InvoiceSheet invoiceId={openId} onOpenChange={(o) => !o && setOpenId(null)} actions={actions} />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive={confirm?.kind === "void"}
        title={confirm?.kind === "void" ? `Void ${confirm.inv.number}?` : `Generate invoices for ${thisMonth}?`}
        description={
          confirm?.kind === "void"
            ? `The invoice for ${confirm.inv.companyName} (${formatCurrency(confirm.inv.total, confirm.inv.currency)}) will be cancelled and can't be paid. You can generate a new one afterwards.`
            : "Creates a “due” invoice for every active or past-due subscription that doesn't have one for this month yet: billable active employees × plan price + 18% GST."
        }
        confirmLabel={confirm?.kind === "void" ? "Void invoice" : "Generate invoices"}
        onConfirm={() => {
          if (confirm?.kind === "void") voidInvoice.mutate({ id: confirm.inv.id })
          else if (confirm?.kind === "generate") generate.mutate()
          setConfirm(null)
        }}
      />
    </PageContainer>
  )
}
