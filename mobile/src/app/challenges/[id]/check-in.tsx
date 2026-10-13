/** SCR-M-046 Custom Challenge Check-in — one self-reported check-in per day, undo the same day, late check-ins within the dates. */
import { useLocalSearchParams } from "expo-router"
import { Check, CircleDashed, Lock, Undo2 } from "lucide-react-native"
import { useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native"
import { alpha, Confetti, GradientCard, HeroButton, PopIn, WHITE_85 } from "@/components/engage/shared"
import { Card, ConfirmDialog, ErrorState, ProgressBar, Screen, Skeleton, Text } from "@/components/ui"
import { challengesApi, type CheckInState } from "@/lib/api/employee/challenges"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

function CheckIn({ s }: { s: CheckInState }) {
  const { colors } = useTheme()
  const [celebrate, setCelebrate] = useState(0)
  const [backfill, setBackfill] = useState<string | null>(null)
  const checkIn = useApiMutation(challengesApi.checkIn, {
    success: (r) => (r.date === s.today ? "Checked in for today." : `Checked in for ${formatDate(r.date, "d MMM")}.`),
    errorTitle: "Couldn't check in",
    onSuccess: (r) => {
      setBackfill(null)
      if (r.date === s.today) {
        haptic.success()
        setCelebrate((n) => n + 1)
      }
    },
    onError: () => setBackfill(null),
  })
  const undo = useApiMutation(challengesApi.undoCheckIn, { success: "Check-in removed." })
  const pct = s.target ? Math.min(100, (s.total / s.target) * 100) : 0
  const todayRow = s.history.find((h) => h.date === s.today)

  return (
    <>
      <View>
        <GradientCard colors={[s.coverColor, alpha(s.coverColor, 0.7)]} padding={22}>
          <View style={styles.center}>
            <Text style={styles.emoji}>{s.coverEmoji}</Text>
            <Text variant="caption" color={WHITE_85} align="center">
              {s.name}
            </Text>
            <Text variant="title" color="#ffffff" align="center">
              {s.label}
            </Text>
            <Text variant="caption" color={WHITE_85}>
              {formatDate(s.today, "EEEE, d MMMM")}
            </Text>
            {s.open ? (
              s.todayDone ? (
                <View style={styles.center}>
                  <PopIn key={celebrate}>
                    <View style={styles.doneCircle}>
                      <Check size={52} color="#059669" strokeWidth={3} />
                    </View>
                  </PopIn>
                  <Text variant="subtitle" color="#ffffff">
                    You&apos;ve checked in today 🎉
                  </Text>
                  {todayRow?.canUndo ? <HeroButton title="Undo" icon={Undo2} variant="glass" loading={undo.isPending} onPress={() => undo.mutate({ id: s.challengeId, date: s.today })} /> : null}
                </View>
              ) : (
                <View style={styles.center}>
                  <Text variant="subtitle" color="#ffffff" align="center">
                    Did you complete today&apos;s goal?
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Yes, check in for today"
                    disabled={checkIn.isPending}
                    onPress={() => {
                      haptic.tap()
                      checkIn.mutate({ id: s.challengeId })
                    }}
                    style={({ pressed }) => [styles.yes, pressed && styles.pressed]}
                    testID="check-in-today"
                  >
                    {checkIn.isPending ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text variant="heading" color="#ffffff">
                        Yes ✓
                      </Text>
                    )}
                  </Pressable>
                  <Text variant="small" color={WHITE_85}>
                    One check-in per day · self-reported
                  </Text>
                </View>
              )
            ) : (
              <View style={styles.closed}>
                <Lock size={16} color="#ffffff" />
                <Text variant="caption" color="#ffffff" style={styles.shrink}>
                  {s.closedReason}
                </Text>
              </View>
            )}
          </View>
        </GradientCard>
        {celebrate ? <Confetti key={celebrate} pieces={40} height={420} /> : null}
      </View>

      <Card>
        <View style={styles.between}>
          <Text variant="subtitle">Progress</Text>
          <Text variant="caption" tone="muted">
            <Text variant="heading">{formatNumber(s.total)}</Text> / {formatNumber(s.target)} days
          </Text>
        </View>
        <ProgressBar value={pct} height={10} style={styles.mt8} />
        <Text variant="caption" tone="muted" style={styles.mt8}>
          {formatDate(s.startDate, "d MMM")} – {formatDate(s.endDate, "d MMM")} · Missed a day? Tap it below to check in late (within the challenge dates).
        </Text>
      </Card>

      <Card>
        <Text variant="subtitle">Check-in history</Text>
        {s.history.length === 0 ? (
          <Text variant="caption" tone="muted" style={styles.mt8}>
            Your check-ins will appear here once the challenge starts.
          </Text>
        ) : (
          <View style={styles.grid}>
            {s.history.map((h) => {
              const canBackfill = s.open && !h.done && h.date !== s.today
              return (
                <Pressable
                  key={h.date}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatDate(h.date, "d MMM")}: ${h.done ? "checked in" : canBackfill ? "not checked in, tap to check in late" : "not checked in"}`}
                  disabled={!canBackfill}
                  onPress={() => setBackfill(h.date)}
                  style={({ pressed }) => [
                    styles.day,
                    { borderColor: h.done ? alpha("#10b981", 0.45) : colors.border, backgroundColor: h.done ? alpha("#10b981", 0.1) : colors.card },
                    h.date === s.today && { borderColor: colors.primary, borderWidth: 2 },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text variant="small" tone={h.done ? "success" : "muted"}>
                    {formatDate(h.date, "EEE")}
                  </Text>
                  {h.done ? <Check size={16} color={colors.success} strokeWidth={3} /> : <CircleDashed size={16} color={colors.mutedForeground} />}
                  <Text variant="small" tone={h.done ? "success" : "muted"}>
                    {formatDate(h.date, "d MMM")}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        )}
      </Card>

      <ConfirmDialog
        open={!!backfill}
        title={`Check in for ${backfill ? formatDate(backfill, "EEEE, d MMM") : ""}?`}
        message="Only check in if you really completed the goal that day — check-ins are self-reported."
        confirmLabel="Check in"
        loading={checkIn.isPending}
        onCancel={() => setBackfill(null)}
        onConfirm={() => backfill && checkIn.mutate({ id: s.challengeId, date: backfill })}
      />
    </>
  )
}

export default function CheckInScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const q = useApiQuery(["employee", "challenge", id, "check-ins"], () => challengesApi.checkIns({ id }), { enabled: !!id })
  return (
    <Screen title="Daily check-in" back backHref={`/challenges/${id}/progress`} refreshing={q.isRefetching} onRefresh={() => q.refetch()} testID="check-in-screen">
      {q.data ? (
        <CheckIn s={q.data} />
      ) : q.error ? (
        <ErrorState title="Couldn't load check-ins." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : (
        <>
          <Skeleton height={320} radius={RADIUS.xxl} />
          <Skeleton height={200} radius={RADIUS.xl} />
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1 },
  center: { alignItems: "center", gap: 10 },
  emoji: { fontSize: 48, lineHeight: 58 },
  doneCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", marginTop: 6 },
  yes: { width: 116, height: 116, borderRadius: 58, borderWidth: 4, borderColor: "rgba(255,255,255,0.65)", backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center", marginVertical: 6 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  closed: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(0,0,0,0.16)", padding: 10, borderRadius: RADIUS.md, marginTop: 6 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mt8: { marginTop: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  day: { width: "22.5%", flexGrow: 1, maxWidth: "25%", alignItems: "center", gap: 3, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1, minHeight: 72 },
})
