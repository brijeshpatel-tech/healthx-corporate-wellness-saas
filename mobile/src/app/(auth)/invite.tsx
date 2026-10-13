/** SCR-M-005 Invitation Acceptance — open a company invitation (deep link or code) and create a password. */
import { router, useLocalSearchParams } from "expo-router"
import { Building2, CheckCircle2, Lock, Mail, Ticket, Users } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { Button, Card, Divider, ErrorState, Skeleton, Text, TextField } from "@/components/ui"
import { AuthScreen } from "@/features/auth/auth-screen"
import { CompanyLogo } from "@/features/auth/company-badge"
import { DemoHint, DemoRow, DemoValue } from "@/features/auth/demo-hint"
import { completeSignIn, PASSWORD_RULE } from "@/features/auth/sign-in"
import { employeeAuthApi } from "@/lib/api/auth"
import { errorMessage, useApiQuery } from "@/lib/api/hooks"
import { useAuthStore } from "@/lib/auth/session"
import { formatDate } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { DEMO_INVITE_TOKEN } from "@/lib/mock/demo-accounts"
import { toast } from "@/lib/toast"
import { useTheme } from "@/theme/theme"

function DetailRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  const { colors } = useTheme()
  return (
    <View style={styles.detail}>
      <Icon size={18} color={colors.mutedForeground} />
      <View style={styles.flex}>
        <Text variant="small" tone="muted">
          {label}
        </Text>
        <Text variant="bodyMedium">{value || "—"}</Text>
      </View>
    </View>
  )
}

function EnterCode({ onSubmit }: { onSubmit: (token: string) => void }) {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string>()
  const submit = () => {
    if (code.trim().length < 6) {
      setError("Enter the invitation code from your email or SMS")
      return
    }
    onSubmit(code.trim())
  }
  return (
    <AuthScreen
      icon={Ticket}
      title="Enter your invitation"
      description="Opened the app without the link? Type the invitation code from your HR team's email or SMS."
      footer={<Button title="Continue" onPress={submit} />}
    >
      <TextField label="Invitation code" value={code} onChangeText={(t) => {
          setCode(t)
          setError(undefined)
        }} placeholder="e.g. NIMBUS-WELCOME-2026" autoCapitalize="characters" autoCorrect={false} error={error} onSubmitEditing={submit} testID="invite-code" />
      <DemoHint>
        <DemoRow label="Invitation code:">
          <DemoValue value={DEMO_INVITE_TOKEN} onPress={() => setCode(DEMO_INVITE_TOKEN)} />
        </DemoRow>
      </DemoHint>
    </AuthScreen>
  )
}

export default function InviteScreen() {
  const params = useLocalSearchParams<{ token?: string }>()
  const [token, setToken] = useState(params.token ?? "")
  const [password, setPassword] = useState("")
  const [pwError, setPwError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const setPendingCompany = useAuthStore((s) => s.setPendingCompany)
  const q = useApiQuery(["auth", "invitation", token], () => employeeAuthApi.getInvitation({ token }), { enabled: !!token, retry: false })

  if (!token) return <EnterCode onSubmit={setToken} />

  const accept = async () => {
    if (!PASSWORD_RULE.test(password)) {
      haptic.error()
      setPwError("Use at least 8 characters with letters and numbers")
      return
    }
    setBusy(true)
    try {
      const session = await employeeAuthApi.acceptInvitation({ token, password })
      if (q.data) setPendingCompany({ id: q.data.company.id, name: q.data.company.name, code: q.data.company.code })
      haptic.success()
      toast.success("Invitation accepted")
      await completeSignIn(session)
    } catch (err) {
      haptic.error()
      toast.error("Couldn't accept the invitation", { description: errorMessage(err) })
      setBusy(false)
    }
  }

  return (
    <AuthScreen
      icon={q.data ? undefined : Ticket}
      title={q.data ? `Join ${q.data.company.name}` : "Your invitation"}
      description={q.data ? `You've been invited to join ${q.data.company.name} on HealthX.` : undefined}
      top={q.data ? <CompanyLogo branding={q.data.company.branding} size={56} /> : null}
      footer={
        q.data ? (
          <>
            <Button title="Accept & continue" icon={CheckCircle2} loading={busy} onPress={accept} testID="accept-invite" />
            <Button title="Not you? Use another account" variant="ghost" onPress={() => router.replace("/welcome")} />
          </>
        ) : null
      }
    >
      {q.isLoading ? (
        <Skeleton height={220} />
      ) : q.error ? (
        <ErrorState
          title={q.error.status === 404 ? "We couldn't find that invitation" : "This invitation can't be used"}
          error={q.error.status === 404 ? "Check the code, or ask your HR team to send a new one." : "This invitation has expired or was cancelled. Ask your HR team to send a new one."}
          onRetry={() => setToken("")}
        />
      ) : q.data ? (
        <>
          <Card padding={4}>
            <DetailRow icon={Mail} label="Email" value={q.data.email} />
            <Divider style={styles.divider} />
            <DetailRow icon={Building2} label="Department" value={q.data.department} />
            <Divider style={styles.divider} />
            <DetailRow icon={Users} label="Team" value={q.data.team} />
          </Card>
          <Text variant="caption" tone="muted">
            Hi {q.data.firstName}! These details come from your HR team. Invitation valid until {formatDate(q.data.expiresAt)}.
          </Text>
          <TextField
            label="Create a password"
            icon={Lock}
            secure
            value={password}
            onChangeText={(t) => {
              setPassword(t)
              setPwError(undefined)
            }}
            placeholder="At least 8 characters"
            hint="At least 8 characters with letters and numbers"
            error={pwError}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            testID="invite-password"
          />
          <DemoHint>Any password like “Welcome2026” works. You&apos;ll go through onboarding as Karan.</DemoHint>
        </>
      ) : null}
    </AuthScreen>
  )
}

const styles = StyleSheet.create({
  detail: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  divider: { marginLeft: 42 },
  flex: { flex: 1 },
})
