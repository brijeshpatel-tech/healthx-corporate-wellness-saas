import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { Text } from "./text"

export interface SectionHeaderProps {
  title: string
  subtitle?: string
  /** Small text action on the right, e.g. "See all". */
  action?: { label: string; onPress: () => void }
  style?: StyleProp<ViewStyle>
}

/** Title row above a group of cards. */
export function SectionHeader({ title, subtitle, action, style }: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.text}>
        <Text variant="heading" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? (
        <Pressable accessibilityRole="button" hitSlop={10} onPress={action.onPress}>
          <Text variant="label" tone="primary">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: 8 },
  text: { flex: 1, gap: 2 },
})
