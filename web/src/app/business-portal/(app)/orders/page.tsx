"use client"

import { CheckCircle2, ChevronRight, Download, Gift, MoreHorizontal, Package } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { CountTabs } from "@/components/business/engagement/count-tabs"
import { CoverTile } from "@/components/business/engagement/cover-picker"
import { DateRangeFilter, type DateRangeValue } from "@/components/business/engagement/orders/date-range-filter"
import { ORDER_STATUS_LABEL, ORDER_TABS } from "@/components/business/engagement/orders/order-meta"
import { DataTable, type Column } from "@/components/common/data-table"
import { ConfirmDialog, SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { ErrorState } from "@/components/common/states"
import { PersonCell } from "@/components/common/user-avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ordersApi, type OrderQuery, type OrderRow } from "@/lib/api/business/orders"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { downloadText } from "@/lib/download"
import { formatDate, formatNumber, formatTime, pluralize } from "@/lib/format"
import type { OrderStatus } from "@/lib/types"

type StatusTab = OrderStatus | "all"
const isStatus = (v: string | null): v is StatusTab => !!v && (ORDER_TABS as string[]).includes(v)

function OrdersPage() {
  const can = useCan()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  // The status lives in the URL so the dashboard can link to ?status=pending_approval and Back keeps it.
  const statusParam = params.get("status")
  const status: StatusTab = isStatus(statusParam) ? statusParam : "all"

  const [search, setSearch] = useState("")
  const [rewardId, setRewardId] = useState("all")
  const [range, setRange] = useState<DateRangeValue>({})
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [confirmBulk, setConfirmBulk] = useState(false)

  /** Any filter change goes back to page 1 and clears the selection (bulk actions only apply to visible rows). */
  const changed = () => {
    setPage(1)
    setSelected([])
  }
  const setStatus = (s: StatusTab) => {
    changed()
    router.replace(s === "all" ? pathname : `${pathname}?status=${s}`, { scroll: false })
  }

  const filters: OrderQuery = { status, search: search || undefined, rewardId: rewardId === "all" ? undefined : rewardId, from: range.from, to: range.to }
  const query: OrderQuery = { ...filters, page, pageSize: 15 }
  const list = useApiQuery(["business", "orders", query], () => ordersApi.list(query), { placeholderData: (prev) => prev })
  const rows = list.data?.items ?? []

  const exportCsv = useApiMutation(ordersApi.exportCsv, { success: "Export ready", invalidate: false, onSuccess: (r) => downloadText(r.fileName, r.csv) })
  const approveOne = useApiMutation(ordersApi.approve, { success: "Order approved – employee notified." })
  const bulk = useApiMutation(ordersApi.bulkApprove, {
    success: (r) => `${pluralize(r.approved, "order")} approved – employees notified.${r.skipped ? ` ${formatNumber(r.skipped)} skipped (no longer pending).` : ""}`,
    onSuccess: () => setSelected([]),
  })

  const manage = can("orders.manage")
  const pendingSelected = rows.filter((r) => selected.includes(r.id) && r.status === "pending_approval")
  const anyFilter = !!search || rewardId !== "all" || !!range.from || !!range.to
  const counts = list.data?.counts

  const columns: Column<OrderRow>[] = [
    { key: "order", header: "Order no.", cell: (r) => <span className="font-mono text-sm font-medium">{r.orderNumber}</span>, hideOnMobile: true },
    { key: "employee", header: "Employee", cell: (r) => <PersonCell name={r.employeeName} color={r.avatarColor} size="xs" className="max-w-52" />, hideOnMobile: true },
    {
      key: "reward",
      header: "Reward",
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <CoverTile emoji={r.rewardEmoji} color={r.rewardColor} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{r.rewardName}</div>
            <div className="truncate text-xs text-muted-foreground md:hidden">
              {r.orderNumber} · {r.employeeName} · {formatDate(r.createdAt, "d MMM")}
            </div>
            <div className="hidden truncate text-xs text-muted-foreground md:block">{r.isCompanyReward ? "Company reward" : "HealthX catalogue"}</div>
          </div>
        </div>
      ),
      className: "max-w-44 sm:max-w-64 md:max-w-72",
    },
    { key: "points", header: "Points", align: "right", sortValue: (r) => r.points, cell: (r) => <span className="font-medium tabular-nums">{formatNumber(r.points)}</span>, hideOnMobile: true },
    {
      key: "date",
      header: "Date",
      sortValue: (r) => r.createdAt,
      cell: (r) => (
        <div className="text-sm">
          {formatDate(r.createdAt)}
          <div className="text-xs text-muted-foreground">{formatTime(r.createdAt)}</div>
        </div>
      ),
      hideOnMobile: true,
    },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      hideOnMobile: true,
      cell: (r) =>
        manage && r.status === "pending_approval" ? (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.orderNumber}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => approveOne.mutate({ id: r.id, fromStatus: r.status })}>
                  <CheckCircle2 /> Approve
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/business-portal/orders/${r.id}`}>
                    <Package /> View & reject…
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <ChevronRight className="ml-auto size-4 text-muted-foreground" aria-hidden />
        ),
    },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Redemption orders"
        description="Approve, track and fulfil reward orders from your employees. Every order waits for an admin's approval first. Names and delivery details are shown only so you can fulfil orders."
        actions={
          <Button variant="outline" onClick={() => exportCsv.mutate(filters)} disabled={exportCsv.isPending}>
            <Download data-icon="inline-start" /> Export CSV
          </Button>
        }
      />

      <CountTabs
        value={status}
        onChange={setStatus}
        items={ORDER_TABS.map((s) => ({ value: s, label: s === "all" ? "All" : ORDER_STATUS_LABEL[s], count: counts?.[s] }))}
      />

      {selected.length > 0 && manage ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <span className="font-semibold">{selected.length} selected</span>
          <span className="text-muted-foreground">· {pendingSelected.length} waiting for approval</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" disabled={!pendingSelected.length || bulk.isPending} onClick={() => setConfirmBulk(true)}>
              <CheckCircle2 data-icon="inline-start" /> Approve {pendingSelected.length || ""}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      {list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id}
          loading={list.isLoading}
          onRowClick={(r) => router.push(`/business-portal/orders/${r.id}`)}
          selectable={manage}
          selectedIds={selected}
          onSelectedIdsChange={setSelected}
          pagination={list.data ? { page, pageSize: list.data.pageSize, total: list.data.total, onPageChange: (p) => { setPage(p); setSelected([]) } } : undefined}
          emptyTitle={anyFilter || status !== "all" ? (status === "pending_approval" && !anyFilter ? "Nothing waiting for approval" : "No orders match these filters") : "No reward orders yet"}
          emptyDescription={
            anyFilter || status !== "all"
              ? status === "pending_approval" && !anyFilter
                ? "You're all caught up. New orders will appear here."
                : "Try a different search, date range or status."
              : "When employees redeem rewards with their points, their orders show up here."
          }
          emptyAction={
            anyFilter ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("")
                  setRewardId("all")
                  setRange({})
                  changed()
                }}
              >
                Clear filters
              </Button>
            ) : status === "all" && can("rewards.manage") ? (
              <Button asChild size="sm">
                <Link href="/business-portal/rewards">
                  <Gift data-icon="inline-start" /> Manage rewards
                </Link>
              </Button>
            ) : undefined
          }
          className={list.isFetching && !list.isLoading ? "opacity-80 transition-opacity" : "transition-opacity"}
          toolbar={
            <>
              <SearchInput
                value={search}
                onChange={(v) => {
                  setSearch(v)
                  changed()
                }}
                placeholder="Search order no. or employee…"
              />
              <Select
                value={rewardId}
                onValueChange={(v) => {
                  setRewardId(v)
                  changed()
                }}
              >
                <SelectTrigger className="h-9 w-full sm:w-52" aria-label="Reward">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All rewards</SelectItem>
                  {list.data?.rewards.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.emoji} {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DateRangeFilter
                value={range}
                onChange={(v) => {
                  setRange(v)
                  changed()
                }}
                className="w-full sm:w-auto"
              />
              <span className="ml-auto text-sm text-muted-foreground">{list.data ? pluralize(list.data.total, "order") : ""}</span>
            </>
          }
        />
      )}

      <ConfirmDialog
        open={confirmBulk}
        onOpenChange={setConfirmBulk}
        title={`Approve ${pluralize(pendingSelected.length, "order")}?`}
        description={`${formatNumber(pendingSelected.reduce((a, r) => a + r.points, 0))} points in total. Each employee is notified and the orders move on to fulfilment. Orders another admin has already handled are skipped.`}
        confirmLabel="Approve"
        onConfirm={() => {
          bulk.mutate({ ids: pendingSelected.map((r) => r.id) })
          setConfirmBulk(false)
        }}
      />
    </PageContainer>
  )
}

export default function Page() {
  return (
    <Suspense>
      <OrdersPage />
    </Suspense>
  )
}
