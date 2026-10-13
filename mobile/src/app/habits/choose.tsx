/** SCR-M-039 Choose Habits — pick habits from the HealthX list and set a daily target for each. */
import { router } from "expo-router"
import { ChevronRight, PenLine } from "lucide-react-native"
import { useState } from "react"
import { Pressable, StyleSheet, Switch, View } from "react-native"
import { formatTarget, HABIT_CATEGORY_LABEL, targetText } from "@/components/track/habit-ui"
import { NumberStepper } from "@/components/track/track-ui"
import { Button, Card, ErrorState, goBack, PhaseBadge, Screen, SectionHeader, Skeleton, Text } from "@/components/ui"
import { habitsApi, UNIT_RANGE, type LibraryHabit, type TodayHabit } from "@/lib/api/employee/habits"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

function HabitOption({ h, on, target, onToggle, onTarget }: { h: LibraryHabit; on: boolean; target: number; onToggle: (v: boolean) => void; onTarget: (v: number) => void }) {
  const { colors } = useTheme()
  const range = UNIT_RANGE[h.unit]
  return (
    <View style={[styles.option, on && { backgroundColor: colors.primarySoft }]}>
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={`${h.name}. ${h.description}`} onPress={() => onToggle(!on)} style={styles.optionHead} testID={`choose-${h.id}`}>
        <View style={[styles.emojiTile, { backgroundColor: on ? colors.card : colors.muted }]}>
          <Text style={styles.emoji}>{h.icon}</Text>
        </View>
        <View style={styles.flex}>
          <Text variant="bodyMedium">{h.name}</Text>
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {h.description}
            {h.autoCompleteFrom ? " · Auto-tracked" : ""}
          </Text>
        </View>
        <Switch
          value={on}
          onValueChange={(v) => {
            haptic.select()
            onToggle(v)
          }}
          trackColor={{ false: colors.input, true: colors.primary }}
          thumbColor="#ffffff"
          ios_backgroundColor={colors.input}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </Pressable>
      {on && h.unit !== "check" ? (
        <View style={[styles.target, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <NumberStepper label={`${h.name} daily target`} value={target} min={range.min} max={range.max} step={range.step} onChange={onTarget} format={(v) => formatTarget(h.unit, v)} hint="Daily target" />
        </View>
      ) : null}
    </View>
  )
}

function Chooser({ habits, custom }: { habits: LibraryHabit[]; custom: TodayHabit[] }) {
  const { colors, tint } = useTheme()
  const [sel, setSel] = useState<Record<string, number>>(() => Object.fromEntries(habits.filter((h) => h.selected).map((h) => [h.id, h.target])))
  const [error, setError] = useState<string | null>(null)
  const save = useApiMutation(habitsApi.saveSelection, { success: "Habits updated.", errorTitle: "Couldn't save your habits.", onSuccess: () => goBack("/habits") })
  const count = Object.keys(sel).length + custom.length
  const keyOf = (o: Record<string, number>) => JSON.stringify(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)))
  const dirty = keyOf(sel) !== keyOf(Object.fromEntries(habits.filter((h) => h.selected).map((h) => [h.id, h.target])))

  const groups = new Map<string, LibraryHabit[]>()
  for (const h of habits) groups.set(h.category, [...(groups.get(h.category) ?? []), h])

  const submit = () => {
    if (count < 1) {
      haptic.error()
      setError("Choose at least one habit.")
      return
    }
    setError(null)
    save.mutate({ selections: Object.entries(sel).map(([habitId, target]) => ({ habitId, target })) })
  }

  return (
    <Screen
      title="Choose habits"
      back
      backHref="/habits"
      footer={
        <View style={styles.footer}>
          <View style={styles.flex}>
            {error ? (
              <Text variant="label" tone="destructive" accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : (
              <Text variant="label" tone="muted">
                {formatNumber(count)} selected
              </Text>
            )}
          </View>
          <Button title="Save" size="md" loading={save.isPending} disabled={!dirty && count > 0} onPress={submit} style={styles.save} testID="save-habits" />
        </View>
      }
    >
      <Text variant="caption" tone="muted">
        Pick the habits you want to build and set a daily target for each.
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create your own habit"
        onPress={() => {
          haptic.tap()
          router.push("/habits/new")
        }}
        style={({ pressed }) => [styles.create, { borderColor: tint("workout").fg, backgroundColor: tint("workout").bg }, pressed && styles.pressed]}
        testID="create-habit"
      >
        <View style={[styles.createIcon, { backgroundColor: tint("workout").fg }]}>
          <PenLine size={20} color="#ffffff" />
        </View>
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <Text variant="subtitle">Create your own</Text>
            <PhaseBadge phase={2} />
          </View>
          <Text variant="caption" tone="muted">
            A personal habit that isn&apos;t in the list
          </Text>
        </View>
        <ChevronRight size={18} color={colors.mutedForeground} />
      </Pressable>

      {custom.length ? (
        <>
          <SectionHeader title="Your custom habits" />
          <Card padding={4}>
            {custom.map((h) => (
              <Pressable key={h.id} accessibilityRole="button" onPress={() => router.push(`/habits/${h.id}`)} style={({ pressed }) => [styles.customRow, pressed && { backgroundColor: colors.muted }]}>
                <View style={[styles.emojiTile, { backgroundColor: colors.muted }]}>
                  <Text style={styles.emoji}>{h.icon}</Text>
                </View>
                <View style={styles.flex}>
                  <Text variant="bodyMedium" numberOfLines={1}>
                    {h.name}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {targetText(h.unit, h.target)}
                  </Text>
                </View>
                <Text variant="label" tone="primary">
                  Edit
                </Text>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}

      {[...groups.entries()].map(([cat, list]) => (
        <View key={cat} style={styles.group}>
          <SectionHeader title={HABIT_CATEGORY_LABEL[cat] ?? cat} />
          <Card padding={0} style={styles.clip}>
            {list.map((h, i) => (
              <View key={h.id}>
                {i > 0 ? <View style={[styles.sep, { backgroundColor: colors.border }]} /> : null}
                <HabitOption
                  h={h}
                  on={h.id in sel}
                  target={sel[h.id] ?? h.target}
                  onToggle={(v) => {
                    setError(null)
                    setSel((s) => {
                      const next = { ...s }
                      if (v) next[h.id] = h.target
                      else delete next[h.id]
                      return next
                    })
                  }}
                  onTarget={(v) => setSel((s) => ({ ...s, [h.id]: v }))}
                />
              </View>
            ))}
          </Card>
        </View>
      ))}
    </Screen>
  )
}

export default function ChooseHabitsScreen() {
  const q = useApiQuery(["employee", "habits", "library"], () => habitsApi.library())
  if (q.data) return <Chooser habits={q.data.habits} custom={q.data.custom} />
  return (
    <Screen title="Choose habits" back backHref="/habits">
      {q.error ? (
        <ErrorState title="Couldn't load the habit list" error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : (
        Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={i === 0 ? 72 : 88} radius={RADIUS.xl} />)
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  footer: { flexDirection: "row", alignItems: "center", gap: 12 },
  save: { minWidth: 120 },
  create: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: RADIUS.xl, borderWidth: 1, borderStyle: "dashed" },
  createIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  pressed: { opacity: 0.85 },
  group: { gap: 10 },
  clip: { overflow: "hidden" },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 72 },
  option: { paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  optionHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  emojiTile: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 22, lineHeight: 28 },
  target: { marginLeft: 56, padding: 6, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth },
  customRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: RADIUS.lg },
})
