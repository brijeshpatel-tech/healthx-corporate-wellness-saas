/** SCR-M-020 Weekly Wellness Summary & Insight (rule-based recap; AI insight is Phase 2 with consent). */
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Droplets, Dumbbell, Footprints, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react-native"
import { useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { BarChart, Button, Card, EmptyState, ErrorState, IconButton, ListGroup, ListItem, PhaseBadge, Screen, SectionHeader, SkeletonList, StatTile, Text } from "@/components/ui"
import { weeklySummaryApi, type WeeklySummaryDetail } from "@/lib/api/employee/score"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber } from "@/lib/format"
import { openHref } from "@/lib/routes"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

const weekLabel = (w: WeeklySummaryDetail) => `${formatDate(w.weekStart, "d MMM")} – ${formatDate(w.weekEnd, "d MMM")}`

function Completed({ icon: Icon, text }: { icon: typeof Dumbbell; text: string }) {
  const { colors } = useTheme()
  return (
    <View style={styles.done}>
      <CheckCircle2 size={18} color={colors.success} />
      <Icon size={16} color={colors.mutedForeground} />
      <Text variant="bodyMedium" style={styles.flex}>
        {text}
      </Text>
    </View>
  )
}

export default function WeeklySummaryScreen() {
  const { colors, tint } = useTheme()
  const q = useApiQuery(["employee", "weekly-summary"], () => weeklySummaryApi.list())
  const [index, setIndex] = useState(0)
  const feedback = useApiMutation(weeklySummaryApi.feedback, { success: "Thanks for the feedback" })
  const enableAi = useApiMutation(weeklySummaryApi.enableAiInsights, { success: "AI insights turned on" })
  const weeks = q.data?.weeks ?? []
  const w = weeks[Math.min(index, Math.max(0, weeks.length - 1))]

  return (
    <Screen title="Weekly summary" back refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {q.isLoading ? (
        <SkeletonList count={3} />
      ) : q.error ? (
        <ErrorState title="Summary unavailable." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : !w ? (
        <EmptyState icon={CalendarDays} title="No summary yet" description={`Your first weekly summary will be ready next Monday${q.data ? ` (${formatDate(q.data.nextSummaryOn, "d MMM")})` : ""}.`} />
      ) : (
        <>
          <View style={styles.weekNav}>
            <IconButton icon={ChevronLeft} accessibilityLabel="Previous week" disabled={index >= weeks.length - 1} onPress={() => setIndex((i) => i + 1)} />
            <View style={styles.weekTitle}>
              <Text variant="subtitle">{w.isCurrent ? "This week" : weekLabel(w)}</Text>
              <Text variant="small" tone="muted">
                {w.isCurrent ? `${weekLabel(w)} · so far` : `${w.activeDays} active days`}
              </Text>
            </View>
            <IconButton icon={ChevronRight} accessibilityLabel="Next week" disabled={index === 0} onPress={() => setIndex((i) => i - 1)} />
          </View>

          <Card padding={18}>
            <View style={styles.cardHead}>
              <View style={[styles.sparkle, { backgroundColor: tint("insight").bg }]}>
                <Sparkles size={18} color={tint("insight").fg} />
              </View>
              <Text variant="heading">Weekly HealthX Insight</Text>
            </View>
            <Text variant="label" tone="muted" style={styles.gap}>
              You completed
            </Text>
            <Completed icon={Dumbbell} text={`${w.workouts} ${w.workouts === 1 ? "workout" : "workouts"}`} />
            <Completed icon={Footprints} text={`${formatNumber(w.steps)} steps · goal hit on ${w.stepGoalDays}/7 days`} />
            <Completed icon={Droplets} text={`${w.hydrationGoalsHit}/7 hydration goals`} />
            {w.highlights.length ? (
              <View style={[styles.highlights, { borderTopColor: colors.border }]}>
                {w.highlights.map((h) => (
                  <Text key={h} variant="caption" tone="muted">
                    • {h}
                  </Text>
                ))}
              </View>
            ) : null}
          </Card>

          <View style={styles.stats}>
            <StatTile label="Active days" value={`${w.activeDays}/7`} />
            <StatTile label="Score change" value={`${w.scoreChange >= 0 ? "+" : ""}${w.scoreChange}`} />
            <StatTile label="Avg sleep" value={w.avgSleepHours ? `${w.avgSleepHours}h` : "—"} hint={<PhaseBadge phase={2} />} />
          </View>

          <Card>
            <Text variant="subtitle">Steps per day</Text>
            <BarChart
              data={w.days.map((d) => ({ key: d.date, label: formatDate(d.date, "EEEEE"), detail: formatDate(d.date, "EEE, d MMM"), value: d.steps }))}
              goal={w.days[0]?.goal}
              unit="steps"
              height={150}
              accessibilityLabel="Steps per day for the selected week"
            />
            <View style={styles.dayRow}>
              {w.days.map((d) => (
                <View key={d.date} style={styles.dayCell} accessibilityLabel={`${formatDate(d.date, "EEEE")}: ${d.waterMet ? "water goal met" : "water goal missed"}, ${d.workout ? "workout done" : "no workout"}`}>
                  <Droplets size={14} color={d.waterMet ? tint("water").fg : colors.border} />
                  <Dumbbell size={14} color={d.workout ? tint("workout").fg : colors.border} />
                </View>
              ))}
            </View>
            <Text variant="small" tone="muted">
              Coloured icons: water goal met · workout done
            </Text>
          </Card>

          {w.insight ? (
            <Card>
              <View style={styles.cardHead}>
                <Text variant="subtitle" style={styles.flex}>
                  Opportunity
                </Text>
                <PhaseBadge phase={2} />
              </View>
              <Text variant="body">{w.insight.opportunity}</Text>
              <Text variant="subtitle" style={styles.gap}>
                Recommendation
              </Text>
              <Text variant="body">{w.insight.recommendation}</Text>
              <Button title={w.insight.actionLabel} size="md" onPress={() => openHref(w.insight!.actionHref)} style={styles.gapLg} />
              <View style={styles.feedback}>
                <Text variant="caption" tone="muted" style={styles.flex}>
                  Was this helpful?
                </Text>
                {(["helpful", "not_helpful"] as const).map((v) => {
                  const active = w.insight!.feedback === v
                  const Icon = v === "helpful" ? ThumbsUp : ThumbsDown
                  return (
                    <Pressable
                      key={v}
                      accessibilityRole="button"
                      accessibilityLabel={v === "helpful" ? "Helpful" : "Not helpful"}
                      accessibilityState={{ selected: active }}
                      onPress={() => feedback.mutate({ weekStart: w.weekStart, value: v })}
                      style={[styles.thumb, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : colors.card }]}
                    >
                      <Icon size={16} color={active ? colors.primary : colors.mutedForeground} />
                    </Pressable>
                  )
                })}
              </View>
            </Card>
          ) : q.data?.aiInsights.enabledByCompany && !q.data.aiInsights.consented ? (
            <Card>
              <View style={styles.cardHead}>
                <Text variant="subtitle" style={styles.flex}>
                  Personal insights
                </Text>
                <PhaseBadge phase={2} />
              </View>
              <Text variant="caption" tone="muted">
                Allow HealthX to use your own data to spot trends and suggest one small change each week. You can turn this off any time in Privacy.
              </Text>
              <Button title="Turn on AI insights" variant="outline" size="md" loading={enableAi.isPending} onPress={() => enableAi.mutate({ key: "ai_personalisation", granted: true })} style={styles.gapLg} />
            </Card>
          ) : null}

          {weeks.length > 1 ? (
            <>
              <SectionHeader title="Previous weeks" />
              <ListGroup>
                {weeks.map((wk, i) =>
                  i === index ? null : (
                    <ListItem
                      key={wk.weekStart}
                      icon={CalendarDays}
                      tint="insight"
                      title={wk.isCurrent ? "This week" : weekLabel(wk)}
                      subtitle={`${formatNumber(wk.steps)} steps · ${wk.workouts} workouts · ${wk.hydrationGoalsHit}/7 water`}
                      onPress={() => setIndex(i)}
                    />
                  ),
                )}
              </ListGroup>
            </>
          ) : null}
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  weekNav: { flexDirection: "row", alignItems: "center", gap: 8 },
  weekTitle: { flex: 1, alignItems: "center" },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  sparkle: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  done: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  highlights: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 10, paddingTop: 10, gap: 4 },
  stats: { flexDirection: "row", gap: 10 },
  dayRow: { flexDirection: "row", marginLeft: 40, marginTop: 6, marginBottom: 6 },
  dayCell: { flex: 1, alignItems: "center", gap: 4 },
  gap: { marginTop: 10 },
  gapLg: { marginTop: 14 },
  feedback: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  thumb: { width: 40, height: 40, borderRadius: RADIUS.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
})
