"use client"

import { keepPreviousData } from "@tanstack/react-query"
import { Bell, CalendarCheck, Flame, ListChecks, Trash2, Trophy } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { ConfirmDialog } from "@/components/common/misc"
import { EmptyState } from "@/components/common/states"
import { AUTO_LABEL, POINTS_VIA_LABEL, UNIT_LABEL, habitProgressText, targetText } from "@/components/employee/track/habit-ui"
import { MetricTile, NumberStepper, PeriodNavigator, TrackHeader, TrackPage, localDate } from "@/components/employee/track/track-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { UNIT_RANGE, habitsApi, type HabitDetail } from "@/lib/api/employee/habits"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

const shiftMonth = (m: string, n: number) => {
  const d = new Date(`${m}-15T12:00:00`)
  d.setMonth(d.getMonth() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** SCR-M-040 Habit Detail. */
export default function HabitDetailPage() {
  const { id } = useParams<{ id: string }>()
  const current = localDate().slice(0, 7)
  const [month, setMonth] = useState(current)
  const q = useApiQuery(["employee", "habits", "detail", id, month], () => habitsApi.get({ id, month }), { placeholderData: keepPreviousData, retry: false })

  if (q.error)
    return (
      <TrackPage narrow>
        <EmptyState
          icon={ListChecks}
          title="Couldn't find this habit"
          description="It may have been removed."
          action={
            <Button asChild>
              <Link href="/employee-app/habits">Back to my habits</Link>
            </Button>
          }
        />
      </TrackPage>
    )
  if (!q.data)
    return (
      <TrackPage narrow>
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </TrackPage>
    )
  return <Detail key={q.data.id} h={q.data} month={month} setMonth={setMonth} current={current} />
}

function Detail({ h, month, setMonth, current }: { h: HabitDetail; month: string; setMonth: (m: string) => void; current: string }) {
  const router = useRouter()
  const range = UNIT_RANGE[h.unit]
  const [target, setTarget] = useState(h.target)
  const [reminderOn, setReminderOn] = useState(!!h.reminderTime)
  const [reminderTime, setReminderTime] = useState(h.reminderTime ?? "08:00")
  const [confirm, setConfirm] = useState(false)
  const update = useApiMutation(habitsApi.update, { success: "Habit updated.", errorTitle: "Couldn't update this habit." })
  const remove = useApiMutation(habitsApi.remove, { success: "Habit removed", onSuccess: () => router.push("/employee-app/habits") })
  const dirty = target !== h.target || reminderOn !== !!h.reminderTime || (reminderOn && reminderTime !== h.reminderTime)
  const firstMonth = h.firstTrackedDate.slice(0, 7)

  // Calendar grid (weeks start on Monday)
  const first = new Date(`${month}-01T12:00:00`)
  const lead = (first.getDay() + 6) % 7
  const today = localDate()

  return (
    <TrackPage narrow>
      <TrackHeader title={h.name} subtitle={h.custom ? "Your personal habit" : h.description} backHref="/employee-app/habits" backLabel="My habits" />

      <Card className="gap-0 py-0">
        <CardContent className="flex items-center gap-4 p-4 sm:p-5">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-muted text-4xl">{h.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">Today</p>
            <p className={cn("text-xl font-bold tabular-nums", h.done && "text-emerald-600 dark:text-emerald-400")}>{h.done ? `Done ✓ ${h.unit !== "check" ? `(${habitProgressText(h)})` : ""}` : habitProgressText(h)}</p>
            <p className="text-xs text-muted-foreground">
              Target: {targetText(h.unit, h.target)}
              {h.auto ? ` · ${AUTO_LABEL[h.auto]}` : ""}
              {h.points ? ` · +${h.points} pts per day` : h.pointsVia ? ` · ${POINTS_VIA_LABEL[h.pointsVia]} (no double points)` : " · No points for custom habits"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <MetricTile icon={Flame} tone="orange" label="Current streak" value={h.currentStreak} unit={h.currentStreak === 1 ? "day" : "days"} />
        <MetricTile icon={Trophy} tone="amber" label="Best streak" value={h.bestStreak} unit={h.bestStreak === 1 ? "day" : "days"} />
        <MetricTile icon={CalendarCheck} tone="emerald" label="This month" value={h.completedThisMonth} unit={`/${h.trackedDaysThisMonth || "—"}`} />
      </div>

      <Card className="gap-0 py-0">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <PeriodNavigator label={new Date(`${month}-15T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })} onPrev={() => setMonth(shiftMonth(month, -1))} onNext={() => setMonth(shiftMonth(month, 1))} prevDisabled={month <= firstMonth} nextDisabled={month >= current} />
          {!h.hasHistory ? (
            <p className="rounded-xl bg-muted/40 py-6 text-center text-sm text-muted-foreground">No history yet.</p>
          ) : (
            <div>
              <div className="mb-1 grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-muted-foreground">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label="Completion calendar">
                {Array.from({ length: lead }).map((_, i) => (
                  <span key={`lead-${i}`} />
                ))}
                {h.days.map((d) => {
                  const ratio = d.value !== null ? Math.min(1, d.value / h.target) : 0
                  return (
                    <span
                      key={d.date}
                      role="gridcell"
                      title={`${formatDate(d.date, "EEE d MMM")}: ${d.value === null ? "not tracked" : d.done ? "completed" : d.value > 0 ? "partly done" : "missed"}`}
                      className={cn(
                        "relative flex aspect-square items-center justify-center rounded-lg text-xs font-medium tabular-nums",
                        d.future || d.value === null ? "text-muted-foreground/50" : d.done ? "bg-emerald-500 text-white" : ratio > 0 ? "bg-emerald-500/25 text-foreground" : "bg-rose-500/10 text-rose-700 dark:text-rose-300",
                        d.date === today && "ring-2 ring-foreground/70 ring-offset-1 ring-offset-card",
                      )}
                    >
                      {Number(d.date.slice(8))}
                    </span>
                  )
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="size-2.5 rounded-[3px] bg-emerald-500" /> Completed
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2.5 rounded-[3px] bg-emerald-500/25" /> Partly
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2.5 rounded-[3px] bg-rose-500/20" /> Missed
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardContent className="space-y-5 p-4 sm:p-5">
          {h.unit !== "check" ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Daily target</p>
              <NumberStepper label="Daily target" value={target} min={range.min} max={range.max} step={range.step} onChange={setTarget} format={(v) => `${formatNumber(v, h.unit === "hours" ? 1 : 0)} ${UNIT_LABEL[h.unit]}`} />
              <p className="text-center text-xs text-muted-foreground">
                Between {formatNumber(range.min)} and {formatNumber(range.max)} {UNIT_LABEL[h.unit]}
              </p>
            </div>
          ) : null}
          <div className="space-y-3 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="rem" className="flex items-center gap-2 text-sm font-medium">
                <Bell className="size-4 text-muted-foreground" /> Daily reminder
              </Label>
              <Switch id="rem" checked={reminderOn} onCheckedChange={setReminderOn} />
            </div>
            {reminderOn ? (
              <div className="flex items-center gap-3">
                <Label htmlFor="rem-time" className="text-xs text-muted-foreground">
                  Remind me at
                </Label>
                <Input id="rem-time" type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} className="h-10 w-36" />
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" className="h-11" onClick={() => setConfirm(true)} disabled={remove.isPending}>
              {remove.isPending ? <Spinner /> : <Trash2 data-icon="inline-start" />} Remove habit
            </Button>
            <Button className="ml-auto h-11 min-w-32" disabled={!dirty || update.isPending || (reminderOn && !reminderTime)} onClick={() => update.mutate({ id: h.id, target, reminderTime: reminderOn ? reminderTime : null })}>
              {update.isPending ? <Spinner /> : null} Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Remove "${h.name}"?`}
        description="It will disappear from your daily list. Your past streaks are kept, and you can add it again any time."
        confirmLabel="Remove"
        destructive
        onConfirm={() => remove.mutate({ id: h.id })}
      />
    </TrackPage>
  )
}
