/**
 * Bottom tabs: Home, Activity, Challenges, Rewards, Profile (SCR-M-018 note — ASSUMPTION).
 * To add a tab: create src/app/(tabs)/<name>.tsx and add a <Tabs.Screen name="<name>" /> below.
 * Detail screens live outside (tabs) so they open full-screen over the tab bar.
 */
import { Tabs } from "expo-router/js-tabs"
import { Footprints, Gift, House, Trophy, UserRound, type LucideIcon } from "lucide-react-native"
import { Platform, type ColorValue } from "react-native"
import { useTheme } from "@/theme/theme"
import { FONTS } from "@/theme/tokens"

const icon = (Icon: LucideIcon) => {
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Icon size={23} color={color as string} strokeWidth={focused ? 2.4 : 2} />
  }
  return TabIcon
}

export default function TabsLayout() {
  const { colors } = useTheme()
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: FONTS.semibold, fontSize: 11, lineHeight: 15 },
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 68, paddingBottom: 10, paddingTop: 6 } : {}),
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: icon(House), tabBarButtonTestID: "tab-home" }} />
      <Tabs.Screen name="activity" options={{ title: "Activity", tabBarIcon: icon(Footprints), tabBarButtonTestID: "tab-activity" }} />
      <Tabs.Screen name="challenges" options={{ title: "Challenges", tabBarIcon: icon(Trophy), tabBarButtonTestID: "tab-challenges" }} />
      <Tabs.Screen name="rewards" options={{ title: "Rewards", tabBarIcon: icon(Gift), tabBarButtonTestID: "tab-rewards" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon(UserRound), tabBarButtonTestID: "tab-profile" }} />
    </Tabs>
  )
}
