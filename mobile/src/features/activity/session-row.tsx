/** One activity entry: type, time, duration, distance, Synced / Manual + approval status (#365). */
import { Pressable, StyleSheet, View } from "react-native"
import { StatusPill, Text } from "@/components/ui"
import type { ReviewStatus } from "@/lib/api/employee/activity"
import { formatDuration, formatNumber, formatTime } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import type { ActivitySession } from "@/lib/types"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"
import { ACTIVITY_META, SOURCE_LABEL } from "./activity-meta"

export function ReviewPill({ review }: { review?: ReviewStatus | null }) {
  if (!review) return null
  if (review.status === "pending") return <StatusPill status="pending_approval" label="Pending approval" />
  if (review.status === "approved") return <StatusPill status="approved" label={review.points ? `Approved · +${review.points} pts` : "Approved"} />
  return <StatusPill status="rejected" label="Not approved" />
}

export function SessionRow({ session, review, onPress }: { session: ActivitySession; review?: ReviewStatus | null; onPress?: () => void }) {
  const { colors } = useTheme()
  const meta = ACTIVITY_META[session.type]
  const details = [formatDuration(session.durationMin), session.distanceKm ? `${formatNumber(session.distanceKm, 1)} km` : null, session.calories ? `${formatNumber(session.calories)} kcal` : null].filter(Boolean).join(" · ")
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={() => {
        haptic.tap()
        onPress?.()
      }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.muted }]}
    >
      <View style={[styles.emoji, { backgroundColor: colors.muted }]}>
        <Text variant="heading">{meta.emoji}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text variant="bodyMedium" numberOfLines={1} style={styles.flex}>
            {meta.label}
          </Text>
          <Text variant="small" tone="muted">
            {formatTime(session.startedAt)}
          </Text>
        </View>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {details}
        </Text>
        <View style={styles.pills}>
          <StatusPill status={session.source === "manual" ? "manual" : "synced"} label={SOURCE_LABEL[session.source]} />
          {session.source === "manual" ? <ReviewPill review={review} /> : null}
          {session.points > 0 && session.source !== "manual" ? <StatusPill status="approved" tint="points" label={`+${session.points} pts`} /> : null}
        </View>
        {review?.status === "rejected" && review.reason ? (
          <Text variant="small" tone="destructive">
            {review.reason}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, padding: 12, borderRadius: RADIUS.lg },
  emoji: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
})
