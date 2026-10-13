/**
 * SCR-M-076 Connected Apps & Devices — Apple Health (iOS) / Health Connect (Android) through the HealthService,
 * Fitbit & Garmin accounts (Phase 2, provider sign-in). Connect, sync now, reconnect, disconnect (with confirm).
 */
import { LinearGradient } from "expo-linear-gradient"
import { Activity, CircleAlert, HeartPulse, Link2, Mountain, RefreshCw, ShieldCheck, Unlink, Watch, type LucideIcon } from "lucide-react-native"
import { useState } from "react"
import { Platform, StyleSheet, View } from "react-native"
import { GroupLabel } from "@/components/engage/shared"
import { BottomSheet, Button, Card, ConfirmDialog, EmptyState, ErrorState, Notice, PhaseBadge, Screen, SkeletonList, StatusPill, Text } from "@/components/ui"
import { privacyApi, type ConnectionRow, type ConnectionsOverview } from "@/lib/api/employee/privacy"
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatRelative } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import type { HealthProvider } from "@/lib/types"
import { healthService } from "@/services/health"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

const LOGO: Record<HealthProvider, { icon: LucideIcon; colors: [string, string] }> = {
  apple_health: { icon: HeartPulse, colors: ["#f43f5e", "#ec4899"] },
  health_connect: { icon: Activity, colors: ["#0ea5e9", "#10b981"] },
  fitbit: { icon: Watch, colors: ["#2dd4bf", "#0891b2"] },
  garmin: { icon: Mountain, colors: ["#64748b", "#1e293b"] },
}
const OAUTH: Partial<Record<HealthProvider, string>> = { fitbit: "Fitbit", garmin: "Garmin Connect" }
const STATUS: Record<ConnectionRow["status"], { status: string; label: string }> = {
  not_connected: { status: "draft", label: "Not connected" },
  connected: { status: "connected", label: "Connected" },
  error: { status: "error", label: "Sync error" },
  disconnected: { status: "pending", label: "Disconnected" },
}
/** Phone platforms that can't be used on this device. */
const otherPlatform = (p: HealthProvider) => (p === "apple_health" || p === "health_connect") && p !== healthService.provider && Platform.OS !== "web"

function Logo({ provider }: { provider: HealthProvider }) {
  const l = LOGO[provider]
  return (
    <LinearGradient colors={l.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logo}>
      <l.icon size={24} color="#ffffff" />
    </LinearGradient>
  )
}

function ConnectionCard({ row, busy, onConnect, onReconnect, onSync, onDisconnect }: { row: ConnectionRow; busy: "sync" | "connect" | null; onConnect: () => void; onReconnect: () => void; onSync: () => void; onDisconnect: () => void }) {
  const { colors } = useTheme()
  const s = STATUS[row.status]
  const unavailable = otherPlatform(row.provider)
  return (
    <Card style={row.status === "connected" ? { borderColor: colors.success } : row.status === "error" ? { borderColor: colors.destructive } : undefined} testID={`connection-${row.provider}`}>
      <View style={styles.head}>
        <Logo provider={row.provider} />
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <Text variant="subtitle">{row.name}</Text>
            {row.phase ? <PhaseBadge phase={row.phase} /> : null}
          </View>
          <Text variant="caption" tone="muted">
            {row.platform}
          </Text>
        </View>
        <StatusPill status={s.status} label={s.label} />
      </View>
      <View style={styles.types}>
        {row.dataTypes.map((t) => (
          <View key={t} style={[styles.type, { backgroundColor: colors.muted }]}>
            <Text variant="small" tone="muted">
              {t}
            </Text>
          </View>
        ))}
      </View>
      {row.status === "error" ? (
        <View style={[styles.error, { backgroundColor: colors.destructiveSoft }]}>
          <CircleAlert size={16} color={colors.destructive} />
          <Text variant="caption" tone="destructive" style={styles.flex}>
            Sync failed – tap Reconnect.
          </Text>
        </View>
      ) : null}
      <Text variant="small" tone="muted" style={styles.mt10}>
        {row.status === "disconnected"
          ? `Disconnected ${formatRelative(row.disconnectedAt)}${row.lastSyncAt ? ` · Last synced ${formatDate(row.lastSyncAt)}` : ""}`
          : row.status === "connected" || row.status === "error"
            ? `Last synced ${formatRelative(row.lastSyncAt)}${row.connectedAt ? ` · Connected since ${formatDate(row.connectedAt)}` : ""}`
            : unavailable
              ? `Only available on ${row.provider === "apple_health" ? "iPhone" : "Android phones"}.`
              : row.description}
      </Text>
      <View style={styles.actions}>
        {row.status === "connected" ? (
          <>
            <Button title="Disconnect" icon={Unlink} variant="ghost" size="md" onPress={onDisconnect} disabled={!!busy} />
            <Button title="Sync now" icon={RefreshCw} variant="outline" size="md" loading={busy === "sync"} onPress={onSync} testID={`sync-${row.provider}`} />
          </>
        ) : row.status === "error" ? (
          <>
            <Button title="Disconnect" icon={Unlink} variant="ghost" size="md" onPress={onDisconnect} disabled={!!busy} />
            <Button title="Reconnect" icon={RefreshCw} size="md" loading={busy === "connect"} onPress={onReconnect} />
          </>
        ) : (
          <Button title={row.status === "disconnected" ? "Reconnect" : "Connect"} icon={Link2} size="md" disabled={unavailable} loading={busy === "connect"} onPress={onConnect} testID={`connect-${row.provider}`} />
        )}
      </View>
    </Card>
  )
}

function ConnectSheet({ row, wearableConsent, minGroupSize, pending, onCancel, onConfirm }: { row: ConnectionRow | null; wearableConsent: boolean; minGroupSize: number; pending: boolean; onCancel: () => void; onConfirm: () => void }) {
  const oauth = row ? OAUTH[row.provider] : undefined
  const phoneTypes = row && !oauth ? healthService.dataTypes : null
  return (
    <BottomSheet
      open={!!row}
      onClose={onCancel}
      title={row ? `Connect ${row.name}` : "Connect"}
      description={oauth ? `You'll sign in with ${oauth} and choose what to share.` : "Your phone will ask which data HealthX can read."}
      footer={
        <>
          <Button title={oauth ? `Continue to ${row?.name}` : "Allow & connect"} loading={pending} onPress={onConfirm} testID="confirm-connect" />
          <Button title="Not now" variant="ghost" size="md" onPress={onCancel} disabled={pending} />
        </>
      }
    >
      {phoneTypes ? (
        <View style={styles.permList}>
          {phoneTypes.map((t) => (
            <View key={t.key} style={styles.perm}>
              <View style={styles.flex}>
                <View style={styles.titleRow}>
                  <Text variant="label">{t.label}</Text>
                  {t.phase === 2 ? <PhaseBadge phase={2} /> : null}
                </View>
                <Text variant="small" tone="muted">
                  {t.description}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.permList}>
          {(row?.dataTypes ?? []).map((t) => (
            <Text key={t} variant="caption">
              • {t}
            </Text>
          ))}
        </View>
      )}
      <Notice tone="privacy">{`HealthX only reads data — it never writes to your health apps. HR never sees data from your connected apps; your company only sees combined figures for groups of ${minGroupSize} or more.`}</Notice>
      {!wearableConsent ? <Notice tone="info">Connecting also turns on the “Health app & wearable connection” consent. You can change it in Privacy & consent.</Notice> : null}
    </BottomSheet>
  )
}

function Connections({ data }: { data: ConnectionsOverview }) {
  const [connecting, setConnecting] = useState<ConnectionRow | null>(null)
  const [disconnecting, setDisconnecting] = useState<ConnectionRow | null>(null)
  const [busy, setBusy] = useState<{ provider: HealthProvider; kind: "sync" | "connect" } | null>(null)
  const connect = useApiMutation(privacyApi.connect, { errorTitle: "Couldn't connect" })
  const sync = useApiMutation(privacyApi.sync, { errorTitle: "Sync failed – tap to reconnect." })
  const disconnect = useApiMutation(privacyApi.disconnect, { success: "Disconnected – we've stopped syncing.", errorTitle: "Couldn't disconnect", onSuccess: () => setDisconnecting(null), onError: () => setDisconnecting(null) })

  /** Phone platforms go through the HealthService permission sheet; wearables through provider sign-in. */
  const doConnect = async (row: ConnectionRow) => {
    setBusy({ provider: row.provider, kind: "connect" })
    try {
      if (!OAUTH[row.provider]) {
        const availability = await healthService.isAvailable()
        if (!availability.available) {
          toast.error(availability.reason === "not_installed" ? "Install Health Connect from the Play Store first." : "Health data isn't available on this device.")
          return
        }
        const res = await healthService.requestPermissions(healthService.dataTypes.map((t) => t.key))
        if (!res.granted.length) {
          toast.error("Permission not granted", { description: "Allow HealthX to read your steps in your phone's health settings." })
          return
        }
      }
      const r = await connect.mutateAsync({ provider: row.provider })
      haptic.success()
      setConnecting(null)
      toast.success("Connected", { description: `We'll sync your ${r.name} data automatically.` })
    } catch (err) {
      toast.error("Couldn't connect", { description: errorMessage(err) })
    } finally {
      setBusy(null)
    }
  }
  const doSync = async (row: ConnectionRow) => {
    setBusy({ provider: row.provider, kind: "sync" })
    try {
      const to = new Date()
      await healthService.readDailyTotals(new Date(to.getTime() - 2 * 86_400_000), to)
      const r = await sync.mutateAsync({ provider: row.provider })
      haptic.success()
      toast.success(`${r.name} synced just now.`)
    } catch {
      // toast shown by the mutation
    } finally {
      setBusy(null)
    }
  }
  const busyFor = (p: HealthProvider) => (busy?.provider === p ? busy.kind : null)
  const phones = [...data.rows.filter((r) => !r.phase)].sort((a, b) => Number(b.provider === healthService.provider) - Number(a.provider === healthService.provider))
  const wearables = data.rows.filter((r) => r.phase)

  return (
    <>
      {!data.anyConnected ? <EmptyState compact icon={Link2} title="No apps connected" description={`Connect ${healthService.label} to track steps automatically.`} /> : null}
      {phones.map((row) => (
        <ConnectionCard key={row.provider} row={row} busy={busyFor(row.provider)} onConnect={() => setConnecting(row)} onReconnect={() => doConnect(row)} onSync={() => doSync(row)} onDisconnect={() => setDisconnecting(row)} />
      ))}
      {wearables.length ? (
        <>
          <GroupLabel right={<PhaseBadge phase={2} />}>Wearable accounts</GroupLabel>
          {wearables.map((row) => (
            <ConnectionCard key={row.provider} row={row} busy={busyFor(row.provider)} onConnect={() => setConnecting(row)} onReconnect={() => doConnect(row)} onSync={() => doSync(row)} onDisconnect={() => setDisconnecting(row)} />
          ))}
        </>
      ) : null}
      <Notice tone="privacy" icon={ShieldCheck}>
        {`HR and your manager never see data from your connected apps. Your company only sees combined figures for groups of ${data.minGroupSize} or more people.`}
      </Notice>

      <ConnectSheet row={connecting} wearableConsent={data.wearableConsent} minGroupSize={data.minGroupSize} pending={!!busy && busy.kind === "connect"} onCancel={() => setConnecting(null)} onConfirm={() => connecting && doConnect(connecting)} />
      <ConfirmDialog
        open={!!disconnecting}
        title={`Disconnect ${disconnecting?.name ?? ""}?`}
        message="We'll stop syncing straight away. Steps and workouts that already synced stay in your history, but new activity won't count toward your goals, challenges or points until you reconnect."
        confirmLabel="Disconnect"
        destructive
        loading={disconnect.isPending}
        onCancel={() => setDisconnecting(null)}
        onConfirm={() => disconnecting && disconnect.mutate({ provider: disconnecting.provider })}
      />
    </>
  )
}

export default function ConnectedAppsScreen() {
  const q = useApiQuery(["employee", "privacy", "connections"], () => privacyApi.connections())
  return (
    <Screen title="Connected apps" back backHref="/settings" refreshing={q.isRefetching} onRefresh={() => q.refetch()} testID="connected-apps">
      <Text variant="caption" tone="muted">
        Sync steps, workouts and sleep automatically — no manual logging.
      </Text>
      {q.data ? (
        <Connections data={q.data} />
      ) : q.error ? (
        <ErrorState title="Couldn't load your connected apps." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : (
        <SkeletonList count={3} height={170} header={false} />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  mt10: { marginTop: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  logo: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  types: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  type: { borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  error: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: RADIUS.md, marginTop: 10 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 12, flexWrap: "wrap" },
  permList: { gap: 10 },
  perm: { flexDirection: "row", gap: 10 },
})
