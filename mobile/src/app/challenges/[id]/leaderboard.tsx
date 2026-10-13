/** SCR-M-045 Challenge Leaderboard — podium, ranked list, my row pinned, groups / people view, #348 rank alerts. */
import { useLocalSearchParams } from "expo-router"
import { Medal, RefreshCw } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { NameDisplayNote, PinnedMe, Podium, RankList, useRankAlertToast } from "@/components/engage/leaderboard"
import { EmojiTile } from "@/components/engage/shared"
import { EmptyState, ErrorState, IconButton, Screen, SegmentedControl, Skeleton, Text } from "@/components/ui"
import { challengesApi, formatMetricValue } from "@/lib/api/employee/challenges"
import { useApiQuery } from "@/lib/api/hooks"
import { formatRelative } from "@/lib/format"
import { RADIUS } from "@/theme/tokens"

export default function ChallengeLeaderboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [view, setView] = useState<"groups" | "individual" | undefined>(undefined)
  const q = useApiQuery(["employee", "challenge", id, "leaderboard", view ?? "default"], () => challengesApi.leaderboard({ id, view }), { placeholderData: (prev) => prev, enabled: !!id })
  const d = q.data
  useRankAlertToast(d?.rankAlert)
  const fmt = (v: number) => (d ? formatMetricValue(v, d.challenge.metric, false) : String(v))
  const unit = d ? (d.view === "groups" ? `avg ${d.challenge.unit}` : d.challenge.unit) : ""
  const empty = d && (d.entries.length === 0 || d.entries.every((e) => e.value === 0))
  const meHidden = !!d?.me && !d.entries.some((e) => e.isMe)

  return (
    <Screen
      title="Leaderboard"
      back
      backHref={`/challenges/${id}`}
      right={<IconButton icon={RefreshCw} variant="ghost" accessibilityLabel="Refresh leaderboard" disabled={q.isFetching} onPress={() => q.refetch()} />}
      refreshing={q.isRefetching && !q.isPlaceholderData}
      onRefresh={() => q.refetch()}
      footer={d && meHidden && d.me && !empty ? <PinnedMe me={d.me} max={d.entries[0]?.value ?? d.me.value} unit={unit} valueFormatter={fmt} /> : undefined}
      testID="challenge-leaderboard"
    >
      {q.error && !d ? (
        <ErrorState title="Couldn't load the leaderboard." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : !d ? (
        <>
          <Skeleton height={64} radius={RADIUS.xl} />
          <Skeleton height={250} radius={RADIUS.xxl} />
          <Skeleton height={300} radius={RADIUS.xl} />
        </>
      ) : (
        <>
          <View style={styles.head}>
            <EmojiTile emoji={d.challenge.coverEmoji} color={d.challenge.coverColor} size={52} solid />
            <View style={styles.flex}>
              <Text variant="heading" numberOfLines={2}>
                {d.challenge.name}
              </Text>
              <Text variant="caption" tone="muted">
                {d.total} {d.view === "groups" ? (d.challenge.teamUnit === "team" ? "teams" : "departments") : "participants"} · Updated {formatRelative(d.updatedAt)}
              </Text>
            </View>
          </View>

          {d.hasGroups ? (
            <SegmentedControl
              value={d.view}
              onChange={(v) => setView(v)}
              accessibilityLabel="Leaderboard view"
              options={[
                { value: "groups", label: d.challenge.teamUnit === "team" ? "Teams" : "Departments" },
                { value: "individual", label: "People" },
              ]}
            />
          ) : null}

          {empty ? (
            <EmptyState icon={Medal} title="Rankings appear once participants start logging activity." description="Check back after the next sync." />
          ) : (
            <View style={[styles.list, q.isFetching && q.isPlaceholderData && styles.dim]}>
              <Podium entries={d.entries.slice(0, 3)} unit={d.view === "groups" ? "avg" : d.challenge.unit} valueFormatter={fmt} />
              <RankList entries={d.entries} skipTop={3} unit={unit} valueFormatter={fmt} />
              {d.view === "individual" ? <NameDisplayNote mode={d.nameDisplay} /> : null}
            </View>
          )}
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  list: { gap: 14 },
  dim: { opacity: 0.6 },
})
