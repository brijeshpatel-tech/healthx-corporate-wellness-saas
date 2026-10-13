/** SCR-M-054 Rewards Catalogue — balance, search, categories, "can afford" filter. Redemptions need company approval. */
import { LinearGradient } from "expo-linear-gradient"
import { ChevronRight, Coins, Gift, Package, SearchX } from "lucide-react-native"
import { useState } from "react"
import { Pressable, StyleSheet, Switch, View } from "react-native"
import { RewardCard } from "@/components/engage/reward-ui"
import { ChipScroller, go, SearchField, useDebounced } from "@/components/engage/shared"
import { EmptyState, ErrorState, IconButton, Screen, Skeleton, Text } from "@/components/ui"
import { rewardsApi, type RewardCard as RewardCardData } from "@/lib/api/employee/rewards"
import { useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

export default function RewardsTab() {
  const { colors } = useTheme()
  const [category, setCategory] = useState("all")
  const [affordable, setAffordable] = useState(false)
  const [search, setSearch] = useState("")
  const term = useDebounced(search.trim(), 250)
  const q = useApiQuery(["employee", "rewards", category, affordable, term], () => rewardsApi.catalogue({ categoryId: category, affordable, search: term }), { placeholderData: (prev) => prev })
  const d = q.data
  const clear = () => {
    setCategory("all")
    setAffordable(false)
    setSearch("")
  }

  // Two-column grid: pair the cards into rows so heights line up.
  const rows: RewardCardData[][] = []
  const items = d?.items ?? []
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2))

  return (
    <Screen
      inTabs
      large
      title="Rewards"
      subtitle="Spend the points you earn"
      right={<IconButton icon={Package} accessibilityLabel="My orders" onPress={() => go("/orders")} testID="orders-button" />}
      refreshing={q.isRefetching && !q.isPlaceholderData}
      onRefresh={() => q.refetch()}
      testID="rewards-screen"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Your balance ${d ? formatNumber(d.balance) : ""} points. Open wallet`}
        onPress={() => {
          haptic.tap()
          go("/wallet")
        }}
        style={({ pressed }) => [pressed && styles.pressed]}
        testID="balance-card"
      >
        <LinearGradient colors={["#fbbf24", "#f97316", "#f43f5e"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balance}>
          <View style={styles.coin}>
            <Coins size={24} color="#ffffff" />
          </View>
          <View style={styles.flex}>
            <Text variant="caption" color="rgba(255,255,255,0.88)">
              Your balance
            </Text>
            <Text variant="title" color="#ffffff">
              {d ? formatNumber(d.balance) : "—"}{" "}
              <Text variant="subtitle" color="rgba(255,255,255,0.88)">
                points
              </Text>
            </Text>
          </View>
          <View style={styles.walletPill}>
            <Text variant="label" color="#ffffff">
              Wallet
            </Text>
            <ChevronRight size={16} color="#ffffff" />
          </View>
        </LinearGradient>
      </Pressable>

      <SearchField value={search} onChangeText={setSearch} placeholder="Search rewards…" testID="reward-search" />
      <View style={[styles.afford, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.flex}>
          <Text variant="bodyMedium">Can afford</Text>
          <Text variant="caption" tone="muted">
            Only show rewards within your balance
          </Text>
        </View>
        <Switch
          accessibilityLabel="Only rewards I can afford"
          value={affordable}
          onValueChange={(v) => {
            haptic.select()
            setAffordable(v)
          }}
          trackColor={{ false: colors.input, true: colors.primary }}
          thumbColor="#ffffff"
          ios_backgroundColor={colors.input}
          testID="affordable-switch"
        />
      </View>
      <ChipScroller
        accessibilityLabel="Category"
        value={category}
        onChange={setCategory}
        options={[{ value: "all", label: "All", icon: Gift }, ...(d?.categories ?? []).map((c) => ({ value: c.id, label: c.name, emoji: c.icon, count: c.count }))]}
      />

      {q.error && !d ? (
        <ErrorState title="Couldn't load rewards." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : !d ? (
        <View style={styles.grid}>
          {[0, 1].map((r) => (
            <View key={r} style={styles.gridRow}>
              <Skeleton height={230} radius={RADIUS.xl} style={styles.flex} />
              <Skeleton height={230} radius={RADIUS.xl} style={styles.flex} />
            </View>
          ))}
        </View>
      ) : d.totalVisible === 0 ? (
        <EmptyState icon={Gift} title="No rewards available yet. Your company will add rewards soon." />
      ) : d.items.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={affordable && !term ? "Nothing you can afford here yet" : "No rewards match your search"}
          description={affordable ? "Keep earning points — or turn off 'Can afford' to see everything." : "Try another word or category."}
          action={{ label: "Clear filters", onPress: clear }}
        />
      ) : (
        <View style={[styles.grid, q.isFetching && q.isPlaceholderData && styles.dim]}>
          {rows.map((row) => (
            <View key={row.map((r) => r.id).join("-")} style={styles.gridRow}>
              {row.map((r) => (
                <View key={r.id} style={styles.cell}>
                  <RewardCard r={r} />
                </View>
              ))}
              {row.length === 1 ? <View style={styles.cell} /> : null}
            </View>
          ))}
          <Text variant="small" tone="muted" align="center">
            Your company approves each redemption. Points are refunded if an order is rejected.
          </Text>
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  balance: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: RADIUS.xl },
  coin: { width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  walletPill: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "rgba(255,255,255,0.18)", paddingLeft: 10, paddingRight: 6, height: 32, borderRadius: RADIUS.md },
  afford: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 10 },
  grid: { gap: 12 },
  gridRow: { flexDirection: "row", gap: 12 },
  cell: { flex: 1 },
  dim: { opacity: 0.6 },
})
