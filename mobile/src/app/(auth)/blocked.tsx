/**
 * SCR-M-082 Access Blocked — account deactivated / company suspended / module not in plan / account deleted.
 * Lives in the public (auth) group (URL /blocked) so it still works after the session has been cleared.
 */
import { useQueryClient } from "@tanstack/react-query"
import { router, useLocalSearchParams } from "expo-router"
import { CircleCheck, CirclePause, House, LockKeyhole, LogIn, LogOut, Mail, UserX } from "lucide-react-native"
import { useEffect, useState } from "react"
import { Linking } from "react-native"
import { StandaloneScreen } from "@/components/engage/account"
import { Button, Text } from "@/components/ui"
import { employeeAuthApi } from "@/lib/api/auth"
import { useAuthStore, useSession } from "@/lib/auth/session"
import { MODULE_LABEL, type ModuleCode } from "@/lib/types"
import { toast } from "@/lib/toast"

type Reason = "deactivated" | "suspended" | "module" | "deleted"
const REASONS: Reason[] = ["deactivated", "suspended", "module", "deleted"]
const SUPPORT = "support@healthx.life"

const mail = (to: string, subject: string) => Linking.openURL(`mailto:${to}?subject=${encodeURIComponent(subject)}`).catch(() => toast.info(`Email ${to}`))

function useSignOut() {
  const qc = useQueryClient()
  const clearSession = useAuthStore((s) => s.clearSession)
  const [pending, setPending] = useState(false)
  const signOut = async () => {
    setPending(true)
    try {
      await employeeAuthApi.logout()
    } catch {
      // Local sign-out is enough when offline.
    }
    clearSession("employee")
    qc.clear()
    setPending(false)
    router.replace("/welcome")
  }
  return { signOut, pending }
}

function ContactHr() {
  const session = useSession("employee")
  const domain = session?.user.email.split("@")[1]
  const [hint, setHint] = useState(false)
  return (
    <>
      <Button title="Contact HR" icon={Mail} variant="outline" onPress={() => (domain ? mail(`hr@${domain}`, "HealthX access") : setHint(true))} />
      {hint ? (
        <Text variant="caption" tone="muted" align="center">
          Please contact your HR team directly — by email, your intranet or your company helpdesk.
        </Text>
      ) : null}
    </>
  )
}

function AccountBlocked({ reason }: { reason: "deactivated" | "suspended" }) {
  const { signOut, pending } = useSignOut()
  const suspended = reason === "suspended"
  return (
    <StandaloneScreen
      icon={suspended ? CirclePause : UserX}
      tint={suspended ? "points" : "neutral"}
      eyebrow={suspended ? "Access paused" : "Account deactivated"}
      title={suspended ? "HealthX is paused for now" : "Your account isn't active"}
      message={suspended ? "Your company's HealthX access is paused. Please contact your HR team." : "Your account is no longer active. Please contact your HR team."}
      testID="blocked-screen"
    >
      <ContactHr />
      <Button title="Sign out" icon={LogOut} loading={pending} onPress={signOut} />
      <Text variant="small" tone="muted" align="center">
        Your points and history are kept safe while your access is {suspended ? "paused" : "inactive"}.
      </Text>
    </StandaloneScreen>
  )
}

function ModuleBlocked({ module }: { module?: string }) {
  const label = module && module in MODULE_LABEL ? MODULE_LABEL[module as ModuleCode] : null
  return (
    <StandaloneScreen
      icon={LockKeyhole}
      tint="workout"
      eyebrow="Not in your plan"
      title={label ? `${label} isn't available` : "This feature isn't available"}
      message={`${label ?? "This feature"} isn't included in your company's HealthX plan. Please contact your HR team if you'd like it switched on.`}
    >
      <Button title="Back to Home" icon={House} onPress={() => router.replace("/home")} />
      <ContactHr />
    </StandaloneScreen>
  )
}

function Deleted() {
  const qc = useQueryClient()
  // The deletion request is done — revoke and clear the session here (public route, so no auth redirect first).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (useAuthStore.getState().sessions.employee) {
        try {
          await employeeAuthApi.logout()
        } catch {
          // ignore — local sign-out is enough
        }
      }
      if (cancelled) return
      useAuthStore.getState().clearSession("employee")
      qc.clear()
    })()
    return () => {
      cancelled = true
    }
  }, [qc])
  return (
    <StandaloneScreen icon={CircleCheck} tint="habits" eyebrow="Request received" title="Account deactivated" message="Your account has been deactivated. Your personal data will be deleted within 30 days." testID="deleted-screen">
      <Button title="Back to sign in" icon={LogIn} onPress={() => router.replace("/welcome")} />
      <Button title="Contact support" icon={Mail} variant="outline" onPress={() => mail(SUPPORT, "Account deletion")} />
      <Text variant="caption" tone="muted" align="center">
        Changed your mind? Sign in again within 30 days and cancel the request in Settings.
      </Text>
    </StandaloneScreen>
  )
}

export default function BlockedScreen() {
  const params = useLocalSearchParams<{ reason?: string; module?: string }>()
  const reason: Reason = REASONS.includes(params.reason as Reason) ? (params.reason as Reason) : "deactivated"
  if (reason === "deleted") return <Deleted />
  if (reason === "module") return <ModuleBlocked module={params.module} />
  return <AccountBlocked reason={reason} />
}
