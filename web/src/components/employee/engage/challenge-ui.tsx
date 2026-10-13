"use client"

import type { LucideIcon } from "lucide-react"
import { Brain, CalendarClock, CheckCircle2, Coins, Droplets, Dumbbell, Flame, Footprints, Gift, Hourglass, Medal, Route, Timer, Trophy, UsersRound } from "lucide-react"
import Link from "next/link"
import { useSyncExternalStore } from "react"
import { Progress } from "@/components/ui/progress"
import { formatNumber, formatShortDate } from "@/lib/format"
import { formatMetricValue, type ChallengePhase, type ChallengeSummary } from "@/lib/api/employee/challenges"
import type { ChallengeMetric, ChallengeType } from "@/lib/types"
import { cn } from "@/lib/utils"

export const METRIC_ICON: Record<ChallengeMetric, LucideIcon> = {
  steps: Footprints,
  distance: Route,
  calories: Flame,
  active_minutes: Timer,
  workouts: Dumbbell,
  water: Droplets,
  meditation: Brain,
  custom: CheckCircle2,
}

const TYPE_CLASS: Record<ChallengeType, string> = {
  individual: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  leaderboard: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  team: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300",
  company: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  collaborative: "bg-teal-500/12 text-teal-700 dark:text-teal-300",
}

export function TypeBadge({ type, label, className, onCover }: { type: ChallengeType; label: string; className?: string; onCover?: boolean }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold", onCover ? "bg-white/20 text-white backdrop-blur-sm" : TYPE_CLASS[type], className)}>
      {label}
    </span>
  )
}

type PhaseInfo = Pick<ChallengeSummary, "phase" | "daysLeft" | "daysToStart" | "endDate"> & { daysToScoring?: number }

export function phaseText(c: PhaseInfo) {
  const toScore = c.daysToScoring ?? c.daysToStart
  const map: Record<ChallengePhase, string> = {
    upcoming: c.daysToStart === 0 ? "Starts today" : c.daysToStart === 1 ? "Starts tomorrow" : `Starts in ${c.daysToStart} days`,
    warmup: toScore <= 1 ? "Warm-up · scoring starts tomorrow" : `Warm-up · scoring in ${toScore} days`,
    live: c.daysLeft === 0 ? "Ends today" : c.daysLeft === 1 ? "1 day left" : `${c.daysLeft} days left`,
    finalising: "Finalising results",
    ended: `Ended ${formatShortDate(c.endDate)}`,
  }
  return map[c.phase]
}

export function PhaseChip({ c, className }: { c: PhaseInfo; className?: string }) {
  const Icon = c.phase === "upcoming" ? CalendarClock : c.phase === "warmup" ? Flame : c.phase === "finalising" ? Hourglass : c.phase === "ended" ? CheckCircle2 : Timer
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", className)}>
      <Icon className="size-3.5" />
      {phaseText(c)}
    </span>
  )
}

export const targetText = (c: Pick<ChallengeSummary, "metric" | "target" | "unit" | "totalDays">) =>
  c.metric === "custom" ? `${formatNumber(c.target)} ${c.unit} in ${c.totalDays} days` : `${formatMetricValue(c.target, c.metric)} in ${c.totalDays} days`

/** Card used on the Challenges list and as "next challenge" suggestions. */
export function ChallengeCard({ c, href, compact }: { c: ChallengeSummary; href: string; compact?: boolean }) {
  const Icon = METRIC_ICON[c.metric]
  const pct = c.myProgress !== null && c.target ? Math.min(100, (c.myProgress / c.target) * 100) : 0
  return (
    <Link href={href} className="group block focus-visible:outline-none">
      <article className="h-full overflow-hidden rounded-2xl border bg-card shadow-xs transition-all group-hover:-translate-y-0.5 group-hover:shadow-md group-focus-visible:ring-3 group-focus-visible:ring-ring/50">
        <div className="relative flex items-center gap-3 p-4 text-white" style={{ background: `linear-gradient(135deg, ${c.coverColor}, ${c.coverColor}c0)` }}>
          <div className="bg-grid absolute inset-0 opacity-10" />
          <span className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl shadow-inner">{c.coverEmoji}</span>
          <div className="relative min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <TypeBadge type={c.type} label={c.typeLabel} onCover />
              {c.reward ? (
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-white/20 px-2 text-xs font-semibold">
                  <Gift className="size-3.5" /> Reward
                </span>
              ) : null}
              {c.hasPrizes ? (
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-white/20 px-2 text-xs font-semibold">
                  <Medal className="size-3.5" /> Prizes
                </span>
              ) : null}
            </div>
            <h3 className="truncate font-heading text-base font-bold">{c.name}</h3>
          </div>
          <span className="relative inline-flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">
            <Coins className="size-3.5" />+{c.points}
          </span>
        </div>
        <div className="space-y-3 p-4">
          {!compact ? <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p> : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Icon className="size-3.5 text-primary" />
              {targetText(c)}
            </span>
            <span>
              {formatShortDate(c.startDate)} – {formatShortDate(c.endDate)}
            </span>
            <span className="inline-flex items-center gap-1">
              <UsersRound className="size-3.5" />
              {formatNumber(c.participantsCount)} joined
            </span>
          </div>
          {c.joined && c.myProgress !== null && c.type !== "collaborative" ? (
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span>
                  <span className="font-semibold tabular-nums">{formatMetricValue(c.myProgress, c.metric, false)}</span>
                  <span className="text-muted-foreground"> / {c.metric === "custom" ? `${formatNumber(c.target)} ${c.unit}` : formatMetricValue(c.target, c.metric)}</span>
                </span>
                <span className="font-semibold tabular-nums">{Math.round(pct)}%</span>
              </div>
              <Progress value={pct} className="h-2" />
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <PhaseChip c={c} className={cn(c.phase === "live" && c.daysLeft <= 3 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />
            {c.joined && c.myRank ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <Trophy className="size-3.5" />#{c.myRank}
              </span>
            ) : c.joined ? null : (
              <span className="text-xs font-semibold text-primary">{c.phase === "upcoming" || c.phase === "warmup" || c.phase === "live" ? "View & join →" : "View →"}</span>
            )}
          </div>
        </div>
      </article>
    </Link>
  )
}

// ─── Live countdown (client clock via useSyncExternalStore — render stays pure) ──

let nowCache = 0
function subscribeNow(onChange: () => void) {
  const t = setInterval(() => {
    nowCache = Date.now()
    onChange()
  }, 1000)
  return () => clearInterval(t)
}
const getNow = () => {
  if (!nowCache) nowCache = Date.now()
  return nowCache
}

/** Current time, ticking every second on the client (0 during server render). */
export function useNow() {
  return useSyncExternalStore(subscribeNow, getNow, () => 0)
}

/** "17d 06h 12m 09s" countdown to a local date (YYYY-MM-DD) at start or end of day. */
export function Countdown({ to, endOfDay, className }: { to: string; endOfDay?: boolean; className?: string }) {
  const now = useNow()
  if (!now) return null
  const target = new Date(`${to}T${endOfDay ? "23:59:59" : "00:00:00"}`).getTime()
  const diff = Math.max(0, target - now)
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1000)
  const parts = [
    { v: d, l: "days" },
    { v: h, l: "hrs" },
    { v: m, l: "min" },
    { v: s, l: "sec" },
  ]
  return (
    <div className={cn("flex gap-2", className)} role="timer" aria-label={`${d} days ${h} hours ${m} minutes`}>
      {parts.map((p) => (
        <div key={p.l} className="flex min-w-14 flex-col items-center rounded-xl bg-white/18 px-2 py-1.5 backdrop-blur-sm">
          <span className="font-heading text-lg leading-tight font-extrabold tabular-nums">{String(p.v).padStart(2, "0")}</span>
          <span className="text-[10px] font-medium tracking-wide uppercase opacity-80">{p.l}</span>
        </div>
      ))}
    </div>
  )
}

/** Gradient hero at the top of challenge sub-pages. */
export function ChallengeHero({
  c,
  children,
  subtitle,
}: {
  c: Pick<ChallengeSummary, "coverEmoji" | "coverColor" | "name" | "type" | "typeLabel" | "points" | "phase" | "daysLeft" | "daysToStart" | "endDate"> & { daysToScoring?: number }
  subtitle?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-lg sm:p-6" style={{ background: `linear-gradient(135deg, ${c.coverColor}, ${c.coverColor}b0)`, boxShadow: `0 18px 40px -18px ${c.coverColor}` }}>
      <div className="bg-grid absolute inset-0 opacity-10" />
      <div className="absolute -top-10 -right-6 text-[9rem] leading-none opacity-15 select-none" aria-hidden>
        {c.coverEmoji}
      </div>
      <div className="relative flex items-start gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl shadow-inner sm:size-16 sm:text-4xl">{c.coverEmoji}</span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <TypeBadge type={c.type} label={c.typeLabel} onCover />
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-white/20 px-2.5 text-xs font-bold">
              <Coins className="size-3.5" />+{c.points} pts
            </span>
            <span className="inline-flex h-6 items-center rounded-full bg-black/15 px-2.5 text-xs font-medium">{phaseText(c)}</span>
          </div>
          <h1 className="font-heading text-xl font-extrabold tracking-tight sm:text-2xl">{c.name}</h1>
          {subtitle ? <div className="text-sm text-white/85">{subtitle}</div> : null}
        </div>
      </div>
      {children ? <div className="relative mt-5">{children}</div> : null}
    </div>
  )
}
