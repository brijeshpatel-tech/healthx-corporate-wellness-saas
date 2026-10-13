import { useRef, useState } from "react"
import { Pressable, StyleSheet, TextInput, View } from "react-native"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"
import { Text } from "./text"

export interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  /** Called once all digits are entered. */
  onComplete?: (value: string) => void
  length?: number
  error?: boolean
  autoFocus?: boolean
  disabled?: boolean
}

/**
 * 6-box one-time-code input. One real (invisible) TextInput sits on top of the boxes,
 * so paste and SMS auto-fill (iOS oneTimeCode / Android sms-otp) work.
 */
export function OtpInput({ value, onChange, onComplete, length = 6, error, autoFocus = true, disabled }: OtpInputProps) {
  const { colors } = useTheme()
  const ref = useRef<TextInput>(null)
  const [focused, setFocused] = useState(false)
  const active = Math.min(value.length, length - 1)

  return (
    <Pressable onPress={() => ref.current?.focus()} style={styles.row} accessibilityLabel="One-time code">
      {Array.from({ length }, (_, i) => {
        const char = value[i] ?? ""
        const isActive = focused && i === active
        return (
          <View
            key={i}
            style={[
              styles.box,
              {
                backgroundColor: colors.card,
                borderColor: error ? colors.destructive : isActive ? colors.primary : char ? colors.mutedForeground : colors.input,
                borderWidth: isActive || error ? 2 : 1,
              },
            ]}
          >
            <Text variant="title">{char}</Text>
          </View>
        )
      })}
      <TextInput
        ref={ref}
        value={value}
        editable={!disabled}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChangeText={(text) => {
          const digits = text.replace(/\D/g, "").slice(0, length)
          onChange(digits)
          if (digits.length === length) onComplete?.(digits)
        }}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        caretHidden
        accessibilityLabel="Enter the 6-digit code"
        testID="otp-input"
        style={styles.hiddenInput}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, justifyContent: "space-between" },
  box: { flex: 1, maxWidth: 56, aspectRatio: 0.86, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  hiddenInput: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: "transparent", fontSize: 1 },
})
