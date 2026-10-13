/** Small shared pieces: IconTile, Divider, SwitchRow, StepIndicator, StatTile. */
import type { LucideIcon } from "lucide-react-native"
import type { ReactNode } from "react"
import { StyleSheet, Switch, View, type StyleProp, type ViewStyle } from "react-native"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"
import { RADIUS, type TintName } from "@/theme/tokens"
import { Text } from "./text"

/** Rounded square with a tinted icon (feature tiles, list rows). */
export function IconTile({ icon: Icon, tint, size = 40 }: { icon: LucideIcon; tint: TintName; size?: number }) {
  const { tint: getTint } = useTheme()
  const t = getTint(tint)
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
      <Icon size={size * 0.48} color={t.fg} strokeWidth={2.1} />
    </View>
  )
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme()
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }, style]} />
}

export interface SwitchRowProps {
  title: string
  description?: string
  value: boolean
  onValueChange: (value: boolean) => void
  disabled?: boolean
  icon?: LucideIcon
  tint?: TintName
  /** Small element after the title, e.g. <PhaseBadge />. */
  badge?: ReactNode
}

/** Label + description with a themed switch (48 dp row). */
export function SwitchRow({ title, description, value, onValueChange, disabled, icon, tint = "neutral", badge }: SwitchRowProps) {
  const { colors } = useTheme()
  return (
    <View style={styles.switchRow}>
      {icon ? <IconTile icon={icon} tint={tint} size={36} /> : null}
      <View style={styles.flex}>
        <View style={styles.titleRow}>
          <Text variant="bodyMedium">{title}</Text>
          {badge}
        </View>
        {description ? (
          <Text variant="caption" tone="muted">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        disabled={disabled}
        onValueChange={(v) => {
          haptic.select()
          onValueChange(v)
        }}
        trackColor={{ false: colors.input, true: colors.primary }}
        thumbColor="#ffffff"
        ios_backgroundColor={colors.input}
      />
    </View>
  )
}

/** "Step 2 of 4" header with segment bars (onboarding). */
export function StepIndicator({ step, total, label }: { step: number; total: number; label?: string }) {
  const { colors } = useTheme()
  return (
    <View style={styles.steps} accessibilityLabel={`Step ${step} of ${total}`}>
      <View style={styles.bars}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.bar, { backgroundColor: i < step ? colors.primary : colors.muted }]} />
        ))}
      </View>
      <Text variant="small" tone="muted">
        Step {step} of {total}
        {label ? ` · ${label}` : ""}
      </Text>
    </View>
  )
}

export interface StatTileProps {
  label: string
  value: string
  icon?: LucideIcon
  tint?: TintName
  hint?: ReactNode
  style?: StyleProp<ViewStyle>
}

/** Compact metric: icon, value and label (distance, calories, minutes…). */
export function StatTile({ label, value, icon, tint = "neutral", hint, style }: StatTileProps) {
  const { colors } = useTheme()
  return (
    <View style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      {icon ? <IconTile icon={icon} tint={tint} size={32} /> : null}
      <Text variant="heading" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="small" tone="muted" numberOfLines={1}>
        {label}
      </Text>
      {hint}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 6 },
  steps: { gap: 8 },
  bars: { flexDirection: "row", gap: 6 },
  bar: { flex: 1, height: 5, borderRadius: 3 },
  stat: { flex: 1, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 6, minWidth: 0 },
})
