"use client"

import { Archive, Gift, MoreHorizontal, Pencil, Plus, RotateCcw, Star, StarOff } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { CoverTile } from "@/components/admin/cover"
import { ADMIN, DELIVERY_META, REWARD_STATUS_LABEL } from "@/components/admin/engagement/meta"
import { RewardCategoriesTab } from "@/components/admin/engagement/reward-categories"
import { stockLabel } from "@/components/admin/engagement/reward-preview"
import { FilterSelect } from "@/components/admin/filter-select"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { DataTable, type Column } from "@/components/common/data-table"
import { ConfirmDialog, SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { rewardCategoriesApi, rewardsApi, type RewardQuery, type RewardRow } from "@/lib/api/platform/rewards"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

export default function RewardsCataloguePage() {
  const can = useAdminCan()
  const canManage = can("catalog.manage")
  const [tab, setTab] = useState("rewards")
  const list = useApiQuery(["admin", "rewards", "counts"], () => rewardsApi.list({}))
  const categories = useApiQuery(["admin", "reward-categories"], () => rewardCategoriesApi.list())

  return (
    <PageContainer>
      <PageHeader
        title="Rewards catalogue"
        description="Global HealthX rewards offered to every company, and the categories that organise the rewards store."
        actions={
          canManage ? (
            <Button asChild>
              <Link href={`${ADMIN}/rewards/new`}>
                <Plus data-icon="inline-start" /> Add reward
              </Link>
            </Button>
          ) : null
        }
      />
      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList>
          <TabsTrigger value="rewards">
            Rewards{list.data ? <span className="ml-1 text-xs text-muted-foreground tabular-nums">{list.data.counts.all}</span> : null}
          </TabsTrigger>
          <TabsTrigger value="categories">
            Categories{categories.data ? <span className="ml-1 text-xs text-muted-foreground tabular-nums">{categories.data.length}</span> : null}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="rewards">
          <RewardsTab />
        </TabsContent>
        <TabsContent value="categories">
          <RewardCategoriesTab />
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}

function RewardsTab() {
  const router = useRouter()
  const can = useAdminCan()
  const canManage = can("catalog.manage")
  const [search, setSearch] = useState("")
  const [categoryId, setCategoryId] = useState("all")
  const [status, setStatus] = useState("all")
  const [delivery, setDelivery] = useState("all")
  const [deactivating, setDeactivating] = useState<RewardRow | null>(null)

  const categories = useApiQuery(["admin", "reward-categories"], () => rewardCategoriesApi.list())
  const query: RewardQuery = { search: search || undefined, categoryId, status: status as RewardQuery["status"], delivery: delivery as RewardQuery["delivery"] }
  const list = useApiQuery(["admin", "rewards", query], () => rewardsApi.list(query), { placeholderData: (prev) => prev })

  const featured = useApiMutation(rewardsApi.setFeatured, { success: (r) => (r.featured ? `“${r.name}” is now featured.` : `“${r.name}” is no longer featured.`) })
  const setStatusM = useApiMutation(rewardsApi.setStatus, { success: (r) => (r.status === "archived" ? `“${r.name}” deactivated.` : `“${r.name}” activated.`) })

  const filtered = !!search || categoryId !== "all" || status !== "all" || delivery !== "all"
  const clear = () => {
    setSearch("")
    setCategoryId("all")
    setStatus("all")
    setDelivery("all")
  }
  const counts = list.data?.counts

  const columns: Column<RewardRow>[] = [
    {
      key: "name",
      header: "Reward",
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <CoverTile emoji={r.imageEmoji} color={r.imageColor} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-medium">{r.name}</span>
              {r.featured ? <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Featured" /> : null}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              <span className="md:hidden">{formatNumber(r.pointsCost)} pts · </span>
              {r.provider ? `by ${r.provider}` : r.categoryName}
            </div>
          </div>
        </div>
      ),
      className: "max-w-[170px] sm:max-w-80",
    },
    {
      key: "category",
      header: "Category",
      sortValue: (r) => r.categoryName,
      cell: (r) => (
        <span className="text-sm whitespace-nowrap">
          {r.categoryIcon} {r.categoryName}
        </span>
      ),
      hideOnMobile: true,
    },
    { key: "cost", header: "Points", align: "right", sortValue: (r) => r.pointsCost, cell: (r) => <span className="font-semibold tabular-nums">{formatNumber(r.pointsCost)}</span>, hideOnMobile: true },
    {
      key: "delivery",
      header: "Delivery",
      cell: (r) => {
        const Icon = DELIVERY_META[r.delivery].icon
        return (
          <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap text-muted-foreground">
            <Icon className="size-3.5" /> {DELIVERY_META[r.delivery].label}
          </span>
        )
      },
      hideOnMobile: true,
    },
    {
      key: "stock",
      header: "Stock",
      sortValue: (r) => r.stock ?? Number.MAX_SAFE_INTEGER,
      cell: (r) => (
        <span className={cn("text-sm whitespace-nowrap tabular-nums", r.stock !== null && r.stock <= 0 ? "font-medium text-amber-700 dark:text-amber-400" : r.stock === null ? "text-muted-foreground" : "")}>
          {stockLabel(r.stock)}
        </span>
      ),
      hideOnMobile: true,
    },
    { key: "limit", header: "Limit", cell: (r) => <span className="text-sm whitespace-nowrap text-muted-foreground">{r.perEmployeeLimit ? `${r.perEmployeeLimit} / person` : "—"}</span>, hideOnMobile: true },
    { key: "redemptions", header: "Redeemed", align: "right", sortValue: (r) => r.redemptionsCount, cell: (r) => <span className="tabular-nums">{formatNumber(r.redemptionsCount)}</span>, hideOnMobile: true },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} label={REWARD_STATUS_LABEL[r.status]} /> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (r) =>
        canManage ? (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={`${ADMIN}/rewards/${r.id}`}>
                    <Pencil /> Edit
                  </Link>
                </DropdownMenuItem>
                {r.status !== "archived" ? (
                  <DropdownMenuItem onClick={() => featured.mutate({ id: r.id, featured: !r.featured })}>
                    {r.featured ? <StarOff /> : <Star />} {r.featured ? "Unfeature" : "Feature"}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                {r.status === "archived" ? (
                  <DropdownMenuItem onClick={() => setStatusM.mutate({ id: r.id, status: "active" })}>
                    <RotateCcw /> Activate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem variant="destructive" onClick={() => setDeactivating(r)}>
                    <Archive /> Deactivate
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null,
    },
  ]

  if (list.error) return <ErrorState error={new Error("Couldn't load rewards.")} onRetry={() => list.refetch()} />

  return (
    <>
      <DataTable
        columns={columns}
        rows={list.data?.items ?? []}
        getRowId={(r) => r.id}
        loading={list.isLoading}
        clientPageSize={12}
        onRowClick={canManage ? (r) => router.push(`${ADMIN}/rewards/${r.id}`) : undefined}
        emptyTitle={filtered ? "No rewards match these filters" : "No rewards yet."}
        emptyDescription={filtered ? "Try a different search or clear the filters." : "Add the first global reward for employees to redeem."}
        emptyAction={
          filtered ? (
            <Button variant="outline" onClick={clear}>
              Clear filters
            </Button>
          ) : canManage ? (
            <Button asChild>
              <Link href={`${ADMIN}/rewards/new`}>
                <Gift data-icon="inline-start" /> Add reward
              </Link>
            </Button>
          ) : undefined
        }
        className={list.isFetching && !list.isLoading ? "opacity-80 transition-opacity" : "transition-opacity"}
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Search rewards…" />
            <FilterSelect value={categoryId} onChange={setCategoryId} allLabel="All categories" options={(categories.data ?? []).map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))} />
            <FilterSelect
              value={status}
              onChange={setStatus}
              allLabel="All statuses"
              options={[
                { value: "active", label: `Active${counts ? ` (${counts.active})` : ""}` },
                { value: "out_of_stock", label: `Out of stock${counts ? ` (${counts.out_of_stock})` : ""}` },
                { value: "draft", label: `Draft${counts ? ` (${counts.draft})` : ""}` },
                { value: "archived", label: `Inactive${counts ? ` (${counts.archived})` : ""}` },
              ]}
            />
            <FilterSelect value={delivery} onChange={setDelivery} allLabel="All delivery types" className="sm:w-44" options={Object.entries(DELIVERY_META).map(([value, m]) => ({ value, label: m.label }))} />
            {filtered ? (
              <Button variant="ghost" size="sm" onClick={clear}>
                Clear
              </Button>
            ) : null}
          </>
        }
      />
      <ConfirmDialog
        open={!!deactivating}
        onOpenChange={(o) => !o && setDeactivating(null)}
        title={`Deactivate “${deactivating?.name ?? ""}”?`}
        description="It disappears from every company's rewards store. Orders already placed are still fulfilled. You can activate it again later."
        confirmLabel="Deactivate reward"
        destructive
        onConfirm={() => deactivating && setStatusM.mutate({ id: deactivating.id, status: "archived" })}
      />
    </>
  )
}
