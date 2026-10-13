/** App-wide providers: React Query, theme (+ navigation theme), status bar and toasts. */
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { AppState, Platform } from "react-native"
import { ToastHost } from "@/components/ui"
import { ThemeProvider, useTheme } from "@/theme/theme"

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: true },
      mutations: { retry: 0 },
    },
  })
}

/** Refetch stale data when the app comes back to the foreground (React Query + AppState). */
function useAppFocusRefetch() {
  useEffect(() => {
    if (Platform.OS === "web") return
    const sub = AppState.addEventListener("change", (status) => focusManager.setFocused(status === "active"))
    return () => sub.remove()
  }, [])
}

function NavigationTheme({ children }: { children: ReactNode }) {
  const { colors, isDark } = useTheme()
  const navTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme
    return {
      ...base,
      colors: { ...base.colors, primary: colors.primary, background: colors.background, card: colors.card, text: colors.foreground, border: colors.border },
    }
  }, [colors, isDark])
  return (
    <NavigationThemeProvider value={navTheme}>
      <StatusBar style={isDark ? "light" : "dark"} />
      {children}
      <ToastHost />
    </NavigationThemeProvider>
  )
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient)
  useAppFocusRefetch()
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <NavigationTheme>{children}</NavigationTheme>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
