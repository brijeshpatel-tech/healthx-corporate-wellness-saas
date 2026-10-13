"use client"

import { ArrowLeft, Check, CircleDashed, Lock, Undo2 } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { ConfirmDialog } from "@/components/common/misc"
import { Confetti } from "@/components/employee/engage/celebration"
import { EngagePage, LoadError } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { challengesApi, type CheckInState } from "@/lib/api/employee/challenges"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** SCR-M-046 Custom Challenge Check-in. */
export default function CheckInPage() {
  const { id } = useParams<{ id: string }>()
  const q = useApiQuery(["employee", "challenge", id, "check-ins"], () => challengesApi.checkIns({ id }))
  return (
    <EngagePage size="narrow">
      <Link href={`/employee-app/challenges/${id}/progress`} className="-mb-2 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Progress
      </Link>
      {q.error ? (
        <LoadError title="Couldn't load check-ins." error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <>
          <Skeleton className="h-72 rounded-3xl" />
          <Skeleton className="h-48 rounded-xl" />
        </>
      ) : (
        <CheckIn s={q.data} />
      )}
    </EngagePage>
  )
}

function CheckIn({ s }: { s: CheckInState }) {
  const [celebrate, setCelebrate] = useState(0)
  const [backfill, setBackfill] = useState<string | null>(null)
  const checkIn = useApiMutation(challengesApi.checkIn, {
    success: (r) => (r.date === s.today ? "Checked in for today." : `Checked in for ${formatDate(r.date, "d MMM")}.`),
    onSuccess: (r) => {
      if (r.date === s.today) setCelebrate((n) => n + 1)
    },
  })
  const undo = useApiMutation(challengesApi.undoCheckIn, { success: "Check-in removed." })
  const pct = s.target ? Math.min(100, (s.total / s.target) * 100) : 0
  const todayRow = s.history.find((h) => h.date === s.today)

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl p-6 text-center text-white shadow-lg" style={{ background: `linear-gradient(160deg, ${s.coverColor}, ${s.coverColor}b0)` }}>
        {celebrate ? <Confetti key={celebrate} pieces={60} /> : null}
        <div className="bg-grid absolute inset-0 opacity-10" />
        <div className="relative flex flex-col items-center gap-3">
          <span className="text-5xl drop-shadow">{s.coverEmoji}</span>
          <div>
            <p className="text-sm font-medium text-white/85">{s.name}</p>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight">{s.label}</h1>
          </div>
          <p className="text-sm text-white/85">{formatDate(s.today, "EEEE, d MMMM")}</p>

          {s.open ? (
            s.todayDone ? (
              <div className="flex flex-col items-center gap-3">
                <span className="flex size-24 items-center justify-center rounded-full bg-white text-emerald-600 shadow-xl animate-in zoom-in-75">
                  <Check className="size-12" strokeWidth={3} />
                </span>
                <p className="font-semibold">You&apos;ve checked in today 🎉</p>
                {todayRow?.canUndo ? (
                  <Button variant="secondary" className="h-10 rounded-xl bg-white/20 text-white hover:bg-white/30" disabled={undo.isPending} onClick={() => undo.mutate({ id: s.challengeId, date: s.today })}>
                    {undo.isPending ? <Spinner /> : <Undo2 data-icon="inline-start" />} Undo
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <p className="max-w-xs text-base font-semibold">Did you complete today&apos;s goal?</p>
                <button
                  type="button"
                  onClick={() => checkIn.mutate({ id: s.challengeId })}
                  disabled={checkIn.isPending}
                  className="group flex size-28 items-center justify-center rounded-full border-4 border-white/60 bg-white/15 shadow-xl transition-all hover:scale-105 hover:bg-white/25 active:scale-95 disabled:opacity-60"
                  aria-label="Yes, check in for today"
                >
                  {checkIn.isPending ? <Spinner className="size-8" /> : <span className="font-heading text-xl font-extrabold">Yes ✓</span>}
                </button>
                <p className="text-xs text-white/80">One check-in per day · self-reported</p>
              </div>
            )
          ) : (
            <p className="mt-1 inline-flex items-center gap-2 rounded-xl bg-black/15 px-3 py-2 text-sm">
              <Lock className="size-4" /> {s.closedReason}
            </p>
          )}
        </div>
      </div>

      <Card className="gap-0 py-0">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold">Progress</p>
            <p className="text-sm">
              <span className="font-heading text-lg font-extrabold tabular-nums">{formatNumber(s.total)}</span>
              <span className="text-muted-foreground"> / {formatNumber(s.target)} days</span>
            </p>
          </div>
          <Progress value={pct} className="h-2.5" />
          <p className="text-xs text-muted-foreground">
            {formatDate(s.startDate, "d MMM")} – {formatDate(s.endDate, "d MMM")} · Missed a day? Tap it below to check in late (within the challenge dates).
          </p>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <h2 className="font-heading text-base font-semibold">Check-in history</h2>
          {s.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Your check-ins will appear here once the challenge starts.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {s.history.map((h) => {
                const canBackfill = s.open && !h.done && h.date !== s.today
                return (
                  <button
                    key={h.date}
                    type="button"
                    disabled={!canBackfill}
                    onClick={() => setBackfill(h.date)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-xs transition-colors",
                      h.done ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "text-muted-foreground",
                      h.date === s.today && "ring-2 ring-primary/40",
                      canBackfill && "hover:border-primary hover:bg-primary/5",
                    )}
                    aria-label={`${formatDate(h.date, "d MMM")}: ${h.done ? "checked in" : "not checked in"}`}
                  >
                    <span className="font-medium">{formatDate(h.date, "EEE")}</span>
                    {h.done ? <Check className="size-4" strokeWidth={3} /> : <CircleDashed className="size-4" />}
                    <span className="tabular-nums">{formatDate(h.date, "d MMM")}</span>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!backfill}
        onOpenChange={(o) => !o && setBackfill(null)}
        title={`Check in for ${backfill ? formatDate(backfill, "EEEE, d MMM") : ""}?`}
        description="Only check in if you really completed the goal that day — check-ins are self-reported."
        confirmLabel="Check in"
        onConfirm={() => backfill && checkIn.mutate({ id: s.challengeId, date: backfill })}
      />
    </>
  )
}
