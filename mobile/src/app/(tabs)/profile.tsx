/** SCR-M-069 My Profile (basic) — summary, completion, points & badges, section links. */
import { router } from "expo-router"
import { Award, Bell, Bot, CalendarRange, ChevronRight, Coins, Dumbbell, Flame, HeartPulse, LifeBuoy, Medal, Megaphone, Newspaper, Package, Settings, ShieldCheck, SlidersHorizontal, UserRound, UserRoundPen, Users, Watch } from "lucide-react-native"
import { Pressable, StyleSheet, View } from "react-native"
import { Avatar, Button, Card, ErrorState, IconButton, ListGroup, ListItem, PhaseBadge, ProgressBar, Screen, SectionHeader, Skeleton, StatusPill, Text } from "@/components/ui"
import { profileApi } from "@/lib/api/employee/profile"
import { useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { openHref } from "@/lib/routes"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

function Stat({ icon: Icon, color, value, label, onPress }: { icon: typeof Coins; color: string; value: string; label: string; onPress?: () => void }) {
  const { colors } = useTheme()
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={() => {
        haptic.tap()
        onPress?.()
      }}
      style={({ pressed }) => [styles.stat, { backgroundColor: colors.card, borderColor: colors.border }, pressed && { opacity: 0.85 }]}
    >
      <Icon size={18} color={color} />
      <Text variant="heading">{value}</Text>
      <Text variant="small" tone="muted">
        {label}
      </Text>
    </Pressable>
  )
}

export default function ProfileScreen() {
  const { colors, tint } = useTheme()
  const q = useApiQuery(["employee", "profile"], () => profileApi.get())
  const p = q.data

  return (
    <Screen
      inTabs
      large
      title="Profile"
      right={<IconButton icon={Settings} accessibilityLabel="Settings" onPress={() => router.push("/settings")} testID="open-settings" />}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
    >
      {!p ? (
        q.error ? (
          <ErrorState title="Couldn't load your profile." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
        ) : (
          <>
            <Skeleton height={170} radius={RADIUS.xl} />
            <Skeleton height={90} radius={RADIUS.xl} />
            <Skeleton height={300} radius={RADIUS.xl} />
          </>
        )
      ) : (
        <>
          <Card padding={18}>
            <View style={styles.identity}>
              <Avatar name={p.fullName} color={p.avatarColor} photoUrl={p.photoUrl} size={72} />
              <View style={styles.flex}>
                <Text variant="heading" numberOfLines={1}>
                  {p.fullName}
                </Text>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {p.jobTitle}
                </Text>
                <Text variant="caption" tone="muted" numberOfLines={2}>
                  {[p.companyName, p.departmentName, p.teamName].filter(Boolean).join(" · ")}
                </Text>
                {p.role === "team_manager" ? <StatusPill status="active" tint="steps" label="Team Manager" style={styles.pill} /> : null}
              </View>
            </View>
            <Button title="Edit profile" icon={UserRoundPen} variant="outline" size="md" block onPress={() => router.push("/profile/edit")} style={styles.edit} />
          </Card>

          {p.completion.percent < 100 ? (
            <Card onPress={() => openHref(p.completion.missing[0]?.href ?? "/profile/edit")} accessibilityLabel={`Profile ${p.completion.percent}% complete`}>
              <View style={styles.completionHead}>
                <Text variant="subtitle" style={styles.flex}>
                  Profile {p.completion.percent}% complete
                </Text>
                <ChevronRight size={18} color={colors.mutedForeground} />
              </View>
              <ProgressBar value={p.completion.percent} height={8} style={styles.bar} />
              {p.completion.missing.length ? (
                <Text variant="caption" tone="muted">
                  {p.completion.missing[0]?.label}{p.completion.missing.length > 1 ? ` and ${p.completion.missing.length - 1} more` : ""} to personalise your goals.
                </Text>
              ) : null}
            </Card>
          ) : null}

          <View style={styles.stats}>
            <Stat icon={Coins} color={tint("points").fg} value={formatNumber(p.stats.pointsBalance)} label="Points" onPress={() => router.push("/wallet")} />
            <Stat icon={Award} color={tint("insight").fg} value={formatNumber(p.stats.badgesCount)} label="Badges" onPress={() => router.push("/badges")} />
            <Stat icon={Flame} color={tint("streak").fg} value={`${p.stats.currentStreak}`} label="Day streak" />
          </View>

          <SectionHeader title="My details" />
          <ListGroup>
            <ListItem icon={UserRound} tint="steps" title="Basic details" subtitle={[p.email, p.phone].filter(Boolean).join(" · ")} onPress={() => router.push("/profile/edit")} />
            <ListItem icon={HeartPulse} tint="danger" title="Wellness details" subtitle="Height, weight, goals — private to you" onPress={() => router.push("/profile/wellness")} />
            <ListItem icon={SlidersHorizontal} tint="habits" title="Preferences" subtitle="Activities, workouts, food, language" onPress={() => router.push("/settings/preferences")} />
            <ListItem icon={Award} tint="points" title="Badges" subtitle={`${p.stats.badgesCount} earned`} onPress={() => router.push("/badges")} />
            <ListItem icon={Dumbbell} tint="workout" title="Workout history" onPress={() => router.push("/workouts/history")} />
          </ListGroup>

          {p.role === "team_manager" ? (
            <ListGroup>
              <ListItem icon={Users} tint="steps" title="My Team" subtitle="Your team's combined progress" onPress={() => router.push("/my-team")} />
            </ListGroup>
          ) : null}

          <SectionHeader title="Explore" />
          <ListGroup>
            <ListItem icon={Megaphone} tint="steps" title="Announcements" subtitle="News and updates from your company" onPress={() => router.push("/announcements")} testID="announcements-row" />
            <ListItem icon={Medal} tint="points" title="Leaderboards" subtitle="Company, department and team rankings" onPress={() => router.push("/leaderboards")} />
            <ListItem icon={Package} tint="insight" title="My orders" subtitle="Track your reward redemptions" onPress={() => router.push("/orders")} />
            <ListItem icon={Newspaper} tint="habits" title="Wellness feed" subtitle="Tips, workouts and reads for you" right={<PhaseBadge phase={2} />} onPress={() => router.push("/feed")} />
            <ListItem icon={CalendarRange} tint="sleep" title="Wellness programs" subtitle="Multi-week programs with weekly goals" right={<PhaseBadge phase={2} />} onPress={() => router.push("/programs")} />
            <ListItem icon={Bot} tint="workout" title="AI Coach" subtitle="Personal tips and a 7-day plan" right={<PhaseBadge phase={2} />} onPress={() => router.push("/coach")} />
          </ListGroup>

          <SectionHeader title="App & privacy" />
          <ListGroup>
            <ListItem icon={Watch} tint="steps" title="Connected apps" subtitle={p.connectedApps.length ? p.connectedApps.join(", ") : "Not connected"} onPress={() => router.push("/settings/connected-apps")} />
            <ListItem icon={Bell} tint="points" title="Notifications" subtitle={p.notificationsOn ? "On" : "Off"} onPress={() => router.push("/settings/notifications")} />
            <ListItem icon={ShieldCheck} tint="habits" title="Privacy & consent" onPress={() => router.push("/settings/privacy")} />
            <ListItem icon={LifeBuoy} tint="water" title="Help & support" subtitle="FAQs, contact us, my tickets" onPress={() => router.push("/help")} />
            <ListItem icon={Settings} tint="neutral" title="Settings" onPress={() => router.push("/settings")} testID="settings-row" />
          </ListGroup>
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  identity: { flexDirection: "row", alignItems: "center", gap: 16 },
  pill: { marginTop: 4 },
  edit: { marginTop: 16 },
  completionHead: { flexDirection: "row", alignItems: "center" },
  bar: { marginVertical: 10 },
  stats: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 14, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth },
})
