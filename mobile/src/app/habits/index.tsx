/**
 * SCR-M-038 My Habits (Today) — check-ins / increments, streaks and points.
 * Habits marked "Auto" complete from tracked data (Phase 2). Linked habits never earn points twice (decision #19).
 */
import { router } from "expo-router"
import { ListChecks, Plus, Sparkles, Trophy } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { HabitRow } from "@/components/track/habit-row"
import { Confetti } from "@/components/track/track-ui"
import { Button, Card, Chip, EmptyState, ErrorState, IconButton, PhaseBadge, ProgressRing, Screen, Skeleton, Text } from "@/components/ui"
import { habitsApi, type HabitsToday } from "@/lib/api/employee/habits"
import { useApiQuery } from "@/lib/api/hooks"
import { formatDate } from "@/lib/format"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

function Summary({ data, burst }: { data: HabitsToday; burst: number }) {
  const { tint } = useTheme()
  const allDone = data.total > 0 && data.done === data.total
  return (
    <Card padding={18}>
      <View style={styles.summary}>
        <View>
          {burst ? <Confetti key={burst} /> : null}
          <ProgressRing value={data.done} max={data.total} size={108} stroke={11} color={tint("habits").fg} trackColor={tint("habits").bg} accessibilityLabel={`${data.done} of ${data.total} habits done`}>
            <Text variant="heading">
              {data.done}/{data.total}
            </Text>
            <Text variant="small" tone="muted">
              done
            </Text>
          </ProgressRing>
        </View>
        <View style={styles.summaryText}>
          <Text variant="heading">{allDone ? "All habits done today! 🎉" : `${data.done} of ${data.total} habits done`}</Text>
          <Text variant="caption" tone="muted">
            {allDone ? "That's a perfect day. See you tomorrow!" : `${data.total - data.done} to go — you've got this.`}
          </Text>
          <View style={styles.chips}>
            <Chip size="sm" tint="points" label={`+${data.pointsToday} pts today`} />
            <Chip size="sm" tint="habits" icon={Trophy} label={`${data.perfectDays} perfect days`} />
          </View>
        </View>
      </View>
    </Card>
  )
}

export default function HabitsScreen() {
  const { colors } = useTheme()
  const q = useApiQuery(["employee", "habits", "today"], () => habitsApi.today())
  const [burst, setBurst] = useState(0)
  const data = q.data

  return (
    <Screen
      title="My habits"
      subtitle={formatDate(new Date(), "EEEE, d MMM")}
      back
      right={<IconButton icon={Plus} variant="primary" accessibilityLabel="Add habits" onPress={() => router.push("/habits/choose")} testID="add-habits" />}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      testID="habits-screen"
    >
      {!data ? (
        q.error ? (
          <ErrorState title="Couldn't load your habits" error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
        ) : (
          <>
            <Skeleton height={150} radius={RADIUS.xl} />
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} height={76} radius={RADIUS.xl} />
            ))}
          </>
        )
      ) : data.total === 0 ? (
        <Card>
          <EmptyState icon={ListChecks} title="Pick a few healthy habits to build." description="Start small — two or three habits you can tick off every day." action={{ label: "Choose habits", icon: Plus, onPress: () => router.push("/habits/choose") }} />
        </Card>
      ) : (
        <>
          <Summary data={data} burst={burst} />
          <View style={styles.list}>
            {data.items.map((h) => (
              <HabitRow key={h.id} h={h} isLastToComplete={!h.done && data.done === data.total - 1} onAllDone={() => setBurst((b) => b + 1)} />
            ))}
          </View>
          <View style={[styles.note, { borderColor: colors.border }]}>
            <Sparkles size={14} color={colors.mutedForeground} />
            <Text variant="small" tone="muted" style={styles.flex}>
              Habits marked Auto complete from your tracked data. Habits linked to steps, water or workouts earn points there — never twice.
            </Text>
            <PhaseBadge phase={2} />
          </View>
          <Button title="Add or change habits" icon={Plus} variant="outline" onPress={() => router.push("/habits/choose")} />
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { flexDirection: "row", alignItems: "center", gap: 16 },
  summaryText: { flex: 1, gap: 4, minWidth: 0 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  list: { gap: 10 },
  note: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, borderStyle: "dashed" },
})
