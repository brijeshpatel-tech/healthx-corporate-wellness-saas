/**
 * "Sync now" + last-sync status (#346) — used on Home and Activity.
 * States: not connected · syncing · failed · stale (no sync for 24 h+) · connected.
 */
import { router } from "expo-router"
import { AlertTriangle, CheckCircle2, CloudOff, RefreshCw, Watch } from "lucide-react-native"
import { useEffect, useState, type ReactNode } from "react"
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, View } from "react-native"
import { Text } from "@/components/ui"
import { activityApi, type SyncStatus } from "@/lib/api/employee/activity"
import { useApiMutation } from "@/lib/api/hooks"
import { formatRelative, formatTime } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

export function useSyncNow() {
  return useApiMutation(activityApi.sync, {
    errorTitle: "We couldn't sync your steps",
    onSuccess: (r) => {
      haptic.success()
      toast.success("Synced just now", { description: r.newSteps ? `+${r.newSteps.toLocaleString("en-IN")} steps from ${r.provider?.label ?? "your health app"}` : "You're up to date." })
      if (r.bonusPoints) toast.success(`Personal goal reached! +${r.bonusPoints} points 🎉`)
    },
  })
}

function Spinning({ children }: { children: ReactNode }) {
  const [spin] = useState(() => new Animated.Value(0))
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [spin])
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] })
  return <Animated.View style={{ transform: [{ rotate }] }}>{children}</Animated.View>
}

export interface SyncStatusBarProps {
  sync: SyncStatus
  /** Smaller, single-line version (Home). */
  compact?: boolean
}

export function SyncStatusBar({ sync, compact }: SyncStatusBarProps) {
  const { colors, tint } = useTheme()
  const syncNow = useSyncNow()
  const failed = syncNow.isError && !syncNow.isPending

  if (!sync.connected) {
    const t = tint("steps")
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/settings/connected-apps")}
        style={[styles.bar, { backgroundColor: t.bg, borderColor: "transparent" }]}
        testID="sync-connect"
      >
        <Watch size={18} color={t.fg} />
        <View style={styles.flex}>
          <Text variant="label">Connect Apple Health or Health Connect</Text>
          {!compact ? (
            <Text variant="caption" tone="muted">
              Track steps automatically — no manual logging.
            </Text>
          ) : null}
        </View>
        <Text variant="label" color={t.fg}>
          Connect
        </Text>
      </Pressable>
    )
  }

  const provider = sync.provider?.label ?? "your health app"
  const last = sync.lastSyncAt
  let tone: "ok" | "warn" | "error" | "busy" = sync.stale ? "warn" : "ok"
  if (failed) tone = "error"
  if (syncNow.isPending) tone = "busy"
  const Icon = tone === "error" ? CloudOff : tone === "warn" ? AlertTriangle : CheckCircle2
  const iconColor = tone === "error" ? colors.destructive : tone === "warn" ? colors.warning : colors.success
  const title =
    tone === "busy"
      ? `Syncing with ${provider}…`
      : tone === "error"
        ? `We couldn't sync your steps.${last ? ` Last synced ${formatTime(last)}.` : ""}`
        : tone === "warn"
          ? `Last synced ${last ? formatRelative(last) : "a while ago"}`
          : `Synced ${last ? formatRelative(last).toLowerCase() : "recently"}`
  const subtitle = tone === "warn" ? "Steps missing? Sync now to refresh." : tone === "error" ? "Check your connection and try again." : provider

  return (
    <View style={[styles.bar, { backgroundColor: colors.card, borderColor: tone === "error" ? colors.destructive : tone === "warn" ? colors.warning : colors.border }]} testID="sync-status">
      {tone === "busy" ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon size={18} color={iconColor} />}
      <View style={styles.flex}>
        <Text variant="label" numberOfLines={compact ? 1 : 2}>
          {title}
        </Text>
        {!compact || tone !== "ok" ? (
          <Text variant="small" tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tone === "error" ? "Retry sync" : "Sync now"}
        disabled={syncNow.isPending}
        hitSlop={8}
        onPress={() => {
          haptic.tap()
          syncNow.mutate()
        }}
        style={({ pressed }) => [styles.syncBtn, { backgroundColor: colors.primarySoft }, pressed && { opacity: 0.7 }]}
        testID="sync-now"
      >
        {syncNow.isPending ? (
          <Spinning>
            <RefreshCw size={14} color={colors.primary} />
          </Spinning>
        ) : (
          <RefreshCw size={14} color={colors.primary} />
        )}
        <Text variant="label" tone="primary">
          {tone === "error" ? "Retry" : "Sync now"}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 14, paddingRight: 8, paddingVertical: 8, borderRadius: RADIUS.lg, borderWidth: 1, minHeight: 52 },
  flex: { flex: 1, gap: 1 },
  syncBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, minHeight: 36, borderRadius: RADIUS.pill },
})
