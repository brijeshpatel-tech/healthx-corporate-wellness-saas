"use client"

import { CalendarRange, CircleCheckBig, Compass } from "lucide-react"
import { useState } from "react"
import { EmptyState } from "@/components/common/states"
import { PhaseBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { ProgramCardView } from "@/components/employee/engage/grow/programs"
import { CardListSkeleton, EngagePage, LoadError, Segmented } from "@/components/employee/engage/page"
import { programsApi, type ProgramTab } from "@/lib/api/employee/programs"
import { useApiQuery } from "@/lib/api/hooks"

/** SCR-M-064 Wellness Programs — Available / My programs / Completed. Phase 2. */
export default function WellnessProgramsPage() {
  const q = useApiQuery(["employee", "programs", "list"], () => programsApi.list())
  const [picked, setPicked] = useState<ProgramTab | null>(null)
  // Default to "My programs" when the employee is already following one.
  const tab: ProgramTab = picked ?? (q.data && q.data.counts.mine > 0 ? "mine" : "available")
  const items = q.data?.items.filter((p) => p.tab === tab) ?? []

  return (
    <EngagePage
      title="Wellness programs"
      badge={<PhaseBadge phase={2} />}
      description="Multi-week programs with a goal for every week. Join one and your steps, water, workouts and sleep count automatically."
      size="wide"
    >
      <Segmented<ProgramTab>
        ariaLabel="Programs"
        value={tab}
        onChange={setPicked}
        options={[
          { value: "available", label: "Available", count: q.data?.counts.available },
          { value: "mine", label: "My programs", count: q.data?.counts.mine },
          { value: "completed", label: "Completed", count: q.data?.counts.completed },
        ]}
      />
      {q.error ? (
        <LoadError title="Couldn't load programs." error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <CardListSkeleton count={3} className="lg:grid-cols-3" itemClassName="h-80" />
      ) : items.length === 0 ? (
        tab === "available" ? (
          <EmptyState icon={CalendarRange} title="No programs available right now." description="New programs from your company and HealthX will appear here." />
        ) : tab === "mine" ? (
          <EmptyState
            icon={Compass}
            title="You're not following a program yet."
            description="Pick a program to get a clear goal for every week."
            action={
              <Button onClick={() => setPicked("available")} className="h-10 rounded-xl">
                Browse programs
              </Button>
            }
          />
        ) : (
          <EmptyState icon={CircleCheckBig} title="No completed programs yet." description="Finish every weekly goal of a program to earn its completion points." />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <ProgramCardView key={p.id} program={p} />
          ))}
        </div>
      )}
    </EngagePage>
  )
}
