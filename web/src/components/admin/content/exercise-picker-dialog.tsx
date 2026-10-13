"use client"

import { Check, Plus, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { ExerciseWithMedia } from "@/lib/api/platform/exercises"
import type { Exercise } from "@/lib/types"
import { cn } from "@/lib/utils"
import { LevelBadge } from "./bits"
import { MediaThumb } from "./media-input"
import { formatSeconds } from "./meta"

/** Searchable list of published exercises; each click adds a step to the sequence. */
export function ExercisePickerDialog({
  open,
  onOpenChange,
  exercises,
  loading,
  error,
  counts,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exercises: ExerciseWithMedia[]
  loading?: boolean
  error?: string
  /** How many times each exercise is already in the sequence. */
  counts: Record<string, number>
  onAdd: (exercise: Exercise) => void
}) {
  const [search, setSearch] = useState("")
  const [muscle, setMuscle] = useState<string | null>(null)
  const muscles = useMemo(() => [...new Set(exercises.flatMap((e) => e.muscleGroups))].sort(), [exercises])
  const q = search.trim().toLowerCase()
  const visible = exercises.filter(
    (e) => (!q || [e.name, ...e.muscleGroups, ...e.equipment].some((f) => f.toLowerCase().includes(q))) && (!muscle || e.muscleGroups.includes(muscle)),
  )
  const added = Object.values(counts).reduce((a, n) => a + n, 0)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) {
          setSearch("")
          setMuscle(null)
        }
      }}
    >
      <DialogContent className="flex max-h-[min(720px,calc(100dvh-2rem))] flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="gap-1 border-b p-4 pr-12">
          <DialogTitle>Add exercises</DialogTitle>
          <DialogDescription>Pick from the published exercise library. Click an exercise to add it to the end of the sequence.</DialogDescription>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, muscle group or equipment…" className="h-9 pl-8" autoFocus />
          </div>
          {muscles.length > 0 ? (
            <div className="-mx-1 mt-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              <button
                type="button"
                onClick={() => setMuscle(null)}
                className={cn("h-7 shrink-0 rounded-full border px-2.5 text-xs font-medium transition-colors", !muscle ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}
              >
                All
              </button>
              {muscles.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMuscle(muscle === m ? null : m)}
                  className={cn("h-7 shrink-0 rounded-full border px-2.5 text-xs font-medium capitalize transition-colors", muscle === m ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}
                >
                  {m}
                </button>
              ))}
            </div>
          ) : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <p className="p-6 text-center text-sm text-destructive">{error}</p>
          ) : visible.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{exercises.length === 0 ? "No published exercises yet. Publish exercises in the Exercise library first." : "No exercises match your search."}</p>
          ) : (
            <ul className="space-y-1">
              {visible.map((e) => {
                const n = counts[e.id] ?? 0
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => onAdd(e)}
                      className="group flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    >
                      <MediaThumb imageUrl={e.image?.url} emoji={e.mediaEmoji} hasVideo={!!e.video} className="rounded-lg group-hover:bg-background" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{e.name}</span>
                          {n > 0 ? (
                            <Badge variant="secondary" className="h-5 gap-0.5 px-1.5 text-[10px]">
                              <Check className="size-3" /> {n}× added
                            </Badge>
                          ) : null}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="capitalize">{e.muscleGroups.join(", ")}</span>
                          <span aria-hidden>·</span>
                          <span>{e.defaultReps ? `${e.defaultReps} reps` : formatSeconds(e.defaultDurationSec)}</span>
                          {e.equipment.length ? (
                            <>
                              <span aria-hidden>·</span>
                              <span>{e.equipment.join(", ")}</span>
                            </>
                          ) : null}
                        </span>
                      </span>
                      <LevelBadge level={e.level} className="hidden text-xs text-muted-foreground sm:inline-flex" />
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground group-hover:border-primary/50 group-hover:text-primary">
                        <Plus className="size-4" />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="m-0 items-center rounded-b-xl sm:justify-between">
          <span className="text-xs text-muted-foreground">{added > 0 ? `${added} ${added === 1 ? "step" : "steps"} in the sequence` : "Nothing added yet"}</span>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
