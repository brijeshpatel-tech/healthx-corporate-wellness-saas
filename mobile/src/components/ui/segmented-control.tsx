import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"
import { Text } from "./text"

export interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}

/** iOS-style segmented toggle (Day / Week / Month, 7 days / 30 days…). */
export function SegmentedControl<T extends string>({ options, value, onChange, style, accessibilityLabel }: SegmentedControlProps<T>) {
  const { colors, isDark } = useTheme()
  return (
    <View style={[styles.track, { backgroundColor: colors.muted }, style]} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) return
              haptic.select()
              onChange(o.value)
            }}
            style={[styles.segment, active && { backgroundColor: isDark ? colors.secondary : colors.card }, active && !isDark && styles.activeShadow]}
          >
            <Text variant="label" tone={active ? "default" : "muted"} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", padding: 3, borderRadius: RADIUS.md + 2, gap: 2 },
  segment: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: RADIUS.md, paddingHorizontal: 8 },
  activeShadow: { shadowColor: "#0f172a", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
})
