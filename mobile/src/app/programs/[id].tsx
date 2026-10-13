/** SCR-M-065 Program Detail & Progress (Phase 2) — weeks and goals with live progress, join / leave, completion celebration. */
import { useLocalSearchParams } from "expo-router"
import { Ban, Building2, CalendarRange, CircleCheckBig, Coins, FileX, LogOut, ShieldCheck, Sparkles, Trophy, Users } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { dateRange, WeekCard } from "@/components/engage/grow"
import { alpha, CelebrationModal, go, GradientCard, OnColorPill } from "@/components/engage/shared"
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, PhaseBadge, ProgressRing, Screen, Skeleton, Text } from "@/components/ui"
import { programsApi, type ProgramDetail } from "@/lib/api/employee/programs"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber, formatShortDate } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

function Summary({ p }: { p: ProgramDetail }) {
  const { colors, tint } = useTheme()
  const [leaveOpen, setLeaveOpen] = useState(false)
  const join = useApiMutation(programsApi.enrol, {
    success: (r) => `You've joined the ${r.name}.`,
    errorTitle: "Couldn't join",
    onSuccess: () => haptic.success(),
  })
  const leave = useApiMutation(programsApi.leave, { success: "You've left the program.", onSuccess: () => setLeaveOpen(false), onError: () => setLeaveOpen(false) })
  const pct = Math.round(p.progress * 100)
  const pts = tint("points")

  if (p.enrolled)
    return (
      <Card>
        <View style={styles.row}>
          <ProgressRing value={pct} size={104} stroke={10} color={p.achieved ? colors.success : p.coverColor} accessibilityLabel={`${pct}% overall`}>
            <Text variant="heading">{pct}%</Text>
            <Text variant="small" tone="muted">
              overall
            </Text>
          </ProgressRing>
          <View style={styles.flex}>
            {p.achieved ? (
              <View style={styles.rowSm}>
                <CircleCheckBig size={16} color={colors.success} />
                <Text variant="label" tone="success">
                  Completed
                </Text>
              </View>
            ) : (
              <Text variant="heading">{p.currentWeek ? `Week ${p.currentWeek} of ${p.durationWeeks}` : `Starts ${p.startDate ? formatShortDate(p.startDate) : "soon"}`}</Text>
            )}
            <Text variant="caption" tone="muted">
              <Text variant="label">
                {p.goalsDone} of {p.goalsTotal}
              </Text>{" "}
              goals done
            </Text>
            {p.enrolledAt ? (
              <Text variant="small" tone="muted">
                Joined {formatDate(p.enrolledAt)}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={[styles.reward, { backgroundColor: pts.bg }]}>
          <Trophy size={18} color={pts.fg} />
          <Text variant="caption" style={styles.flex}>
            {p.achieved ? (
              <>
                You earned <Text variant="label">{formatNumber(p.pointsAwarded || p.completionPoints)} points</Text>
                {p.completedAt ? ` on ${formatDate(p.completedAt)}` : ""}.
              </>
            ) : (
              <>
                Finish every weekly goal to earn <Text variant="label">{formatNumber(p.completionPoints)} points</Text>.
              </>
            )}
          </Text>
        </View>
        {p.achieved ? (
          <Button title="See my points" variant="outline" size="md" block style={styles.mt12} onPress={() => go("/wallet")} />
        ) : (
          <Button title="Leave program" icon={LogOut} variant="ghost" size="md" block style={styles.mt8} loading={leave.isPending} onPress={() => setLeaveOpen(true)} />
        )}
        <ConfirmDialog
          open={leaveOpen}
          title="Leave this program?"
          message="Your progress will stop being tracked here. You can join again later while the program is open."
          confirmLabel="Leave program"
          destructive
          loading={leave.isPending}
          onCancel={() => setLeaveOpen(false)}
          onConfirm={() => leave.mutate({ id: p.id })}
        />
      </Card>
    )

  return (
    <Card>
      <Text variant="heading">Join this program</Text>
      <Text variant="caption" tone="muted" style={styles.mt4}>
        {p.kind === "healthx"
          ? `Self-paced — your ${p.durationWeeks} weeks start the day you join.`
          : p.startDate && p.currentWeek > 0
            ? `Runs ${dateRange(p.startDate, p.endDate)}. It's in week ${p.currentWeek} — your tracked data from the start counts.`
            : `Starts ${p.startDate ? formatDate(p.startDate) : "soon"} and runs for ${p.durationWeeks} weeks.`}
      </Text>
      <View style={styles.benefits}>
        {["A clear goal for every week", "Progress tracked from your steps, water, workouts and sleep", `${formatNumber(p.completionPoints)} points when you finish`].map((b) => (
          <View key={b} style={styles.rowSm}>
            <CircleCheckBig size={16} color={colors.primary} />
            <Text variant="caption" style={styles.flex}>
              {b}
            </Text>
          </View>
        ))}
      </View>
      {p.eligible ? <Button title="Join program" loading={join.isPending} onPress={() => join.mutate({ id: p.id })} feedback="none" style={styles.mt12} testID="join-program" /> : null}
      {!p.eligible || join.error ? (
        <View style={[styles.blocked, { backgroundColor: colors.destructiveSoft }]} accessibilityRole="alert">
          <Ban size={16} color={colors.destructive} />
          <View style={styles.flex}>
            <Text variant="label" tone="destructive">
              You can&apos;t join this program.
            </Text>
            <Text variant="small" tone="muted">
              {p.ineligibleReason ?? (join.error && join.error.message !== "You can't join this program." ? join.error.message : "It isn't open to you right now.")}
            </Text>
          </View>
        </View>
      ) : null}
    </Card>
  )
}

function Detail({ p }: { p: ProgramDetail }) {
  const { colors } = useTheme()
  const [dismissed, setDismissed] = useState(false)
  const ack = useApiMutation(programsApi.acknowledgeCompletion, { invalidate: false })
  const range = dateRange(p.startDate, p.endDate)
  const close = () => {
    setDismissed(true)
    ack.mutate({ id: p.id })
  }
  return (
    <>
      <GradientCard colors={[p.coverColor, alpha(p.coverColor, 0.7)]} emoji={p.coverEmoji}>
        <View style={styles.pills}>
          <OnColorPill label={p.kind === "company" ? `${p.companyName ?? "Company"} program` : "HealthX · self-paced"} icon={p.kind === "company" ? Building2 : Sparkles} dark />
        </View>
        <Text variant="title" color="#ffffff" style={styles.mt8}>
          {p.name}
        </Text>
        <Text variant="caption" color="rgba(255,255,255,0.92)" style={styles.mt4}>
          {p.description}
        </Text>
        <View style={[styles.pills, styles.mt12]}>
          <OnColorPill label={`${p.durationWeeks} weeks${range ? ` · ${range}` : ""}`} icon={CalendarRange} />
          <OnColorPill label={`${formatNumber(p.enrolledCount)} joined`} icon={Users} />
          <OnColorPill label={`${formatNumber(p.completionPoints)} pts`} icon={Coins} />
        </View>
      </GradientCard>

      <Summary p={p} />
      <View style={styles.privacy}>
        <ShieldCheck size={14} color={colors.success} />
        <Text variant="small" tone="muted" style={styles.flex}>
          Only you can see your progress. Your company only sees how many people joined and finished.
        </Text>
      </View>

      <View>
        <Text variant="heading">{p.enrolled ? "Your weekly goals" : "What you'll do each week"}</Text>
        <Text variant="caption" tone="muted">
          {p.enrolled ? "Progress updates from your Activity, Water, Workouts and Sleep data. Tap a goal to open it." : "Weeks unlock in order. Your tracked data counts automatically once you join."}
        </Text>
      </View>
      {p.weeks.map((w) => (
        <WeekCard key={w.week} week={w} tracking={p.enrolled} selfPaced={p.kind === "healthx"} />
      ))}

      <CelebrationModal open={p.celebrate && !dismissed} onClose={close} emoji={p.coverEmoji} color={p.coverColor} eyebrow="Program complete" title="You did it! 🎉" description={`You completed every weekly goal of ${p.name}.`} points={p.pointsAwarded}>
        <Button
          title="See my points"
          onPress={() => {
            close()
            go("/wallet")
          }}
        />
        <Button title="Done" variant="ghost" onPress={close} />
      </CelebrationModal>
    </>
  )
}

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const q = useApiQuery(["employee", "programs", "detail", id], () => programsApi.get({ id }), { enabled: !!id, retry: (n, e) => e.status !== 404 && n < 1 })
  return (
    <Screen title="Program" back backHref="/programs" right={<PhaseBadge phase={2} />} refreshing={q.isRefetching} onRefresh={() => q.refetch()} testID="program-detail">
      {q.data ? (
        <Detail p={q.data} />
      ) : q.error ? (
        q.error.status === 404 ? (
          <EmptyState icon={FileX} title="This program isn't available." description="It may have ended or isn't open to you." action={{ label: "See all programs", onPress: () => go("/programs") }} />
        ) : (
          <ErrorState title="Couldn't load this program." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
        )
      ) : (
        <>
          <Skeleton height={220} radius={RADIUS.xxl} />
          <Skeleton height={180} radius={RADIUS.xl} />
          <Skeleton height={200} radius={RADIUS.xl} />
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 4 },
  mt4: { marginTop: 4 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  rowSm: { flexDirection: "row", alignItems: "center", gap: 8 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  reward: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: RADIUS.lg, marginTop: 14 },
  benefits: { gap: 8, marginTop: 12 },
  blocked: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: RADIUS.lg, marginTop: 12 },
  privacy: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: -6 },
})
