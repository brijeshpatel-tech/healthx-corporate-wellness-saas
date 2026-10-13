/** SCR-M-034 Workout Complete — celebration, summary, points (awarded once) and any badge unlocked. */
import { LinearGradient } from "expo-linear-gradient"
import { router } from "expo-router"
import { AlertTriangle, Award, Check, Clock, Coins, Flame, History, RotateCcw } from "lucide-react-native"
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Button, CONTENT_MAX_WIDTH, Text } from "@/components/ui"
import type { CompleteResult } from "@/lib/api/employee/workouts"
import { errorMessage } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import { useTheme } from "@/theme/theme"
import { BRAND_GRADIENT, RADIUS } from "@/theme/tokens"
import { Confetti, PopIn } from "./track-ui"
import { formatClock, withAlpha } from "./utils"

export interface WorkoutCompleteProps {
  result?: CompleteResult
  pending: boolean
  error: unknown
  onRetry: () => void
  endedEarly: boolean
  completedCount: number
  elapsed: number
}

const finish = () => router.dismissTo("/workouts")

export function WorkoutComplete({ result, pending, error, onRetry, endedEarly, completedCount, elapsed }: WorkoutCompleteProps) {
  const { colors, tint } = useTheme()
  const insets = useSafeAreaInsets()

  if (error && !result)
    return (
      <View style={[styles.center, { paddingTop: insets.top + 24 }]}>
        <View style={[styles.alert, { backgroundColor: tint("points").bg }]}>
          <AlertTriangle size={30} color={tint("points").fg} />
        </View>
        <Text variant="heading" align="center">
          We couldn&apos;t save your workout
        </Text>
        <Text variant="body" tone="muted" align="center" style={styles.narrow}>
          {errorMessage(error)} Check your connection and try again — your progress is kept on this screen.
        </Text>
        <Button title="Try again" icon={RotateCcw} onPress={onRetry} style={styles.narrowBtn} />
        <Button title="Back to workouts" variant="ghost" size="md" onPress={finish} />
      </View>
    )

  if (pending || !result)
    return (
      <View style={styles.center} accessibilityLiveRegion="polite">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="subtitle">Saving your workout…</Text>
      </View>
    )

  const earned = result.pointsEarned > 0
  const tiles = [
    { icon: Clock, label: "Duration", value: formatClock(Math.round(elapsed)) },
    { icon: Check, label: "Exercises", value: `${result.exercisesCompleted}/${result.totalExercises}` },
    { icon: Flame, label: "Calories", value: `~${formatNumber(result.calories)}` },
    { icon: Award, label: "Streak", value: `${result.streakDays} day${result.streakDays === 1 ? "" : "s"}` },
  ]

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 28, paddingBottom: Math.max(insets.bottom, 16) + 16 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.inner}>
        <View style={styles.trophyWrap}>
          {result.pointsEligible ? <Confetti /> : null}
          <PopIn>
            {result.pointsEligible ? (
              <LinearGradient colors={[BRAND_GRADIENT[0], BRAND_GRADIENT[1]]} style={styles.trophy}>
                <Text style={styles.trophyEmoji}>🏆</Text>
              </LinearGradient>
            ) : (
              <View style={[styles.trophy, { backgroundColor: colors.muted }]}>
                <Text style={styles.trophyEmoji}>{result.coverEmoji}</Text>
              </View>
            )}
          </PopIn>
        </View>

        <View style={styles.headline}>
          <Text variant="title" align="center" accessibilityRole="header">
            {result.pointsEligible ? (earned ? `Great job! +${result.pointsEarned} points` : "Great job!") : "Workout saved"}
          </Text>
          <Text variant="body" tone="muted" align="center">
            {result.pointsEligible
              ? endedEarly
                ? `You finished ${result.exercisesCompleted} of ${result.totalExercises} exercises of ${result.workoutName}.`
                : `You completed ${result.workoutName}.`
              : `You did ${completedCount} of ${result.totalExercises} exercises. Finish at least half next time to earn points.`}
          </Text>
          {result.pointsCapped ? (
            <Text variant="caption" tone="warning" align="center">
              You&apos;ve reached today&apos;s points limit for workouts — your workout still counts!
            </Text>
          ) : null}
        </View>

        <View style={styles.tiles}>
          {tiles.map((t) => (
            <View key={t.label} style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <t.icon size={16} color={colors.mutedForeground} />
              <Text variant="heading" numberOfLines={1} adjustsFontSizeToFit>
                {t.value}
              </Text>
              <Text variant="small" tone="muted">
                {t.label}
              </Text>
            </View>
          ))}
        </View>

        {earned ? (
          <PopIn delay={250}>
            <View style={[styles.pointsCard, { backgroundColor: tint("points").bg, borderColor: withAlpha("#f59e0b", 0.35) }]}>
              <Coins size={30} color={tint("points").fg} />
              <View style={styles.flex}>
                <Text variant="subtitle">+{result.pointsEarned} points added</Text>
                <Text variant="caption" tone="muted">
                  {result.workoutsThisMonth} workout{result.workoutsThisMonth === 1 ? "" : "s"} this month · keep the streak going!
                </Text>
              </View>
            </View>
          </PopIn>
        ) : null}

        {result.badge ? (
          <PopIn delay={500}>
            <LinearGradient colors={[result.badge.color, withAlpha(result.badge.color, 0.72)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
              <View style={styles.badgeRow}>
                <View style={styles.badgeIcon}>
                  <Text style={styles.badgeEmoji}>{result.badge.icon}</Text>
                </View>
                <View style={styles.flex}>
                  <Text variant="overline" color="rgba(255,255,255,0.88)">
                    Badge unlocked
                  </Text>
                  <Text variant="heading" color="#ffffff">
                    {result.badge.name}
                  </Text>
                  <Text variant="caption" color="rgba(255,255,255,0.92)">
                    {result.badge.description}
                    {result.badge.points ? ` +${result.badge.points} bonus points` : ""}
                  </Text>
                </View>
              </View>
              <Button title="View badge" variant="secondary" size="sm" block onPress={() => router.push("/badges")} />
            </LinearGradient>
          </PopIn>
        ) : null}

        <View style={styles.actions}>
          <Button title="Done" onPress={finish} feedback="success" testID="workout-done" />
          <Button title="View history" icon={History} variant="outline" onPress={() => router.replace("/workouts/history")} />
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  narrow: { maxWidth: 340 },
  narrowBtn: { alignSelf: "stretch", maxWidth: 340, width: "100%", marginTop: 8 },
  alert: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  scroll: { flexGrow: 1, paddingHorizontal: 20 },
  inner: { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center", gap: 18, flexGrow: 1 },
  trophyWrap: { alignItems: "center", justifyContent: "center", height: 130 },
  trophy: { width: 112, height: 112, borderRadius: 56, alignItems: "center", justifyContent: "center" },
  trophyEmoji: { fontSize: 56, lineHeight: 66 },
  headline: { gap: 6 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: "47%", flexGrow: 1, alignItems: "center", gap: 3, paddingVertical: 12, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth },
  pointsCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: RADIUS.lg, borderWidth: 1 },
  badge: { borderRadius: RADIUS.xl, padding: 14, gap: 12 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  badgeIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  badgeEmoji: { fontSize: 30, lineHeight: 36 },
  actions: { gap: 10, marginTop: "auto", paddingTop: 8 },
})
