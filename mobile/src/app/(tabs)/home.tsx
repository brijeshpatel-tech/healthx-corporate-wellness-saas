/** SCR-M-018 Home Dashboard — same content as the web Home. Card order follows the company / Customise Home layout. */
import { router } from "expo-router"
import { Bell, Coins, Flame, LayoutGrid } from "lucide-react-native"
import { Fragment, useState, type ReactNode } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { ErrorState, IconButton, Notice, Screen, Skeleton, Text } from "@/components/ui"
import { SyncStatusBar } from "@/features/activity/sync-status"
import { ChallengeCard, HabitsTile, InsightCard, ScoreHero, SleepTile, StepsCard, WaterTile, WeekRankCard, WorkoutTile } from "@/features/home/home-cards"
import { HOME_CARDS, homeApi, type HomeCardKey, type HomeDashboard } from "@/lib/api/employee/home"
import { waterApi } from "@/lib/api/employee/water"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber, formatTime } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}

function HeaderChip({ icon: Icon, color, label, onPress, testID }: { icon: typeof Coins; color: string; label: string; onPress?: () => void; testID?: string }) {
  const { colors } = useTheme()
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={() => {
        haptic.tap()
        onPress?.()
      }}
      style={({ pressed }) => [styles.chip, { backgroundColor: colors.card, borderColor: colors.border }, pressed && { opacity: 0.8 }]}
      testID={testID}
    >
      <Icon size={16} color={color} strokeWidth={2.3} />
      <Text variant="label">{label}</Text>
    </Pressable>
  )
}

function HomeContent({ data }: { data: HomeDashboard }) {
  const addWater = useApiMutation(waterApi.add, {
    onSuccess: (r) => {
      haptic.success()
      if (r.pointsEarned) toast.success(`Water goal reached! +${r.pointsEarned} points 🎉`)
      else toast.success("+250 ml logged")
    },
  })

  const cards: Record<HomeCardKey, ReactNode> = {
    score: <ScoreHero score={data.score} />,
    steps: <StepsCard data={data} />,
    water: <WaterTile data={data} adding={addWater.isPending} onAdd={() => addWater.mutate({ amountMl: 250 })} />,
    workout: <WorkoutTile data={data} />,
    habits: <HabitsTile data={data} />,
    sleep: <SleepTile data={data} />,
    challenge: <ChallengeCard challenge={data.challenge} />,
    rank: <WeekRankCard data={data} />,
    summary: data.summary ? <InsightCard summary={data.summary} /> : null,
  }

  // Tiles sit two per row; large / wide cards take the full width.
  const rows: HomeCardKey[][] = []
  for (const key of data.homeCards) {
    if (!cards[key]) continue
    const size = HOME_CARDS.find((c) => c.key === key)?.size ?? "large"
    const last = rows[rows.length - 1]
    const lastIsOpenTile = last && last.length === 1 && HOME_CARDS.find((c) => c.key === last[0])?.size === "tile"
    if (size === "tile" && lastIsOpenTile) last.push(key)
    else rows.push([key])
  }

  return (
    <>
      {rows.map((row) => (
        <Fragment key={row.join("-")}>
          {row.length === 1 && HOME_CARDS.find((c) => c.key === row[0])?.size !== "tile" ? (
            cards[row[0]!]
          ) : (
            <View style={styles.tiles}>
              {row.map((k) => (
                <View key={k} style={styles.tileCell}>
                  {cards[k]}
                </View>
              ))}
              {row.length === 1 ? <View style={styles.tileCell} /> : null}
            </View>
          )}
        </Fragment>
      ))}
    </>
  )
}

function HomeSkeleton() {
  return (
    <View style={styles.skeleton}>
      <Skeleton height={52} width="70%" />
      <Skeleton height={52} radius={RADIUS.lg} />
      <Skeleton height={230} radius={RADIUS.xl} />
      <Skeleton height={150} radius={RADIUS.xl} />
      <View style={styles.tiles}>
        <Skeleton height={150} radius={RADIUS.xl} style={styles.tileCell} />
        <Skeleton height={150} radius={RADIUS.xl} style={styles.tileCell} />
      </View>
    </View>
  )
}

export default function HomeScreen() {
  const { tint, colors } = useTheme()
  const q = useApiQuery(["employee", "home"], () => homeApi.dashboard())
  const [refreshing, setRefreshing] = useState(false)
  const data = q.data

  const refresh = async () => {
    setRefreshing(true)
    await q.refetch()
    setRefreshing(false)
  }

  return (
    <Screen inTabs noHeader refreshing={refreshing} onRefresh={refresh} testID="home-screen">
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text variant="caption" tone="muted">
            {formatDate(new Date(), "EEEE, d MMMM")}
          </Text>
          <Text variant="title" numberOfLines={1} accessibilityRole="header">
            {greeting()}
            {data ? `, ${data.firstName}` : ""}
          </Text>
        </View>
        <IconButton icon={Bell} accessibilityLabel={`Notifications${data?.unreadNotifications ? `, ${data.unreadNotifications} unread` : ""}`} badge={data?.unreadNotifications} onPress={() => router.push("/notifications")} testID="bell" />
      </View>

      {!data ? (
        q.error ? (
          <ErrorState error={q.error} title="Couldn't load your dashboard" onRetry={() => q.refetch()} retrying={q.isFetching} />
        ) : (
          <HomeSkeleton />
        )
      ) : (
        <>
          <View style={styles.chips}>
            <HeaderChip icon={Coins} color={tint("points").fg} label={`${formatNumber(data.pointsBalance)} pts`} onPress={() => router.push("/wallet")} testID="points-chip" />
            <HeaderChip icon={Flame} color={tint("streak").fg} label={`${data.streak} day streak`} />
            <HeaderChip icon={LayoutGrid} color={colors.mutedForeground} label="Customise" onPress={() => router.push("/home/customise")} testID="customise-home" />
          </View>
          {q.isRefetchError ? (
            <Notice tone="warning" title={`Couldn't refresh. Showing data from ${formatTime(q.dataUpdatedAt ? new Date(q.dataUpdatedAt) : new Date())}.`}>
              <Text variant="label" tone="primary" onPress={() => q.refetch()}>
                Retry
              </Text>
            </Notice>
          ) : null}
          <SyncStatusBar sync={data.sync} compact />
          <HomeContent data={data} />
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 8 },
  flex: { flex: 1 },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: -6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 36, borderRadius: RADIUS.pill, borderWidth: StyleSheet.hairlineWidth },
  tiles: { flexDirection: "row", gap: 12 },
  tileCell: { flex: 1 },
  skeleton: { gap: 14 },
})
