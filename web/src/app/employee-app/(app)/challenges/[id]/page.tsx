"use client"

import { ArrowLeft, BarChart3, Check, CheckCircle2, Clock, Coins, Gift, Info, ListChecks, LogOut, Medal, ShieldAlert, Sparkles, Target, UsersRound } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/common/misc"
import { UserAvatar } from "@/components/common/user-avatar"
import { Confetti } from "@/components/employee/engage/celebration"
import { GetReadyCard, InviteCodeCard, JourneyCard, MiniChallengesCard, PrizesCard } from "@/components/employee/engage/challenge-extras"
import { ChallengeHero, Countdown, METRIC_ICON, targetText } from "@/components/employee/engage/challenge-ui"
import { EngagePage, IconTile, LoadError } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { challengesApi, formatMetricValue, type ChallengeDetail } from "@/lib/api/employee/challenges"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** SCR-M-043 Challenge Detail — rules, dates, target, reward; join / leave. */
export default function ChallengeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const q = useApiQuery(["employee", "challenge", id], () => challengesApi.detail({ id }))
  if (q.error)
    return (
      <EngagePage backHref="/employee-app/challenges" backLabel="Challenges" title="Challenge">
        <LoadError title={q.error.status === 404 ? "This challenge is no longer available." : "Couldn't load this challenge."} error={q.error.status === 404 ? undefined : q.error} onRetry={q.error.status === 404 ? undefined : () => q.refetch()} />
      </EngagePage>
    )
  if (!q.data) return <DetailSkeleton />
  return <Detail c={q.data} />
}

function Detail({ c }: { c: ChallengeDetail }) {
  const [justJoined, setJustJoined] = useState(false)
  const [confirmJoin, setConfirmJoin] = useState(false)
  const join = useApiMutation(challengesApi.join, {
    onSuccess: () => {
      setJustJoined(true)
      toast.success("You've joined! Your progress starts counting now.")
    },
  })
  const leave = useApiMutation(challengesApi.leave, {
    success: "You've left the challenge.",
    onSuccess: () => setJustJoined(false),
  })
  const Icon = METRIC_ICON[c.metric]
  const pct = c.myProgress !== null && c.target ? Math.min(100, (c.myProgress / c.target) * 100) : 0
  const live = c.phase === "live"
  const ended = c.phase === "ended" || c.phase === "finalising"

  const primary = c.joined ? (
    <div className="grid w-full grid-cols-2 gap-2">
      <Button asChild size="lg" className="h-11 rounded-xl">
        <Link href={ended ? `/employee-app/challenges/${c.id}/results` : `/employee-app/challenges/${c.id}/progress`}>
          {ended ? <Medal data-icon="inline-start" /> : <BarChart3 data-icon="inline-start" />}
          {ended ? "View results" : "View progress"}
        </Link>
      </Button>
      <Button asChild size="lg" variant="outline" className="h-11 rounded-xl">
        <Link href={`/employee-app/challenges/${c.id}/leaderboard`}>
          <Medal data-icon="inline-start" /> Leaderboard
        </Link>
      </Button>
    </div>
  ) : c.canJoin ? (
    <Button size="lg" className="h-12 w-full rounded-xl text-base font-semibold shadow-lg shadow-primary/25" onClick={() => setConfirmJoin(true)} disabled={join.isPending}>
      {join.isPending ? <Spinner /> : <Sparkles data-icon="inline-start" />}
      Join challenge
    </Button>
  ) : (
    <div className="flex w-full items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/8 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-200">
      <ShieldAlert className="size-4 shrink-0" />
      {c.joinBlockedReason}
    </div>
  )

  return (
    <EngagePage>
      <Link href="/employee-app/challenges" className="-mb-2 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Challenges
      </Link>

      <ChallengeHero
        c={c}
        subtitle={
          <>
            {formatDate(c.startDate, "d MMM")} – {formatDate(c.endDate, "d MMM yyyy")} · {c.totalDays} days
          </>
        }
      >
        {c.phase === "upcoming" || c.phase === "warmup" || live ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold tracking-wide text-white/85 uppercase">{c.phase === "upcoming" ? "Starts in" : c.phase === "warmup" ? "Warm-up · scoring starts in" : "Ends in"}</p>
            <Countdown to={c.phase === "upcoming" ? c.startDate : c.phase === "warmup" ? (c.warmUp?.scoringStart ?? c.startDate) : c.endDate} endOfDay={live} />
          </div>
        ) : (
          <p className="rounded-xl bg-black/15 px-3 py-2 text-sm">
            {c.phase === "finalising" ? `Results are being finalised while late data syncs (until ${formatDate(c.finalisingUntil, "d MMM")}).` : `This challenge ended on ${formatDate(c.endDate)}.`}
          </p>
        )}
      </ChallengeHero>

      {justJoined && c.joined ? (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/8 p-4">
          <Confetti pieces={40} />
          <div className="relative flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check className="size-5" />
            </span>
            <div>
              <p className="font-semibold">You&apos;re in! 🎉</p>
              <p className="text-sm text-muted-foreground">Your progress starts counting now. You&apos;re #{c.myRank} of {formatNumber(c.participantsCount)} — time to climb.</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          {c.joined && c.myProgress !== null && c.type !== "collaborative" ? (
            <Card className="gap-0 py-0">
              <CardContent className="space-y-3 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Your progress</p>
                  {c.myRank ? <span className="rounded-full bg-amber-500/12 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">#{c.myRank} of {formatNumber(c.participantsCount)}</span> : null}
                </div>
                <p className="text-sm">
                  <span className="font-heading text-2xl font-extrabold tabular-nums">{formatMetricValue(c.myProgress, c.metric, false)}</span>
                  <span className="text-muted-foreground"> / {c.metric === "custom" ? `${formatNumber(c.target)} ${c.unit}` : formatMetricValue(c.target, c.metric)}</span>
                </p>
                <Progress value={pct} className="h-2.5" />
                {c.metric === "custom" && live ? (
                  <Button asChild variant="outline" className="h-10 rounded-xl">
                    <Link href={`/employee-app/challenges/${c.id}/check-in`}>
                      <ListChecks data-icon="inline-start" /> Check in for today
                    </Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {c.phase === "upcoming" || c.phase === "warmup" ? <GetReadyCard warmUp={c.warmUp} startDate={c.startDate} joined={c.joined} trackerConnected={c.trackerConnected} phase={c.phase} /> : null}

          {c.journey ? <JourneyCard journey={c.journey} /> : null}

          {c.minis.length ? <MiniChallengesCard minis={c.minis} challengeId={c.id} joinedMain={c.joined} /> : null}

          <Card className="gap-0 py-0">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <p className="text-[15px] leading-relaxed">{c.description}</p>
              <div className="flex items-start gap-3 rounded-xl bg-muted/60 p-3">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{c.typeLabel} challenge. </span>
                  {c.typeHelp}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Fact icon={<IconTile icon={Icon} tone="emerald" size="sm" />} label="Target" value={targetText(c)} />
                <Fact icon={<IconTile icon={Clock} tone="sky" size="sm" />} label="Dates" value={`${formatDate(c.startDate, "d MMM")} – ${formatDate(c.endDate, "d MMM yyyy")}`} />
                <Fact icon={<IconTile icon={UsersRound} tone="violet" size="sm" />} label="Who can join" value={c.audienceLabel} />
                <Fact icon={<IconTile icon={Target} tone="amber" size="sm" />} label="Created by" value={c.createdBy} />
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardContent className="space-y-3 p-4 sm:p-5">
              <h2 className="font-heading text-base font-semibold">Rules</h2>
              <ul className="space-y-2.5">
                {[...c.rules, `Late-synced data counts for ${c.graceDays} days after the end date — results are final after that.`, "Only data recorded after you join counts towards your total."].map((r) => (
                  <li key={r} className="flex gap-2.5 text-sm">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="text-muted-foreground">{r}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card className="hidden gap-0 py-0 md:flex">
            <CardContent className="space-y-3 p-4 sm:p-5">{primary}</CardContent>
          </Card>

          <Card className="gap-0 overflow-hidden py-0">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Coins className="size-5" />
                </span>
                <div>
                  <p className="font-heading text-xl font-extrabold">+{c.points} points</p>
                  <p className="text-xs text-muted-foreground">{c.type === "team" ? "For every member of the winning group" : c.type === "leaderboard" ? "For the top 10 finishers" : c.type === "collaborative" ? "For everyone if the company goal is reached" : "When you reach the target"}</p>
                </div>
              </div>
              {c.rewardDetail ? (
                <Link href={`/employee-app/rewards/${c.rewardDetail.id}`} className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl text-2xl" style={{ background: `${c.rewardDetail.color}22` }}>
                    {c.rewardDetail.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <Gift className="size-3.5" /> Plus a reward
                    </p>
                    <p className="truncate text-sm font-semibold">{c.rewardDetail.name}</p>
                  </div>
                </Link>
              ) : null}
            </CardContent>
          </Card>

          {c.prizes ? <PrizesCard prizes={c.prizes} /> : null}

          <Card className="gap-0 py-0">
            <CardContent className="space-y-3 p-4 sm:p-5">
              <p className="text-sm font-semibold">Participants</p>
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {c.faces.map((f, i) => (
                    <UserAvatar key={i} name={f.masked ? "?" : f.name} color={f.color} className="ring-2 ring-card" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{formatNumber(c.participantsCount)}</span> of {formatNumber(c.eligibleCount)} eligible joined
                </p>
              </div>
              <Progress value={c.eligibleCount ? (c.participantsCount / c.eligibleCount) * 100 : 0} className="h-1.5" />
              {c.joined ? null : (
                <Button asChild variant="ghost" size="sm" className="-ml-2 text-primary">
                  <Link href={`/employee-app/challenges/${c.id}/leaderboard`}>View leaderboard →</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {c.phase === "upcoming" || c.phase === "warmup" || live ? <InviteCodeCard code={c.joinCode} challengeId={c.id} /> : null}

          {c.canLeave ? (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" className="h-10 text-muted-foreground hover:text-destructive" disabled={leave.isPending}>
                  {leave.isPending ? <Spinner /> : <LogOut data-icon="inline-start" />}
                  Leave challenge
                </Button>
              }
              title={`Leave ${c.name}?`}
              description="Your progress and position in this challenge will be removed. You can join again while it's open, but your progress will start again from zero."
              confirmLabel="Leave challenge"
              destructive
              onConfirm={() => leave.mutate({ id: c.id })}
            />
          ) : null}
        </div>
      </div>

      {/* Sticky action bar on phones (above the bottom tabs) */}
      <div className="sticky bottom-[4.75rem] z-20 -mx-1 md:hidden">
        <div className={cn("rounded-2xl border bg-background/95 p-2.5 shadow-xl backdrop-blur")}>{primary}</div>
      </div>

      <ConfirmDialog
        open={confirmJoin}
        onOpenChange={setConfirmJoin}
        title={`Join ${c.name}?`}
        description={
          c.phase === "upcoming" || c.phase === "warmup"
            ? `You'll be in from day one — scoring starts on ${formatDate(c.warmUp?.scoringStart ?? c.startDate, "d MMM")}. Progress syncs automatically from your phone.`
            : "Your progress starts counting from today. Activity from before you join doesn't count."
        }
        confirmLabel="Join challenge"
        onConfirm={() => join.mutate({ id: c.id })}
      />
    </EngagePage>
  )
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border p-3">
      {icon}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold break-words">{value}</p>
      </div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <EngagePage>
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-52 rounded-3xl" />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-60 rounded-xl" />
      </div>
    </EngagePage>
  )
}
