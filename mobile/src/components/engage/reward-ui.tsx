/** Reward "product image" and catalogue card (SCR-M-054 … 058). */
import { LinearGradient } from "expo-linear-gradient"
import { Building2, Coins, Flame, Lock } from "lucide-react-native"
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { Card, Text } from "@/components/ui"
import type { RewardCard as RewardCardData } from "@/lib/api/employee/rewards"
import { formatNumber } from "@/lib/format"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"
import { alpha, go } from "./shared"

/** Big emoji on a soft gradient (rewards have no photos in the sample data). */
export function RewardImage({ emoji, color, height = 120, emojiSize = 54, radius = 0, style }: { emoji: string; color: string; height?: number; emojiSize?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ height, borderRadius: radius, overflow: "hidden", alignItems: "center", justifyContent: "center" }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <LinearGradient colors={[alpha(color, 0.34), alpha(color, 0.1)]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.glow, { backgroundColor: alpha(color, 0.25), width: height * 0.9, height: height * 0.9, borderRadius: height }]} />
      <Text style={{ fontSize: emojiSize, lineHeight: emojiSize * 1.25 }}>{emoji}</Text>
    </View>
  )
}

/** Catalogue card: image, category, name, cost and whether you can afford it. */
export function RewardCard({ r }: { r: RewardCardData }) {
  const { colors, tint } = useTheme()
  const affordable = r.needMore === 0
  const pts = tint("points")
  return (
    <Card padding={0} onPress={() => go(`/rewards/${r.id}`)} accessibilityLabel={`${r.name}. ${formatNumber(r.pointsCost)} points. ${affordable ? "You can redeem this" : `You need ${formatNumber(r.needMore)} more points`}`} style={styles.card} testID={`reward-${r.id}`}>
      <View>
        <RewardImage emoji={r.emoji} color={r.color} />
        <View style={styles.badges}>
          {r.companyReward ? (
            <View style={[styles.badge, { backgroundColor: colors.card }]}>
              <Building2 size={11} color={colors.foreground} />
              <Text variant="small" style={styles.badgeText}>
                Company
              </Text>
            </View>
          ) : null}
          {r.lowStock ? (
            <View style={[styles.badge, { backgroundColor: colors.destructive }]}>
              <Flame size={11} color="#ffffff" />
              <Text variant="small" color="#ffffff" style={styles.badgeText}>
                Only {r.stock} left
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.body}>
        <Text variant="small" tone="muted" numberOfLines={1}>
          {r.categoryName}
        </Text>
        <Text variant="label" numberOfLines={2} style={styles.name}>
          {r.name}
        </Text>
        <View style={styles.cost}>
          <Coins size={15} color={pts.fg} />
          <Text variant="subtitle" color={pts.fg}>
            {formatNumber(r.pointsCost)}
          </Text>
        </View>
        {affordable ? (
          <Text variant="small" tone="success" weight="semibold">
            You can redeem this
          </Text>
        ) : (
          <View style={styles.need}>
            <Lock size={11} color={colors.mutedForeground} />
            <Text variant="small" tone="muted" numberOfLines={1} style={styles.shrink}>
              {formatNumber(r.needMore)} more points
            </Text>
          </View>
        )}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1 },
  glow: { position: "absolute", top: -20, left: -20 },
  card: { overflow: "hidden", flex: 1 },
  badges: { position: "absolute", top: 8, left: 8, right: 8, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  badge: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10.5 },
  body: { padding: 12, gap: 3, flex: 1 },
  name: { minHeight: 36 },
  cost: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  need: { flexDirection: "row", alignItems: "center", gap: 4 },
})
