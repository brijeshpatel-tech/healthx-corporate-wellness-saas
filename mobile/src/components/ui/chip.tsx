import type { LucideIcon } from "lucide-react-native"
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"
import { RADIUS, type TintName } from "@/theme/tokens"
import { Text } from "./text"

export interface ChipProps {
  label: string
  /** Selectable chip (filters, goal pickers). */
  selected?: boolean
  onPress?: () => void
  icon?: LucideIcon
  /** Emoji before the label (activity / goal pickers). */
  emoji?: string
  /** Colour for a static info chip, e.g. "points" or "streak". */
  tint?: TintName
  size?: "md" | "sm"
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}

/** Pill-shaped chip: info (with tint) or selectable (with selected state). */
export function Chip({ label, selected, onPress, icon: Icon, emoji, tint, size = "md", style, accessibilityLabel }: ChipProps) {
  const { colors, tint: getTint } = useTheme()
  const t = tint ? getTint(tint) : null
  const bg = selected ? colors.primary : t ? colors.card : colors.card
  const fg = selected ? colors.primaryForeground : colors.foreground
  const border = selected ? colors.primary : colors.border
  const content = (
    <>
      {emoji ? <Text variant={size === "sm" ? "caption" : "bodyMedium"}>{emoji}</Text> : null}
      {Icon ? <Icon size={size === "sm" ? 14 : 16} color={selected ? fg : (t?.fg ?? colors.mutedForeground)} strokeWidth={2.2} /> : null}
      <Text variant="label" color={fg} numberOfLines={1}>
        {label}
      </Text>
    </>
  )
  const chipStyle = [styles.chip, size === "sm" ? styles.sm : styles.md, { backgroundColor: bg, borderColor: border }, style]

  if (!onPress) return <View style={chipStyle}>{content}</View>
  return (
    <Pressable
      accessibilityRole={selected === undefined ? "button" : "checkbox"}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={4}
      onPress={() => {
        haptic.select()
        onPress()
      }}
      style={({ pressed }) => [...chipStyle, pressed && { opacity: 0.8 }]}
    >
      {content}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: RADIUS.pill, alignSelf: "flex-start" },
  md: { minHeight: 40, paddingHorizontal: 14 },
  sm: { minHeight: 32, paddingHorizontal: 10 },
})
