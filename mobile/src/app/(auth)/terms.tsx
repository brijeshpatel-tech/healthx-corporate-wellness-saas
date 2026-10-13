/** SCR-M-012 Terms & Privacy Acceptance — first sign-in and whenever a new version is published. */
import * as Device from "expo-device"
import { Redirect, router } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import { ExternalLink, FileText, LogOut, ShieldCheck } from "lucide-react-native"
import { useEffect, useState } from "react"
import { Platform, Pressable, StyleSheet, View } from "react-native"
import { Button, Card, Checkbox, ErrorState, Notice, SkeletonList, Text } from "@/components/ui"
import { AuthScreen } from "@/features/auth/auth-screen"
import { employeeAuthApi } from "@/lib/api/auth"
import { legalApi, onboardingApi } from "@/lib/api/employee/onboarding"
import { useApiQuery } from "@/lib/api/hooks"
import { useAuthStore, useSession } from "@/lib/auth/session"
import { formatDate } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import { useTheme } from "@/theme/theme"

async function continueAfterTerms(onboarded: boolean) {
  if (onboarded) return router.replace("/home")
  try {
    const state = await onboardingApi.state()
    router.replace(`/onboarding/${state.step}`)
  } catch {
    router.replace("/onboarding/profile")
  }
}

function Summary({ icon: Icon, title, points, url, linkLabel }: { icon: typeof FileText; title: string; points: string[]; url: string; linkLabel: string }) {
  const { colors } = useTheme()
  return (
    <Card>
      <View style={styles.summaryHead}>
        <Icon size={18} color={colors.primary} />
        <Text variant="subtitle">{title}</Text>
      </View>
      <View style={styles.points}>
        {points.map((p) => (
          <View key={p} style={styles.point}>
            <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
            <Text variant="caption" style={styles.flex}>
              {p}
            </Text>
          </View>
        ))}
      </View>
      <Pressable accessibilityRole="link" hitSlop={8} onPress={() => WebBrowser.openBrowserAsync(url).catch(() => toast.error("Couldn't open the document."))} style={styles.link}>
        <Text variant="label" tone="primary">
          {linkLabel}
        </Text>
        <ExternalLink size={14} color={colors.primary} />
      </Pressable>
    </Card>
  )
}

export default function TermsScreen() {
  const session = useSession("employee")
  const clearSession = useAuthStore((s) => s.clearSession)
  const [terms, setTerms] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const q = useApiQuery(["employee", "legal"], () => legalApi.current(), { enabled: !!session })
  const alreadyAccepted = !!q.data && q.data.acceptedVersion === q.data.version

  useEffect(() => {
    // Nothing new to accept → continue straight away (e.g. resuming onboarding).
    if (alreadyAccepted && session) continueAfterTerms(session.onboardingCompleted)
  }, [alreadyAccepted, session])

  if (!session) return <Redirect href="/welcome" />

  const accept = async () => {
    if (!terms || !privacy || !q.data) {
      haptic.error()
      setShowErrors(true)
      return
    }
    setBusy(true)
    setSaveError(false)
    try {
      await legalApi.accept({ version: q.data.version, termsAccepted: terms, privacyAccepted: privacy, device: `${Device.modelName ?? "Device"} · ${Platform.OS} ${Device.osVersion ?? ""}`.trim() })
      haptic.success()
      await continueAfterTerms(session.onboardingCompleted)
    } catch {
      haptic.error()
      setSaveError(true)
      setBusy(false)
    }
  }

  const signOut = async () => {
    await employeeAuthApi.logout().catch(() => undefined)
    clearSession("employee")
    router.replace("/welcome")
  }

  return (
    <AuthScreen
      back={false}
      icon={ShieldCheck}
      title={session.onboardingCompleted ? "We've updated our terms" : "Before you start"}
      description="Please read and accept the HealthX Terms of Use and Privacy Policy."
      footer={
        <>
          <Button title="Accept & continue" loading={busy} disabled={!q.data || alreadyAccepted} onPress={accept} testID="accept-terms" />
          <Button title="Sign out" icon={LogOut} variant="ghost" onPress={signOut} />
        </>
      }
    >
      {q.isLoading || alreadyAccepted ? (
        <SkeletonList count={2} height={150} header={false} />
      ) : q.error ? (
        <ErrorState error={q.error} title="Couldn't load the terms" onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : q.data ? (
        <>
          {saveError ? <Notice tone="error">We couldn&apos;t record your acceptance. Please try again.</Notice> : null}
          <Summary icon={FileText} title="Terms of Use — in short" points={q.data.termsSummary} url={q.data.termsUrl} linkLabel="Read the full Terms of Use" />
          <Summary icon={ShieldCheck} title="Privacy Policy — in short" points={q.data.privacySummary} url={q.data.privacyUrl} linkLabel="Read the full Privacy Policy" />
          <View>
            <Checkbox checked={terms} onChange={setTerms} label="I accept the Terms of Use" error={showErrors && !terms} testID="check-terms" />
            <Checkbox checked={privacy} onChange={setPrivacy} label="I accept the Privacy Policy" description="Including how my wellness data is processed." error={showErrors && !privacy} testID="check-privacy" />
            {showErrors && (!terms || !privacy) ? (
              <Text variant="caption" tone="destructive">
                Tick both boxes to continue.
              </Text>
            ) : null}
          </View>
          <Text variant="small" tone="muted">
            Version {q.data.version} · published {formatDate(q.data.publishedAt)}
          </Text>
        </>
      ) : null}
    </AuthScreen>
  )
}

const styles = StyleSheet.create({
  summaryHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  points: { gap: 8 },
  point: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  flex: { flex: 1 },
  link: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, alignSelf: "flex-start" },
})
