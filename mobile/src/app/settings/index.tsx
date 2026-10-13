/** SCR-M-074 Settings — appearance, account links, help, legal, app version, reset sample data, sign out. */
import { useQueryClient } from "@tanstack/react-query"
import { router } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import { Bell, Database, Download, FileText, Globe, Info, LifeBuoy, LogOut, Ruler, ShieldCheck, SlidersHorizontal, Trash2, UserRound, Watch } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { Button, ConfirmDialog, ListGroup, ListItem, PhaseBadge, Screen, SectionHeader, SegmentedControl, Text } from "@/components/ui"
import { env } from "@/config/env"
import { employeeAuthApi } from "@/lib/api/auth"
import { APP_PLATFORM, APP_VERSION } from "@/lib/app-info"
import { useAuthStore, useSession } from "@/lib/auth/session"
import { haptic } from "@/lib/haptics"
import { usePreferences, type ThemePreference } from "@/lib/preferences"
import { toast } from "@/lib/toast"

const openDoc = (url: string) => WebBrowser.openBrowserAsync(url).catch(() => toast.error("Couldn't open the page."))

export default function SettingsScreen() {
  const qc = useQueryClient()
  const session = useSession("employee")
  const clearSession = useAuthStore((s) => s.clearSession)
  const theme = usePreferences((s) => s.theme)
  const setTheme = usePreferences((s) => s.setTheme)
  const [confirm, setConfirm] = useState<"signout" | "reset" | null>(null)
  const [busy, setBusy] = useState(false)

  const signOut = async () => {
    setBusy(true)
    try {
      await employeeAuthApi.logout()
    } catch {
      // Offline: local data is cleared now; the session is revoked when back online.
    }
    clearSession("employee")
    qc.clear()
    haptic.success()
    setBusy(false)
    setConfirm(null)
    router.replace("/welcome")
  }

  const resetSampleData = async () => {
    setBusy(true)
    const { resetDb } = await import("@/lib/mock/db")
    resetDb()
    qc.clear()
    setBusy(false)
    setConfirm(null)
    toast.success("Sample data reset")
    router.replace("/")
  }

  return (
    <Screen title="Settings" back backHref="/profile">
      <SectionHeader title="Appearance" />
      <SegmentedControl<ThemePreference>
        options={[
          { value: "system", label: "System" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
        value={theme}
        onChange={setTheme}
        accessibilityLabel="Theme"
      />

      <SectionHeader title="Account" />
      <ListGroup>
        <ListItem icon={UserRound} tint="steps" title="Account" subtitle={session?.user.email} onPress={() => router.push("/profile/edit")} />
        <ListItem icon={Bell} tint="points" title="Notifications" onPress={() => router.push("/settings/notifications")} />
        <ListItem icon={ShieldCheck} tint="habits" title="Privacy & consent" onPress={() => router.push("/settings/privacy")} />
        <ListItem icon={Watch} tint="steps" title="Connected apps & devices" onPress={() => router.push("/settings/connected-apps")} />
        <ListItem icon={Download} tint="sleep" title="Download my data" right={<PhaseBadge phase={2} />} onPress={() => router.push("/settings/download-data")} />
        <ListItem icon={SlidersHorizontal} tint="habits" title="Preferences" subtitle="Activities, workouts, food" onPress={() => router.push("/settings/preferences")} />
        <ListItem icon={Globe} tint="insight" title="Language" right="English" onPress={() => router.push("/settings/preferences")} />
        <ListItem icon={Ruler} tint="neutral" title="Units" right={<PhaseBadge phase={2} />} onPress={() => router.push("/settings/preferences")} />
      </ListGroup>

      <SectionHeader title="Help & legal" />
      <ListGroup>
        <ListItem icon={LifeBuoy} tint="water" title="Help & support" subtitle="FAQs, missing steps, contact us" onPress={() => router.push("/help")} />
        <ListItem icon={FileText} tint="neutral" title="Terms of Use" onPress={() => openDoc("https://healthx.life/legal/terms")} />
        <ListItem icon={ShieldCheck} tint="neutral" title="Privacy Policy" onPress={() => openDoc("https://healthx.life/legal/privacy")} />
        <ListItem icon={Info} tint="neutral" title="App version" right={`${APP_VERSION} · ${APP_PLATFORM}`} />
      </ListGroup>

      {env.useMock ? (
        <>
          <SectionHeader title="Sample data" subtitle="The app is running without a backend" />
          <ListGroup>
            <ListItem icon={Database} tint="insight" title="Reset sample data" subtitle="Undo every change you've made in this demo" onPress={() => setConfirm("reset")} testID="reset-sample-data" />
          </ListGroup>
        </>
      ) : null}

      <View style={styles.danger}>
        <Button title="Sign out" icon={LogOut} variant="outline" onPress={() => setConfirm("signout")} testID="sign-out" />
        <Button title="Delete account" icon={Trash2} variant="ghost" onPress={() => router.push("/settings/delete-account")} />
      </View>
      <Text variant="small" tone="muted" align="center">
        {env.appName} · {env.appEnv}
        {env.useMock ? " · sample data" : ""}
      </Text>

      <ConfirmDialog
        open={confirm === "signout"}
        title="Sign out?"
        message="Your data on this phone will be cleared. Your progress is saved to your account."
        confirmLabel="Sign out"
        destructive
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={signOut}
      />
      <ConfirmDialog
        open={confirm === "reset"}
        title="Reset sample data?"
        message="Everything you've logged or changed in this demo will be replaced with fresh sample data."
        confirmLabel="Reset"
        destructive
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={resetSampleData}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  danger: { gap: 4, marginTop: 8 },
})
