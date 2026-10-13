/** SCR-M-077 Download My Data (Phase 2) — request a JSON copy, live "preparing" status, download / share when ready, link expiry. */
import { Activity, CalendarClock, CircleCheck, Coins, Download, Droplets, Dumbbell, FileJson, Hourglass, ShieldCheck, UserRound, type LucideIcon } from "lucide-react-native"
import { useState } from "react"
import { Platform, StyleSheet, View } from "react-native"
import { Bullet, GradientCard, HeroButton, saveTextFile } from "@/components/engage/shared"
import { Button, Card, ErrorState, IconTile, PhaseBadge, ProgressBar, Screen, SkeletonList, Text } from "@/components/ui"
import { privacyApi, type DataExport, type DataExportOverview } from "@/lib/api/employee/privacy"
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatDateTime } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import { useTheme } from "@/theme/theme"
import { RADIUS, type TintName } from "@/theme/tokens"

const INCLUDED_UI: Record<string, { icon: LucideIcon; tint: TintName }> = {
  profile: { icon: UserRound, tint: "steps" },
  activity: { icon: Activity, tint: "habits" },
  water_sleep: { icon: Droplets, tint: "water" },
  workouts_habits: { icon: Dumbbell, tint: "workout" },
  points: { icon: Coins, tint: "points" },
  consents: { icon: ShieldCheck, tint: "habits" },
}

function StatusCard({ current, validDays }: { current: DataExport | null; validDays: number }) {
  const { colors } = useTheme()
  const [downloading, setDownloading] = useState(false)
  const request = useApiMutation(privacyApi.requestDataExport, {
    success: "Request received — we're preparing your file.",
    errorTitle: "Couldn't create your export. Please try again later.",
    invalidate: [["employee", "privacy"]],
  })
  const download = async (exp: DataExport) => {
    setDownloading(true)
    try {
      const payload = await privacyApi.downloadDataExport({ id: exp.id })
      await saveTextFile(exp.fileName, JSON.stringify(payload, null, 2))
      haptic.success()
      if (Platform.OS === "web") toast.success("Your data is downloading.")
    } catch (err) {
      toast.error("Couldn't download your file", { description: errorMessage(err) })
    } finally {
      setDownloading(false)
    }
  }

  if (current?.status === "preparing")
    return (
      <GradientCard colors={["#0ea5e9", "#6366f1"]}>
        <View style={styles.row}>
          <View style={styles.badge}>
            <Hourglass size={22} color="#ffffff" />
          </View>
          <View style={styles.flex}>
            <Text variant="subtitle" color="#ffffff">
              Preparing your file…
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.9)">
              Requested {formatDateTime(current.requestedAt)}. We&apos;ll notify you when it&apos;s ready — you can leave this screen.
            </Text>
          </View>
        </View>
        <ProgressBar value={Math.round(current.progress * 100)} height={8} color="#ffffff" trackColor="rgba(255,255,255,0.25)" style={styles.mt14} />
        <Text variant="small" color="rgba(255,255,255,0.88)" style={styles.mt6} accessibilityLiveRegion="polite">
          {Math.round(current.progress * 100)}% prepared
        </Text>
      </GradientCard>
    )

  if (current?.status === "ready")
    return (
      <Card style={{ borderColor: colors.success }}>
        <View style={styles.row}>
          <IconTile icon={CircleCheck} tint="habits" size={46} />
          <View style={styles.flex}>
            <Text variant="subtitle">Your data is ready to download.</Text>
            <View style={styles.rowSm}>
              <CalendarClock size={14} color={colors.mutedForeground} />
              <Text variant="caption" tone="muted">
                Link expires {formatDateTime(current.expiresAt)}
              </Text>
            </View>
          </View>
        </View>
        <View style={[styles.file, { borderColor: colors.border }]}>
          <FileJson size={28} color={colors.success} />
          <View style={styles.flex}>
            <Text variant="label" numberOfLines={1}>
              {current.fileName}
            </Text>
            <Text variant="small" tone="muted">
              JSON · prepared {formatDate(current.readyAt)}
            </Text>
          </View>
        </View>
        <Button title={Platform.OS === "web" ? "Download" : "Download / share"} icon={Download} loading={downloading} onPress={() => download(current)} style={styles.mt12} testID="download-export" />
      </Card>
    )

  return (
    <GradientCard colors={["#6366f1", "#8b5cf6"]}>
      <View style={styles.row}>
        <View style={styles.badge}>
          <FileJson size={24} color="#ffffff" />
        </View>
        <View style={styles.flex}>
          <Text variant="subtitle" color="#ffffff">
            {current?.status === "expired" ? "Your last download link has expired" : "Request a copy of your data"}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.9)">
            {current?.status === "expired" ? `It expired on ${formatDate(current.expiresAt)}. Request a new copy any time.` : `It usually takes a few minutes. The link stays valid for ${validDays} days.`}
          </Text>
        </View>
      </View>
      <View style={styles.mt14}>
        <HeroButton title="Request my data" icon={Download} loading={request.isPending} onPress={() => request.mutate()} testID="request-export" />
      </View>
    </GradientCard>
  )
}

function Content({ data }: { data: DataExportOverview }) {
  return (
    <>
      <StatusCard current={data.current} validDays={data.linkValidDays} />
      <Card>
        <Text variant="subtitle">What&apos;s included</Text>
        <Text variant="caption" tone="muted">
          One file in JSON format — readable by most apps and easy to move to another service.
        </Text>
        <View style={styles.items}>
          {data.included.map((item) => {
            const ui = INCLUDED_UI[item.key] ?? { icon: FileJson, tint: "neutral" as TintName }
            return (
              <View key={item.key} style={styles.item}>
                <IconTile icon={ui.icon} tint={ui.tint} size={34} />
                <View style={styles.flex}>
                  <Text variant="label">{item.label}</Text>
                  <Text variant="small" tone="muted">
                    {item.description}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>
        <View style={styles.notes}>
          <Bullet>Only you can request your data, and you can have one active request at a time.</Bullet>
          <Bullet>{`We'll notify you when the file is ready. The download link is valid for ${data.linkValidDays} days.`}</Bullet>
          <Bullet>Your company never receives a copy of this file.</Bullet>
        </View>
      </Card>
    </>
  )
}

export default function DownloadDataScreen() {
  const q = useApiQuery(["employee", "privacy", "data-exports"], () => privacyApi.dataExports(), {
    // Poll while the file is being prepared so the status flips to "Ready" by itself.
    refetchInterval: (query) => (query.state.data?.current?.status === "preparing" ? 2000 : false),
  })
  return (
    <Screen title="Download my data" back backHref="/settings/privacy" right={<PhaseBadge phase={2} />} refreshing={q.isRefetching} onRefresh={() => q.refetch()} testID="download-data">
      {q.data ? (
        <Content data={q.data} />
      ) : q.error ? (
        <ErrorState title="Couldn't load your data requests." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : (
        <SkeletonList count={2} height={180} header={false} />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 3 },
  mt6: { marginTop: 6 },
  mt12: { marginTop: 12 },
  mt14: { marginTop: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowSm: { flexDirection: "row", alignItems: "center", gap: 6 },
  badge: { width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  file: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 12, marginTop: 14 },
  items: { gap: 12, marginTop: 14 },
  item: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  notes: { gap: 6, marginTop: 14 },
})
