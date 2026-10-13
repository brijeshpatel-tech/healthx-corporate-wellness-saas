"use client"

import { keepPreviousData } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { PrivacyNote } from "@/components/common/misc"
import { InboxEmpty } from "@/components/employee/engage/inbox/states"
import { EngagePage, LoadError, Segmented } from "@/components/employee/engage/page"
import { TeamChallenges } from "@/components/employee/engage/team/team-challenges"
import { TeamLeaderboard } from "@/components/employee/engage/team/team-leaderboard"
import { PERIOD_LABEL, TeamHero, TeamStats, TeamStepsCard } from "@/components/employee/engage/team/team-overview"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { teamApi, type TeamPeriod } from "@/lib/api/employee/team"
import { useApiQuery } from "@/lib/api/hooks"
import { cn } from "@/lib/utils"

/** SCR-M-079 My Team (Team Manager). Aggregated team data only. */
export default function MyTeamPage() {
  const [period, setPeriod] = useState<TeamPeriod>("week")
  const [teamId, setTeamId] = useState<string | undefined>(undefined)
  const q = useApiQuery(["employee", "team", "summary", { period, teamId }], () => teamApi.summary({ period, teamId }), {
    placeholderData: keepPreviousData,
    retry: (count, error) => error.status !== 403 && count < 2,
  })
  const data = q.data

  if (q.error?.status === 403) {
    return (
      <EngagePage size="narrow">
        <InboxEmpty
          emoji="🔒"
          title="My Team is for Team Managers"
          description={q.error.message}
          action={
            <Button asChild size="lg" className="rounded-xl">
              <Link href="/employee-app/home">
                <ArrowLeft data-icon="inline-start" />
                Back to Home
              </Link>
            </Button>
          }
          className="mt-6"
        />
      </EngagePage>
    )
  }

  return (
    <EngagePage
      title="My team"
      description={data ? `How ${data.team.name} is doing ${PERIOD_LABEL[period]} — combined figures only.` : "How your team is doing — combined figures only."}
      actions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {data && data.teams.length > 1 ? (
            <Select value={teamId ?? data.team.id} onValueChange={setTeamId}>
              <SelectTrigger className="h-11 w-full rounded-xl sm:w-48" aria-label="Choose team">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Segmented<TeamPeriod>
            ariaLabel="Period"
            value={period}
            onChange={setPeriod}
            className="sm:min-w-64"
            options={[
              { value: "week", label: "This week" },
              { value: "month", label: "This month" },
            ]}
          />
        </div>
      }
    >
      {q.error && !data ? (
        <LoadError title="Couldn't load team data." error={q.error} onRetry={() => q.refetch()} />
      ) : !data ? (
        <MyTeamSkeleton />
      ) : (
        <div className={cn("flex flex-col gap-5 transition-opacity", q.isPlaceholderData && q.isFetching && "opacity-70")}>
          <TeamHero summary={data} />
          <PrivacyNote minGroupSize={data.minGroupSize}>
            <span className="font-semibold">What you can see as a manager:</span> participation (how many members are active and have joined challenges), your team&apos;s combined figures and the same team leaderboard everyone sees. You never see anyone&apos;s health data — water, sleep, weight, nutrition or wellness score — and averages are hidden for groups smaller than {data.minGroupSize}.
          </PrivacyNote>

          {!data.hasActivity ? (
            <InboxEmpty
              emoji="🌱"
              title={period === "week" ? "Your team has no activity yet this week." : "Your team has no activity yet this month."}
              description="Once team members sync their steps or join a challenge, their combined progress will show up here."
              action={
                <Button asChild variant="outline" size="lg" className="rounded-xl">
                  <Link href="/employee-app/challenges">Find a challenge to share</Link>
                </Button>
              }
            />
          ) : (
            <>
              <TeamStats summary={data} />
              <div className="grid gap-5 lg:grid-cols-5">
                <TeamStepsCard summary={data} className="lg:col-span-2" />
                <TeamChallenges challenges={data.challenges} period={period} minGroupSize={data.minGroupSize} className="lg:col-span-3" />
              </div>
              <TeamLeaderboard period={period} teamId={teamId} />
            </>
          )}
        </div>
      )}
    </EngagePage>
  )
}

function MyTeamSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading team data">
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-12 rounded-xl" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-2xl lg:col-span-3" />
      </div>
    </div>
  )
}
