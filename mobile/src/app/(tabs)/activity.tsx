/**
 * SCR-M-022 Activity & Steps — day / week / month, sync status + "Sync now" (#346),
 * personalised daily goal (#362), today's entries with approval status (#365).
 */
import { router } from "expo-router"
import { ChevronLeft, ChevronRight, Droplets, Dumbbell, Flame, Footprints, History, ListChecks, MapPin, Moon, Pencil, Plus, Target, Timer, Utensils } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { BarChart, Button, Card, EmptyState, ErrorState, IconButton, ListGroup, ListItem, PhaseBadge, ProgressRing, Screen, SectionHeader, SegmentedControl, Skeleton, StatTile, Text } from "@/components/ui"
import { SessionRow } from "@/features/activity/session-row"
import { SyncStatusBar } from "@/features/activity/sync-status"
import { activityApi } from "@/lib/api/employee/activity"
import { useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber } from "@/lib/format"
import { DAY_MS, toLocalDate } from "@/lib/mock/series"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

type Period = "day" | "week" | "month"

const shiftDate = (date: string, days: number) => toLocalDate(new Date(new Date(`${date}T12:00:00`).getTime() + days * DAY_MS))
const hourLabel = (h: number) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`)

function TrendChart({ period, goal }: { period: "week" | "month"; goal: number }) {
  const days = period === "week" ? 7 : 30
  const to = toLocalDate(new Date())
  const from = shiftDate(to, -(days - 1))
  const q = useApiQuery(["employee", "activity", "daily", from, to], () => activityApi.daily({ from, to }))
  if (q.isLoading) return <Skeleton height={190} />
  if (q.error) return <ErrorState title="Couldn't load your chart" error={q.error} onRetry={() => q.refetch()} />
  const data = q.data ?? []
  const total = data.reduce((a, d) => a + d.steps, 0)
  const met = data.filter((d) => d.steps >= (d.goalSteps || goal)).length
  return (
    <>
      <View style={styles.chartHead}>
        <View>
          <Text variant="subtitle">{formatNumber(Math.round(total / Math.max(1, data.length)))} avg steps</Text>
          <Text variant="caption" tone="muted">
            {formatNumber(total)} total · goal hit on {met} of {data.length} days
          </Text>
        </View>
      </View>
      <BarChart
        data={data.map((d) => ({ key: d.date, label: period === "week" ? formatDate(d.date, "EEE") : formatDate(d.date, "d"), detail: formatDate(d.date, "EEE, d MMM"), value: d.steps }))}
        goal={goal}
        unit="steps"
        height={180}
        accessibilityLabel={`Steps per day, last ${days} days`}
      />
    </>
  )
}

export default function ActivityScreen() {
  const { chart } = useTheme()
  const today = toLocalDate(new Date())
  const [period, setPeriod] = useState<Period>("day")
  const [date, setDate] = useState(today)
  const q = useApiQuery(["employee", "activity", "summary", date], () => activityApi.summary({ date }), { placeholderData: (prev) => prev })
  const s = q.data
  const isToday = date === today
  const personal = s?.goal.mode === "personal" && s.goal.personalGoal != null && s.isToday

  return (
    <Screen
      inTabs
      large
      title="Activity"
      right={
        <>
          <IconButton icon={History} accessibilityLabel="Activity history" onPress={() => router.push("/activity/history")} testID="history" />
          {s?.manual.allowed !== false ? <IconButton icon={Plus} variant="primary" accessibilityLabel="Log activity" onPress={() => router.push("/activity/log")} testID="log-activity" /> : null}
        </>
      }
      refreshing={q.isRefetching && !q.isPlaceholderData}
      onRefresh={() => q.refetch()}
    >
      <SegmentedControl
        options={[
          { value: "day", label: "Day" },
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
        ]}
        value={period}
        onChange={setPeriod}
        accessibilityLabel="Period"
      />

      {period === "day" ? (
        <View style={styles.dateNav}>
          <IconButton icon={ChevronLeft} variant="ghost" accessibilityLabel="Previous day" onPress={() => setDate((d) => shiftDate(d, -1))} />
          <Text variant="subtitle" style={styles.dateLabel}>
            {isToday ? "Today" : date === shiftDate(today, -1) ? "Yesterday" : formatDate(date, "EEE, d MMM")}
          </Text>
          <IconButton icon={ChevronRight} variant="ghost" accessibilityLabel="Next day" disabled={isToday} onPress={() => setDate((d) => shiftDate(d, 1))} />
        </View>
      ) : null}

      {!s ? (
        q.error ? (
          <ErrorState title="Couldn't load your activity" error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
        ) : (
          <>
            <Skeleton height={240} radius={RADIUS.xl} />
            <Skeleton height={90} radius={RADIUS.xl} />
          </>
        )
      ) : (
        <>
          {period === "day" ? (
            <Card padding={18}>
              <View style={styles.ringWrap}>
                <ProgressRing value={s.steps} max={s.stepGoal} size={176} stroke={14} color={chart[0]} accessibilityLabel={`${formatNumber(s.steps)} of ${formatNumber(s.stepGoal)} steps`}>
                  <Footprints size={22} color={chart[0]} />
                  <Text variant="display">{formatNumber(s.steps)}</Text>
                  <Text variant="caption" tone="muted">
                    of {formatNumber(s.stepGoal)} steps
                  </Text>
                </ProgressRing>
              </View>
              <View style={styles.stats}>
                <StatTile icon={MapPin} tint="steps" label="Distance" value={`${formatNumber(s.distanceKm, 1)} km`} />
                <StatTile icon={Flame} tint="streak" label="Active kcal" value={formatNumber(s.activeCalories)} />
                <StatTile icon={Timer} tint="workout" label="Active min" value={`${s.activeMinutes}`} />
              </View>
            </Card>
          ) : null}

          {isToday || period !== "day" ? <SyncStatusBar sync={s.sync} /> : null}

          <Card onPress={() => router.push("/activity/goal")} accessibilityLabel="Daily step goal. Edit" testID="step-goal">
            <View style={styles.goalRow}>
              <View style={styles.goalIcon}>
                <Target size={20} color={chart[0]} />
              </View>
              <View style={styles.flex}>
                <View style={styles.goalTitle}>
                  <Text variant="subtitle">{formatNumber(s.goal.today)} steps a day</Text>
                  {personal ? <PhaseBadge phase={2} /> : null}
                </View>
                <Text variant="caption" tone="muted">
                  {personal
                    ? s.goal.bonusEarnedToday
                      ? "Personal goal reached today — bonus earned ✓"
                      : `Personal goal · +${s.goal.bonusPoints} bonus points when you reach it`
                    : "Fixed daily goal"}
                </Text>
              </View>
              <Pencil size={16} color={chart[0]} />
            </View>
          </Card>

          {period === "day" ? (
            <Card>
              <Text variant="subtitle">Steps by hour</Text>
              <BarChart
                data={s.hourly.filter((h) => h.hour >= 5).map((h) => ({ key: String(h.hour), label: h.hour % 3 === 0 ? hourLabel(h.hour) : "", detail: `${hourLabel(h.hour)}–${hourLabel((h.hour + 1) % 24)}`, value: h.steps }))}
                dimBelowGoal={false}
                color={chart[0]}
                unit="steps"
                height={160}
                accessibilityLabel="Steps by hour"
              />
            </Card>
          ) : (
            <Card>
              <TrendChart period={period} goal={s.goal.today} />
            </Card>
          )}

          {period === "day" ? (
            <>
              <SectionHeader title={isToday ? "Today's activities" : "Activities"} action={{ label: "History", onPress: () => router.push("/activity/history") }} />
              {s.sessions.length ? (
                <Card padding={4}>
                  {s.sessions.map((session) => (
                    <SessionRow key={session.id} session={session} review={s.reviews[session.id]} onPress={() => router.push("/activity/history")} />
                  ))}
                </Card>
              ) : (
                <Card>
                  <EmptyState
                    compact
                    icon={Footprints}
                    title={isToday ? "No activity yet today" : "No activities this day"}
                    description="Connect Apple Health / Health Connect or log an activity."
                    action={s.manual.allowed ? { label: "Log activity", icon: Plus, onPress: () => router.push("/activity/log") } : undefined}
                  />
                </Card>
              )}
              {s.manual.allowed ? (
                <Text variant="small" tone="muted">
                  Manually logged activities are checked by your company before they earn points.
                </Text>
              ) : null}
            </>
          ) : null}

          <SectionHeader title="More tracking" />
          <ListGroup>
            <ListItem icon={Droplets} tint="water" title="Water" subtitle="Log a glass in one tap" onPress={() => router.push("/water")} />
            <ListItem icon={Dumbbell} tint="workout" title="Workouts" subtitle="Guided home & gym workouts" onPress={() => router.push("/workouts")} />
            <ListItem icon={ListChecks} tint="habits" title="Habits" subtitle="Daily check-ins and streaks" onPress={() => router.push("/habits")} />
            <ListItem icon={Moon} tint="sleep" title="Sleep" subtitle="Score, duration and your weekly pattern" right={<PhaseBadge phase={2} />} onPress={() => router.push("/sleep")} />
            <ListItem icon={Utensils} tint="points" title="Nutrition" subtitle="Meals, calories and macros" right={<PhaseBadge phase={2} />} onPress={() => router.push("/nutrition")} />
          </ListGroup>
          {s.manual.allowed ? <Button title="Log activity" icon={Plus} variant="outline" onPress={() => router.push("/activity/log")} /> : null}

        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  dateNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: -6 },
  dateLabel: { flex: 1, textAlign: "center" },
  ringWrap: { alignItems: "center", paddingVertical: 4 },
  stats: { flexDirection: "row", gap: 8, marginTop: 16 },
  chartHead: { marginBottom: 8 },
  goalRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  goalIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(42,120,214,0.12)" },
  goalTitle: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
})
