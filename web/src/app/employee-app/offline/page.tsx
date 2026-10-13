"use client"

import { Construction, Mail, RefreshCw, ServerCrash, WifiOff } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { StandaloneScreen } from "@/components/employee/engage/account/standalone-screen"
import { useOnline } from "@/components/employee/engage/account/use-online"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { supportApi } from "@/lib/api/employee/support"
import { useApiQuery } from "@/lib/api/hooks"
import { HOME_PATH } from "@/lib/auth/session"

type Variant = "offline" | "error" | "maintenance"

/** SCR-M-081 No Connection / Something Went Wrong / Maintenance. */
export default function OfflinePage() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-background" />}>
      <OfflineScreen />
    </Suspense>
  )
}

/** Leaves this screen: back to where the person was, or Home when there's no history. */
function useLeave() {
  const router = useRouter()
  return () => {
    if (window.history.length > 1) router.back()
    else router.replace(HOME_PATH.employee)
  }
}

function OfflineScreen() {
  const params = useSearchParams()
  const online = useOnline()
  const requested = params.get("type")
  const variant: Variant = requested === "maintenance" || requested === "error" || requested === "offline" ? requested : online ? "error" : "offline"
  if (variant === "maintenance") return <Maintenance until={params.get("until")} />
  if (variant === "error") return <SomethingWentWrong />
  return <Offline />
}

function Offline() {
  const online = useOnline()
  const leave = useLeave()
  const [reconnected, setReconnected] = useState(false)
  const [stillOffline, setStillOffline] = useState(false)

  // Success state: return to the previous screen as soon as the connection is back.
  useEffect(() => {
    const onOnline = () => {
      setReconnected(true)
      leave()
    }
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  })

  return (
    <StandaloneScreen
      icon={WifiOff}
      tone="amber"
      eyebrow={reconnected ? "Connection restored" : "No internet connection"}
      title={reconnected ? "You're back online" : "You're offline"}
      message={reconnected ? "Taking you back to where you were…" : "You're offline. Some information may be out of date."}
    >
      <Button
        className="h-12 w-full rounded-xl text-base"
        onClick={() => {
          if (navigator.onLine) leave()
          else setStillOffline(true)
        }}
      >
        <RefreshCw data-icon="inline-start" /> Retry
      </Button>
      <ContactSupport />
      <p className="min-h-5 text-sm text-muted-foreground" aria-live="polite">
        {stillOffline && !online ? "Still offline. We'll reconnect automatically as soon as you're back online." : "We'll take you back automatically when you reconnect."}
      </p>
    </StandaloneScreen>
  )
}

function SomethingWentWrong() {
  const leave = useLeave()
  return (
    <StandaloneScreen icon={ServerCrash} tone="rose" eyebrow="Unexpected error" title="Oops, that didn't work" message="Something went wrong. Please try again.">
      <Button className="h-12 w-full rounded-xl text-base" onClick={leave}>
        <RefreshCw data-icon="inline-start" /> Retry
      </Button>
      <ContactSupport />
    </StandaloneScreen>
  )
}

function Maintenance({ until }: { until: string | null }) {
  const router = useRouter()
  const config = useApiQuery(["app", "config"], () => supportApi.appConfig(), { enabled: !until })
  const [checking, setChecking] = useState(false)
  const time = until ?? config.data?.maintenanceUntil ?? "02:00"

  const retry = async () => {
    setChecking(true)
    const r = await config.refetch()
    setChecking(false)
    if (r.data && !r.data.maintenance) router.replace(HOME_PATH.employee)
  }

  return (
    <StandaloneScreen icon={Construction} tone="sky" eyebrow="Planned maintenance" title="We'll be right back" message={`HealthX is under maintenance until ${time}.`}>
      <p className="text-sm text-muted-foreground">Your steps keep counting on your phone and will sync once we&apos;re back.</p>
      <Button className="h-12 w-full rounded-xl text-base" onClick={() => void retry()} disabled={checking}>
        {checking ? <Spinner /> : <RefreshCw data-icon="inline-start" />} Retry
      </Button>
      <ContactSupport />
    </StandaloneScreen>
  )
}

function ContactSupport() {
  return (
    <Button asChild variant="outline" className="h-12 w-full rounded-xl text-base">
      <a href="mailto:support@healthx.life">
        <Mail data-icon="inline-start" /> Contact support
      </a>
    </Button>
  )
}
