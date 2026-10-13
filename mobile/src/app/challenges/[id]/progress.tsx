/** SCR-M-044 Challenge Progress — my progress vs target, daily breakdown, team / company standings, sync now. */
import { useLocalSearchParams } from "expo-router"
import { CalendarDays, CircleCheck, Flame, Gauge, ListChecks, Medal, PartyPopper, RefreshCw, Sparkles, TrendingUp, Trophy, UsersRound } from "lucide-react-native"
import { StyleSheet, View } from "react-native"
import { ChallengeHero, JourneyCard, MiniChallengesCard } from "@/components/engage/challenge-ui"
import { alpha, go, HeroButton, TintPill, WHITE_85 } from "@/components/engage/shared"
import { BarChart, Button, Card, EmptyState, ErrorState, IconTile, ProgressBar, ProgressRing, Screen, Skeleton, StatTile, Text } from "@/components/ui"
import { challengesApi, formatMetricValue, type ChallengeProgress } from "@/lib/api/employee/challenges"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber, formatPercent, formatRelative, formatShortDate } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

function ProgressView({ p }: { p: ChallengeProgress }) {
  const { colors, tint } = useTheme()
  const c = p.challenge
  const sync = useApiMutation(challengesApi.sync, {
    onSuccess: (r) => {
      haptic.success()
      toast.success(r.targetReached ? "Synced — target reached! 🎉" : `Synced — you're now #${r.rank}`)
    },
    errorTitle: "Sync failed",
  })
  const collaborative = c.type === "collaborative"
  const unitValue = (v: number) => formatMetricValue(v, c.metric, false)
  const days = Math.max(1, p.daily.length)
  const avg = p.daily.reduce((a, d) => a + d.value, 0) / days
  const best = p.daily.reduce((m, d) => (d.value > m.value ? d : m), { date: "", value: 0 })
  const remaining = Math.max(0, p.target - p.progress)
  const pace = c.daysLeft > 0 ? remaining / (c.daysLeft + 1) : remaining

  if (!p.joined)
    return (
      <>
        <ChallengeHero c={c} />
        <EmptyState icon={Trophy} title="You haven't joined this challenge" description="Join to start tracking your progress and climb the leaderboard." action={{ label: "View challenge", onPress: () => go(`/challenges/${c.id}`) }} />
      </>
    )

  const ringValue = collaborative && p.company ? p.company.pct * 100 : p.pct * 100
  const habits = tint("habits")

  return (
    <>
      <ChallengeHero
        c={c}
        subtitle={p.lastSyncedAt ? `↻ Last synced ${formatRelative(p.lastSyncedAt)}` : c.metric === "custom" ? "Self-reported daily check-ins" : "Not synced yet"}
      >
        <View style={styles.heroRow}>
          <ProgressRing value={ringValue} size={118} stroke={11} color="#ffffff" trackColor="rgba(255,255,255,0.25)" accessibilityLabel={`${Math.round(ringValue)}% ${collaborative ? "of the company goal" : "of target"}`}>
            <Text variant="title" color="#ffffff">
              {Math.round(ringValue)}%
            </Text>
            <Text variant="small" color={WHITE_85}>
              {collaborative ? "company goal" : "of target"}
            </Text>
          </ProgressRing>
          <View style={styles.flex}>
            {collaborative && p.company ? (
              <>
                <Text variant="caption" color={WHITE_85}>
                  Company total
                </Text>
                <Text variant="heading" color="#ffffff">
                  {unitValue(p.company.total)}
                </Text>
                <Text variant="small" color={WHITE_85}>
                  of {formatMetricValue(p.company.goal, c.metric)} · you {formatPercent(p.company.contributionPct, 1)}
                </Text>
              </>
            ) : (
              <>
                <Text variant="caption" color={WHITE_85}>
                  My progress
                </Text>
                <Text variant="heading" color="#ffffff">
                  {unitValue(p.progress)}
                </Text>
                <Text variant="small" color={WHITE_85}>
                  of {c.metric === "custom" ? `${formatNumber(p.target)} ${c.unit}` : formatMetricValue(p.target, c.metric)}
                </Text>
              </>
            )}
          </View>
        </View>
        <View style={styles.heroActions}>
          {p.canSync ? <HeroButton title="Sync now" icon={RefreshCw} loading={sync.isPending} onPress={() => sync.mutate({ id: c.id })} testID="sync-now" /> : null}
          {p.checkIn ? <HeroButton title={p.checkIn.todayDone ? "Checked in ✓" : "Check in"} icon={ListChecks} onPress={() => go(`/challenges/${c.id}/check-in`)} /> : null}
          <HeroButton title="Leaderboard" icon={Medal} variant="glass" onPress={() => go(`/challenges/${c.id}/leaderboard`)} />
        </View>
      </ChallengeHero>

      {p.targetReached ? (
        <View style={[styles.banner, { backgroundColor: habits.bg, borderColor: alpha("#10b981", 0.3) }]}>
          <IconTile icon={PartyPopper} tint="habits" />
          <View style={styles.flex}>
            <Text variant="subtitle">Target reached!</Text>
            <Text variant="caption" tone="muted">
              Points will be added when the challenge ends. Keep going to climb the leaderboard.
            </Text>
          </View>
        </View>
      ) : null}

      {c.phase === "upcoming" || c.phase === "warmup" ? (
        <View style={[styles.banner, { backgroundColor: tint("streak").bg, borderColor: alpha("#f97316", 0.3) }]}>
          <IconTile icon={Flame} tint="streak" />
          <View style={styles.flex}>
            <Text variant="subtitle">{c.phase === "warmup" ? "Warm-up period" : "Not started yet"}</Text>
            <Text variant="caption" tone="muted">
              Scoring starts on {formatShortDate(c.warmUp?.scoringStart ?? c.startDate)}. Make sure your tracker is connected so every step counts.
            </Text>
          </View>
        </View>
      ) : null}

      {p.journey ? <JourneyCard journey={p.journey} /> : null}

      <View style={styles.tiles}>
        <StatTile icon={Trophy} tint="points" label={`Rank of ${formatNumber(p.participants)}`} value={p.rank ? `#${p.rank}` : "—"} />
        <StatTile icon={CalendarDays} tint="steps" label={c.phase === "upcoming" ? "Starts in" : `Days left · ends ${formatShortDate(c.endDate)}`} value={c.phase === "upcoming" ? `${c.daysToStart}d` : formatNumber(c.daysLeft)} />
      </View>
      <View style={styles.tiles}>
        <StatTile icon={TrendingUp} tint="workout" label={best.value ? `Daily avg · best ${unitValue(best.value)}` : "Daily average"} value={unitValue(avg)} />
        <StatTile
          icon={Gauge}
          tint="habits"
          label={collaborative ? "People taking part" : p.targetReached ? "Target reached" : "Needed per day"}
          value={collaborative && p.company ? formatNumber(p.company.contributors) : p.targetReached ? "Done ✓" : unitValue(pace)}
        />
      </View>

      <Card>
        <View style={styles.between}>
          <Text variant="subtitle">Daily breakdown</Text>
          <Text variant="small" tone="muted">
            {c.unit}
          </Text>
        </View>
        {p.daily.some((d) => d.value > 0) ? (
          <BarChart
            data={p.daily.slice(-14).map((d) => ({ key: d.date, label: formatDate(d.date, p.daily.length > 7 ? "d" : "EEEEE"), detail: formatDate(d.date, "EEE, d MMM"), value: d.value }))}
            color={c.coverColor}
            dimBelowGoal={false}
            unit={c.metric === "water" ? "ml" : c.unit}
            height={170}
            accessibilityLabel={`${c.unit} per day`}
          />
        ) : (
          <EmptyState compact icon={Sparkles} title="No progress yet – your activity will appear after your next sync." action={p.canSync ? { label: "Sync now", icon: RefreshCw, onPress: () => sync.mutate({ id: c.id }) } : undefined} />
        )}
        {p.daily.length > 14 ? (
          <Text variant="small" tone="muted">
            Showing the last 14 days
          </Text>
        ) : null}
      </Card>

      {p.team ? (
        <Card>
          <View style={styles.rowCenter}>
            <UsersRound size={18} color={colors.primary} />
            <Text variant="subtitle">{p.team.unit === "team" ? "Team standings" : "Department standings"}</Text>
          </View>
          <Text variant="caption" tone="muted" style={styles.mt4}>
            Average {c.unit} per participant — fair for groups of any size.
          </Text>
          <View style={styles.standings}>
            {p.team.rows.map((r, i) => {
              const max = p.team!.rows[0]?.average || 1
              return (
                <View key={r.id} style={[styles.standing, r.isMine && { backgroundColor: colors.primarySoft, borderColor: alpha(colors.primary, 0.3) }]}>
                  <View style={styles.between}>
                    <View style={[styles.rowCenter, styles.flex]}>
                      <Text variant="label" tone="muted" style={styles.rankNo}>
                        {i + 1}
                      </Text>
                      <Text variant="bodyMedium" numberOfLines={1} style={styles.shrink}>
                        {r.name}
                      </Text>
                      {r.isMine ? <TintPill label="Yours" color={colors.primaryForeground} bg={colors.primary} /> : null}
                    </View>
                    <Text variant="label">{unitValue(r.average)}</Text>
                  </View>
                  <ProgressBar value={r.average} max={max} height={7} color={r.isMine ? colors.primary : alpha(colors.primary, 0.45)} />
                  <Text variant="small" tone="muted">
                    {formatNumber(r.members)} participants
                  </Text>
                </View>
              )
            })}
          </View>
        </Card>
      ) : null}

      {p.company && !collaborative ? (
        <Card>
          <Text variant="subtitle">Company progress</Text>
          <Text variant="caption" tone="muted" style={styles.mt4}>
            <Text variant="heading">{unitValue(p.company.total)}</Text> / {formatMetricValue(p.company.goal, c.metric)}
          </Text>
          <ProgressBar value={p.company.pct * 100} height={9} style={styles.mt8} />
          <Text variant="caption" tone="muted" style={styles.mt8}>
            You&apos;ve contributed <Text variant="label">{formatPercent(p.company.contributionPct, 1)}</Text> of the company total.
          </Text>
        </Card>
      ) : null}

      {p.minis.length ? <MiniChallengesCard minis={p.minis} challengeId={c.id} joinedMain={p.joined} /> : null}

      {p.checkIn ? (
        <Card>
          <View style={styles.rowCenter}>
            <IconTile icon={CircleCheck} tint={p.checkIn.todayDone ? "habits" : "neutral"} />
            <View style={styles.flex}>
              <Text variant="subtitle">{p.checkIn.label}</Text>
              <Text variant="caption" tone="muted">
                {p.checkIn.reason ?? (p.checkIn.todayDone ? "You've checked in today — nice work!" : "You haven't checked in today yet.")}
              </Text>
            </View>
          </View>
          <Button title={p.checkIn.canCheckIn ? "Check in" : "History"} variant={p.checkIn.canCheckIn ? "primary" : "outline"} size="md" block style={styles.mt12} onPress={() => go(`/challenges/${c.id}/check-in`)} />
        </Card>
      ) : null}
    </>
  )
}

export default function ChallengeProgressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const q = useApiQuery(["employee", "challenge", id, "progress"], () => challengesApi.progress({ id }), { enabled: !!id })
  return (
    <Screen title="My progress" back backHref={`/challenges/${id}`} refreshing={q.isRefetching} onRefresh={() => q.refetch()} testID="challenge-progress">
      {q.data ? (
        <ProgressView p={q.data} />
      ) : q.error ? (
        <ErrorState title="Couldn't load progress." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : (
        <>
          <Skeleton height={250} radius={RADIUS.xxl} />
          <Skeleton height={90} radius={RADIUS.xl} />
          <Skeleton height={240} radius={RADIUS.xl} />
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  mt4: { marginTop: 4 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  heroActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  banner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: RADIUS.xl, borderWidth: 1 },
  tiles: { flexDirection: "row", gap: 10, marginTop: -4 },
  standings: { gap: 8, marginTop: 12 },
  standing: { gap: 6, padding: 10, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: "transparent" },
  rankNo: { width: 18 },
})
