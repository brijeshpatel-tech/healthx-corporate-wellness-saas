"use client"

/** Shared frame + state hook for the onboarding steps (SCR-M-013 … SCR-M-017). */
import { ArrowLeft, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { ErrorState } from "@/components/common/states"
import { EmployeeAuthLayout } from "@/components/shell/employee-auth-layout"
import { Skeleton } from "@/components/ui/skeleton"
import { onboardingApi, type OnboardingState } from "@/lib/api/employee/onboarding"
import { useApiQuery } from "@/lib/api/hooks"

export const ONBOARDING_TOTAL = 4

/** Loads onboarding state; sends users who haven't accepted the terms to the Terms screen first. */
export function useOnboardingState() {
  const router = useRouter()
  const q = useApiQuery(["employee", "onboarding"], () => onboardingApi.state(), { staleTime: 0 })
  const needsTerms = q.data && !q.data.termsAccepted
  useEffect(() => {
    if (needsTerms) router.replace("/employee-app/terms?next=/employee-app/onboarding")
  }, [needsTerms, router])
  return { ...q, ready: !!q.data && !needsTerms }
}

export function OnboardingFrame({
  step,
  icon: Icon,
  title,
  subtitle,
  backHref,
  children,
}: {
  step?: number
  icon?: LucideIcon
  title?: React.ReactNode
  subtitle?: React.ReactNode
  backHref?: string
  children: React.ReactNode
}) {
  return (
    <EmployeeAuthLayout step={step} totalSteps={step ? ONBOARDING_TOTAL : undefined} className="pt-6">
      <div className="flex flex-1 flex-col gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            {backHref ? (
              <Link href={backHref} className="-ml-1 inline-flex items-center gap-1 rounded-md py-1 pr-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4" /> Back
              </Link>
            ) : (
              <span />
            )}
            {step ? (
              <span className="text-xs font-semibold text-muted-foreground">
                Step {step} of {ONBOARDING_TOTAL}
              </span>
            ) : null}
          </div>
          {Icon ? (
            <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
              <Icon className="size-7" />
            </span>
          ) : null}
          {title ? <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1> : null}
          {subtitle ? <p className="text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </EmployeeAuthLayout>
  )
}

/** Loading / error wrapper for a step. */
export function OnboardingGate({ query, children }: { query: ReturnType<typeof useOnboardingState>; children: (state: OnboardingState) => React.ReactNode }) {
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (!query.ready || !query.data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  return <>{children(query.data)}</>
}
