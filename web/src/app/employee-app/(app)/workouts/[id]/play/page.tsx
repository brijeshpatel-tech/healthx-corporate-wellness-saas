"use client"

import { AlertTriangle, Award, Check, ChevronDown, Clock, Coins, Dumbbell, Flame, History, Pause, Play, Plus, RotateCcw, SkipBack, SkipForward, X } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useReducer, useRef, useState } from "react"
import { ProgressRing } from "@/components/common/charts"
import { ConfirmDialog } from "@/components/common/misc"
import { EmptyState } from "@/components/common/states"
import { Confetti } from "@/components/employee/track/celebration"
import { formatClock } from "@/components/employee/track/track-ui"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { workoutsApi, type CompleteResult, type WorkoutDetail } from "@/lib/api/employee/workouts"
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** SCR-M-032 Player – Exercise, SCR-M-033 Player – Rest, SCR-M-034 Workout Complete. */
export default function WorkoutPlayerPage() {
  const { id } = useParams<{ id: string }>()
  const q = useApiQuery(["employee", "workouts", "detail", id], () => workoutsApi.get({ id }), { retry: false })
  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-background">
      {q.error ? (
        <div className="m-auto max-w-md p-6">
          <EmptyState
            icon={Dumbbell}
            title="This workout is no longer available."
            action={
              <Button asChild>
                <Link href="/employee-app/workouts">Browse workouts</Link>
              </Button>
            }
          />
        </div>
      ) : !q.data ? (
        <div className="m-auto w-full max-w-md space-y-4 p-6">
          <Skeleton className="mx-auto size-56 rounded-full" />
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : (
        <Player w={q.data} />
      )}
    </div>
  )
}

// ─── State machine ──────────────────────────────────────────────────────

type Phase = "ready" | "countdown" | "exercise" | "rest" | "done"
interface State {
  phase: Phase
  index: number
  remaining: number
  total: number
  paused: boolean
  completed: number[]
  elapsed: number
  endedEarly: boolean
}
type Action =
  | { type: "begin" }
  | { type: "tick"; dt: number }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "skip" }
  | { type: "prev" }
  | { type: "addRest"; sec: number }
  | { type: "end" }

function makeReducer(w: WorkoutDetail) {
  const last = w.steps.length - 1
  const toExercise = (s: State, index: number): State => ({ ...s, phase: "exercise", index, remaining: w.steps[index]!.durationSec, total: w.steps[index]!.durationSec })
  const afterExercise = (s: State, completedIt: boolean): State => {
    const completed = completedIt && !s.completed.includes(s.index) ? [...s.completed, s.index] : s.completed
    if (s.index >= last) return { ...s, completed, phase: "done", remaining: 0 }
    const rest = w.steps[s.index]!.restSec
    if (rest > 0) return { ...s, completed, phase: "rest", remaining: rest, total: rest }
    return toExercise({ ...s, completed }, s.index + 1)
  }
  return (s: State, a: Action): State => {
    switch (a.type) {
      case "begin":
        return { ...s, phase: "countdown", remaining: 3, total: 3, paused: false }
      case "tick": {
        if (s.paused || s.phase === "ready" || s.phase === "done") return s
        const remaining = s.remaining - a.dt
        const elapsed = s.phase === "countdown" ? s.elapsed : s.elapsed + a.dt
        if (remaining > 0) return { ...s, remaining, elapsed }
        const next = { ...s, elapsed }
        if (s.phase === "countdown") return toExercise(next, 0)
        if (s.phase === "exercise") return afterExercise(next, true)
        return toExercise(next, s.index + 1)
      }
      case "pause":
        return s.phase === "done" || s.phase === "ready" ? s : { ...s, paused: true }
      case "resume":
        return { ...s, paused: false }
      case "skip":
        if (s.phase === "exercise") return afterExercise(s, false)
        if (s.phase === "rest") return toExercise(s, s.index + 1)
        if (s.phase === "countdown") return toExercise(s, 0)
        return s
      case "prev":
        if (s.phase === "rest") return toExercise(s, s.index)
        if (s.phase === "exercise") return toExercise(s, Math.max(0, s.remaining < s.total - 3 ? s.index : s.index - 1))
        return s
      case "addRest":
        return s.phase === "rest" ? { ...s, remaining: s.remaining + a.sec, total: s.total + a.sec } : s
      case "end":
        return { ...s, phase: "done", endedEarly: true, paused: false }
    }
  }
}

const INITIAL: State = { phase: "ready", index: 0, remaining: 0, total: 1, paused: false, completed: [], elapsed: 0, endedEarly: false }

function Player({ w }: { w: WorkoutDetail }) {
  const router = useRouter()
  const [reducer] = useState(() => makeReducer(w))
  const [s, dispatch] = useReducer(reducer, INITIAL)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [showSteps, setShowSteps] = useState(false)
  const lastTick = useRef<number | null>(null)
  const completeSent = useRef(false)

  const start = useApiMutation(workoutsApi.start, {
    invalidate: false,
    errorTitle: "Couldn't start the workout",
    onSuccess: (r) => {
      setSessionId(r.sessionId)
      dispatch({ type: "begin" })
    },
  })
  const complete = useApiMutation(workoutsApi.complete, { errorTitle: "Couldn't save your workout" })

  // Timer loop (accurate to wall-clock time).
  const running = !s.paused && (s.phase === "countdown" || s.phase === "exercise" || s.phase === "rest")
  useEffect(() => {
    if (!running) {
      lastTick.current = null
      return
    }
    lastTick.current = performance.now()
    const t = setInterval(() => {
      const now = performance.now()
      const dt = (now - (lastTick.current ?? now)) / 1000
      lastTick.current = now
      dispatch({ type: "tick", dt })
    }, 200)
    return () => clearInterval(t)
  }, [running])

  // Haptics + progress sync on phase changes.
  useEffect(() => {
    if (s.phase === "exercise" || s.phase === "rest" || s.phase === "done") {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(s.phase === "done" ? [80, 60, 80] : 60)
    }
    if (sessionId && (s.phase === "exercise" || s.phase === "rest")) {
      workoutsApi.progress({ id: sessionId, exerciseIndex: s.index, phase: s.phase, paused: s.paused }).catch(() => {
        // Progress sync is best-effort; the session is completed at the end.
      })
    }
  }, [s.phase, s.index, s.paused, sessionId])

  // Finish → record the session once.
  useEffect(() => {
    if (s.phase !== "done" || !sessionId || completeSent.current) return
    completeSent.current = true
    complete.mutate({ id: sessionId, exercisesCompleted: s.completed.length, totalExercises: w.steps.length, durationSec: Math.round(s.elapsed), endedEarly: s.endedEarly })
  }, [s.phase, sessionId, s.completed.length, s.elapsed, s.endedEarly, w.steps.length, complete])

  const retryComplete = () => sessionId && complete.mutate({ id: sessionId, exercisesCompleted: s.completed.length, totalExercises: w.steps.length, durationSec: Math.round(s.elapsed), endedEarly: s.endedEarly })

  const step = w.steps[s.index]!
  const next = w.steps[s.index + 1]
  const askEnd = () => {
    if (s.phase === "ready") return router.push(`/employee-app/workouts/${w.id}`)
    dispatch({ type: "pause" })
    setConfirmEnd(true)
  }

  if (s.phase === "done")
    return <Complete result={complete.data} pending={complete.isPending || (!complete.data && !complete.error)} error={complete.error} onRetry={retryComplete} endedEarly={s.endedEarly} completedCount={s.completed.length} elapsed={s.elapsed} />

  const isRest = s.phase === "rest"
  return (
    <div className={cn("relative flex min-h-full flex-1 flex-col transition-colors duration-500", isRest && "bg-sky-500/8")}>
      {/* Top bar */}
      <div className="sticky top-0 z-10 mx-auto flex w-full max-w-lg items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <Button variant="ghost" size="icon" className="size-10 rounded-full" onClick={askEnd} aria-label="End workout">
          <X />
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-semibold">{w.name}</p>
          <p className="text-xs text-muted-foreground">{s.phase === "ready" ? `${w.steps.length} exercises · ${w.durationMin} min` : `Exercise ${s.index + 1} of ${w.steps.length}`}</p>
        </div>
        <span className="flex size-10 items-center justify-center text-xs font-semibold text-muted-foreground tabular-nums" aria-label="Elapsed time">
          {formatClock(s.elapsed)}
        </span>
      </div>
      <div className="mx-auto flex w-full max-w-lg gap-1 px-4" aria-hidden="true">
        {w.steps.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full bg-muted transition-colors",
              s.completed.includes(i) && "bg-primary",
              i < s.index && !s.completed.includes(i) && "bg-muted-foreground/40",
              i === s.index && s.phase !== "ready" && !s.completed.includes(i) && "bg-primary/50",
            )}
          />
        ))}
      </div>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center gap-5 px-5 pt-6 pb-8 text-center">
        {s.phase === "ready" ? (
          <>
            <span className="flex size-40 items-center justify-center rounded-full text-7xl shadow-inner" style={{ background: `${w.coverColor}22` }}>
              {w.coverEmoji}
            </span>
            <div className="space-y-1">
              <h1 className="text-2xl font-extrabold">Ready when you are</h1>
              <p className="text-sm text-muted-foreground">Clear some space, grab water and follow the timer. You can pause any time.</p>
            </div>
            <div className="w-full rounded-2xl border bg-card p-3 text-left">
              <button type="button" onClick={() => setShowSteps((v) => !v)} className="flex w-full items-center justify-between text-sm font-semibold" aria-expanded={showSteps}>
                First up: {w.steps[0]!.exercise.name}
                <ChevronDown className={cn("size-4 transition-transform", showSteps && "rotate-180")} />
              </button>
              {showSteps ? (
                <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {w.steps.map((st, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span>
                        {i + 1}. {st.exercise.name}
                      </span>
                      <span className="tabular-nums">{st.durationSec}s</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
            <Button className="mt-auto h-14 w-full rounded-2xl text-lg shadow-lg shadow-primary/25" onClick={() => start.mutate({ workoutId: w.id })} disabled={start.isPending}>
              {start.isPending ? <Spinner /> : <Play data-icon="inline-start" className="fill-current" />} Start
            </Button>
          </>
        ) : s.phase === "countdown" ? (
          <div className="my-auto flex flex-col items-center gap-4">
            <p className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Get ready</p>
            <span key={Math.ceil(s.remaining)} className="font-heading text-9xl font-extrabold text-primary tabular-nums animate-in duration-300 zoom-in-50 fade-in">
              {Math.max(1, Math.ceil(s.remaining))}
            </span>
            <p className="text-lg font-semibold">{w.steps[0]!.exercise.name}</p>
          </div>
        ) : isRest ? (
          <>
            <p className="text-sm font-semibold tracking-widest text-sky-700 uppercase dark:text-sky-300">Rest</p>
            <ProgressRing value={s.remaining} max={s.total} size={232} stroke={14} color="#0ea5e9">
              <span className="font-heading text-6xl font-extrabold tabular-nums">{Math.ceil(s.remaining)}</span>
              <span className="text-sm text-muted-foreground">seconds</span>
            </ProgressRing>
            <div className="flex gap-2">
              <Button variant="outline" className="h-11 rounded-full px-5" onClick={() => dispatch({ type: "addRest", sec: 10 })}>
                <Plus data-icon="inline-start" /> 10 s
              </Button>
              <Button variant="outline" className="h-11 rounded-full px-5" onClick={() => dispatch({ type: "skip" })}>
                Skip rest <SkipForward data-icon="inline-end" />
              </Button>
            </div>
            {next ? (
              <div className="flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted text-3xl">{next.exercise.mediaEmoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">Next up</p>
                  <p className="truncate font-semibold">{next.exercise.name}</p>
                  <p className="text-xs text-muted-foreground">{next.reps ? `${next.reps} reps · ` : ""}{next.durationSec}s</p>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="relative">
              <ProgressRing value={s.remaining} max={s.total} size={232} stroke={14} color="var(--primary)">
                <span className="text-6xl leading-none motion-safe:animate-bounce [animation-duration:2s]">{step.exercise.mediaEmoji}</span>
                <span className="mt-2 font-heading text-4xl font-extrabold tabular-nums">{formatClock(Math.ceil(s.remaining))}</span>
              </ProgressRing>
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-extrabold tracking-tight">{step.exercise.name}</h1>
              <p className="text-sm font-medium text-primary">{step.reps ? `Aim for ${step.reps} reps` : "Keep going until the timer ends"}</p>
            </div>
            <ol className="w-full space-y-1.5 rounded-2xl bg-muted/40 p-3.5 text-left text-sm">
              {step.exercise.instructions.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-background text-[11px] font-bold">{i + 1}</span>
                  <span className="text-muted-foreground">{line}</span>
                </li>
              ))}
            </ol>
            {next ? (
              <p className="text-xs text-muted-foreground">
                Next: <span className="font-semibold text-foreground">{next.exercise.name}</span>
              </p>
            ) : (
              <p className="text-xs font-semibold text-primary">Last exercise — finish strong! 💪</p>
            )}
          </>
        )}

        {s.phase === "exercise" || s.phase === "rest" ? (
          <div className="mt-auto flex w-full items-center justify-center gap-6 pt-2">
            <Button variant="ghost" size="icon" className="size-14 rounded-full" onClick={() => dispatch({ type: "prev" })} aria-label="Previous" disabled={s.phase === "exercise" && s.index === 0 && s.remaining > s.total - 3}>
              <SkipBack className="size-6" />
            </Button>
            <Button className="size-20 rounded-full shadow-lg shadow-primary/30" onClick={() => dispatch({ type: s.paused ? "resume" : "pause" })} aria-label={s.paused ? "Resume" : "Pause"}>
              {s.paused ? <Play className="size-8 fill-current" /> : <Pause className="size-8 fill-current" />}
            </Button>
            <Button variant="ghost" size="icon" className="size-14 rounded-full" onClick={() => dispatch({ type: "skip" })} aria-label={isRest ? "Skip rest" : "Skip exercise"}>
              <SkipForward className="size-6" />
            </Button>
          </div>
        ) : null}
      </div>

      {s.paused && !confirmEnd ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-background/85 p-6 text-center backdrop-blur-sm animate-in fade-in">
          <span className="flex size-20 items-center justify-center rounded-full bg-muted">
            <Pause className="size-9" />
          </span>
          <div>
            <p className="text-2xl font-extrabold">Paused</p>
            <p className="text-sm text-muted-foreground">
              {isRest ? "Rest" : step.exercise.name} · {formatClock(Math.ceil(s.remaining))} left
            </p>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <Button className="h-12 rounded-xl text-base" onClick={() => dispatch({ type: "resume" })}>
              <Play data-icon="inline-start" className="fill-current" /> Resume
            </Button>
            <Button variant="outline" className="h-12 rounded-xl" onClick={askEnd}>
              End workout
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={(o) => {
          setConfirmEnd(o)
        }}
        title="End workout early?"
        description={
          s.completed.length / w.steps.length >= w.minCompletionForPoints
            ? `You've done ${s.completed.length} of ${w.steps.length} exercises — enough to earn points. Your progress will be saved.`
            : `You've done ${s.completed.length} of ${w.steps.length} exercises. Finish at least ${Math.ceil(w.steps.length * w.minCompletionForPoints)} to earn points.`
        }
        confirmLabel="End workout"
        cancelLabel="Keep going"
        destructive
        onConfirm={() => dispatch({ type: "end" })}
      />
    </div>
  )
}

function Complete({
  result,
  pending,
  error,
  onRetry,
  endedEarly,
  completedCount,
  elapsed,
}: {
  result?: CompleteResult
  pending: boolean
  error: unknown
  onRetry: () => void
  endedEarly: boolean
  completedCount: number
  elapsed: number
}) {
  if (error && !result)
    return (
      <div className="m-auto flex max-w-sm flex-col items-center gap-4 p-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
          <AlertTriangle className="size-8" />
        </span>
        <p className="text-xl font-bold">We couldn&apos;t save your workout</p>
        <p className="text-sm text-muted-foreground">{errorMessage(error)} Check your connection and try again — your progress is kept on this screen.</p>
        <Button className="h-11 w-full" onClick={onRetry}>
          <RotateCcw data-icon="inline-start" /> Try again
        </Button>
        <Button asChild variant="ghost">
          <Link href="/employee-app/workouts">Back to workouts</Link>
        </Button>
      </div>
    )
  if (pending || !result)
    return (
      <div className="m-auto flex flex-col items-center gap-3 p-6 text-center">
        <Spinner className="size-8 text-primary" />
        <p className="font-semibold">Saving your workout…</p>
      </div>
    )
  const earned = result.pointsEarned > 0
  return (
    <div className="relative mx-auto flex w-full max-w-lg flex-1 flex-col items-center gap-6 px-5 pt-[max(2.5rem,env(safe-area-inset-top))] pb-10 text-center">
      <div className="relative mt-4">
        {result.pointsEligible ? <Confetti /> : null}
        <span className={cn("flex size-28 items-center justify-center rounded-full text-6xl shadow-xl animate-in duration-500 zoom-in-50", result.pointsEligible ? "bg-gradient-to-br from-emerald-400 to-teal-600 shadow-emerald-500/30" : "bg-muted")}>
          {result.pointsEligible ? "🏆" : result.coverEmoji}
        </span>
      </div>
      <div className="space-y-1.5">
        <h1 className="text-3xl font-extrabold tracking-tight">{result.pointsEligible ? (earned ? `Great job! +${result.pointsEarned} points` : "Great job!") : "Workout saved"}</h1>
        <p className="text-muted-foreground">
          {result.pointsEligible
            ? endedEarly
              ? `You finished ${result.exercisesCompleted} of ${result.totalExercises} exercises of ${result.workoutName}.`
              : `You completed ${result.workoutName}.`
            : `You did ${completedCount} of ${result.totalExercises} exercises. Finish at least half next time to earn points.`}
        </p>
        {result.pointsCapped ? <p className="text-xs text-amber-700 dark:text-amber-300">You&apos;ve reached today&apos;s points limit for workouts — your workout still counts!</p> : null}
      </div>

      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: Clock, label: "Duration", value: formatClock(Math.round(elapsed)) },
          { icon: Check, label: "Exercises", value: `${result.exercisesCompleted}/${result.totalExercises}` },
          { icon: Flame, label: "Calories", value: `~${formatNumber(result.calories)}` },
          { icon: Award, label: "Streak", value: `${result.streakDays} day${result.streakDays === 1 ? "" : "s"}` },
        ].map((t) => (
          <div key={t.label} className="flex flex-col items-center gap-1 rounded-2xl border bg-card p-3">
            <t.icon className="size-4 text-muted-foreground" />
            <p className="text-lg font-bold tabular-nums">{t.value}</p>
            <p className="text-[11px] text-muted-foreground">{t.label}</p>
          </div>
        ))}
      </div>

      {earned ? (
        <div className="flex w-full items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-left">
          <Coins className="size-8 shrink-0 text-amber-500" />
          <div className="flex-1">
            <p className="font-bold">+{result.pointsEarned} points added</p>
            <p className="text-xs text-muted-foreground">{result.workoutsThisMonth} workout{result.workoutsThisMonth === 1 ? "" : "s"} this month · keep the streak going!</p>
          </div>
        </div>
      ) : null}

      {result.badge ? (
        <div className="relative w-full overflow-hidden rounded-2xl p-4 text-left text-white shadow-lg animate-in duration-700 slide-in-from-bottom-4 fade-in" style={{ background: `linear-gradient(135deg, ${result.badge.color}, ${result.badge.color}b3)` }}>
          <div className="flex items-center gap-3">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/25 text-3xl">{result.badge.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-wide text-white/85 uppercase">Badge unlocked</p>
              <p className="text-lg font-extrabold">{result.badge.name}</p>
              <p className="text-xs text-white/90">
                {result.badge.description} {result.badge.points ? `+${result.badge.points} bonus points` : ""}
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="secondary" className="mt-3 w-full">
            <Link href="/employee-app/badges">View badge</Link>
          </Button>
        </div>
      ) : null}

      <div className="mt-auto grid w-full gap-2 sm:grid-cols-2">
        <Button asChild className="h-12 rounded-xl text-base">
          <Link href="/employee-app/workouts">Done</Link>
        </Button>
        <Button asChild variant="outline" className="h-12 rounded-xl">
          <Link href="/employee-app/workouts/history">
            <History data-icon="inline-start" /> View history
          </Link>
        </Button>
      </div>
    </div>
  )
}
