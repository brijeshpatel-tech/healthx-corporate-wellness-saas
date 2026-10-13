"use client"

import { ArrowDownRight, ArrowUpRight, Building2, ChevronRight, EyeOff, Minus, Network, Trophy, UsersRound } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { EmptyState } from "@/components/common/states"
import { ChipTabs, EngagePage, IconTile, LoadError, type Tone } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { LB_METRIC_LABEL, LB_PERIOD_LABEL, leaderboardsApi, type LbPeriod, type LbScope, type MyRankResult } from "@/lib/api/employee/leaderboards"
import { useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import type { LeaderboardMetric } from "@/lib/types"
import { cn } from "@/lib/utils"

const METRICS: LeaderboardMetric[] = ["steps", "points", "workouts", "active_days"]
const PERIODS: LbPeriod[] = ["today", "week", "month"]
const SCOPE_META: Record<LbScope, { icon: typeof Building2; tone: Tone }> = {
  company: { icon: Building2, tone: "emerald" },
  department: { icon: Network, tone: "violet" },
  team: { icon: UsersRound, tone: "sky" },
}

/** SCR-M-049 My Rank (Individual). */
export default function MyRankPage() {
  return (
    <Suspense fallback={<EngagePage title="My rank"><Skeleton className="h-96 rounded-3xl" /></EngagePage>}>
      <MyRank />
    </Suspense>
  )
}

function MyRank() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const metricParam = params.get("metric")
  const periodParam = params.get("period")
  const metric = (METRICS as string[]).includes(metricParam ?? "") ? (metricParam as LeaderboardMetric) : "steps"
  const period = (PERIODS as string[]).includes(periodParam ?? "") ? (periodParam as LbPeriod) : "week"
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params.toString())
    next.set(k, v)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }
  const q = useApiQuery(["employee", "my-rank", metric, period], () => leaderboardsApi.myRank({ metric, period }), { placeholderData: (prev) => prev })

  return (
    <EngagePage title="My rank" description="Your position across the company, your department and your team." backHref="/employee-app/leaderboards" backLabel="Leaderboards">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <ChipTabs<LeaderboardMetric> ariaLabel="Metric" value={metric} onChange={(v) => set("metric", v)} options={METRICS.map((m) => ({ value: m, label: LB_METRIC_LABEL[m] }))} />
        <div className="flex items-center gap-1 self-start rounded-xl bg-muted p-1" role="tablist" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={p === period}
              onClick={() => set("period", p)}
              className={cn("h-8 rounded-lg px-3 text-sm font-medium transition-all", p === period ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {LB_PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {q.error && !q.data ? (
        <LoadError title="Couldn't load your rank." error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <>
          <Skeleton className="h-36 rounded-3xl" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-2xl" />
            ))}
          </div>
        </>
      ) : q.data.myValue === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Join a challenge or log activity to get ranked."
          description="Your rank appears as soon as you have activity in this period."
          action={
            <Button asChild>
              <Link href="/employee-app/challenges?tab=available">Browse challenges</Link>
            </Button>
          }
        />
      ) : (
        <RankView r={q.data} period={period} metric={metric} fetching={q.isFetching} />
      )}
    </EngagePage>
  )
}

function RankView({ r, period, metric, fetching }: { r: MyRankResult; period: LbPeriod; metric: LeaderboardMetric; fetching: boolean }) {
  const company = r.ranks[0]!
  const first = r.trend[0]!.rank
  const climbed = first - company.rank
  return (
    <div className={cn("flex flex-col gap-5", fetching && "opacity-70 transition-opacity")}>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 p-5 text-white shadow-lg shadow-orange-500/20 sm:p-6">
        <div className="bg-grid absolute inset-0 opacity-10" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white/85">
              {LB_METRIC_LABEL[metric]} · {LB_PERIOD_LABEL[period].toLowerCase()}
            </p>
            <p className="font-heading text-4xl font-extrabold tabular-nums">
              {formatNumber(r.myValue)} <span className="text-lg font-semibold text-white/85">{r.unit}</span>
            </p>
            <p className="mt-1 text-sm text-white/90">
              Top {company.topPercent}% of {company.label}
            </p>
          </div>
          <div className="rounded-2xl bg-white/15 px-4 py-3 text-right backdrop-blur-sm">
            <p className="text-xs text-white/80">Last 6 weeks</p>
            <p className="font-heading text-lg font-bold">{climbed > 0 ? `▲ ${climbed} places` : climbed < 0 ? `▼ ${-climbed} places` : "Holding steady"}</p>
          </div>
        </div>
        <div className="relative mt-4 flex items-center gap-1.5 overflow-x-auto pb-1" aria-label="Company rank trend">
          {r.trend.map((t, i) => (
            <div key={t.label} className="flex items-center gap-1.5">
              <div className={cn("flex min-w-14 flex-col items-center rounded-xl px-2 py-1.5", i === r.trend.length - 1 ? "bg-white text-orange-600" : "bg-white/15")}>
                <span className="font-heading text-sm font-extrabold tabular-nums">#{t.rank}</span>
                <span className="text-[10px] whitespace-nowrap opacity-80">{t.label}</span>
              </div>
              {i < r.trend.length - 1 ? <ChevronRight className="size-3.5 shrink-0 opacity-60" /> : null}
            </div>
          ))}
        </div>
      </div>

      {r.optedOut ? (
        <p className="flex items-center gap-2 rounded-xl border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
          <EyeOff className="size-4 shrink-0" /> You&apos;re hidden from leaderboards — only you can see these positions.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {r.ranks.map((x) => {
          const meta = SCOPE_META[x.scope]
          const toNextPct = x.gapToNext ? Math.max(4, Math.min(96, (r.myValue / (r.myValue + x.gapToNext)) * 100)) : 100
          return (
            <Card key={x.scope} className="gap-0 py-0">
              <CardContent className="flex h-full flex-col gap-4 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <IconTile icon={meta.icon} tone={meta.tone} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground capitalize">{x.scope}</p>
                    <p className="truncate text-sm font-semibold">{x.label}</p>
                  </div>
                  <Change value={x.change} />
                </div>
                <p className="font-heading text-4xl font-extrabold tabular-nums">
                  #{x.rank}
                  <span className="ml-1 text-base font-medium text-muted-foreground">of {formatNumber(x.total)}</span>
                </p>
                <div className="mt-auto space-y-1.5">
                  {x.gapToNext ? (
                    <>
                      <p className="text-sm">
                        <span className="font-semibold">
                          {formatNumber(x.gapToNext)} {r.unit}
                        </span>{" "}
                        <span className="text-muted-foreground">to #{x.nextRank}</span>
                      </p>
                      <Progress value={toNextPct} className="h-2" />
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">🏆 You&apos;re top of the {x.scope}!</p>
                  )}
                </div>
                <Button asChild variant="outline" className="h-10 rounded-xl">
                  <Link href={`/employee-app/leaderboards?scope=${x.scope}${x.scope === "company" ? "" : "&view=people"}&metric=${metric}&period=${period}`}>Open full leaderboard</Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function Change({ value }: { value: number }) {
  if (value === 0)
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
        <Minus className="size-3" /> 0
      </span>
    )
  return value > 0 ? (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/12 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300" title="vs last week">
      <ArrowUpRight className="size-3" /> {value}
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/12 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-300" title="vs last week">
      <ArrowDownRight className="size-3" /> {-value}
    </span>
  )
}
