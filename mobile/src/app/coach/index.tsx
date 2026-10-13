/**
 * AI Coach entry (Phase 2):
 * - company switched the coach off → friendly "not available" state
 * - no AI-personalisation consent → SCR-M-066 Introduction & Consent
 * - consent granted → SCR-M-067 Chat
 */
import { Bot } from "lucide-react-native"
import { CoachChat, CoachIntro } from "@/components/engage/coach"
import { go } from "@/components/engage/shared"
import { EmptyState, ErrorState, PhaseBadge, Screen, SkeletonList } from "@/components/ui"
import { coachApi } from "@/lib/api/employee/coach"
import { useApiQuery } from "@/lib/api/hooks"

export default function CoachScreen() {
  const q = useApiQuery(["employee", "coach", "access"], () => coachApi.access())
  if (q.data?.enabled && q.data.granted) return <CoachChat access={q.data} />
  if (q.data?.enabled) return <CoachIntro access={q.data} />
  return (
    <Screen title="AI Coach" back right={<PhaseBadge phase={2} />}>
      {q.error ? (
        <ErrorState title="Coach is unavailable right now. Please try again later." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : q.data ? (
        <EmptyState
          icon={Bot}
          title={`The AI coach isn't available for ${q.data.companyName} yet.`}
          description="Your company hasn't switched on the AI Wellness Coach. In the meantime, your feed has fresh tips and workouts picked for you."
          action={{ label: "Open my feed", onPress: () => go("/feed") }}
        />
      ) : (
        <SkeletonList count={3} height={90} />
      )}
    </Screen>
  )
}
