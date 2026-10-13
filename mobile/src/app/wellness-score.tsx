/** SCR-M-019 Wellness Score Detail — breakdown, trend, tips and the non-medical disclaimer. */
import { ChevronRight, Gauge, Info, Lightbulb } from "lucide-react-native"
import { useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { BottomSheet, Card, EmptyState, ErrorState, IconButton, LineChart, Notice, PhaseBadge, ProgressBar, ProgressRing, Screen, SectionHeader, SegmentedControl, SkeletonList, Text } from "@/components/ui"
import { wellnessScoreApi, type ScoreComponent } from "@/lib/api/employee/score"
import { useApiQuery } from "@/lib/api/hooks"
import { formatDate } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { openHref } from "@/lib/routes"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

function ComponentRow({ c }: { c: ScoreComponent }) {
  const { colors } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${c.label} ${c.value} of 100, weight ${c.weight}%`}
      onPress={() => {
        haptic.tap()
        openHref(c.href)
      }}
      style={({ pressed }) => [styles.component, pressed && { backgroundColor: colors.muted }]}
    >
      <View style={styles.componentHead}>
        <Text variant="bodyMedium">{c.label}</Text>
        {c.phase === 2 ? <PhaseBadge phase={2} /> : null}
        <Text variant="small" tone="muted" style={styles.weight}>
          {c.weight}% of score
        </Text>
        <Text variant="subtitle">{c.value}</Text>
        <ChevronRight size={16} color={colors.mutedForeground} />
      </View>
      <ProgressBar value={c.value} height={6} />
      <View style={styles.tip}>
        <Lightbulb size={14} color={colors.mutedForeground} />
        <Text variant="caption" tone="muted" style={styles.flex}>
          {c.tip}
        </Text>
      </View>
    </Pressable>
  )
}

export default function WellnessScoreScreen() {
  const [period, setPeriod] = useState<"7d" | "30d">("7d")
  const [infoOpen, setInfoOpen] = useState(false)
  const q = useApiQuery(["employee", "wellness-score", period], () => wellnessScoreApi.get({ period }), { placeholderData: (prev) => prev })
  const d = q.data

  return (
    <Screen
      title="Wellness Score"
      back
      right={<IconButton icon={Info} variant="ghost" accessibilityLabel="How the score is calculated" onPress={() => setInfoOpen(true)} />}
      refreshing={q.isRefetching && !q.isPlaceholderData}
      onRefresh={() => q.refetch()}
    >
      <SegmentedControl
        options={[
          { value: "7d", label: "7 days" },
          { value: "30d", label: "30 days" },
        ]}
        value={period}
        onChange={setPeriod}
        accessibilityLabel="Period"
      />

      {q.isLoading ? (
        <SkeletonList count={3} />
      ) : q.error && !d ? (
        <ErrorState title="Score unavailable right now." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : d && !d.hasData ? (
        <EmptyState icon={Gauge} title="No score yet" description="Your score appears after your first full day of activity." />
      ) : d ? (
        <>
          <Card padding={18}>
            <View style={styles.hero}>
              <ProgressRing value={d.total} size={132} stroke={12} accessibilityLabel={`Wellness Score ${d.total} of 100`}>
                <Text variant="display">{d.total}</Text>
                <Text variant="small" tone="muted">
                  of 100
                </Text>
              </ProgressRing>
              <View style={styles.flex}>
                <Text variant="label" tone={d.change >= 0 ? "success" : "destructive"}>
                  {d.change >= 0 ? "▲ +" : "▼ "}
                  {d.change} vs {period === "7d" ? "last week" : "30 days ago"}
                </Text>
                <View style={styles.statLine}>
                  <Text variant="small" tone="muted">
                    Average
                  </Text>
                  <Text variant="subtitle">{d.periodAverage}</Text>
                </View>
                {d.best ? (
                  <View style={styles.statLine}>
                    <Text variant="small" tone="muted">
                      Best day
                    </Text>
                    <Text variant="subtitle">
                      {d.best.total} · {formatDate(d.best.date, "d MMM")}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Card>

          <Card>
            <Text variant="subtitle">Trend</Text>
            <LineChart
              data={d.history.map((h) => ({ key: h.date, label: formatDate(h.date, period === "7d" ? "EEE" : "d"), detail: formatDate(h.date, "EEE, d MMM"), value: h.total }))}
              domain={[0, 100]}
              accessibilityLabel={`Wellness Score over the last ${period === "7d" ? "7" : "30"} days`}
            />
          </Card>

          <SectionHeader title="What makes up your score" subtitle="Tap a part to improve it" />
          <Card padding={4}>
            {d.components.map((c, i) => (
              <View key={c.key}>
                {i > 0 ? <View style={styles.sep} /> : null}
                <ComponentRow c={c} />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <Notice tone="info" title="Not a medical assessment">
        This is a wellness engagement score, not a medical assessment. Talk to a doctor about any health concerns.
      </Notice>

      <BottomSheet open={infoOpen} onClose={() => setInfoOpen(false)} title="How your score is calculated">
        <Text variant="body">Your HealthX Wellness Score (0–100) combines six parts of your day. Each part scores 0–100 and counts by its weight:</Text>
        {(d?.components ?? []).map((c) => (
          <View key={c.key} style={styles.weightRow}>
            <Text variant="bodyMedium" style={styles.flex}>
              {c.label}
            </Text>
            <Text variant="label">{c.weight}%</Text>
          </View>
        ))}
        <Text variant="caption" tone="muted">
          Weights are set by HealthX{d ? ` (version ${d.configVersion}, updated ${formatDate(d.configUpdatedAt)})` : ""}. Sleep and mindfulness count from Phase 2.
        </Text>
      </BottomSheet>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 6 },
  hero: { flexDirection: "row", alignItems: "center", gap: 18 },
  statLine: { gap: 0 },
  component: { padding: 12, gap: 8, borderRadius: RADIUS.lg },
  componentHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  weight: { flex: 1, textAlign: "right" },
  tip: { flexDirection: "row", gap: 6, alignItems: "flex-start" },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(127,127,127,0.2)", marginHorizontal: 12 },
  weightRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
})
