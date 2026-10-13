/**
 * SCR-M-001 Splash — brand while the app starts; checks the minimum app version and the
 * saved sign-in, then routes to Company Identification, onboarding, Home or Update Required.
 */
import { LinearGradient } from "expo-linear-gradient"
import { router } from "expo-router"
import { HeartPulse, RotateCw, WifiOff } from "lucide-react-native"
import { useEffect, useState } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Button, Text } from "@/components/ui"
import { accountApi } from "@/lib/api/employee/onboarding"
import { APP_PLATFORM, APP_VERSION } from "@/lib/app-info"
import { getSession, useSession } from "@/lib/auth/session"
import { BRAND_GRADIENT, RADIUS } from "@/theme/tokens"

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function SplashScreen() {
  const insets = useSafeAreaInsets()
  const session = useSession("employee")
  const [offline, setOffline] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setOffline(false)
      try {
        // Keep the brand on screen briefly so the hand-off from the native splash feels smooth.
        const [config] = await Promise.all([accountApi.appConfig({ platform: APP_PLATFORM, version: APP_VERSION }), wait(700)])
        if (cancelled) return
        if (config.updateRequired) return router.replace("/update-required")
        const s = getSession("employee")
        if (!s) router.replace("/welcome")
        else if (!s.onboardingCompleted) router.replace("/terms")
        else router.replace("/home")
      } catch {
        if (!cancelled) setOffline(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [attempt])

  return (
    <LinearGradient colors={[...BRAND_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.fill, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.center}>
        <View style={styles.logoTile}>
          <HeartPulse size={52} color="#ffffff" strokeWidth={2.2} />
        </View>
        <Text variant="display" color="#ffffff" style={styles.word}>
          HealthX
        </Text>
        <Text variant="bodyMedium" color="rgba(255,255,255,0.85)">
          {session ? session.companyName : "Wellness that works for you"}
        </Text>
      </View>

      {offline ? (
        <View style={styles.errorCard} accessibilityRole="alert">
          <WifiOff size={22} color="#ffffff" />
          <Text variant="bodyMedium" color="#ffffff" align="center">
            You&apos;re offline. Check your connection and try again.
          </Text>
          <View style={styles.actions}>
            <Button title="Retry" icon={RotateCw} variant="secondary" size="md" onPress={() => setAttempt((a) => a + 1)} />
            {session?.onboardingCompleted ? <Button title="Continue" variant="ghost" size="md" onPress={() => router.replace("/home")} style={styles.ghost} /> : null}
          </View>
        </View>
      ) : (
        <View style={styles.loader}>
          <ActivityIndicator color="#ffffff" />
          <Text variant="caption" color="rgba(255,255,255,0.8)">
            Getting things ready…
          </Text>
        </View>
      )}
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  logoTile: { width: 96, height: 96, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  word: { fontSize: 38, lineHeight: 44 },
  loader: { alignItems: "center", gap: 10, minHeight: 80 },
  errorCard: { width: "100%", maxWidth: 420, alignItems: "center", gap: 12, padding: 18, borderRadius: RADIUS.xl, backgroundColor: "rgba(0,0,0,0.18)" },
  actions: { flexDirection: "row", gap: 10 },
  ghost: { backgroundColor: "rgba(255,255,255,0.15)" },
})
