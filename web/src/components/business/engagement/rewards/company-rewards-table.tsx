"use client"

import { Archive, CheckCircle2, FileText, Gift, MoreHorizontal, Pencil, Plus, Star } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { CoverTile } from "@/components/business/engagement/cover-picker"
import { DataTable, type Column } from "@/components/common/data-table"
import { ConfirmDialog, SearchInput } from "@/components/common/misc"
import { StatusBadge } from "@/components/common/status-badge"
import { EmptyState, ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { rewardsApi, type RewardQuery, type RewardRow } from "@/lib/api/business/rewards"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatNumber, pluralize } from "@/lib/format"
import { REWARD_STATUS_FILTERS, stockLabel } from "./reward-meta"

/** "Company rewards" tab of SCR-B-017. */
export function CompanyRewardsTable() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [categoryId, setCategoryId] = useState("all")
  const [status, setStatus] = useState<string>("all")
  const [confirm, setConfirm] = useState<RewardRow | null>(null)

  const categories = useApiQuery(["business", "reward-categories"], () => rewardsApi.categories(), { staleTime: 5 * 60_000 })
  const query: RewardQuery = { scope: "company", search: search || undefined, categoryId: categoryId === "all" ? undefined : categoryId, status: status as RewardQuery["status"] }
  const list = useApiQuery(["business", "rewards", query], () => rewardsApi.list(query), { placeholderData: (prev) => prev })
  const setStatusMut = useApiMutation(rewardsApi.setStatus, { success: "Reward updated." })

  const filtered = !!search || categoryId !== "all" || status !== "all"

  const columns: Column<RewardRow>[] = [
    {
      key: "name",
      header: "Reward",
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <CoverTile emoji={r.imageEmoji} color={r.imageColor} size="md" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-medium">{r.name}</span>
              {r.featured ? <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Featured" /> : null}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              <span className="md:hidden">{formatNumber(r.pointsCost)} pts · </span>
              {r.categoryIcon} {r.categoryName}
            </div>
          </div>
        </div>
      ),
      className: "max-w-80",
    },
    { key: "cost", header: "Points cost", align: "right", sortValue: (r) => r.pointsCost, cell: (r) => <span className="font-medium tabular-nums">{formatNumber(r.pointsCost)}</span>, hideOnMobile: true },
    {
      key: "stock",
      header: "Stock",
      sortValue: (r) => r.stock ?? Number.MAX_SAFE_INTEGER,
      cell: (r) => <span className={r.stock === 0 ? "text-sm font-medium text-amber-700 dark:text-amber-400" : "text-sm text-muted-foreground"}>{stockLabel(r.stock)}</span>,
      hideOnMobile: true,
    },
    {
      key: "redeemed",
      header: "Redeemed",
      align: "right",
      sortValue: (r) => r.redemptionsCount,
      cell: (r) => (
        <div className="text-sm tabular-nums">
          {formatNumber(r.redemptionsCount)}
          {r.pendingOrders ? <div className="text-xs text-amber-700 dark:text-amber-400">{r.pendingOrders} pending</div> : null}
        </div>
      ),
      hideOnMobile: true,
    },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} label={r.status === "archived" ? "Deactivated" : undefined} /> },
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
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href={`/business-portal/rewards/${r.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </DropdownMenuItem>
              {r.status === "draft" || r.status === "archived" ? (
                <DropdownMenuItem onClick={() => setStatusMut.mutate({ id: r.id, status: "active" })}>
                  <CheckCircle2 /> Activate
                </DropdownMenuItem>
              ) : null}
              {r.status === "archived" ? (
                <DropdownMenuItem onClick={() => setStatusMut.mutate({ id: r.id, status: "draft" })}>
                  <FileText /> Move to draft
                </DropdownMenuItem>
              ) : null}
              {r.status === "active" || r.status === "out_of_stock" || r.status === "draft" ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirm(r)}>
                    <Archive /> Deactivate
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  if (list.error) return <ErrorState error={list.error} onRetry={() => list.refetch()} />

  if (list.data && list.data.counts.company === 0)
    return (
      <EmptyState
        icon={Gift}
        title="No company rewards yet"
        description="Add company merchandise or extra benefits — like an extra day off or a team lunch — that employees can redeem with their points."
        action={
          <Button asChild>
            <Link href="/business-portal/rewards/new">
              <Plus data-icon="inline-start" /> Add reward
            </Link>
          </Button>
        }
      />
    )

  return (
    <>
      <DataTable
        columns={columns}
        rows={list.data?.items ?? []}
        getRowId={(r) => r.id}
        loading={list.isLoading}
        clientPageSize={12}
        onRowClick={(r) => router.push(`/business-portal/rewards/${r.id}/edit`)}
        emptyTitle="No rewards match these filters"
        emptyDescription="Try a different search or clear the filters."
        emptyAction={
          filtered ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("")
                setCategoryId("all")
                setStatus("all")
              }}
            >
              Clear filters
            </Button>
          ) : undefined
        }
        className={list.isFetching && !list.isLoading ? "opacity-80 transition-opacity" : "transition-opacity"}
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Search rewards…" />
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.data?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-full sm:w-40" aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REWARD_STATUS_FILTERS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-auto text-sm text-muted-foreground">{list.data ? pluralize(list.data.items.length, "reward") : ""}</span>
          </>
        }
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title={`Deactivate ${confirm?.name ?? "this reward"}?`}
        description={
          <>
            Employees will no longer see this reward or be able to redeem it.
            {confirm?.pendingOrders ? ` ${pluralize(confirm.pendingOrders, "order")} waiting for approval can still be approved or rejected.` : " Orders already placed can still be fulfilled."} You can
            activate it again at any time.
          </>
        }
        confirmLabel="Deactivate"
        onConfirm={() => {
          if (confirm) setStatusMut.mutate({ id: confirm.id, status: "archived" })
          setConfirm(null)
        }}
      />
    </>
  )
}
