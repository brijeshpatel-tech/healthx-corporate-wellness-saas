"use client"

import { keepPreviousData } from "@tanstack/react-query"
import { BedDouble, ChevronRight, Moon, Pencil, Plus, ShieldAlert, Sunrise, Target, Watch } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { ProgressRing } from "@/components/common/charts"
import { EmptyState, ErrorState } from "@/components/common/states"
import { GoalBars } from "@/components/employee/track/goal-bars"
import { IconBubble, NumberStepper, PeriodNavigator, Segmented, TrackHeader, TrackPage, addDays, formatHM, localDate } from "@/components/employee/track/track-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { sleepApi, type SleepSummary } from "@/lib/api/employee/sleep"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatTime } from "@/lib/format"
import type { SleepRecord } from "@/lib/types"
import { cn } from "@/lib/utils"

/** SCR-M-027 Sleep Dashboard (Phase 2). */
export default function SleepPage() {
  const [weekStart, setWeekStart] = useState<string | undefined>(undefined)
  const q = useApiQuery(["employee", "sleep", "summary", weekStart ?? "current"], () => sleepApi.summary({ weekStart }), { placeholderData: keepPreviousData })

  return (
    <TrackPage>
      <TrackHeader
        title="Sleep"
        phase={2}
        subtitle="Duration, consistency and your weekly pattern"
        actions={
          <Button asChild className="h-10">
            <Link href="/employee-app/sleep/log">
              <Plus data-icon="inline-start" /> Log sleep
            </Link>
          </Button>
        }
      />
      {q.error ? (
        <ErrorState error={new Error("Couldn't load sleep data.")} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : !q.data.hasAnyData ? (
        <EmptyState
          icon={Moon}
          title="No sleep recorded yet."
          description="Log last night's sleep or connect a health app."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/employee-app/sleep/log">Log last night</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/employee-app/settings/connected-apps">Connect a health app</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <Sleep data={q.data} onWeek={(start) => setWeekStart(start)} />
      )}
      <div className="flex items-start gap-2.5 rounded-xl border bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground" role="note">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        <p>Sleep insights are for general wellness only and are not a medical assessment. If you have ongoing sleep problems, talk to a doctor. Your sleep data is private and encrypted.</p>
      </div>
    </TrackPage>
  )
}

function Sleep({ data, onWeek }: { data: SleepSummary; onWeek: (start: string | undefined) => void }) {
  const [view, setView] = useState<"duration" | "schedule">("duration")
  const [goalOpen, setGoalOpen] = useState(false)
  const last = data.lastNight
  const lastScore = last?.score ?? 0
  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-slate-900 py-0 text-white shadow-lg shadow-indigo-500/20">
          <div className="pointer-events-none absolute top-6 right-8 size-1 rounded-full bg-white/70 shadow-[20px_30px_0_0_rgba(255,255,255,.5),-60px_50px_0_0_rgba(255,255,255,.4),-30px_-4px_0_1px_rgba(255,255,255,.6)]" />
          <CardContent className="relative flex flex-col items-center gap-4 p-6 text-center">
            <p className="text-sm font-medium text-white/80">{last ? `Last night · ${formatDate(last.date, "EEE d MMM")}` : "Last night"}</p>
            <ProgressRing value={lastScore} size={164} stroke={13} color="white" trackColor="rgba(255,255,255,0.2)">
              <Moon className="mb-0.5 size-5 text-white/85" />
              <span className="font-heading text-4xl font-extrabold tabular-nums">{last ? lastScore : "—"}</span>
              <span className="text-xs text-white/75">Sleep score</span>
            </ProgressRing>
            <div className="grid w-full grid-cols-3 gap-2">
              <HeroStat label="Duration" value={last ? formatHM(last.durationMin) : "—"} />
              <HeroStat label="Consistency" value={data.consistency.label === "Not enough data" ? "—" : data.consistency.label} />
              <HeroStat label="Goal" value={`${data.goalHours} h`} onClick={() => setGoalOpen(true)} />
            </div>
            {last ? (
              <p className="flex items-center gap-3 text-xs text-white/80">
                <span className="inline-flex items-center gap-1">
                  <BedDouble className="size-3.5" /> {formatTime(last.bedtime)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Sunrise className="size-3.5" /> {formatTime(last.wakeTime)}
                </span>
                {data.source ? (
                  <span className="inline-flex items-center gap-1">
                    <Watch className="size-3.5" /> {data.source}
                  </span>
                ) : null}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <PeriodNavigator
              label={`${formatDate(data.weekStart, "d MMM")} – ${formatDate(data.weekEnd, "d MMM")}`}
              sublabel={data.isCurrentWeek ? "Last 7 nights" : "Nights of"}
              onPrev={() => onWeek(addDays(data.weekStart, -7))}
              onNext={() => {
                const nextStart = addDays(data.weekStart, 7)
                onWeek(addDays(nextStart, 6) >= addDays(localDate(), -1) ? undefined : nextStart)
              }}
              nextDisabled={data.isCurrentWeek}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Avg <span className="font-semibold text-foreground">{data.avgDurationMin ? formatHM(data.avgDurationMin) : "—"}</span> · goal met{" "}
                <span className="font-semibold text-foreground">
                  {data.goalMetNights}/{data.nights.filter((n) => n.record).length || 7}
                </span>{" "}
                nights
              </p>
              <Segmented
                ariaLabel="Chart view"
                value={view}
                onChange={setView}
                options={[
                  { value: "duration", label: "Duration" },
                  { value: "schedule", label: "Schedule" },
                ]}
              />
            </div>
            {view === "duration" ? (
              <GoalBars
                height={210}
                goal={data.goalHours * 60}
                goalLabel={`Goal ${data.goalHours} h`}
                color="#6366f1"
                valueFormatter={(v) => formatHM(v)}
                axisFormatter={(v) => `${Math.round(v / 60)}h`}
                data={data.nights.map((n) => ({
                  key: n.nightOf,
                  label: new Date(`${n.nightOf}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short" }),
                  tooltipLabel: `Night of ${formatDate(n.nightOf, "EEE d MMM")}`,
                  value: n.record?.durationMin ?? 0,
                }))}
              />
            ) : (
              <Schedule data={data} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 py-0">
        <CardContent className="space-y-2 p-4 sm:p-5">
          <p className="font-semibold">Nights</p>
          <ul className="divide-y">
            {[...data.nights].reverse().map((n) => (
              <li key={n.nightOf}>
                {n.record ? (
                  <NightRow record={n.record} nightOf={n.nightOf} goalMin={data.goalHours * 60} />
                ) : (
                  <Link href={`/employee-app/sleep/log?night=${n.nightOf}`} className="flex items-center gap-3 rounded-lg px-1 py-3 text-sm text-muted-foreground hover:bg-muted/40">
                    <span className="flex size-10 items-center justify-center rounded-xl border border-dashed">
                      <Plus className="size-4" />
                    </span>
                    <span className="flex-1">{formatDate(n.nightOf, "EEE d MMM")} · nothing recorded</span>
                    <span className="text-xs font-medium text-primary">Log</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <GoalDialog open={goalOpen} onOpenChange={setGoalOpen} current={data.goalHours} />
    </>
  )
}

function NightRow({ record, nightOf, goalMin }: { record: SleepRecord; nightOf: string; goalMin: number }) {
  const manual = record.source === "manual"
  const body = (
    <>
      <IconBubble icon={Moon} tone="indigo" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {formatDate(nightOf, "EEE d MMM")} <span className="font-normal text-muted-foreground">· {formatHM(record.durationMin)}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {formatTime(record.bedtime)} → {formatTime(record.wakeTime)} · {manual ? "Manual" : "Synced"}
        </p>
      </div>
      <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold tabular-nums", record.durationMin >= goalMin ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>{record.score}</span>
      {manual ? <Pencil className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-transparent" />}
    </>
  )
  return manual ? (
    <Link href={`/employee-app/sleep/log?id=${record.id}`} className="flex items-center gap-3 rounded-lg px-1 py-2.5 hover:bg-muted/40">
      {body}
    </Link>
  ) : (
    <div className="flex items-center gap-3 px-1 py-2.5" title="Synced sleep is read-only">
      {body}
    </div>
  )
}

/** Bedtime → wake bars on a 20:00 → 12:00 timeline. */
function Schedule({ data }: { data: SleepSummary }) {
  const START = 20 * 60
  const SPAN = 16 * 60
  const pos = (iso: string) => {
    const d = new Date(iso)
    let m = d.getHours() * 60 + d.getMinutes()
    if (m < START) m += 24 * 60
    return Math.min(100, Math.max(0, ((m - START) / SPAN) * 100))
  }
  return (
    <div className="space-y-2.5" role="img" aria-label="Bedtime and wake-up times for each night">
      <div className="ml-11 flex justify-between text-[10px] text-muted-foreground">
        {["8p", "12a", "4a", "8a", "12p"].map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      {data.nights.map((n) => (
        <div key={n.nightOf} className="flex items-center gap-2">
          <span className="w-9 text-[11px] text-muted-foreground">{new Date(`${n.nightOf}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short" })}</span>
          <div className="relative h-6 flex-1 rounded-full bg-muted/60">
            {n.record ? (
              <div
                className="absolute inset-y-0.5 rounded-full bg-indigo-500"
                style={{ left: `${pos(n.record.bedtime)}%`, width: `${Math.max(2, pos(n.record.wakeTime) - pos(n.record.bedtime))}%` }}
                title={`${formatTime(n.record.bedtime)} → ${formatTime(n.record.wakeTime)}`}
              >
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white">{formatHM(n.record.durationMin)}</span>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

function HeroStat({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  const inner = (
    <>
      <p className="text-[11px] text-white/75">{label}</p>
      <p className="text-base font-bold tabular-nums">{value}</p>
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className="rounded-xl bg-white/12 px-2 py-2 transition-colors hover:bg-white/20" aria-label="Edit sleep goal">
      {inner}
      <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-white/80">
        <Target className="size-3" /> Edit
      </span>
    </button>
  ) : (
    <div className="rounded-xl bg-white/12 px-2 py-2">{inner}</div>
  )
}

function GoalDialog({ open, onOpenChange, current }: { open: boolean; onOpenChange: (o: boolean) => void; current: number }) {
  const [value, setValue] = useState(current)
  const save = useApiMutation(sleepApi.setGoal, { success: (r) => `Sleep goal set to ${r.goalHours} h`, onSuccess: () => onOpenChange(false) })
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setValue(current)
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Sleep goal</DialogTitle>
          <DialogDescription>Most adults need 7–9 hours. Choose between 4 and 12 hours.</DialogDescription>
        </DialogHeader>
        <NumberStepper label="Sleep goal" value={value} min={4} max={12} step={0.5} onChange={setValue} format={(v) => `${v} h`} className="py-2" />
        <DialogFooter>
          <Button className="h-11 w-full" onClick={() => save.mutate({ hours: value })} disabled={save.isPending}>
            {save.isPending ? <Spinner /> : null} Save goal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
