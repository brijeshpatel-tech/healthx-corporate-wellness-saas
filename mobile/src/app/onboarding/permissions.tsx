/** SCR-M-015 Permissions — notifications and motion & fitness, each can be skipped (step 3 of 4). */
import { router } from "expo-router"
import { Bell, CheckCircle2, Footprints, ShieldCheck, XCircle, type LucideIcon } from "lucide-react-native"
import { useState } from "react"
import { Platform, StyleSheet, View } from "react-native"
import { Button, Card, IconTile, Notice, Text } from "@/components/ui"
import { OnboardingScreen } from "@/features/onboarding/onboarding-screen"
import { onboardingApi, type PermissionState } from "@/lib/api/employee/onboarding"
import { errorMessage } from "@/lib/api/hooks"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import { healthService } from "@/services/health"
import { pushService } from "@/services/push"
import { useTheme } from "@/theme/theme"
import type { TintName } from "@/theme/tokens"

function PermissionCard({
  icon,
  tint,
  title,
  body,
  state,
  busy,
  onAllow,
  onSkip,
}: {
  icon: LucideIcon
  tint: TintName
  title: string
  body: string
  state: PermissionState | null
  busy: boolean
  onAllow: () => void
  onSkip: () => void
}) {
  const { colors } = useTheme()
  return (
    <Card>
      <View style={styles.head}>
        <IconTile icon={icon} tint={tint} size={44} />
        <View style={styles.flex}>
          <Text variant="subtitle">{title}</Text>
          <Text variant="caption" tone="muted">
            {body}
          </Text>
        </View>
      </View>
      {state === null ? (
        <View style={styles.actions}>
          <Button title="Not now" variant="outline" size="md" block onPress={onSkip} style={styles.flex} />
          <Button title="Allow" size="md" block loading={busy} onPress={onAllow} style={styles.flex} />
        </View>
      ) : (
        <View style={styles.result}>
          {state === "granted" ? <CheckCircle2 size={18} color={colors.success} /> : <XCircle size={18} color={colors.mutedForeground} />}
          <Text variant="label" tone={state === "granted" ? "success" : "muted"}>
            {state === "granted" ? "Allowed" : state === "denied" ? "Not allowed — you can change this in Settings" : "Skipped for now"}
          </Text>
        </View>
      )}
    </Card>
  )
}

export default function PermissionsScreen() {
  const [notifications, setNotifications] = useState<PermissionState | null>(null)
  const [motion, setMotion] = useState<PermissionState | null>(null)
  const [busy, setBusy] = useState<"notifications" | "motion" | null>(null)
  const [saving, setSaving] = useState(false)

  const allowNotifications = async () => {
    setBusy("notifications")
    const result = await pushService.requestPermission()
    setNotifications(result === "granted" ? "granted" : "denied")
    if (result === "granted") haptic.success()
    setBusy(null)
  }

  const allowMotion = async () => {
    setBusy("motion")
    const result = await healthService.requestMotionPermission()
    setMotion(result)
    if (result === "granted") haptic.success()
    setBusy(null)
  }

  const next = async () => {
    setSaving(true)
    try {
      const n = notifications ?? "skipped"
      const pushToken = n === "granted" ? ((await pushService.getDeviceToken()) ?? undefined) : undefined
      await onboardingApi.savePermissions({ notifications: n, motion: motion ?? "skipped", pushToken })
      router.push("/onboarding/health")
    } catch (err) {
      toast.error("Couldn't save your choices", { description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <OnboardingScreen
      step={3}
      icon={ShieldCheck}
      title="Stay on track"
      description="Allow these so HealthX can count your steps and remind you at the right time. You can change them later."
      backHref="/onboarding/goals"
      footer={<Button title="Continue" loading={saving} onPress={next} testID="continue" />}
    >
      <PermissionCard
        icon={Bell}
        tint="points"
        title="Notifications"
        body="Water and habit reminders, challenge updates and your weekly summary. Quiet hours are respected."
        state={notifications}
        busy={busy === "notifications"}
        onAllow={allowNotifications}
        onSkip={() => setNotifications("skipped")}
      />
      <PermissionCard
        icon={Footprints}
        tint="steps"
        title={Platform.OS === "ios" ? "Motion & Fitness" : "Physical activity"}
        body="Lets your phone count steps and active minutes, even without a watch."
        state={motion}
        busy={busy === "motion"}
        onAllow={allowMotion}
        onSkip={() => setMotion("skipped")}
      />
      <Notice tone="privacy">We never share your activity with your employer — they only see combined numbers for groups of 5 or more.</Notice>
    </OnboardingScreen>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  flex: { flex: 1, gap: 2 },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  result: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
})
