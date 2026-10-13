"use client"

import { Dumbbell, LayoutGrid, Library, List, Plus, SearchX } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { CountTabs } from "@/components/business/engagement/count-tabs"
import { CoverTile } from "@/components/business/engagement/cover-picker"
import { WorkoutActionsMenu } from "@/components/business/engagement/workouts/workout-actions"
import { LevelBars, WorkoutCard } from "@/components/business/engagement/workouts/workout-card"
import { LEVEL_META, LOCATION_META, STATUS_LABEL } from "@/components/business/engagement/workouts/workout-meta"
import { DataTable, type Column } from "@/components/common/data-table"
import { SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { EmptyState, ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { WORKOUT_LEVELS, WORKOUT_LOCATIONS, workoutsApi, type WorkoutQuery, type WorkoutRow, type WorkoutScope } from "@/lib/api/business/workouts"
import { useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { formatDuration, formatNumber, formatRelative, pluralize } from "@/lib/format"
import type { FitnessLevel, Workout } from "@/lib/types"

type StatusFilter = Workout["status"] | "all"

function WorkoutsPage() {
  const can = useCan()
  const manage = can("content.manage")
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [scope, setScopeState] = useState<WorkoutScope>(params.get("tab") === "library" ? "library" : "company")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [category, setCategory] = useState("all")
  const [level, setLevel] = useState<FitnessLevel | "all">("all")
  const [location, setLocation] = useState<Workout["location"] | "all">("all")
  const [search, setSearch] = useState("")
  const [view, setView] = useState<"cards" | "table">("cards")

  const setScope = (s: WorkoutScope) => {
    setScopeState(s)
    setStatus("all")
    setCategory("all")
    router.replace(s === "company" ? pathname : `${pathname}?tab=library`, { scroll: false })
  }
  const clearFilters = () => {
    setSearch("")
    setStatus("all")
    setCategory("all")
    setLevel("all")
    setLocation("all")
  }

  const query: WorkoutQuery = { scope, status: scope === "company" ? status : undefined, category, level, location, search: search || undefined }
  const list = useApiQuery(["business", "workouts", query], () => workoutsApi.list(query), { placeholderData: (prev) => prev })
  const counts = list.data?.counts
  const filtered = !!search || category !== "all" || level !== "all" || location !== "all" || (scope === "company" && status !== "all")
  const items = list.data?.items ?? []

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
    {
      key: "level",
      header: "Level",
      cell: (w) => (
        <span className="inline-flex items-center gap-1.5 text-sm">
          <LevelBars level={w.level} className="text-primary" />
          {LEVEL_META[w.level].label}
        </span>
      ),
      sortValue: (w) => LEVEL_META[w.level].bars,
      hideOnMobile: true,
    },
    { key: "location", header: "Location", cell: (w) => <span className="text-sm">{LOCATION_META[w.location].label}</span>, hideOnMobile: true },
    { key: "duration", header: "Length", align: "right", cell: (w) => <span className="text-sm tabular-nums">{formatDuration(w.durationMin)}</span>, sortValue: (w) => w.durationMin, hideOnMobile: true },
    { key: "exercises", header: "Exercises", align: "right", cell: (w) => <span className="text-sm tabular-nums">{w.exercisesCount}</span>, sortValue: (w) => w.exercisesCount, hideOnMobile: true },
    ...(scope === "company" ? [{ key: "status", header: "Status", cell: (w: WorkoutRow) => <StatusBadge status={w.status} />, sortValue: (w: WorkoutRow) => w.status } satisfies Column<WorkoutRow>] : []),
    { key: "completions", header: "Completions", align: "right", cell: (w) => <span className="text-sm tabular-nums">{formatNumber(w.completions)}</span>, sortValue: (w) => w.completions },
    ...(scope === "company"
      ? [
          {
            key: "updated",
            header: "Updated",
            cell: (w: WorkoutRow) => <span className="text-sm text-muted-foreground">{formatRelative(w.updatedAt)}</span>,
            sortValue: (w: WorkoutRow) => w.updatedAt,
            className: "hidden xl:table-cell",
            headerClassName: "hidden xl:table-cell",
          } satisfies Column<WorkoutRow>,
        ]
      : []),
    { key: "actions", header: <span className="sr-only">Actions</span>, align: "right", cell: (w) => <WorkoutActionsMenu workout={w} /> },
  ]

  const companyEmpty = scope === "company" && !filtered && counts?.company === 0

  return (
    <PageContainer>
      <PageHeader
        title="Workouts"
        badge={<PhaseBadge phase={2} />}
        description="Create workouts for your people from the HealthX exercise library. Published workouts appear in the app's Workouts tab next to the HealthX library."
        actions={
          manage ? (
            <Button asChild>
              <Link href="/business-portal/workouts/new">
                <Plus data-icon="inline-start" /> Create workout
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3">
        <CountTabs
          value={scope}
          onChange={setScope}
          ariaLabel="Workout source"
          items={[
            { value: "company", label: "Company workouts", count: counts?.company },
            { value: "library", label: "HealthX library", count: counts?.library },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search workouts…" />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-44" aria-label="Category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(list.data?.categories ?? []).map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={level} onValueChange={(v) => setLevel(v as FitnessLevel | "all")}>
            <SelectTrigger className="h-9 w-36" aria-label="Level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              {WORKOUT_LEVELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {LEVEL_META[l].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={location} onValueChange={(v) => setLocation(v as Workout["location"] | "all")}>
            <SelectTrigger className="h-9 w-36" aria-label="Location">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {WORKOUT_LOCATIONS.map((l) => (
                <SelectItem key={l} value={l}>
                  {LOCATION_META[l].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {scope === "company" ? (
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger className="h-9 w-40" aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(["published", "draft", "archived"] as const).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                    {counts ? ` (${counts[s]})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <span className="ml-auto hidden text-sm text-muted-foreground sm:inline">{list.data ? pluralize(items.length, "workout") : ""}</span>
          <ToggleGroup type="single" variant="outline" value={view} onValueChange={(v) => v && setView(v as "cards" | "table")} aria-label="Layout" className="ml-auto sm:ml-0">
            <ToggleGroupItem value="cards" aria-label="Cards" className="h-9 px-2.5">
              <LayoutGrid />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Table" className="h-9 px-2.5">
              <List />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        {scope === "library" ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Library className="mt-0.5 size-4 shrink-0" />
            Workouts made by HealthX are read-only and already available to everyone. Copy one to your company workouts to change it.
          </p>
        ) : null}
      </div>

      {list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : companyEmpty ? (
        <EmptyState
          icon={Dumbbell}
          title="No company workouts yet"
          description={manage ? "Build a workout from HealthX exercises, or copy one from the HealthX library and make it your own." : "Your company hasn't created any workouts yet."}
          action={
            manage ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={() => setScope("library")}>
                  <Library data-icon="inline-start" /> Browse HealthX library
                </Button>
                <Button asChild>
                  <Link href="/business-portal/workouts/new">
                    <Plus data-icon="inline-start" /> Create workout
                  </Link>
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={filtered ? "No workouts match these filters" : "Nothing here yet"}
          description={filtered ? "Try a different search, category, level or location." : "Workouts will appear here."}
          action={
            filtered ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : view === "cards" ? (
        <div className={list.isFetching ? "grid gap-4 opacity-70 transition-opacity sm:grid-cols-2 xl:grid-cols-3" : "grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3"}>
          {items.map((w) => (
            <WorkoutCard key={w.id} workout={w} />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={items}
          getRowId={(w) => w.id}
          onRowClick={(w) => router.push(`/business-portal/workouts/${w.id}`)}
          clientPageSize={12}
          className={list.isFetching ? "opacity-80 transition-opacity" : "transition-opacity"}
        />
      )}
    </PageContainer>
  )
}

export default function Page() {
  return (
    <Suspense>
      <WorkoutsPage />
    </Suspense>
  )
}
