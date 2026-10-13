/** SCR-M-002 App Update Required — blocks outdated versions and links to the store. */
import { router, useLocalSearchParams } from "expo-router"
import { ArrowUpCircle, Sparkles } from "lucide-react-native"
import { Linking, StyleSheet, View } from "react-native"
import { Button, Card, ErrorState, Screen, Skeleton, Text } from "@/components/ui"
import { GradientIcon, SoftBrandBackground } from "@/features/auth/auth-screen"
import { accountApi } from "@/lib/api/employee/onboarding"
import { useApiQuery } from "@/lib/api/hooks"
import { APP_PLATFORM, APP_VERSION } from "@/lib/app-info"
import { toast } from "@/lib/toast"
import { useTheme } from "@/theme/theme"

export default function UpdateRequiredScreen() {
  const { colors } = useTheme()
  // ?optional=1 → a recommended (not forced) update shows "Later".
  const { optional } = useLocalSearchParams<{ optional?: string }>()
  const q = useApiQuery(["app", "config", APP_PLATFORM, APP_VERSION], () => accountApi.appConfig({ platform: APP_PLATFORM, version: APP_VERSION }))
  const storeName = APP_PLATFORM === "ios" ? "the App Store" : "Google Play"

  const openStore = async () => {
    const url = q.data?.storeUrl
    try {
      if (!url) throw new Error("no url")
      await Linking.openURL(url)
    } catch {
      toast.error(`Please update HealthX from ${storeName}.`)
    }
  }

  return (
    <Screen
      noHeader
      background={<SoftBrandBackground height={360} />}
      footer={
        <>
          <Button title="Update now" icon={ArrowUpCircle} onPress={openStore} disabled={!q.data} />
          {optional ? <Button title="Later" variant="ghost" onPress={() => router.replace("/")} /> : null}
        </>
      }
    >
      <View style={styles.hero}>
        <GradientIcon icon={ArrowUpCircle} size={72} />
        <Text variant="title" align="center" accessibilityRole="header">
          Time for an update
        </Text>
        <Text variant="body" tone="muted" align="center">
          This version of HealthX is no longer supported. Update to keep tracking your steps, challenges and rewards.
        </Text>
      </View>

      {q.isLoading ? (
        <Skeleton height={140} />
      ) : q.error ? (
        <ErrorState error={q.error} title="Couldn't check for updates" onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : q.data ? (
        <Card>
          <View style={styles.versions}>
            <View>
              <Text variant="small" tone="muted">
                Installed
              </Text>
              <Text variant="subtitle">{q.data.installedVersion}</Text>
            </View>
            <View>
              <Text variant="small" tone="muted">
                Minimum
              </Text>
              <Text variant="subtitle">{q.data.minimumVersion}</Text>
            </View>
            <View>
              <Text variant="small" tone="muted">
                Latest
              </Text>
              <Text variant="subtitle" tone="primary">
                {q.data.latestVersion}
              </Text>
            </View>
          </View>
          <View style={[styles.notes, { borderTopColor: colors.border }]}>
            <Text variant="label">What&apos;s new</Text>
            {q.data.releaseNotes.map((n) => (
              <View key={n} style={styles.note}>
                <Sparkles size={14} color={colors.primary} />
                <Text variant="caption" style={styles.flex}>
                  {n}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: 12, paddingTop: 48, paddingBottom: 8 },
  versions: { flexDirection: "row", justifyContent: "space-between" },
  notes: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 12, gap: 8 },
  note: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  flex: { flex: 1 },
})
