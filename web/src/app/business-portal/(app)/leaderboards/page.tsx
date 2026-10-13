"use client"

import { Info, Medal, Monitor, Settings2, ShieldCheck, UsersRound } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { leaderboardFormatter } from "@/components/business/engagement/leaderboards/format"
import { ShareBoardDialog } from "@/components/business/engagement/leaderboards/share-board-dialog"
import { LeaderboardList, Podium } from "@/components/business/engagement/leaderboard-list"
import { SectionCard } from "@/components/common/misc"
import { PhaseBadge } from "@/components/common/status-badge"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { EmptyState, ErrorState } from "@/components/common/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { leaderboardsApi, type LeaderboardQuery } from "@/lib/api/business/leaderboards"
import { useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { formatNumber } from "@/lib/format"
import type { LeaderboardMetric, LeaderboardScope } from "@/lib/types"

const NAME_DISPLAY = {
  full_name: { label: "Full names", example: "Priya Sharma" },
  first_name_initial: { label: "First name + last initial", example: "Priya S." },
  anonymous: { label: "Anonymous", example: "Anonymous colleague" },
} as const

const METRICS: { value: LeaderboardMetric; label: string }[] = [
  { value: "steps", label: "Steps" },
  { value: "points", label: "Points" },
  { value: "workouts", label: "Workouts" },
  { value: "active_days", label: "Active days" },
]

function LeaderboardsPage() {
  const can = useCan()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const options = useApiQuery(["business", "leaderboards", "options"], () => leaderboardsApi.options())
  const isTm = options.data?.role === "team_manager" || can("team.view")
  const scopes: LeaderboardScope[] = isTm ? ["team", "challenge"] : ["company", "department", "team", "challenge"]

  const initialScope = params.get("scope") as LeaderboardScope | null
  const [scopeState, setScope] = useState<LeaderboardScope | null>(initialScope)
  const scope: LeaderboardScope = scopeState && scopes.includes(scopeState) ? scopeState : scopes[0]!
  const [metric, setMetric] = useState<LeaderboardMetric>("steps")
  const [period, setPeriod] = useState<"today" | "week" | "month">("week")
  const [shareOpen, setShareOpen] = useState(false)
  const [departmentId, setDepartmentId] = useState<string>("compare")
  const [teamIdState, setTeamId] = useState<string | null>(null)
  const [challengeIdState, setChallengeId] = useState<string | null>(params.get("challengeId"))
  const [limit, setLimit] = useState(25)

  const teams = options.data?.teams ?? []
  const teamId = teamIdState ?? (isTm ? (teams[0]?.id ?? "compare") : "compare")
  const challenges = options.data?.challenges ?? []
  const challengeId = challengeIdState && challenges.some((c) => c.id === challengeIdState) ? challengeIdState : challenges[0]?.id

  const query: LeaderboardQuery = {
    scope,
    metric,
    period: scope === "challenge" ? "challenge" : period,
    departmentId: scope === "department" && departmentId !== "compare" ? departmentId : undefined,
    teamId: scope === "team" && teamId !== "compare" ? teamId : undefined,
    challengeId: scope === "challenge" ? challengeId : undefined,
    limit,
  }
  const ready = !!options.data && (scope !== "challenge" || !!challengeId)
  const board = useApiQuery(["business", "leaderboards", query], () => leaderboardsApi.get(query), { enabled: ready, placeholderData: (p) => p })

  const changeScope = (s: LeaderboardScope) => {
    setScope(s)
    router.replace(s === scopes[0] ? pathname : `${pathname}?scope=${s}`, { scroll: false })
  }

  const r = board.data
  const fmt = r ? leaderboardFormatter(r) : (v: number) => formatNumber(v)
  const podium = r && r.entries.length >= 3
  const nameDisplay = options.data ? NAME_DISPLAY[options.data.nameDisplay] : null

  return (
    <PageContainer>
      <PageHeader
        title="Leaderboards"
        description={isTm ? "Your team's rankings — the same ones employees see in the app." : "Company, department, team and challenge rankings — exactly as employees see them in the app."}
        badge={nameDisplay ? <Badge variant="secondary">Names: {nameDisplay.label}</Badge> : undefined}
        actions={
          can("challenges.manage") ? (
            <Button variant="outline" onClick={() => setShareOpen(true)} disabled={!r}>
              <Monitor data-icon="inline-start" /> Share as TV board <PhaseBadge phase={2} />
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3">
        <Tabs value={scope} onValueChange={(v) => changeScope(v as LeaderboardScope)}>
          <TabsList>
            {scopes.map((s) => (
              <TabsTrigger key={s} value={s} className="px-3">
                {s === "company" ? "Company" : s === "department" ? "Department" : s === "team" ? (isTm ? "My team" : "Team") : "Challenge"}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          {scope === "department" ? (
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="h-9 w-52" aria-label="Department">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compare">Compare departments</SelectItem>
                <SelectSeparator />
                {options.data?.departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {scope === "team" ? (
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger className="h-9 w-52" aria-label="Team">
                <SelectValue placeholder="Choose a team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compare">{isTm ? "All teams (positions)" : "Compare teams"}</SelectItem>
                <SelectSeparator />
                {isTm
                  ? teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))
                  : (options.data?.departments ?? []).map((d) => (
                      <SelectGroup key={d.id}>
                        <SelectLabel>{d.name}</SelectLabel>
                        {teams
                          .filter((t) => t.departmentId === d.id)
                          .map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    ))}
              </SelectContent>
            </Select>
          ) : null}
          {scope === "challenge" ? (
            <Select value={challengeId ?? ""} onValueChange={setChallengeId} disabled={challenges.length === 0}>
              <SelectTrigger className="h-9 w-72 max-w-full" aria-label="Challenge">
                <SelectValue placeholder="No challenges yet" />
              </SelectTrigger>
              <SelectContent>
                {(["active", "completed"] as const).map((st) =>
                  challenges.some((c) => c.status === st) ? (
                    <SelectGroup key={st}>
                      <SelectLabel>{st === "active" ? "Running now" : "Completed"}</SelectLabel>
                      {challenges
                        .filter((c) => c.status === st)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.coverEmoji} {c.name}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  ) : null,
                )}
              </SelectContent>
            </Select>
          ) : (
            <>
              <Select value={metric} onValueChange={(v) => setMetric(v as LeaderboardMetric)}>
                <SelectTrigger className="h-9 w-40" aria-label="Metric">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRICS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ToggleGroup type="single" variant="outline" value={period} onValueChange={(v) => v && setPeriod(v as "today" | "week" | "month")} aria-label="Period">
                <ToggleGroupItem value="today" className="h-9 px-3">
                  Today
                </ToggleGroupItem>
                <ToggleGroupItem value="week" className="h-9 px-3">
                  This week
                </ToggleGroupItem>
                <ToggleGroupItem value="month" className="h-9 px-3">
                  This month
                </ToggleGroupItem>
              </ToggleGroup>
            </>
          )}
          {scope === "challenge" && challengeId ? (
            <Button asChild variant="ghost" size="sm" className="ml-auto">
              <Link href={`/business-portal/challenges/${challengeId}`}>Challenge details</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          {options.error || board.error ? (
            <ErrorState error={new Error(`Couldn't load leaderboard. ${(board.error ?? options.error)?.message ?? ""}`)} onRetry={() => (options.error ? options.refetch() : board.refetch())} />
          ) : scope === "challenge" && options.data && challenges.length === 0 ? (
            <EmptyState icon={Medal} title="No challenge rankings yet" description="Rankings appear here once a challenge starts and people join." />
          ) : !r || options.isLoading || (board.isLoading && ready) ? (
            <BoardSkeleton />
          ) : r.entries.length === 0 ? (
            <EmptyState icon={Medal} title="No rankings yet for this period." description={r.kind === "groups" ? `Groups need at least ${r.minGroupSize} members who use the app to be ranked.` : "Rankings appear as soon as people log activity."} />
          ) : (
            <SectionCard
              title={r.title}
              description={`${r.periodLabel} · ${r.kind === "groups" ? `average ${r.unit} per person` : r.unit}${r.total > r.entries.length ? ` · top ${r.entries.length} of ${formatNumber(r.total)}` : ` · ${formatNumber(r.total)} ranked`}`}
              className={board.isFetching ? "opacity-70 transition-opacity" : "transition-opacity"}
            >
              <div className="flex flex-col gap-6">
                {podium ? (
                  <div className="rounded-xl bg-gradient-to-b from-primary/6 to-transparent px-2 pt-6 sm:px-8">
                    <Podium entries={r.entries.slice(0, 3)} formatValue={fmt} avatars={r.kind === "people"} />
                  </div>
                ) : null}
                <LeaderboardList
                  entries={podium ? r.entries.slice(3) : r.entries}
                  formatValue={fmt}
                  avatars={r.kind === "people"}
                  showProgress={r.entries.some((e) => e.progress !== undefined)}
                  maxValue={r.entries[0]?.value}
                />
                {r.total > r.entries.length ? (
                  <Button variant="outline" size="sm" className="self-center" onClick={() => setLimit(100)} disabled={board.isFetching}>
                    Show top {Math.min(100, r.total)}
                  </Button>
                ) : null}
                {r.hiddenGroups > 0 ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5" /> {formatNumber(r.hiddenGroups)} {r.hiddenGroups === 1 ? "group is" : "groups are"} hidden because {r.hiddenGroups === 1 ? "it has" : "they have"} fewer than {r.minGroupSize} people.
                  </p>
                ) : null}
              </div>
            </SectionCard>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {r?.myTeams?.length ? (
            <SectionCard
              title={
                <span className="inline-flex items-center gap-2">
                  <UsersRound className="size-4 text-primary" /> Your team&apos;s position
                </span>
              }
              description={scope === "challenge" ? "Among all teams on the selected metric." : `Among all teams · ${r.periodLabel.toLowerCase()} · average ${r.unit} per person`}
            >
              <ul className="space-y-3">
                {r.myTeams.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 rounded-xl border p-3">
                    <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <span className="font-heading text-lg leading-none font-bold">{t.rank ?? "–"}</span>
                      <span className="text-[10px]">of {t.of}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.rank === null ? `Hidden — fewer than ${r.minGroupSize} members use the app` : `${fmt(t.value ?? 0)} avg · ${t.members} members`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}

          <SectionCard
            title={
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" /> Privacy on leaderboards
              </span>
            }
            actions={
              can("settings.manage") ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/business-portal/settings/company">
                    <Settings2 data-icon="inline-start" /> Change
                  </Link>
                </Button>
              ) : undefined
            }
          >
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Names shown as</dt>
                <dd className="text-right font-medium">{nameDisplay?.label ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Example</dt>
                <dd className="text-right font-medium">{nameDisplay?.example ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Opt-out</dt>
                <dd className="text-right font-medium">{r ? (r.allowOptOut ? `Allowed · ${formatNumber(r.optedOut)} opted out here` : "Not allowed") : "—"}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">
              Leaderboard totals are the only individual figures company admins can see. People who opted out stay in the ranking as “Anonymous colleague”. Groups under {r?.minGroupSize ?? 5} people are never ranked.
            </p>
          </SectionCard>

          <SectionCard
            title={
              <span className="inline-flex items-center gap-2">
                <Info className="size-4 text-muted-foreground" /> How rankings work
              </span>
            }
          >
            <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
              <li>Steps, workouts and active days sync from employees&apos; phones and wearables.</li>
              <li>Points include steps, workouts, habits, streaks and challenge bonuses.</li>
              <li>Department and team rankings use the average per member who uses the app, so bigger groups don&apos;t win by size alone.</li>
              <li>Arrows show movement since the same point in the previous period.</li>
            </ul>
          </SectionCard>
        </div>
      </div>
      {options.data && r ? (
        <ShareBoardDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          query={query}
          defaultTitle={scope === "challenge" ? r.title : `${r.title} — ${r.periodLabel.toLowerCase()} ${r.unit}`}
          companyNameDisplay={options.data.nameDisplay}
        />
      ) : null}
    </PageContainer>
  )
}

function BoardSkeleton() {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-6">
      <Skeleton className="h-5 w-48" />
      <div className="grid grid-cols-3 items-end gap-4">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10" />
      ))}
    </div>
  )
}

export default function Page() {
  return (
    <Suspense>
      <LeaderboardsPage />
    </Suspense>
  )
}
