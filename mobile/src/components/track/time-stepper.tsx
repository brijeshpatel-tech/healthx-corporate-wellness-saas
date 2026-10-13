/** Time input: type HH:MM (24 h) or step with − / + (15 min by default). Always reports a valid "HH:MM". */
import { Minus, Plus, type LucideIcon } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, TextInput, View } from "react-native"
import { IconButton, Text } from "@/components/ui"
import { useTheme } from "@/theme/theme"
import { FONTS, RADIUS } from "@/theme/tokens"
import { formatHHMM, HHMM, maskTime, shiftTime } from "./utils"

export interface TimeStepperProps {
  label: string
  value: string
  onChange: (value: string) => void
  step?: number
  icon?: LucideIcon
  error?: string
  testID?: string
}

export function TimeStepper({ label, value, onChange, step = 15, icon: Icon, error, testID }: TimeStepperProps) {
  const { colors } = useTheme()
  const [text, setText] = useState(value)
  const [prev, setPrev] = useState(value)
  const [focused, setFocused] = useState(false)
  if (value !== prev) {
    setPrev(value)
    setText(value)
  }
  const valid = HHMM.test(value)
  const bump = (minutes: number) => onChange(shiftTime(valid ? value : "00:00", minutes))

  return (
    <View style={[styles.box, { backgroundColor: colors.card, borderColor: error ? colors.destructive : focused ? colors.ring : colors.input }]}>
      <View style={styles.label}>
        {Icon ? <Icon size={15} color={colors.mutedForeground} /> : null}
        <Text variant="label" tone="muted">
          {label}
        </Text>
      </View>
      <View style={styles.row}>
        <IconButton icon={Minus} size={40} accessibilityLabel={`${label} ${step} minutes earlier`} onPress={() => bump(-step)} />
        <View style={styles.value}>
          <TextInput
            value={text}
            onChangeText={(t) => {
              const m = maskTime(t)
              setText(m)
              if (HHMM.test(m)) onChange(m)
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false)
              if (!HHMM.test(text)) setText(value)
            }}
            keyboardType="number-pad"
            maxLength={5}
            selectTextOnFocus
            accessibilityLabel={`${label}, ${valid ? formatHHMM(value) : "not set"}. Type a 24-hour time`}
            selectionColor={colors.primary}
            style={[styles.input, { color: colors.foreground }]}
            testID={testID}
          />
          <Text variant="small" tone="muted">
            {valid ? formatHHMM(value) : "HH:MM"}
          </Text>
        </View>
        <IconButton icon={Plus} size={40} accessibilityLabel={`${label} ${step} minutes later`} onPress={() => bump(step)} />
      </View>
      {error ? (
        <Text variant="caption" tone="destructive" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 12, gap: 6, minWidth: 0 },
  label: { flexDirection: "row", alignItems: "center", gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  value: { flex: 1, alignItems: "center", minWidth: 0 },
  input: { fontFamily: FONTS.headingHeavy, fontSize: 24, lineHeight: 30, textAlign: "center", padding: 0, minWidth: 72, width: "100%", outlineWidth: 0, fontVariant: ["tabular-nums"] },
})
