/**
 * Root layout: loads fonts and the sample database, restores the saved session,
 * then renders the app. Route protection follows the web AuthGuard:
 *   - signed out            → /welcome (company identification)
 *   - onboarding not done   → /terms → /onboarding/*
 */
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular"
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium"
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold"
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold"
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold"
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold"
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold"
import { useFonts } from "expo-font"
import { router, Stack, useSegments } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { useEffect, useState } from "react"
import { AppProviders } from "@/components/providers"
import { env } from "@/config/env"
import { useAuthHydrated, useSession } from "@/lib/auth/session"
import { useTheme } from "@/theme/theme"

SplashScreen.preventAutoHideAsync().catch(() => undefined)

/** Routes anyone can open (the (auth) group: splash, welcome, sign-in, terms…). */
const PUBLIC_GROUPS = new Set(["(auth)", "+not-found", "_sitemap"])

function useProtectedRoutes() {
  const segments = useSegments()
  const session = useSession("employee")
  const first = segments[0] as string | undefined

  useEffect(() => {
    const isPublic = first === undefined || PUBLIC_GROUPS.has(first)
    if (isPublic) return
    if (!session) router.replace("/welcome")
    else if (!session.onboardingCompleted && first !== "onboarding") router.replace("/terms")
  }, [first, session])
}

function RootNavigator() {
  const { colors } = useTheme()
  useProtectedRoutes()
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: "slide_from_right" }}>
      <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
      <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
      <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
      <Stack.Screen name="activity/log" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
    </Stack>
  )
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  })
  const [dbReady, setDbReady] = useState(!env.useMock)
  const authHydrated = useAuthHydrated()

  useEffect(() => {
    if (!env.useMock) return
    // Sample-data mode: load the on-device database before any screen asks for data.
    import("@/lib/mock/db")
      .then((m) => m.initDb())
      .finally(() => setDbReady(true))
  }, [])

  const ready = (fontsLoaded || !!fontError) && dbReady && authHydrated
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined)
  }, [ready])

  if (!ready) return null
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  )
}
