"use client"

import { ArrowRight, CheckCircle2, EyeOff, Target, UsersRound } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { ProgressRing } from "@/components/common/charts"
import { InlineBar } from "@/components/common/misc"
import { ChipTabs, EmojiCover } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import type { TeamChallengeProgress, TeamPeriod, TeamStanding } from "@/lib/api/employee/team"
import { formatMl, formatNumber, formatPercent } from "@/lib/format"
import type { ChallengeType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { PERIOD_LABEL } from "./team-overview"

const TYPE_LABEL: Record<ChallengeType, string> = {
  individual: "Individual",
  leaderboard: "Leaderboard",
  team: "Team battle",
  company: "Company-wide",
  collaborative: "Collaborative",
}

function fmt(value: number, c: Pick<TeamChallengeProgress, "metric" | "unit">, withUnit = true) {
  if (c.metric === "water") return withUnit ? formatMl(value) : formatNumber(value / 1000, 1)
  if (c.metric === "distance") return `${formatNumber(value, 1)}${withUnit ? " km" : ""}`
  return `${formatNumber(Math.round(value))}${withUnit ? ` ${c.unit}` : ""}`
}

/** Team challenge progress with a challenge selector (SCR-M-079). */
export function TeamChallenges({ challenges, period, minGroupSize, className }: { challenges: TeamChallengeProgress[]; period: TeamPeriod; minGroupSize: number; className?: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = challenges.find((c) => c.id === selectedId) ?? challenges[0]

  return (
    <section className={cn("min-w-0 space-y-4 rounded-2xl border bg-card p-4 shadow-xs sm:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-heading text-base font-semibold">Team challenge progress</h2>
          <p className="text-xs text-muted-foreground">Active challenges your team members have joined</p>
        </div>
        {challenges.length ? (
          <Button asChild variant="ghost" size="sm" className="rounded-lg text-muted-foreground">
            <Link href="/employee-app/challenges">
              All challenges <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        ) : null}
      </div>

      {!selected ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/40 px-4 py-8 text-center">
          <span className="text-3xl" aria-hidden>
            🏁
          </span>
          <p className="text-sm font-semibold">No team members in an active challenge yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">Encourage your team to join one — progress will show up here.</p>
          <Button asChild size="sm" variant="outline" className="mt-1 rounded-lg">
            <Link href="/employee-app/challenges">Browse challenges</Link>
          </Button>
        </div>
      ) : (
        <>
          {challenges.length > 1 ? (
            <ChipTabs
              ariaLabel="Choose a challenge"
              value={selected.id}
              onChange={setSelectedId}
              options={challenges.map((c) => ({ value: c.id, label: <span className="max-w-44 truncate">{c.name}</span>, icon: <span aria-hidden>{c.emoji}</span> }))}
            />
          ) : null}
          <ChallengeDetail key={selected.id} c={selected} period={period} minGroupSize={minGroupSize} />
        </>
      )}
    </section>
  )
}

function ChallengeDetail({ c, period, minGroupSize }: { c: TeamChallengeProgress; period: TeamPeriod; minGroupSize: number }) {
  const joinRate = c.eligible ? c.joined / c.eligible : 0
  const collaborative = c.type === "collaborative"
  const ringValue = collaborative ? (c.companyTotal ?? 0) : (c.average ?? 0)
  const ringPct = c.target ? Math.min(1, ringValue / c.target) : 0

  return (
    <div className="@container space-y-4">
      <Link href={`/employee-app/challenges/${c.id}`} className="group flex items-center gap-3 rounded-xl p-1 transition-colors hover:bg-muted/40">
        <EmojiCover emoji={c.emoji} color={c.color} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{c.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {TYPE_LABEL[c.type]} · {c.daysLeft ? `${c.daysLeft} day${c.daysLeft === 1 ? "" : "s"} left` : "Ends today"} · +{c.points} pts
          </p>
        </div>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>

      <div className="grid gap-3 @lg:grid-cols-[auto_1fr]">
        {/* Ring: team average vs target (company total for collaborative challenges) */}
        <div className="flex items-center gap-4 rounded-xl bg-muted/40 p-4 @lg:flex-col @lg:justify-center @lg:px-6">
          {c.hidden && !collaborative ? (
            <span className="flex size-24 shrink-0 flex-col items-center justify-center gap-1 rounded-full border-4 border-dashed border-muted-foreground/25 text-muted-foreground">
              <EyeOff className="size-5" aria-hidden />
              <span className="text-[11px] font-medium">Hidden</span>
            </span>
          ) : (
            <ProgressRing value={ringPct} max={1} size={96} stroke={9} color={c.color}>
              <span className="font-heading text-lg font-bold tabular-nums">{formatPercent(ringPct)}</span>
              <span className="text-[10px] text-muted-foreground">of target</span>
            </ProgressRing>
          )}
          <div className="min-w-0 space-y-0.5 @lg:text-center">
            <p className="text-xs font-medium text-muted-foreground">{collaborative ? "Company progress" : "Team average"}</p>
            <p className="font-heading text-lg font-bold tabular-nums">{collaborative ? fmt(c.companyTotal ?? 0, c) : c.average !== null ? fmt(c.average, c) : "—"}</p>
            <p className="text-[11px] text-muted-foreground">
              {collaborative ? `Shared goal ${fmt(c.target, c)}` : `Target ${fmt(c.target, c)} each`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Metric icon={<UsersRound className="size-4" />} label="Members joined" value={`${c.joined} / ${c.eligible}`}>
            <InlineBar value={c.joined} max={Math.max(1, c.eligible)} color={c.color} className="h-1.5" />
            <p className="text-[11px] text-muted-foreground">{formatPercent(joinRate)} of your team</p>
          </Metric>
          <Metric icon={<Target className="size-4" />} label="Team total" value={c.total !== null ? fmt(c.total, c) : "Hidden"} muted={c.total === null}>
            <p className="text-[11px] text-muted-foreground">
              {c.periodTotal !== null ? `+${fmt(c.periodTotal, c)} ${PERIOD_LABEL[period]}` : `Shown when ${minGroupSize}+ join`}
            </p>
          </Metric>
          {collaborative ? (
            <Metric icon={<Target className="size-4" />} label="Your team's share" value={c.total !== null && c.companyTotal ? formatPercent(c.total / c.companyTotal, 1) : "Hidden"} muted={c.total === null} className="col-span-2">
              <p className="text-[11px] text-muted-foreground">of everything logged across the company</p>
            </Metric>
          ) : c.type !== "team" ? (
            <Metric icon={<CheckCircle2 className="size-4" />} label="Completed" value={`${c.completed} of ${c.joined}`} className="col-span-2">
              <InlineBar value={c.completed} max={Math.max(1, c.joined)} color="var(--primary)" className="h-1.5" />
            </Metric>
          ) : null}
        </div>
      </div>

      {c.hidden ? (
        <p className="flex items-start gap-2 rounded-xl bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
          <EyeOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Team totals and averages appear once at least {minGroupSize} team members join — {c.joined} so far.
        </p>
      ) : null}

      {c.standings?.length ? <Standings rows={c.standings} c={c} minGroupSize={minGroupSize} /> : null}
    </div>
  )
}

function Metric({ icon, label, value, muted, className, children }: { icon: React.ReactNode; label: string; value: React.ReactNode; muted?: boolean; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("min-w-0 space-y-1.5 rounded-xl border p-3", className)}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </p>
      <p className={cn("truncate font-heading text-base font-bold tabular-nums", muted && "text-muted-foreground")}>{value}</p>
      {children}
    </div>
  )
}

/** Group standings for team battles — the manager's own group highlighted. */
function Standings({ rows, c, minGroupSize }: { rows: TeamStanding[]; c: TeamChallengeProgress; minGroupSize: number }) {
  const max = Math.max(1, ...rows.map((r) => r.average ?? 0))
  const unitName = c.teamUnit === "team" ? "team" : "department"
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{c.teamUnit === "team" ? "Team" : "Department"} standings</h3>
        <span className="text-[11px] text-muted-foreground">avg per participant</span>
      </div>
      <ol className="divide-y overflow-hidden rounded-xl border">
        {rows.map((r) => (
          <li key={r.id} className={cn("flex items-center gap-3 px-3 py-2.5", r.isMine && "bg-primary/8 ring-1 ring-primary/25 ring-inset")} aria-current={r.isMine || undefined}>
            <span className={cn("w-7 shrink-0 text-center font-heading text-sm font-bold tabular-nums", r.rank && r.rank <= 3 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{r.rank ? `#${r.rank}` : "–"}</span>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: r.isMine ? "var(--primary)" : c.color, opacity: r.isMine ? 1 : 0.75 }}>
              <UsersRound className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className={cn("truncate text-sm", r.isMine ? "font-semibold" : "font-medium")}>{r.name}</span>
                {r.isMine ? <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] leading-4 font-bold text-primary-foreground uppercase">Your {unitName}</span> : null}
              </div>
              {r.hidden ? (
                <p className="text-[11px] text-muted-foreground">Fewer than {minGroupSize} participants — hidden</p>
              ) : (
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", r.isMine ? "bg-primary" : "bg-primary/45")} style={{ width: `${Math.max(2, ((r.average ?? 0) / max) * 100)}%` }} />
                </div>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold tabular-nums">{r.average !== null ? fmt(r.average, c, false) : "—"}</p>
              <p className="text-[11px] text-muted-foreground">{r.participants} joined</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
