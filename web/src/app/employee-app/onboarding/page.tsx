"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { OnboardingGate, useOnboardingState } from "@/components/employee/track/onboarding-frame"
import { EmployeeAuthLayout } from "@/components/shell/employee-auth-layout"

/** Resumes onboarding at the furthest step reached (progress is saved if the app is closed). */
export default function OnboardingIndexPage() {
  const router = useRouter()
  const q = useOnboardingState()
  const step = q.ready ? q.data?.step : undefined
  useEffect(() => {
    if (step) router.replace(`/employee-app/onboarding/${step}`)
  }, [step, router])
  return (
    <EmployeeAuthLayout>
      <OnboardingGate query={q}>{() => <p className="text-center text-sm text-muted-foreground">Picking up where you left off…</p>}</OnboardingGate>
    </EmployeeAuthLayout>
  )
}
