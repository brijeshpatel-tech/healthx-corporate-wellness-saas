"use client"

import { WorkoutForm } from "@/components/business/engagement/workouts/workout-form"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge } from "@/components/common/status-badge"
import { AccessDenied } from "@/components/common/states"
import { useCan } from "@/lib/auth/permissions"

export default function NewWorkoutPage() {
  const can = useCan()
  if (!can("content.manage")) return <AccessDenied homeHref="/business-portal/dashboard" message="Only Company Owners and Wellness Managers can create company workouts." />
  return (
    <PageContainer>
      <PageHeader
        title="New company workout"
        description="Build a workout from HealthX exercises. Published workouts appear in the app's workout library for everyone in your company."
        backHref="/business-portal/workouts"
        backLabel="Workouts"
        badge={<PhaseBadge phase={2} />}
      />
      <WorkoutForm />
    </PageContainer>
  )
}
