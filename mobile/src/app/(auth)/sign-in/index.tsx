/** SCR-M-004 Sign-in Options — methods enabled for the company (+ SCR-M-010 Google / Microsoft). */
import * as WebBrowser from "expo-web-browser"
import { Redirect, router, useLocalSearchParams } from "expo-router"
import { ChevronRight, KeyRound, Mail, Smartphone, Ticket, type LucideIcon } from "lucide-react-native"
import { useState, type ReactNode } from "react"
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native"
import { Card, ErrorState, Skeleton, Text } from "@/components/ui"
import { AuthScreen } from "@/features/auth/auth-screen"
import { CompanyBadge } from "@/features/auth/company-badge"
import { DemoHint } from "@/features/auth/demo-hint"
import { completeSignIn } from "@/features/auth/sign-in"
import { employeeAuthApi, type CompanyLookup } from "@/lib/api/auth"
import { errorMessage, useApiQuery } from "@/lib/api/hooks"
import { useAuthStore } from "@/lib/auth/session"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

type Method = CompanyLookup["signInMethods"][number]

function GoogleMark() {
  return (
    <View style={[styles.brandTile, { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e5e7eb" }]}>
      <Text variant="heading" color="#4285F4">
        G
      </Text>
    </View>
  )
}

function MicrosoftMark() {
  return (
    <View style={[styles.brandTile, styles.msGrid]}>
      {["#f25022", "#7fba00", "#00a4ef", "#ffb900"].map((c) => (
        <View key={c} style={[styles.msSquare, { backgroundColor: c }]} />
      ))}
    </View>
  )
}

function MethodRow({ icon: Icon, mark, label, hint, onPress, loading, disabled, testID }: { icon?: LucideIcon; mark?: ReactNode; label: string; hint?: string; onPress: () => void; loading?: boolean; disabled?: boolean; testID?: string }) {
  const { colors, tint } = useTheme()
  const t = tint("habits")
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        haptic.tap()
        onPress()
      }}
      style={({ pressed }) => [styles.method, { backgroundColor: colors.card, borderColor: colors.border }, pressed && { backgroundColor: colors.muted }, disabled && !loading && { opacity: 0.5 }]}
    >
      {mark ?? (Icon ? (
        <View style={[styles.brandTile, { backgroundColor: t.bg }]}>
          <Icon size={20} color={t.fg} strokeWidth={2.1} />
        </View>
      ) : null)}
      <View style={styles.flex}>
        <Text variant="bodyMedium">{label}</Text>
        {hint ? (
          <Text variant="caption" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>
      {loading ? <ActivityIndicator color={colors.primary} /> : <ChevronRight size={18} color={colors.mutedForeground} />}
    </Pressable>
  )
}

export default function SignInOptionsScreen() {
  const pending = useAuthStore((s) => s.pendingCompany)
  const { email } = useLocalSearchParams<{ email?: string }>()
  const [busy, setBusy] = useState<"google" | "microsoft" | null>(null)
  const q = useApiQuery(["auth", "company", pending?.code], () => employeeAuthApi.identifyCompany({ query: pending!.code }), { enabled: !!pending })

  if (!pending) return <Redirect href="/welcome" />

  const oauth = async (provider: "google" | "microsoft") => {
    setBusy(provider)
    try {
      // TODO(real API): open the provider's sign-in sheet with expo-auth-session (client ids in .env),
      // then send the id token: employeeAuthApi.oauth({ provider, idToken }).
      const session = await employeeAuthApi.oauth({ provider })
      await completeSignIn(session)
    } catch (err) {
      const name = provider === "google" ? "Google" : "Microsoft"
      toast.error(`${name} sign-in didn't work`, { description: errorMessage(err) })
      setBusy(null)
    }
  }

  const methods = q.data?.signInMethods ?? []
  const has = (m: Method) => methods.includes(m)
  const openDoc = (url: string) => WebBrowser.openBrowserAsync(url).catch(() => toast.error("Couldn't open the page."))

  return (
    <AuthScreen
      icon={KeyRound}
      title="Sign in or join"
      description="Choose how you'd like to continue. New here? Use the email or phone your company has on file."
      backHref="/welcome"
      top={
        <Card padding={14}>
          <CompanyBadge name={q.data?.name ?? pending.name} branding={q.data?.branding} caption="Your company" />
          <Pressable accessibilityRole="button" onPress={() => router.replace("/welcome")} hitSlop={8} style={styles.change}>
            <Text variant="label" tone="primary">
              Not your company? Change
            </Text>
          </Pressable>
        </Card>
      }
    >
      {q.isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={64} radius={RADIUS.lg} />
          ))}
        </View>
      ) : q.error ? (
        <ErrorState title="Sign-in options could not be loaded. Try again." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : (
        <View style={styles.list}>
          {has("email") ? <MethodRow icon={Mail} label="Continue with email" hint="Password sign-in or create an account" onPress={() => router.push({ pathname: "/sign-in/email", params: email ? { email } : {} })} testID="method-email" /> : null}
          {has("phone") ? <MethodRow icon={Smartphone} label="Continue with phone" hint="We'll text you a 6-digit code" onPress={() => router.push("/sign-in/phone")} testID="method-phone" /> : null}
          {has("magic_link") ? <MethodRow icon={Mail} label="Email me a sign-in link" hint="No password needed" onPress={() => router.push({ pathname: "/magic-link", params: email ? { email } : {} })} testID="method-magic" /> : null}
          {has("google") ? <MethodRow mark={<GoogleMark />} label="Continue with Google" loading={busy === "google"} disabled={!!busy} onPress={() => oauth("google")} testID="method-google" /> : null}
          {has("microsoft") ? <MethodRow mark={<MicrosoftMark />} label="Continue with Microsoft" loading={busy === "microsoft"} disabled={!!busy} onPress={() => oauth("microsoft")} testID="method-microsoft" /> : null}
          <MethodRow icon={Ticket} label="I have an invitation" onPress={() => router.push("/invite")} />
        </View>
      )}

      <DemoHint>Google / Microsoft sign you in as Priya Sharma. For email, any password works.</DemoHint>

      <Text variant="caption" tone="muted" align="center" style={styles.legal}>
        By continuing you agree to the{" "}
        <Text variant="caption" tone="primary" onPress={() => openDoc("https://healthx.life/legal/terms")}>
          Terms of Use
        </Text>{" "}
        and{" "}
        <Text variant="caption" tone="primary" onPress={() => openDoc("https://healthx.life/legal/privacy")}>
          Privacy Policy
        </Text>
        .
      </Text>
    </AuthScreen>
  )
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  method: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.lg, borderWidth: 1 },
  brandTile: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  msGrid: { flexDirection: "row", flexWrap: "wrap", padding: 10, gap: 2, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e5e7eb" },
  msSquare: { width: 9, height: 9 },
  flex: { flex: 1, gap: 1 },
  change: { marginTop: 10, alignSelf: "flex-start" },
  legal: { marginTop: 4 },
})
