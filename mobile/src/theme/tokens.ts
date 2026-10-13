/**
 * Design tokens — the mobile version of web/src/app/globals.css.
 * Use them through `useTheme()` (colors follow light / dark mode); never hard-code greys in screens.
 */
import { Platform } from "react-native"

export type Scheme = "light" | "dark"

const light = {
  background: "#f6f8fa",
  foreground: "#161b26",
  card: "#ffffff",
  cardForeground: "#161b26",
  primary: "#059669",
  primaryForeground: "#f0fdf8",
  primarySoft: "rgba(5,150,105,0.10)",
  secondary: "#eef1f5",
  muted: "#f0f2f5",
  mutedForeground: "#5f6676",
  accent: "#e3f6ee",
  accentForeground: "#0f5a43",
  destructive: "#dc2626",
  destructiveSoft: "rgba(220,38,38,0.10)",
  success: "#16a34a",
  warning: "#d97706",
  info: "#2563eb",
  border: "#e4e7ec",
  input: "#d9dee6",
  ring: "#10b981",
  overlay: "rgba(15,23,42,0.45)",
  skeleton: "#e7eaef",
  tabBar: "#ffffff",
  shadow: "#0f172a",
}

const dark: typeof light = {
  background: "#0d1117",
  foreground: "#f3f5f8",
  card: "#161b24",
  cardForeground: "#f3f5f8",
  primary: "#34c48f",
  primaryForeground: "#062b1f",
  primarySoft: "rgba(52,196,143,0.14)",
  secondary: "#222833",
  muted: "#1e242e",
  mutedForeground: "#a2a9b6",
  accent: "#173d31",
  accentForeground: "#bdf1dc",
  destructive: "#f2665d",
  destructiveSoft: "rgba(242,102,93,0.14)",
  success: "#4ade80",
  warning: "#fbbf24",
  info: "#60a5fa",
  border: "rgba(255,255,255,0.09)",
  input: "rgba(255,255,255,0.16)",
  ring: "#34c48f",
  overlay: "rgba(0,0,0,0.6)",
  skeleton: "#232a35",
  tabBar: "#121720",
  shadow: "#000000",
}

export type ThemeColors = typeof light
export const COLORS: Record<Scheme, ThemeColors> = { light, dark }

/** Categorical chart colours — fixed order, validated for colour-vision deficiency (same as web). */
export const CHART: Record<Scheme, string[]> = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"],
}

/** Feature tints (icon colour + soft background) — same hues as the web tiles. */
const tint = (fgLight: string, fgDark: string, rgb: string) => ({
  light: { fg: fgLight, bg: `rgba(${rgb},0.12)` },
  dark: { fg: fgDark, bg: `rgba(${rgb},0.18)` },
})

export const TINTS = {
  steps: tint("#0284c7", "#38bdf8", "14,165,233"),
  water: tint("#0891b2", "#22d3ee", "6,182,212"),
  workout: tint("#7c3aed", "#a78bfa", "139,92,246"),
  habits: tint("#059669", "#34d399", "16,185,129"),
  sleep: tint("#4f46e5", "#818cf8", "99,102,241"),
  points: tint("#d97706", "#fbbf24", "245,158,11"),
  streak: tint("#ea580c", "#fb923c", "249,115,22"),
  insight: tint("#a21caf", "#e879f9", "192,38,211"),
  danger: tint("#dc2626", "#f87171", "239,68,68"),
  neutral: tint("#475569", "#cbd5e1", "100,116,139"),
}
export type TintName = keyof typeof TINTS

/** Brand gradient: emerald → teal → sky. */
export const BRAND_GRADIENT = ["#10b981", "#14b8a6", "#0284c7"] as const
export const BRAND_GRADIENT_SOFT = ["#ecfdf5", "#f0fdfa", "#f0f9ff"] as const

export const SPACE = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const
export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, pill: 999 } as const

/** Font families (loaded in the root layout with @expo-google-fonts). */
export const FONTS = {
  heading: "PlusJakartaSans_700Bold",
  headingHeavy: "PlusJakartaSans_800ExtraBold",
  headingSemi: "PlusJakartaSans_600SemiBold",
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const

/** Soft card shadow (iOS shadow + Android elevation + web boxShadow). */
export function shadow(scheme: Scheme, level: 1 | 2 = 1) {
  if (scheme === "dark") return {}
  return Platform.select({
    web: { boxShadow: level === 1 ? "0 1px 2px rgba(15,23,42,0.05), 0 4px 16px rgba(15,23,42,0.05)" : "0 8px 28px rgba(15,23,42,0.12)" },
    default: {
      shadowColor: "#0f172a",
      shadowOpacity: level === 1 ? 0.06 : 0.12,
      shadowRadius: level === 1 ? 10 : 18,
      shadowOffset: { width: 0, height: level === 1 ? 3 : 8 },
      elevation: level === 1 ? 2 : 6,
    },
  }) as object
}

/** Minimum touch target (dp). */
export const HIT = 44
