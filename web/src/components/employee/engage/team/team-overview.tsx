"use client"

import type { LucideIcon } from "lucide-react"
import { Activity, EyeOff, Footprints, Lock, Medal, Scale, UsersRound } from "lucide-react"
import { BarsChart, ProgressRing } from "@/components/common/charts"
import { PrivacyNote } from "@/components/common/misc"
import { IconTile, type Tone } from "@/components/employee/engage/page"
import { Card, CardContent } from "@/components/ui/card"
import type { TeamPeriod, TeamSummary } from "@/lib/api/employee/team"
import { formatDate, formatNumber, formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"

export const PERIOD_LABEL: Record<TeamPeriod, string> = { week: "this week", month: "this month" }

/** Gradient hero: team name, department, rank among teams and participation ring. */
export function TeamHero({ summary }: { summary: TeamSummary }) {
  const { team, participation, rank, period } = summary
  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-600 py-0 text-white shadow-lg shadow-emerald-500/20">
      <div className="bg-grid absolute inset-0 opacity-10" aria-hidden />
      <span className="absolute -top-16 -right-12 size-52 rounded-full bg-white/10" aria-hidden />
      <CardContent className="relative flex items-center gap-4 p-5 sm:gap-6 sm:p-6">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-0.5">
            <p className="truncate text-sm font-medium text-white/85">Your team · {team.departmentName}</p>
            <h2 className="truncate font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">{team.name}</h2>
          </div>
          <p className="text-sm font-semibold sm:text-base">
            {participation.active} of {participation.members} members active {PERIOD_LABEL[period]}
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">
              <Medal className="size-3.5" aria-hidden />
              {rank.position ? `#${rank.position} of ${rank.of} teams` : "Not ranked yet"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">
              <UsersRound className="size-3.5" aria-hidden />
              {team.members} members{team.invited ? ` · ${team.invited} invited` : ""}
            </span>
          </div>
        </div>
        <ProgressRing value={participation.active} max={Math.max(1, participation.members)} size={112} stroke={11} color="white" trackColor="rgba(255,255,255,0.22)">
          <span className="font-heading text-2xl font-extrabold tabular-nums">{formatPercent(participation.rate)}</span>
          <span className="text-[11px] text-white/85">active</span>
        </ProgressRing>
      </CardContent>
    </Card>
  )
}

function StatTile({ icon, tone, label, value, hint, muted }: { icon: LucideIcon; tone: Tone; label: string; value: React.ReactNode; hint?: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs">
      <IconTile icon={icon} tone={tone} size="sm" />
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <p className={cn("truncate font-heading text-xl font-bold tabular-nums", muted && "text-base text-muted-foreground")}>{value}</p>
        {hint ? <p className="truncate text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  )
}

/** Four headline tiles: participation, average steps, vs company, rank. */
export function TeamStats({ summary }: { summary: TeamSummary }) {
  const { participation, steps, rank, period } = summary
  const vsCompany = steps.averagePerMember !== null && steps.companyAveragePerMember ? steps.averagePerMember / steps.companyAveragePerMember - 1 : null
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatTile icon={Activity} tone="emerald" label="Participation" value={formatPercent(participation.rate)} hint={`${participation.active} of ${participation.members} active`} />
      <StatTile
        icon={steps.suppressed ? Lock : Footprints}
        tone="sky"
        label="Avg steps per member"
        value={steps.averagePerMember !== null ? formatNumber(steps.averagePerMember) : "Hidden"}
        hint={steps.averagePerDay !== null ? `≈ ${formatNumber(steps.averagePerDay)} a day` : `Needs ${summary.minGroupSize}+ members`}
        muted={steps.suppressed}
      />
      <StatTile
        icon={Scale}
        tone="violet"
        label="Vs company average"
        value={vsCompany === null ? "—" : `${vsCompany >= 0 ? "+" : ""}${formatPercent(vsCompany)}`}
        hint={steps.companyAveragePerMember !== null ? `Company: ${formatNumber(steps.companyAveragePerMember)} ${PERIOD_LABEL[period]}` : undefined}
        muted={vsCompany === null}
      />
      <StatTile
        icon={Medal}
        tone="amber"
        label="Team rank"
        value={rank.position ? `#${rank.position}` : "—"}
        hint={rank.position ? `of ${rank.of} teams by avg steps` : `Teams need ${summary.minGroupSize}+ members`}
        muted={!rank.position}
      />
    </div>
  )
}

/** Team average steps per member per day — hidden for small teams. */
export function TeamStepsCard({ summary, className }: { summary: TeamSummary; className?: string }) {
  const { steps, period, minGroupSize } = summary
  return (
    <section className={cn("min-w-0 space-y-4 rounded-2xl border bg-card p-4 shadow-xs sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-semibold">Team average steps</h2>
          <p className="text-xs text-muted-foreground">Average per member per day, {PERIOD_LABEL[period]}</p>
        </div>
        {steps.averagePerDay !== null ? (
          <div className="text-right">
            <p className="font-heading text-xl font-bold tabular-nums">{formatNumber(steps.averagePerDay)}</p>
            <p className="text-[11px] text-muted-foreground">steps / day</p>
          </div>
        ) : null}
      </div>
      {steps.suppressed ? (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-muted/40 px-4 py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <EyeOff className="size-5" aria-hidden />
          </span>
          <div className="max-w-sm space-y-1">
            <p className="text-sm font-semibold">Hidden to protect privacy</p>
            <p className="text-xs text-muted-foreground">
              Team averages appear once at least {minGroupSize} members use HealthX, so no one&apos;s individual activity can be worked out. Your team has {summary.team.members}.
            </p>
          </div>
          <PrivacyNote minGroupSize={minGroupSize} className="text-left" />
        </div>
      ) : steps.trend ? (
        <BarsChart
          data={steps.trend}
          categoryKey="date"
          series={[{ key: "value", label: "Avg steps per member" }]}
          height={200}
          categoryFormatter={(v) => formatDate(v, period === "week" ? "EEE" : "d MMM")}
        />
      ) : (
        <p className="rounded-xl bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">No steps synced {PERIOD_LABEL[period]} yet.</p>
      )}
    </section>
  )
}
