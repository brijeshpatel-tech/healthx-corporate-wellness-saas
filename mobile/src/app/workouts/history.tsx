/** SCR-M-035 Workout History — monthly summary and completed workouts, newest first. */
import { keepPreviousData } from "@tanstack/react-query"
import { router } from "expo-router"
import { ChevronRight, Clock, Coins, Dumbbell, Flame, Trophy } from "lucide-react-native"
import { useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { PeriodNavigator } from "@/components/track/track-ui"
import { CoverArt } from "@/components/track/workout-ui"
import { localDate, monthLabel, shiftMonth } from "@/components/track/utils"
import { Card, EmptyState, ErrorState, Screen, Skeleton, StatTile, Text } from "@/components/ui"
import { workoutsApi, type WorkoutHistoryRow } from "@/lib/api/employee/workouts"
import { useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatDuration, formatNumber, formatTime } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

function HistoryRow({ r }: { r: WorkoutHistoryRow }) {
  const { colors, tint } = useTheme()
  const at = r.completedAt ?? r.startedAt
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${r.name}, ${formatDate(at, "EEE d MMM")}, ${formatDuration(r.durationMin)}, ${r.points} points. Open workout`}
      onPress={() => {
        haptic.tap()
        router.push(`/workouts/${r.workoutId}`)
      }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.muted }]}
    >
      <CoverArt emoji={r.coverEmoji} color={r.coverColor} size={48} radius={14} />
      <View style={styles.flex}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {r.name}
        </Text>
        <Text variant="small" tone="muted" numberOfLines={1}>
          {formatDate(at, "EEE d MMM")} · {formatTime(at)} · {formatDuration(r.durationMin)}
        </Text>
      </View>
      <View style={[styles.points, { backgroundColor: tint("points").bg }]}>
        <Text variant="small" color={tint("points").fg}>
          +{r.points}
        </Text>
      </View>
      <ChevronRight size={16} color={colors.mutedForeground} />
    </Pressable>
  )
}

export default function WorkoutHistoryScreen() {
  const { colors } = useTheme()
  const current = localDate().slice(0, 7)
  const [month, setMonth] = useState(current)
  const q = useApiQuery(["employee", "workouts", "history", month], () => workoutsApi.history({ month }), { placeholderData: keepPreviousData })
  const oldest = q.data?.months[q.data.months.length - 1] ?? current
  const data = q.data

  return (
    <Screen title="Workout history" back backHref="/workouts" refreshing={q.isRefetching && !q.isPlaceholderData} onRefresh={() => q.refetch()} testID="workout-history-screen">
      {!data ? (
        q.error ? (
          <ErrorState title="Couldn't load history." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
        ) : (
          <>
            <Skeleton height={44} />
            <Skeleton height={190} radius={RADIUS.xl} />
            <Skeleton height={260} radius={RADIUS.xl} />
          </>
        )
      ) : data.totalCompleted === 0 ? (
        <Card>
          <EmptyState icon={Trophy} title="No workouts yet." description="Start your first workout to earn the First Workout badge." action={{ label: "Browse workouts", icon: Dumbbell, onPress: () => router.replace("/workouts") }} />
        </Card>
      ) : (
        <>
          <PeriodNavigator
            label={monthLabel(month)}
            onPrev={() => setMonth(shiftMonth(month, -1))}
            onNext={() => setMonth(shiftMonth(month, 1))}
            prevDisabled={month <= oldest || q.isPlaceholderData}
            nextDisabled={month >= current || q.isPlaceholderData}
            prevLabel="Previous month"
            nextLabel="Next month"
          />
          <View style={[styles.body, q.isPlaceholderData && styles.loading]}>
            <View style={styles.stats}>
              <StatTile icon={Dumbbell} tint="workout" label="Workouts" value={formatNumber(data.summary.workouts)} />
              <StatTile icon={Clock} tint="steps" label="Minutes" value={formatNumber(data.summary.minutes)} />
            </View>
            <View style={styles.stats}>
              <StatTile icon={Coins} tint="points" label="Points" value={formatNumber(data.summary.points)} />
              <StatTile icon={Flame} tint="streak" label="Calories (kcal)" value={formatNumber(data.summary.calories)} />
            </View>
            {data.items.length === 0 ? (
              <Card>
                <EmptyState compact icon={Dumbbell} title={`No workouts in ${monthLabel(month)}`} description="Pick another month or start a workout today." />
              </Card>
            ) : (
              <Card padding={4}>
                {data.items.map((r, i) => (
                  <View key={r.id}>
                    {i > 0 ? <View style={[styles.sep, { backgroundColor: colors.border }]} /> : null}
                    <HistoryRow r={r} />
                  </View>
                ))}
              </Card>
            )}
          </View>
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  body: { gap: 12 },
  loading: { opacity: 0.5 },
  stats: { flexDirection: "row", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: RADIUS.lg },
  points: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 70 },
})
