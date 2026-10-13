"use client"

import { Check, Plus, SearchX } from "lucide-react"
import { useState } from "react"
import { SearchInput } from "@/components/common/misc"
import { EmptyState, ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { WORKOUT_MUSCLE_GROUPS, type ExerciseOption } from "@/lib/api/business/workouts"
import { matchesSearch } from "@/lib/api/core"
import { pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"
import { LEVEL_META, capitalize, formatSeconds } from "./workout-meta"

/** Searchable list of published HealthX exercises. Clicking "Add" appends one step (the dialog stays open). */
export function ExercisePickerDialog({
  open,
  onOpenChange,
  exercises,
  loading,
  error,
  onRetry,
  usedCounts,
  onAdd,
  disabled,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exercises: ExerciseOption[]
  loading?: boolean
  error?: unknown
  onRetry?: () => void
  /** How many times each exercise is already in the workout. */
  usedCounts: Record<string, number>
  onAdd: (exercise: ExerciseOption) => void
  /** True when the workout is full. */
  disabled?: boolean
}) {
  const [search, setSearch] = useState("")
  const [muscle, setMuscle] = useState<string>("all")
  const [added, setAdded] = useState(0)

  const shown = exercises.filter((e) => matchesSearch(search, e.name, ...e.muscleGroups, ...e.equipment) && (muscle === "all" || e.muscleGroups.includes(muscle)))

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setSearch("")
          setMuscle("all")
          setAdded(0)
        }
        onOpenChange(o)
      }}
    >
      <DialogContent className="flex max-h-[90dvh] flex-col gap-4 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add exercises</DialogTitle>
          <DialogDescription>Pick from the HealthX exercise library. Each exercise comes with a video, image and step-by-step instructions in the app.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, muscle or equipment…" className="sm:w-full" debounce={150} />
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Muscle group">
            {["all", ...WORKOUT_MUSCLE_GROUPS].map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={muscle === m}
                onClick={() => setMuscle(m)}
                className={cn(
                  "h-7 shrink-0 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
                  muscle === m && "border-primary bg-primary/10 text-primary hover:text-primary",
                )}
              >
                {m === "all" ? "All" : capitalize(m)}
              </button>
            ))}
          </div>
        </div>

        <div className="-mx-6 min-h-0 flex-1 overflow-y-auto border-y px-6">
          {error ? (
            <ErrorState error={error} onRetry={onRetry} className="my-4" />
          ) : loading ? (
            <ul className="divide-y">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 py-3">
                  <Skeleton className="size-10 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                </li>
              ))}
            </ul>
          ) : shown.length === 0 ? (
            <EmptyState icon={SearchX} title="No exercises found" description="Try another name or muscle group." className="my-4 border-0" />
          ) : (
            <ul className="divide-y">
              {shown.map((e) => {
                const used = usedCounts[e.id] ?? 0
                return (
                  <li key={e.id} className="flex items-center gap-3 py-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xl" aria-hidden>
                      {e.mediaEmoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-medium">
                        {e.name}
                        {used ? (
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-px text-[11px] font-medium text-primary">
                            <Check className="size-3" /> {used > 1 ? `${used}×` : "Added"}
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {LEVEL_META[e.level].label} · {e.muscleGroups.map(capitalize).join(", ")} · {e.equipment.length ? e.equipment.join(", ") : "no equipment"} ·{" "}
                        {e.defaultReps ? `${e.defaultReps} reps` : formatSeconds(e.defaultDurationSec)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={used ? "outline" : "default"}
                      disabled={disabled}
                      onClick={() => {
                        onAdd(e)
                        setAdded((n) => n + 1)
                      }}
                      aria-label={`Add ${e.name}`}
                    >
                      <Plus data-icon="inline-start" /> Add
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <DialogFooter className="items-center sm:justify-between">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {disabled ? "This workout is full." : added ? `${pluralize(added, "exercise")} added` : `${pluralize(shown.length, "exercise")}`}
          </p>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
