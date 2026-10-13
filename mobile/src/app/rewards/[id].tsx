/** SCR-M-055 Reward Detail — gallery, cost, delivery, stock, balance after, terms; redeem CTA. */
import { useLocalSearchParams } from "expo-router"
import { Boxes, Building2, ChevronDown, ChevronUp, Coins, FileText, Mail, PackageCheck, ShieldAlert, ShoppingBag, Truck, UserRound } from "lucide-react-native"
import { useState } from "react"
import { Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native"
import { RewardImage } from "@/components/engage/reward-ui"
import { go } from "@/components/engage/shared"
import { Button, Card, EmptyState, ErrorState, IconTile, Screen, Skeleton, Text } from "@/components/ui"
import { rewardsApi, type RewardDetail } from "@/lib/api/employee/rewards"
import { useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

const DELIVERY_ICON = { digital_voucher: Mail, physical: Truck, experience: Mail, donation: PackageCheck, company_perk: UserRound } as const

function Gallery({ r }: { r: RewardDetail }) {
  const { colors } = useTheme()
  const [width, setWidth] = useState(0)
  const [index, setIndex] = useState(0)
  const slides = ["main", "solid", "closeup"] as const
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return
    const i = Math.round(e.nativeEvent.contentOffset.x / width)
    if (i !== index) setIndex(i)
  }
  return (
    <View style={[styles.gallery, { borderColor: colors.border }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityLabel={`${r.name} images`}>
      {width ? (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={32}>
          {slides.map((s) => (
            <View key={s} style={{ width }}>
              {s === "main" ? (
                <RewardImage emoji={r.emoji} color={r.color} height={230} emojiSize={96} />
              ) : s === "solid" ? (
                <View style={[styles.solid, { backgroundColor: r.color }]}>
                  <Text style={styles.solidEmoji}>{r.emoji}</Text>
                  <View style={styles.catPill}>
                    <Text variant="small" color="#0f172a" weight="semibold">
                      {r.categoryName}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.solid, { backgroundColor: colors.muted }]}>
                  <Text style={styles.closeEmoji}>{r.emoji}</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.galleryPlaceholder} />
      )}
      <View style={styles.dots} pointerEvents="none">
        {slides.map((s, i) => (
          <View key={s} style={[styles.dot, { width: i === index ? 18 : 6, backgroundColor: i === index ? "#ffffff" : "rgba(255,255,255,0.65)" }]} />
        ))}
      </View>
    </View>
  )
}

function Detail({ r }: { r: RewardDetail }) {
  const { colors, tint } = useTheme()
  const [terms, setTerms] = useState(true)
  const DeliveryIcon = DELIVERY_ICON[r.delivery]
  const pts = tint("points")
  return (
    <>
      <Gallery r={r} />
      <View style={styles.titleBlock}>
        <View style={styles.metaRow}>
          <Text variant="caption" tone="muted">
            {r.categoryName}
          </Text>
          {r.companyReward ? (
            <View style={[styles.company, { backgroundColor: tint("steps").bg }]}>
              <Building2 size={12} color={tint("steps").fg} />
              <Text variant="small" color={tint("steps").fg} weight="semibold">
                Company reward
              </Text>
            </View>
          ) : null}
          {r.provider ? (
            <Text variant="caption" tone="muted">
              · by {r.provider}
            </Text>
          ) : null}
        </View>
        <Text variant="title" accessibilityRole="header">
          {r.name}
        </Text>
        <View style={styles.cost}>
          <Coins size={22} color={pts.fg} />
          <Text variant="title" color={pts.fg}>
            {formatNumber(r.pointsCost)}
          </Text>
          <Text variant="subtitle" tone="muted">
            points
          </Text>
        </View>
      </View>
      <Text variant="body" tone="muted">
        {r.description}
      </Text>

      <View style={styles.facts}>
        <View style={[styles.fact, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <IconTile icon={DeliveryIcon} tint="steps" size={34} />
          <Text variant="small" tone="muted">
            Delivery
          </Text>
          <Text variant="label">{r.deliveryLabel}</Text>
        </View>
        <View style={[styles.fact, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <IconTile icon={Boxes} tint={r.outOfStock ? "danger" : r.lowStock ? "points" : "habits"} size={34} />
          <Text variant="small" tone="muted">
            Availability
          </Text>
          <Text variant="label">{r.outOfStock ? "Out of stock" : r.stock === null ? "In stock" : r.lowStock ? `Only ${r.stock} left` : `${formatNumber(r.stock)} in stock`}</Text>
          <Text variant="small" tone="muted">
            {r.perEmployeeLimit ? `Limit ${r.perEmployeeLimit} per person · you've redeemed ${r.myRedemptions}` : "No per-person limit"}
          </Text>
        </View>
      </View>

      <Card>
        <View style={styles.between}>
          <Text variant="caption" tone="muted">
            Your balance
          </Text>
          <Text variant="label">{formatNumber(r.balance)} pts</Text>
        </View>
        <View style={[styles.between, styles.mt8]}>
          <Text variant="caption" tone="muted">
            Reward cost
          </Text>
          <Text variant="label">−{formatNumber(r.pointsCost)} pts</Text>
        </View>
        <View style={[styles.between, styles.afterRow, { borderTopColor: colors.border }]}>
          <Text variant="bodyMedium">Balance after redemption</Text>
          <Text variant="heading" tone={r.balanceAfter < 0 ? "destructive" : "default"}>
            {formatNumber(r.balanceAfter)} pts
          </Text>
        </View>
        {r.blockedReason ? (
          <View style={[styles.blocked, { backgroundColor: pts.bg }]}>
            <ShieldAlert size={16} color={pts.fg} />
            <Text variant="caption" color={pts.fg} style={styles.flex}>
              {r.blockedReason}
            </Text>
          </View>
        ) : r.approvalRequired ? (
          <Text variant="small" tone="muted" style={styles.mt8}>
            Your company approves redemptions before they&apos;re fulfilled — your order starts as “Pending approval”. Points are refunded if an order is rejected.
          </Text>
        ) : null}
      </Card>

      <Card padding={0}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: terms }}
          onPress={() => {
            haptic.tap()
            setTerms((t) => !t)
          }}
          style={styles.termsHead}
        >
          <FileText size={16} color={colors.mutedForeground} />
          <Text variant="subtitle" style={styles.flex}>
            Terms & conditions
          </Text>
          {terms ? <ChevronUp size={18} color={colors.mutedForeground} /> : <ChevronDown size={18} color={colors.mutedForeground} />}
        </Pressable>
        {terms ? (
          <View style={styles.termsBody}>
            <Text variant="caption" tone="muted">
              {r.terms}
            </Text>
            <Text variant="caption" tone="muted">
              Points are deducted when you place the order and refunded automatically if it&apos;s cancelled or rejected. Points never expire.
            </Text>
          </View>
        ) : null}
      </Card>
    </>
  )
}

function Footer({ r }: { r: RewardDetail }) {
  const { tint } = useTheme()
  return (
    <View style={styles.footer}>
      <View>
        <Text variant="small" tone="muted">
          Cost
        </Text>
        <Text variant="heading" color={tint("points").fg}>
          {formatNumber(r.pointsCost)}
        </Text>
      </View>
      <Button
        title={r.canRedeem ? "Redeem" : r.outOfStock ? "Out of stock" : "Redeem"}
        disabled={!r.canRedeem}
        onPress={() => go(`/rewards/${r.id}/redeem`)}
        style={styles.flex}
        testID="redeem-button"
      />
    </View>
  )
}

export default function RewardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const q = useApiQuery(["employee", "reward", id], () => rewardsApi.detail({ id }), { enabled: !!id, retry: (n, e) => e.status !== 404 && n < 1 })
  return (
    <Screen title="Reward" back backHref="/rewards" refreshing={q.isRefetching} onRefresh={() => q.refetch()} footer={q.data ? <Footer r={q.data} /> : undefined} testID="reward-detail">
      {q.data ? (
        <Detail r={q.data} />
      ) : q.error ? (
        q.error.status === 404 ? (
          <EmptyState icon={ShoppingBag} title="This reward is no longer available." description="It may have been removed from your company's catalogue." action={{ label: "Browse rewards", onPress: () => go("/rewards") }} />
        ) : (
          <ErrorState title="Couldn't load this reward." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
        )
      ) : (
        <>
          <Skeleton height={230} radius={RADIUS.xxl} />
          <Skeleton height={28} width="70%" />
          <Skeleton height={90} radius={RADIUS.xl} />
          <Skeleton height={160} radius={RADIUS.xl} />
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt8: { marginTop: 8 },
  gallery: { borderRadius: RADIUS.xxl, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, height: 230 },
  galleryPlaceholder: { height: 230 },
  solid: { height: 230, alignItems: "center", justifyContent: "center" },
  solidEmoji: { fontSize: 96, lineHeight: 120 },
  closeEmoji: { fontSize: 150, lineHeight: 180 },
  catPill: { position: "absolute", left: 14, bottom: 14, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  dots: { position: "absolute", bottom: 12, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { height: 6, borderRadius: 3 },
  titleBlock: { gap: 6 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  company: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  cost: { flexDirection: "row", alignItems: "center", gap: 6 },
  facts: { flexDirection: "row", gap: 10 },
  fact: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 12, gap: 4 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  afterRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 12 },
  blocked: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: RADIUS.md, marginTop: 12 },
  termsHead: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, minHeight: 56 },
  termsBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  footer: { flexDirection: "row", alignItems: "center", gap: 14 },
})

