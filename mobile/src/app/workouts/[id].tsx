/** SCR-M-031 Workout Detail — overview, ordered exercises with rest, equipment, muscle groups, points; Start / Save (Phase 2). */
import { LinearGradient } from "expo-linear-gradient"
import { router, useLocalSearchParams } from "expo-router"
import { Bookmark, BookmarkCheck, ChevronLeft, Clock, Coins, Dumbbell, Flame, MapPin, Pause, Play, Repeat, Target } from "lucide-react-native"
import { StyleSheet, View } from "react-native"
import { EQUIPMENT_LABEL, LEVEL_LABEL, LOCATION_LABEL, titleWord } from "@/components/track/workout-ui"
import { formatClock, withAlpha } from "@/components/track/utils"
import { Button, Card, EmptyState, goBack, IconButton, PhaseBadge, Screen, Skeleton, Text } from "@/components/ui"
import { workoutsApi, type WorkoutDetail } from "@/lib/api/employee/workouts"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatRelative } from "@/lib/format"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

function HeroChip({ icon: Icon, text }: { icon: typeof Clock; text: string }) {
  return (
    <View style={styles.heroChip}>
      <Icon size={13} color="#ffffff" />
      <Text variant="small" color="#ffffff">
        {text}
      </Text>
    </View>
  )
}

function Detail({ w }: { w: WorkoutDetail }) {
  const { colors } = useTheme()
  const save = useApiMutation(workoutsApi.toggleSave, { success: (r) => (r.saved ? "Saved to My workouts" : "Removed from My workouts") })

  return (
    <Screen
      noHeader
      footer={<Button title="Start workout" icon={Play} onPress={() => router.push(`/workouts/${w.id}/play`)} testID="start-workout" />}
      contentStyle={styles.content}
    >
      <LinearGradient colors={[w.coverColor, withAlpha(w.coverColor, 0.72)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroTop}>
          <IconButton icon={ChevronLeft} variant="ghost" color="#ffffff" accessibilityLabel="Back" onPress={() => goBack("/workouts")} style={styles.glass} testID="back" />
          <View style={styles.heroActions}>
            <PhaseBadge phase={2} style={styles.phase} />
            <IconButton
              icon={w.saved ? BookmarkCheck : Bookmark}
              variant="ghost"
              color="#ffffff"
              accessibilityLabel={w.saved ? "Remove from saved workouts" : "Save workout"}
              disabled={save.isPending}
              onPress={() => save.mutate({ id: w.id, saved: !w.saved })}
              style={[styles.glass, w.saved && styles.glassOn]}
              testID="save-workout"
            />
          </View>
        </View>
        <View style={styles.heroBody}>
          <View style={styles.flex}>
            <Text variant="label" color="rgba(255,255,255,0.85)">
              {w.category}
            </Text>
            <Text variant="title" color="#ffffff" accessibilityRole="header">
              {w.name}
            </Text>
          </View>
          <Text style={styles.heroEmoji}>{w.coverEmoji}</Text>
        </View>
        <Text variant="caption" color="rgba(255,255,255,0.92)">
          {w.description}
        </Text>
        <View style={styles.heroChips}>
          <HeroChip icon={Clock} text={`${w.durationMin} min`} />
          <HeroChip icon={Target} text={LEVEL_LABEL[w.level]} />
          <HeroChip icon={MapPin} text={LOCATION_LABEL[w.location]} />
          <HeroChip icon={Flame} text={`~${w.calories} kcal`} />
          <View style={[styles.heroChip, styles.pointsChip]}>
            <Coins size={13} color="#d97706" />
            <Text variant="small" color="#0f172a">
              +{w.points} points
            </Text>
          </View>
        </View>
      </LinearGradient>

      <Card>
        <View style={styles.listHead}>
          <Text variant="subtitle">{w.steps.length} exercises</Text>
          <Text variant="small" tone="muted">
            {formatClock(w.totalWorkSec)} work · {formatClock(w.totalRestSec)} rest
          </Text>
        </View>
        {w.steps.map((s, i) => (
          <View key={`${s.exercise.id}-${i}`}>
            <View style={styles.step}>
              <View style={[styles.stepMedia, { backgroundColor: colors.muted }]}>
                <Text style={styles.stepEmoji}>{s.exercise.mediaEmoji}</Text>
                <View style={[styles.stepNum, { backgroundColor: colors.foreground }]}>
                  <Text variant="small" color={colors.background}>
                    {i + 1}
                  </Text>
                </View>
              </View>
              <View style={styles.flex}>
                <Text variant="bodyMedium" numberOfLines={1}>
                  {s.exercise.name}
                </Text>
                <Text variant="small" tone="muted" numberOfLines={1}>
                  {s.exercise.muscleGroups.map(titleWord).join(", ")}
                </Text>
              </View>
              <View style={[styles.amount, { backgroundColor: colors.muted }]}>
                {s.reps ? <Repeat size={12} color={colors.mutedForeground} /> : <Clock size={12} color={colors.mutedForeground} />}
                <Text variant="small">{s.reps ? `${s.reps} reps` : `${s.durationSec}s`}</Text>
              </View>
            </View>
            {i < w.steps.length - 1 && s.restSec ? (
              <View style={[styles.rest, { borderColor: colors.border }]}>
                <Pause size={11} color={colors.mutedForeground} />
                <Text variant="small" tone="muted">
                  Rest {s.restSec}s
                </Text>
              </View>
            ) : null}
          </View>
        ))}
      </Card>

      <Card>
        <View style={styles.section}>
          <Text variant="overline" tone="muted">
            Equipment
          </Text>
          <View style={styles.tags}>
            {(w.equipment.length ? w.equipment : ["none"]).map((e) => (
              <View key={e} style={[styles.tag, { borderColor: colors.border }]}>
                <Dumbbell size={12} color={colors.mutedForeground} />
                <Text variant="small">{EQUIPMENT_LABEL(e)}</Text>
              </View>
            ))}
          </View>
          <Text variant="overline" tone="muted" style={styles.gapTop}>
            Muscle groups
          </Text>
          <View style={styles.tags}>
            {w.muscleGroups.map((m) => (
              <View key={m} style={[styles.tag, { backgroundColor: colors.muted, borderColor: colors.muted }]}>
                <Text variant="small">{titleWord(m)}</Text>
              </View>
            ))}
          </View>
          <Text variant="caption" tone="muted" style={styles.gapTop}>
            {w.lastCompletedAt ? `Last completed: ${formatRelative(w.lastCompletedAt)} · done ${w.doneCount}×.` : "You haven't done this one yet."} Finish at least {Math.round(w.minCompletionForPoints * 100)}% of the exercises to earn points.
          </Text>
        </View>
      </Card>
    </Screen>
  )
}

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const q = useApiQuery(["employee", "workouts", "detail", id], () => workoutsApi.get({ id: id! }), { retry: false, enabled: !!id })
  if (q.data) return <Detail w={q.data} />
  return (
    <Screen title="Workout" back backHref="/workouts">
      {q.error ? (
        <Card>
          <EmptyState icon={Dumbbell} title="This workout is no longer available." description="It may have been removed or replaced. Pick another one from the library." action={{ label: "Browse workouts", onPress: () => router.replace("/workouts") }} />
        </Card>
      ) : (
        <>
          <Skeleton height={260} radius={RADIUS.xl} />
          <Skeleton height={380} radius={RADIUS.xl} />
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  content: { paddingTop: 12 },
  hero: { borderRadius: RADIUS.xxl, padding: 16, gap: 10, overflow: "hidden" },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  heroActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  glass: { backgroundColor: "rgba(255,255,255,0.18)" },
  glassOn: { backgroundColor: "rgba(255,255,255,0.32)" },
  phase: { backgroundColor: "rgba(255,255,255,0.9)" },
  heroBody: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  heroEmoji: { fontSize: 64, lineHeight: 76 },
  heroChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  heroChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill, backgroundColor: "rgba(255,255,255,0.2)" },
  pointsChip: { backgroundColor: "#ffffff" },
  listHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  step: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  stepMedia: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stepEmoji: { fontSize: 24, lineHeight: 30 },
  stepNum: { position: "absolute", top: -4, left: -4, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  amount: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: RADIUS.pill },
  rest: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 23, paddingLeft: 36, paddingVertical: 4, borderLeftWidth: 2, borderStyle: "dashed" },
  section: { gap: 8 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill, borderWidth: 1 },
  gapTop: { marginTop: 6 },
})
