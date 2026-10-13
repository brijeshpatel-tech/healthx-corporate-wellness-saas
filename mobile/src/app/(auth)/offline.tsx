/**
 * SCR-M-081 No Connection / Something Went Wrong / Maintenance (/offline?type=offline|error|maintenance&until=02:00).
 * Public (auth) group route so it can be shown before or after sign-in.
 */
import { router, useLocalSearchParams } from "expo-router"
import { Construction, Mail, RefreshCw, ServerCrash, WifiOff } from "lucide-react-native"
import { useState } from "react"
import { Linking, Platform } from "react-native"
import { StandaloneScreen } from "@/components/engage/account"
import { Button, Text } from "@/components/ui"
import { supportApi } from "@/lib/api/employee/support"
import { useApiQuery } from "@/lib/api/hooks"
import { useSession } from "@/lib/auth/session"
import { toast } from "@/lib/toast"

type Variant = "offline" | "error" | "maintenance"

/** Leaves this screen: back to where the person was, or Home / Welcome when there's no history. */
function useLeave() {
  const session = useSession("employee")
  return () => {
    if (router.canGoBack()) router.back()
    else router.replace(session ? "/home" : "/welcome")
  }
}

/** Connection check: browser online flag on web, a light API call everywhere. */
async function isOnline() {
  if (Platform.OS === "web" && typeof navigator !== "undefined" && !navigator.onLine) return false
  try {
    await supportApi.appConfig()
    return true
  } catch {
    return false
  }
}

function ContactSupport() {
  return <Button title="Contact support" icon={Mail} variant="outline" onPress={() => Linking.openURL("mailto:support@healthx.life").catch(() => toast.info("Email support@healthx.life"))} />
}

function Offline() {
  const leave = useLeave()
  const [checking, setChecking] = useState(false)
  const [stillOffline, setStillOffline] = useState(false)
  const [back, setBack] = useState(false)
  const retry = async () => {
    setChecking(true)
    const ok = await isOnline()
    setChecking(false)
    if (ok) {
      setBack(true)
      setTimeout(leave, 600)
    } else setStillOffline(true)
  }
  return (
    <StandaloneScreen
      icon={WifiOff}
      tint="points"
      eyebrow={back ? "Connection restored" : "No internet connection"}
      title={back ? "You're back online" : "You're offline"}
      message={back ? "Taking you back to where you were…" : "You're offline. Some information may be out of date."}
      testID="offline-screen"
    >
      <Button title="Retry" icon={RefreshCw} loading={checking} onPress={retry} testID="offline-retry" />
      <ContactSupport />
      <Text variant="caption" tone="muted" align="center" accessibilityLiveRegion="polite">
        {stillOffline ? "Still offline. Check Wi-Fi or mobile data, then try again." : "Your steps keep counting on your phone and sync when you're back."}
      </Text>
    </StandaloneScreen>
  )
}

function SomethingWentWrong() {
  const leave = useLeave()
  return (
    <StandaloneScreen icon={ServerCrash} tint="danger" eyebrow="Unexpected error" title="Oops, that didn't work" message="Something went wrong. Please try again.">
      <Button title="Retry" icon={RefreshCw} onPress={leave} />
      <ContactSupport />
    </StandaloneScreen>
  )
}

function Maintenance({ until }: { until?: string }) {
  const session = useSession("employee")
  const config = useApiQuery(["app", "config"], () => supportApi.appConfig(), { enabled: !until })
  const [checking, setChecking] = useState(false)
  const time = until ?? config.data?.maintenanceUntil ?? "02:00"
  const retry = async () => {
    setChecking(true)
    const r = await config.refetch()
    setChecking(false)
    if (r.data && !r.data.maintenance) router.replace(session ? "/home" : "/welcome")
    else toast.info(`Still under maintenance until ${time}.`)
  }
  return (
    <StandaloneScreen icon={Construction} tint="steps" eyebrow="Planned maintenance" title="We'll be right back" message={`HealthX is under maintenance until ${time}.`}>
      <Text variant="caption" tone="muted" align="center">
        Your steps keep counting on your phone and will sync once we&apos;re back.
      </Text>
      <Button title="Retry" icon={RefreshCw} loading={checking} onPress={retry} />
      <ContactSupport />
    </StandaloneScreen>
  )
}

export default function OfflineScreen() {
  const params = useLocalSearchParams<{ type?: string; until?: string }>()
  const variant: Variant = params.type === "maintenance" || params.type === "error" ? params.type : "offline"
  if (variant === "maintenance") return <Maintenance until={params.until} />
  if (variant === "error") return <SomethingWentWrong />
  return <Offline />
}
