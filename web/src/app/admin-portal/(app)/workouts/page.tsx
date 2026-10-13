"use client"

import { Dumbbell, LayoutGrid, List, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { LevelBadge, LoadError, ResultCount } from "@/components/admin/content/bits"
import { LOCATION_ICON, LOCATION_LABEL, LOCATION_OPTIONS, LEVEL_OPTIONS, WORKOUT_STATUS_OPTIONS } from "@/components/admin/content/meta"
import { WorkoutActionsMenu } from "@/components/admin/content/workout-actions"
import { WorkoutCard } from "@/components/admin/content/workout-card"
import { CoverTile } from "@/components/admin/cover"
import { FilterSelect } from "@/components/admin/filter-select"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { DataTable, type Column } from "@/components/common/data-table"
import { SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { EmptyState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useApiQuery } from "@/lib/api/hooks"
import { workoutsApi, type WorkoutQuery, type WorkoutRow } from "@/lib/api/platform/workouts"
import { formatNumber, formatRelative } from "@/lib/format"
import type { FitnessLevel, Workout } from "@/lib/types"

/** SCR-P-016 Workouts — global workout library. */
export default function WorkoutsPage() {
  const can = useAdminCan()
  const manage = can("catalog.manage")
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [level, setLevel] = useState<FitnessLevel | "all">("all")
  const [location, setLocation] = useState<Workout["location"] | "all">("all")
  const [status, setStatus] = useState<Workout["status"] | "all">("all")
  const [view, setView] = useState<"cards" | "table">("cards")

  const query: WorkoutQuery = { search: search || undefined, category, level, location, status }
  const list = useApiQuery(["admin", "workouts", query], () => workoutsApi.list(query), { placeholderData: (prev) => prev })
  const rows = list.data?.items ?? []
  const filtered = !!search || category !== "all" || level !== "all" || location !== "all" || status !== "all"
  const libraryEmpty = list.data?.counts.all === 0
  const clear = () => {
    setSearch("")
    setCategory("all")
    setLevel("all")
    setLocation("all")
    setStatus("all")
  }

  const createButton = manage ? (
    <Button asChild>
      <Link href="/admin-portal/workouts/new">
        <Plus data-icon="inline-start" /> Create workout
      </Link>
    </Button>
  ) : null

  const columns: Column<WorkoutRow>[] = [
    {
      key: "name",
      header: "Workout",
      cell: (w) => (
        <div className="flex min-w-0 items-center gap-3">
          <CoverTile emoji={w.coverEmoji} color={w.coverColor} />
          <div className="min-w-0">
            <div className="truncate font-medium">{w.name}</div>
            <div className="truncate text-xs text-muted-foreground">{w.category}</div>
          </div>
        </div>
      ),
      sortValue: (w) => w.name,
      className: "max-w-72",
    },
    { key: "level", header: "Level", cell: (w) => <LevelBadge level={w.level} />, sortValue: (w) => ["beginner", "intermediate", "advanced"].indexOf(w.level), hideOnMobile: true },
    {
      key: "location",
      header: "Location",
      cell: (w) => (
        <span className="text-sm whitespace-nowrap">
          {LOCATION_ICON[w.location]} {LOCATION_LABEL[w.location]}
        </span>
      ),
      hideOnMobile: true,
    },
    { key: "duration", header: "Duration", cell: (w) => <span className="text-sm tabular-nums">{w.durationMin} min</span>, sortValue: (w) => w.durationMin, align: "right", hideOnMobile: true },
    { key: "exercises", header: "Exercises", cell: (w) => <span className="text-sm tabular-nums">{w.exercisesCount}</span>, sortValue: (w) => w.exercisesCount, align: "right", hideOnMobile: true },
    { key: "completions", header: "Completions", cell: (w) => <span className="text-sm tabular-nums">{formatNumber(w.completions)}</span>, sortValue: (w) => w.completions, align: "right", hideOnMobile: true },
    { key: "status", header: "Status", cell: (w) => <StatusBadge status={w.status} />, sortValue: (w) => w.status },
    { key: "updated", header: "Updated", cell: (w) => <span className="text-sm whitespace-nowrap text-muted-foreground">{formatRelative(w.updatedAt)}</span>, sortValue: (w) => w.updatedAt, hideOnMobile: true },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (w) => (
        <div onClick={(e) => e.stopPropagation()}>
          <WorkoutActionsMenu workout={w} />
        </div>
      ),
    },
  ]

  const toolbar = (
    <div className="flex w-full flex-wrap items-center gap-2">
      <SearchInput value={search} onChange={setSearch} placeholder="Search workouts…" />
      <FilterSelect value={category} onChange={setCategory} allLabel="All categories" options={(list.data?.categories ?? []).map((c) => ({ value: c, label: c }))} className="sm:w-44" />
      <FilterSelect value={level} onChange={(v) => setLevel(v as FitnessLevel | "all")} allLabel="All levels" options={LEVEL_OPTIONS} />
      <FilterSelect value={location} onChange={(v) => setLocation(v as Workout["location"] | "all")} allLabel="All locations" options={LOCATION_OPTIONS} />
      <FilterSelect value={status} onChange={(v) => setStatus(v as Workout["status"] | "all")} allLabel="All statuses" options={WORKOUT_STATUS_OPTIONS} />
      <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
        <ResultCount count={list.data?.total} noun={["workout", "workouts"]} className="mr-auto sm:mr-0" />
        <ToggleGroup type="single" variant="outline" value={view} onValueChange={(v) => v && setView(v as "cards" | "table")} aria-label="View">
          <ToggleGroupItem value="cards" aria-label="Cards view" className="px-2.5">
            <LayoutGrid />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table view" className="px-2.5">
            <List />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  )

  return (
    <PageContainer>
      <PageHeader
        title="Workouts"
        description="The HealthX workout library. Only published workouts appear in the Employee App; drafts and archived workouts stay hidden."
        actions={createButton}
      />

      {view === "cards" ? toolbar : null}

      {list.error ? (
        <LoadError title="Couldn't load workouts." error={list.error} onRetry={() => list.refetch()} />
      ) : view === "table" ? (
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(w) => w.id}
          loading={list.isLoading}
          onRowClick={(w) => router.push(`/admin-portal/workouts/${w.id}`)}
          clientPageSize={15}
          toolbar={toolbar}
          emptyTitle={libraryEmpty ? "No workouts yet." : "No workouts match these filters"}
          emptyDescription={libraryEmpty ? "Build the first workout from the exercise library." : "Try a different search or clear the filters."}
          emptyAction={libraryEmpty ? createButton : <Button variant="outline" onClick={clear}>Clear filters</Button>}
        />
      ) : list.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title={libraryEmpty ? "No workouts yet." : "No workouts match these filters"}
          description={libraryEmpty ? "Build the first workout from the exercise library." : "Try a different search or clear the filters."}
          action={libraryEmpty ? createButton : filtered ? <Button variant="outline" onClick={clear}>Clear filters</Button> : null}
        />
      ) : (
        <div className={list.isFetching ? "grid gap-4 opacity-80 transition-opacity sm:grid-cols-2 xl:grid-cols-3" : "grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3"}>
          {rows.map((w) => (
            <WorkoutCard key={w.id} workout={w} />
          ))}
        </div>
      )}
    </PageContainer>
  )
}
