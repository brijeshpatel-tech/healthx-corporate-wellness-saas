"use client"

import { ArrowRight, CalendarCheck, Check, ChevronRight, Droplets, Dumbbell, Footprints, Lightbulb, Moon, Sparkles, ThumbsDown, ThumbsUp, TrendingDown, TrendingUp } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { EmptyState, ErrorState } from "@/components/common/states"
import { PhaseBadge } from "@/components/common/status-badge"
import { IconBubble, PeriodNavigator, TrackHeader, TrackPage } from "@/components/employee/track/track-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { weeklySummaryApi, type WeeklySummaryDetail, type WeeklySummaryList } from "@/lib/api/employee/score"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatCompact, formatDate, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

const range = (w: WeeklySummaryDetail) => `${formatDate(w.weekStart, "d MMM")} – ${formatDate(w.weekEnd, "d MMM")}`

/** SCR-M-020 Weekly Wellness Summary & Insight. */
export default function WeeklySummaryPage() {
  const q = useApiQuery(["employee", "weekly-summary"], () => weeklySummaryApi.list())
  const [index, setIndex] = useState(0)

  return (
    <TrackPage>
      <TrackHeader title="Weekly summary" subtitle="Your week at a glance — what you did and what to try next" backHref="/employee-app/home" backLabel="Home" />
      {q.error ? (
        <ErrorState error={new Error("Summary unavailable.")} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <Skeleton className="h-[460px] rounded-xl" />
          <Skeleton className="h-[460px] rounded-xl" />
        </div>
      ) : q.data.weeks.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="Your first weekly summary will be ready next Monday."
          description={`We'll recap your steps, workouts and hydration every week. Next summary: ${formatDate(q.data.nextSummaryOn, "EEEE d MMM")}.`}
        />
      ) : (
        <Summary data={q.data} index={Math.min(index, q.data.weeks.length - 1)} setIndex={setIndex} />
      )}
    </TrackPage>
  )
}

function Summary({ data, index, setIndex }: { data: WeeklySummaryList; index: number; setIndex: (i: number) => void }) {
  const week = data.weeks[index]!
  const maxSteps = Math.max(...week.days.map((d) => Math.max(d.steps, d.goal)))
  return (
    <>
      <PeriodNavigator
        className="sm:max-w-sm"
        label={range(week)}
        sublabel={week.isCurrent ? "This week (so far)" : index === 1 ? "Last week" : `${index} weeks ago`}
        onPrev={() => setIndex(index + 1)}
        onNext={() => setIndex(index - 1)}
        prevDisabled={index >= data.weeks.length - 1}
        nextDisabled={index === 0}
      />

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card className="gap-0 overflow-hidden py-0">
          <div className="bg-gradient-to-br from-violet-500 to-fuchsia-500 p-5 text-white">
            <p className="flex items-center gap-2 text-sm font-medium text-white/85">
              <Sparkles className="size-4" /> Weekly HealthX Insight
            </p>
            <p className="mt-1 text-2xl font-extrabold">You completed</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3">
              {[
                { icon: Dumbbell, text: `${week.workouts} workout${week.workouts === 1 ? "" : "s"}` },
                { icon: Footprints, text: `${formatNumber(week.steps)} steps` },
                { icon: Droplets, text: `${week.hydrationGoalsHit}/7 hydration goals` },
              ].map((i) => (
                <li key={i.text} className="flex items-center gap-2 rounded-xl bg-white/16 px-3 py-2 text-sm font-semibold">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-violet-600">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  {i.text}
                </li>
              ))}
            </ul>
          </div>
          <CardContent className="space-y-5 p-5">
            <div className="grid grid-cols-3 gap-2">
              <Mini label="Active days" value={`${week.activeDays}/7`} />
              <Mini label="Step goal days" value={`${week.stepGoalDays}/7`} />
              <Mini
                label="Score change"
                value={
                  <span className={cn("inline-flex items-center gap-0.5", week.scoreChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                    {week.scoreChange >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                    {week.scoreChange >= 0 ? "+" : ""}
                    {week.scoreChange}
                  </span>
                }
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Day by day</p>
              <div className="grid grid-cols-7 gap-1.5" role="img" aria-label="Steps per day with water and workout markers">
                {week.days.map((d) => {
                  const met = d.steps >= d.goal
                  return (
                    <div key={d.date} className="flex flex-col items-center gap-1.5" title={`${formatNumber(d.steps)} steps`}>
                      <div className="flex h-24 w-full items-end justify-center rounded-lg bg-muted/50 px-1.5 pb-1">
                        <div className={cn("w-full max-w-5 rounded-t-[4px]", met ? "bg-primary" : "bg-primary/35")} style={{ height: `${Math.max(4, (d.steps / maxSteps) * 100)}%` }} />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{formatCompact(d.steps)}</span>
                      <div className="flex gap-0.5">
                        <Droplets className={cn("size-3", d.waterMet ? "text-cyan-500" : "text-muted-foreground/30")} aria-label={d.waterMet ? "Water goal met" : "Water goal missed"} />
                        <Dumbbell className={cn("size-3", d.workout ? "text-violet-500" : "text-muted-foreground/30")} aria-label={d.workout ? "Workout done" : "No workout"} />
                      </div>
                      <span className="text-[11px] text-muted-foreground">{new Date(`${d.date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "narrow" })}</span>
                    </div>
                  )
                })}
              </div>
              <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="size-2.5 rounded-[3px] bg-primary" /> Step goal met
                </span>
                <span className="inline-flex items-center gap-1">
                  <Droplets className="size-3 text-cyan-500" /> Water goal
                </span>
                <span className="inline-flex items-center gap-1">
                  <Dumbbell className="size-3 text-violet-500" /> Workout
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-3">
              <IconBubble icon={Moon} tone="indigo" size="sm" />
              <p className="flex-1 text-sm">
                Average sleep <span className="font-semibold">{week.avgSleepHours.toFixed(1)} h</span>
              </p>
              <PhaseBadge phase={2} />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-5">
          <InsightCard data={data} week={week} />
          <Card className="gap-0 py-0">
            <CardContent className="space-y-2 p-4 sm:p-5">
              <p className="font-semibold">Previous weeks</p>
              <ul className="divide-y">
                {data.weeks.map((w, i) => (
                  <li key={w.weekStart}>
                    <button type="button" onClick={() => setIndex(i)} className={cn("flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted/50", i === index && "bg-primary/8")}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{range(w)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatNumber(w.steps)} steps · {w.workouts} workouts · {w.hydrationGoalsHit}/7 water
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

function InsightCard({ data, week }: { data: WeeklySummaryList; week: WeeklySummaryDetail }) {
  const enable = useApiMutation(weeklySummaryApi.enableAiInsights, { success: "AI insights turned on" })
  const feedback = useApiMutation(weeklySummaryApi.feedback, { success: "Thanks for the feedback" })
  if (!data.aiInsights.enabledByCompany) return null
  if (!week.insight)
    return (
      <Card className="gap-0 py-0">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <IconBubble icon={Lightbulb} tone="violet" size="sm" />
            <p className="flex-1 font-semibold">Personal insight</p>
            <PhaseBadge phase={2} />
          </div>
          <p className="text-sm text-muted-foreground">Turn on AI personalisation to get a weekly opportunity and a tailored recommendation based on your data. Only you see it — you can turn it off any time in Privacy settings.</p>
          <Button onClick={() => enable.mutate({ key: "ai_personalisation", granted: true })} disabled={enable.isPending}>
            {enable.isPending ? <Spinner /> : <Sparkles data-icon="inline-start" />} Turn on AI insights
          </Button>
        </CardContent>
      </Card>
    )
  const i = week.insight
  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <IconBubble icon={Lightbulb} tone="violet" size="sm" />
          <p className="flex-1 font-semibold">Personal insight</p>
          <PhaseBadge phase={2} />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Opportunity</p>
          <p className="text-sm">{i.opportunity}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Recommendation</p>
          <p className="text-sm font-semibold text-primary">{i.recommendation}</p>
        </div>
        <Button asChild className="w-full">
          <Link href={i.actionHref}>
            {i.actionLabel} <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">Was this helpful?</p>
          <div className="flex gap-1">
            <Button variant={i.feedback === "helpful" ? "secondary" : "ghost"} size="icon" aria-label="Helpful" aria-pressed={i.feedback === "helpful"} onClick={() => feedback.mutate({ weekStart: week.weekStart, value: "helpful" })}>
              <ThumbsUp className={cn(i.feedback === "helpful" && "text-primary")} />
            </Button>
            <Button variant={i.feedback === "not_helpful" ? "secondary" : "ghost"} size="icon" aria-label="Not helpful" aria-pressed={i.feedback === "not_helpful"} onClick={() => feedback.mutate({ weekStart: week.weekStart, value: "not_helpful" })}>
              <ThumbsDown className={cn(i.feedback === "not_helpful" && "text-rose-500")} />
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">General wellness suggestions, not medical advice.</p>
      </CardContent>
    </Card>
  )
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-2.5 text-center">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}
