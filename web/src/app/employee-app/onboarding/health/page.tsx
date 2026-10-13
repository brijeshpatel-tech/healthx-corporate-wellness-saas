"use client"

import { Activity, ArrowRight, Check, ExternalLink, HeartPulse, Lock, Smartphone } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useSyncExternalStore } from "react"
import { toast } from "sonner"
import { PhaseBadge } from "@/components/common/status-badge"
import { OnboardingFrame, OnboardingGate, useOnboardingState } from "@/components/employee/track/onboarding-frame"
import { Segmented } from "@/components/employee/track/track-ui"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { onboardingApi, type OnboardingState } from "@/lib/api/employee/onboarding"
import { useApiMutation } from "@/lib/api/hooks"
import { cn } from "@/lib/utils"

type Provider = "apple_health" | "health_connect"
const PROVIDERS: Record<Provider, { name: string; os: string; types: { key: string; label: string; phase?: 2 }[] }> = {
  apple_health: {
    name: "Apple Health",
    os: "iPhone",
    types: [
      { key: "Steps", label: "Steps" },
      { key: "Distance", label: "Walking + running distance" },
      { key: "Active energy", label: "Active energy" },
      { key: "Active minutes", label: "Exercise minutes" },
      { key: "Workouts", label: "Workouts" },
      { key: "Sleep", label: "Sleep", phase: 2 },
    ],
  },
  health_connect: {
    name: "Health Connect",
    os: "Android",
    types: [
      { key: "Steps", label: "Steps" },
      { key: "Distance", label: "Distance" },
      { key: "Active calories", label: "Active calories burned" },
      { key: "Active minutes", label: "Exercise sessions & minutes" },
      { key: "Workouts", label: "Workouts" },
      { key: "Sleep", label: "Sleep", phase: 2 },
    ],
  },
}

const getPlatform = (): Provider | "desktop" => {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return "apple_health"
  if (/Android/i.test(ua)) return "health_connect"
  return "desktop"
}

/** SCR-M-016 Health Integration — onboarding step 4 of 4. */
export default function HealthIntegrationPage() {
  const q = useOnboardingState()
  return (
    <OnboardingFrame step={4} backHref="/employee-app/onboarding/permissions" title="Connect your health app" subtitle="Sync steps and activity automatically — no manual logging.">
      <OnboardingGate query={q}>{(s) => <Health state={s} />}</OnboardingGate>
    </OnboardingFrame>
  )
}

function Health({ state }: { state: OnboardingState }) {
  const router = useRouter()
  const platform = useSyncExternalStore(
    () => () => {},
    getPlatform,
    () => "desktop" as const,
  )
  const [chosen, setChosen] = useState<Provider | null>(null)
  const provider: Provider = chosen ?? (platform === "desktop" ? "apple_health" : platform)
  const p = PROVIDERS[provider]
  const [types, setTypes] = useState<string[]>(["Steps", "Distance", "Active energy", "Active calories", "Active minutes", "Workouts"])
  const [sheet, setSheet] = useState(false)
  const [connected, setConnected] = useState<{ provider: Provider; days: number } | null>(state.health.connected && state.health.provider ? { provider: state.health.provider as Provider, days: 7 } : null)
  const [error, setError] = useState<string | null>(null)

  const connect = useApiMutation(onboardingApi.connectHealth, {
    invalidate: false,
    errorTitle: `Couldn't connect to ${p.name}`,
    onSuccess: (r) => {
      setConnected({ provider, days: r.syncedDays })
      toast.success(`Connected to ${p.name}`)
    },
    onError: () => setError(`We couldn't connect to ${p.name}. You can try again from Profile > Connected apps.`),
  })
  const skip = useApiMutation(onboardingApi.skipHealth, { invalidate: false, onSuccess: () => router.push("/employee-app/onboarding/baseline") })

  const selectedTypes = p.types.filter((t) => types.includes(t.key)).map((t) => t.key)

  if (connected)
    return (
      <div className="flex flex-1 flex-col gap-5">
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-emerald-500/30 bg-emerald-500/8 p-6 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 animate-in duration-500 zoom-in-50">
            <Check className="size-8" strokeWidth={3} />
          </span>
          <p className="text-xl font-bold">Connected</p>
          <p className="text-sm text-muted-foreground">
            {PROVIDERS[connected.provider].name} is linked. We synced your last {connected.days || 7} days of activity.
          </p>
        </div>
        <Button className="mt-auto h-12 text-base" onClick={() => router.push("/employee-app/onboarding/baseline")}>
          Continue <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    )

  return (
    <div className="flex flex-1 flex-col gap-5">
      {platform === "desktop" ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Which phone do you use?</p>
          <Segmented
            ariaLabel="Phone platform"
            value={provider}
            onChange={(v) => setChosen(v)}
            className="w-full"
            options={[
              { value: "apple_health", label: "iPhone" },
              { value: "health_connect", label: "Android" },
            ]}
          />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border bg-card shadow-xs">
        <div className={cn("flex items-center gap-3 p-4 text-white", provider === "apple_health" ? "bg-gradient-to-br from-rose-500 to-pink-600" : "bg-gradient-to-br from-sky-500 to-indigo-600")}>
          <span className="flex size-12 items-center justify-center rounded-2xl bg-white/95">{provider === "apple_health" ? <HeartPulse className="size-7 text-rose-500" /> : <Activity className="size-7 text-sky-600" />}</span>
          <div>
            <p className="text-lg font-bold">{p.name}</p>
            <p className="text-xs text-white/85">For {p.os} · reads data only, never writes</p>
          </div>
        </div>
        <div className="space-y-1 p-3">
          <p className="px-1 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Data HealthX will read</p>
          {p.types.map((t) => (
            <label key={t.key} htmlFor={`dt-${t.key}`} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/50">
              <Checkbox id={`dt-${t.key}`} checked={types.includes(t.key)} onCheckedChange={(v) => setTypes((x) => (v ? [...x, t.key] : x.filter((k) => k !== t.key)))} />
              <span className="flex-1 text-sm">{t.label}</span>
              {t.phase ? <PhaseBadge phase={2} /> : null}
            </label>
          ))}
        </div>
      </div>

      {provider === "health_connect" ? (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Smartphone className="mt-0.5 size-3.5 shrink-0" /> Health Connect must be installed on your Android phone.{" "}
          <a href="https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-primary">
            Get it on Google Play <ExternalLink className="size-3" />
          </a>
        </p>
      ) : null}

      <p className="flex items-start gap-2 rounded-xl bg-emerald-500/8 p-3 text-xs text-emerald-900 dark:text-emerald-200">
        <Lock className="mt-0.5 size-3.5 shrink-0" /> Your health data stays private to you. Your company only ever sees combined totals for groups of 5 or more people.
      </p>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-auto grid gap-2 pt-2">
        <Button className="h-12 text-base" onClick={() => setSheet(true)} disabled={!selectedTypes.length || connect.isPending}>
          {connect.isPending ? <Spinner /> : null} Connect {p.name}
        </Button>
        <Button variant="ghost" className="h-11 text-muted-foreground" onClick={() => skip.mutate()} disabled={skip.isPending}>
          {skip.isPending ? <Spinner /> : null} Skip for now
        </Button>
        {!selectedTypes.length ? <p className="text-center text-xs text-destructive">Choose at least one type of data to share.</p> : null}
      </div>

      {/* Simulated system permission sheet */}
      <Dialog open={sheet} onOpenChange={setSheet}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>&ldquo;HealthX&rdquo; would like to access your {p.name} data</DialogTitle>
            <DialogDescription>HealthX will read: {selectedTypes.join(", ")}.</DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">This is the {p.os} permission screen. You can change this later in {p.name}.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSheet(false)}>
              Don&apos;t allow
            </Button>
            <Button
              onClick={() => {
                setSheet(false)
                setError(null)
                connect.mutate({ provider, dataTypes: selectedTypes })
              }}
            >
              Allow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
