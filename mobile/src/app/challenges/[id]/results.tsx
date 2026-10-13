/** SCR-M-047 Challenge Results — final rank / completion, points, reward, podium, next challenges, #355 completion certificate. */
import { LinearGradient } from "expo-linear-gradient"
import { useLocalSearchParams } from "expo-router"
import { Award, Coins, Gift, Hourglass, Medal, Target, Trophy, UsersRound } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { CertificateSheet, ChallengeCard, PrizesCard } from "@/components/engage/challenge-ui"
import { Podium } from "@/components/engage/leaderboard"
import { alpha, Confetti, EmojiTile, go, Medallion, PopIn, TintPill } from "@/components/engage/shared"
import { Button, Card, EmptyState, ErrorState, IconTile, ProgressBar, Screen, SectionHeader, Skeleton, StatTile, Text } from "@/components/ui"
import { challengesApi, formatMetricValue, type ChallengeResults } from "@/lib/api/employee/challenges"
import { useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber } from "@/lib/format"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

function Results({ r }: { r: ChallengeResults }) {
  const { colors, tint } = useTheme()
  const c = r.challenge
  const [certOpen, setCertOpen] = useState(false)
  const won = r.pointsEarned > 0 && !r.finalising
  const medal = r.finalRank === 1 ? "🥇" : r.finalRank === 2 ? "🥈" : r.finalRank === 3 ? "🥉" : won ? "🏆" : r.joined ? "🎯" : c.coverEmoji
  const fmt = (v: number) => formatMetricValue(v, c.metric, false)
  const pts = tint("points")

  return (
    <>
      {r.finalising ? (
        <View style={[styles.banner, { backgroundColor: pts.bg, borderColor: alpha("#f59e0b", 0.3) }]}>
          <IconTile icon={Hourglass} tint="points" />
          <Text variant="caption" style={styles.flex}>
            <Text variant="label">Finalising. </Text>
            Results are being finalised while late data syncs (until {formatDate(r.finalisingUntil, "d MMM")}). Positions may still change.
          </Text>
        </View>
      ) : null}

      <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <LinearGradient colors={[alpha(c.coverColor, 0.28), alpha(c.coverColor, 0)]} style={styles.heroGlow} />
        {won ? <Confetti pieces={44} height={420} /> : null}
        <PopIn>
          <Medallion emoji={medal} color={won ? "#f59e0b" : c.coverColor} size="xl" />
        </PopIn>
        <Text variant="overline" tone="muted" align="center">
          {c.coverEmoji} {c.name} · ended {formatDate(c.endDate, "d MMM")}
        </Text>
        <Text variant="title" align="center">
          {r.headline}
        </Text>
        <Text variant="body" tone="muted" align="center">
          {!r.joined
            ? "You didn't take part in this one — join the next challenge below."
            : r.outcome === "completed"
              ? "You reached the target — brilliant effort."
              : r.outcome === "not_completed"
                ? "You didn't quite reach the target this time."
                : r.outcome === "won"
                  ? "Your group had the best average per person."
                  : "Thanks for taking part!"}
        </Text>
        {r.pointsEarned ? <TintPill label={`+${r.pointsEarned} points ${r.finalising ? "(pending)" : "earned"}`} icon={Coins} color={pts.fg} bg={pts.bg} style={styles.center} /> : null}
        {r.certificate ? <Button title="Download certificate" icon={Award} variant="outline" size="md" onPress={() => setCertOpen(true)} style={styles.center} testID="certificate-button" /> : null}
      </View>

      {r.joined ? (
        <>
          <View style={styles.tiles}>
            <StatTile icon={Trophy} tint="points" label={`Final rank of ${formatNumber(r.participants)}`} value={r.finalRank ? `#${r.finalRank}` : "—"} />
            <StatTile icon={Medal} tint="habits" label={`Final total · ${c.unit}`} value={fmt(r.finalTotal)} />
          </View>
          <View style={styles.tiles}>
            <StatTile icon={Target} tint="steps" label={`Target · ${c.unit}`} value={c.metric === "custom" ? formatNumber(c.target) : fmt(c.target)} />
            <StatTile
              icon={UsersRound}
              tint="workout"
              label={c.type === "collaborative" ? "Company goal reached" : "Of target"}
              value={c.type === "collaborative" ? (r.collaborative?.reached ? "Yes" : "No") : `${Math.min(100, Math.round((r.finalTotal / c.target) * 100))}%`}
            />
          </View>
        </>
      ) : null}

      {r.group ? (
        <Card>
          <View style={styles.row}>
            <IconTile icon={UsersRound} tint="sleep" size={46} />
            <View style={styles.flex}>
              <Text variant="caption" tone="muted">
                Your {c.teamUnit ?? "department"}
              </Text>
              <Text variant="subtitle">
                {r.group.name} finished #{r.group.rank} of {r.group.total}
              </Text>
            </View>
            {r.group.rank === 1 ? <Text style={styles.trophy}>🏆</Text> : null}
          </View>
        </Card>
      ) : null}

      {r.collaborative ? (
        <Card>
          <Text variant="subtitle">Company goal</Text>
          <Text variant="caption" tone="muted" style={styles.mt6}>
            <Text variant="heading">{fmt(r.collaborative.total)}</Text> / {formatMetricValue(r.collaborative.goal, c.metric)}
          </Text>
          <ProgressBar value={Math.min(100, (r.collaborative.total / r.collaborative.goal) * 100)} height={9} style={styles.mt8} />
          <Text variant="caption" tone="muted" style={styles.mt8}>
            {r.collaborative.reached ? "Goal reached together 🎉" : "The company fell short of the shared goal this time."}
          </Text>
        </Card>
      ) : null}

      {r.reward ? (
        <Card>
          <View style={styles.row}>
            <EmojiTile emoji={r.reward.emoji} color={r.reward.color} size={56} />
            <View style={styles.flex}>
              <View style={styles.rowSm}>
                <Gift size={13} color={colors.mutedForeground} />
                <Text variant="small" tone="muted">
                  {r.reward.earned ? "Reward earned" : "Challenge reward"}
                </Text>
              </View>
              <Text variant="subtitle">{r.reward.name}</Text>
              <Text variant="caption" tone="muted">
                {r.reward.earned ? "Your company will arrange delivery — track it in My Orders." : "Awarded to participants who hit the target."}
              </Text>
            </View>
          </View>
          <Button title="View reward" variant={r.reward.earned ? "primary" : "outline"} size="md" block style={styles.mt12} onPress={() => go(r.reward!.earned ? "/orders" : `/rewards/${r.reward!.id}`)} />
        </Card>
      ) : null}

      {r.prizes ? <PrizesCard prizes={r.prizes} /> : null}

      {r.podium.length ? (
        <>
          <SectionHeader title="Top 3" action={{ label: "View leaderboard", onPress: () => go(`/challenges/${c.id}/leaderboard`) }} />
          <Podium entries={r.podium} unit={c.unit} valueFormatter={fmt} />
        </>
      ) : null}

      <SectionHeader title="Join your next challenge" action={{ label: "See all", onPress: () => go("/challenges?tab=available") }} />
      {r.suggestions.length ? (
        <View style={styles.list}>
          {r.suggestions.map((s) => (
            <ChallengeCard key={s.id} c={s} href={`/challenges/${s.id}`} compact />
          ))}
        </View>
      ) : (
        <Card>
          <EmptyState compact icon={Trophy} title="No challenges open right now – check back soon." />
        </Card>
      )}

      {r.certificate ? <CertificateSheet certificate={r.certificate} color={c.coverColor} open={certOpen} onClose={() => setCertOpen(false)} /> : null}
    </>
  )
}

export default function ChallengeResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const q = useApiQuery(["employee", "challenge", id, "results"], () => challengesApi.results({ id }), { enabled: !!id, retry: (n, e) => e.status !== 409 && n < 1 })
  return (
    <Screen title="Results" back backHref="/challenges?tab=completed" refreshing={q.isRefetching} onRefresh={() => q.refetch()} testID="challenge-results">
      {q.data ? (
        <Results r={q.data} />
      ) : q.error ? (
        q.error.status === 409 ? (
          <EmptyState icon={Hourglass} title="This challenge is still running" description="Results are available once the challenge ends." action={{ label: "View progress", onPress: () => go(`/challenges/${id}/progress`) }} />
        ) : (
          <ErrorState title="Couldn't load the results." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
        )
      ) : (
        <>
          <Skeleton height={340} radius={RADIUS.xxl} />
          <Skeleton height={160} radius={RADIUS.xl} />
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignSelf: "center" },
  banner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: RADIUS.xl, borderWidth: 1 },
  hero: { borderRadius: RADIUS.xxl, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingTop: 30, paddingBottom: 22, alignItems: "center", gap: 10, overflow: "hidden" },
  heroGlow: { position: "absolute", left: 0, right: 0, top: 0, height: 240 },
  tiles: { flexDirection: "row", gap: 10, marginTop: -4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowSm: { flexDirection: "row", alignItems: "center", gap: 4 },
  trophy: { fontSize: 30, lineHeight: 36 },
  mt6: { marginTop: 6 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  list: { gap: 14 },
})
