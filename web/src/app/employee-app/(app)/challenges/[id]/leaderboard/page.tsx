"use client"

import { ArrowLeft, Medal, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { EmptyState } from "@/components/common/states"
import { NameDisplayNote, Podium, RankList, useRankAlertToast } from "@/components/employee/engage/leaderboard"
import { EngagePage, LoadError, Segmented } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { challengesApi, formatMetricValue } from "@/lib/api/employee/challenges"
import { useApiQuery } from "@/lib/api/hooks"
import { formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

/** SCR-M-045 Challenge Leaderboard. */
export default function ChallengeLeaderboardPage() {
  const { id } = useParams<{ id: string }>()
  const [view, setView] = useState<"groups" | "individual" | undefined>(undefined)
  const q = useApiQuery(["employee", "challenge", id, "leaderboard", view ?? "default"], () => challengesApi.leaderboard({ id, view }), { placeholderData: (prev) => prev })
  const d = q.data
  useRankAlertToast(d?.rankAlert)
  const fmt = (v: number) => (d ? formatMetricValue(v, d.challenge.metric, false) : String(v))

  return (
    <EngagePage>
      <Link href={`/employee-app/challenges/${id}`} className="-mb-2 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Challenge details
      </Link>

      {q.error && !d ? (
        <LoadError title="Couldn't load the leaderboard." error={q.error} onRetry={() => q.refetch()} />
      ) : !d ? (
        <>
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-2xl text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${d.challenge.coverColor}, ${d.challenge.coverColor}b3)` }}>
              {d.challenge.coverEmoji}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-heading text-xl font-bold tracking-tight sm:text-2xl">{d.challenge.name}</h1>
              <p className="text-sm text-muted-foreground">
                Leaderboard · {d.total} {d.view === "groups" ? (d.challenge.teamUnit === "team" ? "teams" : "departments") : "participants"} · Updated {formatRelative(d.updatedAt)}
              </p>
            </div>
            <Button variant="outline" size="lg" className="rounded-xl" onClick={() => q.refetch()} disabled={q.isFetching} aria-label="Refresh leaderboard">
              <RefreshCw className={cn(q.isFetching && "animate-spin")} data-icon="inline-start" /> Refresh
            </Button>
          </div>

          {d.hasGroups ? (
            <Segmented
              ariaLabel="Leaderboard view"
              value={d.view}
              onChange={(v) => setView(v)}
              options={[
                { value: "groups", label: d.challenge.teamUnit === "team" ? "Teams" : "Departments" },
                { value: "individual", label: "People" },
              ]}
            />
          ) : null}

          {d.entries.length === 0 || d.entries.every((e) => e.value === 0) ? (
            <EmptyState icon={Medal} title="Rankings appear once participants start logging activity." description="Check back after the next sync." />
          ) : (
            <div className={cn("space-y-4", q.isFetching && "opacity-70 transition-opacity")}>
              <div className="rounded-3xl border bg-gradient-to-b from-amber-500/10 via-card to-card px-3 pt-8 pb-0 shadow-xs sm:px-8">
                <Podium entries={d.entries.slice(0, 3)} valueFormatter={fmt} unit={d.view === "groups" ? "avg" : d.challenge.unit} />
              </div>
              <RankList entries={d.entries} me={d.me} skipTop={3} valueFormatter={fmt} unit={d.view === "groups" ? `avg ${d.challenge.unit}` : d.challenge.unit} />
              {d.view === "individual" ? <NameDisplayNote mode={d.nameDisplay} /> : null}
            </div>
          )}
        </>
      )}
    </EngagePage>
  )
}
