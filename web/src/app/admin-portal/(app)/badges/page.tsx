"use client"

import { Archive, Award, LayoutGrid, MoreHorizontal, Pencil, Plus, RotateCcw, Rows3, Users } from "lucide-react"
import { useState } from "react"
import { CoverTile } from "@/components/admin/cover"
import { BadgeDialog } from "@/components/admin/engagement/badge-dialog"
import { RARITY_META, criteriaSummary } from "@/components/admin/engagement/meta"
import { FilterSelect } from "@/components/admin/filter-select"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { DataTable, type Column } from "@/components/common/data-table"
import { ConfirmDialog, SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { EmptyState, ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { badgesApi, type BadgeQuery } from "@/lib/api/platform/badges"
import { formatCompact, formatNumber } from "@/lib/format"
import type { Badge } from "@/lib/types"
import { cn } from "@/lib/utils"

const statusLabel = (s: Badge["status"]) => (s === "archived" ? "Inactive" : undefined)

function RarityPill({ rarity }: { rarity: Badge["rarity"] }) {
  return <span className={cn("inline-flex h-5 items-center rounded-md px-1.5 text-[11px] font-semibold", RARITY_META[rarity].className)}>{RARITY_META[rarity].label}</span>
}

export default function BadgesPage() {
  const can = useAdminCan()
  const canManage = can("catalog.manage")
  const [search, setSearch] = useState("")
  const [rarity, setRarity] = useState("all")
  const [status, setStatus] = useState("all")
  const [view, setView] = useState<"grid" | "table">("grid")
  const [editing, setEditing] = useState<Badge | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deactivating, setDeactivating] = useState<Badge | null>(null)

  const query: BadgeQuery = { search: search || undefined, rarity: rarity as BadgeQuery["rarity"], status: status as BadgeQuery["status"] }
  const list = useApiQuery(["admin", "badges", query], () => badgesApi.list(query), { placeholderData: (prev) => prev })
  const setStatusM = useApiMutation(badgesApi.setStatus, { success: (b) => (b.status === "archived" ? `“${b.name}” deactivated.` : `“${b.name}” activated.`), errorTitle: "Couldn't save badge." })

  const open = (b: Badge | null) => {
    setEditing(b)
    setDialogOpen(true)
  }
  const filtered = !!search || rarity !== "all" || status !== "all"
  const clear = () => {
    setSearch("")
    setRarity("all")
    setStatus("all")
  }
  const counts = list.data?.counts
  const items = list.data?.items ?? []

  const actions = (b: Badge) =>
    canManage ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${b.name}`} onClick={(e) => e.stopPropagation()}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => open(b)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {b.status === "archived" || b.status === "draft" ? (
            <DropdownMenuItem onClick={() => setStatusM.mutate({ id: b.id, status: "active" })}>
              <RotateCcw /> Activate
            </DropdownMenuItem>
          ) : null}
          {b.status !== "archived" ? (
            <DropdownMenuItem variant="destructive" onClick={() => setDeactivating(b)}>
              <Archive /> Deactivate
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null

  const columns: Column<Badge>[] = [
    {
      key: "badge",
      header: "Badge",
      sortValue: (b) => b.name,
      cell: (b) => (
        <div className="flex min-w-0 items-center gap-3">
          <CoverTile emoji={b.icon} color={b.color} size="sm" solid />
          <div className="min-w-0">
            <div className="truncate font-medium">{b.name}</div>
            <div className="truncate text-xs text-muted-foreground">{b.description}</div>
          </div>
        </div>
      ),
      className: "max-w-[190px] sm:max-w-72",
    },
    {
      key: "criteria",
      header: "Criteria",
      cell: (b) => (
        <div className="max-w-56 min-w-0">
          <div className="truncate text-sm">{b.criteria}</div>
          <div className="truncate text-xs text-muted-foreground">{criteriaSummary(b)}</div>
        </div>
      ),
      hideOnMobile: true,
    },
    { key: "rarity", header: "Rarity", sortValue: (b) => ["common", "rare", "epic", "legendary"].indexOf(b.rarity), cell: (b) => <RarityPill rarity={b.rarity} />, hideOnMobile: true },
    { key: "points", header: "Bonus", align: "right", sortValue: (b) => b.points, cell: (b) => <span className="tabular-nums">{b.points ? `+${formatNumber(b.points)}` : "—"}</span>, hideOnMobile: true },
    { key: "earned", header: "Awarded", align: "right", sortValue: (b) => b.earnedCount, cell: (b) => <span className="tabular-nums">{formatNumber(b.earnedCount)}</span>, hideOnMobile: true },
    { key: "status", header: "Status", cell: (b) => <StatusBadge status={b.status} label={statusLabel(b.status)} /> },
    { key: "actions", header: <span className="sr-only">Actions</span>, align: "right", cell: (b) => actions(b) },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Badges"
        description="Achievements employees unlock in the app — icons, criteria and bonus points shared by every company."
        actions={
          canManage ? (
            <Button onClick={() => open(null)}>
              <Plus data-icon="inline-start" /> Add badge
            </Button>
          ) : null
        }
      />

      {counts ? (
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground tabular-nums">{formatNumber(counts.active)}</span> active of {formatNumber(counts.all)} badges
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4" />
            <span className="font-semibold text-foreground tabular-nums">{formatCompact(counts.awarded)}</span> badges awarded across all companies
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search badges…" />
        <FilterSelect value={rarity} onChange={setRarity} allLabel="All rarities" options={Object.entries(RARITY_META).map(([value, m]) => ({ value, label: m.label }))} />
        <FilterSelect
          value={status}
          onChange={setStatus}
          allLabel="All statuses"
          options={[
            { value: "active", label: `Active${counts ? ` (${counts.active})` : ""}` },
            { value: "draft", label: `Draft${counts ? ` (${counts.draft})` : ""}` },
            { value: "archived", label: `Inactive${counts ? ` (${counts.archived})` : ""}` },
          ]}
        />
        {filtered ? (
          <Button variant="ghost" size="sm" onClick={clear}>
            Clear filters
          </Button>
        ) : null}
        <ToggleGroup type="single" variant="outline" value={view} onValueChange={(v) => v && setView(v as "grid" | "table")} className="ml-auto" aria-label="View">
          <ToggleGroupItem value="grid" aria-label="Grid view" className="px-2.5">
            <LayoutGrid />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table view" className="px-2.5">
            <Rows3 />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : view === "table" ? (
        <DataTable
          columns={columns}
          rows={items}
          getRowId={(b) => b.id}
          loading={list.isLoading}
          onRowClick={canManage ? (b) => open(b) : undefined}
          emptyTitle={filtered ? "No badges match these filters" : "No badges yet"}
          emptyDescription={filtered ? "Try a different search or clear the filters." : "Add First Workout, 7-Day Streak, Step Master, Hydration Hero and Early Bird to get started."}
        />
      ) : list.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Award}
          title={filtered ? "No badges match these filters" : "No badges yet"}
          description={filtered ? "Try a different search or clear the filters." : "Add First Workout, 7-Day Streak, Step Master, Hydration Hero and Early Bird to get started."}
          action={
            filtered ? (
              <Button variant="outline" onClick={clear}>
                Clear filters
              </Button>
            ) : canManage ? (
              <Button onClick={() => open(null)}>
                <Plus data-icon="inline-start" /> Add badge
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 transition-opacity", list.isFetching && "opacity-80")}>
          {items.map((b) => (
            <div
              key={b.id}
              role={canManage ? "button" : undefined}
              tabIndex={canManage ? 0 : undefined}
              onClick={canManage ? () => open(b) : undefined}
              onKeyDown={(e) => {
                if (!canManage || e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return
                e.preventDefault()
                open(b)
              }}
              className={cn(
                "flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs transition-shadow focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                canManage && "cursor-pointer hover:shadow-md",
                b.status === "archived" && "opacity-70",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <CoverTile emoji={b.icon} color={b.color} size="lg" solid className={cn(b.status !== "active" && "grayscale-[0.6]")} />
                <div className="flex items-center gap-1">
                  <RarityPill rarity={b.rarity} />
                  {actions(b)}
                </div>
              </div>
              <div className="min-w-0 space-y-1">
                <h3 className="truncate font-heading font-semibold">{b.name}</h3>
                <p className="line-clamp-2 text-sm text-muted-foreground">{b.description}</p>
              </div>
              <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <div className="font-medium">{b.criteria}</div>
                <div className="text-muted-foreground">{criteriaSummary(b)}</div>
              </div>
              <div className="mt-auto flex items-end justify-between gap-2">
                <StatusBadge status={b.status} label={statusLabel(b.status)} />
                <div className="text-right text-xs leading-tight whitespace-nowrap tabular-nums">
                  <div className="font-semibold">{b.points ? `+${formatNumber(b.points)} pts` : "No bonus"}</div>
                  <div className="text-muted-foreground">{formatCompact(b.earnedCount)} awarded</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <BadgeDialog open={dialogOpen} onOpenChange={setDialogOpen} badge={editing} />
      <ConfirmDialog
        open={!!deactivating}
        onOpenChange={(o) => !o && setDeactivating(null)}
        title={`Deactivate “${deactivating?.name ?? ""}”?`}
        description="Employees can no longer earn it. People who already earned it keep the badge. You can activate it again later."
        confirmLabel="Deactivate badge"
        destructive
        onConfirm={() => deactivating && setStatusM.mutate({ id: deactivating.id, status: "archived" })}
      />
    </PageContainer>
  )
}
