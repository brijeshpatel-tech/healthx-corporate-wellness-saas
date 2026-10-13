"use client"

import { useQueryClient } from "@tanstack/react-query"
import { CircleCheck, CirclePause, Home, LockKeyhole, LogIn, LogOut, Mail, UserX } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { StandaloneScreen } from "@/components/employee/engage/account/standalone-screen"
import { useEmployeeSignOut } from "@/components/employee/engage/account/use-sign-out"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { employeeAuthApi } from "@/lib/api/auth"
import { HOME_PATH, LOGIN_PATH, useAuthHydrated, useAuthStore, useSession } from "@/lib/auth/session"
import { MODULE_LABEL, type ModuleCode } from "@/lib/types"

type Reason = "deactivated" | "suspended" | "module" | "deleted"
const REASONS: Reason[] = ["deactivated", "suspended", "module", "deleted"]

/** SCR-M-082 Access Blocked (account deactivated / company suspended / module not in plan / account deleted). */
export default function BlockedPage() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-background" />}>
      <Blocked />
    </Suspense>
  )
}

function Blocked() {
  const params = useSearchParams()
  const raw = params.get("reason")
  const reason: Reason = REASONS.includes(raw as Reason) ? (raw as Reason) : "deactivated"
  if (reason === "deleted") return <Deleted />
  if (reason === "module") return <ModuleBlocked module={params.get("module")} />
  return <AccountBlocked reason={reason} />
}

/** HR mailbox at the company's email domain, once the saved session has loaded. */
function useHrEmail() {
  const hydrated = useAuthHydrated()
  const session = useSession("employee")
  const domain = hydrated ? session?.user.email.split("@")[1] : undefined
  return domain ? `hr@${domain}` : null
}

function ContactHr() {
  const hr = useHrEmail()
  const [showHint, setShowHint] = useState(false)
  if (hr)
    return (
      <Button asChild variant="outline" className="h-12 w-full rounded-xl text-base">
        <a href={`mailto:${hr}?subject=${encodeURIComponent("HealthX access")}`}>
          <Mail data-icon="inline-start" /> Contact HR
        </a>
      </Button>
    )
  return (
    <>
      <Button variant="outline" className="h-12 w-full rounded-xl text-base" onClick={() => setShowHint(true)}>
        <Mail data-icon="inline-start" /> Contact HR
      </Button>
      {showHint ? <p className="text-sm text-muted-foreground">Please contact your HR team directly — by email, your intranet or your company helpdesk.</p> : null}
    </>
  )
}

function AccountBlocked({ reason }: { reason: "deactivated" | "suspended" }) {
  const { signOut, pending } = useEmployeeSignOut(LOGIN_PATH.employee)
  const suspended = reason === "suspended"
  return (
    <StandaloneScreen
      icon={suspended ? CirclePause : UserX}
      tone={suspended ? "amber" : "slate"}
      eyebrow={suspended ? "Access paused" : "Account deactivated"}
      title={suspended ? "HealthX is paused for now" : "Your account isn't active"}
      message={suspended ? "Your company's HealthX access is paused. Please contact your HR team." : "Your account is no longer active. Please contact your HR team."}
    >
      <ContactHr />
      <Button className="h-12 w-full rounded-xl text-base" onClick={() => void signOut()} disabled={pending}>
        {pending ? <Spinner /> : <LogOut data-icon="inline-start" />} Sign out
      </Button>
      <p className="text-xs text-muted-foreground">Your points and history are kept safe while your access is {suspended ? "paused" : "inactive"}.</p>
    </StandaloneScreen>
  )
}

function ModuleBlocked({ module }: { module: string | null }) {
  const label = module && module in MODULE_LABEL ? MODULE_LABEL[module as ModuleCode] : null
  return (
    <StandaloneScreen
      icon={LockKeyhole}
      tone="violet"
      eyebrow="Not in your plan"
      title={label ? `${label} isn't available` : "This feature isn't available"}
      message={`${label ?? "This feature"} isn't included in your company's HealthX plan. Please contact your HR team if you'd like it switched on.`}
    >
      <Button asChild className="h-12 w-full rounded-xl text-base">
        <Link href={HOME_PATH.employee}>
          <Home data-icon="inline-start" /> Back to Home
        </Link>
      </Button>
      <ContactHr />
    </StandaloneScreen>
  )
}

function Deleted() {
  const queryClient = useQueryClient()

  // The deletion request is done — revoke and clear the session here (outside the signed-in area,
  // so the auth guard doesn't redirect first).
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
      queryClient.clear()
    })()
    return () => {
      cancelled = true
    }
  }, [queryClient])

  return (
    <StandaloneScreen
      icon={CircleCheck}
      tone="emerald"
      eyebrow="Request received"
      title="Account deactivated"
      message="Your account has been deactivated. Your personal data will be deleted within 30 days."
      logoHref={LOGIN_PATH.employee}
    >
      <Button asChild className="h-12 w-full rounded-xl text-base">
        <Link href={LOGIN_PATH.employee}>
          <LogIn data-icon="inline-start" /> Back to sign in
        </Link>
      </Button>
      <Button asChild variant="outline" className="h-12 w-full rounded-xl text-base">
        <a href="mailto:support@healthx.life?subject=Account%20deletion">
          <Mail data-icon="inline-start" /> Contact support
        </a>
      </Button>
      <p className="text-sm text-muted-foreground">Changed your mind? Sign in again within 30 days and cancel the request in Settings.</p>
    </StandaloneScreen>
  )
}
