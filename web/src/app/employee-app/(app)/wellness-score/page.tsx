"use client"

import { Activity, ArrowDownRight, ArrowUpRight, Brain, ChevronRight, Droplets, Dumbbell, HeartPulse, Info, ListChecks, Moon, ShieldAlert, Sparkles, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { ProgressRing, TrendChart } from "@/components/common/charts"
import { EmptyState, ErrorState } from "@/components/common/states"
import { PhaseBadge } from "@/components/common/status-badge"
import { IconBubble, Segmented, TrackHeader, TrackPage, type Tone } from "@/components/employee/track/track-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { wellnessScoreApi, type ScoreComponentKey, type WellnessScoreDetail } from "@/lib/api/employee/score"
import { useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatShortDate } from "@/lib/format"
import { cn } from "@/lib/utils"

const ICON: Record<ScoreComponentKey, { icon: LucideIcon; tone: Tone; bar: string }> = {
  activity: { icon: Activity, tone: "sky", bar: "bg-sky-500" },
  sleep: { icon: Moon, tone: "indigo", bar: "bg-indigo-500" },
  hydration: { icon: Droplets, tone: "cyan", bar: "bg-cyan-500" },
  exercise: { icon: Dumbbell, tone: "violet", bar: "bg-violet-500" },
  habits: { icon: ListChecks, tone: "emerald", bar: "bg-emerald-500" },
  mindfulness: { icon: Brain, tone: "teal", bar: "bg-teal-500" },
}

const DISCLAIMER = "This is a wellness engagement score, not a medical assessment."

/** SCR-M-019 Wellness Score Detail. */
export default function WellnessScorePage() {
  const [period, setPeriod] = useState<"7d" | "30d">("7d")
  const [info, setInfo] = useState(false)
  const q = useApiQuery(["employee", "wellness-score", period], () => wellnessScoreApi.get({ period }))

  return (
    <TrackPage>
      <TrackHeader
        title="Wellness Score"
        subtitle="How your everyday habits add up"
        actions={
          <Button variant="outline" className="h-10" onClick={() => setInfo(true)}>
            <Info data-icon="inline-start" /> How it&apos;s calculated
          </Button>
        }
      />

      {q.error ? (
        <ErrorState error={new Error("Score unavailable right now.")} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <ScoreSkeleton />
      ) : !q.data.hasData ? (
        <EmptyState
          icon={HeartPulse}
          title="Your score appears after your first full day of activity."
          description="Keep your phone with you, log water and try a workout — we'll calculate your first score overnight."
          action={
            <Button asChild>
              <Link href="/employee-app/activity">Go to activity</Link>
            </Button>
          }
        />
      ) : (
        <Score data={q.data} period={period} setPeriod={setPeriod} />
      )}

      <Disclaimer />
      <HowItWorks open={info} onOpenChange={setInfo} data={q.data} />
    </TrackPage>
  )
}

function Score({ data, period, setPeriod }: { data: WellnessScoreDetail; period: "7d" | "30d"; setPeriod: (p: "7d" | "30d") => void }) {
  const label = data.total >= 80 ? "Excellent" : data.total >= 65 ? "Good" : data.total >= 50 ? "Fair" : "Building up"
  const sorted = [...data.components].sort((a, b) => a.value - b.value)
  const focus = sorted.find((c) => c.phase === 1) ?? sorted[0]!
  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-600 py-0 text-white shadow-lg shadow-emerald-500/20">
          <div className="bg-grid absolute inset-0 opacity-10" />
          <CardContent className="relative flex flex-col items-center gap-4 p-6 text-center">
            <ProgressRing value={data.total} size={184} stroke={15} color="white" trackColor="rgba(255,255,255,0.22)">
              <span className="font-heading text-5xl font-extrabold tabular-nums">{data.total}</span>
              <span className="text-sm text-white/80">of 100</span>
            </ProgressRing>
            <div className="space-y-1">
              <p className="text-xl font-bold">{label}</p>
              <p className="inline-flex items-center gap-1 rounded-full bg-white/18 px-3 py-1 text-sm font-semibold">
                {data.change >= 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                {data.change >= 0 ? "+" : ""}
                {data.change} vs {period === "7d" ? "last week" : "30 days ago"}
              </p>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 text-left">
              <div className="rounded-xl bg-white/14 px-3 py-2">
                <p className="text-[11px] text-white/80">{period === "7d" ? "7-day" : "30-day"} average</p>
                <p className="text-lg font-bold tabular-nums">{data.periodAverage}</p>
              </div>
              <div className="rounded-xl bg-white/14 px-3 py-2">
                <p className="text-[11px] text-white/80">Best day</p>
                <p className="text-lg font-bold tabular-nums">
                  {data.best?.total ?? "—"} <span className="text-xs font-medium text-white/80">{data.best ? formatShortDate(data.best.date) : ""}</span>
                </p>
              </div>
            </div>
            <p className="text-[11px] text-white/75">Updated {formatDate(data.date, "EEE d MMM")}</p>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Score trend</p>
                <p className="text-xs text-muted-foreground">Daily score, last {period === "7d" ? "7" : "30"} days</p>
              </div>
              <Segmented
                ariaLabel="Period"
                value={period}
                onChange={setPeriod}
                options={[
                  { value: "7d", label: "7 days" },
                  { value: "30d", label: "30 days" },
                ]}
              />
            </div>
            <TrendChart
              height={230}
              data={data.history}
              series={[{ key: "total", label: "Wellness Score" }]}
              yDomain={[Math.max(0, Math.min(...data.history.map((h) => h.total)) - 10), 100]}
              xFormatter={(d) => new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", period === "7d" ? { weekday: "short" } : { day: "numeric", month: "short" })}
              tooltipLabelFormatter={(d) => formatDate(d, "EEE d MMM")}
            />
            <div className="flex items-start gap-3 rounded-xl bg-primary/8 p-3">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-sm">
                <span className="font-semibold">Biggest opportunity: {focus.label.toLowerCase()}.</span> <span className="text-muted-foreground">{focus.tip}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="font-semibold">What makes up your score</h2>
          <p className="text-xs text-muted-foreground">Weight · today</p>
        </div>
        <Card className="gap-0 py-0">
          <CardContent className="divide-y p-0">
            {data.components.map((c) => {
              const meta = ICON[c.key]
              return (
                <Link key={c.key} href={c.href} className="group flex items-start gap-3 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-5">
                  <IconBubble icon={meta.icon} tone={meta.tone} />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        {c.label}
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground tabular-nums">{c.weight}%</span>
                        {c.phase === 2 ? <PhaseBadge phase={2} /> : null}
                      </p>
                      <p className="text-sm font-bold tabular-nums">
                        {c.value}
                        <span className="text-xs font-medium text-muted-foreground">/100</span>
                      </p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full transition-all duration-700", meta.bar)} style={{ width: `${c.value}%` }} />
                    </div>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="text-xs text-muted-foreground">{c.tip}</p>
                      <p className="text-[11px] whitespace-nowrap text-muted-foreground tabular-nums">
                        adds {c.contribution} pts · avg {c.average}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="mt-2.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              )
            })}
          </CardContent>
        </Card>
      </section>
    </>
  )
}

function Disclaimer() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3.5 py-3 text-xs text-amber-900 dark:text-amber-200" role="note">
      <ShieldAlert className="mt-0.5 size-4 shrink-0" />
      <p>
        <strong>{DISCLAIMER}</strong> It reflects how engaged you are with healthy habits in HealthX. For any health concerns, please talk to a doctor. Your score is private — your employer never sees it.
      </p>
    </div>
  )
}

function HowItWorks({ open, onOpenChange, data }: { open: boolean; onOpenChange: (o: boolean) => void; data?: WellnessScoreDetail }) {
  const comps = data?.components ?? []
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How your score is calculated</DialogTitle>
          <DialogDescription>Your Wellness Score (0–100) combines six parts of your day. Each part is scored 0–100 and weighted:</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {(comps.length ? comps.map((c) => ({ key: c.key, label: c.label, weight: c.weight, phase: c.phase })) : DEFAULT_WEIGHTS).map((c) => {
            const meta = ICON[c.key]
            return (
              <li key={c.key} className="flex items-center gap-3">
                <IconBubble icon={meta.icon} tone={meta.tone} size="sm" />
                <span className="flex-1 text-sm font-medium">
                  {c.label} {c.phase === 2 ? <PhaseBadge phase={2} className="ml-1" /> : null}
                </span>
                <span className="text-sm font-bold tabular-nums">{c.weight}%</span>
              </li>
            )
          })}
        </ul>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Activity uses your steps vs goal, Hydration your water vs goal, Exercise your workouts and active minutes, and Habits your daily check-ins. Sleep and Mindfulness are added in Phase 2.</p>
          <p>Missing data (for example no sleep tracked) uses your recent average so one gap doesn&apos;t drop your score.</p>
          {data ? <p className="text-xs">Weights version {data.configVersion} · updated {formatDate(data.configUpdatedAt)}</p> : null}
        </div>
        <p className="rounded-lg bg-amber-500/10 p-2.5 text-xs font-medium text-amber-900 dark:text-amber-200">{DISCLAIMER}</p>
      </DialogContent>
    </Dialog>
  )
}

const DEFAULT_WEIGHTS: { key: ScoreComponentKey; label: string; weight: number; phase: 1 | 2 }[] = [
  { key: "activity", label: "Activity", weight: 25, phase: 1 },
  { key: "sleep", label: "Sleep", weight: 20, phase: 2 },
  { key: "hydration", label: "Hydration", weight: 15, phase: 1 },
  { key: "exercise", label: "Exercise", weight: 20, phase: 1 },
  { key: "habits", label: "Habits", weight: 10, phase: 1 },
  { key: "mindfulness", label: "Mindfulness", weight: 10, phase: 2 },
]

function ScoreSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Skeleton className="h-[420px] rounded-xl" />
        <Skeleton className="h-[420px] rounded-xl" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}
