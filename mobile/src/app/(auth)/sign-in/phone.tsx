/** SCR-M-007 Phone Sign-in — country code + mobile number, then an SMS one-time code. */
import { router } from "expo-router"
import { Send, Smartphone } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { Button, Notice, SelectField, Text, TextField } from "@/components/ui"
import { AuthScreen } from "@/features/auth/auth-screen"
import { COUNTRY_CODES, countryOf, isValidMobile } from "@/features/auth/countries"
import { DemoHint, DemoRow, DemoValue } from "@/features/auth/demo-hint"
import { employeeAuthApi } from "@/lib/api/auth"
import { errorMessage } from "@/lib/api/hooks"
import { haptic } from "@/lib/haptics"

export default function PhoneSignInScreen() {
  const [countryCode, setCountryCode] = useState("IN")
  const [number, setNumber] = useState("")
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const country = countryOf(countryCode)
  const digits = number.replace(/\D/g, "")

  const send = async () => {
    setError(null)
    if (!isValidMobile(country, digits)) {
      haptic.error()
      setFieldError("Enter a valid mobile number.")
      return
    }
    setFieldError(undefined)
    setBusy(true)
    try {
      const phone = `${country.dial}${digits}`
      const res = await employeeAuthApi.sendOtp({ phone })
      haptic.success()
      router.push({ pathname: "/verify", params: { channel: "phone", phone, destination: res.maskedPhone } })
    } catch (err) {
      haptic.error()
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthScreen
      icon={Smartphone}
      title="Sign in with your phone"
      description="We'll send a 6-digit code to the mobile number your company has on file."
      backHref="/sign-in"
      footer={<Button title="Send code" icon={Send} loading={busy} onPress={send} testID="send-code" />}
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      <View style={styles.row}>
        <SelectField
          label="Country"
          title="Country code"
          value={countryCode}
          options={COUNTRY_CODES.map((c) => ({ value: c.value, label: c.label }))}
          valueLabel={country.dial}
          onChange={setCountryCode}
          containerStyle={styles.country}
        />
        <TextField
          label="Mobile number"
          value={number}
          onChangeText={(t) => {
            setNumber(t.replace(/[^\d\s]/g, ""))
            if (fieldError) setFieldError(undefined)
          }}
          placeholder={country.example}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          maxLength={16}
          error={fieldError}
          containerStyle={styles.number}
          onSubmitEditing={send}
          testID="phone-input"
        />
      </View>
      <Text variant="caption" tone="muted">
        By tapping Send code you agree to receive a one-time SMS. Standard message rates may apply. You can request up to 3 codes every 15 minutes.
      </Text>
      <Button title="Use another method" variant="ghost" onPress={() => router.back()} />
      <DemoHint>
        <DemoRow label="Any valid number, e.g.">
          <DemoValue value="98765 43210" onPress={() => setNumber("98765 43210")} />
        </DemoRow>
        <Text variant="caption">Then use code 123456 (000000 = wrong code).</Text>
      </DemoHint>
    </AuthScreen>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  country: { width: 112 },
  number: { flex: 1 },
})
