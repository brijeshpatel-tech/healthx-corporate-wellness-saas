import { ChevronRight, type LucideIcon } from "lucide-react-native"
import type { ReactNode } from "react"
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"
import { RADIUS, type TintName } from "@/theme/tokens"
import { Text } from "./text"

export interface ListItemProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  /** Colour family for the icon tile. */
  tint?: TintName
  /** Custom element on the left instead of the icon (avatar, emoji…). */
  left?: ReactNode
  /** Value / element on the right (before the chevron). */
  right?: ReactNode
  onPress?: () => void
  /** Show the chevron (default when onPress is set). */
  chevron?: boolean
  destructive?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Settings-style row: icon tile, title, subtitle, value and chevron. 56 dp min height. */
export function ListItem({ title, subtitle, icon: Icon, tint = "neutral", left, right, onPress, chevron, destructive, style, testID }: ListItemProps) {
  const { colors, tint: getTint } = useTheme()
  const t = destructive ? getTint("danger") : getTint(tint)
  const content = (
    <>
      {left ?? (Icon ? (
        <View style={[styles.iconTile, { backgroundColor: t.bg }]}>
          <Icon size={18} color={t.fg} strokeWidth={2.1} />
        </View>
      ) : null)}
      <View style={styles.body}>
        <Text variant="bodyMedium" tone={destructive ? "destructive" : "default"} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {typeof right === "string" ? (
        <Text variant="caption" tone="muted">
          {right}
        </Text>
      ) : (
        right
      )}
      {(chevron ?? !!onPress) ? <ChevronRight size={18} color={colors.mutedForeground} /> : null}
    </>
  )
  if (!onPress) return <View style={[styles.row, style]} testID={testID}>{content}</View>
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={() => {
        haptic.tap()
        onPress()
      }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.muted }, style]}
    >
      {content}
    </Pressable>
  )
}

/** Groups ListItems in a rounded card with hairline separators. */
export function ListGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme()
  const items = (Array.isArray(children) ? children : [children]).flat().filter(Boolean)
  return (
    <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      {items.map((child, i) => (
        <View key={i}>
          {i > 0 ? <View style={[styles.separator, { backgroundColor: colors.border }]} /> : null}
          {child}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  iconTile: { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 1 },
  group: { borderRadius: RADIUS.xl, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 64 },
})
