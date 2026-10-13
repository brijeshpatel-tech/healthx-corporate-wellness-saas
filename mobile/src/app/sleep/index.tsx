/** SCR-M-027 Sleep Dashboard (Phase 2) — score, duration, consistency, weekly chart, goal and nights. Sensitive, own data only. */
import { keepPreviousData } from "@tanstack/react-query"
import { router } from "expo-router"
import { Moon, Plus, Watch } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { NightRow, ScheduleChart, SleepGoalSheet, SleepHero } from "@/components/track/sleep-ui"
import { FinePrint, HeaderPhase, PeriodNavigator } from "@/components/track/track-ui"
import { addDays, formatHM, localDate } from "@/components/track/utils"
import { BarChart, Button, Card, EmptyState, ErrorState, IconButton, Screen, SectionHeader, SegmentedControl, Skeleton, Text } from "@/components/ui"
import { sleepApi, type SleepSummary } from "@/lib/api/employee/sleep"
import { useApiQuery } from "@/lib/api/hooks"
import { formatDate } from "@/lib/format"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

function SleepContent({ data, onWeek, loadingWeek }: { data: SleepSummary; onWeek: (start: string | undefined) => void; loadingWeek: boolean }) {
  const { tint, colors } = useTheme()
  const [view, setView] = useState<"duration" | "schedule">("duration")
  const [goalOpen, setGoalOpen] = useState(false)
  const recorded = data.nights.filter((n) => n.record).length

  return (
    <>
      <SleepHero data={data} onEditGoal={() => setGoalOpen(true)} />

      <Card>
        <PeriodNavigator
          label={`${formatDate(`${data.weekStart}T12:00:00`, "d MMM")} – ${formatDate(`${data.weekEnd}T12:00:00`, "d MMM")}`}
          sublabel={data.isCurrentWeek ? "Last 7 nights" : "Nights of"}
          onPrev={() => onWeek(addDays(data.weekStart, -7))}
          onNext={() => {
            const nextStart = addDays(data.weekStart, 7)
            onWeek(addDays(nextStart, 6) >= addDays(localDate(), -1) ? undefined : nextStart)
          }}
          prevDisabled={loadingWeek}
          nextDisabled={data.isCurrentWeek || loadingWeek}
          prevLabel="Previous week"
          nextLabel="Next week"
        />
        <View style={[styles.weekBody, loadingWeek && styles.loading]}>
          <Text variant="caption" tone="muted" align="center">
            Avg{" "}
            <Text variant="label">{data.avgDurationMin ? formatHM(data.avgDurationMin) : "—"}</Text> · goal met{" "}
            <Text variant="label">
              {data.goalMetNights}/{recorded || 7}
            </Text>{" "}
            nights
          </Text>
          <SegmentedControl
            options={[
              { value: "duration", label: "Duration" },
              { value: "schedule", label: "Schedule" },
            ]}
            value={view}
            onChange={setView}
            accessibilityLabel="Chart view"
          />
          {view === "duration" ? (
            <BarChart
              data={data.nights.map((n) => ({
                key: n.nightOf,
                label: formatDate(`${n.nightOf}T12:00:00`, "EEEEE"),
                detail: `Night of ${formatDate(`${n.nightOf}T12:00:00`, "EEE d MMM")}`,
                value: n.record ? n.record.durationMin / 60 : 0,
              }))}
              goal={data.goalHours}
              goalLabel="Goal"
              color={tint("sleep").fg}
              format={(v) => (v ? formatHM(Math.round(v * 60)) : "—")}
              height={180}
              accessibilityLabel="Hours slept each night this week"
            />
          ) : (
            <ScheduleChart data={data} />
          )}
        </View>
      </Card>

      <SectionHeader title="Nights" subtitle="Tap a manual entry to edit it. Synced sleep is read-only." />
      <Card padding={4}>
        {[...data.nights].reverse().map((n, i) => (
          <View key={n.nightOf}>
            {i > 0 ? <View style={[styles.sep, { backgroundColor: colors.border }]} /> : null}
            <NightRow record={n.record} nightOf={n.nightOf} goalMin={data.goalHours * 60} />
          </View>
        ))}
      </Card>

      <SleepGoalSheet key={`${goalOpen}-${data.goalHours}`} open={goalOpen} onClose={() => setGoalOpen(false)} current={data.goalHours} />
    </>
  )
}

export default function SleepScreen() {
  const [weekStart, setWeekStart] = useState<string | undefined>(undefined)
  const q = useApiQuery(["employee", "sleep", "summary", weekStart ?? "current"], () => sleepApi.summary({ weekStart }), { placeholderData: keepPreviousData })

  return (
    <Screen
      title="Sleep"
      back
      right={
        <>
          <HeaderPhase />
          <IconButton icon={Plus} variant="primary" accessibilityLabel="Log sleep" onPress={() => router.push("/sleep/log")} testID="log-sleep" />
        </>
      }
      refreshing={q.isRefetching && !q.isPlaceholderData}
      onRefresh={() => q.refetch()}
      testID="sleep-screen"
    >
      {!q.data ? (
        q.error ? (
          <ErrorState title="Couldn't load sleep data." onRetry={() => q.refetch()} retrying={q.isFetching} />
        ) : (
          <>
            <Skeleton height={330} radius={RADIUS.xl} />
            <Skeleton height={300} radius={RADIUS.xl} />
          </>
        )
      ) : !q.data.hasAnyData ? (
        <Card>
          <EmptyState icon={Moon} title="No sleep recorded yet." description="Log last night's sleep or connect a health app." action={{ label: "Log last night", icon: Plus, onPress: () => router.push("/sleep/log") }} />
          <Button title="Connect a health app" icon={Watch} variant="ghost" size="md" onPress={() => router.push("/settings/connected-apps")} style={styles.center} />
        </Card>
      ) : (
        <SleepContent data={q.data} onWeek={setWeekStart} loadingWeek={q.isPlaceholderData} />
      )}
      <FinePrint>Sleep insights are for general wellness only and are not a medical assessment. If you have ongoing sleep problems, talk to a doctor. Your sleep data is private and encrypted.</FinePrint>
    </Screen>
  )
}

const styles = StyleSheet.create({
  weekBody: { gap: 12, marginTop: 6 },
  loading: { opacity: 0.5 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
  center: { alignSelf: "center" },
})
