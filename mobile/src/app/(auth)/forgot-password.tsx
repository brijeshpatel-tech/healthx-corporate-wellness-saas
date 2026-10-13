/**
 * SCR-M-011 Forgot / Reset Password.
 * Step 1: email → reset link (never discloses whether the account exists).
 * Step 2 (deep link healthx://forgot-password?token=…): new password with strength meter.
 */
import { zodResolver } from "@hookform/resolvers/zod"
import { router, useLocalSearchParams } from "expo-router"
import { KeyRound, Lock, Mail, MailCheck, Send, Wand2 } from "lucide-react-native"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { StyleSheet, View } from "react-native"
import { z } from "zod"
import { applyApiErrors, FormTextField } from "@/components/form"
import { Button, Notice, Text } from "@/components/ui"
import { env } from "@/config/env"
import { AuthScreen } from "@/features/auth/auth-screen"
import { DemoHint } from "@/features/auth/demo-hint"
import { PASSWORD_RULE, passwordStrength } from "@/features/auth/sign-in"
import { employeeAuthApi } from "@/lib/api/auth"
import { accountApi } from "@/lib/api/employee/onboarding"
import { errorMessage } from "@/lib/api/hooks"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import { useTheme } from "@/theme/theme"

const emailSchema = z.object({ email: z.string().trim().min(1, "Enter your email address").regex(/^\S+@\S+\.\S+$/, "Enter a valid email address") })
const resetSchema = z
  .object({ password: z.string().regex(PASSWORD_RULE, "Use at least 8 characters with letters and numbers"), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." })

function StrengthMeter({ password }: { password: string }) {
  const { colors } = useTheme()
  const { score, label } = passwordStrength(password)
  const color = score <= 1 ? colors.destructive : score === 2 ? colors.warning : colors.success
  return (
    <View style={styles.meter} accessibilityLabel={`Password strength: ${label}`}>
      <View style={styles.bars}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.bar, { backgroundColor: i <= score ? color : colors.muted }]} />
        ))}
      </View>
      <Text variant="small" tone="muted">
        {password ? label : "Use 8+ characters with letters and numbers"}
      </Text>
    </View>
  )
}

function RequestStep({ initialEmail, onDemoLink }: { initialEmail: string; onDemoLink: () => void }) {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const form = useForm<z.infer<typeof emailSchema>>({ resolver: zodResolver(emailSchema), defaultValues: { email: initialEmail } })
  const submit = form.handleSubmit(async ({ email }) => {
    try {
      await employeeAuthApi.forgotPassword({ email })
      haptic.success()
      setSentTo(email)
    } catch (err) {
      toast.error("Couldn't send the link", { description: errorMessage(err) })
    }
  })

  if (sentTo) {
    return (
      <AuthScreen
        icon={MailCheck}
        title="Check your email"
        description="If an account exists, we've sent a reset link. It's valid for 30 minutes."
        backHref="/sign-in/email"
        footer={<Button title="Back to sign in" onPress={() => router.replace("/sign-in/email")} />}
      >
        <Notice tone="info">{`Sent to ${sentTo}. Didn't get it? Check spam, or try again in a minute.`}</Notice>
        <DemoHint>
          <Button title="Open the reset link" icon={Wand2} variant="outline" size="sm" onPress={onDemoLink} style={styles.demoBtn} testID="demo-reset-link" />
        </DemoHint>
      </AuthScreen>
    )
  }

  return (
    <AuthScreen
      icon={KeyRound}
      title="Reset your password"
      description="Enter your work email and we'll send you a link to set a new password."
      backHref="/sign-in/email"
      footer={<Button title="Send reset link" icon={Send} loading={form.formState.isSubmitting} onPress={submit} />}
    >
      <FormTextField control={form.control} name="email" label="Work email" icon={Mail} placeholder="you@company.com" autoCapitalize="none" keyboardType="email-address" autoComplete="email" onSubmitEditing={submit} />
    </AuthScreen>
  )
}

function ResetStep({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null)
  const form = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { password: "", confirm: "" } })
  const password = useWatch({ control: form.control, name: "password" })
  const submit = form.handleSubmit(async ({ password: pw }) => {
    setError(null)
    try {
      await accountApi.resetPassword({ token, password: pw })
      haptic.success()
      toast.success("Password updated. Please sign in.")
      router.replace("/sign-in/email")
    } catch (err) {
      haptic.error()
      if (!applyApiErrors(form.setError, err)) setError(errorMessage(err))
    }
  })
  return (
    <AuthScreen
      icon={Lock}
      title="Choose a new password"
      description="You'll be signed out on your other devices."
      backHref="/sign-in/email"
      footer={<Button title="Save new password" loading={form.formState.isSubmitting} onPress={submit} />}
    >
      {error ? (
        <Notice tone="error" title={error}>
          <Button title="Request a new link" variant="ghost" size="sm" onPress={() => router.replace("/forgot-password")} style={styles.inlineBtn} />
        </Notice>
      ) : null}
      <FormTextField control={form.control} name="password" label="New password" icon={Lock} secure autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
      <StrengthMeter password={password} />
      <FormTextField control={form.control} name="confirm" label="Confirm new password" icon={Lock} secure autoCapitalize="none" autoComplete="new-password" onSubmitEditing={submit} />
    </AuthScreen>
  )
}

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string; token?: string }>()
  const [demoToken, setDemoToken] = useState<string | null>(null)
  const token = params.token ?? demoToken
  if (token) return <ResetStep token={token} />
  return <RequestStep initialEmail={params.email ?? ""} onDemoLink={() => env.useMock && setDemoToken("demo-reset-token")} />
}

const styles = StyleSheet.create({
  meter: { gap: 6, marginTop: -6 },
  bars: { flexDirection: "row", gap: 6 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  demoBtn: { marginTop: 8 },
  inlineBtn: { alignSelf: "flex-start", marginLeft: -12 },
})
