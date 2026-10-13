"use client"

import { Bell, Droplet, Droplets, Flame, GlassWater, Pencil, Plus, Settings2, Trash2, Trophy } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { ProgressRing } from "@/components/common/charts"
import { ConfirmDialog } from "@/components/common/misc"
import { ErrorState } from "@/components/common/states"
import { Confetti } from "@/components/employee/track/celebration"
import { GoalBars } from "@/components/employee/track/goal-bars"
import { TrackHeader, TrackPage } from "@/components/employee/track/track-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { waterApi, type WaterToday } from "@/lib/api/employee/water"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatMl, formatTime } from "@/lib/format"
import type { WaterLog } from "@/lib/types"
import { cn } from "@/lib/utils"

/** SCR-M-025 Water Tracker. */
export default function WaterPage() {
  const q = useApiQuery(["employee", "water", "today"], () => waterApi.today())
  return (
    <TrackPage>
      <TrackHeader
        title="Water"
        subtitle="Log a glass in one tap and hit your daily goal"
        actions={
          <Button asChild variant="outline" className="h-10">
            <Link href="/employee-app/water/settings">
              <Settings2 data-icon="inline-start" /> Goal & reminders
            </Link>
          </Button>
        }
      />
      {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data ? <WaterSkeleton /> : <Water data={q.data} />}
    </TrackPage>
  )
}

function Water({ data }: { data: WaterToday }) {
  const [celebrate, setCelebrate] = useState(0)
  const [custom, setCustom] = useState(false)
  const [editing, setEditing] = useState<WaterLog | null>(null)
  const [deleting, setDeleting] = useState<WaterLog | null>(null)

  const add = useApiMutation(waterApi.add, {
    errorTitle: "Couldn't save. Please try again.",
    onSuccess: (r, input) => {
      if (r.pointsEarned) {
        setCelebrate((c) => c + 1)
        toast.success(`Goal reached! +${r.pointsEarned} points 🎉`)
      } else if (r.totalMl >= r.goalMl && r.totalMl - input.amountMl < r.goalMl) toast.success("Goal reached! 🎉")
      else toast.success(`+${formatMl(input.amountMl)} logged`)
    },
  })
  const remove = useApiMutation(waterApi.remove, { success: "Entry deleted" })

  const pct = data.goalMl ? data.totalMl / data.goalMl : 0
  const reached = data.totalMl >= data.goalMl
  const left = Math.max(0, data.goalMl - data.totalMl)
  const week = data.history.slice(-7)

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <Card className="relative overflow-hidden py-0">
          <div className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full bg-cyan-500/10 blur-3xl" />
          <CardContent className="relative flex flex-col items-center gap-5 p-5 sm:p-6">
            <div className="relative">
              {celebrate ? <Confetti key={celebrate} /> : null}
              <ProgressRing value={data.totalMl} max={data.goalMl} size={196} stroke={16} color="#06b6d4">
                <Droplets className="mb-1 size-6 text-cyan-500" />
                <span className="font-heading text-4xl font-extrabold tabular-nums">{formatMl(data.totalMl)}</span>
                <span className="text-xs text-muted-foreground">of {formatMl(data.goalMl)} goal</span>
                <span className="mt-1 rounded-full bg-cyan-500/12 px-2 py-0.5 text-[11px] font-semibold text-cyan-700 tabular-nums dark:text-cyan-300">{Math.round(pct * 100)}%</span>
              </ProgressRing>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{reached ? "Goal reached — great job! 💧" : data.totalMl === 0 ? "No water logged today" : `${formatMl(left)} to go`}</p>
              <p className="text-sm text-muted-foreground">
                {reached
                  ? data.pointsToday
                    ? `You earned +${data.pointsToday} points for hydration today.`
                    : "Keep sipping through the day."
                  : data.totalMl === 0
                    ? "Tap a glass to start."
                    : `That's about ${Math.ceil(left / 250)} more glass${Math.ceil(left / 250) === 1 ? "" : "es"}.${data.goalPoints ? ` Reach your goal for +${data.goalPoints} points.` : ""}`}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-semibold shadow-xs">
                <Flame className="size-4 text-orange-500" /> {data.streakDays}-day streak
              </span>
              {data.settings.remindersEnabled ? (
                <Link href="/employee-app/water/settings" className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-xs hover:text-foreground">
                  <Bell className="size-4" /> Every {data.settings.reminderEveryMin} min · {data.settings.reminderStart}–{data.settings.reminderEnd}
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div>
              <p className="font-semibold">Quick add</p>
              <p className="text-xs text-muted-foreground">One tap logs it with the current time</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {data.settings.quickAmounts.map((ml, i) => (
                <button
                  key={ml}
                  type="button"
                  disabled={add.isPending}
                  onClick={() => add.mutate({ amountMl: ml })}
                  className="group flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border bg-gradient-to-b from-cyan-500/6 to-cyan-500/12 p-3 transition-all hover:border-cyan-500/50 hover:shadow-md active:scale-[0.97] disabled:opacity-60"
                >
                  {i === 0 ? <GlassWater className="size-6 text-cyan-600 dark:text-cyan-400" /> : i === 1 ? <Droplet className="size-6 text-cyan-600 dark:text-cyan-400" /> : <Droplets className="size-6 text-cyan-600 dark:text-cyan-400" />}
                  <span className="text-base font-bold tabular-nums">{formatMl(ml)}</span>
                  <span className="text-[11px] text-muted-foreground">{ml === 250 ? "Glass" : ml === 500 ? "Bottle" : ml === 750 ? "Large bottle" : "1 litre"}</span>
                </button>
              ))}
            </div>
            <Button variant="outline" className="h-11 w-full" onClick={() => setCustom(true)}>
              <Plus data-icon="inline-start" /> Custom amount
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card className="gap-0 py-0">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">This week</p>
                <p className="text-xs text-muted-foreground">Goal reached on {week.filter((d) => d.totalMl >= d.goalMl).length} of 7 days</p>
              </div>
              <Trophy className="size-5 text-amber-500" />
            </div>
            <GoalBars
              height={210}
              goal={data.goalMl}
              unitLabel=""
              valueFormatter={(v) => formatMl(v)}
              axisFormatter={(v) => (v === 0 ? "0" : `${(v / 1000).toFixed(1)} L`)}
              highlightKey={data.date}
              data={week.map((d) => {
                const dt = new Date(`${d.date}T12:00:00`)
                return { key: d.date, label: dt.toLocaleDateString("en-IN", { weekday: "short" }), tooltipLabel: dt.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" }), value: d.totalMl, goal: d.goalMl }
              })}
            />
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Today&apos;s entries</p>
              <span className="text-xs text-muted-foreground">{data.logs.length} logged</span>
            </div>
            {data.logs.length ? (
              <ul className="divide-y">
                {data.logs.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 py-2">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/12 text-cyan-600 dark:text-cyan-400">
                      <GlassWater className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold tabular-nums">{formatMl(l.amountMl)}</p>
                      <p className="text-xs text-muted-foreground">{formatTime(l.at)}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="size-9" aria-label="Edit entry" onClick={() => setEditing(l)}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-9 text-muted-foreground hover:text-destructive" aria-label="Delete entry" onClick={() => setDeleting(l)}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/40 px-3 py-8 text-center">
                <GlassWater className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">No water logged today.</p>
                <p className="text-xs text-muted-foreground">Tap a glass to start.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AmountDialog
        open={custom}
        onOpenChange={setCustom}
        title="Custom amount"
        description="Between 50 ml and 2,000 ml."
        submitLabel="Add water"
        pending={add.isPending}
        onSubmit={(ml) => add.mutate({ amountMl: ml }, { onSuccess: () => setCustom(false) })}
      />
      <EditEntryDialog entry={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this entry?"
        description={deleting ? `${formatMl(deleting.amountMl)} logged at ${formatTime(deleting.at)} will be removed from today's total.` : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleting && remove.mutate({ id: deleting.id })}
      />
    </>
  )
}

function EditEntryDialog({ entry, onClose }: { entry: WaterLog | null; onClose: () => void }) {
  const update = useApiMutation(waterApi.update, { success: "Entry updated", onSuccess: onClose })
  return (
    <AmountDialog
      key={entry?.id ?? "none"}
      open={!!entry}
      onOpenChange={(o) => !o && onClose()}
      title="Edit entry"
      description={entry ? `Logged at ${formatTime(entry.at)}` : undefined}
      initial={entry?.amountMl}
      submitLabel="Save"
      pending={update.isPending}
      onSubmit={(ml) => entry && update.mutate({ id: entry.id, amountMl: ml })}
    />
  )
}

function AmountDialog({
  open,
  onOpenChange,
  title,
  description,
  initial = 300,
  submitLabel,
  pending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  description?: string
  initial?: number
  submitLabel: string
  pending: boolean
  onSubmit: (ml: number) => void
}) {
  const [value, setValue] = useState(String(initial))
  const [touched, setTouched] = useState(false)
  const n = Number(value)
  const error = !value ? "Enter an amount" : !Number.isFinite(n) || n < 50 || n > 2000 ? "Enter an amount between 50 ml and 2,000 ml" : null
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setValue(String(initial))
          setTouched(false)
        }
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            setTouched(true)
            if (!error) onSubmit(Math.round(n))
          }}
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount</Label>
            <div className="relative">
              <Input id="amount" type="number" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} className="h-12 pr-12 text-lg" autoFocus aria-invalid={touched && !!error} />
              <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">ml</span>
            </div>
            {touched && error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
            <div className="flex flex-wrap gap-2 pt-1">
              {[150, 200, 300, 330, 400].map((v) => (
                <button key={v} type="button" onClick={() => setValue(String(v))} className={cn("rounded-full border px-3 py-1 text-xs font-medium hover:border-primary/40", Number(value) === v && "border-primary bg-primary/10 text-primary")}>
                  {v} ml
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" className="h-11 w-full" disabled={pending}>
              {pending ? <Spinner /> : null}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function WaterSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  )
}
