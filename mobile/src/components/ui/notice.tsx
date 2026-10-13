import { Info, Lightbulb, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react-native"
import type { ReactNode } from "react"
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"
import { Text } from "./text"

export type NoticeTone = "info" | "privacy" | "warning" | "error" | "demo"

export interface NoticeProps {
  tone?: NoticeTone
  title?: string
  children?: ReactNode
  icon?: LucideIcon
  style?: StyleProp<ViewStyle>
}

/** Inline callout: info, privacy note, warning, error, or demo hint (sample-data mode). */
export function Notice({ tone = "info", title, children, icon, style }: NoticeProps) {
  const { colors, tint } = useTheme()
  const map = {
    info: { t: tint("steps"), Icon: Info },
    privacy: { t: tint("habits"), Icon: ShieldCheck },
    warning: { t: tint("points"), Icon: TriangleAlert },
    error: { t: tint("danger"), Icon: TriangleAlert },
    demo: { t: tint("insight"), Icon: Lightbulb },
  }[tone]
  const Icon = icon ?? map.Icon
  return (
    <View
      style={[
        styles.box,
        { backgroundColor: map.t.bg, borderColor: tone === "demo" ? map.t.fg : "transparent", borderStyle: tone === "demo" ? "dashed" : "solid" },
        style,
      ]}
      accessibilityRole={tone === "error" ? "alert" : undefined}
    >
      <Icon size={18} color={map.t.fg} strokeWidth={2.2} style={styles.icon} />
      <View style={styles.body}>
        {title ? <Text variant="label">{title}</Text> : null}
        {typeof children === "string" ? (
          <Text variant="caption" color={colors.foreground}>
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", gap: 10, padding: 12, borderRadius: RADIUS.lg, borderWidth: 1 },
  icon: { marginTop: 1 },
  body: { flex: 1, gap: 2 },
})
