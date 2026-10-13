/** Sleep dashboard pieces (SCR-M-027): night-sky hero, bedtime → wake schedule chart, night rows and the goal sheet. */
import { LinearGradient } from "expo-linear-gradient"
import { router } from "expo-router"
import { BedDouble, Lock, Moon, Pencil, Plus, Sunrise, Target, Watch } from "lucide-react-native"
import { useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { BottomSheet, Button, ProgressRing, Text } from "@/components/ui"
import { sleepApi, type SleepSummary } from "@/lib/api/employee/sleep"
import { useApiMutation } from "@/lib/api/hooks"
import { formatDate, formatTime } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import type { SleepRecord } from "@/lib/types"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"
import { NumberStepper } from "./track-ui"
import { formatHM } from "./utils"

export const NIGHT_GRADIENT = ["#4338ca", "#6d28d9", "#1e1b4b"] as const
const STARS = [
  { top: 18, right: 34, size: 3 },
  { top: 44, right: 92, size: 2 },
  { top: 26, left: 40, size: 2 },
  { top: 70, left: 22, size: 3 },
  { top: 96, right: 20, size: 2 },
  { top: 12, left: 130, size: 2 },
]

const weekday = (date: string) => formatDate(`${date}T12:00:00`, "EEE")

function HeroStat({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  const body = (
    <>
      <Text variant="small" color="rgba(255,255,255,0.75)" numberOfLines={1}>
        {label}
      </Text>
      <Text variant="subtitle" color="#ffffff" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {onPress ? (
        <View style={styles.editRow}>
          <Target size={11} color="rgba(255,255,255,0.8)" />
          <Text variant="small" color="rgba(255,255,255,0.8)">
            Edit
          </Text>
        </View>
      ) : null}
    </>
  )
  if (!onPress) return <View style={styles.heroStat}>{body}</View>
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sleep goal ${value}. Edit`}
      onPress={() => {
        haptic.tap()
        onPress()
      }}
      style={({ pressed }) => [styles.heroStat, pressed && { backgroundColor: "rgba(255,255,255,0.22)" }]}
      testID="edit-sleep-goal"
    >
      {body}
    </Pressable>
  )
}

export function SleepHero({ data, onEditGoal }: { data: SleepSummary; onEditGoal: () => void }) {
  const last = data.lastNight
  return (
    <LinearGradient colors={[...NIGHT_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      {STARS.map((s, i) => (
        <View key={i} style={[styles.star, { top: s.top, left: s.left, right: s.right, width: s.size, height: s.size, borderRadius: s.size }]} />
      ))}
      <Text variant="label" color="rgba(255,255,255,0.85)">
        {last ? `Last night · ${formatDate(`${last.date}T12:00:00`, "EEE d MMM")}` : "Last night"}
      </Text>
      <ProgressRing value={last?.score ?? 0} size={164} stroke={13} color="#ffffff" trackColor="rgba(255,255,255,0.2)" accessibilityLabel={last ? `Sleep score ${last.score} of 100` : "No sleep score yet"}>
        <Moon size={20} color="rgba(255,255,255,0.85)" />
        <Text variant="display" color="#ffffff">
          {last ? last.score : "—"}
        </Text>
        <Text variant="small" color="rgba(255,255,255,0.75)">
          Sleep score
        </Text>
      </ProgressRing>
      <View style={styles.heroStats}>
        <HeroStat label="Duration" value={last ? formatHM(last.durationMin) : "—"} />
        <HeroStat label="Consistency" value={data.consistency.label === "Not enough data" ? "—" : data.consistency.label} />
        <HeroStat label="Goal" value={`${data.goalHours} h`} onPress={onEditGoal} />
      </View>
      {last ? (
        <View style={styles.heroMeta}>
          <View style={styles.inline}>
            <BedDouble size={13} color="rgba(255,255,255,0.8)" />
            <Text variant="small" color="rgba(255,255,255,0.85)">
              {formatTime(last.bedtime)}
            </Text>
          </View>
          <View style={styles.inline}>
            <Sunrise size={13} color="rgba(255,255,255,0.8)" />
            <Text variant="small" color="rgba(255,255,255,0.85)">
              {formatTime(last.wakeTime)}
            </Text>
          </View>
          {data.source ? (
            <View style={styles.inline}>
              <Watch size={13} color="rgba(255,255,255,0.8)" />
              <Text variant="small" color="rgba(255,255,255,0.85)">
                {data.source}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </LinearGradient>
  )
}

/** Bedtime → wake bars on an 8 PM → 12 PM timeline, one row per night. */
export function ScheduleChart({ data }: { data: SleepSummary }) {
  const { colors, tint } = useTheme()
  const START = 20 * 60
  const SPAN = 16 * 60
  const pos = (iso: string) => {
    const d = new Date(iso)
    let m = d.getHours() * 60 + d.getMinutes()
    if (m < START) m += 24 * 60
    return Math.min(100, Math.max(0, ((m - START) / SPAN) * 100))
  }
  return (
    <View style={styles.schedule} accessibilityRole="image" accessibilityLabel="Bedtime and wake-up times for each night">
      <View style={styles.scheduleAxis}>
        {["8p", "12a", "4a", "8a", "12p"].map((t) => (
          <Text key={t} variant="small" tone="muted">
            {t}
          </Text>
        ))}
      </View>
      {data.nights.map((n) => {
        const r = n.record
        const left = r ? pos(r.bedtime) : 0
        const width = r ? Math.max(4, pos(r.wakeTime) - left) : 0
        return (
          <View key={n.nightOf} style={styles.scheduleRow} accessibilityLabel={r ? `${weekday(n.nightOf)}: ${formatTime(r.bedtime)} to ${formatTime(r.wakeTime)}` : `${weekday(n.nightOf)}: nothing recorded`}>
            <Text variant="small" tone="muted" style={styles.scheduleDay}>
              {weekday(n.nightOf)}
            </Text>
            <View style={[styles.track, { backgroundColor: colors.muted }]}>
              {r ? (
                <View style={[styles.bar, { left: `${left}%`, width: `${width}%`, backgroundColor: tint("sleep").fg }]}>
                  {width > 22 ? (
                    <Text variant="small" color="#ffffff" numberOfLines={1}>
                      {formatHM(r.durationMin)}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        )
      })}
    </View>
  )
}

export function NightRow({ record, nightOf, goalMin }: { record: SleepRecord | null; nightOf: string; goalMin: number }) {
  const { colors, tint } = useTheme()
  const label = formatDate(`${nightOf}T12:00:00`, "EEE d MMM")
  if (!record) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, nothing recorded. Log sleep`}
        onPress={() => {
          haptic.tap()
          router.push({ pathname: "/sleep/log", params: { night: nightOf } })
        }}
        style={({ pressed }) => [styles.night, pressed && { backgroundColor: colors.muted }]}
      >
        <View style={[styles.nightIcon, styles.dashed, { borderColor: colors.input }]}>
          <Plus size={16} color={colors.mutedForeground} />
        </View>
        <Text variant="caption" tone="muted" style={styles.flex}>
          {label} · nothing recorded
        </Text>
        <Text variant="label" tone="primary">
          Log
        </Text>
      </Pressable>
    )
  }
  const manual = record.source === "manual"
  const met = record.durationMin >= goalMin
  const body = (
    <>
      <View style={[styles.nightIcon, { backgroundColor: tint("sleep").bg }]}>
        <Moon size={18} color={tint("sleep").fg} />
      </View>
      <View style={styles.flex}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {label}{" "}
          <Text variant="caption" tone="muted">
            · {formatHM(record.durationMin)}
          </Text>
        </Text>
        <Text variant="small" tone="muted" numberOfLines={1}>
          {formatTime(record.bedtime)} → {formatTime(record.wakeTime)} · {manual ? "Manual" : "Synced"}
        </Text>
      </View>
      <View style={[styles.score, { backgroundColor: met ? tint("habits").bg : colors.muted }]}>
        <Text variant="label" color={met ? tint("habits").fg : colors.mutedForeground}>
          {record.score}
        </Text>
      </View>
      {manual ? <Pencil size={15} color={colors.mutedForeground} /> : <Lock size={14} color={colors.mutedForeground} />}
    </>
  )
  if (!manual)
    return (
      <View style={styles.night} accessibilityLabel={`${label}, ${formatHM(record.durationMin)}, score ${record.score}. Synced sleep is read-only`}>
        {body}
      </View>
    )
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${formatHM(record.durationMin)}, score ${record.score}. Edit`}
      onPress={() => {
        haptic.tap()
        router.push({ pathname: "/sleep/log", params: { id: record.id } })
      }}
      style={({ pressed }) => [styles.night, pressed && { backgroundColor: colors.muted }]}
    >
      {body}
    </Pressable>
  )
}

export function SleepGoalSheet({ open, onClose, current }: { open: boolean; onClose: () => void; current: number }) {
  const [value, setValue] = useState(current)
  const save = useApiMutation(sleepApi.setGoal, { success: (r) => `Sleep goal set to ${r.goalHours} h`, onSuccess: onClose })
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Sleep goal"
      description="Most adults need 7–9 hours. Choose between 4 and 12 hours."
      footer={<Button title="Save goal" loading={save.isPending} disabled={value === current} onPress={() => save.mutate({ hours: value })} testID="save-sleep-goal" />}
    >
      <NumberStepper label="Sleep goal" value={value} min={4} max={12} step={0.5} onChange={setValue} format={(v) => `${v} h`} hint="hours a night" size="lg" />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  inline: { flexDirection: "row", alignItems: "center", gap: 4 },
  hero: { borderRadius: RADIUS.xl, padding: 20, alignItems: "center", gap: 14, overflow: "hidden" },
  star: { position: "absolute", backgroundColor: "rgba(255,255,255,0.7)" },
  heroStats: { flexDirection: "row", gap: 8, alignSelf: "stretch" },
  heroStat: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 8, paddingHorizontal: 6, borderRadius: RADIUS.md, backgroundColor: "rgba(255,255,255,0.12)", minWidth: 0 },
  editRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  heroMeta: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 14 },
  schedule: { gap: 8 },
  scheduleAxis: { flexDirection: "row", justifyContent: "space-between", marginLeft: 42 },
  scheduleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  scheduleDay: { width: 34 },
  track: { flex: 1, height: 24, borderRadius: 12, overflow: "hidden" },
  bar: { position: "absolute", top: 2, bottom: 2, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  night: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: RADIUS.lg, minHeight: 56 },
  nightIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  dashed: { borderWidth: 1, borderStyle: "dashed" },
  score: { minWidth: 36, paddingHorizontal: 8, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
})
