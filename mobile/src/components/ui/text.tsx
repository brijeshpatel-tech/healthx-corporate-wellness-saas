import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native"
import { useTheme } from "@/theme/theme"
import { FONTS } from "@/theme/tokens"

export type TextVariant = "display" | "title" | "heading" | "subtitle" | "body" | "bodyMedium" | "label" | "caption" | "small" | "overline" | "number"
export type TextTone = "default" | "muted" | "primary" | "destructive" | "success" | "warning" | "inverse"

const VARIANTS: Record<TextVariant, TextStyle> = {
  display: { fontFamily: FONTS.headingHeavy, fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
  title: { fontFamily: FONTS.headingHeavy, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  heading: { fontFamily: FONTS.heading, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  subtitle: { fontFamily: FONTS.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: FONTS.medium, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: FONTS.semibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 18 },
  small: { fontFamily: FONTS.medium, fontSize: 11.5, lineHeight: 15 },
  overline: { fontFamily: FONTS.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8, textTransform: "uppercase" },
  number: { fontFamily: FONTS.headingHeavy, fontSize: 28, lineHeight: 34, letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
}

export interface TextProps extends RNTextProps {
  variant?: TextVariant
  tone?: TextTone
  /** Override the colour (e.g. white on gradients). */
  color?: string
  align?: TextStyle["textAlign"]
  weight?: "regular" | "medium" | "semibold" | "bold"
}

const WEIGHT = { regular: FONTS.regular, medium: FONTS.medium, semibold: FONTS.semibold, bold: FONTS.bold }

/** Text with the app's type scale. Headings use Plus Jakarta Sans, body uses Inter. */
export function Text({ variant = "body", tone = "default", color, align, weight, style, ...props }: TextProps) {
  const { colors } = useTheme()
  const toneColor: Record<TextTone, string> = {
    default: colors.foreground,
    muted: colors.mutedForeground,
    primary: colors.primary,
    destructive: colors.destructive,
    success: colors.success,
    warning: colors.warning,
    inverse: "#ffffff",
  }
  return (
    <RNText
      {...props}
      style={[VARIANTS[variant], { color: color ?? toneColor[tone] }, align ? { textAlign: align } : null, weight ? { fontFamily: WEIGHT[weight] } : null, style]}
    />
  )
}
