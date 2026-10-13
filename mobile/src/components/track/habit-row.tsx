/** One habit on "My habits" (SCR-M-038): icon, progress, streak, points and the check / +1 button. */
import { router } from "expo-router"
import { Check, Flame, Minus } from "lucide-react-native"
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native"
import { ProgressBar, ProgressRing, Text } from "@/components/ui"
import { habitsApi, type TodayHabit } from "@/lib/api/employee/habits"
import { useApiMutation } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import { useTheme } from "@/theme/theme"
import { RADIUS, shadow } from "@/theme/tokens"
import { AUTO_LABEL, canIncrement, habitProgressText, incrementStep, POINTS_VIA_LABEL } from "./habit-ui"
import { PopIn } from "./track-ui"
import { localDate } from "./utils"

export function HabitRow({ h, onAllDone, isLastToComplete }: { h: TodayHabit; onAllDone: () => void; isLastToComplete: boolean }) {
  const { colors, tint, scheme } = useTheme()
  const done = tint("habits")
  const check = useApiMutation(habitsApi.checkIn, {
    errorTitle: "Couldn't save. Please try again.",
    onSuccess: (r) => {
      if (r.habit.done && !h.done) {
        haptic.success()
        if (isLastToComplete) onAllDone()
        toast.success(r.pointsEarned ? `${r.habit.name} done! +${r.pointsEarned} points` : `${r.habit.name} done!`)
      } else haptic.tap()
    },
  })
  const undo = useApiMutation(habitsApi.undo, { success: "Check-in undone" })
  const busy = check.isPending || undo.isPending
  const numeric = h.unit !== "check"
  const incrementable = canIncrement(h)
  const step = incrementStep(h)
  const valueText = habitProgressText(h)

  return (
    <View style={[styles.row, { backgroundColor: h.done ? done.bg : colors.card, borderColor: h.done ? "transparent" : colors.border }, !h.done && shadow(scheme)]} testID={`habit-${h.id}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${h.name}, ${valueText}${h.currentStreak ? `, ${h.currentStreak} day streak` : ""}. Open details`}
        onPress={() => {
          haptic.tap()
          router.push(`/habits/${h.id}`)
        }}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        testID={`habit-open-${h.id}`}
      >
        <View style={[styles.icon, { backgroundColor: h.done ? colors.card : colors.muted }]}>
          <Text style={styles.emoji}>{h.icon}</Text>
        </View>
        <View style={styles.body}>
          <Text variant="subtitle" numberOfLines={1}>
            {h.name}
          </Text>
          <View style={styles.meta}>
            <Text variant="caption" tone={h.done ? "success" : "muted"} weight={h.done ? "semibold" : undefined} numberOfLines={1} style={styles.shrink}>
              {valueText}
            </Text>
            {h.currentStreak > 0 ? (
              <View style={styles.inline} accessibilityLabel={`${h.currentStreak} day streak`}>
                <Flame size={13} color={tint("streak").fg} />
                <Text variant="small" color={tint("streak").fg}>
                  {h.currentStreak}
                </Text>
              </View>
            ) : null}
          </View>
          {h.auto || h.points || h.pointsVia ? (
            <View style={styles.meta}>
              {h.auto ? (
                <View style={[styles.auto, { backgroundColor: tint("workout").bg }]} accessibilityLabel={AUTO_LABEL[h.auto]}>
                  <Text variant="small" color={tint("workout").fg}>
                    Auto
                  </Text>
                </View>
              ) : null}
              {h.points ? (
                <Text variant="small" color={tint("points").fg}>
                  +{h.points} pts a day
                </Text>
              ) : h.pointsVia ? (
                <Text variant="small" tone="muted" numberOfLines={1} style={styles.shrink}>
                  {POINTS_VIA_LABEL[h.pointsVia]}
                </Text>
              ) : null}
            </View>
          ) : null}
          {numeric ? <ProgressBar value={h.value} max={h.target} height={5} color={h.done ? colors.success : colors.primary} style={styles.bar} /> : null}
        </View>
      </Pressable>

      <View style={styles.actions}>
        {numeric && incrementable && h.value > 0 && !h.done ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${formatNumber(step, 1)} from ${h.name}`}
            disabled={busy}
            hitSlop={6}
            onPress={() => check.mutate({ id: h.id, increment: -step })}
            style={({ pressed }) => [styles.minus, { borderColor: colors.border }, pressed && styles.pressed]}
          >
            <Minus size={16} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
        {h.done ? (
          <PopIn key="done">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={h.auto ? `${h.name} completed from your tracked data` : `Undo ${h.name}`}
              accessibilityHint={h.auto ? undefined : "Removes today's check-in"}
              disabled={busy || !!h.auto}
              onPress={() => undo.mutate({ id: h.id, date: localDate() })}
              style={({ pressed }) => [styles.btn, { backgroundColor: colors.success }, pressed && styles.pressed]}
              testID={`habit-undo-${h.id}`}
            >
              {undo.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Check size={24} color="#ffffff" strokeWidth={3} />}
            </Pressable>
          </PopIn>
        ) : numeric && !incrementable ? (
          <View accessibilityLabel={`${h.name} updates from your tracked data`}>
            <ProgressRing value={h.value} max={h.target} size={48} stroke={4} color={colors.primary}>
              <Text variant="small">{Math.min(99, Math.floor((h.value / h.target) * 100))}%</Text>
            </ProgressRing>
          </View>
        ) : numeric ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add ${formatNumber(step, 1)} to ${h.name}`}
            disabled={busy}
            onPress={() => check.mutate({ id: h.id, increment: step })}
            style={({ pressed }) => [styles.btn, styles.outlineBtn, { borderColor: colors.primary, backgroundColor: colors.card }, pressed && styles.pressed]}
            testID={`habit-inc-${h.id}`}
          >
            {check.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text variant="label" tone="primary">
                +{formatNumber(step, 1)}
              </Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Mark ${h.name} as done`}
            disabled={busy}
            onPress={() => check.mutate({ id: h.id, value: 1 })}
            style={({ pressed }) => [styles.btn, styles.dashed, { borderColor: colors.mutedForeground }, pressed && styles.pressed]}
            testID={`habit-check-${h.id}`}
          >
            {check.isPending ? <ActivityIndicator size="small" color={colors.primary} /> : <Check size={20} color={colors.mutedForeground} strokeWidth={2.4} />}
          </Pressable>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: RADIUS.xl, borderWidth: StyleSheet.hairlineWidth, paddingRight: 12 },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, padding: 12, minWidth: 0 },
  icon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 24, lineHeight: 30 },
  body: { flex: 1, gap: 3, minWidth: 0 },
  shrink: { flexShrink: 1 },
  auto: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8 },
  inline: { flexDirection: "row", alignItems: "center", gap: 2 },
  bar: { marginTop: 4 },
  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
  minus: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  btn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  outlineBtn: { borderWidth: 1.5 },
  dashed: { borderWidth: 2, borderStyle: "dashed" },
  pressed: { opacity: 0.85, transform: [{ scale: 0.94 }] },
})
