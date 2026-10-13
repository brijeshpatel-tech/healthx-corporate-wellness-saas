"use client"

import { Lock } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { WorkoutForm } from "@/components/business/engagement/workouts/workout-form"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { AccessDenied, EmptyState, ErrorState, PageSkeleton } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { workoutsApi } from "@/lib/api/business/workouts"
import { useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"

export default function EditWorkoutPage() {
  const { id } = useParams<{ id: string }>()
  const can = useCan()
  const q = useApiQuery(["business", "workouts", "detail", id], () => workoutsApi.get({ id }), { enabled: can("content.manage") })
  if (!can("content.manage")) return <AccessDenied homeHref="/business-portal/dashboard" message="Only Company Owners and Wellness Managers can edit company workouts." />
  const w = q.data?.workout
  return (
    <PageContainer>
      <PageHeader
        title={w ? `Edit “${w.name}”` : "Edit workout"}
        description="Changes to a published workout show in the app straight away."
        backHref={`/business-portal/workouts/${id}`}
        backLabel="Workout"
        badge={
          <>
            <PhaseBadge phase={2} />
            {w ? <StatusBadge status={w.status} /> : null}
          </>
        }
      />
      {q.isLoading ? (
        <PageSkeleton kpis={0} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data && !q.data.canEdit ? (
        <EmptyState
          icon={Lock}
          title={q.data.source === "healthx" ? "HealthX workouts are read-only" : "Archived workouts can't be edited"}
          description={q.data.source === "healthx" ? "Copy it to your company workouts to make your own version." : "Restore it as a draft first, then edit it."}
          action={
            <Button asChild variant="outline">
              <Link href={`/business-portal/workouts/${id}`}>Back to workout</Link>
            </Button>
          }
        />
      ) : q.data ? (
        <WorkoutForm key={q.data.workout.id} detail={q.data} />
      ) : null}
    </PageContainer>
  )
}
