"use client"

import { ChevronRight, Medal, RefreshCw, ShieldCheck, Trophy } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { EmptyState } from "@/components/common/states"
import { NameDisplayNote, Podium, RankList, useRankAlertToast } from "@/components/employee/engage/leaderboard"
import { ChipTabs, EngagePage, LoadError, Segmented } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { challengesApi, formatMetricValue } from "@/lib/api/employee/challenges"
import { LB_METRIC_LABEL, LB_PERIOD_LABEL, leaderboardsApi, type LbPeriod, type LbScope, type LbView } from "@/lib/api/employee/leaderboards"
import { useApiQuery } from "@/lib/api/hooks"
import { formatNumber, formatRelative } from "@/lib/format"
import type { LeaderboardMetric } from "@/lib/types"
import { cn } from "@/lib/utils"

const SCOPES: LbScope[] = ["company", "department", "team"]
const METRICS: LeaderboardMetric[] = ["steps", "points", "workouts", "active_days"]
const PERIODS: (LbPeriod | "challenge")[] = ["today", "week", "month", "challenge"]
const PERIOD_LABEL: Record<LbPeriod | "challenge", string> = { ...LB_PERIOD_LABEL, challenge: "Challenge" }

function pick<T extends string>(value: string | null, list: readonly T[], fallback: T): T {
  return value && (list as readonly string[]).includes(value) ? (value as T) : fallback
}

/** SCR-M-048 Leaderboards — company, department and team. */
export default function LeaderboardsPage() {
  return (
    <Suspense fallback={<EngagePage title="Leaderboards"><Skeleton className="h-96 rounded-3xl" /></EngagePage>}>
      <Leaderboards />
    </Suspense>
  )
}

function Leaderboards() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const scope = pick(params.get("scope"), SCOPES, "company")
  const metric = pick(params.get("metric"), METRICS, "steps")
  const periodSel = pick(params.get("period"), PERIODS, "week")
  const period: LbPeriod = periodSel === "challenge" ? "week" : periodSel
  const view = pick<LbView>(params.get("view"), ["groups", "people"], "groups")

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    Object.entries(patch).forEach(([k, v]) => (v === null ? next.delete(k) : next.set(k, v)))
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const q = useApiQuery(["employee", "leaderboards", scope, metric, period, view], () => leaderboardsApi.list({ scope, metric, period, view }), { placeholderData: (prev) => prev, enabled: periodSel !== "challenge" })
  const d = q.data
  useRankAlertToast(d?.rankAlert)
  const unit = d ? (d.view === "groups" ? `avg ${d.unit}` : d.unit) : ""
  const empty = d && (d.entries.length === 0 || d.entries.every((e) => e.value === 0))

  return (
    <EngagePage
      title="Leaderboards"
      description="See how you stack up against colleagues — your position is always pinned."
      actions={
        <Button asChild variant="outline" size="lg" className="rounded-xl">
          <Link href={`/employee-app/leaderboards/me?metric=${metric}&period=${period}`}>
            <Medal data-icon="inline-start" /> My rank
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Segmented
          ariaLabel="Leaderboard scope"
          value={scope}
          onChange={(v) => set({ scope: v === "company" ? null : v, view: null })}
          options={[
            { value: "company", label: "Company" },
            { value: "department", label: "Department" },
            { value: "team", label: "Team" },
          ]}
        />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <ChipTabs<LeaderboardMetric> ariaLabel="Metric" value={metric} onChange={(v) => set({ metric: v === "steps" ? null : v })} options={METRICS.map((m) => ({ value: m, label: LB_METRIC_LABEL[m] }))} />
          <div className="flex items-center gap-1 self-start rounded-xl bg-muted p-1" role="tablist" aria-label="Period">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={p === periodSel}
                onClick={() => set({ period: p === "week" ? null : p })}
                className={cn("h-8 rounded-lg px-2.5 text-sm font-medium transition-all sm:px-3", p === periodSel ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
        {scope !== "company" ? (
          <ChipTabs<LbView>
            ariaLabel="Ranking view"
            value={view}
            onChange={(v) => set({ view: v === "groups" ? null : v })}
            options={[
              { value: "groups", label: scope === "department" ? "All departments" : "All teams" },
              { value: "people", label: scope === "department" ? "People in my department" : "People in my team" },
            ]}
          />
        ) : null}
      </div>

      {periodSel === "challenge" ? (
        <ChallengeBoards />
      ) : q.error && !d ? (
        <LoadError title="Couldn't load the leaderboard." error={q.error} onRetry={() => q.refetch()} />
      ) : !d ? (
        <>
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </>
      ) : (
        <div className={cn("flex flex-col gap-4", q.isFetching && "opacity-70 transition-opacity")}>
          {d.me ? (
            <Link
              href={`/employee-app/leaderboards/me?metric=${metric}&period=${period}`}
              className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 p-4 text-white shadow-lg shadow-emerald-500/20 transition-transform hover:-translate-y-0.5"
            >
              <span className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/20">
                <span className="text-[10px] font-semibold uppercase opacity-85">{d.view === "groups" ? "Yours" : "You"}</span>
                <span className="font-heading text-xl leading-none font-extrabold">#{d.me.rank}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white/85">
                  {d.view === "groups" ? d.me.name : d.scopeLabel} · {LB_PERIOD_LABEL[period].toLowerCase()}
                </p>
                <p className="truncate font-heading text-lg font-bold">
                  {formatNumber(d.me.value)} {unit} <span className="text-sm font-medium text-white/80">· of {formatNumber(d.total)}</span>
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-white/80" />
            </Link>
          ) : null}

          {empty ? (
            <EmptyState icon={Medal} title="No rankings yet for this period." description="Try a longer period or another metric." />
          ) : (
            <>
              <div className="rounded-3xl border bg-gradient-to-b from-amber-500/10 via-card to-card px-3 pt-8 shadow-xs sm:px-10">
                <Podium entries={d.entries.slice(0, 3)} unit={unit} />
              </div>
              <RankList entries={d.entries} me={d.me} skipTop={3} unit={unit} />
            </>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              {d.view === "people" ? <NameDisplayNote mode={d.nameDisplay} optedOut={d.optedOut} /> : null}
              {d.view === "groups" ? (
                <p className="flex items-start gap-1.5 px-1 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                  Groups are ranked by average per person.{d.hiddenGroups ? ` ${d.hiddenGroups} group${d.hiddenGroups === 1 ? " has" : "s have"} fewer than ${d.minGroupSize} members and ${d.hiddenGroups === 1 ? "isn't" : "aren't"} ranked to protect privacy.` : ""}
                </p>
              ) : null}
            </div>
            <button type="button" onClick={() => q.refetch()} className="inline-flex shrink-0 items-center gap-1.5 px-1 text-xs text-muted-foreground hover:text-foreground">
              <RefreshCw className={cn("size-3.5", q.isFetching && "animate-spin")} /> Updated {formatRelative(d.updatedAt)}
            </button>
          </div>
        </div>
      )}
    </EngagePage>
  )
}

/** Period "Challenge" (#157): pick one of your challenges to see its leaderboard. */
function ChallengeBoards() {
  const q = useApiQuery(["employee", "challenges", "active", "all"], () => challengesApi.list({ status: "active", type: "all" }))
  if (q.error) return <LoadError title="Couldn't load your challenges." error={q.error} onRetry={() => q.refetch()} />
  if (!q.data) return <Skeleton className="h-60 rounded-2xl" />
  if (!q.data.items.length)
    return (
      <EmptyState
        icon={Trophy}
        title="Join a challenge to see its leaderboard"
        action={
          <Button asChild>
            <Link href="/employee-app/challenges?tab=available">Browse challenges</Link>
          </Button>
        }
      />
    )
  return (
    <div className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
      {q.data.items.map((c) => (
        <Link key={c.id} href={`/employee-app/challenges/${c.id}/leaderboard`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl text-white" style={{ background: `linear-gradient(135deg, ${c.coverColor}, ${c.coverColor}b3)` }}>
            {c.coverEmoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{c.name}</p>
            <p className="text-xs text-muted-foreground">
              {c.myProgress !== null ? `${formatMetricValue(c.myProgress, c.metric)} · ` : ""}
              {formatNumber(c.participantsCount)} participants
            </p>
          </div>
          {c.myRank ? <span className="rounded-full bg-amber-500/12 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">#{c.myRank}</span> : null}
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ))}
    </div>
  )
}
