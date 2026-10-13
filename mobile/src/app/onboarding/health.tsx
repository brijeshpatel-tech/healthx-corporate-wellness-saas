/** SCR-M-016 Health Integration — connect Apple Health / Health Connect, or skip (step 4 of 4). */
import { router } from "expo-router"
import { CheckCircle2, HeartPulse, Link2, RefreshCw } from "lucide-react-native"
import { useState } from "react"
import { Linking, StyleSheet, View } from "react-native"
import { Button, Card, Divider, Notice, PhaseBadge, SwitchRow, Text } from "@/components/ui"
import { GradientIcon } from "@/features/auth/auth-screen"
import { OnboardingScreen } from "@/features/onboarding/onboarding-screen"
import { onboardingApi } from "@/lib/api/employee/onboarding"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import { useTheme } from "@/theme/theme"
import { healthService } from "@/services/health"

export default function HealthIntegrationScreen() {
  const { colors } = useTheme()
  const [selected, setSelected] = useState<string[]>(healthService.dataTypes.map((t) => t.key))
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "failed">("idle")
  const [syncedDays, setSyncedDays] = useState(0)
  const [notInstalled, setNotInstalled] = useState<string | null>(null)
  const [skipping, setSkipping] = useState(false)
  const label = healthService.label

  const connect = async () => {
    if (!selected.length) return toast.error("Choose at least one type of data to share.")
    setStatus("connecting")
    try {
      const availability = await healthService.isAvailable()
      if (!availability.available) {
        setNotInstalled(availability.storeUrl ?? null)
        setStatus("failed")
        return
      }
      const { granted } = await healthService.requestPermissions(selected)
      if (!granted.length) throw new Error("denied")
      const res = await onboardingApi.connectHealth({ provider: healthService.provider, dataTypes: granted })
      setSyncedDays(res.syncedDays)
      setStatus("connected")
      haptic.success()
    } catch {
      haptic.error()
      setStatus("failed")
    }
  }

  const skip = async () => {
    setSkipping(true)
    try {
      await onboardingApi.skipHealth()
    } catch {
      // Not critical — Home shows the connect reminder card anyway.
    }
    router.push("/onboarding/baseline")
  }

  return (
    <OnboardingScreen
      step={4}
      title={`Connect ${label}`}
      description="Sync steps and activity automatically — no manual logging needed."
      backHref="/onboarding/permissions"
      footer={
        status === "connected" ? (
          <Button title="Continue" onPress={() => router.push("/onboarding/baseline")} testID="continue" />
        ) : (
          <>
            <Button title={status === "failed" ? "Try again" : "Connect"} icon={status === "failed" ? RefreshCw : Link2} loading={status === "connecting"} onPress={connect} testID="connect-health" />
            <Button title="Skip for now" variant="ghost" loading={skipping} disabled={status === "connecting"} onPress={skip} testID="skip-health" />
          </>
        )
      }
    >
      <Card padding={18}>
        <View style={styles.platform}>
          <GradientIcon icon={HeartPulse} size={52} />
          <View style={styles.flex}>
            <Text variant="heading">{label}</Text>
            <Text variant="caption" tone="muted">
              {healthService.provider === "apple_health" ? "Built into your iPhone" : "Android's health data hub"}
            </Text>
          </View>
          {status === "connected" ? <CheckCircle2 size={26} color={colors.success} accessibilityLabel="Connected" /> : null}
        </View>
      </Card>

      {status === "connected" ? (
        <Notice tone="privacy" title="Connected">
          {syncedDays ? `We synced your last ${syncedDays} days of activity.` : "Your steps will appear after the first sync."}
        </Notice>
      ) : null}
      {status === "failed" ? (
        <Notice tone="error">
          {notInstalled ? "Install the Health Connect app from Google Play, then try again." : `We couldn't connect to ${label}. You can try again from Profile > Connected apps.`}
        </Notice>
      ) : null}
      {notInstalled ? <Button title="Open Google Play" variant="outline" onPress={() => Linking.openURL(notInstalled).catch(() => undefined)} /> : null}

      <View>
        <Text variant="subtitle">Data HealthX will read</Text>
        <Text variant="caption" tone="muted">
          Read-only. HealthX never writes to {label}.
        </Text>
        <View style={styles.types}>
          {healthService.dataTypes.map((t, i) => (
            <View key={t.key}>
              {i > 0 ? <Divider /> : null}
              <SwitchRow
                title={t.label}
                description={t.description}
                badge={t.phase === 2 ? <PhaseBadge phase={2} /> : null}
                value={selected.includes(t.key)}
                disabled={status === "connected" || status === "connecting"}
                onValueChange={(on) => setSelected((s) => (on ? [...s, t.key] : s.filter((k) => k !== t.key)))}
              />
            </View>
          ))}
        </View>
      </View>

      <Notice tone="privacy">Your health data is encrypted and private. Your employer only sees combined numbers for groups of 5 or more — never yours.</Notice>
    </OnboardingScreen>
  )
}

const styles = StyleSheet.create({
  platform: { flexDirection: "row", alignItems: "center", gap: 14 },
  flex: { flex: 1 },
  types: { marginTop: 8 },
})
