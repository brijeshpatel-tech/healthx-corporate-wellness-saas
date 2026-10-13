"use client"

import { Bot } from "lucide-react"
import Link from "next/link"
import { EmptyState } from "@/components/common/states"
import { PhaseBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CoachChat } from "@/components/employee/engage/grow/coach-chat"
import { CoachIntro } from "@/components/employee/engage/grow/coach-intro"
import { EngagePage, LoadError } from "@/components/employee/engage/page"
import { coachApi } from "@/lib/api/employee/coach"
import { useApiQuery } from "@/lib/api/hooks"

/**
 * AI Coach entry (/employee-app/coach). Phase 2.
 * - company switched the coach off → friendly "not available" state
 * - no AI-personalisation consent → SCR-M-066 Introduction & Consent
 * - consent granted → SCR-M-067 Chat
 */
export default function AICoachPage() {
  const q = useApiQuery(["employee", "coach", "access"], () => coachApi.access())

  if (q.error) {
    return (
      <EngagePage title="AI Coach" badge={<PhaseBadge phase={2} />} size="narrow">
        <LoadError title="Coach is unavailable right now. Please try again later." error={q.error} onRetry={() => q.refetch()} />
      </EngagePage>
    )
  }
  if (!q.data) return <CoachSkeleton />
  if (!q.data.enabled) {
    return (
      <EngagePage title="AI Coach" badge={<PhaseBadge phase={2} />} size="narrow">
        <EmptyState
          icon={Bot}
          title={`The AI coach isn't available for ${q.data.companyName} yet.`}
          description="Your company hasn't switched on the AI Wellness Coach. In the meantime, your feed has fresh tips and workouts picked for you."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild className="h-10 rounded-xl">
                <Link href="/employee-app/feed">Open my feed</Link>
              </Button>
              <Button asChild variant="outline" className="h-10 rounded-xl">
                <Link href="/employee-app/home">Back home</Link>
              </Button>
            </div>
          }
        />
      </EngagePage>
    )
  }
  if (!q.data.granted) return <CoachIntro access={q.data} />
  return <CoachChat access={q.data} />
}

function CoachSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-4 sm:p-6">
      <Skeleton className="h-48 rounded-3xl" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  )
}
