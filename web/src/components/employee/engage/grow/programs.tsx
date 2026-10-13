"use client"

import type { LucideIcon } from "lucide-react"
import { Brain, Building2, CalendarRange, Check, ChevronRight, CircleCheckBig, Dumbbell, Droplets, Flame, Footprints, ListChecks, Lock, Moon, Sparkles, Timer, Trophy, Users } from "lucide-react"
import Link from "next/link"
import { Progress } from "@/components/ui/progress"
import type { ProgramCard, ProgramGoalProgress, ProgramWeekProgress } from "@/lib/api/employee/programs"
import { formatMl, formatNumber, formatShortDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { IconTile, type Tone } from "../page"

export function goalVisual(goal: Pick<ProgramGoalProgress, "metric" | "label">): { icon: LucideIcon; tone: Tone } {
  switch (goal.metric) {
    case "steps":
      return { icon: Footprints, tone: "sky" }
    case "water":
      return { icon: Droplets, tone: "cyan" }
    case "workouts":
      return { icon: Dumbbell, tone: "violet" }
    case "meditation":
      return { icon: Brain, tone: "teal" }
    case "calories":
      return { icon: Flame, tone: "orange" }
    case "active_minutes":
    case "distance":
      return { icon: Timer, tone: "sky" }
    case "habit":
      return /sleep/i.test(goal.label) ? { icon: Moon, tone: "indigo" } : { icon: ListChecks, tone: "emerald" }
    default:
      return { icon: ListChecks, tone: "emerald" }
  }
}

export function formatGoalValue(value: number, goal: Pick<ProgramGoalProgress, "metric" | "unit">) {
  if (goal.metric === "water") return formatMl(value)
  if (goal.metric === "distance") return `${formatNumber(value, 1)} km`
  return `${formatNumber(value)}`
}

function goalTarget(goal: ProgramGoalProgress) {
  if (goal.metric === "water") return formatMl(goal.target)
  return `${formatNumber(goal.target)} ${goal.unit}`
}

export function dateRange(start?: string, end?: string) {
  if (!start || !end) return null
  return `${formatShortDate(start)} – ${formatShortDate(end)}`
}

/** Program card for the list: cover, provider, duration, current week and progress. */
export function ProgramCardView({ program }: { program: ProgramCard }) {
  const pct = Math.round(program.progress * 100)
  const range = dateRange(program.startDate, program.endDate)
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs transition-shadow hover:shadow-md">
      <div
        className="relative flex h-28 items-end justify-between overflow-hidden p-4 text-white"
        style={{ background: `radial-gradient(100% 120% at 100% 0%, ${program.coverColor}66, transparent 60%), linear-gradient(135deg, ${program.coverColor}, ${program.coverColor}b8)` }}
      >
        <div className="bg-grid absolute inset-0 opacity-10" aria-hidden />
        <span className="relative inline-flex h-6 items-center gap-1 rounded-full bg-black/25 px-2.5 text-[11px] font-semibold backdrop-blur">
          {program.kind === "company" ? <Building2 className="size-3" /> : <Sparkles className="size-3" />}
          {program.kind === "company" ? (program.companyName ?? "Your company") : "HealthX · self-paced"}
        </span>
        <span className="absolute -top-1 right-3 text-6xl drop-shadow-md transition-transform group-hover:scale-105" aria-hidden>
          {program.coverEmoji}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          <h3 className="font-heading text-lg leading-snug font-bold">
            <Link href={`/employee-app/programs/${program.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
              {program.name}
            </Link>
          </h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">{program.description}</p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarRange className="size-3.5" /> {program.durationWeeks} weeks
          </span>
          {range ? <span>{range}</span> : <span>Starts when you join</span>}
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" /> {formatNumber(program.enrolledCount)} joined
          </span>
        </div>
        <div className="mt-auto">
          {program.tab === "mine" ? (
            <div className="space-y-1.5 border-t pt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{program.currentWeek ? `Week ${program.currentWeek} of ${program.durationWeeks}` : `Starts ${program.startDate ? formatShortDate(program.startDate) : "soon"}`}</span>
                <span className="font-semibold text-primary tabular-nums">{pct}%</span>
              </div>
              <Progress value={pct} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {program.goalsDone} of {program.goalsTotal} goals done · {formatNumber(program.completionPoints)} pts on completion
              </p>
            </div>
          ) : program.tab === "completed" ? (
            <div className="flex items-center justify-between gap-2 border-t pt-3 text-sm">
              {program.achieved ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                  <CircleCheckBig className="size-4" /> Completed
                </span>
              ) : (
                <span className="font-semibold text-muted-foreground">Ended · {pct}% done</span>
              )}
              {program.achieved ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                  <Trophy className="size-3.5" /> +{formatNumber(program.completionPoints)} pts
                </span>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 border-t pt-3">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <Trophy className="size-3.5" /> {formatNumber(program.completionPoints)} pts on completion
              </span>
              <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-primary">
                View <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

const STATUS_CHIP: Record<ProgramWeekProgress["status"], { label: string; className: string }> = {
  completed: { label: "Completed", className: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" },
  current: { label: "This week", className: "bg-sky-500/12 text-sky-700 dark:text-sky-300" },
  ended: { label: "Ended", className: "bg-amber-500/15 text-amber-800 dark:text-amber-300" },
  locked: { label: "Locked", className: "bg-muted text-muted-foreground" },
  upcoming: { label: "Up next", className: "bg-violet-500/12 text-violet-700 dark:text-violet-300" },
}

/** One week of a program: header, status and goals with live progress. */
export function WeekCard({ week, tracking, selfPaced }: { week: ProgramWeekProgress; tracking: boolean; selfPaced: boolean }) {
  const locked = week.status === "locked" || (week.status === "upcoming" && !!week.startDate)
  const pct = Math.round(week.pct * 100)
  const chip = STATUS_CHIP[week.status]
  const unlock = week.startDate ? `Unlocks ${formatShortDate(week.startDate)}` : selfPaced ? "Unlocks after the week before" : "Locked"
  return (
    <section className={cn("overflow-hidden rounded-2xl border bg-card shadow-xs", week.status === "current" && "ring-2 ring-primary/40")}>
      <header className="flex items-center gap-3 p-4">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl font-heading text-base font-extrabold",
            week.status === "completed" ? "bg-emerald-500 text-white" : week.status === "current" ? "bg-primary text-primary-foreground" : locked ? "bg-muted text-muted-foreground" : "bg-muted text-foreground",
          )}
          aria-hidden
        >
          {week.status === "completed" ? <Check className="size-5" /> : locked ? <Lock className="size-4.5" /> : week.week}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Week {week.week}</p>
          <h3 className="truncate font-heading text-base font-bold">{week.title}</h3>
          <p className="text-xs text-muted-foreground">{locked ? unlock : (dateRange(week.startDate, week.endDate) ?? "Starts when you join")}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-semibold", chip.className)}>
            {locked ? <Lock className="size-3" /> : null}
            {chip.label}
          </span>
          {tracking && !locked ? <span className="text-xs font-semibold tabular-nums">{pct}%</span> : null}
        </div>
      </header>
      <ul className="divide-y border-t">
        {week.goals.map((g) => (
          <GoalRow key={g.id} goal={g} tracking={tracking} locked={locked} />
        ))}
      </ul>
    </section>
  )
}

function GoalRow({ goal, tracking, locked }: { goal: ProgramGoalProgress; tracking: boolean; locked: boolean }) {
  const v = goalVisual(goal)
  const pct = Math.round(goal.pct * 100)
  const body = (
    <>
      <IconTile icon={v.icon} tone={locked ? "slate" : v.tone} size="sm" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm font-medium", goal.done && "text-emerald-700 dark:text-emerald-300")}>{goal.label}</p>
          {goal.done ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CircleCheckBig className="size-4" /> Done
            </span>
          ) : null}
        </div>
        {tracking && !locked ? (
          <>
            <Progress value={pct} className={cn("h-1.5", goal.done && "[&>div]:bg-emerald-500")} />
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatGoalValue(goal.value, goal)} / {goalTarget(goal)} · {goal.moduleLabel}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Target {goalTarget(goal)} · tracked in {goal.moduleLabel}
          </p>
        )}
      </div>
      {!locked ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" /> : null}
    </>
  )
  if (locked)
    return (
      <li className="flex items-center gap-3 px-4 py-3 opacity-60">
        {body}
      </li>
    )
  return (
    <li>
      <Link href={goal.href} className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50" aria-label={`${goal.label} — open ${goal.moduleLabel}`}>
        {body}
      </Link>
    </li>
  )
}
