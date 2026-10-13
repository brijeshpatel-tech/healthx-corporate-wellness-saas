"use client"

import { CalendarRange, KeyRound, Medal, Trophy } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { EmptyState } from "@/components/common/states"
import { JoinWithCodeDialog } from "@/components/employee/engage/challenge-extras"
import { ChallengeCard } from "@/components/employee/engage/challenge-ui"
import { CardListSkeleton, ChipTabs, EngagePage, LoadError, Segmented } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import { challengesApi, CHALLENGE_TYPE_LABEL, type ChallengeTab } from "@/lib/api/employee/challenges"
import { useApiQuery } from "@/lib/api/hooks"
import type { ChallengeType } from "@/lib/types"

const TABS: ChallengeTab[] = ["available", "active", "completed"]
const TYPES = ["all", "individual", "leaderboard", "team", "company", "collaborative"] as const
type TypeFilter = (typeof TYPES)[number]

/** SCR-M-042 Challenges — Available / Active / Completed. */
export default function ChallengesPage() {
  return (
    <Suspense fallback={<EngagePage title="Challenges"><CardListSkeleton count={4} /></EngagePage>}>
      <Challenges />
    </Suspense>
  )
}

function Challenges() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const tabParam = params.get("tab") as ChallengeTab | null
  const tab: ChallengeTab = tabParam && TABS.includes(tabParam) ? tabParam : "active"
  const typeParam = params.get("type") as TypeFilter | null
  const type: TypeFilter = typeParam && TYPES.includes(typeParam) ? typeParam : "all"

  const setParam = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params.toString())
    if (value === fallback) next.delete(key)
    else next.set(key, value)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const [codeOpen, setCodeOpen] = useState(false)
  const q = useApiQuery(["employee", "challenges", tab, type], () => challengesApi.list({ status: tab, type }), { placeholderData: (prev) => prev })
  const counts = q.data?.counts

  return (
    <EngagePage
      title="Challenges"
      description="Join challenges, compete with colleagues and earn bonus points."
      actions={
        <>
          <Button size="lg" className="rounded-xl" onClick={() => setCodeOpen(true)}>
            <KeyRound data-icon="inline-start" /> Join with code
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-xl">
            <Link href="/employee-app/leaderboards">
              <Medal data-icon="inline-start" /> Leaderboards
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-xl">
            <Link href="/employee-app/programs">
              <CalendarRange data-icon="inline-start" /> Programs
            </Link>
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Segmented
          ariaLabel="Challenge status"
          value={tab}
          onChange={(v) => setParam("tab", v, "active")}
          options={[
            { value: "available", label: "Available", count: counts?.available },
            { value: "active", label: "Active", count: counts?.active },
            { value: "completed", label: "Completed", count: counts?.completed },
          ]}
        />
        <ChipTabs<TypeFilter>
          ariaLabel="Challenge type"
          value={type}
          onChange={(v) => setParam("type", v, "all")}
          options={TYPES.map((t) => ({ value: t, label: t === "all" ? "All types" : CHALLENGE_TYPE_LABEL[t as ChallengeType] }))}
        />
      </div>

      {q.error && !q.data ? (
        <LoadError title="Couldn't load challenges." error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <CardListSkeleton count={4} className="lg:grid-cols-2" itemClassName="h-56" />
      ) : q.data.items.length === 0 ? (
        <EmptyChallenges tab={tab} filtered={type !== "all"} onShowAvailable={() => setParam("tab", "available", "active")} onClearType={() => setParam("type", "all", "all")} />
      ) : (
        <div className={`grid gap-4 sm:grid-cols-2 ${q.isFetching ? "opacity-70 transition-opacity" : ""}`}>
          {q.data.items.map((c) => (
            <ChallengeCard key={c.id} c={c} href={tab === "completed" ? `/employee-app/challenges/${c.id}/results` : `/employee-app/challenges/${c.id}`} />
          ))}
        </div>
      )}
      <JoinWithCodeDialog open={codeOpen} onOpenChange={setCodeOpen} />
    </EngagePage>
  )
}

function EmptyChallenges({ tab, filtered, onShowAvailable, onClearType }: { tab: ChallengeTab; filtered: boolean; onShowAvailable: () => void; onClearType: () => void }) {
  if (filtered)
    return <EmptyState icon={Trophy} title="No challenges of this type" description="Try another type or show all challenges." action={<Button variant="outline" onClick={onClearType}>Show all types</Button>} />
  if (tab === "available") return <EmptyState icon={Trophy} title="No challenges open right now – check back soon." description="New challenges from your company will appear here." />
  if (tab === "active")
    return (
      <EmptyState
        icon={Trophy}
        title="You haven't joined a challenge yet"
        description="Join one to compete with colleagues and earn bonus points."
        action={<Button onClick={onShowAvailable}>See available challenges</Button>}
      />
    )
  return <EmptyState icon={Trophy} title="Your finished challenges will appear here." description="Complete a challenge to see your results and rewards." />
}
