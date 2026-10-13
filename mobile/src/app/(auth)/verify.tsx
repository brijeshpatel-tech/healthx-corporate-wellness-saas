/** SCR-M-008 One-Time Code (OTP) Verification. */
import { router, useLocalSearchParams } from "expo-router"
import { MessageSquareText, RotateCw } from "lucide-react-native"
import { useEffect, useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { Button, Notice, OtpInput, Text } from "@/components/ui"
import { AuthScreen } from "@/features/auth/auth-screen"
import { DemoHint, DemoRow, DemoValue } from "@/features/auth/demo-hint"
import { completeSignIn } from "@/features/auth/sign-in"
import { ApiError } from "@/lib/api/core"
import { employeeAuthApi } from "@/lib/api/auth"
import { errorMessage } from "@/lib/api/hooks"
import { haptic } from "@/lib/haptics"
import { DEMO_CODE } from "@/lib/mock/demo-accounts"
import { toast } from "@/lib/toast"
import { useTheme } from "@/theme/theme"

const RESEND_AFTER_S = 30
const CODE_TTL_MS = 10 * 60_000
const MAX_WRONG = 5
const MAX_RESENDS = 3

export default function VerifyScreen() {
  const { colors } = useTheme()
  const { phone = "", destination = "your phone" } = useLocalSearchParams<{ channel?: string; phone?: string; destination?: string }>()
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState(0)
  const [sentAt, setSentAt] = useState(() => Date.now())
  const [resends, setResends] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const secondsLeft = Math.max(0, RESEND_AFTER_S - Math.floor((now - sentAt) / 1000))
  const lockedOut = wrong >= MAX_WRONG

  const verify = async (value = code) => {
    if (value.length !== 6 || busy || lockedOut) return
    if (Date.now() - sentAt > CODE_TTL_MS) {
      setError("This code has expired. Request a new one.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const session = await employeeAuthApi.verifyOtp({ phone, code: value })
      haptic.success()
      await completeSignIn(session)
    } catch (err) {
      haptic.error()
      setCode("")
      const isWrongCode = err instanceof ApiError && err.status === 422
      if (isWrongCode) {
        const n = wrong + 1
        setWrong(n)
        const left = MAX_WRONG - n
        setError(left > 0 ? `That code isn't right. ${left} ${left === 1 ? "attempt" : "attempts"} left.` : "Too many wrong attempts. Request a new code.")
      } else setError(errorMessage(err))
      setBusy(false)
    }
  }

  const resend = async () => {
    if (resends >= MAX_RESENDS) {
      setError("Too many code requests. Try again later.")
      return
    }
    try {
      await employeeAuthApi.sendOtp({ phone })
      setResends((r) => r + 1)
      setSentAt(Date.now())
      setWrong(0)
      setError(null)
      setCode("")
      toast.success(`Code sent to ${destination}`)
    } catch (err) {
      toast.error("Couldn't send a new code", { description: errorMessage(err) })
    }
  }

  return (
    <AuthScreen
      icon={MessageSquareText}
      title="Enter the code"
      description={`We sent a 6-digit code to ${destination}. It expires in 10 minutes.`}
      backHref="/sign-in/phone"
      footer={<Button title="Verify" loading={busy} disabled={code.length !== 6 || lockedOut} onPress={() => verify()} testID="verify" />}
    >
      <OtpInput value={code} onChange={setCode} onComplete={verify} error={!!error} disabled={busy || lockedOut} />
      {error ? <Notice tone="error">{error}</Notice> : null}

      <View style={styles.row}>
        {secondsLeft > 0 ? (
          <Text variant="caption" tone="muted">
            Resend code in 0:{String(secondsLeft).padStart(2, "0")}
          </Text>
        ) : (
          <Pressable accessibilityRole="button" onPress={resend} hitSlop={10} style={styles.inline}>
            <RotateCw size={14} color={colors.primary} />
            <Text variant="label" tone="primary">
              Resend code
            </Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={10}>
          <Text variant="label" tone="muted">
            Change number
          </Text>
        </Pressable>
      </View>

      <DemoHint>
        <DemoRow label="Code:">
          <DemoValue
            value={DEMO_CODE}
            onPress={() => {
              setCode(DEMO_CODE)
              verify(DEMO_CODE)
            }}
          />
          <Text variant="caption" tone="muted">
            · 000000 simulates a wrong code
          </Text>
        </DemoRow>
      </DemoHint>
    </AuthScreen>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 32 },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
})
