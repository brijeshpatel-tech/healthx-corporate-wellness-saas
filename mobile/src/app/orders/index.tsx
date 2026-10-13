/** SCR-M-057 My Orders — redemptions from request to delivery, filter by status. */
import { ChevronRight, Coins, Gift, Package } from "lucide-react-native"
import { useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { RewardImage } from "@/components/engage/reward-ui"
import { ChipScroller, go } from "@/components/engage/shared"
import { Card, EmptyState, ErrorState, IconButton, Screen, SkeletonList, StatusPill, Text } from "@/components/ui"
import { ORDER_STATUS_LABEL, ordersApi, type OrderFilter } from "@/lib/api/employee/orders"
import { useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"

export default function OrdersScreen() {
  const { colors } = useTheme()
  const [status, setStatus] = useState<OrderFilter>("all")
  const q = useApiQuery(["employee", "orders", status], () => ordersApi.list({ status }), { placeholderData: (prev) => prev })
  const d = q.data

  return (
    <Screen
      title="My orders"
      back
      backHref="/wallet"
      right={<IconButton icon={Gift} variant="ghost" accessibilityLabel="Browse rewards" onPress={() => go("/rewards")} />}
      refreshing={q.isRefetching && !q.isPlaceholderData}
      onRefresh={() => q.refetch()}
      testID="orders-screen"
    >
      <ChipScroller<OrderFilter>
        accessibilityLabel="Order status"
        value={status}
        onChange={setStatus}
        options={[
          { value: "all", label: "All", count: d?.counts.all },
          { value: "open", label: "In progress", count: d?.counts.open },
          { value: "fulfilled", label: "Fulfilled", count: d?.counts.fulfilled },
          { value: "closed", label: "Cancelled / rejected", count: d?.counts.closed },
        ]}
      />
      {q.error && !d ? (
        <ErrorState title="Couldn't load orders." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : !d ? (
        <SkeletonList count={4} height={78} header={false} />
      ) : d.items.length === 0 ? (
        d.counts.all === 0 ? (
          <EmptyState icon={Package} title="No orders yet. Redeem your points for a reward." action={{ label: "Browse rewards", icon: Gift, onPress: () => go("/rewards") }} />
        ) : (
          <EmptyState icon={Package} title="No orders with this status." action={{ label: "Show all orders", onPress: () => setStatus("all") }} />
        )
      ) : (
        <Card padding={4} style={q.isFetching && q.isPlaceholderData ? styles.dim : undefined}>
          {d.items.map((o) => (
            <Pressable
              key={o.id}
              accessibilityRole="button"
              accessibilityLabel={`${o.rewardName}, ${ORDER_STATUS_LABEL[o.status]}, ${formatNumber(o.points)} points`}
              onPress={() => {
                haptic.tap()
                go(`/orders/${o.id}`)
              }}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.muted }]}
              testID={`order-${o.orderNumber}`}
            >
              <RewardImage emoji={o.emoji} color={o.color} height={48} emojiSize={24} radius={14} style={styles.thumb} />
              <View style={styles.flex}>
                <Text variant="bodyMedium" numberOfLines={1}>
                  {o.rewardName}
                </Text>
                <View style={styles.meta}>
                  <Text variant="small" tone="muted">
                    {formatDate(o.createdAt, "d MMM yyyy")}
                  </Text>
                  <Coins size={11} color={colors.mutedForeground} />
                  <Text variant="small" tone="muted">
                    {formatNumber(o.points)}
                  </Text>
                </View>
                <StatusPill status={o.status} label={ORDER_STATUS_LABEL[o.status]} />
              </View>
              <ChevronRight size={18} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 4 },
  dim: { opacity: 0.6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16 },
  thumb: { width: 48 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
})
