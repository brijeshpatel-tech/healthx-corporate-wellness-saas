/** Onboarding (SCR-M-013 … SCR-M-017). Requires a session; the root layout redirects signed-out users. */
import { Stack } from "expo-router"
import { useTheme } from "@/theme/theme"

export default function OnboardingLayout() {
  const { colors } = useTheme()
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: "slide_from_right" }} />
}
