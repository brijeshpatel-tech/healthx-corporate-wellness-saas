/** SCR-M-030 Workout Filters — bottom sheet with multi-select chip groups and a live result count. */
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { BottomSheet, Button, Chip, Skeleton, Text } from "@/components/ui"
import { DURATION_LABEL, filterWorkouts, type WorkoutCard, type WorkoutFilterValues, type WorkoutQuery } from "@/lib/api/employee/workouts"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"
import { EQUIPMENT_LABEL, LEVEL_LABEL, LOCATION_LABEL, titleWord } from "./workout-ui"

export type WorkoutFilters = Required<Pick<WorkoutQuery, "level" | "location" | "equipment" | "duration" | "muscle">>
export const EMPTY_FILTERS: WorkoutFilters = { level: [], location: [], equipment: [], duration: [], muscle: [] }
export const countFilters = (f: WorkoutFilters) => Object.values(f).reduce((a, v) => a + v.length, 0)

export interface WorkoutFilterSheetProps {
  open: boolean
  onClose: () => void
  values?: WorkoutFilterValues
  valuesError: boolean
  all: WorkoutCard[]
  base: WorkoutQuery
  initial: WorkoutFilters
  onApply: (f: WorkoutFilters) => void
}

export function WorkoutFilterSheet({ open, onClose, values, valuesError, all, base, initial, onApply }: WorkoutFilterSheetProps) {
  const { colors } = useTheme()
  const [draft, setDraft] = useState<WorkoutFilters>(initial)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setDraft(initial)
  }
  const count = filterWorkouts(all, { ...base, ...draft }).length
  const toggle = (key: keyof WorkoutFilters, value: string) =>
    setDraft((d) => {
      const list = d[key] as string[]
      return { ...d, [key]: list.includes(value) ? list.filter((x) => x !== value) : [...list, value] }
    })

  const groups: { key: keyof WorkoutFilters; label: string; options: { value: string; label: string }[] }[] = values
    ? [
        { key: "level", label: "Level", options: values.levels.map((v) => ({ value: v, label: LEVEL_LABEL[v] })) },
        { key: "location", label: "Location", options: values.locations.map((v) => ({ value: v, label: LOCATION_LABEL[v] })) },
        { key: "duration", label: "Duration", options: values.durations.map((v) => ({ value: v, label: DURATION_LABEL[v] })) },
        { key: "equipment", label: "Equipment", options: values.equipment.map((v) => ({ value: v, label: EQUIPMENT_LABEL(v) })) },
        { key: "muscle", label: "Muscle groups", options: values.muscles.map((v) => ({ value: v, label: titleWord(v) })) },
      ]
    : []

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Filters"
      description="Choose as many as you like in each group."
      footer={
        <View style={styles.footer}>
          <Button title="Reset" variant="outline" size="md" block style={styles.reset} disabled={!countFilters(draft)} onPress={() => setDraft(EMPTY_FILTERS)} />
          <Button title={count === 0 ? "0 workouts" : `Apply (${count} result${count === 1 ? "" : "s"})`} size="md" block style={styles.apply} disabled={count === 0 || !values} onPress={() => onApply(draft)} testID="apply-filters" />
        </View>
      }
    >
      {valuesError ? (
        <View style={[styles.unavailable, { backgroundColor: colors.muted }]}>
          <Text variant="caption" tone="muted" align="center">
            Filters unavailable.
          </Text>
        </View>
      ) : !values ? (
        <Skeleton height={260} radius={RADIUS.lg} />
      ) : (
        groups.map((g) => (
          <View key={g.key} style={styles.group} accessibilityRole="none" accessibilityLabel={g.label}>
            <Text variant="subtitle">{g.label}</Text>
            <View style={styles.chips}>
              {g.options.map((o) => (
                <Chip key={o.value} size="sm" label={o.label} selected={(draft[g.key] as string[]).includes(o.value)} onPress={() => toggle(g.key, o.value)} />
              ))}
            </View>
          </View>
        ))
      )}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  footer: { flexDirection: "row", gap: 10 },
  reset: { flex: 1 },
  apply: { flex: 2 },
  unavailable: { borderRadius: RADIUS.lg, paddingVertical: 24 },
  group: { gap: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
})
