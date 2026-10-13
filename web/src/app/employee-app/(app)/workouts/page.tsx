"use client"

import { History, SearchX, SlidersHorizontal } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { SearchInput } from "@/components/common/misc"
import { EmptyState, ErrorState } from "@/components/common/states"
import { EQUIPMENT_LABEL, LEVEL_LABEL, LOCATION_LABEL, titleWord } from "@/components/employee/track/activity-meta"
import { Chip, TrackHeader, TrackPage } from "@/components/employee/track/track-ui"
import { WorkoutCard } from "@/components/employee/track/workout-card"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { DURATION_LABEL, filterWorkouts, workoutsApi, type WorkoutCard as WorkoutCardData, type WorkoutFilterValues, type WorkoutQuery } from "@/lib/api/employee/workouts"
import { useApiQuery } from "@/lib/api/hooks"
import { cn } from "@/lib/utils"

type Filters = Required<Pick<WorkoutQuery, "level" | "location" | "equipment" | "duration" | "muscle">>
const EMPTY: Filters = { level: [], location: [], equipment: [], duration: [], muscle: [] }
const countFilters = (f: Filters) => Object.values(f).reduce((a, v) => a + v.length, 0)

/** SCR-M-029 Workout Library + SCR-M-030 Workout Filters (sheet). */
function Library() {
  const params = useSearchParams()
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState(params.get("category") ?? "all")
  const [filters, setFilters] = useState<Filters>(EMPTY)
  const [sheet, setSheet] = useState(false)

  const query: WorkoutQuery = { q: search.trim().length >= 2 ? search.trim() : undefined, category, ...filters }
  const list = useApiQuery(["employee", "workouts", query], () => workoutsApi.list(query))
  const values = useApiQuery(["employee", "workouts", "filters"], () => workoutsApi.filters())
  const active = countFilters(filters)

  const clearAll = () => {
    setFilters(EMPTY)
    setCategory("all")
    setSearch("")
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search workouts, e.g. core, yoga" className="flex-1 sm:w-auto [&_input]:h-11 [&_input]:rounded-xl [&_input]:text-base sm:[&_input]:text-sm" />
          <Button variant="outline" className="relative h-11 rounded-xl" onClick={() => setSheet(true)} aria-label={`Filters${active ? ` (${active} active)` : ""}`}>
            <SlidersHorizontal data-icon="inline-start" />
            <span className="hidden sm:inline">Filters</span>
            {active ? <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{active}</span> : null}
          </Button>
        </div>
        {search.trim().length === 1 ? <p className="px-1 text-xs text-muted-foreground">Type at least 2 characters to search.</p> : null}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip selected={category === "all"} onClick={() => setCategory("all")} className="shrink-0">
            All
          </Chip>
          {(values.data?.categories ?? []).map((c) => (
            <Chip key={c} selected={category === c} onClick={() => setCategory(c)} className="shrink-0">
              {c}
            </Chip>
          ))}
        </div>
      </div>

      {list.error ? (
        <ErrorState error={new Error("Couldn't load workouts.")} onRetry={() => list.refetch()} />
      ) : !list.data ? (
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : list.data.items.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No workouts match your filters."
          description="Try a different search or fewer filters."
          action={
            <Button variant="outline" onClick={clearAll}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <p className="-mb-2 px-1 text-xs text-muted-foreground">
            {list.data.total} workout{list.data.total === 1 ? "" : "s"}
            {active || category !== "all" || query.q ? " match" : " available"}
          </p>
          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3">
            {list.data.items.map((w) => (
              <WorkoutCard key={w.id} w={w} />
            ))}
          </div>
        </>
      )}

      <FilterSheet
        open={sheet}
        onOpenChange={setSheet}
        values={values.data}
        valuesError={!!values.error}
        all={list.data?.all ?? []}
        base={{ q: query.q, category }}
        initial={filters}
        onApply={(f) => {
          setFilters(f)
          setSheet(false)
        }}
      />
    </>
  )
}

function FilterSheet({
  open,
  onOpenChange,
  values,
  valuesError,
  all,
  base,
  initial,
  onApply,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  values?: WorkoutFilterValues
  valuesError: boolean
  all: WorkoutCardData[]
  base: WorkoutQuery
  initial: Filters
  onApply: (f: Filters) => void
}) {
  const [draft, setDraft] = useState<Filters>(initial)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setDraft(initial)
  }
  const count = filterWorkouts(all, { ...base, ...draft }).length
  const toggle = <K extends keyof Filters>(key: K, value: Filters[K][number]) =>
    setDraft((d) => {
      const list = d[key] as string[]
      return { ...d, [key]: list.includes(value as string) ? list.filter((x) => x !== value) : [...list, value] }
    })

  const groups: { key: keyof Filters; label: string; options: { value: string; label: string }[] }[] = values
    ? [
        { key: "level", label: "Level", options: values.levels.map((v) => ({ value: v, label: LEVEL_LABEL[v] })) },
        { key: "location", label: "Location", options: values.locations.map((v) => ({ value: v, label: LOCATION_LABEL[v] })) },
        { key: "duration", label: "Duration", options: values.durations.map((v) => ({ value: v, label: DURATION_LABEL[v] })) },
        { key: "equipment", label: "Equipment", options: values.equipment.map((v) => ({ value: v, label: EQUIPMENT_LABEL(v) })) },
        { key: "muscle", label: "Muscle groups", options: values.muscles.map((v) => ({ value: v, label: titleWord(v) })) },
      ]
    : []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[88svh] max-w-2xl gap-0 rounded-t-3xl">
        <SheetHeader className="border-b">
          <SheetTitle className="text-lg font-bold">Filters</SheetTitle>
          <SheetDescription>Choose as many as you like in each group.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {valuesError ? (
            <p className="rounded-xl bg-muted/50 p-4 text-center text-sm text-muted-foreground">Filters unavailable.</p>
          ) : !values ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : (
            groups.map((g) => (
              <fieldset key={g.key} className="space-y-2">
                <legend className="mb-2 text-sm font-semibold">{g.label}</legend>
                <div className="flex flex-wrap gap-2">
                  {g.options.map((o) => (
                    <Chip key={o.value} selected={(draft[g.key] as string[]).includes(o.value)} onClick={() => toggle(g.key, o.value as never)}>
                      {o.label}
                    </Chip>
                  ))}
                </div>
              </fieldset>
            ))
          )}
        </div>
        <SheetFooter className="flex-row gap-2 border-t pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button variant="ghost" className="h-11 flex-1" onClick={() => setDraft(EMPTY)} disabled={!countFilters(draft)}>
            Reset
          </Button>
          <Button className={cn("h-11 flex-[2]")} onClick={() => onApply(draft)} disabled={count === 0}>
            {count === 0 ? "0 workouts" : `Apply (${count} result${count === 1 ? "" : "s"})`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export default function WorkoutsPage() {
  return (
    <TrackPage>
      <TrackHeader
        title="Workouts"
        subtitle="Guided sessions for home, office and gym — earn points for every workout"
        actions={
          <Button asChild variant="outline" className="h-10">
            <Link href="/employee-app/workouts/history">
              <History data-icon="inline-start" /> History
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Library />
      </Suspense>
    </TrackPage>
  )
}
