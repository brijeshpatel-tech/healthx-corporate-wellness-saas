"use client"

import { useState } from "react"
import { CoverTile } from "@/components/business/engagement/cover-picker"
import { DataTable, type Column } from "@/components/common/data-table"
import { SearchInput } from "@/components/common/misc"
import { StatusBadge } from "@/components/common/status-badge"
import { ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { rewardsApi, type RewardQuery, type RewardRow } from "@/lib/api/business/rewards"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatNumber, pluralize } from "@/lib/format"
import { CatalogueRewardSheet } from "./catalogue-reward-sheet"
import { DELIVERY_META } from "./reward-meta"

/** "HealthX catalogue" tab of SCR-B-017 — read-only rewards with a per-company visibility switch. */
export function CatalogueTable() {
  const [search, setSearch] = useState("")
  const [categoryId, setCategoryId] = useState("all")
  const [visibility, setVisibility] = useState<"all" | "visible" | "hidden">("all")
  const [openId, setOpenId] = useState<string | null>(null)

  const categories = useApiQuery(["business", "reward-categories"], () => rewardsApi.categories(), { staleTime: 5 * 60_000 })
  const query: RewardQuery = { scope: "catalogue", search: search || undefined, categoryId: categoryId === "all" ? undefined : categoryId, status: visibility }
  const list = useApiQuery(["business", "rewards", query], () => rewardsApi.list(query), { placeholderData: (prev) => prev })
  const toggle = useApiMutation(rewardsApi.setVisibility, { success: "Reward updated." })

  /** Shows the requested state while the change is being saved. */
  const isVisible = (r: RewardRow) => (toggle.isPending && toggle.variables?.id === r.id ? toggle.variables.visible : !r.hidden)
  const open = list.data?.items.find((r) => r.id === openId) ?? null

  const columns: Column<RewardRow>[] = [
    {
      key: "name",
      header: "Reward",
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className={isVisible(r) ? "flex min-w-0 items-center gap-3" : "flex min-w-0 items-center gap-3 opacity-60"}>
          <CoverTile emoji={r.imageEmoji} color={r.imageColor} size="md" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{r.name}</span>
              {r.status === "out_of_stock" ? <StatusBadge status="out_of_stock" dot={false} className="h-5 px-2 text-[11px]" /> : null}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              <span className="md:hidden">{formatNumber(r.pointsCost)} pts · </span>
              {r.categoryIcon} {r.categoryName}
              <span className="hidden md:inline"> · {r.provider ?? "HealthX"}</span>
            </div>
          </div>
        </div>
      ),
      className: "max-w-80",
    },
    { key: "delivery", header: "Delivery", cell: (r) => <span className="text-sm text-muted-foreground">{DELIVERY_META[r.delivery].label}</span>, hideOnMobile: true },
    { key: "cost", header: "Points cost", align: "right", sortValue: (r) => r.pointsCost, cell: (r) => <span className="font-medium tabular-nums">{formatNumber(r.pointsCost)}</span>, hideOnMobile: true },
    { key: "orders", header: "Your orders", align: "right", sortValue: (r) => r.companyOrders, cell: (r) => <span className="text-sm tabular-nums">{formatNumber(r.companyOrders)}</span>, hideOnMobile: true },
    {
      key: "visible",
      header: "Visible",
      align: "right",
      cell: (r) => (
        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <span className="hidden text-xs text-muted-foreground lg:inline">{isVisible(r) ? "Shown" : "Hidden"}</span>
          <Switch
            checked={isVisible(r)}
            disabled={toggle.isPending && toggle.variables?.id === r.id}
            onCheckedChange={(v) => toggle.mutate({ id: r.id, visible: v })}
            aria-label={`Show ${r.name} to employees`}
          />
        </div>
      ),
    },
  ]

  if (list.error) return <ErrorState error={list.error} onRetry={() => list.refetch()} />

  return (
    <>
      <DataTable
        columns={columns}
        rows={list.data?.items ?? []}
        getRowId={(r) => r.id}
        loading={list.isLoading}
        clientPageSize={12}
        onRowClick={(r) => setOpenId(r.id)}
        emptyTitle={search || categoryId !== "all" || visibility !== "all" ? "No rewards match these filters" : "The HealthX catalogue is empty"}
        emptyDescription={search || categoryId !== "all" || visibility !== "all" ? "Try a different search or clear the filters." : "HealthX hasn't published catalogue rewards yet."}
        emptyAction={
          search || categoryId !== "all" || visibility !== "all" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("")
                setCategoryId("all")
                setVisibility("all")
              }}
            >
              Clear filters
            </Button>
          ) : undefined
        }
        className={list.isFetching && !list.isLoading ? "opacity-80 transition-opacity" : "transition-opacity"}
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Search the catalogue…" />
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
            <Select value={visibility} onValueChange={(v) => setVisibility(v as typeof visibility)}>
              <SelectTrigger className="h-9 w-full sm:w-40" aria-label="Visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Shown & hidden</SelectItem>
                <SelectItem value="visible">Shown to employees</SelectItem>
                <SelectItem value="hidden">Hidden</SelectItem>
              </SelectContent>
            </Select>
            <span className="ml-auto text-sm text-muted-foreground">
              {list.data ? `${pluralize(list.data.items.length, "reward")}${list.data.counts.hidden ? ` · ${formatNumber(list.data.counts.hidden)} hidden` : ""}` : ""}
            </span>
          </>
        }
      />
      <CatalogueRewardSheet
        reward={open}
        onOpenChange={(o) => !o && setOpenId(null)}
        visible={open ? isVisible(open) : true}
        pending={!!open && toggle.isPending && toggle.variables?.id === open.id}
        onVisibleChange={(v) => open && toggle.mutate({ id: open.id, visible: v })}
      />
    </>
  )
}
