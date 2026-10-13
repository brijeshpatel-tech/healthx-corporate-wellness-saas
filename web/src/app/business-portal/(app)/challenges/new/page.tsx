"use client"

import { ArrowLeft, Info } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { ChallengeForm } from "@/components/business/engagement/challenges/challenge-form"
import { ChallengeTemplatePicker } from "@/components/business/engagement/challenges/template-picker"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { AccessDenied, ErrorState, PageSkeleton } from "@/components/common/states"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { challengesApi } from "@/lib/api/business/challenges"
import { useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"

function NewChallengePage() {
  const can = useCan()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const templateParam = params.get("template")
  const templates = useApiQuery(["business", "challenge-templates"], () => challengesApi.templates(), { enabled: can("challenges.manage") })

  if (!can("challenges.manage")) return <AccessDenied homeHref="/business-portal/challenges" message="Only Company Owners, HR Admins and Wellness Managers can create challenges." />

  const template = templateParam && templateParam !== "blank" ? templates.data?.find((t) => t.id === templateParam) : null
  const choosing = !templateParam

  return (
    <PageContainer>
      <PageHeader
        title={choosing ? "Create a challenge" : template ? `New challenge from “${template.name}”` : "New challenge"}
        description={choosing ? "Step 1 of 2 — start from a proven HealthX template or build your own." : "Step 2 of 2 — fill in the details. The preview shows what employees will see."}
        backHref="/business-portal/challenges"
        backLabel="Challenges"
        badge={template ? <Badge variant="secondary">Template</Badge> : undefined}
        actions={
          !choosing ? (
            <Button variant="outline" onClick={() => router.replace(pathname)}>
              <ArrowLeft data-icon="inline-start" /> Change template
            </Button>
          ) : undefined
        }
      />
      {choosing ? (
        templates.error ? (
          <ErrorState error={templates.error} onRetry={() => templates.refetch()} />
        ) : (
          <ChallengeTemplatePicker templates={templates.data ?? []} loading={templates.isLoading} onPick={(t) => router.replace(`${pathname}?template=${t ? t.id : "blank"}`)} />
        )
      ) : templateParam !== "blank" && templates.isLoading ? (
        <PageSkeleton kpis={0} />
      ) : (
        <>
          {templateParam !== "blank" && !template ? (
            <Alert className="border-amber-500/30 bg-amber-500/[0.06]">
              <Info className="text-amber-600" />
              <AlertTitle>That template isn&apos;t available any more</AlertTitle>
              <AlertDescription>You&apos;re starting from scratch instead. Use “Change template” to pick another one.</AlertDescription>
            </Alert>
          ) : null}
          <ChallengeForm key={templateParam} template={template ?? null} />
        </>
      )}
    </PageContainer>
  )
}

export default function Page() {
  return (
    <Suspense>
      <NewChallengePage />
    </Suspense>
  )
}
