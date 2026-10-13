/** SCR-M-040 Habit Detail — today's status, streaks, month heat-map, daily target, reminder, remove. */
import { keepPreviousData } from "@tanstack/react-query"
import { router, useLocalSearchParams } from "expo-router"
import { Bell, CalendarCheck, Flame, ListChecks, Trash2, Trophy } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { HabitCalendar } from "@/components/track/habit-calendar"
import { AUTO_LABEL, formatTarget, habitProgressText, POINTS_VIA_LABEL, targetText } from "@/components/track/habit-ui"
import { TimeStepper } from "@/components/track/time-stepper"
import { NumberStepper, PeriodNavigator } from "@/components/track/track-ui"
import { localDate, monthLabel, shiftMonth } from "@/components/track/utils"
import { Button, Card, ConfirmDialog, EmptyState, goBack, Screen, Skeleton, StatTile, SwitchRow, Text } from "@/components/ui"
import { habitsApi, UNIT_RANGE, type HabitDetail } from "@/lib/api/employee/habits"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

function Detail({ h, month, setMonth, current, loadingMonth }: { h: HabitDetail; month: string; setMonth: (m: string) => void; current: string; loadingMonth: boolean }) {
  const { colors, tint } = useTheme()
  const range = UNIT_RANGE[h.unit]
  const [target, setTarget] = useState(h.target)
  const [reminderOn, setReminderOn] = useState(!!h.reminderTime)
  const [reminderTime, setReminderTime] = useState(h.reminderTime ?? "08:00")
  const [confirm, setConfirm] = useState(false)
  const update = useApiMutation(habitsApi.update, { success: "Habit updated.", errorTitle: "Couldn't update this habit." })
  const remove = useApiMutation(habitsApi.remove, {
    success: "Habit removed",
    onSuccess: () => {
      setConfirm(false)
      goBack("/habits")
    },
  })
  const dirty = target !== h.target || reminderOn !== !!h.reminderTime || (reminderOn && reminderTime !== h.reminderTime)
  const firstMonth = h.firstTrackedDate.slice(0, 7)
  const pointsLine = h.points ? `+${h.points} pts per day` : h.pointsVia ? `${POINTS_VIA_LABEL[h.pointsVia]} (no double points)` : "No points for custom habits"

  return (
    <Screen
      title={h.name}
      subtitle={h.custom ? "Your personal habit" : undefined}
      back
      backHref="/habits"
      footer={
        <View style={styles.footer}>
          <Button title="Remove" icon={Trash2} variant="outline" size="md" onPress={() => setConfirm(true)} style={styles.flex} block testID="remove-habit" />
          <Button title="Save" size="md" loading={update.isPending} disabled={!dirty} onPress={() => update.mutate({ id: h.id, target, reminderTime: reminderOn ? reminderTime : null })} style={styles.flex} block testID="save-habit" />
        </View>
      }
    >
      <Card padding={16} style={h.done ? { backgroundColor: tint("habits").bg, borderColor: "transparent" } : undefined}>
        <View style={styles.header}>
          <View style={[styles.emojiTile, { backgroundColor: h.done ? colors.card : colors.muted }]}>
            <Text style={styles.emoji}>{h.icon}</Text>
          </View>
          <View style={styles.flex}>
            <Text variant="caption" tone="muted">
              Today
            </Text>
            <Text variant="heading" tone={h.done ? "success" : "default"}>
              {h.done ? `Done ✓${h.unit !== "check" ? ` (${habitProgressText(h)})` : ""}` : habitProgressText(h)}
            </Text>
            <Text variant="caption" tone="muted">
              Target: {targetText(h.unit, h.target)}
              {h.auto ? ` · ${AUTO_LABEL[h.auto]}` : ""}
            </Text>
            <Text variant="small" color={h.points ? tint("points").fg : colors.mutedForeground}>
              {pointsLine}
            </Text>
          </View>
        </View>
        {!h.custom && h.description ? (
          <Text variant="caption" tone="muted" style={styles.desc}>
            {h.description}
          </Text>
        ) : null}
      </Card>

      <View style={styles.stats}>
        <StatTile icon={Flame} tint="streak" label="Current streak" value={`${h.currentStreak} ${h.currentStreak === 1 ? "day" : "days"}`} />
        <StatTile icon={Trophy} tint="points" label="Best streak" value={`${h.bestStreak} ${h.bestStreak === 1 ? "day" : "days"}`} />
        <StatTile icon={CalendarCheck} tint="habits" label="This month" value={`${h.completedThisMonth}/${h.trackedDaysThisMonth || "—"}`} />
      </View>

      <Card>
        <PeriodNavigator
          label={monthLabel(month)}
          onPrev={() => setMonth(shiftMonth(month, -1))}
          onNext={() => setMonth(shiftMonth(month, 1))}
          prevDisabled={month <= firstMonth || loadingMonth}
          nextDisabled={month >= current || loadingMonth}
          prevLabel="Previous month"
          nextLabel="Next month"
        />
        <View style={[styles.calendar, loadingMonth && styles.loading]}>
          {!h.hasHistory ? (
            <View style={[styles.noHistory, { backgroundColor: colors.muted }]}>
              <Text variant="caption" tone="muted" align="center">
                No history yet.
              </Text>
            </View>
          ) : (
            <HabitCalendar month={h.month} days={h.days} target={h.target} />
          )}
        </View>
      </Card>

      <Card>
        <View style={styles.settings}>
          {h.unit !== "check" ? (
            <View style={styles.block}>
              <Text variant="subtitle">Daily target</Text>
              <NumberStepper
                label="Daily target"
                value={target}
                min={range.min}
                max={range.max}
                step={range.step}
                onChange={setTarget}
                format={(v) => formatTarget(h.unit, v)}
                hint={`${formatNumber(range.min)} – ${formatNumber(range.max)} ${range.label}`}
                size="lg"
              />
            </View>
          ) : null}
          <SwitchRow icon={Bell} tint="points" title="Daily reminder" description={reminderOn ? "We'll nudge you at this time" : "Off"} value={reminderOn} onValueChange={setReminderOn} />
          {reminderOn ? <TimeStepper label="Remind me at" value={reminderTime} onChange={setReminderTime} testID="reminder-time" /> : null}
        </View>
      </Card>

      <ConfirmDialog
        open={confirm}
        title={`Remove "${h.name}"?`}
        message="It will disappear from your daily list. Your past streaks are kept, and you can add it again any time."
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => remove.mutate({ id: h.id })}
      />
    </Screen>
  )
}

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const current = localDate().slice(0, 7)
  const [month, setMonth] = useState(current)
  const q = useApiQuery(["employee", "habits", "detail", id, month], () => habitsApi.get({ id: id!, month }), { placeholderData: keepPreviousData, retry: false, enabled: !!id })

  if (q.data) return <Detail key={q.data.id} h={q.data} month={month} setMonth={setMonth} current={current} loadingMonth={q.isPlaceholderData} />
  return (
    <Screen title="Habit" back backHref="/habits">
      {q.error ? (
        <Card>
          <EmptyState icon={ListChecks} title="Couldn't find this habit" description="It may have been removed." action={{ label: "Back to my habits", onPress: () => router.replace("/habits") }} />
        </Card>
      ) : (
        <>
          <Skeleton height={110} radius={RADIUS.xl} />
          <Skeleton height={96} radius={RADIUS.xl} />
          <Skeleton height={340} radius={RADIUS.xl} />
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  footer: { flexDirection: "row", gap: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  emojiTile: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 34, lineHeight: 42 },
  desc: { marginTop: 10 },
  stats: { flexDirection: "row", gap: 8 },
  calendar: { marginTop: 8 },
  loading: { opacity: 0.5 },
  noHistory: { borderRadius: RADIUS.lg, paddingVertical: 24 },
  settings: { gap: 12 },
  block: { gap: 10, marginBottom: 4 },
})
