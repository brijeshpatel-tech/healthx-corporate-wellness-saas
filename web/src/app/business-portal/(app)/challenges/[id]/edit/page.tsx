"use client"

import { Lock } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ChallengeForm } from "@/components/business/engagement/challenges/challenge-form"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { AccessDenied, EmptyState, ErrorState, PageSkeleton } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { challengesApi } from "@/lib/api/business/challenges"
import { useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"

export default function EditChallengePage() {
  const { id } = useParams<{ id: string }>()
  const can = useCan()
  const challenge = useApiQuery(["business", "challenges", "detail", id], () => challengesApi.get({ id }), { enabled: can("challenges.manage") })

  if (!can("challenges.manage")) return <AccessDenied homeHref="/business-portal/challenges" message="Your role can view challenges but not edit them." />

  return (
    <PageContainer>
      <PageHeader
        title={challenge.data ? `Edit “${challenge.data.name}”` : "Edit challenge"}
        description="Update the challenge. The preview shows what employees will see."
        backHref={`/business-portal/challenges/${id}`}
        backLabel="Challenge"
        badge={challenge.data ? <StatusBadge status={challenge.data.status} /> : undefined}
      />
      {challenge.isLoading ? (
        <PageSkeleton kpis={0} />
      ) : challenge.error ? (
        <ErrorState error={challenge.error} onRetry={() => challenge.refetch()} />
      ) : challenge.data && !challenge.data.canEdit ? (
        <EmptyState
          icon={Lock}
          title="This challenge is locked"
          description={
            <>
              {challenge.data.lockReason ?? "This challenge can't be edited."} To run it again with changes, duplicate it as a new draft.
            </>
          }
          action={
            <Button asChild variant="outline">
              <Link href={`/business-portal/challenges/${id}`}>Back to challenge</Link>
            </Button>
          }
        />
      ) : challenge.data ? (
        <ChallengeForm key={challenge.data.id} challenge={challenge.data} />
      ) : null}
    </PageContainer>
  )
}
