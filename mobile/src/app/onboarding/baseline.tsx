/** SCR-M-017 Wellness Baseline — onboarding complete; first Wellness Score and typical day. */
import { LinearGradient } from "expo-linear-gradient"
import { router } from "expo-router"
import { Droplets, Footprints, PartyPopper, Timer, Trophy, Watch } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Button, Card, EmptyState, ListGroup, ListItem, Notice, ProgressRing, Screen, Skeleton, StatTile, Text } from "@/components/ui"
import { onboardingApi } from "@/lib/api/employee/onboarding"
import { useApiQuery } from "@/lib/api/hooks"
import { useAuthStore } from "@/lib/auth/session"
import { formatMl, formatNumber } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import { BRAND_GRADIENT, RADIUS } from "@/theme/tokens"

export default function BaselineScreen() {
  const insets = useSafeAreaInsets()
  const updateSession = useAuthStore((s) => s.updateSession)
  const q = useApiQuery(["employee", "baseline"], () => onboardingApi.baseline())
  const [finishing, setFinishing] = useState<"home" | "challenges" | "water" | null>(null)
  const b = q.data

  const finish = async (to: "home" | "challenges" | "water") => {
    setFinishing(to)
    try {
      await onboardingApi.complete()
    } catch {
      toast.error("Couldn't finish onboarding — we'll try again later.")
    }
    haptic.success()
    updateSession("employee", { onboardingCompleted: true })
    router.replace(to === "home" ? "/home" : to === "challenges" ? "/challenges" : "/water/settings")
  }

  return (
    <Screen
      noHeader
      footer={
        <>
          <Button title="Go to Home" loading={finishing === "home"} disabled={!!finishing} onPress={() => finish("home")} feedback="success" testID="go-home" />
          <Button title="Browse challenges" icon={Trophy} variant="ghost" loading={finishing === "challenges"} disabled={!!finishing} onPress={() => finish("challenges")} />
        </>
      }
      background={<LinearGradient colors={[...BRAND_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.heroBg, { height: 260 + insets.top }]} />}
    >
      <View style={styles.hero}>
        <View style={styles.party}>
          <PartyPopper size={30} color="#ffffff" />
        </View>
        <Text variant="title" color="#ffffff" align="center" accessibilityRole="header">
          {b ? `You're all set, ${b.firstName}!` : "You're all set!"}
        </Text>
        <Text variant="body" color="rgba(255,255,255,0.9)" align="center">
          Here&apos;s your starting point. Small daily wins add up.
        </Text>
      </View>

      {q.isLoading ? (
        <Skeleton height={220} radius={RADIUS.xl} />
      ) : !b || q.error ? (
        <Notice tone="warning">Your baseline isn&apos;t available right now — you can still go to Home.</Notice>
      ) : !b.hasData ? (
        <Card>
          <EmptyState
            icon={Footprints}
            title="Your baseline is on its way"
            description="We'll show your baseline after a few days of activity."
            compact
          />
        </Card>
      ) : (
        <Card padding={18}>
          <View style={styles.scoreRow}>
            <ProgressRing value={b.score ?? 0} size={104} stroke={10} accessibilityLabel={`First Wellness Score ${b.score}`}>
              <Text variant="number">{b.score ?? "—"}</Text>
              <Text variant="small" tone="muted">
                of 100
              </Text>
            </ProgressRing>
            <View style={styles.flex}>
              <Text variant="subtitle">Your first Wellness Score</Text>
              <Text variant="caption" tone="muted">
                Based on {b.syncedDays} days of activity. It updates every day.
              </Text>
            </View>
          </View>
          <View style={styles.stats}>
            <StatTile icon={Footprints} tint="steps" label="Typical daily steps" value={formatNumber(b.typicalSteps)} />
            <StatTile icon={Timer} tint="workout" label="Active minutes / day" value={b.activeMinutes != null ? `${b.activeMinutes}` : "—"} />
          </View>
          <Text variant="caption" tone="muted" style={styles.goalNote}>
            Your daily step goal is set to {formatNumber(b.stepGoal)}. You can change it any time.
          </Text>
        </Card>
      )}

      <Text variant="heading">Next steps</Text>
      <ListGroup>
        {b?.suggestedChallenge ? (
          <ListItem
            icon={Trophy}
            tint="points"
            title={`Join “${b.suggestedChallenge.name}”`}
            subtitle={`${b.suggestedChallenge.emoji} Earn up to ${formatNumber(b.suggestedChallenge.points)} points`}
            onPress={() => finish("challenges")}
          />
        ) : null}
        <ListItem icon={Droplets} tint="water" title="Set your water goal" subtitle={b ? `Currently ${formatMl(b.waterGoalMl)} a day` : "Stay hydrated through the day"} onPress={() => finish("water")} />
        {b && !b.healthConnected ? <ListItem icon={Watch} tint="steps" title="Connect your health app" subtitle="Track steps automatically" onPress={() => router.replace("/onboarding/health")} /> : null}
      </ListGroup>
    </Screen>
  )
}

const styles = StyleSheet.create({
  heroBg: { position: "absolute", top: 0, left: 0, right: 0, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  hero: { alignItems: "center", gap: 8, paddingTop: 28, paddingBottom: 20, paddingHorizontal: 12 },
  party: { width: 64, height: 64, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  flex: { flex: 1, gap: 4 },
  stats: { flexDirection: "row", gap: 10, marginTop: 16 },
  goalNote: { marginTop: 12 },
})
