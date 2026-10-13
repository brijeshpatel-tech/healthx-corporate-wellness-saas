/** SCR-M-043 Challenge Detail — rules, dates, target, reward, prizes (#359), warm-up (#358), journey (#374), mini-challenges (#350); join / leave. */
import { useLocalSearchParams } from "expo-router"
import { ChartColumn, Check, CircleCheck, Clock, Coins, Gift, Info, ListChecks, LogOut, Medal, ShieldAlert, Sparkles, Target, UsersRound } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import {
  ChallengeHero,
  Countdown,
  GetReadyCard,
  InviteCodeCard,
  isOpen,
  JourneyCard,
  METRIC_ICON,
  MiniChallengesCard,
  PrizesCard,
  targetText,
} from "@/components/engage/challenge-ui"
import { alpha, Confetti, EmojiTile, go, PopIn, TintPill, WHITE_85 } from "@/components/engage/shared"
import { Avatar, Button, Card, ConfirmDialog, EmptyState, ErrorState, IconTile, ProgressBar, Screen, Skeleton, Text } from "@/components/ui"
import { challengesApi, formatMetricValue, type ChallengeDetail } from "@/lib/api/employee/challenges"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import { useTheme } from "@/theme/theme"
import { RADIUS, type TintName } from "@/theme/tokens"

function Fact({ icon, tint, label, value }: { icon: typeof Clock; tint: TintName; label: string; value: string }) {
  const { colors } = useTheme()
  return (
    <View style={[styles.fact, { borderColor: colors.border }]}>
      <IconTile icon={icon} tint={tint} size={34} />
      <View style={styles.flex}>
        <Text variant="small" tone="muted">
          {label}
        </Text>
        <Text variant="label">{value}</Text>
      </View>
    </View>
  )
}

function Detail({ c, justJoined, onLeave, leaving }: { c: ChallengeDetail; justJoined: boolean; onLeave: () => void; leaving: boolean }) {
  const { colors, tint } = useTheme()
  const Icon = METRIC_ICON[c.metric]
  const pct = c.myProgress !== null && c.target ? Math.min(100, (c.myProgress / c.target) * 100) : 0
  const live = c.phase === "live"
  const pts = tint("points")
  const early = c.phase === "upcoming" || c.phase === "warmup"

  return (
    <>
      <ChallengeHero c={c} subtitle={`${formatDate(c.startDate, "d MMM")} – ${formatDate(c.endDate, "d MMM yyyy")} · ${c.totalDays} days`}>
        {isOpen(c.phase) ? (
          <View style={styles.gap8}>
            <Text variant="overline" color={WHITE_85}>
              {c.phase === "upcoming" ? "Starts in" : c.phase === "warmup" ? "Warm-up · scoring starts in" : "Ends in"}
            </Text>
            <Countdown to={c.phase === "upcoming" ? c.startDate : c.phase === "warmup" ? (c.warmUp?.scoringStart ?? c.startDate) : c.endDate} endOfDay={live} />
          </View>
        ) : (
          <View style={styles.endedBox}>
            <Text variant="caption" color="#ffffff">
              {c.phase === "finalising" ? `Results are being finalised while late data syncs (until ${formatDate(c.finalisingUntil, "d MMM")}).` : `This challenge ended on ${formatDate(c.endDate)}.`}
            </Text>
          </View>
        )}
      </ChallengeHero>

      {justJoined && c.joined ? (
        <View style={[styles.joined, { borderColor: alpha("#10b981", 0.35), backgroundColor: alpha("#10b981", 0.08) }]}>
          <Confetti pieces={30} height={200} />
          <PopIn>
            <View style={[styles.check, { backgroundColor: colors.success }]}>
              <Check size={22} color="#ffffff" strokeWidth={3} />
            </View>
          </PopIn>
          <View style={styles.flex}>
            <Text variant="subtitle">You&apos;re in! 🎉</Text>
            <Text variant="caption" tone="muted">
              Your progress starts counting now. You&apos;re #{c.myRank} of {formatNumber(c.participantsCount)} — time to climb.
            </Text>
          </View>
        </View>
      ) : null}

      {c.joined && c.myProgress !== null && c.type !== "collaborative" ? (
        <Card>
          <View style={styles.between}>
            <Text variant="subtitle">Your progress</Text>
            {c.myRank ? <TintPill label={`#${c.myRank} of ${formatNumber(c.participantsCount)}`} color={pts.fg} bg={pts.bg} /> : null}
          </View>
          <Text variant="caption" tone="muted" style={styles.gap8}>
            <Text variant="number">{formatMetricValue(c.myProgress, c.metric, false)}</Text> / {c.metric === "custom" ? `${formatNumber(c.target)} ${c.unit}` : formatMetricValue(c.target, c.metric)}
          </Text>
          <ProgressBar value={pct} height={10} color={c.targetReached ? colors.success : colors.primary} style={styles.gap8} />
          {c.metric === "custom" && live ? <Button title="Check in for today" icon={ListChecks} variant="outline" size="md" block style={styles.gap12} onPress={() => go(`/challenges/${c.id}/check-in`)} /> : null}
        </Card>
      ) : null}

      {early ? <GetReadyCard warmUp={c.warmUp} startDate={c.startDate} joined={c.joined} trackerConnected={c.trackerConnected} phase={c.phase} /> : null}
      {c.journey ? <JourneyCard journey={c.journey} /> : null}
      {c.minis.length ? <MiniChallengesCard minis={c.minis} challengeId={c.id} joinedMain={c.joined} /> : null}

      <Card>
        <Text variant="body">{c.description}</Text>
        <View style={[styles.typeHelp, { backgroundColor: colors.muted }]}>
          <Info size={16} color={colors.primary} style={styles.icon1} />
          <Text variant="caption" tone="muted" style={styles.flex}>
            <Text variant="label">{c.typeLabel} challenge. </Text>
            {c.typeHelp}
          </Text>
        </View>
        <View style={styles.facts}>
          <Fact icon={Icon} tint="habits" label="Target" value={targetText(c)} />
          <Fact icon={Clock} tint="steps" label="Dates" value={`${formatDate(c.startDate, "d MMM")} – ${formatDate(c.endDate, "d MMM yyyy")}`} />
          <Fact icon={UsersRound} tint="workout" label="Who can join" value={c.audienceLabel} />
          <Fact icon={Target} tint="points" label="Created by" value={c.createdBy} />
        </View>
      </Card>

      <Card>
        <View style={styles.rowCenter}>
          <View style={[styles.coins, { backgroundColor: pts.bg }]}>
            <Coins size={22} color={pts.fg} />
          </View>
          <View style={styles.flex}>
            <Text variant="heading">+{c.points} points</Text>
            <Text variant="caption" tone="muted">
              {c.type === "team" ? "For every member of the winning group" : c.type === "leaderboard" ? "For the top 10 finishers" : c.type === "collaborative" ? "For everyone if the company goal is reached" : "When you reach the target"}
            </Text>
          </View>
        </View>
        {c.rewardDetail ? (
          <Card flat padding={12} onPress={() => go(`/rewards/${c.rewardDetail!.id}`)} style={[styles.rewardRow, { borderColor: colors.border }]} accessibilityLabel={`Plus a reward: ${c.rewardDetail.name}`}>
            <View style={styles.rowCenter}>
              <EmojiTile emoji={c.rewardDetail.emoji} color={c.rewardDetail.color} size={44} />
              <View style={styles.flex}>
                <View style={styles.rowCenterSm}>
                  <Gift size={13} color={colors.mutedForeground} />
                  <Text variant="small" tone="muted">
                    Plus a reward
                  </Text>
                </View>
                <Text variant="label" numberOfLines={1}>
                  {c.rewardDetail.name}
                </Text>
              </View>
            </View>
          </Card>
        ) : null}
      </Card>

      {c.prizes ? <PrizesCard prizes={c.prizes} /> : null}

      <Card>
        <Text variant="subtitle">Participants</Text>
        <View style={[styles.rowCenter, styles.gap8]}>
          <View style={styles.faces}>
            {c.faces.map((f, i) => (
              <View key={i} style={[styles.face, { borderColor: colors.card, marginLeft: i ? -10 : 0 }]}>
                <Avatar name={f.masked ? "?" : f.name} color={f.color} size={32} />
              </View>
            ))}
          </View>
          <Text variant="caption" tone="muted" style={styles.flex}>
            <Text variant="label">{formatNumber(c.participantsCount)}</Text> of {formatNumber(c.eligibleCount)} eligible joined
          </Text>
        </View>
        <ProgressBar value={c.eligibleCount ? (c.participantsCount / c.eligibleCount) * 100 : 0} height={6} style={styles.gap12} />
        {!c.joined ? <Button title="View leaderboard" variant="ghost" size="sm" iconRight={Medal} onPress={() => go(`/challenges/${c.id}/leaderboard`)} style={styles.gap8} /> : null}
      </Card>

      <Card>
        <Text variant="subtitle">Rules</Text>
        <View style={styles.rules}>
          {[...c.rules, `Late-synced data counts for ${c.graceDays} days after the end date — results are final after that.`, "Only data recorded after you join counts towards your total."].map((r) => (
            <View key={r} style={styles.rule}>
              <CircleCheck size={16} color={colors.primary} style={styles.icon1} />
              <Text variant="caption" tone="muted" style={styles.flex}>
                {r}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {isOpen(c.phase) ? <InviteCodeCard code={c.joinCode} name={c.name} /> : null}

      {c.canLeave ? <Button title="Leave challenge" icon={LogOut} variant="ghost" onPress={onLeave} loading={leaving} testID="leave-challenge" /> : null}

    </>
  )
}

/** Sticky actions above the home indicator. */
function Actions({ c, onJoin, joining }: { c: ChallengeDetail; onJoin: () => void; joining: boolean }) {
  const { tint } = useTheme()
  const ended = c.phase === "ended" || c.phase === "finalising"
  if (c.joined)
    return (
      <View style={styles.row2}>
        <Button
          title={ended ? "View results" : "View progress"}
          icon={ended ? Medal : ChartColumn}
          size="md"
          block
          style={styles.flex}
          onPress={() => go(ended ? `/challenges/${c.id}/results` : `/challenges/${c.id}/progress`)}
          testID="view-progress"
        />
        <Button title="Leaderboard" icon={Medal} variant="outline" size="md" block style={styles.flex} onPress={() => go(`/challenges/${c.id}/leaderboard`)} />
      </View>
    )
  if (c.canJoin) return <Button title="Join challenge" icon={Sparkles} onPress={onJoin} loading={joining} feedback="none" testID="join-challenge" />
  const w = tint("points")
  return (
    <View style={[styles.blocked, { backgroundColor: w.bg }]}>
      <ShieldAlert size={18} color={w.fg} />
      <Text variant="caption" color={w.fg} style={styles.flex}>
        {c.joinBlockedReason ?? "This challenge is no longer open to join."}
      </Text>
    </View>
  )
}

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const q = useApiQuery(["employee", "challenge", id], () => challengesApi.detail({ id }), { enabled: !!id })
  const [justJoined, setJustJoined] = useState(false)
  const [confirm, setConfirm] = useState<"join" | "leave" | null>(null)
  const join = useApiMutation(challengesApi.join, {
    onSuccess: () => {
      setConfirm(null)
      setJustJoined(true)
      haptic.success()
      toast.success("You've joined! Your progress starts counting now.")
    },
    onError: () => setConfirm(null),
  })
  const leave = useApiMutation(challengesApi.leave, {
    success: "You've left the challenge.",
    onSuccess: () => {
      setConfirm(null)
      setJustJoined(false)
    },
    onError: () => setConfirm(null),
  })
  const c = q.data
  const early = c?.phase === "upcoming" || c?.phase === "warmup"
  return (
    <Screen
      title="Challenge"
      back
      backHref="/challenges"
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      footer={c ? <Actions c={c} joining={join.isPending} onJoin={() => setConfirm("join")} /> : undefined}
      testID="challenge-detail"
    >
      {c ? (
        <Detail c={c} justJoined={justJoined} onLeave={() => setConfirm("leave")} leaving={leave.isPending} />
      ) : q.error ? (
        q.error.status === 404 ? (
          <EmptyState icon={Medal} title="This challenge is no longer available." description="It may have been removed or isn't open to you." action={{ label: "Browse challenges", onPress: () => go("/challenges") }} />
        ) : (
          <ErrorState title="Couldn't load this challenge." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
        )
      ) : (
        <>
          <Skeleton height={230} radius={RADIUS.xxl} />
          <Skeleton height={120} radius={RADIUS.xl} />
          <Skeleton height={260} radius={RADIUS.xl} />
        </>
      )}

      {c ? (
        <>
          <ConfirmDialog
            open={confirm === "join"}
            title={`Join ${c.name}?`}
            message={
              early
                ? `You'll be in from day one — scoring starts on ${formatDate(c.warmUp?.scoringStart ?? c.startDate, "d MMM")}. Progress syncs automatically from your phone.`
                : "Your progress starts counting from today. Activity from before you join doesn't count."
            }
            confirmLabel="Join challenge"
            loading={join.isPending}
            onCancel={() => setConfirm(null)}
            onConfirm={() => join.mutate({ id: c.id })}
          />
          <ConfirmDialog
            open={confirm === "leave"}
            title={`Leave ${c.name}?`}
            message="Your progress and position in this challenge will be removed. You can join again while it's open, but your progress will start again from zero."
            confirmLabel="Leave challenge"
            destructive
            loading={leave.isPending}
            onCancel={() => setConfirm(null)}
            onConfirm={() => leave.mutate({ id: c.id })}
          />
        </>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap8: { marginTop: 8, gap: 8 },
  gap12: { marginTop: 12 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowCenterSm: { flexDirection: "row", alignItems: "center", gap: 4 },
  row2: { flexDirection: "row", gap: 10 },
  endedBox: { backgroundColor: "rgba(0,0,0,0.16)", borderRadius: RADIUS.md, padding: 10 },
  joined: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: RADIUS.xl, padding: 14, overflow: "hidden" },
  check: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  typeHelp: { flexDirection: "row", gap: 10, padding: 12, borderRadius: RADIUS.lg, marginTop: 12 },
  icon1: { marginTop: 1 },
  facts: { gap: 8, marginTop: 12 },
  fact: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 10 },
  coins: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  rewardRow: { borderWidth: StyleSheet.hairlineWidth, marginTop: 12 },
  faces: { flexDirection: "row" },
  face: { borderWidth: 2, borderRadius: 18 },
  rules: { gap: 10, marginTop: 10 },
  rule: { flexDirection: "row", gap: 10 },
  blocked: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: RADIUS.lg },
})
