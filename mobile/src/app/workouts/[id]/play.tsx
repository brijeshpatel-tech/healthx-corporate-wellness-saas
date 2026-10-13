/**
 * SCR-M-032 Player – Exercise, SCR-M-033 Player – Rest, SCR-M-034 Workout Complete.
 * Full-screen, wall-clock timer, pause / resume / skip / previous / end early (with confirmation), haptics,
 * auto-pause when the app goes to the background. Points are awarded once by the complete endpoint.
 */
import { router, Stack, useLocalSearchParams } from "expo-router"
import { ChevronDown, ChevronUp, Dumbbell, Pause, Play, Plus, SkipBack, SkipForward, X } from "lucide-react-native"
import { useEffect, useReducer, useRef, useState, type ReactNode } from "react"
import { Animated, AppState, BackHandler, Pressable, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { WorkoutComplete } from "@/components/track/workout-complete"
import { INITIAL_PLAYER, makePlayerReducer } from "@/components/track/workout-player"
import { formatClock, withAlpha } from "@/components/track/utils"
import { Button, CONTENT_MAX_WIDTH, ConfirmDialog, EmptyState, IconButton, ProgressRing, Skeleton, Text } from "@/components/ui"
import { workoutsApi, type WorkoutDetail } from "@/lib/api/employee/workouts"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

/** Big countdown number that pops on every change. */
function CountdownNumber({ value, color }: { value: number; color: string }) {
  const [scale] = useState(() => new Animated.Value(0.5))
  useEffect(() => {
    scale.setValue(0.5)
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start()
  }, [value, scale])
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Text style={[styles.countdown, { color }]} accessibilityLiveRegion="assertive">
        {value}
      </Text>
    </Animated.View>
  )
}

/** Gentle bounce for the exercise media (emoji stand-in for the exercise video / image). */
function Bounce({ children, active }: { children: ReactNode; active: boolean }) {
  const [y] = useState(() => new Animated.Value(0))
  useEffect(() => {
    if (!active) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: -8, duration: 600, useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [active, y])
  return <Animated.View style={{ transform: [{ translateY: y }] }}>{children}</Animated.View>
}

function Player({ w }: { w: WorkoutDetail }) {
  const { colors, tint } = useTheme()
  const insets = useSafeAreaInsets()
  const [reducer] = useState(() => makePlayerReducer(w))
  const [s, dispatch] = useReducer(reducer, INITIAL_PLAYER)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [showSteps, setShowSteps] = useState(false)
  const lastTick = useRef<number | null>(null)
  const completeSent = useRef(false)
  const rest = tint("steps")

  const start = useApiMutation(workoutsApi.start, {
    invalidate: false,
    errorTitle: "Couldn't start the workout",
    onSuccess: (r) => {
      haptic.success()
      setSessionId(r.sessionId)
      dispatch({ type: "begin" })
    },
  })
  const complete = useApiMutation(workoutsApi.complete, { errorTitle: "Couldn't save your workout" })

  // Timer loop, accurate to wall-clock time.
  const running = !s.paused && (s.phase === "countdown" || s.phase === "exercise" || s.phase === "rest")
  useEffect(() => {
    if (!running) {
      lastTick.current = null
      return
    }
    lastTick.current = Date.now()
    const t = setInterval(() => {
      const now = Date.now()
      const dt = (now - (lastTick.current ?? now)) / 1000
      lastTick.current = now
      dispatch({ type: "tick", dt })
    }, 200)
    return () => clearInterval(t)
  }, [running])

  // Auto-pause when the app leaves the foreground (call, notification…).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") dispatch({ type: "pause" })
    })
    return () => sub.remove()
  }, [])

  // Haptics on phase changes and for the last 3 seconds.
  useEffect(() => {
    if (s.phase === "exercise") haptic.warning()
    else if (s.phase === "rest") haptic.tap()
    else if (s.phase === "done" && !s.endedEarly) haptic.success()
  }, [s.phase, s.index, s.endedEarly])
  const secLeft = Math.ceil(s.remaining)
  useEffect(() => {
    if (running && (s.phase === "countdown" || secLeft <= 3) && secLeft > 0) haptic.select()
  }, [secLeft, running, s.phase])

  // Progress sync (best effort; the session is completed at the end).
  useEffect(() => {
    if (sessionId && (s.phase === "exercise" || s.phase === "rest")) workoutsApi.progress({ id: sessionId, exerciseIndex: s.index, phase: s.phase, paused: s.paused }).catch(() => undefined)
  }, [s.phase, s.index, s.paused, sessionId])

  // Finished → record the session once.
  useEffect(() => {
    if (s.phase !== "done" || !sessionId || completeSent.current) return
    completeSent.current = true
    complete.mutate({ id: sessionId, exercisesCompleted: s.completed.length, totalExercises: w.steps.length, durationSec: Math.round(s.elapsed), endedEarly: s.endedEarly })
  }, [s.phase, sessionId, s.completed.length, s.elapsed, s.endedEarly, w.steps.length, complete])

  const askEnd = () => {
    if (s.phase === "ready") return router.back()
    if (s.phase === "done") return
    dispatch({ type: "pause" })
    setConfirmEnd(true)
  }

  // Android back button: confirm instead of leaving mid-workout.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (s.phase === "ready" || s.phase === "done") return false
      dispatch({ type: "pause" })
      setConfirmEnd(true)
      return true
    })
    return () => sub.remove()
  }, [s.phase])

  if (s.phase === "done")
    return (
      <WorkoutComplete
        result={complete.data}
        pending={complete.isPending || (!complete.data && !complete.error)}
        error={complete.error}
        onRetry={() => sessionId && complete.mutate({ id: sessionId, exercisesCompleted: s.completed.length, totalExercises: w.steps.length, durationSec: Math.round(s.elapsed), endedEarly: s.endedEarly })}
        endedEarly={s.endedEarly}
        completedCount={s.completed.length}
        elapsed={s.elapsed}
      />
    )

  const step = w.steps[s.index]!
  const next = w.steps[s.index + 1]
  const isRest = s.phase === "rest"
  const canEarn = s.completed.length / w.steps.length >= w.minCompletionForPoints

  return (
    <View style={[styles.fill, { backgroundColor: isRest ? rest.bg : colors.background, paddingTop: insets.top }]}>
      <View style={styles.inner}>
        {/* Top bar */}
        <View style={styles.top}>
          <IconButton icon={X} variant="ghost" accessibilityLabel={s.phase === "ready" ? "Close" : "End workout"} onPress={askEnd} testID="end-workout" />
          <View style={styles.topTitle}>
            <Text variant="label" numberOfLines={1} align="center">
              {w.name}
            </Text>
            <Text variant="small" tone="muted" align="center">
              {s.phase === "ready" ? `${w.steps.length} exercises · ${w.durationMin} min` : `Exercise ${s.index + 1} of ${w.steps.length}`}
            </Text>
          </View>
          <View style={styles.elapsed} accessibilityLabel={`Elapsed ${formatClock(s.elapsed)}`}>
            <Text variant="label" tone="muted">
              {formatClock(s.elapsed)}
            </Text>
          </View>
        </View>
        <View style={styles.segments} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {w.steps.map((_, i) => {
            const bg = s.completed.includes(i) ? colors.primary : i < s.index ? colors.mutedForeground : i === s.index && s.phase !== "ready" ? withAlpha(colors.primary, 0.45) : colors.muted
            return <View key={i} style={[styles.segment, { backgroundColor: bg }, i < s.index && !s.completed.includes(i) && styles.skipped]} />
          })}
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} bounces={false}>
          {s.phase === "ready" ? (
            <>
              <View style={[styles.readyCover, { backgroundColor: withAlpha(w.coverColor, 0.16) }]}>
                <Text style={styles.readyEmoji}>{w.coverEmoji}</Text>
              </View>
              <View style={styles.center}>
                <Text variant="title" align="center">
                  Ready when you are
                </Text>
                <Text variant="body" tone="muted" align="center">
                  Clear some space, grab water and follow the timer. You can pause any time.
                </Text>
              </View>
              <View style={[styles.upNext, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: showSteps }} onPress={() => setShowSteps((v) => !v)} style={styles.upNextHead}>
                  <Text variant="subtitle" style={styles.flex} numberOfLines={1}>
                    First up: {w.steps[0]!.exercise.name}
                  </Text>
                  {showSteps ? <ChevronUp size={18} color={colors.mutedForeground} /> : <ChevronDown size={18} color={colors.mutedForeground} />}
                </Pressable>
                {showSteps
                  ? w.steps.map((st, i) => (
                      <View key={i} style={styles.stepLine}>
                        <Text variant="caption" tone="muted" style={styles.flex} numberOfLines={1}>
                          {i + 1}. {st.exercise.name}
                        </Text>
                        <Text variant="caption" tone="muted">
                          {st.reps ? `${st.reps} reps` : `${st.durationSec}s`}
                        </Text>
                      </View>
                    ))
                  : null}
              </View>
            </>
          ) : s.phase === "countdown" ? (
            <View style={[styles.center, styles.countdownWrap]}>
              <Text variant="overline" tone="muted">
                Get ready
              </Text>
              <CountdownNumber value={Math.max(1, secLeft)} color={colors.primary} />
              <Text variant="heading">{w.steps[0]!.exercise.name}</Text>
            </View>
          ) : isRest ? (
            <>
              <Text variant="overline" color={rest.fg} align="center">
                Rest
              </Text>
              <View style={styles.ring}>
                <ProgressRing value={s.remaining} max={s.total} size={224} stroke={14} color={rest.fg} trackColor={colors.card} accessibilityLabel={`Rest, ${secLeft} seconds left`}>
                  <Text style={styles.bigNumber}>{secLeft}</Text>
                  <Text variant="caption" tone="muted">
                    seconds
                  </Text>
                </ProgressRing>
              </View>
              <View style={styles.restActions}>
                <Button title="10 s" icon={Plus} variant="outline" size="md" onPress={() => dispatch({ type: "addRest", sec: 10 })} testID="add-rest" />
                <Button title="Skip rest" iconRight={SkipForward} variant="outline" size="md" onPress={() => dispatch({ type: "skip" })} testID="skip-rest" />
              </View>
              {next ? (
                <View style={[styles.nextCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.nextMedia, { backgroundColor: colors.muted }]}>
                    <Text style={styles.nextEmoji}>{next.exercise.mediaEmoji}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text variant="small" tone="muted">
                      Next up
                    </Text>
                    <Text variant="subtitle" numberOfLines={1}>
                      {next.exercise.name}
                    </Text>
                    <Text variant="small" tone="muted">
                      {next.reps ? `${next.reps} reps · ` : ""}
                      {next.durationSec}s
                    </Text>
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <View style={styles.ring}>
                <ProgressRing value={s.remaining} max={s.total} size={224} stroke={14} accessibilityLabel={`${step.exercise.name}, ${formatClock(secLeft)} left`}>
                  <Bounce active={!s.paused}>
                    <Text style={styles.media}>{step.exercise.mediaEmoji}</Text>
                  </Bounce>
                  <Text style={styles.clock}>{formatClock(secLeft)}</Text>
                </ProgressRing>
              </View>
              <View style={styles.center}>
                <Text variant="title" align="center" accessibilityRole="header">
                  {step.exercise.name}
                </Text>
                <Text variant="label" tone="primary" align="center">
                  {step.reps ? `Aim for ${step.reps} reps` : "Keep going until the timer ends"}
                </Text>
              </View>
              <View style={[styles.instructions, { backgroundColor: colors.muted }]}>
                {step.exercise.instructions.map((line, i) => (
                  <View key={i} style={styles.instruction}>
                    <View style={[styles.instructionNum, { backgroundColor: colors.card }]}>
                      <Text variant="small">{i + 1}</Text>
                    </View>
                    <Text variant="caption" tone="muted" style={styles.flex}>
                      {line}
                    </Text>
                  </View>
                ))}
              </View>
              {next ? (
                <Text variant="caption" tone="muted" align="center">
                  Next: <Text variant="label">{next.exercise.name}</Text>
                </Text>
              ) : (
                <Text variant="label" tone="primary" align="center">
                  Last exercise — finish strong! 💪
                </Text>
              )}
            </>
          )}
        </ScrollView>

        <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          {s.phase === "ready" ? (
            <Button title="Start" icon={Play} loading={start.isPending} onPress={() => start.mutate({ workoutId: w.id })} testID="player-start" />
          ) : s.phase === "exercise" || s.phase === "rest" ? (
            <View style={styles.transport}>
              <IconButton icon={SkipBack} variant="ghost" size={56} accessibilityLabel={isRest ? "Back to the last exercise" : "Previous exercise"} disabled={s.phase === "exercise" && s.index === 0 && s.remaining > s.total - 3} onPress={() => dispatch({ type: "prev" })} testID="player-prev" />
              <IconButton icon={s.paused ? Play : Pause} variant="primary" size={80} accessibilityLabel={s.paused ? "Resume" : "Pause"} onPress={() => dispatch({ type: s.paused ? "resume" : "pause" })} testID="player-pause" />
              <IconButton icon={SkipForward} variant="ghost" size={56} accessibilityLabel={isRest ? "Skip rest" : "Skip exercise"} onPress={() => dispatch({ type: "skip" })} testID="player-skip" />
            </View>
          ) : (
            <View style={styles.controlsSpacer} />
          )}
        </View>
      </View>

      {s.paused && !confirmEnd ? (
        <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: withAlpha(colors.background, 0.94) }]} accessibilityViewIsModal>
          <View style={[styles.pauseIcon, { backgroundColor: colors.muted }]}>
            <Pause size={36} color={colors.foreground} />
          </View>
          <Text variant="title">Paused</Text>
          <Text variant="body" tone="muted" align="center">
            {isRest ? "Rest" : step.exercise.name} · {formatClock(secLeft)} left
          </Text>
          <View style={styles.overlayActions}>
            <Button title="Resume" icon={Play} onPress={() => dispatch({ type: "resume" })} testID="player-resume" />
            <Button title="End workout" variant="outline" onPress={askEnd} />
          </View>
        </View>
      ) : null}

      <ConfirmDialog
        open={confirmEnd}
        title="End workout early?"
        message={
          canEarn
            ? `You've done ${s.completed.length} of ${w.steps.length} exercises — enough to earn points. Your progress will be saved.`
            : `You've done ${s.completed.length} of ${w.steps.length} exercises. Finish at least ${Math.ceil(w.steps.length * w.minCompletionForPoints)} to earn points.`
        }
        confirmLabel="End workout"
        cancelLabel="Keep going"
        destructive
        onCancel={() => setConfirmEnd(false)}
        onConfirm={() => {
          setConfirmEnd(false)
          dispatch({ type: "end" })
        }}
      />
    </View>
  )
}

export default function WorkoutPlayerScreen() {
  const { colors } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const q = useApiQuery(["employee", "workouts", "detail", id], () => workoutsApi.get({ id: id! }), { retry: false, enabled: !!id })
  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ gestureEnabled: false, animation: "slide_from_bottom" }} />
      {q.data ? (
        <Player w={q.data} />
      ) : q.error ? (
        <View style={styles.centerFill}>
          <EmptyState icon={Dumbbell} title="This workout is no longer available." action={{ label: "Browse workouts", onPress: () => router.replace("/workouts") }} />
        </View>
      ) : (
        <View style={styles.centerFill}>
          <Skeleton width={224} height={224} radius={112} />
          <Skeleton width="70%" height={28} />
          <Skeleton width="85%" height={90} radius={RADIUS.xl} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  inner: { flex: 1, width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  top: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, height: 56 },
  topTitle: { flex: 1, minWidth: 0 },
  elapsed: { width: 56, alignItems: "center" },
  segments: { flexDirection: "row", gap: 4, paddingHorizontal: 16 },
  segment: { flex: 1, height: 5, borderRadius: 3 },
  skipped: { opacity: 0.4 },
  body: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, gap: 18, alignItems: "stretch" },
  center: { alignItems: "center", gap: 6 },
  readyCover: { width: 160, height: 160, borderRadius: 80, alignItems: "center", justifyContent: "center", alignSelf: "center", marginTop: 12 },
  readyEmoji: { fontSize: 76, lineHeight: 90 },
  upNext: { borderRadius: RADIUS.xl, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  upNextHead: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 32 },
  stepLine: { flexDirection: "row", gap: 8 },
  countdownWrap: { flex: 1, justifyContent: "center", gap: 10 },
  countdown: { fontFamily: "PlusJakartaSans_800ExtraBold", fontSize: 128, lineHeight: 140, fontVariant: ["tabular-nums"] },
  ring: { alignItems: "center" },
  media: { fontSize: 60, lineHeight: 70 },
  clock: { fontFamily: "PlusJakartaSans_800ExtraBold", fontSize: 36, lineHeight: 42, fontVariant: ["tabular-nums"], marginTop: 4 },
  bigNumber: { fontFamily: "PlusJakartaSans_800ExtraBold", fontSize: 64, lineHeight: 72, fontVariant: ["tabular-nums"] },
  restActions: { flexDirection: "row", justifyContent: "center", gap: 10 },
  nextCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: RADIUS.xl, borderWidth: StyleSheet.hairlineWidth },
  nextMedia: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  nextEmoji: { fontSize: 30, lineHeight: 36 },
  instructions: { borderRadius: RADIUS.xl, padding: 14, gap: 8 },
  instruction: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  instructionNum: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  controls: { paddingHorizontal: 20, paddingTop: 8 },
  controlsSpacer: { height: 52 },
  transport: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 28 },
  overlay: { alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  pauseIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  overlayActions: { alignSelf: "stretch", maxWidth: 360, width: "100%", alignItems: "stretch", gap: 10, marginTop: 14, marginHorizontal: "auto" },
})
