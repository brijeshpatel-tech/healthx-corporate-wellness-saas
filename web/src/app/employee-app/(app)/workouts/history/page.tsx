"use client"

import { keepPreviousData } from "@tanstack/react-query"
import { ChevronRight, Clock, Coins, Dumbbell, Flame, Trophy } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { EmptyState, ErrorState } from "@/components/common/states"
import { MetricTile, PeriodNavigator, TrackHeader, TrackPage, localDate } from "@/components/employee/track/track-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { workoutsApi } from "@/lib/api/employee/workouts"
import { useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatDuration, formatNumber, formatTime } from "@/lib/format"

const monthLabel = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
const shiftMonth = (m: string, n: number) => {
  const d = new Date(`${m}-15T12:00:00`)
  d.setMonth(d.getMonth() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** SCR-M-035 Workout History. */
export default function WorkoutHistoryPage() {
  const current = localDate().slice(0, 7)
  const [month, setMonth] = useState(current)
  const q = useApiQuery(["employee", "workouts", "history", month], () => workoutsApi.history({ month }), { placeholderData: keepPreviousData })
  const oldest = q.data?.months[q.data.months.length - 1] ?? current

  return (
    <TrackPage narrow>
      <TrackHeader title="Workout history" subtitle="Every workout you've completed" backHref="/employee-app/workouts" backLabel="Workouts" />
      <PeriodNavigator label={monthLabel(month)} onPrev={() => setMonth(shiftMonth(month, -1))} onNext={() => setMonth(shiftMonth(month, 1))} prevDisabled={month <= oldest} nextDisabled={month >= current} />

      {q.error ? (
        <ErrorState error={new Error("Couldn't load history.")} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : q.data.totalCompleted === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No workouts yet."
          description="Start your first workout to earn the First Workout badge."
          action={
            <Button asChild>
              <Link href="/employee-app/workouts">Browse workouts</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricTile icon={Dumbbell} tone="violet" label="Workouts" value={q.data.summary.workouts} />
            <MetricTile icon={Clock} tone="sky" label="Minutes" value={formatNumber(q.data.summary.minutes)} />
            <MetricTile icon={Coins} tone="amber" label="Points" value={formatNumber(q.data.summary.points)} />
            <MetricTile icon={Flame} tone="orange" label="Calories" value={formatNumber(q.data.summary.calories)} unit="kcal" />
          </div>
          {q.data.items.length === 0 ? (
            <EmptyState icon={Dumbbell} title={`No workouts in ${monthLabel(month)}`} description="Pick another month or start a workout today." />
          ) : (
            <Card className="gap-0 py-0">
              <CardContent className="divide-y p-0">
                {q.data.items.map((r) => (
                  <Link key={r.id} href={`/employee-app/workouts/${r.workoutId}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl" style={{ background: `${r.coverColor}22` }}>
                      {r.coverEmoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(r.completedAt ?? r.startedAt, "EEE d MMM")} · {formatTime(r.completedAt ?? r.startedAt)} · {formatDuration(r.durationMin)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-500/12 px-2 py-0.5 text-xs font-bold text-amber-700 tabular-nums dark:text-amber-300">+{r.points}</span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </TrackPage>
  )
}
