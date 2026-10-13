"use client"

import { Activity, Coins, Crown, Footprints, Medal, Percent, Trophy, Users } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { TrendChart } from "@/components/common/charts"
import { DataTable, type Column } from "@/components/common/data-table"
import { InlineBar, PrivacyNote, SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { EmptyState, ErrorState, PageSkeleton } from "@/components/common/states"
import { StatusBadge } from "@/components/common/status-badge"
import { PersonCell, UserAvatar } from "@/components/common/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { myTeamApi, type MyTeamMember, type MyTeamSummary, type TeamPeriod } from "@/lib/api/business/team"
import { useApiQuery } from "@/lib/api/hooks"
import { daysBetween, formatNumber, formatPercent, formatRelative, formatShortDate } from "@/lib/format"
import { cn } from "@/lib/utils"

/** My team (Team Manager) — SCR-M-079 content on the web. Aggregated team data; no health data. */
export default function MyTeamPage() {
  const [period, setPeriod] = useState<TeamPeriod>("week")
  const [teamId, setTeamId] = useState<string | undefined>()
  const summary = useApiQuery(["business", "my-team", "summary", period, teamId], () => myTeamApi.summary({ period, teamId }), { placeholderData: (p) => p })
  const activeTeamId = summary.data?.team.id

  return (
    <PageContainer>
      <PageHeader
        title={summary.data ? summary.data.team.name : "My team"}
        description={summary.data ? `${summary.data.team.departmentName} · how your team is doing — combined figures only.` : "How your team is doing — combined figures only."}
      />

      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" variant="outline" value={period} onValueChange={(v) => v && setPeriod(v as TeamPeriod)}>
          <ToggleGroupItem value="week" className="px-3">
            This week
          </ToggleGroupItem>
          <ToggleGroupItem value="month" className="px-3">
            This month
          </ToggleGroupItem>
        </ToggleGroup>
        {summary.data && summary.data.teams.length > 1 ? (
          <Select value={activeTeamId} onValueChange={setTeamId}>
            <SelectTrigger className="h-8 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {summary.data.teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {summary.isLoading ? (
        <PageSkeleton kpis={4} />
      ) : summary.error ? (
        summary.error.status === 404 ? (
          <EmptyState icon={Users} title="You don't manage a team yet" description="Ask your HR Admin to assign you as a Team Manager on the Teams page." />
        ) : (
          <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
        )
      ) : (
        <div className={cn("flex flex-col gap-6", summary.isFetching && "opacity-80 transition-opacity")}>
          <TeamBody data={summary.data!} period={period} />
          <MembersSection teamId={activeTeamId} />
          <LeaderboardSection teamId={activeTeamId} period={period} minGroupSize={summary.data!.minGroupSize} />
          <PrivacyNote minGroupSize={summary.data!.minGroupSize}>
            Team Managers see combined team figures, member status and points only. Steps, sleep, water and other health data stay private. Team averages are hidden when a team has fewer than {summary.data!.minGroupSize} people.
          </PrivacyNote>
        </div>
      )}
    </PageContainer>
  )
}

function TeamBody({ data, period }: { data: MyTeamSummary; period: TeamPeriod }) {
  const k = data.kpis
  const label = period === "week" ? "this week" : "this month"
  const hidden = `Hidden (< ${data.minGroupSize} people)`
  if (data.team.joinedCount === 0) return <EmptyState icon={Activity} title="Your team has no activity yet this week." description="Members appear here once they join HealthX." />
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Active members ${label}`} value={`${formatNumber(k.activeMembers)} of ${formatNumber(data.team.joinedCount)}`} icon={Users} tone="emerald" hint="activity or sign-in in the period" />
        <StatCard label="Participation" value={k.participation === null ? "—" : formatPercent(k.participation)} icon={Percent} tone="sky" hint={k.participation === null ? hidden : `company: ${formatPercent(data.rank.companyParticipation)}`} />
        <StatCard label="Average steps / day" value={k.avgStepsPerDay === null ? "—" : formatNumber(k.avgStepsPerDay)} icon={Footprints} tone="violet" hint={k.avgStepsPerDay === null ? hidden : "team average, active members"} />
        <StatCard label={`Points earned ${label}`} value={k.pointsEarned === null ? "—" : formatNumber(k.pointsEarned)} icon={Coins} tone="amber" hint={k.pointsEarned === null ? hidden : "whole team"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Active members per day" description="Members who logged a wellness activity that day.">
          {data.trend ? (
            <TrendChart data={data.trend} series={[{ key: "active", label: "Active members" }]} xFormatter={(v) => formatShortDate(v)} height={220} />
          ) : (
            <p className="rounded-xl border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">Hidden — your team has fewer than {data.minGroupSize} people.</p>
          )}
        </SectionCard>
        <SectionCard title="Team ranking" description="By participation, among teams of 5 or more.">
          <div className="flex items-center gap-4">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-amber-500/14 text-amber-600 dark:text-amber-400">
              <Medal className="size-8" />
            </span>
            <div>
              <p className="font-heading text-3xl font-bold tabular-nums">#{data.rank.position}</p>
              <p className="text-sm text-muted-foreground">of {data.rank.total} teams</p>
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">In a challenge</span>
              <span className="font-medium">{k.challengeParticipation === null ? hidden : formatPercent(k.challengeParticipation)}</span>
            </div>
            {k.challengeParticipation !== null ? <InlineBar value={k.challengeParticipation} max={1} /> : null}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Active challenges for your team"
        actions={
          <Link href="/business-portal/challenges" className="text-sm font-medium text-primary hover:underline">
            All challenges
          </Link>
        }
      >
        {data.challenges.length === 0 ? (
          <EmptyState icon={Trophy} title="No challenges running" description="Your HR team or Wellness Manager can launch one." className="py-8" />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {data.challenges.map((c) => (
              <li key={c.id}>
                <Link href={`/business-portal/challenges/${c.id}`} className="flex items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/40">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-lg" style={{ backgroundColor: `${c.coverColor}22` }}>
                    {c.coverEmoji}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{c.name}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">{Math.max(0, daysBetween(new Date().toISOString().slice(0, 10), c.endDate))} days left</span>
                    </div>
                    {c.avgProgress !== null ? <Progress value={c.avgProgress * 100} className="h-1.5" /> : null}
                    <p className="text-xs text-muted-foreground">
                      {c.joined} of {c.eligible} members joined
                      {c.avgProgress !== null ? ` · avg ${formatPercent(c.avgProgress)} complete` : ""}
                      {c.teamRank ? ` · team #${c.teamRank.position} of ${c.teamRank.total}` : ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  )
}

function MembersSection({ teamId }: { teamId?: string }) {
  const q = useApiQuery(["business", "my-team", "members", teamId], () => myTeamApi.members({ teamId }), { enabled: !!teamId })
  const columns: Column<MyTeamMember>[] = [
    {
      key: "name",
      header: "Member",
      sortValue: (m) => m.name,
      cell: (m) => (
        <div className="flex items-center gap-2">
          <PersonCell name={m.name} subtitle={m.jobTitle} color={m.avatarColor} />
          {m.isManager ? (
            <Badge variant="secondary" className="gap-1">
              <Crown /> Manager
            </Badge>
          ) : null}
        </div>
      ),
    },
    { key: "status", header: "Status", sortValue: (m) => m.status, cell: (m) => <StatusBadge status={m.status} /> },
    { key: "active", header: "Last active", sortValue: (m) => m.lastActiveAt ?? "", cell: (m) => <span className="text-sm text-muted-foreground">{m.lastActiveAt ? formatRelative(m.lastActiveAt) : "—"}</span>, hideOnMobile: true },
    { key: "points", header: "Points this month", align: "right", sortValue: (m) => m.pointsThisMonth, cell: (m) => <span className="tabular-nums">{formatNumber(m.pointsThisMonth)}</span>, hideOnMobile: true },
    {
      key: "challenges",
      header: "Challenges",
      align: "right",
      sortValue: (m) => m.activeChallenges,
      cell: (m) => (
        <span className="text-sm">
          {m.activeChallenges ? <span className="font-medium">{m.activeChallenges} active</span> : <span className="text-muted-foreground">None active</span>}
          <span className="hidden text-xs text-muted-foreground sm:inline"> · {m.challengesJoined} joined</span>
        </span>
      ),
    },
  ]
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-heading text-base font-semibold">Team members</h2>
        <p className="text-sm text-muted-foreground">Status and participation only — no health data.</p>
      </div>
      {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <DataTable columns={columns} rows={q.data ?? []} getRowId={(m) => m.id} loading={q.isLoading || !teamId} clientPageSize={12} emptyTitle="No members yet" />}
    </section>
  )
}

function LeaderboardSection({ teamId, period, minGroupSize }: { teamId?: string; period: TeamPeriod; minGroupSize: number }) {
  const [metric, setMetric] = useState<"points" | "steps">("steps")
  const [view, setView] = useState<"members" | "teams">("members")
  const q = useApiQuery(["business", "my-team", "leaderboard", teamId, metric, period], () => myTeamApi.leaderboard({ teamId, metric, period }), { enabled: !!teamId })
  const entries = view === "members" ? q.data?.members ?? [] : q.data?.teams ?? []
  return (
    <SectionCard
      title="Leaderboard"
      description={view === "members" ? "Your team, using the company's name-privacy setting." : "Team averages for teams of 5 or more."}
      actions={
        <div className="flex flex-wrap gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
            <TabsList>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="teams">Teams</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
            <TabsList>
              <TabsTrigger value="steps">Steps</TabsTrigger>
              <TabsTrigger value="points">Points</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      }
    >
      {q.isLoading || !teamId ? (
        <PageSkeleton kpis={0} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No rankings yet for this period.</p>
      ) : (
        <ol className="divide-y rounded-xl border">
          {entries.slice(0, 15).map((e) => {
            const hiddenTeam = view === "teams" && (e.memberCount ?? 0) < minGroupSize
            return (
              <li key={e.id} className={cn("flex items-center gap-3 px-3 py-2.5", e.isMe && "bg-primary/5")}>
                <span className={cn("w-7 text-center font-heading text-sm font-bold tabular-nums", e.rank <= 3 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{e.rank}</span>
                <UserAvatar name={e.name} color={e.avatarColor} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm", e.isMe ? "font-semibold" : "font-medium")}>{e.name}</p>
                  {e.subtitle ? <p className="truncate text-xs text-muted-foreground">{e.subtitle}</p> : null}
                </div>
                <span className="text-sm font-semibold tabular-nums">{hiddenTeam ? <span className="text-xs font-normal text-muted-foreground">Hidden</span> : formatNumber(e.value)}</span>
                <span className="hidden w-14 text-xs text-muted-foreground sm:inline">{metric === "steps" ? (view === "teams" ? "avg steps" : "steps") : view === "teams" ? "avg pts" : "pts"}</span>
              </li>
            )
          })}
        </ol>
      )}
    </SectionCard>
  )
}
