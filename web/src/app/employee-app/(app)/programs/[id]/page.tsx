"use client"

import { ArrowLeft, Ban, Building2, CalendarRange, CircleCheckBig, Coins, FileX, LogOut, ShieldCheck, Sparkles, Trophy, Users } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { ProgressRing } from "@/components/common/charts"
import { ConfirmDialog } from "@/components/common/misc"
import { EmptyState } from "@/components/common/states"
import { PhaseBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { CelebrationDialog } from "@/components/employee/engage/celebration"
import { WeekCard, dateRange } from "@/components/employee/engage/grow/programs"
import { EngagePage, LoadError } from "@/components/employee/engage/page"
import { ApiError } from "@/lib/api/core"
import { programsApi, type ProgramDetail } from "@/lib/api/employee/programs"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber, formatShortDate } from "@/lib/format"

/** SCR-M-065 Program Detail & Progress. Phase 2. */
export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>()
  const q = useApiQuery(["employee", "programs", "detail", id], () => programsApi.get({ id }), { retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2 })

  return (
    <EngagePage size="wide">
      <Button asChild variant="link" size="sm" className="-mb-2 -ml-1 h-auto self-start px-1 text-muted-foreground hover:text-foreground">
        <Link href="/employee-app/programs">
          <ArrowLeft data-icon="inline-start" />
          Programs
        </Link>
      </Button>
      {q.error ? (
        q.error.status === 404 ? (
          <EmptyState
            icon={FileX}
            title="This program isn't available."
            description="It may have ended or isn't open to you."
            action={
              <Button asChild className="h-10 rounded-xl">
                <Link href="/employee-app/programs">See all programs</Link>
              </Button>
            }
          />
        ) : (
          <LoadError title="Couldn't load this program." error={q.error} onRetry={() => q.refetch()} />
        )
      ) : !q.data ? (
        <DetailSkeleton />
      ) : (
        <Detail program={q.data} />
      )}
    </EngagePage>
  )
}

function Detail({ program: p }: { program: ProgramDetail }) {
  const [dismissed, setDismissed] = useState(false)
  const ack = useApiMutation(programsApi.acknowledgeCompletion, { invalidate: false })
  const tracking = p.enrolled
  const range = dateRange(p.startDate, p.endDate)

  const closeCelebration = () => {
    setDismissed(true)
    ack.mutate({ id: p.id })
  }

  return (
    <>
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-3xl p-5 text-white shadow-lg sm:p-7"
        style={{ background: `radial-gradient(90% 120% at 100% 0%, ${p.coverColor}70, transparent 60%), linear-gradient(135deg, ${p.coverColor}, ${p.coverColor}c4 60%, ${p.coverColor}99)`, boxShadow: `0 16px 40px -18px ${p.coverColor}` }}
      >
        <div className="bg-grid absolute inset-0 opacity-10" aria-hidden />
        <span className="pointer-events-none absolute -right-2 -bottom-6 text-[8rem] leading-none opacity-30 select-none sm:right-6 sm:bottom-auto sm:top-4 sm:text-[9rem] sm:opacity-90 sm:drop-shadow-xl" aria-hidden>
          {p.coverEmoji}
        </span>
        <div className="relative max-w-2xl space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-black/25 px-2.5 text-[11px] font-semibold backdrop-blur">
              {p.kind === "company" ? <Building2 className="size-3" /> : <Sparkles className="size-3" />}
              {p.kind === "company" ? `${p.companyName ?? "Company"} program` : "HealthX · self-paced"}
            </span>
            <PhaseBadge phase={2} className="bg-white/90 text-violet-700" />
          </div>
          <h1 className="font-heading text-2xl leading-tight font-extrabold tracking-tight text-balance sm:text-3xl">{p.name}</h1>
          <p className="text-sm text-white/90 sm:text-base">{p.description}</p>
          <div className="flex flex-wrap gap-2 pt-1 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5">
              <CalendarRange className="size-3.5" /> {p.durationWeeks} weeks{range ? ` · ${range}` : ""}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5">
              <Users className="size-3.5" /> {formatNumber(p.enrolledCount)} joined
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5">
              <Coins className="size-3.5" /> {formatNumber(p.completionPoints)} pts on completion
            </span>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <aside className="space-y-3 lg:sticky lg:top-20 lg:order-2">
          <SummaryCard program={p} />
          <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            Only you can see your progress. Your company only sees how many people joined and finished.
          </p>
        </aside>

        <section className="space-y-3 lg:order-1">
          <div className="flex items-end justify-between gap-2 px-1">
            <div>
              <h2 className="font-heading text-lg font-bold">{tracking ? "Your weekly goals" : "What you'll do each week"}</h2>
              <p className="text-xs text-muted-foreground">
                {tracking ? "Progress updates from your Activity, Water, Workouts and Sleep data. Tap a goal to open it." : "Weeks unlock in order. Your tracked data counts automatically once you join."}
              </p>
            </div>
          </div>
          {p.weeks.map((w) => (
            <WeekCard key={w.week} week={w} tracking={tracking} selfPaced={p.kind === "healthx"} />
          ))}
        </section>
      </div>

      <CelebrationDialog
        open={p.celebrate && !dismissed}
        onOpenChange={(open) => (!open ? closeCelebration() : undefined)}
        emoji={p.coverEmoji}
        color={p.coverColor}
        eyebrow="Program complete"
        title="You did it! 🎉"
        description={`You completed every weekly goal of ${p.name}.`}
        points={p.pointsAwarded}
      >
        <Button asChild className="h-10 rounded-xl px-5">
          <Link href="/employee-app/wallet" onClick={closeCelebration}>
            See my points
          </Link>
        </Button>
        <Button variant="outline" className="h-10 rounded-xl px-5" onClick={closeCelebration}>
          Done
        </Button>
      </CelebrationDialog>
    </>
  )
}

function SummaryCard({ program: p }: { program: ProgramDetail }) {
  const [leaveOpen, setLeaveOpen] = useState(false)
  const join = useApiMutation(programsApi.enrol, { success: (r) => `You've joined the ${r.name}.`, errorTitle: "Couldn't join" })
  const leave = useApiMutation(programsApi.leave, { success: "You've left the program." })
  const pct = Math.round(p.progress * 100)

  if (p.enrolled) {
    return (
      <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-xs">
        <div className="flex items-center gap-4">
          <ProgressRing value={pct} size={112} stroke={11} color={p.achieved ? "#10b981" : p.coverColor}>
            <span className="font-heading text-2xl font-extrabold tabular-nums">{pct}%</span>
            <span className="text-[11px] text-muted-foreground">overall</span>
          </ProgressRing>
          <div className="min-w-0 space-y-2 text-sm">
            {p.achieved ? (
              <p className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                <CircleCheckBig className="size-4" /> Completed
              </p>
            ) : (
              <p className="font-heading text-lg font-bold">{p.currentWeek ? `Week ${p.currentWeek} of ${p.durationWeeks}` : `Starts ${p.startDate ? formatShortDate(p.startDate) : "soon"}`}</p>
            )}
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">
                {p.goalsDone} of {p.goalsTotal}
              </span>{" "}
              goals done
            </p>
            {p.enrolledAt ? <p className="text-xs text-muted-foreground">Joined {formatDate(p.enrolledAt)}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-amber-500/10 px-3.5 py-3">
          <Trophy className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm">
            {p.achieved ? (
              <>
                You earned <span className="font-bold">{formatNumber(p.pointsAwarded || p.completionPoints)} points</span>
                {p.completedAt ? ` on ${formatDate(p.completedAt)}` : ""}.
              </>
            ) : (
              <>
                Finish every weekly goal to earn <span className="font-bold">{formatNumber(p.completionPoints)} points</span>.
              </>
            )}
          </p>
        </div>
        {p.achieved ? (
          <Button asChild variant="outline" className="h-11 w-full rounded-xl">
            <Link href="/employee-app/wallet">See my points</Link>
          </Button>
        ) : (
          <>
            <Button variant="outline" className="h-11 w-full rounded-xl text-destructive hover:text-destructive" onClick={() => setLeaveOpen(true)} disabled={leave.isPending}>
              {leave.isPending ? <Spinner data-icon="inline-start" /> : <LogOut data-icon="inline-start" />}
              Leave program
            </Button>
            <ConfirmDialog
              open={leaveOpen}
              onOpenChange={setLeaveOpen}
              title="Leave this program?"
              description="Your progress will stop being tracked here. You can join again later while the program is open."
              confirmLabel="Leave program"
              destructive
              onConfirm={() => leave.mutate({ id: p.id })}
            />
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-xs">
      <div className="space-y-1">
        <h2 className="font-heading text-lg font-bold">Join this program</h2>
        <p className="text-sm text-muted-foreground">
          {p.kind === "healthx"
            ? `Self-paced — your ${p.durationWeeks} weeks start the day you join.`
            : p.startDate && p.currentWeek > 0
              ? `Runs ${dateRange(p.startDate, p.endDate)}. It's in week ${p.currentWeek} — your tracked data from the start counts.`
              : `Starts ${p.startDate ? formatDate(p.startDate) : "soon"} and runs for ${p.durationWeeks} weeks.`}
        </p>
      </div>
      <ul className="space-y-2 text-sm">
        <li className="flex items-start gap-2">
          <CircleCheckBig className="mt-0.5 size-4 shrink-0 text-primary" /> A clear goal for every week
        </li>
        <li className="flex items-start gap-2">
          <CircleCheckBig className="mt-0.5 size-4 shrink-0 text-primary" /> Progress tracked from your steps, water, workouts and sleep
        </li>
        <li className="flex items-start gap-2">
          <CircleCheckBig className="mt-0.5 size-4 shrink-0 text-primary" /> {formatNumber(p.completionPoints)} points when you finish
        </li>
      </ul>
      {p.eligible ? (
        <Button className="h-12 w-full rounded-xl text-base" onClick={() => join.mutate({ id: p.id })} disabled={join.isPending}>
          {join.isPending ? <Spinner data-icon="inline-start" /> : null}
          Join program
        </Button>
      ) : null}
      {!p.eligible || join.error ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-sm" role="alert">
          <Ban className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">You can&apos;t join this program.</p>
            <p className="text-xs text-muted-foreground">{p.ineligibleReason ?? (join.error && join.error.message !== "You can't join this program." ? join.error.message : "It isn't open to you right now.")}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <>
      <Skeleton className="h-56 rounded-3xl" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-56 rounded-2xl lg:order-2" />
        <div className="space-y-3 lg:order-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      </div>
    </>
  )
}
