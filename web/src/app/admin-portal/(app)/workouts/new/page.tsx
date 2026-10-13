"use client"

import { WorkoutForm } from "@/components/admin/content/workout-form"
import { PageContainer, PageHeader } from "@/components/common/page-header"

/** SCR-P-017 Create Workout. */
export default function NewWorkoutPage() {
  return (
    <PageContainer className="pb-0">
      <PageHeader title="Create workout" description="Build a workout from the exercise library. It stays hidden from the app until you publish it." backHref="/admin-portal/workouts" backLabel="Workouts" />
      <WorkoutForm />
    </PageContainer>
  )
}
