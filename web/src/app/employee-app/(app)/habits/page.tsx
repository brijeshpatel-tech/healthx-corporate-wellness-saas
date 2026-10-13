"use client"

import { Check, ChevronRight, Flame, ListChecks, Minus, Plus, Sparkles, Trophy } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { ProgressRing } from "@/components/common/charts"
import { EmptyState, ErrorState } from "@/components/common/states"
import { PhaseBadge } from "@/components/common/status-badge"
import { Confetti } from "@/components/employee/track/celebration"
import { AUTO_LABEL, POINTS_VIA_LABEL, habitProgressText } from "@/components/employee/track/habit-ui"
import { TrackHeader, TrackPage, localDate } from "@/components/employee/track/track-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { habitsApi, type HabitsToday, type TodayHabit } from "@/lib/api/employee/habits"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { cn } from "@/lib/utils"

/** SCR-M-038 My Habits (Today). */
export default function HabitsPage() {
  const q = useApiQuery(["employee", "habits", "today"], () => habitsApi.today())
  return (
    <TrackPage>
      <TrackHeader
        title="My habits"
        subtitle="Small daily wins that add up"
        actions={
          <Button asChild className="h-10">
            <Link href="/employee-app/habits/choose">
              <Plus data-icon="inline-start" /> Add habits
            </Link>
          </Button>
        }
      />
      {q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-xl" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : q.data.total === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Pick a few healthy habits to build."
          description="Start small — two or three habits you can tick off every day."
          action={
            <Button asChild>
              <Link href="/employee-app/habits/choose">Choose habits</Link>
            </Button>
          }
        />
      ) : (
        <Today data={q.data} />
      )}
    </TrackPage>
  )
}

function Today({ data }: { data: HabitsToday }) {
  const [burst, setBurst] = useState(0)
  const allDone = data.done === data.total
  return (
    <>
      <Card className="relative overflow-hidden py-0">
        <div className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-emerald-500/12 blur-3xl" />
        <CardContent className="relative flex items-center gap-5 p-5">
          <div className="relative">
            {burst ? <Confetti key={burst} /> : null}
            <ProgressRing value={data.done} max={data.total} size={112} stroke={11}>
              <span className="font-heading text-2xl font-extrabold tabular-nums">
                {data.done}/{data.total}
              </span>
              <span className="text-[11px] text-muted-foreground">done</span>
            </ProgressRing>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-lg font-bold">{allDone ? "All habits done today! 🎉" : `${data.done} of ${data.total} habits done`}</p>
            <p className="text-sm text-muted-foreground">{allDone ? "That's a perfect day. See you tomorrow!" : `${data.total - data.done} to go — you've got this.`}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">+{data.pointsToday} pts today</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <Trophy className="size-3" /> {data.perfectDays} perfect days
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <ul className="grid gap-3 lg:grid-cols-2">
        {data.items.map((h) => (
          <li key={h.id}>
            <HabitRow h={h} onComplete={() => setBurst((b) => b + 1)} isLastToComplete={data.done === data.total - 1} />
          </li>
        ))}
      </ul>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Sparkles className="size-3.5" /> Habits marked <span className="font-semibold">Auto</span> complete from your tracked data <PhaseBadge phase={2} />
      </p>
    </>
  )
}

function HabitRow({ h, onComplete, isLastToComplete }: { h: TodayHabit; onComplete: () => void; isLastToComplete: boolean }) {
  const check = useApiMutation(habitsApi.checkIn, {
    errorTitle: "Couldn't save your check-in. Please try again.",
    onSuccess: (r) => {
      if (r.habit.done && !h.done) {
        if (isLastToComplete) onComplete()
        toast.success(r.pointsEarned ? `${r.habit.name} done! +${r.pointsEarned} points` : `${r.habit.name} done!`)
      }
    },
  })
  const undo = useApiMutation(habitsApi.undo, { success: "Check-in undone" })
  const busy = check.isPending || undo.isPending
  const numeric = h.unit !== "check"
  const pct = Math.min(100, (h.value / h.target) * 100)
  const canIncrement = numeric && h.auto !== "steps" && h.auto !== "sleep" && h.auto !== "workout"
  const step = h.unit === "minutes" ? 5 : 1

  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-xs transition-colors sm:p-4", h.done && "border-emerald-500/30 bg-emerald-500/5")}>
      <Link href={`/employee-app/habits/${h.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-2xl">{h.icon}</span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
            <span className="truncate">{h.name}</span>
            {h.auto ? <span className="shrink-0 rounded bg-violet-500/12 px-1 text-[10px] font-semibold text-violet-700 dark:text-violet-300" title={AUTO_LABEL[h.auto]}>Auto</span> : null}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn("tabular-nums", h.done && "font-semibold text-emerald-700 dark:text-emerald-300")}>{habitProgressText(h)}</span>
            {h.currentStreak > 0 ? (
              <span className="inline-flex items-center gap-0.5 font-semibold text-orange-600 dark:text-orange-400">
                <Flame className="size-3.5" /> {h.currentStreak}
              </span>
            ) : null}
            {h.points ? <span className="text-amber-700 dark:text-amber-300">+{h.points} pts</span> : h.pointsVia ? <span className="hidden truncate min-[420px]:inline">{POINTS_VIA_LABEL[h.pointsVia]}</span> : null}
          </div>
          {numeric ? (
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full transition-all duration-500", h.done ? "bg-emerald-500" : "bg-primary/60")} style={{ width: `${pct}%` }} />
            </div>
          ) : null}
        </div>
        <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        {numeric && canIncrement && h.value > 0 && !h.done ? (
          <Button variant="ghost" size="icon" className="size-9 rounded-full" aria-label={`Remove one from ${h.name}`} disabled={busy} onClick={() => check.mutate({ id: h.id, increment: -step })}>
            <Minus />
          </Button>
        ) : null}
        {h.done ? (
          <button
            type="button"
            aria-label={`Undo ${h.name}`}
            title={h.auto ? "Completed from your tracked data" : "Tap to undo"}
            disabled={busy || !!h.auto}
            onClick={() => undo.mutate({ id: h.id, date: localDate() })}
            className="flex size-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/30 transition-transform animate-in duration-300 zoom-in-50 active:scale-90 disabled:opacity-90"
          >
            <Check className="size-6" strokeWidth={3} />
          </button>
        ) : numeric ? (
          <Button
            variant="outline"
            className="h-12 min-w-12 rounded-full px-3 text-sm font-bold"
            aria-label={`Add ${step} to ${h.name}`}
            disabled={busy || !canIncrement}
            onClick={() => check.mutate({ id: h.id, increment: step })}
          >
            +{step}
          </Button>
        ) : (
          <button
            type="button"
            aria-label={`Mark ${h.name} as done`}
            disabled={busy}
            onClick={() => check.mutate({ id: h.id, value: 1 })}
            className="flex size-12 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40 text-muted-foreground transition-all hover:border-emerald-500 hover:text-emerald-600 active:scale-90"
          >
            <Check className="size-5" />
          </button>
        )}
      </div>
    </div>
  )
}
