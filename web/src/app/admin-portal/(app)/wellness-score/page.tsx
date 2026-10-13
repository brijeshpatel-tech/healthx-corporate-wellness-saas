"use client"

import { HeartPulse } from "lucide-react"
import { ScoreWeightsForm } from "@/components/admin/engagement/score-weights-form"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PageSkeleton, QueryState } from "@/components/common/states"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useApiQuery } from "@/lib/api/hooks"
import { scoreApi } from "@/lib/api/platform/score"

export default function WellnessScoreWeightsPage() {
  const q = useApiQuery(["admin", "score-weights"], () => scoreApi.get(), { refetchOnWindowFocus: false })
  return (
    <PageContainer>
      <PageHeader
        title="Wellness score weights"
        description="Decide how much each area counts towards the daily Wellness Score every employee sees in the app. Weights must total exactly 100%."
      />
      <Alert className="border-sky-500/25 bg-sky-500/6">
        <HeartPulse className="text-sky-600 dark:text-sky-400" />
        <AlertTitle>Wellness score is not a medical assessment</AlertTitle>
        <AlertDescription>
          It&apos;s a motivational summary of everyday habits — not a diagnosis or health risk rating. Keep wording in the app supportive and never use it for employment decisions.
        </AlertDescription>
      </Alert>
      <QueryState query={q} loading={<PageSkeleton kpis={0} />}>
        {(data) => <ScoreWeightsForm key={data.current.version} data={data} />}
      </QueryState>
    </PageContainer>
  )
}
