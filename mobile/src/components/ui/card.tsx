import type { ReactNode } from "react"
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"
import { RADIUS, shadow } from "@/theme/tokens"

export interface CardProps {
  children: ReactNode
  /** Makes the whole card tappable (with press feedback). */
  onPress?: () => void
  style?: StyleProp<ViewStyle>
  /** Inner padding, default 16. */
  padding?: number
  /** Removes the border and shadow (e.g. for nested / coloured cards). */
  flat?: boolean
  accessibilityLabel?: string
  testID?: string
}

/** Rounded surface for grouped content. */
export function Card({ children, onPress, style, padding = 16, flat, accessibilityLabel, testID }: CardProps) {
  const { colors, scheme } = useTheme()
  const base: ViewStyle = {
    backgroundColor: colors.card,
    borderRadius: RADIUS.xl,
    padding,
    ...(flat ? {} : { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadow(scheme) }),
  }
  if (!onPress) {
    return (
      <View style={[base, style]} testID={testID}>
        {children}
      </View>
    )
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        haptic.tap()
        onPress()
      }}
      style={({ pressed }) => [base, pressed && styles.pressed, style]}
    >
      {children}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
})
