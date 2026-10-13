import { Check } from "lucide-react-native"
import type { ReactNode } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"
import { Text } from "./text"

export interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  description?: string
  error?: boolean
  testID?: string
}

/** Tappable row with a checkbox (consents, acceptance). The whole row is the touch target. */
export function Checkbox({ checked, onChange, label, description, error, testID }: CheckboxProps) {
  const { colors } = useTheme()
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => {
        haptic.select()
        onChange(!checked)
      }}
      style={styles.row}
    >
      <View
        style={[
          styles.box,
          { borderColor: error ? colors.destructive : checked ? colors.primary : colors.input, backgroundColor: checked ? colors.primary : colors.card },
        ]}
      >
        {checked ? <Check size={16} color={colors.primaryForeground} strokeWidth={3} /> : null}
      </View>
      <View style={styles.text}>
        {typeof label === "string" ? <Text variant="bodyMedium">{label}</Text> : label}
        {description ? (
          <Text variant="caption" tone="muted">
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 8, minHeight: 44 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 1 },
  text: { flex: 1, gap: 2 },
})
