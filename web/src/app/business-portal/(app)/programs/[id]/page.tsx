"use client"

import { Activity, Archive, BarChart3, CalendarClock, CheckCircle2, Coins, Megaphone, Pencil, Rocket, Target, Trash2, Trophy, Users } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useProgramActions } from "@/components/business/engagement/programs/program-actions"
import { PROGRAM_METRIC_META, addDaysYmd as addDays, formatGoalTarget } from "@/components/business/engagement/programs/program-meta"
import { BarsChart, TrendChart } from "@/components/common/charts"
import { InlineBar, KeyValueList, PrivacyNote, SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { EmptyState, ErrorState, PageSkeleton, QueryState } from "@/components/common/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { programsApi, type ProgramAnalytics, type ProgramDetail } from "@/lib/api/business/programs"
import { useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { formatDate, formatNumber, formatPercent, formatShortDate, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>()
  const detail = useApiQuery(["business", "programs", "detail", id], () => programsApi.get({ id }))
  return (
    <PageContainer>
      <QueryState query={detail} loading={<PageSkeleton />}>
        {(p) => <ProgramBody p={p} />}
      </QueryState>
    </PageContainer>
  )
}

function ProgramBody({ p }: { p: ProgramDetail }) {
  const router = useRouter()
  const can = useCan()
  const manage = can("programs.manage")
  const actions = useProgramActions(p, { onDeleted: () => router.push("/business-portal/programs") })
  const analytics = useApiQuery(["business", "programs", "analytics", p.id], () => programsApi.analytics({ id: p.id }))
  const live = p.status === "active" || p.status === "scheduled"

  return (
    <>
      <PageHeader
        backHref="/business-portal/programs"
        backLabel="Wellness programs"
        title={
          <span className="inline-flex items-center gap-2">
            <span aria-hidden>{p.coverEmoji}</span> {p.name}
          </span>
        }
        badge={
          <>
            <StatusBadge status={p.status} />
            <PhaseBadge phase={2} />
          </>
        }
        description={`${pluralize(p.durationWeeks, "week")} · ${p.startDate ? `${formatDate(p.startDate, "d MMM")} – ${formatDate(p.endDate, "d MMM yyyy")}` : "No start date"} · ${p.audienceLabel}`}
        actions={
          <>
            {manage && p.canEdit ? (
              <Button asChild variant="outline">
                <Link href={`/business-portal/programs/${p.id}/edit`}>
                  <Pencil data-icon="inline-start" /> Edit
                </Link>
              </Button>
            ) : null}
            {can("announcements.manage") && live ? (
              <Button asChild variant="outline">
                <Link href={`/business-portal/announcements/new?programId=${p.id}`}>
                  <Megaphone data-icon="inline-start" /> Send announcement
                </Link>
              </Button>
            ) : null}
            {manage && p.canPublish ? (
              <Button onClick={() => actions.ask("publish")} disabled={actions.pending}>
                <Rocket data-icon="inline-start" /> Publish
              </Button>
            ) : null}
            {manage && (p.canArchive || p.canDelete) ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={actions.pending}>
                    More
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {p.canArchive ? (
                    <DropdownMenuItem variant="destructive" onClick={() => actions.ask("archive")}>
                      <Archive /> Archive
                    </DropdownMenuItem>
                  ) : null}
                  {p.canDelete ? (
                    <DropdownMenuItem variant="destructive" onClick={() => actions.ask("delete")}>
                      <Trash2 /> Delete draft
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </>
        }
      />

      {analytics.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : analytics.error ? (
        <ErrorState error={analytics.error} onRetry={() => analytics.refetch()} />
      ) : analytics.data ? (
        analytics.data.started ? (
          <Analytics a={analytics.data} p={p} />
        ) : (
          <EmptyState
            icon={BarChart3}
            title="Analytics appear once the program starts."
            description={
              p.status === "scheduled"
                ? `It starts ${formatDate(p.startDate, "EEEE d MMM")}. ${formatNumber(p.eligibleCount)} employees can enrol — a short announcement helps.`
                : p.status === "draft"
                  ? "Publish the program to invite employees. Enrolment and weekly completion show up here after the start date."
                  : "This program was archived before it started."
            }
            action={
              p.status === "scheduled" && can("announcements.manage") ? (
                <Button asChild>
                  <Link href={`/business-portal/announcements/new?programId=${p.id}`}>
                    <Megaphone data-icon="inline-start" /> Send announcement
                  </Link>
                </Button>
              ) : p.status === "draft" && manage ? (
                <Button onClick={() => actions.ask("publish")}>
                  <Rocket data-icon="inline-start" /> Publish program
                </Button>
              ) : undefined
            }
          />
        )
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <WeeklyPlan p={p} a={analytics.data} className="lg:col-span-2" />
        <Overview p={p} />
      </div>

      <PrivacyNote minGroupSize={analytics.data?.minGroupSize ?? 5} />
      {actions.dialogs}
    </>
  )
}

function Analytics({ a, p }: { a: ProgramAnalytics; p: ProgramDetail }) {
  const k = a.kpis
  const started = a.byWeek.filter((w) => w.completion !== null)
  const upcoming = a.byWeek.filter((w) => w.state === "upcoming")
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Enrolled" value={formatNumber(k.enrolled)} icon={Users} tone="emerald" hint={`${formatPercent(k.enrollmentRate)} of ${formatNumber(k.eligible)} eligible`} />
        {a.status === "active" ? (
          <StatCard label="Active this week" value={formatNumber(k.activeThisWeek)} icon={Activity} tone="sky" hint={`${formatPercent(k.activeRate)} of enrolled`} />
        ) : (
          <StatCard label="Finished the program" value={formatNumber(k.finishedCount)} icon={CheckCircle2} tone="sky" hint={`${formatPercent(k.enrolled ? k.finishedCount / k.enrolled : 0)} of enrolled`} />
        )}
        <StatCard label="Completion" value={formatPercent(k.completionRate)} icon={Target} tone="violet" hint="of all weekly goals" />
        <StatCard label="Avg goals completed" value={formatNumber(k.avgGoalsCompleted, 1)} icon={Trophy} tone="amber" hint={`out of ${formatNumber(k.totalGoals)} goals`} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Completion by week" description="Share of enrolled employees who completed all of that week's goals.">
          {started.length > 0 ? (
            <div className="space-y-3">
              <BarsChart
                data={started.map((w) => ({ name: w.label, completion: Math.round((w.completion ?? 0) * 100) }))}
                categoryKey="name"
                series={[{ key: "completion", label: "Completed the week" }]}
                valueFormatter={(v) => `${v}%`}
                height={240}
              />
              <p className="text-xs text-muted-foreground">
                {a.byWeek.some((w) => w.state === "current") ? `${a.byWeek.find((w) => w.state === "current")!.label} is in progress, so its figure is still rising. ` : ""}
                {upcoming.length > 0 ? `${upcoming.length === 1 ? upcoming[0]!.label : `Weeks ${upcoming[0]!.week}–${upcoming[upcoming.length - 1]!.week}`} ${upcoming.length === 1 ? "hasn't" : "haven't"} started yet.` : ""}
              </p>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Weekly figures appear at the end of week 1.</p>
          )}
        </SectionCard>

        <SectionCard title="By department" description={`Enrolled ÷ eligible. Groups under ${a.minGroupSize} people are hidden.`}>
          {a.byDepartment.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No departments in this audience.</p>
          ) : (
            <ul className="space-y-4">
              {a.byDepartment.map((d) => (
                <li key={d.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{d.name}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {d.suppressed ? (
                        <span className="text-xs">Hidden (&lt; {a.minGroupSize} people)</span>
                      ) : (
                        <>
                          <span className="font-semibold text-foreground">{formatPercent(d.rate)}</span> · {formatNumber(d.enrolled ?? 0)}/{formatNumber(d.eligible)}
                        </>
                      )}
                    </span>
                  </div>
                  <InlineBar value={d.rate ?? 0} max={1} color={d.suppressed ? "var(--muted-foreground)" : p.coverColor} className={cn(d.suppressed && "opacity-30")} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {a.enrollmentTrend.length > 1 ? (
        <SectionCard title="Enrolment over time" description="Cumulative enrolments, from a week before the start.">
          <TrendChart data={a.enrollmentTrend} series={[{ key: "enrolled", label: "Enrolled" }]} xFormatter={(d) => formatShortDate(d)} height={220} />
        </SectionCard>
      ) : null}
    </div>
  )
}

function WeeklyPlan({ p, a, className }: { p: ProgramDetail; a?: ProgramAnalytics; className?: string }) {
  return (
    <SectionCard className={className} title="Weekly plan" description={`${pluralize(p.durationWeeks, "week")} · ${pluralize(p.goalCount, "goal")}`}>
      <ol className="space-y-3">
        {p.weeks.map((w, i) => {
          const stat = a?.byWeek[i]
          const current = stat?.state === "current"
          return (
            <li key={w.week} className={cn("rounded-xl border p-3", current && "border-primary/40 bg-primary/[0.04]")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">
                  <span className="text-muted-foreground">Week {w.week} · </span>
                  {w.title}
                </span>
                {p.startDate ? (
                  <span className="text-xs text-muted-foreground">
                    {formatShortDate(addDays(p.startDate, i * 7))} – {formatShortDate(addDays(p.startDate, i * 7 + 6))}
                  </span>
                ) : null}
                {current ? <Badge className="ml-auto">This week</Badge> : stat?.completion !== null && stat?.completion !== undefined ? <span className="ml-auto text-xs font-medium tabular-nums">{formatPercent(stat.completion)} completed</span> : null}
              </div>
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {w.goals.map((g) => (
                  <li key={g.id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-sm">
                    <span aria-hidden>{PROGRAM_METRIC_META[g.metric]?.emoji ?? "•"}</span>
                    <span className="min-w-0 flex-1 truncate">{g.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatGoalTarget(g.target, g.metric)}</span>
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ol>
    </SectionCard>
  )
}

function Overview({ p }: { p: ProgramDetail }) {
  return (
    <SectionCard title="Overview" contentClassName="space-y-4">
      <div className="flex h-20 items-center justify-center rounded-xl text-4xl" style={{ background: `linear-gradient(135deg, ${p.coverColor}, ${p.coverColor}b3)` }} aria-hidden>
        {p.coverEmoji}
      </div>
      {p.description ? <p className="text-sm text-muted-foreground">{p.description}</p> : null}
      <KeyValueList
        columns={1}
        items={[
          {
            label: "Dates",
            value: p.startDate ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-4 text-muted-foreground" /> {formatDate(p.startDate, "EEE d MMM")} – {formatDate(p.endDate, "EEE d MMM yyyy")}
              </span>
            ) : (
              "Not set"
            ),
          },
          {
            label: "Participants",
            value:
              p.audienceType === "all" ? (
                `Everyone · ${formatNumber(p.eligibleCount)} on the app`
              ) : (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-1">
                    {p.audienceNames.slice(0, 8).map((n, i) => (
                      <Badge key={`${n}-${i}`} variant="secondary">
                        {n}
                      </Badge>
                    ))}
                    {p.audienceNames.length > 8 ? <Badge variant="outline">+{p.audienceNames.length - 8}</Badge> : null}
                  </div>
                  <span className="text-xs text-muted-foreground">{formatNumber(p.eligibleCount)} on the app</span>
                </div>
              ),
          },
          {
            label: "Completion points",
            value: (
              <span className="inline-flex items-center gap-1.5">
                <Coins className="size-4 text-amber-500" /> {formatNumber(p.completionPoints)} pts
              </span>
            ),
          },
          {
            label: "Combined challenge",
            value: p.combinedChallenge ? (
              <Link href={`/business-portal/challenges/${p.combinedChallenge.id}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                <span aria-hidden>{p.combinedChallenge.coverEmoji}</span> {p.combinedChallenge.name}
                <StatusBadge status={p.combinedChallenge.status} className="ml-1" />
              </Link>
            ) : (
              "None"
            ),
          },
          ...(p.template ? [{ label: "Template", value: p.template.name }] : []),
          ...(p.createdBy ? [{ label: "Created by", value: p.createdBy }] : []),
          { label: "Last updated", value: formatDate(p.updatedAt, "d MMM yyyy, h:mm a") },
        ]}
      />
    </SectionCard>
  )
}
