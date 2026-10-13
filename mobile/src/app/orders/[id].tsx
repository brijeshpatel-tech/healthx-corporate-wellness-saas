/** SCR-M-058 Order Detail — status timeline, voucher code / tracking, delivery details, cancel while pending (points refunded). */
import { LinearGradient } from "expo-linear-gradient"
import { useLocalSearchParams } from "expo-router"
import { Check, CircleDashed, CircleX, Coins, Copy, Eye, EyeOff, LifeBuoy, PackageCheck, RotateCcw, Truck } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { RewardImage } from "@/components/engage/reward-ui"
import { alpha, copyText, go, InfoRows } from "@/components/engage/shared"
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, IconButton, Screen, Skeleton, StatusPill, Text } from "@/components/ui"
import { ORDER_STATUS_LABEL, ordersApi, type OrderDetail } from "@/lib/api/employee/orders"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatDateTime, formatNumber } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import type { OrderStatus } from "@/lib/types"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

const STEP_TEXT: Record<OrderStatus, string> = {
  pending_approval: "Requested · pending approval",
  approved: "Approved",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Fulfilled",
  cancelled: "Cancelled",
  rejected: "Rejected",
}

function Order({ o }: { o: OrderDetail }) {
  const { colors, tint } = useTheme()
  const [revealed, setRevealed] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const cancel = useApiMutation(ordersApi.cancel, {
    success: (r) => `Order cancelled – ${formatNumber(r.refunded)} points refunded.`,
    onSuccess: () => {
      haptic.success()
      setConfirm(false)
    },
    onError: () => setConfirm(false),
  })
  const delivered = o.status === "delivered"
  const lastAt = o.timeline[o.timeline.length - 1]?.at
  const masked = o.voucherCode ? `${o.voucherCode.slice(0, 2)}${"•".repeat(Math.max(4, o.voucherCode.length - 4))}${o.voucherCode.slice(-2)}` : ""

  return (
    <>
      <Card style={styles.clip}>
        <LinearGradient colors={[alpha(o.color, 0.16), alpha(o.color, 0)]} style={styles.glow} />
        <View style={styles.head}>
          <RewardImage emoji={o.emoji} color={o.color} height={68} emojiSize={36} radius={20} style={styles.thumb} />
          <View style={styles.flex}>
            <StatusPill status={o.status} label={ORDER_STATUS_LABEL[o.status]} />
            <Text variant="heading" numberOfLines={2}>
              {o.rewardName}
            </Text>
            <View style={styles.meta}>
              <Text variant="caption" tone="muted" selectable>
                Order {o.orderNumber}
              </Text>
              <Coins size={13} color={colors.mutedForeground} />
              <Text variant="caption" tone="muted">
                {formatNumber(o.points)} pts
              </Text>
            </View>
          </View>
        </View>
        {delivered ? (
          <View style={[styles.note, { backgroundColor: tint("habits").bg }]}>
            <PackageCheck size={16} color={tint("habits").fg} />
            <Text variant="label" color={tint("habits").fg}>
              Delivered on {formatDate(lastAt, "d MMM")}.
            </Text>
          </View>
        ) : o.refunded ? (
          <View style={[styles.note, { backgroundColor: colors.muted }]}>
            <RotateCcw size={16} color={colors.foreground} />
            <Text variant="label">
              {o.status === "rejected" ? "Rejected" : "Cancelled"} – {formatNumber(o.points)} points refunded.
            </Text>
          </View>
        ) : o.status === "pending_approval" ? (
          <Text variant="caption" tone="muted" style={styles.mt12}>
            Waiting for your company to approve this order. You can cancel it until then — your points are refunded straight away.
          </Text>
        ) : null}
      </Card>

      {o.voucherCode ? (
        <Card>
          <Text variant="subtitle">Your voucher code</Text>
          <View style={styles.codeRow}>
            <View style={[styles.code, { borderColor: colors.input, backgroundColor: colors.muted }]}>
              <Text variant="subtitle" selectable={revealed} style={styles.codeText} accessibilityLabel={revealed ? `Code ${o.voucherCode}` : "Code hidden"}>
                {revealed ? o.voucherCode : masked}
              </Text>
            </View>
            <IconButton icon={revealed ? EyeOff : Eye} accessibilityLabel={revealed ? "Hide code" : "Reveal code"} onPress={() => setRevealed((v) => !v)} />
            <IconButton icon={Copy} accessibilityLabel="Copy code" onPress={() => copyText(o.voucherCode!, "Code")} />
          </View>
          <Text variant="small" tone="muted">
            Only you can see this code. Keep it private until you use it.
          </Text>
        </Card>
      ) : null}

      {o.trackingNumber ? (
        <Card>
          <View style={styles.head}>
            <View style={[styles.truck, { backgroundColor: tint("workout").bg }]}>
              <Truck size={20} color={tint("workout").fg} />
            </View>
            <View style={styles.flex}>
              <Text variant="small" tone="muted">
                Tracking reference
              </Text>
              <Text variant="label" selectable>
                {o.trackingNumber}
              </Text>
            </View>
            <IconButton icon={Copy} variant="ghost" accessibilityLabel="Copy tracking number" onPress={() => copyText(o.trackingNumber!, "Tracking number")} />
          </View>
        </Card>
      ) : null}

      <Card>
        <Text variant="subtitle" style={styles.mb12}>
          Status
        </Text>
        {o.timeline.map((t, i) => {
          const bad = t.status === "cancelled" || t.status === "rejected"
          const last = i === o.timeline.length - 1 && o.upcoming.length === 0
          return (
            <View key={`${t.status}-${t.at}`} style={styles.step}>
              {!last ? <View style={[styles.line, { backgroundColor: alpha(colors.primary, 0.35) }]} /> : null}
              <View style={[styles.stepDot, { backgroundColor: bad ? colors.destructive : colors.primary }]}>
                {bad ? <CircleX size={16} color="#ffffff" /> : <Check size={15} color="#ffffff" strokeWidth={3} />}
              </View>
              <View style={styles.stepBody}>
                <Text variant="label">{STEP_TEXT[t.status]}</Text>
                <Text variant="small" tone="muted">
                  {formatDateTime(t.at)}
                  {t.by ? ` · ${t.by}` : ""}
                </Text>
                {t.note ? (
                  <Text variant="caption" tone="muted">
                    {t.note}
                  </Text>
                ) : null}
              </View>
            </View>
          )
        })}
        {o.upcoming.map((s, i) => (
          <View key={s} style={styles.step}>
            {i < o.upcoming.length - 1 ? <View style={[styles.line, { backgroundColor: colors.border }]} /> : null}
            <View style={[styles.stepDot, styles.dashed, { borderColor: colors.input, backgroundColor: colors.card }]}>
              <CircleDashed size={13} color={colors.mutedForeground} />
            </View>
            <View style={styles.stepBody}>
              <Text variant="caption" tone="muted">
                {STEP_TEXT[s]}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      <Text variant="heading">Delivery details</Text>
      <InfoRows
        rows={[
          ["Method", o.deliveryLabel],
          ["Recipient", o.details.name],
          ["Email", o.details.email],
          ...(o.details.phone ? ([["Phone", o.details.phone]] as [string, string][]) : []),
          ...(o.details.address ? ([["Address", o.details.address]] as [string, string][]) : []),
          ...(o.details.notes ? ([["Notes", o.details.notes]] as [string, string][]) : []),
          ["Points spent", `${formatNumber(o.points)} pts`],
          ["Ordered", formatDateTime(o.createdAt)],
        ]}
      />

      {o.canCancel ? <Button title="Cancel order" icon={CircleX} variant="destructive" loading={cancel.isPending} onPress={() => setConfirm(true)} testID="cancel-order" /> : null}
      <Button title="Contact support" icon={LifeBuoy} variant="outline" onPress={() => go("/help")} />

      <ConfirmDialog
        open={confirm}
        title="Cancel this order?"
        message={`${formatNumber(o.points)} points will be refunded to your wallet straight away. This can't be undone.`}
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        destructive
        loading={cancel.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => cancel.mutate({ id: o.id })}
      />
    </>
  )
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const q = useApiQuery(["employee", "order", id], () => ordersApi.detail({ id }), { enabled: !!id, retry: (n, e) => e.status !== 404 && n < 1 })
  return (
    <Screen title="Order" back backHref="/orders" refreshing={q.isRefetching} onRefresh={() => q.refetch()} testID="order-detail">
      {q.data ? (
        <Order o={q.data} />
      ) : q.error ? (
        q.error.status === 404 ? (
          <EmptyState icon={PackageCheck} title="Couldn't find this order." action={{ label: "Back to my orders", onPress: () => go("/orders") }} />
        ) : (
          <ErrorState title="Couldn't load this order." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
        )
      ) : (
        <>
          <Skeleton height={150} radius={RADIUS.xl} />
          <Skeleton height={260} radius={RADIUS.xl} />
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 4 },
  clip: { overflow: "hidden" },
  mt12: { marginTop: 12 },
  mb12: { marginBottom: 12 },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 130 },
  head: { flexDirection: "row", alignItems: "center", gap: 14 },
  thumb: { width: 68 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  note: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: RADIUS.md, marginTop: 12 },
  codeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 10 },
  code: { flex: 1, borderWidth: 1.5, borderStyle: "dashed", borderRadius: RADIUS.lg, paddingHorizontal: 12, height: 48, justifyContent: "center" },
  codeText: { letterSpacing: 2 },
  truck: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  step: { flexDirection: "row", gap: 12, paddingBottom: 18 },
  line: { position: "absolute", left: 13, top: 28, bottom: 0, width: 2 },
  stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  dashed: { borderWidth: 2, borderStyle: "dashed" },
  stepBody: { flex: 1, gap: 2, paddingTop: 3 },
})
