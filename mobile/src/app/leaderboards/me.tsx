/** SCR-M-049 My Rank — position across company, department and team; gap to the next rank; change vs last week. */
import { useLocalSearchParams } from "expo-router"
import { ArrowDownRight, ArrowUpRight, Building2, ChevronRight, EyeOff, Minus, Network, Trophy, UsersRound } from "lucide-react-native"
import { useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { ChipScroller, go, GradientCard, TintPill } from "@/components/engage/shared"
import { Button, Card, EmptyState, ErrorState, IconTile, ProgressBar, Screen, SegmentedControl, Skeleton, Text } from "@/components/ui"
import { LB_METRIC_LABEL, LB_PERIOD_LABEL, leaderboardsApi, type LbPeriod, type LbScope, type MyRankResult } from "@/lib/api/employee/leaderboards"
import { useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import type { LeaderboardMetric } from "@/lib/types"
import { useTheme } from "@/theme/theme"
import { RADIUS, type TintName } from "@/theme/tokens"

const METRICS: LeaderboardMetric[] = ["steps", "points", "workouts", "active_days"]
const PERIODS: LbPeriod[] = ["today", "week", "month"]
const SCOPE_META: Record<LbScope, { icon: typeof Building2; tint: TintName }> = {
  company: { icon: Building2, tint: "habits" },
  department: { icon: Network, tint: "workout" },
  team: { icon: UsersRound, tint: "steps" },
}

function Change({ value }: { value: number }) {
  const { tint } = useTheme()
  if (value === 0) return <TintPill label="0" icon={Minus} color={tint("neutral").fg} bg={tint("neutral").bg} />
  return value > 0 ? (
    <TintPill label={`${value}`} icon={ArrowUpRight} color={tint("habits").fg} bg={tint("habits").bg} />
  ) : (
    <TintPill label={`${-value}`} icon={ArrowDownRight} color={tint("danger").fg} bg={tint("danger").bg} />
  )
}

function RankView({ r, period, metric, fetching }: { r: MyRankResult; period: LbPeriod; metric: LeaderboardMetric; fetching: boolean }) {
  const { colors, tint } = useTheme()
  const company = r.ranks[0]!
  const first = r.trend[0]?.rank ?? company.rank
  const climbed = first - company.rank
  return (
    <View style={[styles.gap, fetching && styles.dim]}>
      <GradientCard colors={["#fbbf24", "#f97316", "#f43f5e"]} emoji="🏅">
        <Text variant="caption" color="rgba(255,255,255,0.88)">
          {LB_METRIC_LABEL[metric]} · {LB_PERIOD_LABEL[period].toLowerCase()}
        </Text>
        <Text variant="display" color="#ffffff">
          {formatNumber(r.myValue)}{" "}
          <Text variant="subtitle" color="rgba(255,255,255,0.88)">
            {r.unit}
          </Text>
        </Text>
        <Text variant="caption" color="#ffffff">
          Top {company.topPercent}% of {company.label} · {climbed > 0 ? `▲ ${climbed} places in 6 weeks` : climbed < 0 ? `▼ ${-climbed} places in 6 weeks` : "holding steady"}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trend} style={styles.trendScroll} accessibilityLabel="Company rank trend">
          {r.trend.map((t, i) => {
            const last = i === r.trend.length - 1
            return (
              <View key={t.label} style={styles.trendItem}>
                <View style={[styles.trendBox, { backgroundColor: last ? "#ffffff" : "rgba(255,255,255,0.18)" }]}>
                  <Text variant="label" color={last ? "#ea580c" : "#ffffff"}>
                    #{t.rank}
                  </Text>
                  <Text variant="small" color={last ? "#9a3412" : "rgba(255,255,255,0.85)"} numberOfLines={1}>
                    {t.label}
                  </Text>
                </View>
                {!last ? <ChevronRight size={14} color="rgba(255,255,255,0.7)" /> : null}
              </View>
            )
          })}
        </ScrollView>
      </GradientCard>

      {r.optedOut ? (
        <View style={[styles.optOut, { backgroundColor: colors.muted }]}>
          <EyeOff size={16} color={colors.mutedForeground} />
          <Text variant="caption" tone="muted" style={styles.flex}>
            You&apos;re hidden from leaderboards — only you can see these positions.
          </Text>
        </View>
      ) : null}

      {r.ranks.map((x) => {
        const meta = SCOPE_META[x.scope]
        const toNext = x.gapToNext ? Math.max(4, Math.min(96, (r.myValue / (r.myValue + x.gapToNext)) * 100)) : 100
        return (
          <Card key={x.scope}>
            <View style={styles.row}>
              <IconTile icon={meta.icon} tint={meta.tint} />
              <View style={styles.flex}>
                <Text variant="small" tone="muted">
                  {x.scope === "company" ? "Company" : x.scope === "department" ? "Department" : "Team"}
                </Text>
                <Text variant="label" numberOfLines={1}>
                  {x.label}
                </Text>
              </View>
              <Change value={x.change} />
            </View>
            <Text variant="display" style={styles.mt8}>
              #{x.rank}
              <Text variant="body" tone="muted">
                {" "}
                of {formatNumber(x.total)}
              </Text>
            </Text>
            {x.gapToNext ? (
              <View style={styles.gapSm}>
                <Text variant="caption" tone="muted">
                  <Text variant="label">
                    {formatNumber(x.gapToNext)} {r.unit}
                  </Text>{" "}
                  to #{x.nextRank}
                </Text>
                <ProgressBar value={toNext} height={7} />
              </View>
            ) : (
              <Text variant="label" color={tint("points").fg} style={styles.mt8}>
                🏆 You&apos;re top of the {x.scope}!
              </Text>
            )}
            <Button
              title="Open full leaderboard"
              variant="outline"
              size="md"
              block
              style={styles.mt12}
              onPress={() => go(`/leaderboards?scope=${x.scope}${x.scope === "company" ? "" : "&view=people"}&metric=${metric}&period=${period}`)}
            />
          </Card>
        )
      })}
    </View>
  )
}

export default function MyRankScreen() {
  const params = useLocalSearchParams<{ metric?: string; period?: string }>()
  const [metric, setMetric] = useState<LeaderboardMetric>(METRICS.includes(params.metric as LeaderboardMetric) ? (params.metric as LeaderboardMetric) : "steps")
  const [period, setPeriod] = useState<LbPeriod>(PERIODS.includes(params.period as LbPeriod) ? (params.period as LbPeriod) : "week")
  const q = useApiQuery(["employee", "my-rank", metric, period], () => leaderboardsApi.myRank({ metric, period }), { placeholderData: (prev) => prev })

  return (
    <Screen title="My rank" back backHref="/leaderboards" refreshing={q.isRefetching && !q.isPlaceholderData} onRefresh={() => q.refetch()} testID="my-rank-screen">
      <ChipScroller<LeaderboardMetric> accessibilityLabel="Metric" value={metric} onChange={setMetric} options={METRICS.map((m) => ({ value: m, label: LB_METRIC_LABEL[m] }))} />
      <SegmentedControl<LbPeriod> value={period} onChange={setPeriod} accessibilityLabel="Period" options={PERIODS.map((p) => ({ value: p, label: LB_PERIOD_LABEL[p] }))} />
      {q.error && !q.data ? (
        <ErrorState title="Couldn't load your rank." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : !q.data ? (
        <>
          <Skeleton height={190} radius={RADIUS.xxl} />
          <Skeleton height={200} radius={RADIUS.xl} />
          <Skeleton height={200} radius={RADIUS.xl} />
        </>
      ) : q.data.myValue === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Join a challenge or log activity to get ranked."
          description="Your rank appears as soon as you have activity in this period."
          action={{ label: "Browse challenges", onPress: () => go("/challenges?tab=available") }}
        />
      ) : (
        <RankView r={q.data} period={period} metric={metric} fetching={q.isFetching && q.isPlaceholderData} />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: 16 },
  dim: { opacity: 0.6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  gapSm: { gap: 6, marginTop: 6 },
  trendScroll: { marginTop: 14, marginHorizontal: -18 },
  trend: { gap: 6, paddingHorizontal: 18, alignItems: "center" },
  trendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  trendBox: { alignItems: "center", borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 6, minWidth: 58 },
  optOut: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: RADIUS.lg },
})
