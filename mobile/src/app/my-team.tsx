/** SCR-M-079 My Team (Team Manager only) — participation, combined steps, team challenges and the team leaderboard. Aggregated data only. */
import { keepPreviousData } from "@tanstack/react-query"
import { Activity, ArrowRight, CircleCheck, EyeOff, Footprints, Info, Lock, Medal, Scale, Target, UsersRound, type LucideIcon } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { PinnedMe, Podium, RankList } from "@/components/engage/leaderboard"
import { ChipScroller, EmojiTile, go, GradientCard, OnColorPill } from "@/components/engage/shared"
import { BarChart, Button, Card, EmptyState, ErrorState, IconTile, Notice, ProgressBar, ProgressRing, Screen, SegmentedControl, SelectField, Skeleton, SkeletonList, Text } from "@/components/ui"
import { teamApi, type TeamChallengeProgress, type TeamPeriod, type TeamSummary } from "@/lib/api/employee/team"
import { useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatMl, formatNumber, formatPercent } from "@/lib/format"
import type { ChallengeType } from "@/lib/types"
import { useTheme } from "@/theme/theme"
import { RADIUS, type TintName } from "@/theme/tokens"

const PERIOD_LABEL: Record<TeamPeriod, string> = { week: "this week", month: "this month" }
const TYPE_LABEL: Record<ChallengeType, string> = { individual: "Individual", leaderboard: "Leaderboard", team: "Team battle", company: "Company-wide", collaborative: "Collaborative" }
const PREVIEW = 8

function fmt(value: number, c: Pick<TeamChallengeProgress, "metric" | "unit">, withUnit = true) {
  if (c.metric === "water") return withUnit ? formatMl(value) : formatNumber(value / 1000, 1)
  if (c.metric === "distance") return `${formatNumber(value, 1)}${withUnit ? " km" : ""}`
  return `${formatNumber(Math.round(value))}${withUnit ? ` ${c.unit}` : ""}`
}

function Tile({ icon, tint, label, value, hint, muted }: { icon: LucideIcon; tint: TintName; label: string; value: string; hint?: string; muted?: boolean }) {
  const { colors } = useTheme()
  return (
    <View style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <IconTile icon={icon} tint={tint} size={32} />
      <Text variant="small" tone="muted" numberOfLines={1}>
        {label}
      </Text>
      <Text variant="heading" tone={muted ? "muted" : "default"} numberOfLines={1}>
        {value}
      </Text>
      {hint ? (
        <Text variant="small" tone="muted" numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

function ChallengeDetail({ c, period, minGroupSize }: { c: TeamChallengeProgress; period: TeamPeriod; minGroupSize: number }) {
  const { colors } = useTheme()
  const collaborative = c.type === "collaborative"
  const ringValue = collaborative ? (c.companyTotal ?? 0) : (c.average ?? 0)
  const ringPct = c.target ? Math.min(1, ringValue / c.target) : 0
  return (
    <View style={styles.gap12}>
      <Card flat padding={10} onPress={() => go(`/challenges/${c.id}`)} style={{ backgroundColor: colors.muted }} accessibilityLabel={`Open challenge ${c.name}`}>
        <View style={styles.row}>
          <EmojiTile emoji={c.emoji} color={c.color} size={44} solid />
          <View style={styles.flex}>
            <Text variant="label" numberOfLines={1}>
              {c.name}
            </Text>
            <Text variant="small" tone="muted" numberOfLines={1}>
              {TYPE_LABEL[c.type]} · {c.daysLeft ? `${c.daysLeft} day${c.daysLeft === 1 ? "" : "s"} left` : "Ends today"} · +{c.points} pts
            </Text>
          </View>
          <ArrowRight size={16} color={colors.mutedForeground} />
        </View>
      </Card>
      <View style={styles.row}>
        {c.hidden && !collaborative ? (
          <View style={[styles.hiddenRing, { borderColor: colors.input }]}>
            <EyeOff size={20} color={colors.mutedForeground} />
            <Text variant="small" tone="muted">
              Hidden
            </Text>
          </View>
        ) : (
          <ProgressRing value={ringPct} max={1} size={92} stroke={9} color={c.color} accessibilityLabel={`${formatPercent(ringPct)} of target`}>
            <Text variant="subtitle">{formatPercent(ringPct)}</Text>
            <Text variant="small" tone="muted">
              of target
            </Text>
          </ProgressRing>
        )}
        <View style={styles.flex}>
          <Text variant="small" tone="muted">
            {collaborative ? "Company progress" : "Team average"}
          </Text>
          <Text variant="heading">{collaborative ? fmt(c.companyTotal ?? 0, c) : c.average !== null ? fmt(c.average, c) : "—"}</Text>
          <Text variant="small" tone="muted">
            {collaborative ? `Shared goal ${fmt(c.target, c)}` : `Target ${fmt(c.target, c)} each`}
          </Text>
        </View>
      </View>
      <View style={styles.row2}>
        <View style={[styles.metric, { borderColor: colors.border }]}>
          <View style={styles.rowSm}>
            <UsersRound size={14} color={colors.mutedForeground} />
            <Text variant="small" tone="muted">
              Members joined
            </Text>
          </View>
          <Text variant="subtitle">
            {c.joined} / {c.eligible}
          </Text>
          <ProgressBar value={c.joined} max={Math.max(1, c.eligible)} height={5} color={c.color} />
        </View>
        <View style={[styles.metric, { borderColor: colors.border }]}>
          <View style={styles.rowSm}>
            <Target size={14} color={colors.mutedForeground} />
            <Text variant="small" tone="muted">
              Team total
            </Text>
          </View>
          <Text variant="subtitle" tone={c.total === null ? "muted" : "default"}>
            {c.total !== null ? fmt(c.total, c) : "Hidden"}
          </Text>
          <Text variant="small" tone="muted">
            {c.periodTotal !== null ? `+${fmt(c.periodTotal, c)} ${PERIOD_LABEL[period]}` : `Shown when ${minGroupSize}+ join`}
          </Text>
        </View>
      </View>
      {!collaborative && c.type !== "team" ? (
        <View style={[styles.metric, { borderColor: colors.border }]}>
          <View style={styles.rowSm}>
            <CircleCheck size={14} color={colors.mutedForeground} />
            <Text variant="small" tone="muted">
              Completed
            </Text>
          </View>
          <Text variant="subtitle">
            {c.completed} of {c.joined}
          </Text>
          <ProgressBar value={c.completed} max={Math.max(1, c.joined)} height={5} />
        </View>
      ) : null}
      {c.hidden ? (
        <Notice tone="privacy" icon={EyeOff}>{`Team totals and averages appear once at least ${minGroupSize} team members join — ${c.joined} so far.`}</Notice>
      ) : null}
      {c.standings?.length ? (
        <View style={styles.gap8}>
          <Text variant="overline" tone="muted">
            {c.teamUnit === "team" ? "Team" : "Department"} standings · avg per participant
          </Text>
          {c.standings.map((r) => (
            <View key={r.id} style={[styles.standing, r.isMine && { backgroundColor: colors.primarySoft }]}>
              <Text variant="label" tone="muted" style={styles.rankNo}>
                {r.rank ? `#${r.rank}` : "–"}
              </Text>
              <View style={styles.flex}>
                <Text variant="bodyMedium" numberOfLines={1}>
                  {r.name}
                  {r.isMine ? "  · yours" : ""}
                </Text>
                {r.hidden ? (
                  <Text variant="small" tone="muted">
                    Fewer than {minGroupSize} participants — hidden
                  </Text>
                ) : (
                  <ProgressBar value={r.average ?? 0} max={Math.max(1, ...c.standings!.map((x) => x.average ?? 0))} height={5} color={r.isMine ? colors.primary : undefined} />
                )}
              </View>
              <Text variant="label">{r.average !== null ? fmt(r.average, c, false) : "—"}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function TeamChallenges({ challenges, period, minGroupSize }: { challenges: TeamChallengeProgress[]; period: TeamPeriod; minGroupSize: number }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = challenges.find((c) => c.id === selectedId) ?? challenges[0]
  return (
    <Card>
      <View style={styles.between}>
        <View style={styles.flex}>
          <Text variant="subtitle">Team challenge progress</Text>
          <Text variant="small" tone="muted">
            Active challenges your team members have joined
          </Text>
        </View>
      </View>
      {!selected ? (
        <EmptyState compact icon={Medal} title="No team members in an active challenge yet" description="Encourage your team to join one — progress will show up here." action={{ label: "Browse challenges", onPress: () => go("/challenges") }} />
      ) : (
        <View style={styles.mt12}>
          {challenges.length > 1 ? (
            <View style={styles.mb12}>
              <ChipScroller value={selected.id} onChange={setSelectedId} accessibilityLabel="Choose a challenge" options={challenges.map((c) => ({ value: c.id, label: c.name, emoji: c.emoji }))} />
            </View>
          ) : null}
          <ChallengeDetail key={selected.id} c={selected} period={period} minGroupSize={minGroupSize} />
        </View>
      )}
    </Card>
  )
}

function TeamLeaderboard({ period, teamId }: { period: TeamPeriod; teamId?: string }) {
  const { colors } = useTheme()
  const [open, setOpen] = useState(false)
  const q = useApiQuery(["employee", "team", "leaderboard", { period, teamId }], () => teamApi.leaderboard({ period, teamId }))
  const d = q.data
  const entries = d ? (open ? d.entries : d.entries.slice(0, PREVIEW)) : []
  const meHidden = !!d?.me && !entries.some((e) => e.isMe)
  return (
    <View style={styles.gap12}>
      <View>
        <Text variant="heading">Team leaderboard</Text>
        <Text variant="small" tone="muted">
          Steps {PERIOD_LABEL[period]} · the same leaderboard your team sees
        </Text>
      </View>
      {q.error ? (
        <ErrorState title="Couldn't load the team leaderboard." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : !d ? (
        <Skeleton height={260} radius={RADIUS.xxl} />
      ) : d.entries.length === 0 ? (
        <Card>
          <Text variant="caption" tone="muted" align="center">
            No steps synced {PERIOD_LABEL[period]} yet — the leaderboard fills up as your team moves.
          </Text>
        </Card>
      ) : (
        <>
          <Podium entries={d.entries} unit="steps" />
          <RankList entries={entries} skipTop={3} unit="steps" />
          {meHidden && d.me ? <PinnedMe me={d.me} max={d.entries[0]?.value ?? d.me.value} unit="steps" /> : null}
          {d.entries.length > PREVIEW ? <Button title={open ? `Show top ${PREVIEW}` : `Open team leaderboard (${d.entries.length})`} variant="outline" onPress={() => setOpen((v) => !v)} /> : null}
          <View style={styles.rowTop}>
            <Info size={13} color={colors.mutedForeground} />
            <Text variant="small" tone="muted" style={styles.flex}>
              Names follow your company&apos;s privacy setting. People who opted out appear without their name.
              {d.noActivity ? ` ${d.noActivity} member${d.noActivity === 1 ? "" : "s"} with no steps ${PERIOD_LABEL[period]} ${d.noActivity === 1 ? "isn't" : "aren't"} listed.` : ""}
            </Text>
          </View>
        </>
      )}
    </View>
  )
}

function TeamView({ data, period, teamId }: { data: TeamSummary; period: TeamPeriod; teamId?: string }) {
  const { tint } = useTheme()
  const { team, participation, rank, steps } = data
  const vsCompany = steps.averagePerMember !== null && steps.companyAveragePerMember ? steps.averagePerMember / steps.companyAveragePerMember - 1 : null
  return (
    <>
      <GradientCard colors={["#10b981", "#14b8a6", "#0284c7"]}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text variant="caption" color="rgba(255,255,255,0.88)" numberOfLines={1}>
              Your team · {team.departmentName}
            </Text>
            <Text variant="title" color="#ffffff" numberOfLines={1}>
              {team.name}
            </Text>
            <Text variant="label" color="#ffffff">
              {participation.active} of {participation.members} members active {PERIOD_LABEL[period]}
            </Text>
            <View style={styles.pills}>
              <OnColorPill label={rank.position ? `#${rank.position} of ${rank.of} teams` : "Not ranked yet"} icon={Medal} />
              <OnColorPill label={`${team.members} members${team.invited ? ` · ${team.invited} invited` : ""}`} icon={UsersRound} />
            </View>
          </View>
          <ProgressRing value={participation.active} max={Math.max(1, participation.members)} size={100} stroke={10} color="#ffffff" trackColor="rgba(255,255,255,0.25)" accessibilityLabel={`${formatPercent(participation.rate)} active`}>
            <Text variant="heading" color="#ffffff">
              {formatPercent(participation.rate)}
            </Text>
            <Text variant="small" color="rgba(255,255,255,0.85)">
              active
            </Text>
          </ProgressRing>
        </View>
      </GradientCard>

      <Notice tone="privacy" title="What you can see as a manager">
        {`Participation, your team's combined figures and the same team leaderboard everyone sees. You never see anyone's health data — water, sleep, weight, nutrition or wellness score — and averages are hidden for groups smaller than ${data.minGroupSize}.`}
      </Notice>

      {!data.hasActivity ? (
        <EmptyState icon={UsersRound} title={period === "week" ? "Your team has no activity yet this week." : "Your team has no activity yet this month."} description="Once team members sync their steps or join a challenge, their combined progress will show up here." action={{ label: "Find a challenge to share", onPress: () => go("/challenges") }} />
      ) : (
        <>
          <View style={styles.row2}>
            <Tile icon={Activity} tint="habits" label="Participation" value={formatPercent(participation.rate)} hint={`${participation.active} of ${participation.members} active`} />
            <Tile icon={steps.suppressed ? Lock : Footprints} tint="steps" label="Avg steps / member" value={steps.averagePerMember !== null ? formatNumber(steps.averagePerMember) : "Hidden"} hint={steps.averagePerDay !== null ? `≈ ${formatNumber(steps.averagePerDay)} a day` : `Needs ${data.minGroupSize}+ members`} muted={steps.suppressed} />
          </View>
          <View style={styles.row2}>
            <Tile icon={Scale} tint="workout" label="Vs company average" value={vsCompany === null ? "—" : `${vsCompany >= 0 ? "+" : ""}${formatPercent(vsCompany)}`} hint={steps.companyAveragePerMember !== null ? `Company: ${formatNumber(steps.companyAveragePerMember)}` : undefined} muted={vsCompany === null} />
            <Tile icon={Medal} tint="points" label="Team rank" value={rank.position ? `#${rank.position}` : "—"} hint={rank.position ? `of ${rank.of} teams by avg steps` : `Teams need ${data.minGroupSize}+ members`} muted={!rank.position} />
          </View>

          <Card>
            <View style={styles.between}>
              <View style={styles.flex}>
                <Text variant="subtitle">Team average steps</Text>
                <Text variant="small" tone="muted">
                  Per member per day, {PERIOD_LABEL[period]}
                </Text>
              </View>
              {steps.averagePerDay !== null ? <Text variant="heading">{formatNumber(steps.averagePerDay)}</Text> : null}
            </View>
            {steps.suppressed ? (
              <View style={styles.suppressed}>
                <EyeOff size={22} color={tint("neutral").fg} />
                <Text variant="label">Hidden to protect privacy</Text>
                <Text variant="small" tone="muted" align="center">
                  Team averages appear once at least {data.minGroupSize} members use HealthX. Your team has {team.members}.
                </Text>
              </View>
            ) : steps.trend ? (
              <BarChart
                data={steps.trend.map((t) => ({ key: t.date, label: formatDate(t.date, period === "week" ? "EEEEE" : "d"), detail: formatDate(t.date, "EEE, d MMM"), value: t.value }))}
                dimBelowGoal={false}
                unit="steps"
                height={160}
                accessibilityLabel="Average steps per member per day"
              />
            ) : (
              <Text variant="caption" tone="muted" align="center" style={styles.mt12}>
                No steps synced {PERIOD_LABEL[period]} yet.
              </Text>
            )}
          </Card>

          <TeamChallenges challenges={data.challenges} period={period} minGroupSize={data.minGroupSize} />
          <TeamLeaderboard period={period} teamId={teamId} />
        </>
      )}
    </>
  )
}

export default function MyTeamScreen() {
  const [period, setPeriod] = useState<TeamPeriod>("week")
  const [teamId, setTeamId] = useState<string | undefined>(undefined)
  const q = useApiQuery(["employee", "team", "summary", { period, teamId }], () => teamApi.summary({ period, teamId }), {
    placeholderData: keepPreviousData,
    retry: (count, error) => error.status !== 403 && count < 1,
  })
  const data = q.data

  if (q.error?.status === 403)
    return (
      <Screen title="My team" back backHref="/profile">
        <EmptyState icon={Lock} title="My Team is for Team Managers" description={q.error.message} action={{ label: "Back to Home", onPress: () => go("/home") }} />
      </Screen>
    )

  return (
    <Screen title="My team" back backHref="/profile" refreshing={q.isRefetching && !q.isPlaceholderData} onRefresh={() => q.refetch()} testID="my-team">
      {data && data.teams.length > 1 ? <SelectField label="Team" value={teamId ?? data.team.id} onChange={setTeamId} options={data.teams.map((t) => ({ value: t.id, label: t.name }))} /> : null}
      <SegmentedControl<TeamPeriod>
        value={period}
        onChange={setPeriod}
        accessibilityLabel="Period"
        options={[
          { value: "week", label: "This week" },
          { value: "month", label: "This month" },
        ]}
      />
      {q.error && !data ? (
        <ErrorState title="Couldn't load team data." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : !data ? (
        <SkeletonList count={3} height={150} />
      ) : (
        <View style={[styles.gap16, q.isPlaceholderData && q.isFetching && styles.dim]}>
          <TeamView data={data} period={period} teamId={teamId} />
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 3 },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  gap16: { gap: 16 },
  mt12: { marginTop: 12 },
  mb12: { marginBottom: 12 },
  dim: { opacity: 0.6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowSm: { flexDirection: "row", alignItems: "center", gap: 5 },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  row2: { flexDirection: "row", gap: 10 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tile: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 12, gap: 4 },
  hiddenRing: { width: 92, height: 92, borderRadius: 46, borderWidth: 4, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 2 },
  metric: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 10, gap: 5 },
  standing: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: RADIUS.md },
  rankNo: { width: 30 },
  suppressed: { alignItems: "center", gap: 6, paddingVertical: 20 },
})
