import type { LucideIcon } from "lucide-react-native"
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"
import { HIT, RADIUS } from "@/theme/tokens"
import { Text } from "./text"

export type ButtonVariant = "primary" | "outline" | "ghost" | "destructive" | "secondary"
export type ButtonSize = "lg" | "md" | "sm"

export interface ButtonProps {
  title: string
  onPress?: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  disabled?: boolean
  /** Icon before the title (lucide component). */
  icon?: LucideIcon
  /** Icon after the title. */
  iconRight?: LucideIcon
  /** Stretch to the container width (default true for lg). */
  block?: boolean
  /** Haptic feedback on press (default "tap"; "success" for confirmations). */
  feedback?: "tap" | "success" | "none"
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
  testID?: string
}

const HEIGHT: Record<ButtonSize, number> = { lg: 52, md: HIT, sm: 36 }

/** Primary / outline / ghost / destructive buttons with loading state and haptics. */
export function Button({
  title,
  onPress,
  variant = "primary",
  size = "lg",
  loading,
  disabled,
  icon: Icon,
  iconRight: IconRight,
  block,
  feedback = "tap",
  style,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const { colors } = useTheme()
  const isDisabled = disabled || loading
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, fg: colors.primaryForeground },
    secondary: { bg: colors.secondary, fg: colors.foreground },
    outline: { bg: colors.card, fg: colors.foreground, border: colors.input },
    ghost: { bg: "transparent", fg: colors.primary },
    destructive: { bg: colors.destructive, fg: "#ffffff" },
  }
  const p = palette[variant]
  const iconSize = size === "sm" ? 16 : 18
  const fullWidth = block ?? size === "lg"

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      hitSlop={size === "sm" ? 6 : 0}
      onPress={() => {
        if (feedback === "tap") haptic.tap()
        else if (feedback === "success") haptic.success()
        onPress?.()
      }}
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHT[size],
          paddingHorizontal: size === "sm" ? 12 : 18,
          borderRadius: size === "sm" ? RADIUS.md : RADIUS.lg,
          backgroundColor: p.bg,
          borderWidth: p.border ? 1 : 0,
          borderColor: p.border,
          alignSelf: fullWidth ? "stretch" : "flex-start",
        },
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={p.fg} />
      ) : Icon ? (
        <Icon size={iconSize} color={p.fg} strokeWidth={2.2} />
      ) : null}
      <Text variant={size === "sm" ? "label" : "subtitle"} color={p.fg} numberOfLines={1}>
        {title}
      </Text>
      {IconRight && !loading ? (
        <View>
          <IconRight size={iconSize} color={p.fg} strokeWidth={2.2} />
        </View>
      ) : null}
    </Pressable>
  )
}

export interface IconButtonProps {
  icon: LucideIcon
  onPress?: () => void
  accessibilityLabel: string
  variant?: "outline" | "ghost" | "primary" | "soft"
  size?: number
  color?: string
  disabled?: boolean
  badge?: number
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Round icon-only button (44 dp touch target) with optional count badge. */
export function IconButton({ icon: Icon, onPress, accessibilityLabel, variant = "outline", size = HIT, color, disabled, badge, style, testID }: IconButtonProps) {
  const { colors } = useTheme()
  const bg = variant === "primary" ? colors.primary : variant === "soft" ? colors.primarySoft : variant === "outline" ? colors.card : "transparent"
  const fg = color ?? (variant === "primary" ? colors.primaryForeground : variant === "soft" ? colors.primary : colors.foreground)
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        haptic.tap()
        onPress?.()
      }}
      style={({ pressed }) => [
        styles.icon,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        variant === "outline" && { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Icon size={Math.round(size * 0.45)} color={fg} strokeWidth={2.1} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.destructive, borderColor: colors.background }]}>
          <Text variant="small" color="#fff" style={styles.badgeText}>
            {badge > 99 ? "99+" : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
  icon: { alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  badgeText: { fontSize: 10, lineHeight: 13 },
})
