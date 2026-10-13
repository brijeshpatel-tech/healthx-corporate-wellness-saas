/**
 * SCR-M-009 Magic Link — email a one-time sign-in link, then wait for the tap.
 * Deep link: healthx://magic-link?email=…&token=… signs the user in on this device.
 */
import { router, useLocalSearchParams } from "expo-router"
import { Inbox, Mail, MailCheck, RotateCw, Send, Wand2 } from "lucide-react-native"
import { useEffect, useState } from "react"
import { Linking, Platform, StyleSheet, View } from "react-native"
import { Button, Card, Notice, Text, TextField } from "@/components/ui"
import { env } from "@/config/env"
import { AuthScreen } from "@/features/auth/auth-screen"
import { DemoHint } from "@/features/auth/demo-hint"
import { completeSignIn, maskEmail } from "@/features/auth/sign-in"
import { employeeAuthApi } from "@/lib/api/auth"
import { errorMessage } from "@/lib/api/hooks"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"

const RESEND_AFTER_S = 60
const EMAIL_RE = /^\S+@\S+\.\S+$/

export default function MagicLinkScreen() {
  const params = useLocalSearchParams<{ email?: string; token?: string }>()
  const [email, setEmail] = useState(params.email ?? "")
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [sentAt, setSentAt] = useState<number | null>(null)
  // Opened from the emailed link → busy while the link is checked.
  const [busy, setBusy] = useState(() => !!(params.token && params.email))
  const [linkError, setLinkError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!sentAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [sentAt])

  // Opened from the emailed link → sign in.
  useEffect(() => {
    if (!params.token || !params.email) return
    employeeAuthApi
      .consumeMagicLink({ email: params.email, token: params.token })
      .then((s) => {
        toast.success("You're signed in")
        return completeSignIn(s)
      })
      .catch(() => {
        setLinkError("This sign-in link has expired or was already used. Request a new one.")
        setBusy(false)
      })
  }, [params.email, params.token])

  const send = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      haptic.error()
      setFieldError("Enter a valid email address")
      return
    }
    setFieldError(undefined)
    setBusy(true)
    try {
      await employeeAuthApi.sendMagicLink({ email: email.trim() })
      haptic.success()
      setSentAt(Date.now())
      setNow(Date.now())
      setLinkError(null)
    } catch (err) {
      haptic.error()
      setFieldError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const openMail = async () => {
    try {
      await Linking.openURL(Platform.OS === "ios" ? "message://" : "mailto:")
    } catch {
      toast.info("Open your email app to find the link.")
    }
  }

  const simulateTap = async () => {
    setBusy(true)
    try {
      const s = await employeeAuthApi.consumeMagicLink({ email: email.trim(), token: "demo" })
      toast.success("You're signed in")
      await completeSignIn(s)
    } catch (err) {
      setLinkError(errorMessage(err))
      setBusy(false)
    }
  }

  if (sentAt) {
    const secondsLeft = Math.max(0, RESEND_AFTER_S - Math.floor((now - sentAt) / 1000))
    return (
      <AuthScreen
        icon={MailCheck}
        title="Check your email"
        description={`We sent a sign-in link to ${maskEmail(email.trim())}. Tap it on this phone to sign in — it works once, for 15 minutes.`}
        back={() => setSentAt(null)}
        footer={
          <>
            <Button title="Open email app" icon={Inbox} onPress={openMail} />
            <Button title={secondsLeft > 0 ? `Resend link in ${secondsLeft}s` : "Resend link"} icon={RotateCw} variant="outline" disabled={secondsLeft > 0 || busy} onPress={send} />
          </>
        }
      >
        {linkError ? <Notice tone="error">{linkError}</Notice> : null}
        <Card>
          <View style={styles.steps}>
            {["Open the email from HealthX", "Tap “Sign in to HealthX”", "You'll come straight back here, signed in"].map((s, i) => (
              <View key={s} style={styles.step}>
                <View style={styles.stepNum}>
                  <Text variant="label" tone="primary">
                    {i + 1}
                  </Text>
                </View>
                <Text variant="body" style={styles.flex}>
                  {s}
                </Text>
              </View>
            ))}
          </View>
        </Card>
        <Text variant="caption" tone="muted" align="center">
          Can&apos;t find it? Check your spam folder.
        </Text>
        <Button title="Use another method" variant="ghost" onPress={() => router.back()} />
        {env.useMock ? (
          <DemoHint>
            <Text variant="caption">No real email is sent in sample-data mode.</Text>
            <Button title="Simulate tapping the link" icon={Wand2} variant="outline" size="sm" loading={busy} onPress={simulateTap} style={styles.demoBtn} testID="simulate-link" />
          </DemoHint>
        ) : null}
      </AuthScreen>
    )
  }

  return (
    <AuthScreen
      icon={Mail}
      title="Email me a sign-in link"
      description="No password needed. We'll email you a secure link that signs you in."
      backHref="/sign-in"
      footer={<Button title="Send link" icon={Send} loading={busy} onPress={send} testID="send-link" />}
    >
      {linkError ? <Notice tone="error">{linkError}</Notice> : null}
      <TextField
        label="Work email"
        icon={Mail}
        value={email}
        onChangeText={(t) => {
          setEmail(t)
          if (fieldError) setFieldError(undefined)
        }}
        placeholder="you@company.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        error={fieldError}
        onSubmitEditing={send}
        testID="magic-email"
      />
      <DemoHint>Use priya.sharma@nimbustech.in, then tap “Simulate tapping the link”.</DemoHint>
    </AuthScreen>
  )
}

const styles = StyleSheet.create({
  steps: { gap: 14 },
  step: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(16,185,129,0.12)" },
  flex: { flex: 1 },
  demoBtn: { marginTop: 8 },
})
