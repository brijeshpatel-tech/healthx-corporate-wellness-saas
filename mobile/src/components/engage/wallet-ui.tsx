/** Points ledger rows and the transaction detail sheet (SCR-M-052 / 053). */
import { Award, Brain, Droplets, Dumbbell, Flame, Footprints, Gift, Hourglass, ListChecks, RotateCcw, SlidersHorizontal, Trophy, type LucideIcon } from "lucide-react-native"
import { Pressable, StyleSheet, View } from "react-native"
import { BottomSheet, Button, IconTile, Text } from "@/components/ui"
import type { TxView } from "@/lib/api/employee/gamification"
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format"
import { openHref } from "@/lib/routes"
import type { PointsSource } from "@/lib/types"
import { useTheme } from "@/theme/theme"
import type { TintName } from "@/theme/tokens"
import { InfoRows } from "./shared"

export const SOURCE_META: Record<PointsSource, { icon: LucideIcon; tint: TintName }> = {
  steps: { icon: Footprints, tint: "steps" },
  workout: { icon: Dumbbell, tint: "workout" },
  meditation: { icon: Brain, tint: "insight" },
  water: { icon: Droplets, tint: "water" },
  challenge: { icon: Trophy, tint: "points" },
  streak: { icon: Flame, tint: "streak" },
  badge: { icon: Award, tint: "insight" },
  habit: { icon: ListChecks, tint: "habits" },
  manual_adjustment: { icon: SlidersHorizontal, tint: "neutral" },
  redemption: { icon: Gift, tint: "danger" },
  refund: { icon: RotateCcw, tint: "habits" },
  expiry: { icon: Hourglass, tint: "neutral" },
}

const TYPE_LABEL: Record<TxView["type"], string> = { earn: "Earned", redeem: "Redeemed", adjust: "Adjustment", refund: "Refund", expire: "Expired" }

/** One points-ledger row (+50 Workout, −500 Amazon Voucher…). */
export function TxRow({ t, onPress }: { t: TxView; onPress?: () => void }) {
  const { colors } = useTheme()
  const meta = SOURCE_META[t.source] ?? SOURCE_META.manual_adjustment
  const positive = t.points > 0
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${t.description}. ${positive ? "plus" : "minus"} ${Math.abs(t.points)} points. ${formatRelative(t.createdAt)}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.muted }]}
    >
      <IconTile icon={meta.icon} tint={meta.tint} size={38} />
      <View style={styles.flex}>
        <View style={styles.titleRow}>
          <Text variant="bodyMedium" numberOfLines={1} style={styles.shrink}>
            {t.description}
          </Text>
          {t.reversed ? (
            <View style={[styles.reversed, { backgroundColor: colors.muted }]}>
              <Text variant="small" tone="muted" weight="semibold">
                REVERSED
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {t.sourceLabel} · {formatRelative(t.createdAt)}
        </Text>
      </View>
      <Text variant="subtitle" color={t.reversed ? colors.mutedForeground : positive ? colors.success : colors.foreground} style={t.reversed ? styles.strike : undefined}>
        {positive ? "+" : "−"}
        {formatNumber(Math.abs(t.points))}
      </Text>
    </Pressable>
  )
}

/** Bottom sheet with the source detail of one transaction. */
export function TxSheet({ t, onClose }: { t: TxView | null; onClose: () => void }) {
  const { colors } = useTheme()
  const meta = t ? (SOURCE_META[t.source] ?? SOURCE_META.manual_adjustment) : SOURCE_META.manual_adjustment
  const positive = (t?.points ?? 0) > 0
  return (
    <BottomSheet
      open={!!t}
      onClose={onClose}
      title="Transaction"
      footer={
        t?.link ? (
          <Button
            title={`Go to ${t.sourceLabel.toLowerCase()}`}
            variant="outline"
            onPress={() => {
              onClose()
              openHref(t.link)
            }}
          />
        ) : undefined
      }
    >
      {t ? (
        <View style={styles.detail}>
          <IconTile icon={meta.icon} tint={meta.tint} size={56} />
          <Text variant="display" color={positive ? colors.success : colors.foreground}>
            {positive ? "+" : "−"}
            {formatNumber(Math.abs(t.points))}
            <Text variant="subtitle" tone="muted">
              {" "}
              pts
            </Text>
          </Text>
          {t.reversed ? (
            <View style={[styles.reversedBig, { backgroundColor: colors.muted }]}>
              <Text variant="small" tone="muted" weight="semibold">
                Reversed — these points were refunded
              </Text>
            </View>
          ) : null}
          <View style={styles.stretch}>
            <InfoRows
              rows={[
                ["Description", t.description],
                ["Source", t.sourceLabel],
                ["Type", TYPE_LABEL[t.type]],
                ["Date", formatDateTime(t.createdAt)],
                ["Balance after", `${formatNumber(t.balanceAfter)} pts`],
                ...(t.createdBy ? ([["Added by", t.createdBy]] as [string, string][]) : []),
              ]}
            />
          </View>
        </View>
      ) : null}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  shrink: { flexShrink: 1 },
  stretch: { alignSelf: "stretch" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10, minHeight: 60, borderRadius: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  reversed: { borderRadius: 999, paddingHorizontal: 6 },
  reversedBig: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  strike: { textDecorationLine: "line-through" },
  detail: { alignItems: "center", gap: 12 },
})
