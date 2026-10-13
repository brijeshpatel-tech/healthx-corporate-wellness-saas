/**
 * Daily step goal — personalised from recent activity with a once-a-day bonus (#362, Phase 2), or a fixed goal.
 * Steps earn points per 1,000 within the daily cap; the bonus shares that cap, so the same steps never earn twice (decision #19).
 */
import { LinearGradient } from "expo-linear-gradient"
import { CheckCircle2, Circle, Coins, Info, Sparkles, Target } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { FinePrint, NumberStepper, OptionCard } from "@/components/track/track-ui"
import { Button, ErrorState, goBack, PhaseBadge, Screen, Skeleton, Text } from "@/components/ui"
import { activityApi, type GoalMode, type StepGoalInfo } from "@/lib/api/employee/activity"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

function Radio({ on }: { on: boolean }) {
  const { colors } = useTheme()
  return on ? <CheckCircle2 size={22} color={colors.primary} /> : <Circle size={22} color={colors.input} />
}

function GoalForm({ info }: { info: StepGoalInfo }) {
  const { colors, tint, chart } = useTheme()
  const [mode, setMode] = useState<GoalMode>(info.personalGoal ? info.mode : "fixed")
  const [fixed, setFixed] = useState(info.fixedGoal)
  const save = useApiMutation(activityApi.setGoal, {
    success: (r) => `Daily goal set to ${formatNumber(r.today)} steps`,
    errorTitle: "Couldn't save your goal",
    onSuccess: () => goBack("/activity"),
  })
  const dirty = mode !== info.mode || fixed !== info.fixedGoal
  const points = tint("points")

  return (
    <Screen
      title="Daily step goal"
      back
      backHref="/activity"
      footer={
        <View style={styles.footer}>
          <Button title="Cancel" variant="outline" size="md" block style={styles.flex} onPress={() => goBack("/activity")} />
          <Button title="Save" size="md" block style={styles.flex} disabled={!dirty} loading={save.isPending} onPress={() => save.mutate({ mode, fixedGoal: fixed })} testID="save-goal" />
        </View>
      }
    >
      <Text variant="caption" tone="muted">
        Choose a goal that fits you. Today&apos;s goal: <Text variant="label">{formatNumber(info.today)} steps</Text>
      </Text>

      <OptionCard selected={mode === "personal"} disabled={!info.personalGoal} onPress={() => setMode("personal")} accessibilityLabel="Personal goal" testID="goal-personal">
        <View style={styles.optionRow}>
          <LinearGradient colors={["#8b5cf6", "#d946ef"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.optionIcon}>
            <Sparkles size={20} color="#ffffff" />
          </LinearGradient>
          <View style={styles.flex}>
            <View style={styles.titleRow}>
              <Text variant="subtitle">Personal goal</Text>
              <PhaseBadge phase={2} />
            </View>
            {info.personalGoal ? (
              <>
                <Text variant="number">{formatNumber(info.personalGoal)} steps</Text>
                <Text variant="caption" tone="muted">
                  Based on your average over the last {info.basedOnDays} days, plus 5% — it adjusts as you get more active.
                </Text>
                <View style={[styles.bonus, { backgroundColor: points.bg }]}>
                  <Coins size={14} color={points.fg} />
                  <Text variant="small" color={points.fg}>
                    +{info.bonusPoints} bonus points on days you reach it
                  </Text>
                </View>
              </>
            ) : (
              <Text variant="caption" tone="muted">
                We need at least 3 days of synced steps to suggest a personal goal.
              </Text>
            )}
          </View>
          <Radio on={mode === "personal"} />
        </View>
      </OptionCard>

      <OptionCard selected={mode === "fixed"} onPress={() => setMode("fixed")} accessibilityLabel="Fixed goal" testID="goal-fixed">
        <View style={styles.optionRow}>
          <View style={[styles.optionIcon, { backgroundColor: chart[0] }]}>
            <Target size={20} color="#ffffff" />
          </View>
          <View style={styles.flex}>
            <Text variant="subtitle">Fixed goal</Text>
            <Text variant="caption" tone="muted">
              The same target every day.
            </Text>
          </View>
          <Radio on={mode === "fixed"} />
        </View>
        <View style={[styles.stepperBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <NumberStepper
            label="Fixed daily step goal"
            value={fixed}
            min={2000}
            max={30000}
            step={500}
            onChange={(v) => {
              setFixed(v)
              setMode("fixed")
            }}
            format={(v) => formatNumber(v)}
            hint={mode === "fixed" ? "steps a day" : "used when there's no personal goal"}
            size="lg"
            testID="fixed-goal"
          />
        </View>
      </OptionCard>

      <FinePrint icon={Info}>Steps always earn points per 1,000 steps (within the daily cap). The personal-goal bonus is added once a day and counts towards the same daily cap, so the same steps never earn twice.</FinePrint>
    </Screen>
  )
}

export default function StepGoalScreen() {
  const q = useApiQuery(["employee", "activity", "goal"], () => activityApi.goal())
  if (q.data) return <GoalForm key={`${q.data.mode}-${q.data.fixedGoal}`} info={q.data} />
  return (
    <Screen title="Daily step goal" back backHref="/activity">
      {q.error ? (
        <ErrorState title="Couldn't load your goal" error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : (
        <>
          <Skeleton height={170} radius={RADIUS.xl} />
          <Skeleton height={170} radius={RADIUS.xl} />
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 3 },
  footer: { flexDirection: "row", gap: 10 },
  optionRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  optionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  bonus: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill, marginTop: 6 },
  stepperBox: { marginTop: 14, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 10 },
})
