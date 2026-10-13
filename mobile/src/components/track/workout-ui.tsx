/** Workout labels, cover art and the library card (SCR-M-029). */
import { LinearGradient } from "expo-linear-gradient"
import { router } from "expo-router"
import { Building2, CheckCircle2, Clock, Coins, Dumbbell } from "lucide-react-native"
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { Text } from "@/components/ui"
import type { WorkoutCard as WorkoutCardData } from "@/lib/api/employee/workouts"
import { haptic } from "@/lib/haptics"
import type { FitnessLevel, Workout } from "@/lib/types"
import { useTheme } from "@/theme/theme"
import { RADIUS, shadow } from "@/theme/tokens"
import { withAlpha } from "./utils"

export const LEVEL_LABEL: Record<FitnessLevel, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" }
export const LOCATION_LABEL: Record<Workout["location"], string> = { home: "Home", gym: "Gym", outdoor: "Outdoor", office: "Office" }
export const EQUIPMENT_LABEL = (e: string) => (e === "none" ? "No equipment" : e.charAt(0).toUpperCase() + e.slice(1))
export const titleWord = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Emoji on the workout's cover colour (gradient). */
export function CoverArt({ emoji, color, size = 88, radius = RADIUS.lg, style }: { emoji: string; color: string; size?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient colors={[color, withAlpha(color, 0.7)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ width: size, height: size, borderRadius: radius, alignItems: "center", justifyContent: "center" }, style]}>
      <Text style={{ fontSize: size * 0.46, lineHeight: size * 0.58 }}>{emoji}</Text>
    </LinearGradient>
  )
}

/** Library row card: cover, name, category, duration / level / location / equipment and points. */
export function WorkoutCard({ w }: { w: WorkoutCardData }) {
  const { colors, scheme, tint } = useTheme()
  const points = tint("points")
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${w.name}, ${w.category}, ${w.durationMin} minutes, ${LEVEL_LABEL[w.level]}, ${w.points} points`}
      onPress={() => {
        haptic.tap()
        router.push(`/workouts/${w.id}`)
      }}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadow(scheme), pressed && styles.pressed]}
      testID={`workout-${w.id}`}
    >
      <View>
        <CoverArt emoji={w.coverEmoji} color={w.coverColor} size={92} />
        {w.doneCount ? (
          <View style={styles.done}>
            <CheckCircle2 size={11} color="#ffffff" />
            <Text variant="small" color="#ffffff">
              {w.doneCount}×
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        {w.companyMade ? (
          <View style={[styles.company, { backgroundColor: colors.primarySoft }]}>
            <Building2 size={11} color={colors.primary} />
            <Text variant="small" tone="primary">
              Your company
            </Text>
          </View>
        ) : null}
        <Text variant="subtitle" numberOfLines={1}>
          {w.name}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {w.category} · {LEVEL_LABEL[w.level]} · {LOCATION_LABEL[w.location]}
        </Text>
        <View style={styles.meta}>
          <View style={styles.inline}>
            <Clock size={13} color={colors.mutedForeground} />
            <Text variant="small" tone="muted">
              {w.durationMin} min
            </Text>
          </View>
          <View style={styles.inline}>
            <Dumbbell size={13} color={colors.mutedForeground} />
            <Text variant="small" tone="muted" numberOfLines={1}>
              {w.equipment.length ? `${w.equipment.length} item${w.equipment.length === 1 ? "" : "s"}` : "None"}
            </Text>
          </View>
          <View style={[styles.points, { backgroundColor: points.bg }]}>
            <Coins size={12} color={points.fg} />
            <Text variant="small" color={points.fg}>
              +{w.points}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 14, padding: 10, borderRadius: RADIUS.xl, borderWidth: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  body: { flex: 1, gap: 3, minWidth: 0 },
  company: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  meta: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  inline: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  points: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.pill, marginLeft: "auto" },
  done: { position: "absolute", left: 6, bottom: 6, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(0,0,0,0.35)", paddingHorizontal: 6, paddingVertical: 1, borderRadius: RADIUS.pill },
})
