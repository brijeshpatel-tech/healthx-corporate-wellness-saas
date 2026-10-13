"use client"

import { Bookmark, BookmarkCheck, ChevronLeft, Clock, Coins, Dumbbell, Flame, MapPin, Pause, Play, Repeat, Target } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { EmptyState } from "@/components/common/states"
import { PhaseBadge } from "@/components/common/status-badge"
import { EQUIPMENT_LABEL, LEVEL_LABEL, LOCATION_LABEL, titleWord } from "@/components/employee/track/activity-meta"
import { TrackPage, formatClock } from "@/components/employee/track/track-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { workoutsApi, type WorkoutDetail } from "@/lib/api/employee/workouts"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatRelative } from "@/lib/format"

/** SCR-M-031 Workout Detail. */
export default function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>()
  const q = useApiQuery(["employee", "workouts", "detail", id], () => workoutsApi.get({ id }), { retry: false })
  return (
    <TrackPage>
      {q.error ? (
        <EmptyState
          icon={Dumbbell}
          title="This workout is no longer available."
          description="It may have been removed or replaced. Pick another one from the library."
          action={
            <Button asChild>
              <Link href="/employee-app/workouts">Browse workouts</Link>
            </Button>
          }
        />
      ) : !q.data ? (
        <div className="space-y-5">
          <Skeleton className="h-60 rounded-3xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : (
        <Detail w={q.data} />
      )}
    </TrackPage>
  )
}

function Detail({ w }: { w: WorkoutDetail }) {
  const save = useApiMutation(workoutsApi.toggleSave, { success: (r) => (r.saved ? "Saved to My workouts" : "Removed from My workouts") })
  return (
    <>
      <div className="relative overflow-hidden rounded-3xl text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${w.coverColor}, ${w.coverColor}a6)` }}>
        <div className="bg-grid absolute inset-0 opacity-15" />
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:p-7">
          <div className="flex-1 space-y-3">
            <Link href="/employee-app/workouts" className="-ml-1 inline-flex items-center gap-0.5 rounded-md py-1 pr-2 text-sm font-medium text-white/85 hover:text-white">
              <ChevronLeft className="size-4" /> Workouts
            </Link>
            <p className="text-sm font-medium text-white/85">{w.category}</p>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{w.name}</h1>
            <p className="max-w-xl text-sm text-white/90">{w.description}</p>
            <div className="flex flex-wrap gap-2">
              {[
                { icon: Clock, text: `${w.durationMin} min` },
                { icon: Target, text: LEVEL_LABEL[w.level] },
                { icon: MapPin, text: LOCATION_LABEL[w.location] },
                { icon: Flame, text: `~${w.calories} kcal` },
              ].map((c) => (
                <span key={c.text} className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
                  <c.icon className="size-3.5" /> {c.text}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-900">
                <Coins className="size-3.5 text-amber-500" /> +{w.points} points
              </span>
            </div>
          </div>
          <span className="hidden text-8xl drop-shadow sm:block">{w.coverEmoji}</span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card className="gap-0 py-0">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="font-semibold">{w.steps.length} exercises</p>
              <p className="text-xs text-muted-foreground">
                {formatClock(w.totalWorkSec)} work · {formatClock(w.totalRestSec)} rest
              </p>
            </div>
            <ol className="space-y-1">
              {w.steps.map((s, i) => (
                <li key={`${s.exercise.id}-${i}`}>
                  <div className="flex items-center gap-3 rounded-xl px-1 py-2">
                    <span className="relative flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl">
                      {s.exercise.mediaEmoji}
                      <span className="absolute -top-1 -left-1 flex size-5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">{i + 1}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{s.exercise.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.exercise.muscleGroups.map(titleWord).join(", ")}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums">
                      {s.reps ? (
                        <>
                          <Repeat className="size-3" /> {s.reps} reps
                        </>
                      ) : (
                        <>
                          <Clock className="size-3" /> {s.durationSec}s
                        </>
                      )}
                    </span>
                  </div>
                  {i < w.steps.length - 1 && s.restSec ? (
                    <p className="ml-[3.75rem] flex items-center gap-1.5 border-l-2 border-dashed py-1 pl-3 text-[11px] text-muted-foreground">
                      <Pause className="size-3" /> Rest {s.restSec}s
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="gap-0 py-0">
            <CardContent className="space-y-4 p-5">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Equipment</p>
                <div className="flex flex-wrap gap-1.5">
                  {(w.equipment.length ? w.equipment : ["none"]).map((e) => (
                    <span key={e} className="rounded-full border px-2.5 py-1 text-xs font-medium">
                      {EQUIPMENT_LABEL(e)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Muscle groups</p>
                <div className="flex flex-wrap gap-1.5">
                  {w.muscleGroups.map((m) => (
                    <span key={m} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                      {titleWord(m)}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {w.lastCompletedAt ? `Last completed ${formatRelative(w.lastCompletedAt)} · done ${w.doneCount}×` : "You haven't done this one yet."} Finish at least {Math.round(w.minCompletionForPoints * 100)}% of the exercises to earn points.
              </p>
            </CardContent>
          </Card>
          <div className="sticky bottom-20 z-10 flex gap-2 md:static">
            <Button asChild className="h-12 flex-1 rounded-xl text-base shadow-lg shadow-primary/25 md:shadow-none">
              <Link href={`/employee-app/workouts/${w.id}/play`}>
                <Play data-icon="inline-start" className="fill-current" /> Start workout
              </Link>
            </Button>
            <Button
              variant="outline"
              className="h-12 rounded-xl bg-background"
              onClick={() => save.mutate({ id: w.id, saved: !w.saved })}
              disabled={save.isPending}
              aria-pressed={w.saved}
              aria-label={w.saved ? "Remove from saved" : "Save workout"}
            >
              {w.saved ? <BookmarkCheck className="text-primary" /> : <Bookmark />}
              <span className="hidden sm:inline">{w.saved ? "Saved" : "Save"}</span>
              <PhaseBadge phase={2} className="hidden sm:inline-flex" />
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
