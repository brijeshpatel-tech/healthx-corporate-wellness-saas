"use client"

import { ArrowLeft, Award, Coins, Gift, Hourglass, Medal, Target, Trophy, UsersRound } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { EmptyState } from "@/components/common/states"
import { Confetti, Medallion } from "@/components/employee/engage/celebration"
import { CertificateDialog, PrizesCard } from "@/components/employee/engage/challenge-extras"
import { ChallengeCard } from "@/components/employee/engage/challenge-ui"
import { Podium } from "@/components/employee/engage/leaderboard"
import { EngagePage, IconTile, LoadError, MiniStat } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { challengesApi, formatMetricValue, type ChallengeResults } from "@/lib/api/employee/challenges"
import { useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber } from "@/lib/format"

/** SCR-M-047 Challenge Results. */
export default function ChallengeResultsPage() {
  const { id } = useParams<{ id: string }>()
  const q = useApiQuery(["employee", "challenge", id, "results"], () => challengesApi.results({ id }))
  return (
    <EngagePage>
      <Link href="/employee-app/challenges?tab=completed" className="-mb-2 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Completed challenges
      </Link>
      {q.error ? (
        q.error.status === 409 ? (
          <EmptyState
            icon={Hourglass}
            title="This challenge is still running"
            description="Results are available once the challenge ends."
            action={
              <Button asChild>
                <Link href={`/employee-app/challenges/${id}/progress`}>View progress</Link>
              </Button>
            }
          />
        ) : (
          <LoadError title="Couldn't load the results." error={q.error} onRetry={() => q.refetch()} />
        )
      ) : !q.data ? (
        <>
          <Skeleton className="h-80 rounded-3xl" />
          <Skeleton className="h-64 rounded-xl" />
        </>
      ) : (
        <Results r={q.data} />
      )}
    </EngagePage>
  )
}

function Results({ r }: { r: ChallengeResults }) {
  const c = r.challenge
  const [certOpen, setCertOpen] = useState(false)
  const won = r.pointsEarned > 0 && !r.finalising
  const medal = r.finalRank === 1 ? "🥇" : r.finalRank === 2 ? "🥈" : r.finalRank === 3 ? "🥉" : won ? "🏆" : r.joined ? "🎯" : c.coverEmoji
  const fmt = (v: number) => formatMetricValue(v, c.metric, false)

  return (
    <>
      {r.finalising ? (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4">
          <IconTile icon={Hourglass} tone="amber" />
          <p className="text-sm">
            <span className="font-semibold">Finalising.</span> Results are being finalised while late data syncs (until {formatDate(r.finalisingUntil, "d MMM")}). Positions may still change.
          </p>
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-3xl border bg-card px-5 pt-10 pb-6 text-center shadow-sm sm:px-8" style={{ background: `radial-gradient(120% 80% at 50% 0%, ${c.coverColor}33, transparent 65%)` }}>
        {won ? <Confetti pieces={80} /> : null}
        <div className="relative flex flex-col items-center gap-4">
          <div className="animate-in duration-700 zoom-in-50 fade-in-0">
            <Medallion emoji={medal} color={won ? "#f59e0b" : c.coverColor} size="xl" />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {c.coverEmoji} {c.name} · ended {formatDate(c.endDate, "d MMM")}
            </p>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">{r.headline}</h1>
            {r.joined ? (
              <p className="text-sm text-muted-foreground">
                {r.outcome === "completed" ? "You reached the target — brilliant effort." : r.outcome === "not_completed" ? "You didn't quite reach the target this time." : r.outcome === "won" ? "Your group had the best average per person." : "Thanks for taking part!"}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">You didn&apos;t take part in this one — join the next challenge below.</p>
            )}
          </div>
          {r.pointsEarned ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-4 py-1.5 text-sm font-bold text-amber-700 dark:text-amber-300">
              <Coins className="size-4" /> +{r.pointsEarned} points {r.finalising ? "(pending)" : "earned"}
            </span>
          ) : null}
          {r.certificate ? (
            <Button size="lg" variant="outline" className="h-11 rounded-xl bg-card" onClick={() => setCertOpen(true)}>
              <Award data-icon="inline-start" /> Download certificate
            </Button>
          ) : null}
        </div>

        {r.joined ? (
          <div className="relative mt-6 grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
            <Stat icon={<IconTile icon={Trophy} tone="amber" size="sm" />} label="Final rank" value={r.finalRank ? `#${r.finalRank}` : "—"} hint={`of ${formatNumber(r.participants)}`} />
            <Stat icon={<IconTile icon={Medal} tone="emerald" size="sm" />} label="Final total" value={fmt(r.finalTotal)} hint={c.unit} />
            <Stat icon={<IconTile icon={Target} tone="sky" size="sm" />} label="Target" value={c.metric === "custom" ? formatNumber(c.target) : fmt(c.target)} hint={c.unit} />
            <Stat icon={<IconTile icon={UsersRound} tone="violet" size="sm" />} label="Completed" value={c.type === "collaborative" ? (r.collaborative?.reached ? "Yes" : "No") : `${Math.min(100, Math.round((r.finalTotal / c.target) * 100))}%`} hint={c.type === "collaborative" ? "company goal" : "of target"} />
          </div>
        ) : null}
      </div>

      {r.group ? (
        <Card className="gap-0 py-0">
          <CardContent className="flex items-center gap-4 p-4 sm:p-5">
            <IconTile icon={UsersRound} tone="indigo" size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">Your {c.teamUnit ?? "department"}</p>
              <p className="font-heading text-lg font-bold">
                {r.group.name} finished #{r.group.rank} of {r.group.total}
              </p>
            </div>
            {r.group.rank === 1 ? <span className="text-3xl">🏆</span> : null}
          </CardContent>
        </Card>
      ) : null}

      {r.collaborative ? (
        <Card className="gap-0 py-0">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <p className="text-sm font-semibold">Company goal</p>
            <p className="text-sm">
              <span className="font-heading text-xl font-extrabold tabular-nums">{fmt(r.collaborative.total)}</span>
              <span className="text-muted-foreground"> / {formatMetricValue(r.collaborative.goal, c.metric)}</span>
            </p>
            <Progress value={Math.min(100, (r.collaborative.total / r.collaborative.goal) * 100)} className="h-2.5" />
            <p className="text-sm text-muted-foreground">{r.collaborative.reached ? "Goal reached together 🎉" : "The company fell short of the shared goal this time."}</p>
          </CardContent>
        </Card>
      ) : null}

      {r.reward ? (
        <Card className="gap-0 overflow-hidden py-0">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-3xl" style={{ background: `${r.reward.color}22` }}>
              {r.reward.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Gift className="size-3.5" /> {r.reward.earned ? "Reward earned" : "Challenge reward"}
              </p>
              <p className="font-semibold">{r.reward.name}</p>
              <p className="text-sm text-muted-foreground">{r.reward.earned ? "Your company will arrange delivery — track it in My Orders." : "Awarded to participants who hit the target."}</p>
            </div>
            <Button asChild variant={r.reward.earned ? "default" : "outline"} className="h-10 rounded-xl">
              <Link href={r.reward.earned ? "/employee-app/orders" : `/employee-app/rewards/${r.reward.id}`}>View reward</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {r.prizes ? <PrizesCard prizes={r.prizes} /> : null}

      {r.podium.length ? (
        <Card className="gap-0 py-0">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-base font-semibold">Top 3</h2>
              <Button asChild variant="ghost" size="sm" className="text-primary">
                <Link href={`/employee-app/challenges/${c.id}/leaderboard`}>View leaderboard →</Link>
              </Button>
            </div>
            <div className="px-2 pt-6 sm:px-10">
              <Podium entries={r.podium} unit={c.unit} valueFormatter={fmt} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold">Join your next challenge</h2>
          <Button asChild variant="ghost" size="sm" className="text-primary">
            <Link href="/employee-app/challenges?tab=available">See all</Link>
          </Button>
        </div>
        {r.suggestions.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {r.suggestions.map((s) => (
              <ChallengeCard key={s.id} c={s} href={`/employee-app/challenges/${s.id}`} compact />
            ))}
          </div>
        ) : (
          <EmptyState icon={Trophy} title="No challenges open right now – check back soon." className="py-8" />
        )}
      </section>

      {r.certificate ? <CertificateDialog certificate={r.certificate} color={c.coverColor} open={certOpen} onOpenChange={setCertOpen} /> : null}
    </>
  )
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border bg-card/70 p-3.5 backdrop-blur-sm">
      {icon}
      <MiniStat label={label} value={value} hint={hint} />
    </div>
  )
}
