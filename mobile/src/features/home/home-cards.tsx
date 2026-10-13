/** Home dashboard cards (SCR-M-018) — same content as the web Home. */
import { LinearGradient } from "expo-linear-gradient"
import { router } from "expo-router"
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronRight, Droplets, Dumbbell, Footprints, ListChecks, Medal, Moon, Plus, Sparkles, Target } from "lucide-react-native"
import type { ReactNode } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { BarChart, Button, Card, IconTile, PhaseBadge, ProgressBar, ProgressRing, Text } from "@/components/ui"
import type { HomeDashboard } from "@/lib/api/employee/home"
import { formatDate, formatMl, formatNumber } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"
import { BRAND_GRADIENT, RADIUS } from "@/theme/tokens"

const COMPONENT_LABEL: Record<string, string> = {
  activity: "Activity",
  sleep: "Sleep",
  hydration: "Hydration",
  exercise: "Exercise",
  habits: "Habits",
  mindfulness: "Mindfulness",
}

export function ScoreHero({ score }: { score: HomeDashboard["score"] }) {
  const up = score.weekChange >= 0
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Wellness Score ${score.total} of 100. Open details`}
      onPress={() => {
        haptic.tap()
        router.push("/wellness-score")
      }}
      style={({ pressed }) => [pressed && styles.pressed]}
      testID="score-card"
    >
      <LinearGradient colors={[...BRAND_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroTop}>
          <ProgressRing value={score.total} size={116} stroke={11} color="#ffffff" trackColor="rgba(255,255,255,0.25)">
            <Text variant="display" color="#ffffff" style={styles.heroScore}>
              {score.total}
            </Text>
            <Text variant="small" color="rgba(255,255,255,0.85)">
              of 100
            </Text>
          </ProgressRing>
          <View style={styles.flex}>
            <Text variant="label" color="rgba(255,255,255,0.85)">
              HealthX Wellness Score
            </Text>
            <View style={styles.change}>
              {up ? <ArrowUpRight size={20} color="#ffffff" /> : <ArrowDownRight size={20} color="#ffffff" />}
              <Text variant="heading" color="#ffffff">
                {up ? "+" : ""}
                {score.weekChange} this week
              </Text>
            </View>
            <Text variant="small" color="rgba(255,255,255,0.8)">
              Engagement score — not a medical assessment
            </Text>
          </View>
          <ChevronRight size={20} color="rgba(255,255,255,0.75)" />
        </View>
        <View style={styles.components}>
          {Object.entries(score.components).map(([k, v]) => (
            <View key={k} style={styles.component}>
              <View style={styles.componentLabel}>
                <Text variant="small" color="rgba(255,255,255,0.85)" numberOfLines={1}>
                  {COMPONENT_LABEL[k] ?? k}
                </Text>
                <Text variant="small" color="#ffffff" weight="bold">
                  {v}
                </Text>
              </View>
              <ProgressBar value={v} height={4} color="#ffffff" trackColor="rgba(255,255,255,0.22)" />
            </View>
          ))}
        </View>
      </LinearGradient>
    </Pressable>
  )
}

export function StepsCard({ data }: { data: HomeDashboard }) {
  const { chart, tint } = useTheme()
  const t = data.today
  const pct = Math.min(1, t.stepGoal ? t.steps / t.stepGoal : 0)
  const personal = data.goal.mode === "personal" && !!data.goal.personalGoal
  return (
    <Card onPress={() => router.push("/activity")} accessibilityLabel={`${formatNumber(t.steps)} steps of ${formatNumber(t.stepGoal)}. Open activity`} testID="steps-card">
      <View style={styles.stepsRow}>
        <ProgressRing value={t.steps} max={t.stepGoal} size={112} stroke={11} color={chart[0]}>
          <Footprints size={20} color={tint("steps").fg} />
          <Text variant="label" tone="muted">
            {Math.round(pct * 100)}%
          </Text>
        </ProgressRing>
        <View style={styles.flex}>
          <Text variant="label" tone="muted">
            Steps today
          </Text>
          <Text variant="number">{formatNumber(t.steps)}</Text>
          <Text variant="caption" tone="muted">
            of {formatNumber(t.stepGoal)} {personal ? "personal goal" : "goal"}
          </Text>
          <View style={styles.metrics}>
            <Text variant="small" tone="muted">
              {formatNumber(t.distanceKm, 1)} km
            </Text>
            <Text variant="small" tone="muted">
              {formatNumber(t.activeCalories)} kcal
            </Text>
            <Text variant="small" tone="muted">
              {t.activeMinutes} active min
            </Text>
          </View>
        </View>
      </View>
      {personal ? (
        <View style={[styles.goalPill, { backgroundColor: tint("points").bg }]}>
          <Target size={14} color={tint("points").fg} />
          <Text variant="small" style={styles.flex}>
            {data.goal.bonusEarnedToday ? "Personal goal reached — bonus earned today ✓" : `Personal goal from your last ${data.goal.basedOnDays} days · +${data.goal.bonusPoints} bonus points`}
          </Text>
          <PhaseBadge phase={2} />
        </View>
      ) : null}
    </Card>
  )
}

function TileShell({ children, onPress, label, testID }: { children: ReactNode; onPress?: () => void; label: string; testID?: string }) {
  return (
    <Card onPress={onPress} padding={14} style={styles.tile} accessibilityLabel={label} testID={testID}>
      {children}
    </Card>
  )
}

export function WaterTile({ data, onAdd, adding }: { data: HomeDashboard; onAdd: () => void; adding: boolean }) {
  const { colors, tint } = useTheme()
  const t = data.today
  return (
    <TileShell label="Water. Open water tracker" onPress={() => router.push("/water")} testID="water-tile">
      <View style={styles.tileHead}>
        <IconTile icon={Droplets} tint="water" size={36} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add 250 ml of water"
          disabled={adding}
          hitSlop={8}
          onPress={() => {
            haptic.tap()
            onAdd()
          }}
          style={({ pressed }) => [styles.addBtn, { backgroundColor: tint("water").bg, borderColor: colors.border }, (pressed || adding) && { opacity: 0.6 }]}
          testID="water-add"
        >
          <Plus size={16} color={tint("water").fg} strokeWidth={2.6} />
          <Text variant="small" color={tint("water").fg}>
            250
          </Text>
        </Pressable>
      </View>
      <Text variant="small" tone="muted">
        Water
      </Text>
      <Text variant="subtitle">
        {formatMl(t.waterMl)}
        <Text variant="caption" tone="muted">
          {" "}
          / {formatMl(t.waterGoalMl)}
        </Text>
      </Text>
      <ProgressBar value={t.waterMl} max={t.waterGoalMl} height={6} color={tint("water").fg} />
    </TileShell>
  )
}

export function WorkoutTile({ data }: { data: HomeDashboard }) {
  const { colors } = useTheme()
  const t = data.today
  const href = t.workoutDone ? "/workouts" : data.suggestedWorkout ? `/workouts/${data.suggestedWorkout.id}` : "/workouts"
  return (
    <TileShell label="Workout" onPress={() => router.push(href as never)}>
      <IconTile icon={Dumbbell} tint="workout" size={36} />
      <Text variant="small" tone="muted">
        Workout
      </Text>
      {t.workoutDone ? (
        <View style={styles.inline}>
          <Check size={16} color={colors.success} strokeWidth={3} />
          <Text variant="subtitle" tone="success">
            Completed
          </Text>
        </View>
      ) : (
        <Text variant="subtitle">Not yet today</Text>
      )}
      <Text variant="small" tone="muted" numberOfLines={1}>
        {t.workoutDone ? t.workoutDone.name : data.suggestedWorkout ? `Try: ${data.suggestedWorkout.name}` : "Browse workouts"}
      </Text>
    </TileShell>
  )
}

export function HabitsTile({ data }: { data: HomeDashboard }) {
  const t = data.today
  return (
    <TileShell label="Habits" onPress={() => router.push("/habits")}>
      <IconTile icon={ListChecks} tint="habits" size={36} />
      <Text variant="small" tone="muted">
        Habits
      </Text>
      <Text variant="subtitle">
        {t.habitsDone}/{t.habitsTotal}
        <Text variant="caption" tone="muted">
          {" "}
          done
        </Text>
      </Text>
      <ProgressBar value={t.habitsDone} max={t.habitsTotal || 1} height={6} />
    </TileShell>
  )
}

export function SleepTile({ data }: { data: HomeDashboard }) {
  const m = data.today.sleepMin
  return (
    <TileShell label="Sleep last night" onPress={() => router.push("/sleep")}>
      <View style={styles.tileHead}>
        <IconTile icon={Moon} tint="sleep" size={36} />
        <PhaseBadge phase={2} />
      </View>
      <Text variant="small" tone="muted">
        Sleep last night
      </Text>
      <Text variant="subtitle">{m ? `${Math.floor(m / 60)}h ${m % 60}m` : "—"}</Text>
    </TileShell>
  )
}

export function ChallengeCard({ challenge }: { challenge: HomeDashboard["challenge"] }) {
  const { colors } = useTheme()
  if (!challenge) {
    return (
      <Card>
        <Text variant="subtitle">No challenge today</Text>
        <Text variant="caption" tone="muted" style={styles.gapTop}>
          Join one to compete with colleagues and earn bonus points.
        </Text>
        <Button title="Browse challenges" size="sm" onPress={() => router.push("/challenges")} style={styles.gapTopLg} />
      </Card>
    )
  }
  const pct = Math.min(100, Math.round((challenge.progress / challenge.target) * 100))
  return (
    <Card padding={0} onPress={() => router.push(`/challenges/${challenge.id}` as never)} accessibilityLabel={`Your challenge ${challenge.name}`} style={styles.clip}>
      <LinearGradient colors={[challenge.color, `${challenge.color}cc`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.challengeHead}>
        <View style={styles.emoji}>
          <Text variant="title">{challenge.emoji}</Text>
        </View>
        <View style={styles.flex}>
          <Text variant="small" color="rgba(255,255,255,0.9)">
            Your challenge · {challenge.daysLeft} days left
          </Text>
          <Text variant="subtitle" color="#ffffff" numberOfLines={1}>
            {challenge.name}
          </Text>
        </View>
        <View style={styles.pointsPill}>
          <Text variant="small" color="#ffffff" weight="bold">
            +{challenge.points} pts
          </Text>
        </View>
      </LinearGradient>
      <View style={styles.challengeBody}>
        <View style={styles.between}>
          <Text variant="caption" tone="muted">
            <Text variant="subtitle">{formatNumber(challenge.progress)}</Text> / {formatNumber(challenge.target)} {challenge.unit}
          </Text>
          <Text variant="label">{pct}%</Text>
        </View>
        <ProgressBar value={pct} height={8} color={colors.primary} />
        <Text variant="caption" tone="muted">
          You&apos;re <Text variant="label">#{challenge.rank}</Text> of {formatNumber(challenge.participants)} participants
        </Text>
      </View>
    </Card>
  )
}

export function WeekRankCard({ data }: { data: HomeDashboard }) {
  const { tint } = useTheme()
  const met = data.week.filter((d) => d.steps >= d.goal).length
  const goal = data.week[data.week.length - 1]?.goal ?? data.today.stepGoal
  return (
    <Card>
      <View style={styles.between}>
        <View style={styles.flex}>
          <Text variant="subtitle">This week</Text>
          <Text variant="caption" tone="muted">
            Goal reached on {met} of {data.week.length} days
          </Text>
        </View>
        {data.modules.includes("leaderboards") ? (
          <Pressable accessibilityRole="button" onPress={() => router.push("/leaderboards")} style={[styles.rankChip, { backgroundColor: tint("points").bg }]} testID="rank-chip">
            <Medal size={14} color={tint("points").fg} />
            <Text variant="small" color={tint("points").fg} weight="bold" numberOfLines={1}>
              #{data.rank.position} in {data.rank.scope}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.gapTopLg}>
        <BarChart
          compact
          height={130}
          goal={goal}
          data={data.week.map((d) => ({ key: d.date, label: formatDate(d.date, "EEEEE"), detail: formatDate(d.date, "EEE, d MMM"), value: d.steps }))}
          unit="steps"
          accessibilityLabel="Steps per day this week"
        />
      </View>
    </Card>
  )
}

export function InsightCard({ summary }: { summary: HomeDashboard["summary"] }) {
  const { colors } = useTheme()
  if (!summary) return null
  return (
    <Card onPress={() => router.push("/weekly-summary")} accessibilityLabel="Weekly HealthX insight">
      <View style={styles.insight}>
        <LinearGradient colors={["#8b5cf6", "#d946ef"]} style={styles.insightIcon}>
          <Sparkles size={20} color="#ffffff" />
        </LinearGradient>
        <View style={styles.flex}>
          <Text variant="label">Weekly HealthX insight</Text>
          <Text variant="caption" tone="muted">
            {summary.opportunity}
          </Text>
          <Text variant="caption" tone="primary" weight="semibold">
            {summary.recommendation}
          </Text>
        </View>
        <ArrowRight size={18} color={colors.mutedForeground} />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  hero: { borderRadius: RADIUS.xl, padding: 18, gap: 16 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 16 },
  heroScore: { fontSize: 34, lineHeight: 38 },
  change: { flexDirection: "row", alignItems: "center", gap: 4, marginVertical: 2 },
  components: { flexDirection: "row", flexWrap: "wrap", rowGap: 10, columnGap: 14 },
  component: { width: "29%", flexGrow: 1, gap: 4 },
  componentLabel: { flexDirection: "row", justifyContent: "space-between", gap: 4 },
  stepsRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  metrics: { flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 2, marginTop: 4 },
  goalPill: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, paddingHorizontal: 10, paddingVertical: 8, borderRadius: RADIUS.md },
  tile: { flex: 1, gap: 6, minHeight: 150 },
  tileHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 2, height: 32, paddingHorizontal: 10, borderRadius: RADIUS.pill, borderWidth: StyleSheet.hairlineWidth },
  inline: { flexDirection: "row", alignItems: "center", gap: 4 },
  clip: { overflow: "hidden" },
  challengeHead: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  emoji: { width: 46, height: 46, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  pointsPill: { backgroundColor: "rgba(255,255,255,0.22)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill },
  challengeBody: { padding: 16, gap: 10 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  rankChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill, maxWidth: 190 },
  gapTop: { marginTop: 4 },
  gapTopLg: { marginTop: 12 },
  insight: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  insightIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
})
