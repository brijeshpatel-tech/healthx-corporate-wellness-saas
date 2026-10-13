"use client"

import { Ban, BarChart3, CheckCircle2, Copy, Download, Flag, Gauge, Lock, Megaphone, Monitor, MoreHorizontal, Pencil, Percent, Rocket, Sigma, Trash2, Trophy, Users } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { CancelChallengeDialog, ChallengeConfirmDialogs } from "@/components/business/engagement/challenges/challenge-actions"
import { timingLabel } from "@/components/business/engagement/challenges/challenge-card"
import { formatMetricValue, METRIC_META, typeLabel } from "@/components/business/engagement/challenges/challenge-meta"
import { ChallengePreview } from "@/components/business/engagement/challenges/challenge-preview"
import { CertificatesCard, InviteCard, JourneyCard, MiniChallengesCard, PrizesCard } from "@/components/business/engagement/challenges/detail-extras"
import { ShareBoardDialog } from "@/components/business/engagement/leaderboards/share-board-dialog"
import { CoverTile } from "@/components/business/engagement/cover-picker"
import { LeaderboardList } from "@/components/business/engagement/leaderboard-list"
import { PhoneFrame } from "@/components/business/engagement/phone-frame"
import { TrendChart } from "@/components/common/charts"
import { InlineBar, KeyValueList, PrivacyNote, SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { EmptyState, ErrorState, PageSkeleton } from "@/components/common/states"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { challengesApi, describeScoring, type ChallengeAnalytics, type ChallengeDetail } from "@/lib/api/business/challenges"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { downloadText } from "@/lib/download"
import { formatCompact, formatDate, formatNumber, formatPercent, formatShortDate, pluralize } from "@/lib/format"

const NAME_DISPLAY_LABEL = { full_name: "full names", first_name_initial: "first name and last initial", anonymous: "anonymous names" } as const

export default function ChallengeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const can = useCan()
  const detail = useApiQuery(["business", "challenges", "detail", id], () => challengesApi.get({ id }))
  const analytics = useApiQuery(["business", "challenges", "analytics", id], () => challengesApi.analytics({ id }))
  const board = useApiQuery(["business", "challenges", "leaderboard", id], () => challengesApi.leaderboard({ id, limit: 10 }))
  const [confirm, setConfirm] = useState<"delete" | "publish" | "end" | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const publish = useApiMutation(challengesApi.publish, { success: (r) => r.message })
  const remove = useApiMutation(challengesApi.remove, { success: "Draft deleted", onSuccess: () => router.push("/business-portal/challenges") })
  const endEarly = useApiMutation(challengesApi.endEarly, { success: "Challenge ended – final results are in." })
  const duplicate = useApiMutation(challengesApi.duplicate, { success: "Copy created as a draft", onSuccess: (c) => router.push(`/business-portal/challenges/${c.id}/edit`) })

  if (detail.isLoading) return <PageContainer><PageSkeleton kpis={5} /></PageContainer>
  if (detail.error || !detail.data)
    return (
      <PageContainer>
        <PageHeader title="Challenge" backHref="/business-portal/challenges" backLabel="Challenges" />
        <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
      </PageContainer>
    )

  const c = detail.data
  const manage = can("challenges.manage")
  const a = analytics.data

  const exportCsv = () => {
    if (!a) return
    const lines = [
      `Challenge,${JSON.stringify(c.name)}`,
      `Scope,${a.scopeLabel}`,
      `Participants,${a.kpis.participants}`,
      `Eligible,${a.kpis.eligible}`,
      `Completion rate,${formatPercent(a.kpis.completionRate)}`,
      `Average progress,${formatPercent(a.kpis.avgProgress)}`,
      `Total (${a.unit}),${a.kpis.totalMetric}`,
      "",
      `Date,Total (${a.unit}),Active participants`,
      ...a.daily.map((d) => `${d.date},${d.total},${d.active}`),
      "",
      "Department,Eligible,Participants,Participation",
      ...a.departments.map((d) => `${JSON.stringify(d.name)},${d.eligible},${d.hidden ? "hidden" : d.participants},${d.hidden ? "hidden" : formatPercent(d.participationRate)}`),
    ]
    downloadText(`challenge-${c.id}-summary.csv`, lines.join("\n"))
  }

  return (
    <PageContainer>
      <PageHeader
        backHref="/business-portal/challenges"
        backLabel="Challenges"
        title={c.name}
        badge={
          <>
            {c.warmup ? <StatusBadge status="scheduled" tone="teal" label="Warm-up" /> : <StatusBadge status={c.status} />}
            {c.scopedToTeams ? <Badge variant="secondary">Your team only</Badge> : null}
          </>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{typeLabel(c.type, c.teamUnit)}</span>
            <span aria-hidden>·</span>
            <span>{formatMetricValue(c.target, c.metric, c.customMetricLabel)}</span>
            <span aria-hidden>·</span>
            <span>
              {formatShortDate(c.startDate)} – {formatDate(c.endDate)}
            </span>
            <span aria-hidden>·</span>
            <span className="font-medium text-foreground">{timingLabel(c)}</span>
          </span>
        }
        actions={
          manage ? (
            <>
              {c.canPublish ? (
                <Button onClick={() => setConfirm("publish")}>
                  <Rocket data-icon="inline-start" /> Publish
                </Button>
              ) : null}
              {c.canEdit ? (
                <Button asChild variant={c.canPublish ? "outline" : "default"}>
                  <Link href={`/business-portal/challenges/${c.id}/edit`}>
                    <Pencil data-icon="inline-start" /> Edit
                  </Link>
                </Button>
              ) : c.lockReason && c.status !== "cancelled" ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
                      <Button variant="outline" disabled>
                        <Lock data-icon="inline-start" /> Locked
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{c.lockReason}</TooltipContent>
                </Tooltip>
              ) : null}
              {c.status === "active" || c.status === "scheduled" ? (
                <Button asChild variant="outline">
                  <Link href={`/business-portal/announcements/new?challengeId=${c.id}`}>
                    <Megaphone data-icon="inline-start" /> Announce
                  </Link>
                </Button>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More actions">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => duplicate.mutate({ id: c.id })}>
                    <Copy /> Duplicate <PhaseBadge phase={2} className="ml-auto" />
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportCsv} disabled={!a?.started}>
                    <Download /> Export summary (CSV)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShareOpen(true)} disabled={!a?.started || !board.data}>
                    <Monitor /> Share as TV board <PhaseBadge phase={2} className="ml-auto" />
                  </DropdownMenuItem>
                  {c.canEndEarly || c.canCancel || c.canDelete ? <DropdownMenuSeparator /> : null}
                  {c.canEndEarly ? (
                    <DropdownMenuItem onClick={() => setConfirm("end")}>
                      <Flag /> End early
                    </DropdownMenuItem>
                  ) : null}
                  {c.canCancel ? (
                    <DropdownMenuItem variant="destructive" onClick={() => setCancelOpen(true)}>
                      <Ban /> Cancel challenge
                    </DropdownMenuItem>
                  ) : null}
                  {c.canDelete ? (
                    <DropdownMenuItem variant="destructive" onClick={() => setConfirm("delete")}>
                      <Trash2 /> Delete draft
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : undefined
        }
      />

      {c.status === "cancelled" ? (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <Ban />
          <AlertTitle>This challenge was cancelled</AlertTitle>
          <AlertDescription>{c.cancelReason ? `Message sent to participants: “${c.cancelReason}”` : "Participants were notified."}</AlertDescription>
        </Alert>
      ) : null}
      {manage && (c.status === "active" || c.warmup) && c.lockReason ? (
        <Alert className="border-sky-500/30 bg-sky-500/[0.05]">
          <Lock className="text-sky-600" />
          <AlertTitle>Fairness lock is on</AlertTitle>
          <AlertDescription>{c.lockReason}</AlertDescription>
        </Alert>
      ) : null}
      {c.status === "draft" && (c.daysToStart ?? 0) < 0 ? (
        <Alert className="border-amber-500/30 bg-amber-500/[0.06]">
          <Flag className="text-amber-600" />
          <AlertTitle>The start date has passed</AlertTitle>
          <AlertDescription>Edit the dates before publishing this draft.</AlertDescription>
        </Alert>
      ) : null}

      {analytics.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : analytics.error ? (
        <ErrorState error={new Error(`Couldn't load analytics. ${analytics.error.message}`)} onRetry={() => analytics.refetch()} />
      ) : a && a.started ? (
        <Kpis c={c} a={a} />
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          {a && a.started ? (
            <DailyChart a={a} c={c} />
          ) : !analytics.isLoading ? (
            <EmptyState
              icon={BarChart3}
              title={c.status === "cancelled" ? "No analytics for this challenge" : "Analytics will appear once the challenge starts."}
              description={
                c.status === "scheduled"
                  ? `Starts ${formatDate(c.startDate, "EEEE d MMM")}. ${formatNumber(c.eligibleCount)} employees can join.`
                  : c.status === "draft"
                    ? "Publish the challenge so employees can join."
                    : "This challenge was cancelled before it started."
              }
              action={
                c.canPublish ? (
                  <Button onClick={() => setConfirm("publish")}>
                    <Rocket data-icon="inline-start" /> Publish now
                  </Button>
                ) : undefined
              }
              className="py-10"
            />
          ) : null}

          {a && !a.started && c.status !== "cancelled" ? (
            <SectionCard title="What employees see" description="The challenge card in the HealthX app.">
              <PhoneFrame label="Employee app preview">
                <ChallengePreview
                  data={{
                    name: c.name,
                    description: c.description,
                    coverEmoji: c.coverEmoji,
                    coverColor: c.coverColor,
                    type: c.type,
                    teamUnit: c.teamUnit,
                    metric: c.metric,
                    customMetricLabel: c.customMetricLabel,
                    target: c.target,
                    startDate: c.startDate,
                    endDate: c.endDate,
                    points: c.points,
                    reward: c.reward ?? null,
                    rules: c.rules,
                    durationDays: c.durationDays,
                  }}
                />
              </PhoneFrame>
            </SectionCard>
          ) : null}

          <JourneyCard challenge={c} />
          {a?.started && a.standings ? <Standings a={a} c={c} /> : null}
          <MiniChallengesCard challenge={c} />

          {a?.started && a.departments.length > 0 ? (
            <SectionCard title="Participation by department" description={`Share of eligible employees who joined. Groups under ${a.minGroupSize} people are hidden.`}>
              <ul className="space-y-3.5">
                {a.departments.map((d) => (
                  <li key={d.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{d.name}</span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {d.hidden ? (
                          `Hidden (< ${a.minGroupSize} people)`
                        ) : (
                          <>
                            <span className="font-semibold text-foreground">{formatPercent(d.participationRate)}</span> · {formatNumber(d.participants)}/{formatNumber(d.eligible)}
                            {d.completionRate !== null ? ` · ${formatPercent(d.completionRate)} completed` : ""}
                          </>
                        )}
                      </span>
                    </div>
                    <InlineBar value={d.participationRate ?? 0} max={1} color={d.hidden ? "var(--muted-foreground)" : c.coverColor} />
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {c.status === "scheduled" || c.status === "active" ? <InviteCard challenge={c} /> : null}
          <SectionCard
            title="Overview"
            actions={<CoverTile emoji={c.coverEmoji} color={c.coverColor} size="md" />}
          >
            <div className="space-y-4">
              {c.description ? <p className="text-sm text-muted-foreground">{c.description}</p> : null}
              <KeyValueList
                columns={1}
                items={[
                  { label: "Type", value: typeLabel(c.type, c.teamUnit) },
                  { label: "Metric & target", value: `${METRIC_META[c.metric].emoji} ${formatMetricValue(c.target, c.metric, c.customMetricLabel)}` },
                  { label: "Dates", value: `${formatDate(c.startDate, "EEE d MMM")} – ${formatDate(c.endDate, "EEE d MMM yyyy")} (${pluralize(c.durationDays, "day")})` },
                  { label: "Who can join", value: c.audienceType === "all" ? "Everyone in the company" : <AudienceNames names={c.audienceNames} /> },
                  ...(c.settings.warmupStartDate ? [{ label: "Warm-up", value: `From ${formatDate(c.settings.warmupStartDate, "EEE d MMM")} — join and connect trackers before scoring starts` }] : []),
                  ...(c.type !== "collaborative" ? [{ label: "Scoring", value: describeScoring(c.settings.scoring, c.metric === "custom" ? (c.customMetricLabel ?? "check-ins") : METRIC_META[c.metric].unit) }] : []),
                  { label: "Points", value: `${formatNumber(c.points)} points for completing` },
                  {
                    label: "Reward",
                    value: c.reward ? (
                      <span className="inline-flex items-center gap-2">
                        <CoverTile emoji={c.reward.imageEmoji} color={c.reward.imageColor} size="sm" /> {c.reward.name}
                      </span>
                    ) : (
                      "None"
                    ),
                  },
                  { label: "Created", value: `${formatDate(c.createdAt)} by ${c.createdBy}${c.template ? ` · from “${c.template.name}”` : ""}` },
                ]}
              />
            </div>
          </SectionCard>

          <PrizesCard challenge={c} />
          {manage ? <CertificatesCard challenge={c} /> : null}

          {a?.started ? (
            <SectionCard
              title="Top participants"
              description={board.data ? `${board.data.scored ? `${board.data.scoringLabel}. ` : ""}Names show as ${NAME_DISPLAY_LABEL[board.data.nameDisplay]} (company privacy setting).` : undefined}
              actions={
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/business-portal/leaderboards?scope=challenge&challengeId=${c.id}`}>Full board</Link>
                </Button>
              }
            >
              {board.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-9" />
                  ))}
                </div>
              ) : board.error ? (
                <ErrorState error={new Error("Couldn't load the leaderboard.")} onRetry={() => board.refetch()} className="py-6" />
              ) : !board.data || board.data.entries.length === 0 ? (
                <EmptyState icon={Trophy} title="No one has joined yet" description="The leaderboard fills up as people join and make progress." className="border-0 py-6" />
              ) : (
                <LeaderboardList
                  entries={board.data.entries}
                  formatValue={(v) => (board.data?.unit === "pts" ? `${formatNumber(v)} pts` : formatMetricValue(v, c.metric, c.customMetricLabel, true))}
                  showProgress={c.type !== "collaborative"}
                  barColor={c.coverColor}
                />
              )}
            </SectionCard>
          ) : null}

          <SectionCard title="Rules">
            {c.rules.length ? (
              <ol className="space-y-2.5">
                {c.rules.map((r, i) => (
                  <li key={i} className="flex gap-2.5 text-sm">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums">{i + 1}</span>
                    <span className="text-muted-foreground">{r}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">No rules added.</p>
            )}
          </SectionCard>
        </div>
      </div>

      {a?.started ? <PrivacyNote minGroupSize={a.minGroupSize}>Privacy first: you see combined figures only. The leaderboard is the one place individual totals appear, under your company&apos;s name-display setting; people who opted out appear as anonymous. Groups under {a.minGroupSize} people are hidden.</PrivacyNote> : null}

      <ChallengeConfirmDialogs
        challenge={c}
        kind={confirm}
        onClose={() => setConfirm(null)}
        onConfirm={(kind) => {
          if (kind === "publish") publish.mutate({ id: c.id })
          if (kind === "delete") remove.mutate({ id: c.id })
          if (kind === "end") endEarly.mutate({ id: c.id })
          setConfirm(null)
        }}
      />
      <CancelChallengeDialog challenge={c} open={cancelOpen} onOpenChange={setCancelOpen} />
      {board.data ? (
        <ShareBoardDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          query={{ scope: "challenge", challengeId: c.id, metric: "steps", period: "challenge" }}
          defaultTitle={`${c.name} leaderboard`}
          companyNameDisplay={board.data.nameDisplay}
        />
      ) : null}
    </PageContainer>
  )
}

function AudienceNames({ names }: { names: string[] }) {
  const shown = names.slice(0, 6)
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((n) => (
        <Badge key={n} variant="secondary" className="font-normal">
          {n}
        </Badge>
      ))}
      {names.length > shown.length ? <Badge variant="outline">+{names.length - shown.length} more</Badge> : null}
    </span>
  )
}

function Kpis({ c, a }: { c: ChallengeDetail; a: ChallengeAnalytics }) {
  const collaborative = c.type === "collaborative"
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5 [&>*:last-child]:col-span-2 xl:[&>*:last-child]:col-span-1">
      <StatCard label="Participants" value={formatNumber(a.kpis.participants)} icon={Users} tone="emerald" hint={`of ${formatNumber(a.kpis.eligible)} eligible`} />
      <StatCard label="Joined" value={formatPercent(a.kpis.participationRate)} icon={Percent} tone="sky" hint="of eligible employees" />
      {c.type === "team" ? (
        <StatCard
          label={`Leading ${c.teamUnit === "team" ? "team" : "department"}`}
          value={<span className="block truncate text-xl">{a.standings?.find((s) => s.rank === 1)?.name ?? "—"}</span>}
          icon={Trophy}
          tone="violet"
          hint={a.standings?.find((s) => s.rank === 1) ? `${formatMetricValue(a.standings.find((s) => s.rank === 1)!.average ?? 0, c.metric, c.customMetricLabel, true)} avg per participant` : `ranked once groups reach ${a.minGroupSize} participants`}
        />
      ) : collaborative ? (
        <StatCard label="Shared goal" value={formatPercent(a.kpis.avgProgress)} icon={Gauge} tone="violet" hint={`${formatMetricValue(a.kpis.sharedTotal, c.metric, c.customMetricLabel, true)} of ${formatMetricValue(c.target, c.metric, c.customMetricLabel, true)} company-wide`} />
      ) : (
        <StatCard label="Completion rate" value={formatPercent(a.kpis.completionRate)} icon={CheckCircle2} tone="violet" hint={`${formatNumber(a.kpis.completed)} reached the target`} />
      )}
      <StatCard
        label={collaborative ? "Avg per participant" : "Average progress"}
        value={collaborative ? formatMetricValue(a.kpis.avgPerParticipant, c.metric, c.customMetricLabel, true) : formatPercent(a.kpis.avgProgress)}
        icon={Gauge}
        tone="amber"
        hint={collaborative ? "contributed so far" : "of the target, per participant"}
      />
      <StatCard label={`Total ${a.unit}`} value={c.metric === "water" ? formatMetricValue(a.kpis.totalMetric, c.metric) : formatCompact(a.kpis.totalMetric)} icon={Sigma} tone="rose" hint={a.scopeLabel} />
    </div>
  )
}

function DailyChart({ a, c }: { a: ChallengeAnalytics; c: ChallengeDetail }) {
  const [metric, setMetric] = useState<"total" | "cumulative" | "active">("total")
  const label = metric === "active" ? "Active participants" : metric === "cumulative" ? `Cumulative ${a.unit}` : `${METRIC_META[c.metric].label} per day`
  return (
    <SectionCard
      title="Daily progress"
      description={metric === "active" ? "Participants who logged progress each day." : `Combined ${a.unit} logged by participants · ${a.scopeLabel}.`}
      actions={
        <Tabs value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
          <TabsList>
            <TabsTrigger value="total">Daily</TabsTrigger>
            <TabsTrigger value="cumulative">Total</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <TrendChart
        data={a.daily}
        series={[{ key: metric, label }]}
        xFormatter={(d) => formatShortDate(d)}
        valueFormatter={(v) => (metric === "active" ? formatNumber(v) : c.metric === "water" ? formatCompact(v / 1000) + " L" : formatCompact(v))}
        height={260}
      />
    </SectionCard>
  )
}

function Standings({ a, c }: { a: ChallengeAnalytics; c: ChallengeDetail }) {
  const rows = a.standings ?? []
  const max = Math.max(1, ...rows.map((r) => r.average ?? 0))
  const unitName = c.teamUnit === "team" ? "Team" : "Department"
  return (
    <SectionCard title={`${unitName} standings`} description={`Ranked on the average ${a.unit} per participant, so group size doesn't matter. Groups with fewer than ${a.minGroupSize} participants are hidden.`}>
      <ol className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3">
            <span className={r.rank && r.rank <= 3 ? "flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-xs font-bold text-amber-700 tabular-nums dark:text-amber-300" : "flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground tabular-nums"}>
              {r.rank ?? "–"}
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium">{r.name}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {r.hidden ? (
                    `Hidden (< ${a.minGroupSize} participants)`
                  ) : (
                    <>
                      <span className="font-semibold text-foreground">{formatMetricValue(r.average ?? 0, c.metric, c.customMetricLabel, true)}</span> avg · {formatNumber(r.participants)} of {formatNumber(r.members)} joined
                    </>
                  )}
                </span>
              </div>
              <InlineBar value={r.average ?? 0} max={max} color={r.rank === 1 ? c.coverColor : "var(--chart-1)"} />
            </div>
          </li>
        ))}
      </ol>
    </SectionCard>
  )
}
