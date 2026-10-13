"use client"

import { ChevronRight, Droplets, Dumbbell, Flame, Footprints, History, ListChecks, MapPin, Moon, Plus, Target, Timer, Zap } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { ProgressRing } from "@/components/common/charts"
import { ErrorState } from "@/components/common/states"
import { PhaseBadge } from "@/components/common/status-badge"
import { ACTIVITY_META } from "@/components/employee/track/activity-meta"
import { GoalBars } from "@/components/employee/track/goal-bars"
import { SourceBadge } from "@/components/employee/track/review-badge"
import { SyncStatusBar } from "@/components/employee/track/sync-status"
import { IconBubble, MetricTile, PeriodNavigator, Segmented, TrackHeader, TrackPage, addDays, dayLabel, localDate, type Tone } from "@/components/employee/track/track-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { activityApi, type ActivitySummary } from "@/lib/api/employee/activity"
import { useApiQuery } from "@/lib/api/hooks"
import { formatCompact, formatDuration, formatNumber, formatTime } from "@/lib/format"

type Period = "day" | "week" | "month"

/** SCR-M-022 Activity & Steps dashboard. */
export default function ActivityPage() {
  const today = localDate()
  const [date, setDate] = useState(today)
  const [period, setPeriod] = useState<Period>("week")
  const summary = useApiQuery(["employee", "activity", "summary", date], () => activityApi.summary({ date }))
  const range = useApiQuery(["employee", "activity", "daily", date], () => activityApi.daily({ from: addDays(date, -29), to: date }))
  const oldest = addDays(today, -89)

  return (
    <TrackPage>
      <TrackHeader
        title="Activity"
        subtitle="Steps, distance, calories and active minutes"
        actions={
          <>
            <Button asChild variant="outline" className="h-10">
              <Link href="/employee-app/activity/history">
                <History data-icon="inline-start" /> History
              </Link>
            </Button>
            {summary.data?.manual.allowed !== false ? (
              <Button asChild className="h-10">
                <Link href="/employee-app/activity/log">
                  <Plus data-icon="inline-start" /> Log activity
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <PeriodNavigator
        className="sm:max-w-sm"
        label={dayLabel(date)}
        sublabel={new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        onPrev={() => setDate(addDays(date, -1))}
        onNext={() => setDate(addDays(date, 1))}
        prevDisabled={date <= oldest}
        nextDisabled={date >= today}
      />

      {summary.error ? (
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      ) : !summary.data ? (
        <ActivitySkeleton />
      ) : (
        <>
          <StepsHero data={summary.data} />

          <Card className="gap-0 py-0">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Steps over time</p>
                  <p className="text-xs text-muted-foreground">{period === "day" ? `By hour · ${dayLabel(date)}` : period === "week" ? "7 days ending on the selected day" : "30 days ending on the selected day"}</p>
                </div>
                <Segmented
                  ariaLabel="Chart period"
                  value={period}
                  onChange={setPeriod}
                  options={[
                    { value: "day", label: "Day" },
                    { value: "week", label: "Week" },
                    { value: "month", label: "Month" },
                  ]}
                />
              </div>
              <StepsChart period={period} summary={summary.data} daily={range.data} loading={range.isLoading} />
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Card className="gap-0 py-0">
              <CardContent className="space-y-3 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{summary.data.isToday ? "Today's activities" : `Activities · ${dayLabel(date)}`}</p>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/employee-app/activity/history">
                      See all <ChevronRight data-icon="inline-end" />
                    </Link>
                  </Button>
                </div>
                {summary.data.sessions.length ? (
                  <ul className="divide-y">
                    {summary.data.sessions.map((s) => {
                      const meta = ACTIVITY_META[s.type]
                      return (
                        <li key={s.id} className="flex items-center gap-3 py-2.5">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">{meta.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{s.source === "workout" && s.notes ? s.notes : meta.label}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {formatTime(s.startedAt)} · {formatDuration(s.durationMin)}
                              {s.distanceKm ? ` · ${formatNumber(s.distanceKm, 1)} km` : ""}
                            </p>
                          </div>
                          <SourceBadge session={s} review={summary.data.reviews[s.id]} />
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="rounded-xl bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground">
                    {summary.data.steps === 0 && summary.data.isToday ? "No activity yet today. Connect Apple Health / Health Connect or log an activity." : "No workouts or sessions logged for this day."}
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3 self-start">
              <QuickLink href="/employee-app/water" icon={Droplets} tone="cyan" title="Water" hint="Log a glass" />
              <QuickLink href="/employee-app/workouts" icon={Dumbbell} tone="violet" title="Workouts" hint="Start a session" />
              <QuickLink href="/employee-app/habits" icon={ListChecks} tone="emerald" title="Habits" hint="Check in" />
              <QuickLink href="/employee-app/sleep" icon={Moon} tone="indigo" title="Sleep" hint="Last night" />
            </div>
          </div>
        </>
      )}
    </TrackPage>
  )
}

function StepsHero({ data }: { data: ActivitySummary }) {
  const pct = data.stepGoal ? data.steps / data.stepGoal : 0
  const left = Math.max(0, data.stepGoal - data.steps)
  const reached = data.steps >= data.stepGoal
  const g = data.goal
  const personal = data.isToday && g.mode === "personal" && !!g.personalGoal
  return (
    <Card className="relative overflow-hidden py-0">
      <div className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full bg-sky-500/10 blur-3xl" />
      <CardContent className="relative grid items-center gap-6 p-5 sm:grid-cols-[auto_1fr] sm:p-6">
        <div className="flex justify-center">
          <ProgressRing value={data.steps} max={data.stepGoal} size={176} stroke={15} color="var(--chart-1)">
            <Footprints className="mb-1 size-5 text-sky-600 dark:text-sky-400" />
            <span className="font-heading text-3xl font-extrabold tabular-nums">{formatNumber(data.steps)}</span>
            <span className="text-xs text-muted-foreground">of {formatNumber(data.stepGoal)} steps</span>
            <span className="mt-1 rounded-full bg-sky-500/12 px-2 py-0.5 text-[11px] font-semibold text-sky-700 tabular-nums dark:text-sky-300">{Math.round(pct * 100)}%</span>
          </ProgressRing>
        </div>
        <div className="min-w-0 space-y-4">
          <div>
            <p className="text-lg font-bold">{reached ? "Step goal reached! 🎉" : data.steps === 0 ? (data.isToday ? "Let's get moving" : "No steps recorded") : `${formatNumber(left)} steps to go`}</p>
            <p className="text-sm text-muted-foreground">
              {reached
                ? `You beat your goal by ${formatNumber(data.steps - data.stepGoal)} steps.`
                : data.isToday
                  ? `About ${Math.max(1, Math.round(left / 105))} minutes of walking will get you there.`
                  : `You reached ${Math.round(pct * 100)}% of your goal that day.`}
            </p>
          </div>
          {data.isToday ? (
            <Link href="/employee-app/activity/goal" className="group flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/40">
              <IconBubble icon={Target} tone="sky" size="sm" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                  Your goal today: {formatNumber(g.today)} steps {personal ? <PhaseBadge phase={2} /> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {personal
                    ? g.bonusEarnedToday
                      ? g.bonusAwardedToday
                        ? `Personal goal reached — +${g.bonusAwardedToday} bonus points earned`
                        : "Personal goal reached — today's steps points cap was already full"
                      : `Personal goal from your last ${g.basedOnDays} days · reach it for +${g.bonusPoints} bonus points`
                    : "Fixed daily goal · tap to try a personal goal"}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : null}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <MetricTile icon={MapPin} tone="emerald" label="Distance" value={formatNumber(data.distanceKm, 1)} unit="km" />
            <MetricTile icon={Flame} tone="orange" label="Calories" value={formatNumber(data.activeCalories)} unit="kcal" />
            <MetricTile icon={Timer} tone="violet" label="Active" value={data.activeMinutes} unit="min" />
          </div>
          {data.isToday ? <SyncStatusBar status={data.sync} /> : null}
          {data.streakDays > 1 ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-orange-600 dark:text-orange-400">
              <Zap className="size-3.5" /> {data.streakDays}-day active streak — keep it going!
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function StepsChart({ period, summary, daily, loading }: { period: Period; summary: ActivitySummary; daily?: { date: string; steps: number }[]; loading: boolean }) {
  if (period === "day") {
    const rows = summary.hourly.filter((h) => h.hour >= 5)
    const total = rows.reduce((a, h) => a + h.steps, 0)
    const peak = rows.reduce((b, h) => (h.steps > b.steps ? h : b), rows[0]!)
    return (
      <div className="space-y-3">
        <ChartStats
          items={[
            { label: "Total", value: formatNumber(total) },
            { label: "Most active", value: total ? `${peak.hour % 12 || 12} ${peak.hour < 12 ? "AM" : "PM"}` : "—" },
            { label: "Goal", value: `${Math.round((summary.steps / summary.stepGoal) * 100)}%` },
          ]}
        />
        <GoalBars
          height={200}
          unitLabel="steps"
          data={rows.map((h) => ({ key: String(h.hour), label: h.hour % 3 === 0 ? `${h.hour % 12 || 12}${h.hour < 12 ? "a" : "p"}` : "", tooltipLabel: `${h.hour % 12 || 12}:00 ${h.hour < 12 ? "AM" : "PM"}`, value: h.steps }))}
          axisFormatter={(v) => formatCompact(v)}
        />
      </div>
    )
  }
  if (loading || !daily) return <Skeleton className="h-60 rounded-xl" />
  const rows = period === "week" ? daily.slice(-7) : daily
  const total = rows.reduce((a, d) => a + d.steps, 0)
  const met = rows.filter((d) => d.steps >= summary.stepGoal).length
  return (
    <div className="space-y-3">
      <ChartStats
        items={[
          { label: "Daily average", value: formatNumber(Math.round(total / rows.length)) },
          { label: "Total", value: formatCompact(total) },
          { label: "Goal met", value: `${met} of ${rows.length} days` },
        ]}
      />
      <GoalBars
        height={220}
        goal={summary.stepGoal}
        unitLabel="steps"
        highlightKey={summary.date}
        axisFormatter={(v) => formatCompact(v)}
        data={rows.map((d, i) => {
          const dt = new Date(`${d.date}T12:00:00`)
          return {
            key: d.date,
            label: period === "week" ? dt.toLocaleDateString("en-IN", { weekday: "short" }) : i % 5 === 0 || i === rows.length - 1 ? String(dt.getDate()) : "",
            tooltipLabel: dt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }),
            value: d.steps,
          }
        })}
      />
    </div>
  )
}

function ChartStats({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-3 divide-x rounded-xl bg-muted/40 py-2.5">
      {items.map((i) => (
        <div key={i.label} className="min-w-0 px-2 text-center">
          <p className="truncate text-[11px] text-muted-foreground">{i.label}</p>
          <p className="truncate text-sm font-bold tabular-nums">{i.value}</p>
        </div>
      ))}
    </div>
  )
}

function QuickLink({ href, icon, tone, title, hint }: { href: string; icon: typeof Droplets; tone: Tone; title: string; hint: string }) {
  return (
    <Link href={href} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs transition-shadow hover:shadow-md">
      <IconBubble icon={icon} tone={tone} />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </Link>
  )
}

function ActivitySkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  )
}

