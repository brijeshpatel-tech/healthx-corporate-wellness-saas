"use client"

import { Download, Eye, Headset, MoreHorizontal, Pencil, Plus, RotateCcw, ShieldOff } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { CompanyLogo, SEGMENT_LABEL, SupportAccessDialog, SuspendCompanyDialog } from "@/components/admin/companies/company-actions"
import { FilterSelect } from "@/components/admin/filter-select"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { DataTable, type Column } from "@/components/common/data-table"
import { ConfirmDialog, InlineBar, SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { companiesApi, type CompanyQuery, type CompanyRow } from "@/lib/api/platform/companies"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { downloadText } from "@/lib/download"
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/format"
import type { CompanyStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const STATUS_TABS: { value: CompanyStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "onboarding", label: "Onboarding" },
  { value: "trial", label: "Trial" },
  { value: "suspended", label: "Suspended" },
]

const SEGMENTS = [
  { value: "smb", label: "SMB (< 100)" },
  { value: "mid_market", label: "Mid-market" },
  { value: "enterprise", label: "Enterprise (1,000+)" },
]

const SORTS = [
  { value: "name", label: "Sort: Name" },
  { value: "created", label: "Sort: Newest" },
  { value: "employees", label: "Sort: Employees" },
  { value: "adoption", label: "Sort: Adoption" },
  { value: "renewal", label: "Sort: Renewal" },
  { value: "mrr", label: "Sort: MRR" },
]

function CompaniesPage() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const can = useAdminCan()
  const initialStatus = (params.get("status") as CompanyQuery["status"]) ?? "all"
  const [status, setStatusState] = useState<CompanyQuery["status"]>(STATUS_TABS.some((t) => t.value === initialStatus) ? initialStatus : "all")
  const [search, setSearch] = useState("")
  const [planId, setPlanId] = useState("all")
  const [segment, setSegment] = useState("all")
  const [industry, setIndustry] = useState("all")
  const [sort, setSort] = useState("name")
  const [page, setPage] = useState(1)
  const [suspendTarget, setSuspendTarget] = useState<CompanyRow | null>(null)
  const [supportTarget, setSupportTarget] = useState<CompanyRow | null>(null)
  const [reactivateTarget, setReactivateTarget] = useState<CompanyRow | null>(null)

  const setStatus = (v: CompanyQuery["status"]) => {
    setStatusState(v)
    setPage(1)
    router.replace(v && v !== "all" ? `${pathname}?status=${v}` : pathname, { scroll: false })
  }
  const resetPage =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v)
      setPage(1)
    }

  const lookups = useApiQuery(["admin", "companies", "lookups"], () => companiesApi.lookups())
  const query: CompanyQuery = {
    search: search || undefined,
    status,
    planId: planId === "all" ? undefined : planId,
    segment: segment as CompanyQuery["segment"],
    industry: industry === "all" ? undefined : industry,
    sort,
    page,
    pageSize: 12,
  }
  const list = useApiQuery(["admin", "companies", query], () => companiesApi.list(query), { placeholderData: (prev) => prev })
  const reactivate = useApiMutation(companiesApi.reactivate, { success: (c) => `${c.name} reactivated — users can sign in again.`, errorTitle: "Couldn't update company status." })
  const exportCsv = useApiMutation(companiesApi.exportCsv, { success: "Export ready", invalidate: false, onSuccess: (r) => downloadText(r.fileName, r.csv) })

  const filtered = !!search || planId !== "all" || segment !== "all" || industry !== "all" || status !== "all"
  const clearFilters = () => {
    setSearch("")
    setPlanId("all")
    setSegment("all")
    setIndustry("all")
    setStatus("all")
  }

  const allColumns: Column<CompanyRow>[] = [
    {
      key: "company",
      header: "Company",
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <CompanyLogo name={r.name} initials={r.branding.logoInitials} color={r.branding.primaryColor} />
          <div className="min-w-0">
            <div className="truncate font-medium">{r.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              <span className="font-mono">{r.companyCode}</span> · {r.industry} · {r.city}
            </div>
          </div>
        </div>
      ),
      className: "max-w-80",
    },
    {
      key: "plan",
      header: "Plan",
      cell: (r) => (
        <div className="text-sm">
          <div className="font-medium">{r.planName}</div>
          {r.subscriptionStatus === "past_due" ? (
            <div className="text-xs font-medium text-rose-600 dark:text-rose-400">Payment overdue</div>
          ) : (
            <div className="text-xs text-muted-foreground">{SEGMENT_LABEL[r.segment]} size</div>
          )}
        </div>
      ),
      hideOnMobile: true,
    },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "employees",
      header: "Employees",
      cell: (r) => (
        <div className="w-36 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-semibold text-foreground tabular-nums">
              {formatNumber(r.registeredCount)}
              <span className="font-normal text-muted-foreground"> / {formatNumber(r.employeeCount)}</span>
            </span>
            <span className="text-muted-foreground tabular-nums">{formatPercent(r.adoption)}</span>
          </div>
          <InlineBar value={r.registeredCount} max={r.employeeCount} color={r.adoption < 0.35 ? "var(--chart-4)" : "var(--primary)"} className="h-1.5" />
          <div className="text-[11px] text-muted-foreground">{formatNumber(r.activeCount)} active</div>
        </div>
      ),
      hideOnMobile: true,
    },
    {
      key: "mrr",
      header: "MRR",
      align: "right",
      cell: (r) => (
        <div className="text-sm tabular-nums">
          {r.subscriptionStatus === "trial" ? <span className="text-muted-foreground">Trial</span> : formatCurrency(r.mrr, r.currency)}
        </div>
      ),
      hideOnMobile: true,
    },
    { key: "created", header: "Created", cell: (r) => <span className="text-sm text-muted-foreground">{formatDate(r.createdAt)}</span>, hideOnMobile: true },
    {
      key: "renewal",
      header: "Renewal",
      cell: (r) => (
        <span className="text-sm text-muted-foreground">
          {r.subscriptionStatus === "trial" && r.trialEndsAt ? `Trial ends ${formatDate(r.trialEndsAt, "d MMM")}` : formatDate(r.renewalDate)}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild>
                <Link href={`/admin-portal/companies/${r.id}`}>
                  <Eye /> Open
                </Link>
              </DropdownMenuItem>
              {can("companies.manage") ? (
                <DropdownMenuItem asChild>
                  <Link href={`/admin-portal/companies/${r.id}/edit`}>
                    <Pencil /> Edit
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {can("companies.support") && r.status !== "suspended" ? (
                <DropdownMenuItem onClick={() => setSupportTarget(r)}>
                  <Headset /> Open as support
                </DropdownMenuItem>
              ) : null}
              {can("companies.manage") ? (
                <>
                  <DropdownMenuSeparator />
                  {r.status === "suspended" ? (
                    <DropdownMenuItem onClick={() => setReactivateTarget(r)}>
                      <RotateCcw /> Reactivate
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem variant="destructive" onClick={() => setSuspendTarget(r)}>
                      <ShieldOff /> Suspend
                    </DropdownMenuItem>
                  )}
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  const columns = allColumns.filter((col) => col.key !== "mrr" || can("revenue.view"))
  const counts = list.data?.counts

  return (
    <PageContainer>
      <PageHeader
        title="Companies"
        description="Search, filter and open any customer workspace. Figures are aggregated — no individual health data."
        actions={
          <>
            <Button variant="outline" onClick={() => exportCsv.mutate(query)} disabled={exportCsv.isPending}>
              <Download data-icon="inline-start" /> Export
            </Button>
            {can("companies.manage") ? (
              <Button asChild>
                <Link href="/admin-portal/companies/new">
                  <Plus data-icon="inline-start" /> Create company
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Tabs value={status ?? "all"} onValueChange={(v) => setStatus(v as CompanyQuery["status"])}>
          <TabsList className="h-9">
            {STATUS_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5 px-3">
                {t.label}
                {counts ? (
                  <span className={cn("rounded-md px-1.5 text-[11px] font-semibold tabular-nums", t.value === "suspended" && counts.suspended > 0 ? "bg-rose-500/12 text-rose-700 dark:text-rose-300" : "bg-muted-foreground/10 text-muted-foreground")}>
                    {counts[t.value]}
                  </span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {list.error ? (
        <ErrorState error={new Error("Couldn't load companies.")} onRetry={() => list.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={list.data?.items ?? []}
          getRowId={(r) => r.id}
          loading={list.isLoading}
          onRowClick={(r) => router.push(`/admin-portal/companies/${r.id}`)}
          pagination={list.data ? { page, pageSize: list.data.pageSize, total: list.data.total, onPageChange: setPage } : undefined}
          emptyTitle={filtered ? "No companies match these filters." : "No companies yet."}
          emptyDescription={filtered ? "Try a different search or clear the filters." : "Create the first company to start onboarding employees."}
          emptyAction={
            filtered ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : can("companies.manage") ? (
              <Button asChild>
                <Link href="/admin-portal/companies/new">
                  <Plus data-icon="inline-start" /> Create company
                </Link>
              </Button>
            ) : undefined
          }
          className={list.isFetching && !list.isLoading ? "opacity-80 transition-opacity" : "transition-opacity"}
          toolbar={
            <>
              <SearchInput value={search} onChange={resetPage(setSearch)} placeholder="Search name, code, city, domain…" />
              <FilterSelect value={planId} onChange={resetPage(setPlanId)} allLabel="All plans" options={(lookups.data?.plans ?? []).map((p) => ({ value: p.id, label: p.name }))} className="sm:w-36" />
              <FilterSelect value={segment} onChange={resetPage(setSegment)} allLabel="All sizes" options={SEGMENTS} className="sm:w-44" />
              <FilterSelect value={industry} onChange={resetPage(setIndustry)} allLabel="All industries" options={(lookups.data?.industries ?? []).map((i) => ({ value: i, label: i }))} className="sm:w-44" />
              <FilterSelect value={sort} onChange={resetPage(setSort)} options={SORTS} className="sm:w-40" aria-label="Sort companies" />
              <span className="text-sm text-muted-foreground lg:ml-auto">{list.data ? `${formatNumber(list.data.total)} companies` : ""}</span>
            </>
          }
        />
      )}

      <SuspendCompanyDialog company={suspendTarget} open={!!suspendTarget} onOpenChange={(o) => !o && setSuspendTarget(null)} />
      <SupportAccessDialog company={supportTarget} open={!!supportTarget} onOpenChange={(o) => !o && setSupportTarget(null)} onStarted={(s) => router.push(`/admin-portal/companies/${s.companyId}`)} />
      <ConfirmDialog
        open={!!reactivateTarget}
        onOpenChange={(o) => !o && setReactivateTarget(null)}
        title={`Reactivate ${reactivateTarget?.name}?`}
        description="Employees and admins of this company will be able to sign in again. The change is audit-logged."
        confirmLabel="Reactivate"
        onConfirm={() => {
          if (reactivateTarget) reactivate.mutate({ id: reactivateTarget.id })
          setReactivateTarget(null)
        }}
      />
    </PageContainer>
  )
}

export default function Page() {
  return (
    <Suspense>
      <CompaniesPage />
    </Suspense>
  )
}
