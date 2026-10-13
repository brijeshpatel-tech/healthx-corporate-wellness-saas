"use client"

import { useParams } from "next/navigation"
import { LoadError } from "@/components/admin/content/bits"
import { WorkoutForm } from "@/components/admin/content/workout-form"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useApiQuery } from "@/lib/api/hooks"
import { workoutsApi } from "@/lib/api/platform/workouts"
import { formatNumber, formatRelative } from "@/lib/format"

/** SCR-P-017 Edit Workout. */
export default function EditWorkoutPage() {
  const { id } = useParams<{ id: string }>()
  const can = useAdminCan()
  const detail = useApiQuery(["admin", "workouts", "detail", id], () => workoutsApi.get({ id }), { refetchOnWindowFocus: false })
  const w = detail.data?.workout

  return (
    <PageContainer className="pb-0">
      <PageHeader
        title={w ? (can("catalog.manage") ? `Edit “${w.name}”` : w.name) : "Workout"}
        badge={w ? <StatusBadge status={w.status} /> : null}
        description={w ? `${formatNumber(w.completions)} completions · updated ${formatRelative(w.updatedAt)}` : undefined}
        backHref="/admin-portal/workouts"
        backLabel="Workouts"
      />
      {detail.isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <Skeleton className="h-96 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
          <Skeleton className="hidden h-[560px] rounded-[1.75rem] lg:block" />
        </div>
      ) : detail.error || !detail.data ? (
        <LoadError title="Couldn't load this workout." error={detail.error} onRetry={() => detail.refetch()} />
      ) : (
        <WorkoutForm key={detail.data.workout.id} initial={detail.data} />
      )}
    </PageContainer>
  )
}
