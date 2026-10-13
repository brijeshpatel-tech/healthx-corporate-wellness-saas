"use client"

import { ArrowRight, ChevronRight, Droplets, Dumbbell, Footprints, PartyPopper, Timer, Trophy, Watch } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ProgressRing } from "@/components/common/charts"
import { Confetti } from "@/components/employee/track/celebration"
import { OnboardingFrame, OnboardingGate, useOnboardingState } from "@/components/employee/track/onboarding-frame"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { onboardingApi, type Baseline } from "@/lib/api/employee/onboarding"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { HOME_PATH, useAuthStore } from "@/lib/auth/session"
import { formatMl, formatNumber } from "@/lib/format"

/** SCR-M-017 Wellness Baseline (Onboarding complete). */
export default function BaselinePage() {
  const state = useOnboardingState()
  return (
    <OnboardingFrame title={null}>
      <OnboardingGate query={state}>{() => <Done />}</OnboardingGate>
    </OnboardingFrame>
  )
}

function Done() {
  const router = useRouter()
  const updateSession = useAuthStore((s) => s.updateSession)
  const q = useApiQuery(["employee", "baseline"], () => onboardingApi.baseline(), { retry: 1 })
  const [target, setTarget] = useState<string | null>(null)
  const complete = useApiMutation(onboardingApi.complete, {
    errorTitle: "Couldn't finish set-up",
    onSuccess: () => {
      updateSession("employee", { onboardingCompleted: true })
      router.replace(target ?? HOME_PATH.employee)
    },
  })
  const go = (href: string) => {
    setTarget(href)
    complete.mutate()
  }
  const b = q.data

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="relative flex flex-col items-center gap-3 pt-2 text-center">
        <Confetti />
        <span className="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-xl shadow-emerald-500/30 animate-in duration-500 zoom-in-50">
          <PartyPopper className="size-10" />
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight">You&apos;re all set{b ? `, ${b.firstName}` : ""}!</h1>
        <p className="text-muted-foreground">Here&apos;s your starting point. Small steps every day move it up.</p>
      </div>

      {q.isLoading ? (
        <Skeleton className="h-52 rounded-3xl" />
      ) : !b ? (
        <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">Your baseline isn&apos;t available right now — you can still go to Home.</p>
      ) : b.hasData ? (
        <BaselineCard b={b} />
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed bg-card/60 p-6 text-center">
          <Watch className="size-8 text-muted-foreground" />
          <p className="font-semibold">We&apos;ll show your baseline after a few days of activity.</p>
          <p className="text-sm text-muted-foreground">{b.healthConnected ? "Keep your phone with you — steps sync automatically." : "Connect Apple Health or Health Connect from Profile to sync steps automatically."}</p>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-semibold">Great first steps</p>
        {b?.suggestedChallenge ? (
          <Suggestion emoji={b.suggestedChallenge.emoji} color={b.suggestedChallenge.color} title={`Join "${b.suggestedChallenge.name}"`} hint={`+${b.suggestedChallenge.points} points when you finish`} onClick={() => go(`/employee-app/challenges/${b.suggestedChallenge!.id}`)} />
        ) : null}
        <Suggestion icon={<Droplets className="size-5 text-cyan-600" />} title="Set your water goal" hint={b ? `Currently ${formatMl(b.waterGoalMl)} a day` : "Stay hydrated with smart reminders"} onClick={() => go("/employee-app/water/settings")} />
        <Suggestion icon={<Dumbbell className="size-5 text-violet-600" />} title="Try a 7-minute workout" hint="Earn your First Workout badge" onClick={() => go("/employee-app/workouts")} />
      </div>

      <div className="mt-auto grid gap-2 pt-2">
        <Button className="h-12 text-base" onClick={() => go(HOME_PATH.employee)} disabled={complete.isPending}>
          {complete.isPending && target === HOME_PATH.employee ? <Spinner /> : null} Go to Home <ArrowRight data-icon="inline-end" />
        </Button>
        <Button variant="outline" className="h-11" onClick={() => go("/employee-app/challenges")} disabled={complete.isPending}>
          <Trophy data-icon="inline-start" /> Browse challenges
        </Button>
      </div>
    </div>
  )
}

function BaselineCard({ b }: { b: Baseline }) {
  return (
    <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="flex items-center gap-4 bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-600 p-5 text-white">
        <ProgressRing value={b.score ?? 0} size={96} stroke={9} color="white" trackColor="rgba(255,255,255,0.25)">
          <span className="font-heading text-3xl font-extrabold tabular-nums">{b.score ?? "—"}</span>
        </ProgressRing>
        <div>
          <p className="text-sm text-white/85">Your first Wellness Score</p>
          <p className="text-lg font-bold">Baseline from {b.syncedDays} days of data</p>
          <p className="text-xs text-white/80">A wellness engagement score, not a medical assessment.</p>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x p-1">
        {[
          { icon: Footprints, label: "Typical steps", value: b.typicalSteps ? formatNumber(b.typicalSteps) : "—" },
          { icon: Timer, label: "Active min/day", value: b.activeMinutes ?? "—" },
          { icon: Trophy, label: "Your step goal", value: formatNumber(b.stepGoal) },
        ].map((s) => (
          <div key={s.label} className="flex flex-col items-center gap-1 p-3 text-center">
            <s.icon className="size-4 text-muted-foreground" />
            <p className="text-base font-bold tabular-nums">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function Suggestion({ emoji, color, icon, title, hint, onClick }: { emoji?: string; color?: string; icon?: React.ReactNode; title: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-colors hover:bg-muted/40">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: color ? `${color}22` : "var(--muted)" }}>
        {emoji ?? icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{hint}</p>
      </div>
      <ChevronRight className="size-4 text-muted-foreground" />
    </button>
  )
}
