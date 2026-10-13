/** Shared layout for sign-in / onboarding screens: soft brand gradient, icon, title, description. */
import { LinearGradient } from "expo-linear-gradient"
import type { LucideIcon } from "lucide-react-native"
import type { ReactNode } from "react"
import { StyleSheet, View } from "react-native"
import { Screen, Text } from "@/components/ui"
import { useTheme } from "@/theme/theme"
import { BRAND_GRADIENT } from "@/theme/tokens"

export interface AuthScreenProps {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  children: ReactNode
  /** Sticky bottom actions (primary button…). */
  footer?: ReactNode
  /** Back button (default true). Function = custom back. */
  back?: boolean | (() => void)
  backHref?: string
  /** Content above the title (step indicator, company badge…). */
  top?: ReactNode
  right?: ReactNode
  testID?: string
}

export function SoftBrandBackground({ height = 300 }: { height?: number }) {
  const { colors, isDark } = useTheme()
  return (
    <LinearGradient
      pointerEvents="none"
      colors={isDark ? ["rgba(16,185,129,0.16)", "rgba(2,132,199,0.06)", colors.background] : ["#e7f8f0", "#eef8fb", colors.background]}
      style={[styles.bg, { height }]}
    />
  )
}

export function GradientIcon({ icon: Icon, size = 56 }: { icon: LucideIcon; size?: number }) {
  return (
    <LinearGradient colors={[BRAND_GRADIENT[0], BRAND_GRADIENT[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.icon, { width: size, height: size, borderRadius: size * 0.32 }]}>
      <Icon size={size * 0.5} color="#ffffff" strokeWidth={2.1} />
    </LinearGradient>
  )
}

export function AuthScreen({ icon, title, description, children, footer, back = true, backHref = "/welcome", top, right, testID }: AuthScreenProps) {
  return (
    <Screen back={back} backHref={backHref} right={right} footer={footer} background={<SoftBrandBackground />} testID={testID} noHeader={!back && !right}>
      <View style={[styles.hero, !back && !right && styles.heroNoHeader]}>
        {top}
        {icon ? <GradientIcon icon={icon} /> : null}
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {typeof description === "string" ? (
          <Text variant="body" tone="muted">
            {description}
          </Text>
        ) : (
          description
        )}
      </View>
      {children}
    </Screen>
  )
}

const styles = StyleSheet.create({
  bg: { position: "absolute", top: 0, left: 0, right: 0 },
  icon: { alignItems: "center", justifyContent: "center", marginBottom: 4 },
  hero: { gap: 10, marginBottom: 4 },
  heroNoHeader: { paddingTop: 24 },
})
