import { Check, ChevronDown } from "lucide-react-native"
import { useState } from "react"
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"
import { BottomSheet } from "./sheet"
import { Text } from "./text"

export interface SelectOption<T extends string> {
  value: T
  label: string
  description?: string
}

export interface SelectFieldProps<T extends string> {
  label?: string
  value: T | "" | null | undefined
  options: SelectOption<T>[]
  onChange: (value: T) => void
  placeholder?: string
  /** Short text for the closed field (e.g. "+91") when the option labels are long. */
  valueLabel?: string
  error?: string
  hint?: string
  /** Sheet title (defaults to the label). */
  title?: string
  containerStyle?: StyleProp<ViewStyle>
  testID?: string
}

/** Field that opens a bottom sheet with a list of options (timezone, country code, gender…). */
export function SelectField<T extends string>({ label, value, options, onChange, placeholder = "Choose…", valueLabel, error, hint, title, containerStyle, testID }: SelectFieldProps<T>) {
  const { colors } = useTheme()
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text variant="label" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? title ?? "Select"}: ${selected?.label ?? placeholder}`}
        onPress={() => {
          haptic.tap()
          setOpen(true)
        }}
        style={[styles.field, { borderColor: error ? colors.destructive : colors.input, backgroundColor: colors.card }]}
      >
        <Text variant="body" tone={selected ? "default" : "muted"} style={styles.flex} numberOfLines={1}>
          {selected ? (valueLabel ?? selected.label) : placeholder}
        </Text>
        <ChevronDown size={18} color={colors.mutedForeground} />
      </Pressable>
      {error ? (
        <Text variant="caption" tone="destructive">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
      <BottomSheet open={open} onClose={() => setOpen(false)} title={title ?? label}>
        <View style={styles.list}>
          {options.map((o) => {
            const active = o.value === value
            return (
              <Pressable
                key={o.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => {
                  haptic.select()
                  onChange(o.value)
                  setOpen(false)
                }}
                style={({ pressed }) => [styles.option, { backgroundColor: active ? colors.primarySoft : pressed ? colors.muted : "transparent" }]}
              >
                <View style={styles.flex}>
                  <Text variant="bodyMedium">{o.label}</Text>
                  {o.description ? (
                    <Text variant="caption" tone="muted">
                      {o.description}
                    </Text>
                  ) : null}
                </View>
                {active ? <Check size={18} color={colors.primary} strokeWidth={2.6} /> : null}
              </Pressable>
            )
          })}
        </View>
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { marginLeft: 2 },
  field: { minHeight: 52, borderWidth: 1, borderRadius: RADIUS.lg, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  flex: { flex: 1 },
  list: { gap: 4, marginHorizontal: -8 },
  option: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: RADIUS.md },
})
