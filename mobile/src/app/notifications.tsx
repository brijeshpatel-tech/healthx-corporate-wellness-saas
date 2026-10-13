/** SCR-M-061 Notification Centre — Today / Yesterday / Earlier, read state, deep links, delete with undo. */
import { router } from "expo-router"
import { Award, BellOff, BellRing, CheckCheck, Coins, Gift, Info, Megaphone, Settings2, Sparkles, Trash2, Trophy, type LucideIcon } from "lucide-react-native"
import { useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { BottomSheet, Button, Card, EmptyState, ErrorState, IconButton, Screen, SegmentedControl, SkeletonList, Text } from "@/components/ui"
import { notificationsApi, type NotificationGroup, type NotificationItem } from "@/lib/api/employee/notifications"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatRelative } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { openHref } from "@/lib/routes"
import { toast } from "@/lib/toast"
import type { NotificationType } from "@/lib/types"
import { useTheme } from "@/theme/theme"
import { RADIUS, type TintName } from "@/theme/tokens"

const TYPE_META: Record<NotificationType, { icon: LucideIcon; tint: TintName }> = {
  challenge: { icon: Trophy, tint: "points" },
  reward: { icon: Gift, tint: "insight" },
  badge: { icon: Award, tint: "points" },
  announcement: { icon: Megaphone, tint: "steps" },
  reminder: { icon: BellRing, tint: "water" },
  points: { icon: Coins, tint: "points" },
  insight: { icon: Sparkles, tint: "insight" },
  system: { icon: Info, tint: "neutral" },
}
const GROUP_LABEL: Record<NotificationGroup, string> = { today: "Today", yesterday: "Yesterday", earlier: "Earlier" }

function Row({ n, onPress, onLongPress }: { n: NotificationItem; onPress: () => void; onLongPress: () => void }) {
  const { colors, tint } = useTheme()
  const meta = TYPE_META[n.type] ?? TYPE_META.system
  const t = tint(meta.tint)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${n.read ? "" : "Unread. "}${n.title}. ${n.body}`}
      accessibilityHint="Long press for more options"
      onPress={onPress}
      onLongPress={() => {
        haptic.select()
        onLongPress()
      }}
      style={({ pressed }) => [styles.row, !n.read && { backgroundColor: colors.primarySoft }, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.icon, { backgroundColor: t.bg }]}>
        <meta.icon size={18} color={t.fg} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text variant={n.read ? "bodyMedium" : "subtitle"} numberOfLines={2} style={styles.flex}>
            {n.title}
          </Text>
          {!n.read ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
        </View>
        <Text variant="caption" tone="muted" numberOfLines={3}>
          {n.body}
        </Text>
        <Text variant="small" tone="muted">
          {formatRelative(n.createdAt)}
        </Text>
      </View>
    </Pressable>
  )
}

export default function NotificationsScreen() {
  const [filter, setFilter] = useState<"all" | "unread">("all")
  const [actionFor, setActionFor] = useState<NotificationItem | null>(null)
  const q = useApiQuery(["employee", "notifications"], () => notificationsApi.list())
  const markRead = useApiMutation(notificationsApi.markRead, { invalidate: [["employee"]] })
  const markAll = useApiMutation(notificationsApi.markAllRead, { success: "All caught up" })
  const restore = useApiMutation(notificationsApi.restore, { success: "Notification restored" })
  const remove = useApiMutation(notificationsApi.remove, {
    onSuccess: (_r, input) => toast.success("Notification deleted", { duration: 5000, action: { label: "Undo", onPress: () => restore.mutate({ id: input.id }) } }),
  })
  const clearRead = useApiMutation(notificationsApi.clearRead, { success: (r) => (r.removed ? `Cleared ${r.removed} read notifications` : "Nothing to clear") })

  const items = (q.data ?? []).filter((n) => filter === "all" || !n.read)
  const unread = (q.data ?? []).filter((n) => !n.read).length
  const groups = (["today", "yesterday", "earlier"] as const).map((g) => ({ g, list: items.filter((n) => n.group === g) })).filter((x) => x.list.length)

  const open = (n: NotificationItem) => {
    haptic.tap()
    if (!n.read) markRead.mutate({ id: n.id })
    if (n.href) openHref(n.href)
  }

  return (
    <Screen
      title="Notifications"
      subtitle={unread ? `${unread} unread` : undefined}
      back
      right={
        <>
          <IconButton icon={CheckCheck} variant="ghost" accessibilityLabel="Mark all as read" disabled={!unread || markAll.isPending} onPress={() => markAll.mutate()} testID="mark-all-read" />
          <IconButton icon={Settings2} variant="ghost" accessibilityLabel="Notification settings" onPress={() => router.push("/settings/notifications")} />
        </>
      }
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
    >
      <SegmentedControl
        options={[
          { value: "all", label: "All" },
          { value: "unread", label: unread ? `Unread (${unread})` : "Unread" },
        ]}
        value={filter}
        onChange={setFilter}
        accessibilityLabel="Filter notifications"
      />
      {q.isLoading ? (
        <SkeletonList count={6} height={76} header={false} />
      ) : q.error ? (
        <ErrorState title="Couldn't load notifications." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : !groups.length ? (
        <EmptyState icon={BellOff} title="You're all caught up." description={filter === "unread" && q.data?.length ? "No unread notifications." : "New reminders, challenge updates and rewards will show up here."} />
      ) : (
        <>
          {groups.map(({ g, list }) => (
            <View key={g} style={styles.group}>
              <Text variant="overline" tone="muted">
                {GROUP_LABEL[g]}
              </Text>
              <Card padding={4}>
                {list.map((n) => (
                  <Row key={n.id} n={n} onPress={() => open(n)} onLongPress={() => setActionFor(n)} />
                ))}
              </Card>
            </View>
          ))}
          <Text variant="small" tone="muted" align="center">
            Tip: long-press a notification to delete it.
          </Text>
          {(q.data ?? []).some((n) => n.read) ? <Button title="Clear read notifications" variant="ghost" icon={Trash2} loading={clearRead.isPending} onPress={() => clearRead.mutate()} /> : null}
        </>
      )}

      <BottomSheet open={!!actionFor} onClose={() => setActionFor(null)} title={actionFor?.title}>
        {actionFor && !actionFor.read ? (
          <Button
            title="Mark as read"
            icon={CheckCheck}
            variant="outline"
            onPress={() => {
              markRead.mutate({ id: actionFor.id })
              setActionFor(null)
            }}
          />
        ) : null}
        <Button
          title="Delete"
          icon={Trash2}
          variant="destructive"
          onPress={() => {
            if (actionFor) remove.mutate({ id: actionFor.id })
            setActionFor(null)
          }}
        />
      </BottomSheet>
    </Screen>
  )
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  row: { flexDirection: "row", gap: 12, padding: 12, borderRadius: RADIUS.lg },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  flex: { flex: 1 },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
})
