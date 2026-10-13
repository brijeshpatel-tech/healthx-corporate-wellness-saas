"use client"

import { ArrowLeft, CalendarDays, CheckCircle2, Flame, Gauge, ListChecks, Medal, PartyPopper, RefreshCw, Sparkles, TrendingUp, Trophy, UsersRound } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { BarsChart, ProgressRing } from "@/components/common/charts"
import { EmptyState } from "@/components/common/states"
import { JourneyCard, MiniChallengesCard } from "@/components/employee/engage/challenge-extras"
import { ChallengeHero } from "@/components/employee/engage/challenge-ui"
import { EngagePage, IconTile, LoadError, MiniStat } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { challengesApi, formatMetricValue, type ChallengeProgress } from "@/lib/api/employee/challenges"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatNumber, formatPercent, formatRelative, formatShortDate } from "@/lib/format"
import { cn } from "@/lib/utils"

/** SCR-M-044 Challenge Progress. */
export default function ChallengeProgressPage() {
  const { id } = useParams<{ id: string }>()
  const q = useApiQuery(["employee", "challenge", id, "progress"], () => challengesApi.progress({ id }))
  return (
    <EngagePage>
      <Link href={`/employee-app/challenges/${id}`} className="-mb-2 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Challenge details
      </Link>
      {q.error ? (
        <LoadError title="Couldn't load progress." error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <>
          <Skeleton className="h-56 rounded-3xl" />
          <div className="grid gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </>
      ) : (
        <ProgressView p={q.data} />
      )}
    </EngagePage>
  )
}

function ProgressView({ p }: { p: ChallengeProgress }) {
  const c = p.challenge
  const sync = useApiMutation(challengesApi.sync, {
    onSuccess: (r) => toast.success(r.targetReached ? "Synced — target reached! 🎉" : `Synced — you're now #${r.rank}`),
  })
  const collaborative = c.type === "collaborative"
  const unitValue = (v: number) => formatMetricValue(v, c.metric, false)
  const daysElapsed = Math.max(1, p.daily.length)
  const avg = p.daily.reduce((a, d) => a + d.value, 0) / daysElapsed
  const best = p.daily.reduce((m, d) => (d.value > m.value ? d : m), { date: "", value: 0 })
  const remaining = Math.max(0, p.target - p.progress)
  const pace = c.daysLeft > 0 ? remaining / (c.daysLeft + 1) : remaining

  if (!p.joined)
    return (
      <>
        <ChallengeHero c={c} />
        <EmptyState
          icon={Trophy}
          title="You haven't joined this challenge"
          description="Join to start tracking your progress and climb the leaderboard."
          action={
            <Button asChild>
              <Link href={`/employee-app/challenges/${c.id}`}>View challenge</Link>
            </Button>
          }
        />
      </>
    )

  const ringValue = collaborative && p.company ? p.company.pct * 100 : p.pct * 100

  return (
    <>
      <ChallengeHero
        c={c}
        subtitle={
          p.lastSyncedAt ? (
            <span className="inline-flex items-center gap-1">
              <RefreshCw className="size-3.5" /> Last synced {formatRelative(p.lastSyncedAt)}
            </span>
          ) : c.metric === "custom" ? (
            "Self-reported daily check-ins"
          ) : (
            "Not synced yet"
          )
        }
      >
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <ProgressRing value={ringValue} size={128} stroke={12} color="white" trackColor="rgba(255,255,255,0.22)">
            <span className="font-heading text-3xl font-extrabold tabular-nums">{Math.round(ringValue)}%</span>
            <span className="text-[11px] text-white/80">{collaborative ? "company goal" : "of target"}</span>
          </ProgressRing>
          <div className="w-full flex-1 space-y-3">
            {collaborative && p.company ? (
              <>
                <p className="text-sm text-white/85">Company total</p>
                <p className="font-heading text-2xl font-extrabold tabular-nums">
                  {unitValue(p.company.total)} <span className="text-base font-semibold text-white/80">/ {formatMetricValue(p.company.goal, c.metric)}</span>
                </p>
                <p className="text-sm text-white/85">
                  Your contribution: <span className="font-bold text-white">{formatMetricValue(p.progress, c.metric)}</span> ({formatPercent(p.company.contributionPct, 1)})
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-white/85">My progress</p>
                <p className="font-heading text-2xl font-extrabold tabular-nums">
                  {unitValue(p.progress)} <span className="text-base font-semibold text-white/80">/ {c.metric === "custom" ? `${formatNumber(p.target)} ${c.unit}` : formatMetricValue(p.target, c.metric)}</span>
                </p>
              </>
            )}
            <div className="flex flex-wrap gap-2">
              {p.canSync ? (
                <Button size="lg" variant="secondary" className="h-10 rounded-xl bg-white text-slate-900 hover:bg-white/90" disabled={sync.isPending} onClick={() => sync.mutate({ id: c.id })}>
                  {sync.isPending ? <Spinner /> : <RefreshCw data-icon="inline-start" />}
                  Sync now
                </Button>
              ) : null}
              {p.checkIn ? (
                <Button asChild size="lg" variant="secondary" className="h-10 rounded-xl bg-white text-slate-900 hover:bg-white/90">
                  <Link href={`/employee-app/challenges/${c.id}/check-in`}>
                    <ListChecks data-icon="inline-start" /> {p.checkIn.todayDone ? "Checked in today" : "Check in"}
                  </Link>
                </Button>
              ) : null}
              <Button asChild size="lg" className="h-10 rounded-xl border-white/30 bg-white/15 text-white hover:bg-white/25">
                <Link href={`/employee-app/challenges/${c.id}/leaderboard`}>
                  <Medal data-icon="inline-start" /> Leaderboard
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </ChallengeHero>

      {p.targetReached ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/8 p-4">
          <IconTile icon={PartyPopper} tone="emerald" />
          <div>
            <p className="font-semibold">Target reached!</p>
            <p className="text-sm text-muted-foreground">Points will be added when the challenge ends. Keep going to climb the leaderboard.</p>
          </div>
        </div>
      ) : null}

      {c.phase === "upcoming" || c.phase === "warmup" ? (
        <div className="flex items-center gap-3 rounded-2xl border border-orange-500/30 bg-orange-500/8 p-4">
          <IconTile icon={Flame} tone="orange" />
          <div>
            <p className="font-semibold">{c.phase === "warmup" ? "Warm-up period" : "Not started yet"}</p>
            <p className="text-sm text-muted-foreground">
              Scoring starts on {formatShortDate(c.warmUp?.scoringStart ?? c.startDate)}. Make sure your tracker is connected so every step counts.
            </p>
          </div>
        </div>
      ) : null}

      {p.journey ? <JourneyCard journey={p.journey} /> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={<IconTile icon={Trophy} tone="amber" size="sm" />} label="Rank" value={p.rank ? `#${p.rank}` : "—"} hint={`of ${formatNumber(p.participants)}`} />
        <StatTile icon={<IconTile icon={CalendarDays} tone="sky" size="sm" />} label={c.phase === "upcoming" ? "Starts in" : "Days left"} value={c.phase === "upcoming" ? `${c.daysToStart}d` : formatNumber(c.daysLeft)} hint={`Ends ${formatShortDate(c.endDate)}`} />
        <StatTile icon={<IconTile icon={TrendingUp} tone="violet" size="sm" />} label="Daily average" value={unitValue(avg)} hint={best.value ? `Best: ${unitValue(best.value)} on ${formatShortDate(best.date)}` : c.unit} />
        <StatTile
          icon={<IconTile icon={Gauge} tone="emerald" size="sm" />}
          label={collaborative ? "Contributors" : "Needed per day"}
          value={collaborative && p.company ? formatNumber(p.company.contributors) : p.targetReached ? "Done ✓" : unitValue(pace)}
          hint={collaborative ? "people taking part" : p.targetReached ? "Target reached" : `to hit ${c.metric === "custom" ? "the target" : formatMetricValue(p.target, c.metric)}`}
        />
      </div>

      <Card className="gap-0 py-0">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-base font-semibold">Daily breakdown</h2>
            <span className="text-xs text-muted-foreground">{c.unit}</span>
          </div>
          {p.daily.some((d) => d.value > 0) ? (
            <BarsChart
              data={p.daily.map((d) => ({ date: d.date, value: d.value }))}
              categoryKey="date"
              series={[{ key: "value", label: c.metric === "custom" ? "Check-in" : c.unit }]}
              height={240}
              categoryFormatter={(v) => formatShortDate(v)}
              valueFormatter={(v) => (c.metric === "water" ? `${formatNumber(v / 1000, 1)} L` : formatNumber(v))}
            />
          ) : (
            <EmptyState icon={Sparkles} title="No progress yet – your activity will appear after your next sync." className="py-10" action={p.canSync ? <Button onClick={() => sync.mutate({ id: c.id })} disabled={sync.isPending}>Sync now</Button> : undefined} />
          )}
        </CardContent>
      </Card>

      {p.team ? (
        <Card className="gap-0 py-0">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <UsersRound className="size-4 text-primary" />
              <h2 className="font-heading text-base font-semibold">{p.team.unit === "team" ? "Team standings" : "Department standings"}</h2>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">Average {c.unit} per participant — fair for groups of any size.</p>
            <div className="space-y-3">
              {p.team.rows.map((r, i) => {
                const max = p.team!.rows[0]?.average || 1
                return (
                  <div key={r.id} className={cn("space-y-1.5 rounded-xl p-2.5", r.isMine && "bg-primary/8 ring-1 ring-primary/25")}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="w-5 text-xs font-bold text-muted-foreground tabular-nums">{i + 1}</span>
                        <span className="truncate font-medium">{r.name}</span>
                        {r.isMine ? <span className="rounded-full bg-primary px-1.5 text-[10px] leading-4 font-bold text-primary-foreground uppercase">Yours</span> : null}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{unitValue(r.average)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", r.isMine ? "bg-primary" : "bg-primary/40")} style={{ width: `${(r.average / max) * 100}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{formatNumber(r.members)} participants</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {p.company && !collaborative ? (
        <Card className="gap-0 py-0">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <h2 className="font-heading text-base font-semibold">Company progress</h2>
            <p className="text-sm">
              <span className="font-heading text-xl font-extrabold tabular-nums">{unitValue(p.company.total)}</span>
              <span className="text-muted-foreground"> / {formatMetricValue(p.company.goal, c.metric)}</span>
            </p>
            <Progress value={p.company.pct * 100} className="h-2.5" />
            <p className="text-sm text-muted-foreground">
              You&apos;ve contributed <span className="font-semibold text-foreground">{formatPercent(p.company.contributionPct, 1)}</span> of the company total.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {p.minis.length ? <MiniChallengesCard minis={p.minis} challengeId={c.id} joinedMain={p.joined} /> : null}

      {p.checkIn ? (
        <Card className="gap-0 py-0">
          <CardContent className="flex items-center gap-3 p-4 sm:p-5">
            <IconTile icon={CheckCircle2} tone={p.checkIn.todayDone ? "emerald" : "slate"} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{p.checkIn.label}</p>
              <p className="text-sm text-muted-foreground">{p.checkIn.reason ?? (p.checkIn.todayDone ? "You've checked in today — nice work!" : "You haven't checked in today yet.")}</p>
            </div>
            <Button asChild variant={p.checkIn.canCheckIn ? "default" : "outline"} className="h-10 rounded-xl">
              <Link href={`/employee-app/challenges/${c.id}/check-in`}>{p.checkIn.canCheckIn ? "Check in" : "History"}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}

function StatTile({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-col gap-2 p-3.5 sm:p-4">
        {icon}
        <MiniStat label={label} value={value} hint={hint} />
      </CardContent>
    </Card>
  )
}
