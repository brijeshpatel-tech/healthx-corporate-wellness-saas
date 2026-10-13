"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { Spinner } from "@/components/ui/spinner"
import { LOGIN_PATH, useAuthHydrated, useSession, type Portal } from "@/lib/auth/session"

/**
 * Protects a portal: waits for the saved session and sends signed-out users to the
 * sign-in page (returning them afterwards). Role checks happen in the shell.
 */
export function AuthGuard({
  portal,
  children,
  requireOnboarding = false,
}: {
  portal: Portal
  children: React.ReactNode
  /** Employee app: send users who haven't finished onboarding to the onboarding flow. */
  requireOnboarding?: boolean
}) {
  const hydrated = useAuthHydrated()
  const session = useSession(portal)
  const router = useRouter()
  const pathname = usePathname()

  const needsOnboarding = requireOnboarding && session && "onboardingCompleted" in session && !session.onboardingCompleted

  useEffect(() => {
    if (!hydrated) return
    if (!session) router.replace(`${LOGIN_PATH[portal]}?next=${encodeURIComponent(pathname)}`)
    else if (needsOnboarding) router.replace("/employee-app/onboarding/profile")
  }, [hydrated, session, needsOnboarding, portal, pathname, router])

  if (!hydrated || !session || needsOnboarding) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    )
  }

  return <>{children}</>
}
