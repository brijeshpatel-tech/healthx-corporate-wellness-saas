"use client"

import { ArrowRight, Bell, Check, Footprints, ShieldCheck, X, type LucideIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { OnboardingFrame, OnboardingGate, useOnboardingState } from "@/components/employee/track/onboarding-frame"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { onboardingApi, type OnboardingState, type PermissionState } from "@/lib/api/employee/onboarding"
import { useApiMutation } from "@/lib/api/hooks"
import { cn } from "@/lib/utils"

/** SCR-M-015 Permissions — onboarding step 3 of 4. */
export default function PermissionsPage() {
  const q = useOnboardingState()
  return (
    <OnboardingFrame step={3} backHref="/employee-app/onboarding/goals" title="Stay on track" subtitle="Allow these so HealthX can count your steps and nudge you at the right time. You can change them any time.">
      <OnboardingGate query={q}>{(s) => <Permissions state={s} />}</OnboardingGate>
    </OnboardingFrame>
  )
}

function Permissions({ state }: { state: OnboardingState }) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<PermissionState | null>(state.permissions.notifications)
  const [motion, setMotion] = useState<PermissionState | null>(state.permissions.motion)
  const [asking, setAsking] = useState<"notifications" | "motion" | null>(null)
  const save = useApiMutation(onboardingApi.savePermissions, { invalidate: false, onSuccess: () => router.push("/employee-app/onboarding/health") })

  const askNotifications = async () => {
    setAsking("notifications")
    try {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission !== "denied") {
        const r = await Notification.requestPermission()
        setNotifications(r === "granted" ? "granted" : r === "denied" ? "denied" : "skipped")
      } else if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "denied") {
        setNotifications("denied")
      } else setNotifications("granted")
    } catch {
      setNotifications("granted")
    } finally {
      setAsking(null)
    }
  }

  const askMotion = async () => {
    setAsking("motion")
    try {
      // iOS Safari exposes a motion permission prompt; other browsers don't need one.
      const DME = typeof window !== "undefined" ? (window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<"granted" | "denied"> } | undefined) : undefined
      if (DME?.requestPermission) setMotion((await DME.requestPermission()) === "granted" ? "granted" : "denied")
      else setMotion("granted")
    } catch {
      setMotion("granted")
    } finally {
      setAsking(null)
    }
  }

  const finish = () => save.mutate({ notifications: notifications ?? "skipped", motion: motion ?? "skipped", pushToken: notifications === "granted" ? `web-${Date.now().toString(36)}` : undefined })

  return (
    <div className="flex flex-1 flex-col gap-4">
      <PermissionCard
        icon={Bell}
        tone="from-amber-400 to-orange-500"
        title="Notifications"
        body="Water reminders, challenge updates and your weekly summary. We send at most a few a day and respect quiet hours."
        state={notifications}
        busy={asking === "notifications"}
        onAllow={askNotifications}
        onSkip={() => setNotifications("skipped")}
      />
      <PermissionCard
        icon={Footprints}
        tone="from-sky-400 to-blue-600"
        title="Motion & Fitness"
        body="Lets HealthX count your steps and active minutes in the background — no need to open the app."
        state={motion}
        busy={asking === "motion"}
        onAllow={askMotion}
        onSkip={() => setMotion("skipped")}
      />
      <p className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" /> If you say no, HealthX still works — you&apos;ll see a reminder where a permission is needed, with a link to Settings.
      </p>
      <div className="mt-auto grid gap-2 pt-2">
        <Button className="h-12 text-base" onClick={finish} disabled={save.isPending}>
          {save.isPending ? <Spinner /> : null} Continue {!save.isPending ? <ArrowRight data-icon="inline-end" /> : null}
        </Button>
      </div>
    </div>
  )
}

function PermissionCard({
  icon: Icon,
  tone,
  title,
  body,
  state,
  busy,
  onAllow,
  onSkip,
}: {
  icon: LucideIcon
  tone: string
  title: string
  body: string
  state: PermissionState | null
  busy: boolean
  onAllow: () => void
  onSkip: () => void
}) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4 shadow-xs transition-colors", state === "granted" && "border-emerald-500/40 bg-emerald-500/5")}>
      <div className="flex items-start gap-3">
        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md", tone)}>
          <Icon className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">{body}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {state === "granted" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-3 py-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            <Check className="size-4" /> Allowed
          </span>
        ) : state === "denied" || state === "skipped" ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground">
              <X className="size-4" /> {state === "denied" ? "Blocked in your browser settings" : "Not now"}
            </span>
            {state === "skipped" ? (
              <Button variant="ghost" size="sm" onClick={onAllow} disabled={busy}>
                Allow instead
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <Button className="h-10 flex-1" onClick={onAllow} disabled={busy}>
              {busy ? <Spinner /> : null} Allow
            </Button>
            <Button variant="outline" className="h-10 flex-1" onClick={onSkip} disabled={busy}>
              Not now
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
