/** Month heat-map for one habit (SCR-M-040): completed / partly / missed days, weeks start on Monday. */
import { StyleSheet, View } from "react-native"
import { Text } from "@/components/ui"
import type { HabitDetail } from "@/lib/api/employee/habits"
import { formatDate } from "@/lib/format"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"
import { localDate, withAlpha } from "./utils"

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"]

export function HabitCalendar({ month, days, target }: { month: string; days: HabitDetail["days"]; target: number }) {
  const { colors, tint } = useTheme()
  const today = localDate()
  const lead = (new Date(`${month}-01T12:00:00`).getDay() + 6) % 7
  const cells: (HabitDetail["days"][number] | null)[] = [...Array.from({ length: lead }, () => null), ...days]
  while (cells.length % 7) cells.push(null)
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))
  const missed = tint("danger")

  return (
    <View style={styles.wrap} accessibilityLabel="Completion calendar">
      <View style={styles.week}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} variant="small" tone="muted" align="center" style={styles.cell}>
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.week}>
          {week.map((d, i) => {
            if (!d) return <View key={`e${i}`} style={styles.cell} />
            const untracked = d.future || d.value === null
            const ratio = d.value !== null ? Math.min(1, d.value / target) : 0
            const bg = untracked ? "transparent" : d.done ? colors.success : ratio > 0 ? withAlpha(colors.success, 0.18 + ratio * 0.35) : missed.bg
            const fg = untracked ? colors.mutedForeground : d.done ? "#ffffff" : ratio > 0 ? colors.foreground : missed.fg
            const status = untracked ? "not tracked" : d.done ? "completed" : ratio > 0 ? "partly done" : "missed"
            return (
              <View
                key={d.date}
                style={[styles.cell, styles.day, { backgroundColor: bg }, d.date === today && { borderWidth: 2, borderColor: colors.foreground }, untracked && styles.faded]}
                accessibilityLabel={`${formatDate(`${d.date}T12:00:00`, "EEE d MMM")}: ${status}`}
              >
                <Text variant="small" color={fg}>
                  {Number(d.date.slice(8))}
                </Text>
              </View>
            )
          })}
        </View>
      ))}
      <View style={styles.legend}>
        <Legend color={colors.success} label="Completed" />
        <Legend color={withAlpha(colors.success, 0.35)} label="Partly" />
        <Legend color={missed.bg} label="Missed" />
      </View>
    </View>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text variant="small" tone="muted">
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  week: { flexDirection: "row", gap: 6 },
  cell: { flex: 1, minWidth: 0 },
  day: { aspectRatio: 1, borderRadius: RADIUS.sm + 2, alignItems: "center", justifyContent: "center" },
  faded: { opacity: 0.55 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
})
