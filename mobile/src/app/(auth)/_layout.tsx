/** Public screens: splash, company identification, sign-in methods, verification, terms. */
import { Stack } from "expo-router"
import { useTheme } from "@/theme/theme"

export default function AuthLayout() {
  const { colors } = useTheme()
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: "slide_from_right" }} />
}
