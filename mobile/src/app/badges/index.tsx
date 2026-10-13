/** SCR-M-050 Badges & Achievements (streaks, earned / locked grid, detail sheet) + SCR-M-051 unlock celebration (shown once). */
import { LinearGradient } from "expo-linear-gradient"
import { Award, CircleCheck, Coins, Droplets, Flame, ListChecks, Lock, Sparkles, UsersRound } from "lucide-react-native"
import { useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { CelebrationModal, GradientCard, Medallion, TintPill } from "@/components/engage/shared"
import { BottomSheet, Button, Card, EmptyState, ErrorState, ProgressBar, ProgressRing, Screen, SegmentedControl, Skeleton, Text } from "@/components/ui"
import { gamificationApi, type BadgesResult, type BadgeView, type StreakView } from "@/lib/api/employee/gamification"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatCompact, formatDate } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import type { BadgeRarity } from "@/lib/types"
import { useTheme } from "@/theme/theme"
import { RADIUS, type TintName } from "@/theme/tokens"

const RARITY: Record<BadgeRarity, { label: string; tint: TintName }> = {
  common: { label: "Common", tint: "neutral" },
  rare: { label: "Rare", tint: "steps" },
  epic: { label: "Epic", tint: "insight" },
  legendary: { label: "Legendary", tint: "points" },
}

const STREAK_META: Record<StreakView["key"], { icon: typeof Flame; colors: [string, string]; emoji: string }> = {
  activity: { icon: Flame, colors: ["#f97316", "#f43f5e"], emoji: "🔥" },
  hydration: { icon: Droplets, colors: ["#06b6d4", "#0284c7"], emoji: "💧" },
  habits: { icon: ListChecks, colors: ["#10b981", "#0d9488"], emoji: "✅" },
}

function BadgeTile({ b, onPress }: { b: BadgeView; onPress: () => void }) {
  const { colors, tint } = useTheme()
  const r = tint(RARITY[b.rarity].tint)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${b.name}. ${b.earned ? `Earned ${formatDate(b.earnedAt, "d MMM yyyy")}` : `Locked, ${b.progressLabel}`}`}
      onPress={() => {
        haptic.tap()
        onPress()
      }}
      style={({ pressed }) => [styles.tile, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}
    >
      <View>
        <Medallion emoji={b.icon} color={b.color} size="md" locked={!b.earned} />
        {!b.earned ? (
          <View style={[styles.lock, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Lock size={12} color={colors.mutedForeground} />
          </View>
        ) : b.unseen ? (
          <View style={[styles.newTag, { backgroundColor: colors.destructive }]}>
            <Text variant="small" color="#ffffff" weight="bold" style={styles.newText}>
              NEW
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="label" align="center" numberOfLines={1} style={styles.stretch}>
        {b.name}
      </Text>
      {b.earned ? (
        <>
          <Text variant="small" tone="muted" align="center">
            Earned {formatDate(b.earnedAt, "d MMM yyyy")}
          </Text>
          <TintPill label={RARITY[b.rarity].label} color={r.fg} bg={r.bg} style={styles.center} />
        </>
      ) : (
        <>
          <Text variant="small" tone="muted" align="center" numberOfLines={2}>
            {b.criteria}
          </Text>
          <View style={styles.stretch}>
            <ProgressBar value={b.progress * 100} height={5} />
            <Text variant="small" tone="muted" align="center" style={styles.mt4}>
              {b.progressLabel}
            </Text>
          </View>
        </>
      )}
    </Pressable>
  )
}

function BadgeDetail({ b }: { b: BadgeView }) {
  const { colors, tint } = useTheme()
  const r = tint(RARITY[b.rarity].tint)
  const p = tint("points")
  return (
    <View style={styles.detail}>
      <Medallion emoji={b.icon} color={b.color} size="xl" locked={!b.earned} />
      <View style={styles.pillRow}>
        <TintPill label={RARITY[b.rarity].label} color={r.fg} bg={r.bg} />
        {b.points ? <TintPill label={`+${b.points} points`} icon={Coins} color={p.fg} bg={p.bg} /> : null}
      </View>
      <Card style={styles.stretch}>
        <Text variant="small" tone="muted">
          How to earn it
        </Text>
        <Text variant="subtitle">{b.criteria}</Text>
        {b.earned ? (
          <View style={[styles.rowSm, styles.mt8]}>
            <CircleCheck size={16} color={colors.success} />
            <Text variant="label" tone="success">
              Earned on {formatDate(b.earnedAt, "d MMMM yyyy")}
            </Text>
          </View>
        ) : (
          <View style={styles.mt8}>
            <View style={styles.between}>
              <Text variant="caption" tone="muted">
                Your progress
              </Text>
              <Text variant="label">{Math.round(b.progress * 100)}%</Text>
            </View>
            <ProgressBar value={b.progress * 100} height={9} style={styles.mt4} />
            <Text variant="small" tone="muted" style={styles.mt4}>
              {b.progressLabel}
            </Text>
          </View>
        )}
      </Card>
      <View style={styles.rowSm}>
        <UsersRound size={14} color={colors.mutedForeground} />
        <Text variant="small" tone="muted">
          Unlocked by {formatCompact(b.earnedByCount)} HealthX members
        </Text>
      </View>
    </View>
  )
}

function Badges({ data }: { data: BadgesResult }) {
  const [tab, setTab] = useState<"earned" | "locked">(data.earned ? "earned" : "locked")
  const [selected, setSelected] = useState<BadgeView | null>(null)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const seen = useApiMutation(gamificationApi.markBadgeSeen, { invalidate: [["employee", "badges"]] })
  const earned = data.badges.filter((b) => b.earned).sort((a, b) => (b.earnedAt ?? "").localeCompare(a.earnedAt ?? ""))
  const locked = data.badges.filter((b) => !b.earned).sort((a, b) => b.progress - a.progress)
  const celebrate = data.celebrate && data.celebrate.id !== dismissed ? data.celebrate : null
  const bonus = earned.reduce((a, b) => a + b.points, 0)
  const list = tab === "earned" ? earned : locked

  const closeCelebration = () => {
    if (!data.celebrate) return
    setDismissed(data.celebrate.id)
    seen.mutate({ id: data.celebrate.id })
  }

  return (
    <>
      <GradientCard colors={["#7c3aed", "#d946ef", "#f59e0b"]}>
        <View style={styles.heroRow}>
          <ProgressRing value={data.earned} max={data.total} size={108} stroke={10} color="#ffffff" trackColor="rgba(255,255,255,0.25)" accessibilityLabel={`${data.earned} of ${data.total} badges unlocked`}>
            <Text variant="title" color="#ffffff">
              {data.earned}
            </Text>
            <Text variant="small" color="rgba(255,255,255,0.85)">
              of {data.total}
            </Text>
          </ProgressRing>
          <View style={styles.flex}>
            <Text variant="caption" color="rgba(255,255,255,0.88)">
              Badges unlocked
            </Text>
            <Text variant="subtitle" color="#ffffff" numberOfLines={2}>
              {data.earned && earned[0] ? `${earned[0].icon} Latest: ${earned[0].name}` : "Your first badge awaits"}
            </Text>
            <View style={styles.bonus}>
              <Coins size={14} color="#ffffff" />
              <Text variant="small" color="#ffffff" weight="semibold">
                {bonus} bonus points earned
              </Text>
            </View>
          </View>
        </View>
      </GradientCard>

      <Text variant="heading">Streaks</Text>
      <View style={styles.streaks}>
        {data.streaks.map((s) => {
          const meta = STREAK_META[s.key]
          return (
            <LinearGradient key={s.key} colors={meta.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.streak} accessible accessibilityLabel={`${s.label}: ${s.current} days, best ${s.best}. ${s.hint}`}>
              <Text style={styles.streakEmoji}>{meta.emoji}</Text>
              <meta.icon size={18} color="#ffffff" />
              <Text variant="title" color="#ffffff" style={styles.mt4}>
                {s.current}
                <Text variant="small" color="rgba(255,255,255,0.88)">
                  {" "}
                  days
                </Text>
              </Text>
              <Text variant="small" color="#ffffff" weight="semibold" numberOfLines={1}>
                {s.label}
              </Text>
              <Text variant="small" color="rgba(255,255,255,0.85)">
                Best {s.best}
              </Text>
            </LinearGradient>
          )
        })}
      </View>

      <SegmentedControl
        value={tab}
        onChange={setTab}
        accessibilityLabel="Badges"
        options={[
          { value: "earned", label: `Earned (${earned.length})` },
          { value: "locked", label: `Locked (${locked.length})` },
        ]}
      />
      {list.length ? (
        <View style={styles.grid}>
          {list.map((b) => (
            <View key={b.id} style={styles.cell}>
              <BadgeTile b={b} onPress={() => setSelected(b)} />
            </View>
          ))}
        </View>
      ) : tab === "earned" ? (
        <EmptyState icon={Award} title="Complete your first workout to earn your first badge." description="Locked badges show what to do next." action={{ label: "See locked badges", onPress: () => setTab("locked") }} />
      ) : (
        <EmptyState icon={Sparkles} title="You've unlocked every badge!" description="Legendary. New badges will appear here when they're added." />
      )}

      <BottomSheet open={!!selected} onClose={() => setSelected(null)} title={selected?.name} description={selected?.description}>
        {selected ? <BadgeDetail b={selected} /> : null}
      </BottomSheet>

      {celebrate ? (
        <CelebrationModal open onClose={closeCelebration} emoji={celebrate.icon} color={celebrate.color} eyebrow="Badge unlocked" title={`You unlocked ${celebrate.name}!`} description={celebrate.description} points={celebrate.points}>
          <Button title="View badges" onPress={closeCelebration} testID="celebration-view" />
          <Button title="Close" variant="ghost" onPress={closeCelebration} />
        </CelebrationModal>
      ) : null}
    </>
  )
}

export default function BadgesScreen() {
  const q = useApiQuery(["employee", "badges"], () => gamificationApi.badges())
  return (
    <Screen title="Badges & achievements" back backHref="/profile" refreshing={q.isRefetching} onRefresh={() => q.refetch()} testID="badges-screen">
      {q.data ? (
        <Badges data={q.data} />
      ) : q.error ? (
        <ErrorState title="Couldn't load badges." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : (
        <>
          <Skeleton height={150} radius={RADIUS.xxl} />
          <Skeleton height={120} radius={RADIUS.xl} />
          <Skeleton height={320} radius={RADIUS.xl} />
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 6 },
  stretch: { alignSelf: "stretch" },
  center: { alignSelf: "center" },
  mt4: { marginTop: 4 },
  mt8: { marginTop: 8 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.97 }] },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  bonus: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  streaks: { flexDirection: "row", gap: 10, marginTop: -6 },
  streak: { flex: 1, borderRadius: RADIUS.xl, padding: 12, overflow: "hidden", minWidth: 0 },
  streakEmoji: { position: "absolute", right: -6, bottom: -10, fontSize: 48, lineHeight: 60, opacity: 0.25 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 },
  cell: { width: "50%", padding: 5 },
  tile: { alignItems: "center", gap: 6, borderRadius: RADIUS.xl, borderWidth: StyleSheet.hairlineWidth, padding: 14, minHeight: 200 },
  lock: { position: "absolute", right: -4, bottom: -4, width: 24, height: 24, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  newTag: { position: "absolute", right: -8, top: -4, borderRadius: 999, paddingHorizontal: 6 },
  newText: { fontSize: 10, lineHeight: 14 },
  detail: { alignItems: "center", gap: 16 },
  pillRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  rowSm: { flexDirection: "row", alignItems: "center", gap: 6 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
})
