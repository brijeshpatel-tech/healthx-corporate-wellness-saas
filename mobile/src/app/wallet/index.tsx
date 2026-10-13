/** SCR-M-052 Points Wallet — available / lifetime / redeemed, next reward, weekly earnings, recent activity. Points never expire. */
import { ArrowRight, Gift, History, Info, Package, Sparkles, TrendingUp } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { EmojiTile, go, GradientCard, HeroButton } from "@/components/engage/shared"
import { TxRow, TxSheet } from "@/components/engage/wallet-ui"
import { BarChart, Card, EmptyState, ErrorState, IconButton, ProgressBar, Screen, SectionHeader, Skeleton, Text } from "@/components/ui"
import { gamificationApi, type TxView, type WalletSummary } from "@/lib/api/employee/gamification"
import { useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

function Wallet({ w }: { w: WalletSummary }) {
  const { colors, tint } = useTheme()
  const [selected, setSelected] = useState<TxView | null>(null)
  return (
    <>
      <GradientCard colors={["#fbbf24", "#f97316", "#f43f5e"]} emoji="🪙" padding={20}>
        <Text variant="caption" color="rgba(255,255,255,0.9)">
          Available points
        </Text>
        <Text variant="display" style={styles.balance} color="#ffffff" accessibilityLabel={`${w.available} points available`}>
          {formatNumber(w.available)}
        </Text>
        <View style={styles.rowSm}>
          <TrendingUp size={15} color="#ffffff" />
          <Text variant="caption" color="#ffffff">
            +{formatNumber(w.earnedThisMonth)} earned this month
          </Text>
        </View>
        <View style={styles.split}>
          <View style={styles.splitBox}>
            <Text variant="small" color="rgba(255,255,255,0.85)">
              Lifetime points
            </Text>
            <Text variant="heading" color="#ffffff">
              {formatNumber(w.lifetime)}
            </Text>
          </View>
          <View style={styles.splitBox}>
            <Text variant="small" color="rgba(255,255,255,0.85)">
              Redeemed
            </Text>
            <Text variant="heading" color="#ffffff">
              {formatNumber(w.redeemed)}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <HeroButton title="Browse rewards" icon={Gift} onPress={() => go("/rewards")} testID="browse-rewards" />
          <HeroButton title={w.openOrders ? `My orders (${w.openOrders})` : "My orders"} icon={Package} variant="glass" onPress={() => go("/orders")} testID="my-orders" />
        </View>
      </GradientCard>

      {w.nextReward ? (
        <Card onPress={() => go(`/rewards/${w.nextReward!.id}`)} accessibilityLabel={`${w.nextReward.needMore} more points for ${w.nextReward.name}`}>
          <View style={styles.row}>
            <EmojiTile emoji={w.nextReward.emoji} color={w.nextReward.color} size={48} />
            <View style={styles.flex}>
              <Text variant="caption" tone="muted" numberOfLines={2}>
                <Text variant="label">{formatNumber(w.nextReward.needMore)} more points</Text> for {w.nextReward.name}
              </Text>
              <ProgressBar value={w.available} max={w.nextReward.pointsCost} height={7} color={tint("points").fg} />
            </View>
            <ArrowRight size={18} color={colors.mutedForeground} />
          </View>
        </Card>
      ) : null}

      <Card>
        <View style={styles.between}>
          <Text variant="subtitle">Points earned per week</Text>
          <Text variant="small" tone="muted">
            Last 8 weeks
          </Text>
        </View>
        <BarChart
          data={w.weekly.map((x, i) => ({ key: `${i}-${x.week}`, label: x.week.split(" ")[0] ?? x.week, detail: `Week to ${x.week}`, value: x.earned }))}
          color={tint("points").fg}
          dimBelowGoal={false}
          unit="pts"
          height={160}
          accessibilityLabel="Points earned per week"
        />
        <View style={[styles.formula, { backgroundColor: colors.muted }]}>
          <Info size={14} color={colors.mutedForeground} style={styles.mt1} />
          <Text variant="small" tone="muted" style={styles.flex}>
            Available = lifetime {formatNumber(w.lifetime)} − redeemed {formatNumber(w.redeemed)}
            {w.adjustments ? ` ${w.adjustments > 0 ? "+" : "−"} adjustments ${formatNumber(Math.abs(w.adjustments))}` : ""} = <Text variant="small" weight="bold">{formatNumber(w.available)}</Text>. Points never expire.
          </Text>
        </View>
      </Card>

      <SectionHeader title="Recent activity" action={{ label: "See all", onPress: () => go("/wallet/history") }} />
      {w.recent.length ? (
        <Card padding={4}>
          {w.recent.map((t) => (
            <TxRow key={t.id} t={t} onPress={() => setSelected(t)} />
          ))}
        </Card>
      ) : (
        <Card>
          <EmptyState compact icon={Sparkles} title="Earn points by logging activity, workouts and challenges." />
        </Card>
      )}
      <TxSheet t={selected} onClose={() => setSelected(null)} />
    </>
  )
}

export default function WalletScreen() {
  const q = useApiQuery(["employee", "wallet"], () => gamificationApi.wallet())
  return (
    <Screen
      title="Points wallet"
      back
      backHref="/rewards"
      right={<IconButton icon={History} variant="ghost" accessibilityLabel="Points history" onPress={() => go("/wallet/history")} testID="points-history" />}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      testID="wallet-screen"
    >
      {q.data ? (
        <Wallet w={q.data} />
      ) : q.error ? (
        <ErrorState title="Couldn't load your wallet." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : (
        <>
          <Skeleton height={280} radius={RADIUS.xxl} />
          <Skeleton height={80} radius={RADIUS.xl} />
          <Skeleton height={240} radius={RADIUS.xl} />
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 6 },
  mt1: { marginTop: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowSm: { flexDirection: "row", alignItems: "center", gap: 6 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  balance: { fontSize: 46, lineHeight: 54, letterSpacing: -1, fontVariant: ["tabular-nums"] },
  split: { flexDirection: "row", gap: 10, marginTop: 16 },
  splitBox: { flex: 1, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: RADIUS.lg, padding: 12 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  formula: { flexDirection: "row", gap: 8, padding: 10, borderRadius: RADIUS.md, marginTop: 10 },
})
