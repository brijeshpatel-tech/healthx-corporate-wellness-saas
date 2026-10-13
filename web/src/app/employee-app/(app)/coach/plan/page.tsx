"use client"

import { useQueryClient } from "@tanstack/react-query"
import type { LucideIcon } from "lucide-react"
import { Brain, Check, ChevronRight, CircleCheckBig, Droplets, Footprints, Moon, RefreshCw, Save, Sparkles, Trash2, TriangleAlert, Utensils } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ProgressRing } from "@/components/common/charts"
import { ConfirmDialog } from "@/components/common/misc"
import { PhaseBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { CoachAvatar, CoachDisclaimer } from "@/components/employee/engage/grow/coach"
import { EngagePage, IconTile, LoadError, type Tone } from "@/components/employee/engage/page"
import { coachApi, type CoachPlan, type CoachPlanDay, type CoachPlanItem, type PlanKind } from "@/lib/api/employee/coach"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

const PLAN_KEY = ["employee", "coach", "plan"]

const KIND: Record<PlanKind, { icon: LucideIcon; tone: Tone; label: string }> = {
  move: { icon: Footprints, tone: "emerald", label: "Move" },
  eat: { icon: Utensils, tone: "amber", label: "Eat" },
  hydrate: { icon: Droplets, tone: "cyan", label: "Hydrate" },
  rest: { icon: Moon, tone: "indigo", label: "Rest" },
  mind: { icon: Brain, tone: "violet", label: "Mind" },
}

/** SCR-M-068 7-Day Wellness Plan. Phase 2. */
export default function WellnessPlanPage() {
  const router = useRouter()
  const access = useApiQuery(["employee", "coach", "access"], () => coachApi.access())
  const allowed = !!access.data?.enabled && !!access.data?.granted
  const mustLeave = !!access.data && !allowed
  const plan = useApiQuery(PLAN_KEY, () => coachApi.plan(), { enabled: allowed })

  // No consent (or coach switched off) → back to the coach intro.
  useEffect(() => {
    if (mustLeave) router.replace("/employee-app/coach")
  }, [mustLeave, router])

  const [confirm, setConfirm] = useState<"regenerate" | "delete" | null>(null)
  const create = useApiMutation(coachApi.createPlan, {
    success: (_p, input) => (input && input.regenerate ? "New plan ready" : "Your plan is ready"),
    errorTitle: "Couldn't create a plan right now.",
    invalidate: [["employee", "coach"]],
  })
  const save = useApiMutation(coachApi.savePlan, { success: "Plan saved.", invalidate: [["employee", "coach"]] })
  const remove = useApiMutation(coachApi.deletePlan, { success: "Plan deleted", invalidate: [["employee", "coach"]] })

  const data = plan.data
  return (
    <EngagePage
      title="7-day wellness plan"
      badge={<PhaseBadge phase={2} />}
      description="Built by your coach from your goals and preferences. Tick items off as you go."
      backHref="/employee-app/coach"
      backLabel="AI coach"
      actions={
        data ? (
          <>
            <Button variant="outline" className="h-10 rounded-xl" onClick={() => setConfirm("regenerate")} disabled={create.isPending}>
              {create.isPending ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
              Regenerate
            </Button>
            <Button variant="ghost" className="h-10 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirm("delete")} disabled={remove.isPending}>
              <Trash2 data-icon="inline-start" /> Delete plan
            </Button>
          </>
        ) : null
      }
    >
      <CoachDisclaimer compact />
      {access.error ? (
        <LoadError title="Coach is unavailable right now. Please try again later." error={access.error} onRetry={() => access.refetch()} />
      ) : plan.error ? (
        <LoadError title="Couldn't load your plan." error={plan.error} onRetry={() => plan.refetch()} />
      ) : !access.data || mustLeave || plan.isPending ? (
        <PlanSkeleton />
      ) : !data ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed bg-card/60 px-6 py-12 text-center">
          <CoachAvatar size="xl" />
          <div className="space-y-1.5">
            <h2 className="font-heading text-xl font-extrabold">Let&apos;s build your 7-day plan</h2>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">Your coach uses your step goal, workout place and time, food preference, water goal and sleep goal to plan simple daily actions.</p>
          </div>
          <Button className="h-12 rounded-xl px-6 text-base" onClick={() => create.mutate({})} disabled={create.isPending}>
            {create.isPending ? <Spinner data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
            Create my plan
          </Button>
          {create.error ? (
            <p className="flex items-center gap-1.5 text-sm font-medium text-destructive" role="alert">
              <TriangleAlert className="size-4" /> Couldn&apos;t create a plan right now.
            </p>
          ) : null}
        </div>
      ) : (
        <PlanView key={data.id} plan={data} onSave={() => save.mutate({ id: data.id })} saving={save.isPending} />
      )}

      <ConfirmDialog
        open={confirm === "regenerate"}
        onOpenChange={(o) => setConfirm(o ? "regenerate" : null)}
        title="Regenerate your plan?"
        description="You'll get fresh suggestions for all 7 days. Ticked items will be cleared and you'll need to save the new plan."
        confirmLabel="Regenerate"
        onConfirm={() => create.mutate({ regenerate: true })}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => setConfirm(o ? "delete" : null)}
        title="Delete this plan?"
        description="Your 7-day plan and its ticked items will be removed. You can create a new one any time."
        confirmLabel="Delete plan"
        destructive
        onConfirm={() => data && remove.mutate({ id: data.id })}
      />
    </EngagePage>
  )
}

function PlanView({ plan, onSave, saving }: { plan: CoachPlan; onSave: () => void; saving: boolean }) {
  const qc = useQueryClient()
  const [picked, setPicked] = useState<number | null>(null)
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const today = Math.min(7, Math.max(1, plan.todayDay))
  const dayNo = picked ?? today

  const toggle = useApiMutation(coachApi.setItemDone, {
    invalidate: false,
    onSuccess: (next, input) => {
      qc.setQueryData(PLAN_KEY, next)
      setOverrides((o) => {
        const { [input.itemId]: _, ...rest } = o
        void _
        return rest
      })
      const day = next.days.find((d) => d.items.some((i) => i.id === input.itemId))
      if (input.done && day && day.doneCount === day.items.length) toast.success(`Day ${day.day} complete! 🎉`, { description: "Every item ticked off — brilliant work." })
    },
    onError: (_e, input) =>
      setOverrides((o) => {
        const { [input.itemId]: _, ...rest } = o
        void _
        return rest
      }),
  })

  const isDone = (item: CoachPlanItem) => overrides[item.id] ?? item.done
  const days = plan.days.map((d) => ({ ...d, doneCount: d.items.filter(isDone).length }))
  const day = days.find((d) => d.day === dayNo) ?? days[0]!
  const doneTotal = days.reduce((a, d) => a + d.doneCount, 0)
  const pct = plan.totalCount ? Math.round((doneTotal / plan.totalCount) * 100) : 0

  const onToggle = (item: CoachPlanItem) => {
    const next = !isDone(item)
    setOverrides((o) => ({ ...o, [item.id]: next }))
    toggle.mutate({ id: plan.id, itemId: item.id, done: next })
  }

  return (
    <>
      {/* Save banner */}
      {plan.savedAt ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3">
          <CircleCheckBig className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">Plan saved</span>
            <span className="text-muted-foreground">
              {" "}
              · {formatRelative(plan.savedAt)} · {plan.todayDay > 7 ? "this plan has finished — regenerate for a fresh week" : `day ${today} of 7`}
            </span>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-violet-500/25 bg-violet-500/8 p-4 sm:flex-row sm:items-center">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
            <Save className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">This plan isn&apos;t saved yet</p>
            <p className="text-xs text-muted-foreground">Save it to keep it with your coach and track your progress day by day.</p>
          </div>
          <Button className="h-11 rounded-xl px-5" onClick={onSave} disabled={saving}>
            {saving ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" />}
            Save plan
          </Button>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          {/* Day tabs */}
          <div role="tablist" aria-label="Plan days" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
            {days.map((d) => (
              <DayChip key={d.day} day={d} active={d.day === day.day} isToday={d.day === plan.todayDay} onClick={() => setPicked(d.day)} />
            ))}
          </div>

          {/* Day panel */}
          <section role="tabpanel" aria-label={`Day ${day.day}`} className="overflow-hidden rounded-2xl border bg-card shadow-xs">
            <header className="space-y-2.5 border-b p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Day {day.day} · {formatDate(day.date, "EEEE, d MMM")}
                    {day.day === plan.todayDay ? <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">Today</span> : null}
                  </p>
                  <h2 className="font-heading text-lg font-bold">{day.title}</h2>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {day.doneCount}/{day.items.length}
                </span>
              </div>
              <Progress value={day.items.length ? (day.doneCount / day.items.length) * 100 : 0} className="h-1.5" />
            </header>
            <ul className="divide-y">
              {day.items.map((item) => (
                <PlanItemRow key={item.id} item={item} done={isDone(item)} onToggle={() => onToggle(item)} />
              ))}
            </ul>
          </section>
        </div>

        {/* Summary */}
        <aside className="space-y-4 rounded-2xl border bg-card p-5 shadow-xs lg:sticky lg:top-20">
          <div className="flex items-center gap-4">
            <ProgressRing value={pct} size={96} stroke={10}>
              <span className="font-heading text-xl font-extrabold tabular-nums">{pct}%</span>
            </ProgressRing>
            <div className="space-y-1 text-sm">
              <p className="font-heading text-base font-bold">Your week</p>
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">{doneTotal}</span> of {plan.totalCount} items done
              </p>
              <p className="text-xs text-muted-foreground">Started {formatDate(plan.createdAt, "d MMM")}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Based on</p>
            <dl className="space-y-1.5 text-sm">
              {plan.basedOn.map((b) => (
                <div key={b.label} className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{b.label}</dt>
                  <dd className="text-right font-medium">{b.value}</dd>
                </div>
              ))}
            </dl>
            <Link href="/employee-app/settings" className="inline-flex items-center gap-0.5 pt-1 text-xs font-semibold text-primary hover:underline">
              Change my goals & preferences <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </aside>
      </div>
    </>
  )
}

function DayChip({ day, active, isToday, onClick }: { day: CoachPlanDay; active: boolean; isToday: boolean; onClick: () => void }) {
  const complete = day.items.length > 0 && day.doneCount === day.items.length
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative flex min-w-[4.5rem] shrink-0 flex-col items-center gap-0.5 rounded-2xl border px-3 py-2.5 transition-all sm:flex-1",
        active ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25" : "bg-card hover:bg-muted",
      )}
    >
      <span className={cn("text-[11px] font-semibold uppercase", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{formatDate(day.date, "EEE")}</span>
      <span className="font-heading text-lg leading-none font-extrabold">{day.day}</span>
      <span className={cn("mt-1 flex h-4 items-center text-[10px] font-semibold", active ? "text-primary-foreground/85" : "text-muted-foreground")}>
        {complete ? <CircleCheckBig className={cn("size-4", active ? "text-primary-foreground" : "text-emerald-500")} /> : `${day.doneCount}/${day.items.length}`}
      </span>
      {isToday ? <span className={cn("absolute top-1.5 right-1.5 size-1.5 rounded-full", active ? "bg-primary-foreground" : "bg-primary")} aria-label="Today" /> : null}
    </button>
  )
}

function PlanItemRow({ item, done, onToggle }: { item: CoachPlanItem; done: boolean; onToggle: () => void }) {
  const k = KIND[item.kind]
  return (
    <li className={cn("flex items-center gap-2 py-2 pr-2 pl-1.5 transition-colors sm:gap-3 sm:pr-3", done && "bg-muted/30")}>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={done}
        aria-label={done ? `Mark "${item.label}" as not done` : `Mark "${item.label}" as done`}
        className="flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className={cn("flex size-6 items-center justify-center rounded-full border-2 transition-all", done ? "scale-105 border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 hover:border-primary")}>
          {done ? <Check className="size-3.5" strokeWidth={3} /> : null}
        </span>
      </button>
      <IconTile icon={k.icon} tone={k.tone} size="sm" className={cn(done && "opacity-60")} />
      <div className="min-w-0 flex-1 py-1">
        <p className={cn("text-sm leading-snug font-medium", done && "text-muted-foreground line-through decoration-muted-foreground/50")}>{item.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          <span className="font-semibold text-foreground/80 tabular-nums">{item.time}</span>
          {item.detail ? ` · ${item.detail}` : ` · ${k.label}`}
        </p>
      </div>
      <Link href={item.href} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={`Open ${item.label}`}>
        <ChevronRight className="size-4" />
      </Link>
    </li>
  )
}

function PlanSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-16 rounded-2xl" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-[4.5rem] shrink-0 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  )
}

