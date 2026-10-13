"use client"

import { Eye, MoreHorizontal, Pencil, Plus, PowerOff, RotateCcw, Zap } from "lucide-react"
import { useState } from "react"
import { LoadError, ResultCount } from "@/components/admin/content/bits"
import { HabitDialog } from "@/components/admin/content/habit-dialog"
import { AUTO_COMPLETE_LABEL, AUTO_COMPLETE_OPTIONS, HABIT_CATEGORY_LABEL, HABIT_CATEGORY_OPTIONS, HABIT_STATUS_OPTIONS, HABIT_UNIT_LABEL, habitStatusLabel, habitTargetLabel } from "@/components/admin/content/meta"
import { FilterSelect } from "@/components/admin/filter-select"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { DataTable, type Column } from "@/components/common/data-table"
import { ConfirmDialog, SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { habitsApi, type HabitAutoComplete, type HabitQuery, type HabitRow } from "@/lib/api/platform/habits"
import { formatNumber } from "@/lib/format"
import type { HabitDefinition } from "@/lib/types"

/** SCR-P-019 Habit library. */
export default function HabitsPage() {
  const can = useAdminCan()
  const manage = can("catalog.manage")
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<HabitDefinition["category"] | "all">("all")
  const [status, setStatus] = useState<HabitDefinition["status"] | "all">("all")
  const [autoComplete, setAutoComplete] = useState<HabitAutoComplete | "all">("all")
  const [editor, setEditor] = useState<{ open: boolean; habit: HabitRow | null }>({ open: false, habit: null })
  const [toDeactivate, setToDeactivate] = useState<HabitRow | null>(null)

  const query: HabitQuery = { search: search || undefined, category, status, autoComplete }
  const list = useApiQuery(["admin", "habits", query], () => habitsApi.list(query), { placeholderData: (prev) => prev })
  const deactivate = useApiMutation(habitsApi.update, { success: (h) => `“${h.name}” deactivated. It no longer appears for new selection.`, errorTitle: "Couldn't save habit." })
  const activate = useApiMutation(habitsApi.update, { success: (h) => `“${h.name}” is active again.`, errorTitle: "Couldn't save habit." })

  const libraryEmpty = list.data?.counts.all === 0
  const filtered = !!search || category !== "all" || status !== "all" || autoComplete !== "all"
  const openEditor = (habit: HabitRow | null) => setEditor({ open: true, habit })

  const columns: Column<HabitRow>[] = [
    {
      key: "name",
      header: "Habit",
      cell: (h) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xl" aria-hidden>
            {h.icon}
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium">{h.name}</div>
            <div className="truncate text-xs text-muted-foreground">{h.description || "No description"}</div>
          </div>
        </div>
      ),
      sortValue: (h) => h.name,
      className: "max-w-72",
    },
    { key: "category", header: "Category", cell: (h) => <span className="text-sm">{HABIT_CATEGORY_LABEL[h.category]}</span>, sortValue: (h) => h.category, hideOnMobile: true },
    {
      key: "target",
      header: "Target",
      cell: (h) => (
        <div className="text-sm whitespace-nowrap">
          <div>{habitTargetLabel(h.defaultTarget, h.unit)}</div>
          <div className="text-xs text-muted-foreground">
            {HABIT_UNIT_LABEL[h.unit]}
            {h.minTarget || h.maxTarget ? ` · ${h.minTarget ? formatNumber(h.minTarget) : "…"}–${h.maxTarget ? formatNumber(h.maxTarget) : "…"}` : ""}
          </div>
        </div>
      ),
      hideOnMobile: true,
    },
    { key: "points", header: "Points", cell: (h) => <span className="text-sm tabular-nums">{formatNumber(h.points)}</span>, sortValue: (h) => h.points, align: "right", hideOnMobile: true },
    {
      key: "auto",
      header: (
        <span className="inline-flex items-center gap-1.5">
          Auto-complete <PhaseBadge phase={2} className="normal-case" />
        </span>
      ),
      cell: (h) =>
        h.autoCompleteFrom ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-sky-700 dark:text-sky-300">
            <Zap className="size-3" /> {AUTO_COMPLETE_LABEL[h.autoCompleteFrom]}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Manual</span>
        ),
      hideOnMobile: true,
    },
    { key: "users", header: "Users", cell: (h) => <span className="text-sm tabular-nums">{formatNumber(h.usersCount)}</span>, sortValue: (h) => h.usersCount, align: "right", hideOnMobile: true },
    { key: "status", header: "Status", cell: (h) => <StatusBadge status={h.status} label={habitStatusLabel(h.status)} />, sortValue: (h) => h.status },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (h) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${h.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => openEditor(h)}>
                {manage ? <Pencil /> : <Eye />} {manage ? "Edit" : "View"}
              </DropdownMenuItem>
              {manage ? (
                <>
                  <DropdownMenuSeparator />
                  {h.status === "archived" ? (
                    <DropdownMenuItem onClick={() => activate.mutate({ id: h.id, status: "active" })}>
                      <RotateCcw /> Reactivate
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem variant="destructive" onClick={() => setToDeactivate(h)}>
                      <PowerOff /> Deactivate
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

  const addButton = manage ? (
    <Button onClick={() => openEditor(null)}>
      <Plus data-icon="inline-start" /> Add habit
    </Button>
  ) : null

  return (
    <PageContainer>
      <PageHeader title="Habit library" description="The habits employees can choose in the app. Deactivated habits stop appearing for new selection; existing trackers keep their history." actions={addButton} />

      {list.error ? (
        <LoadError title="Couldn't load habits." error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={list.data?.items ?? []}
          getRowId={(h) => h.id}
          loading={list.isLoading}
          onRowClick={(h) => openEditor(h)}
          clientPageSize={15}
          emptyTitle={libraryEmpty ? "No habits yet." : "No habits match these filters"}
          emptyDescription={libraryEmpty ? "Add habits employees can pick, like Drink water or Walk daily." : "Try a different search or clear the filters."}
          emptyAction={
            libraryEmpty ? (
              addButton
            ) : filtered ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("")
                  setCategory("all")
                  setStatus("all")
                  setAutoComplete("all")
                }}
              >
                Clear filters
              </Button>
            ) : null
          }
          className={list.isFetching && !list.isLoading ? "opacity-80 transition-opacity" : "transition-opacity"}
          toolbar={
            <>
              <SearchInput value={search} onChange={setSearch} placeholder="Search habits…" />
              <FilterSelect value={category} onChange={(v) => setCategory(v as HabitDefinition["category"] | "all")} allLabel="All categories" options={HABIT_CATEGORY_OPTIONS} />
              <FilterSelect value={autoComplete} onChange={(v) => setAutoComplete(v as HabitAutoComplete | "all")} allLabel="Any completion" options={AUTO_COMPLETE_OPTIONS} className="sm:w-44" />
              <FilterSelect value={status} onChange={(v) => setStatus(v as HabitDefinition["status"] | "all")} allLabel="All statuses" options={HABIT_STATUS_OPTIONS} />
              <ResultCount count={list.data?.total} noun={["habit", "habits"]} />
            </>
          }
        />
      )}

      <HabitDialog open={editor.open} onOpenChange={(open) => setEditor((s) => ({ ...s, open }))} habit={editor.habit} />

      <ConfirmDialog
        open={!!toDeactivate}
        onOpenChange={(o) => !o && setToDeactivate(null)}
        destructive
        title={`Deactivate “${toDeactivate?.name ?? ""}”?`}
        description={`Deactivated habits stop appearing for new selection. The ${formatNumber(toDeactivate?.usersCount ?? 0)} employees already tracking it keep their history. You can reactivate it later.`}
        confirmLabel="Deactivate habit"
        onConfirm={() => {
          if (toDeactivate) deactivate.mutate({ id: toDeactivate.id, status: "archived" })
          setToDeactivate(null)
        }}
      />
    </PageContainer>
  )
}
