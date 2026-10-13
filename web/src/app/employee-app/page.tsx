"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { LogoMark } from "@/components/brand/logo"
import { Spinner } from "@/components/ui/spinner"
import { HOME_PATH, useAuthHydrated, useSession } from "@/lib/auth/session"

/** SCR-M-001 Splash — checks the saved session and routes to onboarding, Home or company identification. */
export default function EmployeeSplash() {
  const hydrated = useAuthHydrated()
  const session = useSession("employee")
  const router = useRouter()

  useEffect(() => {
    if (!hydrated) return
    const t = setTimeout(() => {
      if (!session) router.replace("/employee-app/welcome")
      else if (!session.onboardingCompleted) router.replace("/employee-app/onboarding/profile")
      else router.replace(HOME_PATH.employee)
    }, 600)
    return () => clearTimeout(t)
  }, [hydrated, session, router])

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-600 text-white">
      <LogoMark className="size-20 animate-in duration-700 zoom-in-75 fade-in" />
      <div className="text-center">
        <p className="font-heading text-3xl font-extrabold tracking-tight">HealthX</p>
        <p className="text-sm text-white/80">Your workplace wellness companion</p>
      </div>
      <Spinner className="size-5 text-white/80" />
    </div>
  )
}
