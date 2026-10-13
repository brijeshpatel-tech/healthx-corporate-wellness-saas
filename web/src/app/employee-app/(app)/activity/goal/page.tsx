"use client"

import { Check, Coins, Sparkles, Target } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ErrorState } from "@/components/common/states"
import { PhaseBadge } from "@/components/common/status-badge"
import { InfoNote, NumberStepper, TrackHeader, TrackPage } from "@/components/employee/track/track-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { activityApi, type GoalMode, type StepGoalInfo } from "@/lib/api/employee/activity"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Daily step goal — fixed, or personalised from recent activity (#362, Phase 2). */
export default function StepGoalPage() {
  const q = useApiQuery(["employee", "activity", "goal"], () => activityApi.goal())
  return (
    <TrackPage narrow>
      <TrackHeader title="Daily step goal" subtitle="Choose a goal that fits you" backHref="/employee-app/activity" backLabel="Activity" />
      {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data ? <Skeleton className="h-96 rounded-xl" /> : <GoalForm info={q.data} />}
    </TrackPage>
  )
}

function GoalForm({ info }: { info: StepGoalInfo }) {
  const router = useRouter()
  const [mode, setMode] = useState<GoalMode>(info.personalGoal ? info.mode : "fixed")
  const [fixed, setFixed] = useState(info.fixedGoal)
  const save = useApiMutation(activityApi.setGoal, {
    success: (r) => `Daily goal set to ${formatNumber(r.today)} steps`,
    onSuccess: () => router.push("/employee-app/activity"),
  })
  const dirty = mode !== info.mode || fixed !== info.fixedGoal

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        role="radio"
        aria-checked={mode === "personal"}
        disabled={!info.personalGoal}
        onClick={() => setMode("personal")}
        className={cn("rounded-2xl border bg-card p-4 text-left shadow-xs transition-all hover:border-primary/40 disabled:opacity-60", mode === "personal" && "border-primary ring-1 ring-primary/30")}
      >
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              Personal goal <PhaseBadge phase={2} />
            </p>
            {info.personalGoal ? (
              <>
                <p className="font-heading text-2xl font-extrabold tabular-nums">{formatNumber(info.personalGoal)} steps</p>
                <p className="text-sm text-muted-foreground">Based on your average over the last {info.basedOnDays} days, plus 5% — it adjusts as you get more active.</p>
                <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  <Coins className="size-3.5" /> +{info.bonusPoints} bonus points on days you reach it
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">We need at least 3 days of synced steps to suggest a personal goal.</p>
            )}
          </div>
          {mode === "personal" ? <Check className="size-5 text-primary" /> : null}
        </div>
      </button>

      <div
        role="radio"
        aria-checked={mode === "fixed"}
        tabIndex={0}
        onClick={() => setMode("fixed")}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setMode("fixed")}
        className={cn("cursor-pointer rounded-2xl border bg-card p-4 shadow-xs transition-all hover:border-primary/40", mode === "fixed" && "border-primary ring-1 ring-primary/30")}
      >
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white">
            <Target className="size-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-semibold">Fixed goal</p>
            <p className="text-sm text-muted-foreground">The same target every day.</p>
          </div>
          {mode === "fixed" ? <Check className="size-5 text-primary" /> : null}
        </div>
        <Card className="mt-3 gap-0 py-0 shadow-none" onClick={(e) => e.stopPropagation()}>
          <CardContent className="p-3">
            <NumberStepper
              label="Fixed daily step goal"
              value={fixed}
              min={2000}
              max={30000}
              step={500}
              onChange={(v) => {
                setFixed(v)
                setMode("fixed")
              }}
              format={(v) => formatNumber(v)}
            />
          </CardContent>
        </Card>
      </div>

      <InfoNote>Steps always earn points per 1,000 steps (within the daily cap). The personal-goal bonus is added once a day and counts towards the same daily cap, so the same steps never earn twice.</InfoNote>

      <div className="flex gap-2">
        <Button variant="outline" className="h-11 flex-1 sm:flex-none" onClick={() => router.push("/employee-app/activity")}>
          Cancel
        </Button>
        <Button className="h-11 flex-1 sm:min-w-36 sm:flex-none" disabled={!dirty || save.isPending} onClick={() => save.mutate({ mode, fixedGoal: fixed })}>
          {save.isPending ? <Spinner /> : null} Save
        </Button>
      </div>
    </div>
  )
}
