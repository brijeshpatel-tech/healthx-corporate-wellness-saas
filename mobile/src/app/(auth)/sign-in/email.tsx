/** SCR-M-006 Email Sign-in / Registration. */
import { zodResolver } from "@hookform/resolvers/zod"
import { router, useLocalSearchParams } from "expo-router"
import { Lock, LogIn, Mail, UserPlus } from "lucide-react-native"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { Pressable, StyleSheet, View } from "react-native"
import { z } from "zod"
import { applyApiErrors, FormTextField } from "@/components/form"
import { Button, Notice, SegmentedControl, Text } from "@/components/ui"
import { AuthScreen } from "@/features/auth/auth-screen"
import { DemoHint, DemoRow, DemoValue } from "@/features/auth/demo-hint"
import { completeSignIn, PASSWORD_RULE } from "@/features/auth/sign-in"
import { employeeAuthApi } from "@/lib/api/auth"
import { errorMessage } from "@/lib/api/hooks"
import { mobileAuthApi } from "@/lib/api/mobile/auth-extra"
import { useAuthStore } from "@/lib/auth/session"
import { haptic } from "@/lib/haptics"
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/mock/demo-accounts"

type Mode = "signin" | "register"
const MAX_ATTEMPTS = 5
const LOCK_MS = 15 * 60_000

const schema = z
  .object({
    mode: z.enum(["signin", "register"]),
    email: z.string().trim().min(1, "Enter your email address").regex(/^\S+@\S+\.\S+$/, "Enter a valid email address"),
    password: z.string().min(1, "Enter your password"),
    confirm: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.mode !== "register") return
    if (!PASSWORD_RULE.test(v.password)) ctx.addIssue({ code: "custom", path: ["password"], message: "Use at least 8 characters with letters and numbers" })
    if (v.confirm !== v.password) ctx.addIssue({ code: "custom", path: ["confirm"], message: "Passwords don't match." })
  })
type Values = z.infer<typeof schema>

export default function EmailSignInScreen() {
  const params = useLocalSearchParams<{ email?: string; mode?: Mode }>()
  const company = useAuthStore((s) => s.pendingCompany)
  const [mode, setMode] = useState<Mode>(params.mode === "register" ? "register" : "signin")
  const [error, setError] = useState<string | null>(null)
  const [failures, setFailures] = useState(0)
  const [locked, setLocked] = useState(false)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { mode, email: params.email ?? "", password: "", confirm: "" },
  })
  // Unlock automatically after the lock period.
  useEffect(() => {
    if (!locked) return
    const t = setTimeout(() => {
      setLocked(false)
      setFailures(0)
      setError(null)
    }, LOCK_MS)
    return () => clearTimeout(t)
  }, [locked])

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    form.setValue("mode", next)
    form.clearErrors()
  }

  const submit = form.handleSubmit(async (values) => {
    if (locked) return
    setError(null)
    try {
      const session =
        values.mode === "register"
          ? await mobileAuthApi.register({ email: values.email.trim(), password: values.password, companyId: company?.id })
          : await employeeAuthApi.emailLogin({ email: values.email.trim(), password: values.password, companyId: company?.id })
      haptic.success()
      await completeSignIn(session)
    } catch (err) {
      haptic.error()
      if (applyApiErrors(form.setError, err, ["email", "password"])) return
      const next = failures + 1
      setFailures(next)
      if (values.mode === "signin" && next >= MAX_ATTEMPTS) {
        setLocked(true)
        setError("Too many attempts. Try again in 15 minutes.")
      } else setError(values.mode === "signin" ? "Email or password is incorrect." : errorMessage(err))
    }
  })

  const fillDemo = (email: string) => {
    form.setValue("email", email, { shouldValidate: true })
    form.setValue("password", DEMO_PASSWORD, { shouldValidate: true })
  }

  return (
    <AuthScreen
      icon={mode === "signin" ? LogIn : UserPlus}
      title={mode === "signin" ? "Sign in with email" : "Create your account"}
      description={company ? `Use the work email ${company.name} has on file.` : "Use your work email address."}
      backHref="/sign-in"
      footer={
        <Button
          title={mode === "signin" ? "Sign in" : "Create account"}
          loading={form.formState.isSubmitting}
          disabled={locked}
          onPress={submit}
          testID="submit"
        />
      }
    >
      <SegmentedControl
        options={[
          { value: "signin", label: "Sign in" },
          { value: "register", label: "Create account" },
        ]}
        value={mode}
        onChange={switchMode}
        accessibilityLabel="Sign in or create account"
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <FormTextField
        control={form.control}
        name="email"
        label="Work email"
        icon={Mail}
        placeholder="you@company.com"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        testID="email-input"
      />
      <FormTextField
        control={form.control}
        name="password"
        label="Password"
        icon={Lock}
        secure
        placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
        autoCapitalize="none"
        autoComplete={mode === "register" ? "new-password" : "current-password"}
        textContentType={mode === "register" ? "newPassword" : "password"}
        hint={mode === "register" ? "At least 8 characters with letters and numbers" : undefined}
        onSubmitEditing={mode === "signin" ? submit : undefined}
        testID="password-input"
      />
      {mode === "register" ? (
        <FormTextField control={form.control} name="confirm" label="Confirm password" icon={Lock} secure placeholder="Type it again" autoCapitalize="none" autoComplete="new-password" />
      ) : null}

      <View style={styles.links}>
        {mode === "signin" ? (
          <Pressable accessibilityRole="button" hitSlop={10} onPress={() => router.push({ pathname: "/forgot-password", params: { email: form.getValues("email") } })}>
            <Text variant="label" tone="primary">
              Forgot password?
            </Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable accessibilityRole="button" hitSlop={10} onPress={() => router.back()}>
          <Text variant="label" tone="muted">
            Use another method
          </Text>
        </Pressable>
      </View>

      <DemoHint>
        <Text variant="caption">Any password works. Tap an account to fill it in:</Text>
        {DEMO_ACCOUNTS.employee.slice(0, 2).map((a) => (
          <DemoRow key={a.email} label={`${a.label}:`}>
            <DemoValue value={a.email} onPress={() => fillDemo(a.email)} />
          </DemoRow>
        ))}
      </DemoHint>
    </AuthScreen>
  )
}

const styles = StyleSheet.create({
  links: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 32 },
})
