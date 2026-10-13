"use client"

import { CalendarCheck, Clock, Download, PackageOpen, Truck, Wrench } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { CoverTile } from "@/components/admin/cover"
import { DELIVERY_META, ORDER_STATUS_LABEL } from "@/components/admin/engagement/meta"
import { OrderSheet } from "@/components/admin/engagement/order-sheet"
import { FilterSelect } from "@/components/admin/filter-select"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { DataTable, type Column } from "@/components/common/data-table"
import { SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { StatusBadge } from "@/components/common/status-badge"
import { ErrorState, PageSkeleton } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { downloadText } from "@/lib/download"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { ordersApi, type OrderQuery, type OrderRow } from "@/lib/api/platform/orders"
import { formatDate, formatNumber, formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

const KPI_FILTER: Record<string, NonNullable<OrderQuery["status"]>> = { awaiting: "pending_approval", fulfil: "to_fulfil", shipped: "shipped", delivered: "delivered" }

const STATUS_PARAMS = ["pending_approval", "approved", "processing", "shipped", "delivered", "cancelled", "rejected", "to_fulfil"]

export default function RedemptionOrdersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RedemptionOrders />
    </Suspense>
  )
}

function RedemptionOrders() {
  const can = useAdminCan()
  const params = useSearchParams()
  const initialStatus = params.get("status")
  const [search, setSearch] = useState("")
  const [companyId, setCompanyId] = useState(params.get("company") || "all")
  const [status, setStatus] = useState(initialStatus && STATUS_PARAMS.includes(initialStatus) ? initialStatus : "all")
  const [delivery, setDelivery] = useState("all")
  const [openId, setOpenId] = useState<string | null>(null)

  const query: OrderQuery = { search: search || undefined, companyId, status: status as OrderQuery["status"], delivery: delivery as OrderQuery["delivery"] }
  const list = useApiQuery(["admin", "orders", query], () => ordersApi.list(query), { placeholderData: (prev) => prev })
  const exportCsv = useApiMutation(ordersApi.exportCsv, { success: (r) => `Exported ${formatNumber(r.count)} orders.`, invalidate: false, onSuccess: (r) => downloadText(r.fileName, r.csv) })

  const filtered = !!search || companyId !== "all" || status !== "all" || delivery !== "all"
  const clear = () => {
    setSearch("")
    setCompanyId("all")
    setStatus("all")
    setDelivery("all")
  }
  const k = list.data?.kpis

  const columns: Column<OrderRow>[] = [
    {
      key: "order",
      header: "Order no.",
      sortValue: (r) => r.orderNumber,
      cell: (r) => (
        <div className="min-w-0">
          <div className="font-mono text-sm font-medium">{r.orderNumber}</div>
          <div className="truncate text-xs text-muted-foreground md:hidden">{r.companyName}</div>
        </div>
      ),
    },
    { key: "company", header: "Company", sortValue: (r) => r.companyName, cell: (r) => <span className="block max-w-40 truncate text-sm">{r.companyName}</span>, hideOnMobile: true },
    {
      key: "employee",
      header: "Employee",
      sortValue: (r) => r.employeeName,
      cell: (r) => (
        <div className="max-w-44 min-w-0">
          <div className="truncate text-sm font-medium">{r.employeeName}</div>
          <div className="truncate text-xs text-muted-foreground">{r.employeeEmail}</div>
        </div>
      ),
      hideOnMobile: true,
    },
    {
      key: "reward",
      header: "Reward",
      sortValue: (r) => r.rewardName,
      cell: (r) => (
        <div className="flex max-w-52 min-w-0 items-center gap-2.5">
          <CoverTile emoji={r.rewardEmoji} color={r.rewardColor} size="xs" />
          <div className="min-w-0">
            <div className="truncate text-sm">{r.rewardName}</div>
            <div className="truncate text-xs text-muted-foreground">{DELIVERY_META[r.delivery].label}</div>
          </div>
        </div>
      ),
      hideOnMobile: true,
    },
    { key: "points", header: "Points", align: "right", sortValue: (r) => r.points, cell: (r) => <span className="font-semibold tabular-nums">{formatNumber(r.points * Math.max(1, r.quantity))}</span>, hideOnMobile: true },
    {
      key: "date",
      header: "Date",
      sortValue: (r) => r.createdAt,
      cell: (r) => (
        <span className="text-sm whitespace-nowrap" title={`Last update ${formatRelative(r.updatedAt)}`}>
          {formatDate(r.createdAt)}
        </span>
      ),
      hideOnMobile: true,
    },
    { key: "status", header: "Status", sortValue: (r) => r.status, cell: (r) => <StatusBadge status={r.status} label={r.status === "pending_approval" ? "Awaiting company" : ORDER_STATUS_LABEL[r.status]} /> },
  ]

  const kpi = (key: keyof typeof KPI_FILTER) => {
    const target = KPI_FILTER[key]!
    const active = status === target
    return {
      onClick: () => setStatus(active ? "all" : target),
      className: cn("rounded-xl text-left transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none", active && "ring-2 ring-primary/40"),
      "aria-pressed": active,
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Redemption orders"
        description="Track and fulfil reward orders from every company. Company admins approve each redemption first; HealthX then fulfils it manually and employees are notified at each step."
        actions={
          can("audit.export") || can("orders.manage") ? (
            <Button variant="outline" onClick={() => exportCsv.mutate(query)} disabled={exportCsv.isPending}>
              {exportCsv.isPending ? <Spinner /> : <Download data-icon="inline-start" />} Export CSV
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button type="button" {...kpi("awaiting")}>
          <StatCard label="Awaiting company approval" value={k ? formatNumber(k.awaitingApproval) : "—"} icon={Clock} tone="amber" loading={list.isLoading} hint="approved in the Business Portal" />
        </button>
        <button type="button" {...kpi("fulfil")}>
          <StatCard label="To fulfil" value={k ? formatNumber(k.toFulfil) : "—"} icon={Wrench} tone="sky" loading={list.isLoading} hint="approved or processing" />
        </button>
        <button type="button" {...kpi("shipped")}>
          <StatCard label="Shipped" value={k ? formatNumber(k.shipped) : "—"} icon={Truck} tone="violet" loading={list.isLoading} hint="on the way" />
        </button>
        <button type="button" {...kpi("delivered")}>
          <StatCard label="Delivered this month" value={k ? formatNumber(k.deliveredThisMonth) : "—"} icon={CalendarCheck} tone="emerald" loading={list.isLoading} hint="completed orders" />
        </button>
      </div>

      {list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={list.data?.items ?? []}
          getRowId={(r) => r.id}
          loading={list.isLoading}
          clientPageSize={15}
          onRowClick={(r) => setOpenId(r.id)}
          emptyTitle={filtered ? "No orders match these filters" : "No orders to fulfil."}
          emptyDescription={filtered ? "Try a different search or clear the filters." : "New reward redemptions from every company will appear here."}
          emptyAction={
            filtered ? (
              <Button variant="outline" onClick={clear}>
                Clear filters
              </Button>
            ) : undefined
          }
          className={list.isFetching && !list.isLoading ? "opacity-80 transition-opacity" : "transition-opacity"}
          toolbar={
            <>
              <SearchInput value={search} onChange={setSearch} placeholder="Order no., employee, reward…" />
              <FilterSelect value={companyId} onChange={setCompanyId} allLabel="All companies" className="sm:w-48" options={(list.data?.companies ?? []).map((c) => ({ value: c.id, label: c.name }))} />
              <FilterSelect value={status} onChange={setStatus} allLabel="All statuses" className="sm:w-44" options={[{ value: "to_fulfil", label: "To fulfil" }, ...Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => ({ value, label }))]} />
              <FilterSelect value={delivery} onChange={setDelivery} allLabel="All delivery types" className="sm:w-44" options={Object.entries(DELIVERY_META).map(([value, m]) => ({ value, label: m.label }))} />
              {filtered ? (
                <Button variant="ghost" size="sm" onClick={clear}>
                  Clear
                </Button>
              ) : null}
              {list.data ? (
                <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <PackageOpen className="size-4" /> {formatNumber(list.data.items.length)} orders
                </span>
              ) : null}
            </>
          }
        />
      )}

      <OrderSheet orderId={openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </PageContainer>
  )
}
