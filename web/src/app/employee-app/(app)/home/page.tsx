"use client"

import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronRight, Coins, Droplets, Dumbbell, Flame, Footprints, LayoutGrid, ListChecks, Medal, Moon, Plus, Sparkles, Watch } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { ProgressRing } from "@/components/common/charts"
import { ErrorState } from "@/components/common/states"
import { SyncStatusBar } from "@/components/employee/track/sync-status"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { HOME_CARDS, homeApi, type HomeCardKey, type HomeDashboard } from "@/lib/api/employee/home"
import { waterApi } from "@/lib/api/employee/water"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatMl, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

const COMPONENT_LABEL: Record<string, string> = {
  activity: "Activity",
  sleep: "Sleep",
  hydration: "Hydration",
  exercise: "Exercise",
  habits: "Habits",
  mindfulness: "Mindfulness",
}

const SPAN: Record<"large" | "tile" | "wide", string> = { large: "col-span-2", tile: "col-span-1", wide: "col-span-2 lg:col-span-4" }

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}

/** SCR-M-018 Home Dashboard. Card order / visibility follow Customise Home (SCR-M-021) and company modules. */
export default function EmployeeHomePage() {
  const q = useApiQuery(["employee", "home"], () => homeApi.dashboard())
  if (q.error) return <div className="p-4 sm:p-6"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>
  if (!q.data) return <HomeSkeleton />
  return <Home data={q.data} />
}

function Home({ data }: { data: HomeDashboard }) {
  const addWater = useApiMutation(waterApi.add, {
    onSuccess: (r) => (r.pointsEarned ? toast.success(`Water goal reached! +${r.pointsEarned} points 🎉`) : toast.success("+250 ml logged")),
  })
  const t = data.today
  const stepPct = Math.min(1, t.steps / t.stepGoal)
  const waterPct = Math.min(1, t.waterMl / t.waterGoalMl)
  const weekMax = Math.max(...data.week.map((d) => Math.max(d.steps, d.goal)))

  const cards: Record<HomeCardKey, React.ReactNode> = {
    score: (
      <Link href="/employee-app/wellness-score" className="group">
        <Card className="relative h-full overflow-hidden border-0 bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-600 py-0 text-white shadow-lg shadow-emerald-500/20">
          <div className="bg-grid absolute inset-0 opacity-10" />
          <CardContent className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
            <ProgressRing value={data.score.total} size={132} stroke={12} color="white" trackColor="rgba(255,255,255,0.22)">
              <span className="font-heading text-4xl font-extrabold tabular-nums">{data.score.total}</span>
              <span className="text-xs text-white/80">of 100</span>
            </ProgressRing>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm font-medium text-white/80">HealthX Wellness Score</p>
                <p className="flex items-center gap-1 text-lg font-bold">
                  {data.score.weekChange >= 0 ? <ArrowUpRight className="size-5" /> : <ArrowDownRight className="size-5" />}
                  {data.score.weekChange >= 0 ? "+" : ""}
                  {data.score.weekChange} this week
                </p>
              </div>
              <div className="grid grid-cols-3 gap-x-3 gap-y-2">
                {Object.entries(data.score.components).map(([k, v]) => (
                  <div key={k} className="space-y-1">
                    <div className="flex justify-between text-[11px] text-white/80">
                      <span>{COMPONENT_LABEL[k]}</span>
                      <span className="font-semibold text-white tabular-nums">{v}</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-white/20">
                      <div className="h-full rounded-full bg-white" style={{ width: `${v}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <ChevronRight className="absolute top-5 right-5 size-5 text-white/70 transition-transform group-hover:translate-x-0.5" />
          </CardContent>
        </Card>
      </Link>
    ),
    steps: (
      <Card className="h-full gap-0 py-0 transition-shadow hover:shadow-md">
        <CardContent className="flex h-full flex-col gap-3 p-5 sm:p-6">
          <Link href="/employee-app/activity" className="flex flex-1 items-center gap-5">
            <ProgressRing value={t.steps} max={t.stepGoal} size={118} stroke={11} color="var(--chart-1)">
              <Footprints className="mb-0.5 size-5 text-sky-600 dark:text-sky-400" />
              <span className="text-xs font-semibold text-muted-foreground tabular-nums">{Math.round(stepPct * 100)}%</span>
            </ProgressRing>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Steps today</p>
              <p className="font-heading text-3xl font-extrabold tabular-nums">{formatNumber(t.steps)}</p>
              <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                of {formatNumber(t.stepGoal)} · your goal today
                {data.goal.mode === "personal" && data.goal.personalGoal ? <span className="rounded-md bg-violet-500/12 px-1.5 text-[10px] font-semibold text-violet-700 uppercase dark:text-violet-300">Personal</span> : null}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{formatNumber(t.distanceKm, 1)} km</span>
                <span>{formatNumber(t.activeCalories)} kcal</span>
                <span>{t.activeMinutes} active min</span>
              </div>
            </div>
          </Link>
          {data.sync.connected ? <SyncStatusBar status={data.sync} variant="compact" /> : null}
        </CardContent>
      </Card>
    ),
    water: (
      <Card className="h-full gap-0 py-0">
        <CardContent className="flex h-full flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <span className="flex size-9 items-center justify-center rounded-xl bg-cyan-500/12 text-cyan-600 dark:text-cyan-400">
              <Droplets className="size-4.5" />
            </span>
            <Button size="icon-sm" variant="outline" aria-label="Add 250 ml of water" disabled={addWater.isPending} onClick={() => addWater.mutate({ amountMl: 250 })}>
              <Plus />
            </Button>
          </div>
          <Link href="/employee-app/water" className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Water</p>
            <p className="text-lg font-bold tabular-nums">
              {formatMl(t.waterMl)} <span className="text-sm font-medium text-muted-foreground">/ {formatMl(t.waterGoalMl)}</span>
            </p>
            <Progress value={waterPct * 100} className="h-1.5 [&>div]:bg-cyan-500" />
          </Link>
        </CardContent>
      </Card>
    ),
    workout: (
      <Link href={t.workoutDone ? "/employee-app/workouts/history" : data.suggestedWorkout ? `/employee-app/workouts/${data.suggestedWorkout.id}` : "/employee-app/workouts"}>
        <Card className="h-full gap-0 py-0 transition-shadow hover:shadow-md">
          <CardContent className="flex h-full flex-col gap-3 p-4">
            <span className="flex size-9 items-center justify-center rounded-xl bg-violet-500/12 text-violet-600 dark:text-violet-400">
              <Dumbbell className="size-4.5" />
            </span>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Workout</p>
              {t.workoutDone ? (
                <p className="flex items-center gap-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  <Check className="size-4" /> Completed
                </p>
              ) : (
                <p className="text-sm font-bold">Not yet today</p>
              )}
              <p className="truncate text-xs text-muted-foreground">{t.workoutDone ? t.workoutDone.name : data.suggestedWorkout ? `Try: ${data.suggestedWorkout.name}` : "Browse workouts"}</p>
            </div>
          </CardContent>
        </Card>
      </Link>
    ),
    habits: (
      <Link href="/employee-app/habits">
        <Card className="h-full gap-0 py-0 transition-shadow hover:shadow-md">
          <CardContent className="flex h-full flex-col gap-3 p-4">
            <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
              <ListChecks className="size-4.5" />
            </span>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Habits</p>
              <p className="text-lg font-bold tabular-nums">
                {t.habitsDone}/{t.habitsTotal} <span className="text-sm font-medium text-muted-foreground">done</span>
              </p>
              <Progress value={t.habitsTotal ? (t.habitsDone / t.habitsTotal) * 100 : 0} className="h-1.5" />
            </div>
          </CardContent>
        </Card>
      </Link>
    ),
    sleep: (
      <Link href="/employee-app/sleep">
        <Card className="h-full gap-0 py-0 transition-shadow hover:shadow-md">
          <CardContent className="flex h-full flex-col gap-3 p-4">
            <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-500/12 text-indigo-600 dark:text-indigo-400">
              <Moon className="size-4.5" />
            </span>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Sleep last night</p>
              <p className="text-lg font-bold tabular-nums">{t.sleepMin ? `${Math.floor(t.sleepMin / 60)}h ${t.sleepMin % 60}m` : "—"}</p>
            </div>
          </CardContent>
        </Card>
      </Link>
    ),
    challenge: (
      data.challenge ? (
        <Link href={`/employee-app/challenges/${data.challenge.id}`}>
          <Card className="h-full gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3 p-4 text-white" style={{ background: `linear-gradient(135deg, ${data.challenge.color}, ${data.challenge.color}cc)` }}>
              <span className="flex size-11 items-center justify-center rounded-xl bg-white/20 text-2xl">{data.challenge.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white/85">Your challenge · {data.challenge.daysLeft} days left</p>
                <p className="truncate font-bold">{data.challenge.name}</p>
              </div>
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">+{data.challenge.points} pts</span>
            </div>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm">
                  <span className="text-lg font-bold tabular-nums">{formatNumber(data.challenge.progress)}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    / {formatNumber(data.challenge.target)} {data.challenge.unit}
                  </span>
                </p>
                <span className="text-sm font-semibold tabular-nums">{Math.min(100, Math.round((data.challenge.progress / data.challenge.target) * 100))}%</span>
              </div>
              <Progress value={Math.min(100, (data.challenge.progress / data.challenge.target) * 100)} className="h-2" />
              <p className="text-xs text-muted-foreground">
                You&apos;re <span className="font-semibold text-foreground">#{data.challenge.rank}</span> of {formatNumber(data.challenge.participants)} participants
              </p>
            </CardContent>
          </Card>
        </Link>
      ) : (
        <Card className="h-full py-0">
          <CardContent className="flex h-full flex-col items-start justify-center gap-3 p-5">
            <p className="font-semibold">No challenge today</p>
            <p className="text-sm text-muted-foreground">Join one to compete with colleagues and earn bonus points.</p>
            <Button asChild size="sm">
              <Link href="/employee-app/challenges">Browse challenges</Link>
            </Button>
          </CardContent>
        </Card>
      )
    ),
    rank: (
      <Card className="h-full gap-0 py-0">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">This week</p>
              <p className="text-xs text-muted-foreground">
                Goal reached on {data.week.filter((d) => d.steps >= d.goal).length} of {data.week.length} days
              </p>
            </div>
            {data.modules.includes("leaderboards") ? (
              <Link href="/employee-app/leaderboards/me" className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <Medal className="size-3.5" /> #{data.rank.position} in {data.rank.scope}
              </Link>
            ) : null}
          </div>
          <div className="flex h-32 items-end gap-2" role="img" aria-label="Steps per day this week">
            {data.week.map((d) => {
              const h = Math.max(4, (d.steps / weekMax) * 100)
              const met = d.steps >= d.goal
              const label = new Date(d.date).toLocaleDateString("en-IN", { weekday: "narrow" })
              return (
                <div key={d.date} className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${formatNumber(d.steps)} steps`}>
                  <span className="pointer-events-none absolute -top-1 hidden rounded bg-popover px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap shadow group-hover:block">{formatNumber(d.steps)}</span>
                  <div className={cn("w-full max-w-6 rounded-t-[4px] transition-colors", met ? "bg-primary" : "bg-primary/30")} style={{ height: `${h}%` }} />
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    ),
    summary: (
      data.summary ? (
        <Link href="/employee-app/weekly-summary">
          <Card className="h-full gap-0 py-0 transition-shadow hover:shadow-md">
            <CardContent className="flex items-start gap-4 p-4 sm:p-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                <Sparkles className="size-5" />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-semibold">Weekly HealthX insight</p>
                <p className="text-sm text-muted-foreground">{data.summary.opportunity}</p>
                <p className="text-sm font-medium text-primary">{data.summary.recommendation}</p>
              </div>
              <ArrowRight className="mt-1 size-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      ) : null
    ),
  }
  const visible = data.homeCards.filter((k) => cards[k] !== null)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {greeting()}, {data.firstName}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href="/employee-app/wallet" className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-semibold shadow-xs">
            <Coins className="size-4 text-amber-500" /> {formatNumber(data.pointsBalance)}
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-semibold shadow-xs">
            <Flame className="size-4 text-orange-500" /> {data.streak} day streak
          </span>
          <Link href="/employee-app/home/customise" aria-label="Customise Home" title="Customise Home" className="inline-flex size-9 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-xs transition-colors hover:text-foreground">
            <LayoutGrid className="size-4" />
          </Link>
        </div>
      </div>

      {!data.healthConnected ? (
        <Link href="/employee-app/settings/connected-apps" className="flex items-center gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/8 p-4 transition-colors hover:bg-sky-500/12">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white">
            <Watch className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Connect Apple Health or Health Connect</p>
            <p className="text-xs text-muted-foreground">Track steps automatically — no manual logging.</p>
          </div>
          <ChevronRight className="size-5 text-muted-foreground" />
        </Link>
      ) : null}

      <div className="grid grid-flow-row-dense grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {visible.map((key) => (
          <div key={key} className={cn("flex min-w-0 flex-col [&>*]:flex-1", SPAN[HOME_CARDS.find((c) => c.key === key)?.size ?? "tile"])}>
            {cards[key]}
          </div>
        ))}
      </div>
    </div>
  )
}

function HomeSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
      <Skeleton className="h-12 w-72" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  )
}
