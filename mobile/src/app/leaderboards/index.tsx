/** SCR-M-048 Leaderboards — company / department / team, metric and period, podium, my row pinned, #348 rank-change alerts. */
import { LinearGradient } from "expo-linear-gradient"
import { useLocalSearchParams } from "expo-router"
import { ChevronRight, Medal, RefreshCw, ShieldCheck, Trophy } from "lucide-react-native"
import { useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { ChallengeMiniRow } from "@/components/engage/challenge-ui"
import { NameDisplayNote, PinnedMe, Podium, RankList, useRankAlertToast } from "@/components/engage/leaderboard"
import { ChipScroller, go, TintPill } from "@/components/engage/shared"
import { Card, EmptyState, ErrorState, IconButton, Screen, SegmentedControl, Skeleton, SkeletonList, Text } from "@/components/ui"
import { challengesApi, formatMetricValue } from "@/lib/api/employee/challenges"
import { LB_METRIC_LABEL, LB_PERIOD_LABEL, leaderboardsApi, type LbPeriod, type LbScope, type LbView } from "@/lib/api/employee/leaderboards"
import { useApiQuery } from "@/lib/api/hooks"
import { formatNumber, formatRelative } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import type { LeaderboardMetric } from "@/lib/types"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

const SCOPES: LbScope[] = ["company", "department", "team"]
const METRICS: LeaderboardMetric[] = ["steps", "points", "workouts", "active_days"]
type PeriodSel = LbPeriod | "challenge"
const PERIOD_LABEL: Record<PeriodSel, string> = { today: "Today", week: "Week", month: "Month", challenge: "Challenge" }

function pick<T extends string>(value: string | undefined, list: readonly T[], fallback: T): T {
  return value && (list as readonly string[]).includes(value) ? (value as T) : fallback
}

/** Period "Challenge" (#157): pick one of your challenges to see its leaderboard. */
function ChallengeBoards() {
  const { tint } = useTheme()
  const q = useApiQuery(["employee", "challenges", "active", "all"], () => challengesApi.list({ status: "active", type: "all" }))
  if (q.error) return <ErrorState title="Couldn't load your challenges." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
  if (!q.data) return <SkeletonList count={3} height={64} header={false} />
  if (!q.data.items.length)
    return <EmptyState icon={Trophy} title="Join a challenge to see its leaderboard" action={{ label: "Browse challenges", onPress: () => go("/challenges?tab=available") }} />
  const pts = tint("points")
  return (
    <Card padding={4}>
      {q.data.items.map((c) => (
        <ChallengeMiniRow
          key={c.id}
          c={c}
          subtitle={`${c.myProgress !== null ? `${formatMetricValue(c.myProgress, c.metric)} · ` : ""}${formatNumber(c.participantsCount)} participants`}
          right={c.myRank ? <TintPill label={`#${c.myRank}`} color={pts.fg} bg={pts.bg} /> : undefined}
          onPress={() => go(`/challenges/${c.id}/leaderboard`)}
        />
      ))}
    </Card>
  )
}

export default function LeaderboardsScreen() {
  const { colors } = useTheme()
  const params = useLocalSearchParams<{ scope?: string; metric?: string; period?: string; view?: string }>()
  const [scope, setScope] = useState<LbScope>(pick(params.scope, SCOPES, "company"))
  const [metric, setMetric] = useState<LeaderboardMetric>(pick(params.metric, METRICS, "steps"))
  const [periodSel, setPeriodSel] = useState<PeriodSel>(pick<PeriodSel>(params.period, ["today", "week", "month", "challenge"], "week"))
  const [view, setView] = useState<LbView>(pick<LbView>(params.view, ["groups", "people"], "groups"))
  const period: LbPeriod = periodSel === "challenge" ? "week" : periodSel

  const q = useApiQuery(["employee", "leaderboards", scope, metric, period, view], () => leaderboardsApi.list({ scope, metric, period, view }), {
    placeholderData: (prev) => prev,
    enabled: periodSel !== "challenge",
  })
  const d = q.data
  useRankAlertToast(d?.rankAlert)
  const unit = d ? (d.view === "groups" ? `avg ${d.unit}` : d.unit) : ""
  const empty = d && (d.entries.length === 0 || d.entries.every((e) => e.value === 0))
  const meHidden = !!d?.me && !d.entries.some((e) => e.isMe)

  return (
    <Screen
      title="Leaderboards"
      back
      backHref="/challenges"
      right={<IconButton icon={Medal} variant="soft" accessibilityLabel="My rank" onPress={() => go(`/leaderboards/me?metric=${metric}&period=${period}`)} testID="my-rank" />}
      refreshing={q.isRefetching && !q.isPlaceholderData}
      onRefresh={() => q.refetch()}
      footer={periodSel !== "challenge" && d?.me && meHidden && !empty ? <PinnedMe me={d.me} max={d.entries[0]?.value ?? d.me.value} unit={unit} /> : undefined}
      testID="leaderboards-screen"
    >
      <SegmentedControl<LbScope>
        value={scope}
        onChange={(v) => {
          setScope(v)
          setView("groups")
        }}
        accessibilityLabel="Leaderboard scope"
        options={[
          { value: "company", label: "Company" },
          { value: "department", label: "Department" },
          { value: "team", label: "Team" },
        ]}
      />
      <ChipScroller<LeaderboardMetric> accessibilityLabel="Metric" value={metric} onChange={setMetric} options={METRICS.map((m) => ({ value: m, label: LB_METRIC_LABEL[m] }))} />
      <SegmentedControl<PeriodSel>
        value={periodSel}
        onChange={setPeriodSel}
        accessibilityLabel="Period"
        options={(["today", "week", "month", "challenge"] as PeriodSel[]).map((p) => ({ value: p, label: PERIOD_LABEL[p] }))}
      />
      {scope !== "company" && periodSel !== "challenge" ? (
        <ChipScroller<LbView>
          accessibilityLabel="Ranking view"
          value={view}
          onChange={setView}
          options={[
            { value: "groups", label: scope === "department" ? "All departments" : "All teams" },
            { value: "people", label: scope === "department" ? "People in my department" : "People in my team" },
          ]}
        />
      ) : null}

      {periodSel === "challenge" ? (
        <ChallengeBoards />
      ) : q.error && !d ? (
        <ErrorState title="Couldn't load the leaderboard." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : !d ? (
        <>
          <Skeleton height={86} radius={RADIUS.xl} />
          <Skeleton height={250} radius={RADIUS.xxl} />
          <Skeleton height={280} radius={RADIUS.xl} />
        </>
      ) : (
        <View style={[styles.list, q.isFetching && q.isPlaceholderData && styles.dim]}>
          {d.me ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`You are number ${d.me.rank} of ${d.total}. Open my rank`}
              onPress={() => {
                haptic.tap()
                go(`/leaderboards/me?metric=${metric}&period=${period}`)
              }}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <LinearGradient colors={["#10b981", "#14b8a6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.meCard}>
                <View style={styles.meRank}>
                  <Text variant="small" color="rgba(255,255,255,0.85)">
                    {d.view === "groups" ? "YOURS" : "YOU"}
                  </Text>
                  <Text variant="heading" color="#ffffff">
                    #{d.me.rank}
                  </Text>
                </View>
                <View style={styles.flex}>
                  <Text variant="caption" color="rgba(255,255,255,0.88)" numberOfLines={1}>
                    {d.view === "groups" ? d.me.name : d.scopeLabel} · {LB_PERIOD_LABEL[period].toLowerCase()}
                  </Text>
                  <Text variant="subtitle" color="#ffffff" numberOfLines={1}>
                    {formatNumber(d.me.value)} {unit}
                    <Text variant="caption" color="rgba(255,255,255,0.8)">
                      {" "}
                      · of {formatNumber(d.total)}
                    </Text>
                  </Text>
                </View>
                <ChevronRight size={20} color="rgba(255,255,255,0.85)" />
              </LinearGradient>
            </Pressable>
          ) : null}

          {empty ? (
            <EmptyState icon={Medal} title="No rankings yet for this period." description="Try a longer period or another metric." />
          ) : (
            <>
              <Podium entries={d.entries.slice(0, 3)} unit={unit} />
              <RankList entries={d.entries} skipTop={3} unit={unit} />
            </>
          )}

          {d.view === "people" ? <NameDisplayNote mode={d.nameDisplay} optedOut={d.optedOut} /> : null}
          {d.view === "groups" ? (
            <View style={styles.note}>
              <ShieldCheck size={14} color={colors.mutedForeground} />
              <Text variant="small" tone="muted" style={styles.flex}>
                Groups are ranked by average per person.
                {d.hiddenGroups ? ` ${d.hiddenGroups} group${d.hiddenGroups === 1 ? " has" : "s have"} fewer than ${d.minGroupSize} members and ${d.hiddenGroups === 1 ? "isn't" : "aren't"} ranked to protect privacy.` : ""}
              </Text>
            </View>
          ) : null}
          <Pressable accessibilityRole="button" onPress={() => q.refetch()} style={styles.updated} hitSlop={8}>
            <RefreshCw size={13} color={colors.mutedForeground} />
            <Text variant="small" tone="muted">
              Updated {formatRelative(d.updatedAt)} · tap to refresh
            </Text>
          </Pressable>
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: 14 },
  dim: { opacity: 0.6 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  meCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: RADIUS.xl },
  meRank: { width: 60, height: 60, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  note: { flexDirection: "row", gap: 6, alignItems: "flex-start" },
  updated: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", minHeight: 32 },
})
