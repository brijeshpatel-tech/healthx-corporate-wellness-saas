import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { useTheme } from "@/theme/theme"
import { RADIUS, type TintName } from "@/theme/tokens"
import { Text } from "./text"

const STATUS_TINT: Record<string, TintName> = {
  active: "habits",
  approved: "habits",
  completed: "habits",
  connected: "habits",
  delivered: "habits",
  synced: "steps",
  manual: "neutral",
  pending: "points",
  pending_approval: "points",
  syncing: "steps",
  stale: "points",
  scheduled: "steps",
  processing: "steps",
  failed: "danger",
  error: "danger",
  rejected: "danger",
  cancelled: "neutral",
  disconnected: "neutral",
  draft: "neutral",
}

export interface StatusPillProps {
  /** Any status string, e.g. "pending_approval" → "Pending approval". */
  status: string
  /** Override the label. */
  label?: string
  tint?: TintName
  style?: StyleProp<ViewStyle>
}

/** Small coloured pill for a status (Synced, Manual, Pending approval, Connected…). */
export function StatusPill({ status, label, tint, style }: StatusPillProps) {
  const { tint: getTint } = useTheme()
  const key = status.toLowerCase().replace(/[\s-]+/g, "_")
  const t = getTint(tint ?? STATUS_TINT[key] ?? "neutral")
  const text = label ?? key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }, style]}>
      <View style={[styles.dot, { backgroundColor: t.fg }]} />
      <Text variant="small" color={t.fg} numberOfLines={1}>
        {text}
      </Text>
    </View>
  )
}

/** Release-phase tag — hidden on request (no "Phase 2/3" labels in the app). Kept as a no-op for existing usages. */
export function PhaseBadge(_props: { phase?: 2 | 3; style?: StyleProp<ViewStyle> }) {
  void _props
  return null
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, alignSelf: "flex-start" },
  dot: { width: 6, height: 6, borderRadius: 3 },
})
