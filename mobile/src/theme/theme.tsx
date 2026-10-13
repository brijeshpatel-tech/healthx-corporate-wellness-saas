/**
 * Theme provider: light / dark following the system, unless the user picked one in Settings.
 *
 *   const { colors, scheme, chart, tint } = useTheme()
 *   <View style={{ backgroundColor: colors.card }} />
 */
import { createContext, useContext, useMemo, type ReactNode } from "react"
import { useColorScheme } from "react-native"
import { usePreferences } from "@/lib/preferences"
import { CHART, COLORS, TINTS, type Scheme, type ThemeColors, type TintName } from "./tokens"

export interface Theme {
  scheme: Scheme
  isDark: boolean
  colors: ThemeColors
  /** Categorical chart colours (fixed order). */
  chart: string[]
  /** Feature tint for icons / soft backgrounds. */
  tint: (name: TintName) => { fg: string; bg: string }
}

function buildTheme(scheme: Scheme): Theme {
  return {
    scheme,
    isDark: scheme === "dark",
    colors: COLORS[scheme],
    chart: CHART[scheme],
    tint: (name) => TINTS[name][scheme],
  }
}

const ThemeContext = createContext<Theme>(buildTheme("light"))

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme()
  const preference = usePreferences((s) => s.theme)
  const scheme: Scheme = preference === "system" ? (system === "dark" ? "dark" : "light") : preference
  const theme = useMemo(() => buildTheme(scheme), [scheme])
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
