/**
 * SCR-M-075 Privacy & Consent Centre — who sees what, consents (versioned, recorded), leaderboard visibility,
 * Slack / Teams shout-outs (Phase 2), consent history and data rights. HR never sees individual health data.
 */
import { BarChart3, Bell, Bot, Building2, Check, Download, EyeOff, HeartPulse, History, Lock, MessageSquareHeart, ShieldCheck, Trash2, Trophy, Watch, X, type LucideIcon } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { go, GroupLabel } from "@/components/engage/shared"
import { BottomSheet, Button, Card, ConfirmDialog, Divider, ErrorState, IconTile, ListGroup, ListItem, PhaseBadge, Screen, SkeletonList, SwitchRow, Text } from "@/components/ui"
import { LEADERBOARD_NAME_LABEL, privacyApi, type ConsentCentre } from "@/lib/api/employee/privacy"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatDateTime } from "@/lib/format"
import type { Consent, ConsentKey } from "@/lib/types"
import { useTheme } from "@/theme/theme"
import type { TintName } from "@/theme/tokens"

const CONSENT_UI: Record<ConsentKey, { icon: LucideIcon; tint: TintName; phase?: 2 }> = {
  health_data: { icon: HeartPulse, tint: "danger" },
  wearable_connection: { icon: Watch, tint: "water" },
  data_sharing: { icon: Building2, tint: "habits" },
  notifications: { icon: Bell, tint: "points" },
  ai_personalisation: { icon: Bot, tint: "insight", phase: 2 },
  analytics: { icon: BarChart3, tint: "neutral" },
}
const SAVED = "Your choice has been saved."
const FAILED = "Couldn't save your choice. Your previous setting is still active."

function WhoSeesWhat({ data }: { data: ConsentCentre }) {
  const { colors, tint } = useTheme()
  const n = data.minGroupSize
  return (
    <Card>
      <View style={styles.row}>
        <IconTile icon={ShieldCheck} tint="habits" />
        <View style={styles.flex}>
          <Text variant="subtitle">Your health data stays yours</Text>
          <Text variant="caption" tone="muted">
            {data.companyName} can see your participation — like your account status and the challenges you joined — but never your individual health data. Wellness figures are only shown for groups of {n} or more.
          </Text>
        </View>
      </View>
      <Divider style={styles.divider} />
      <View style={styles.cols}>
        <View style={styles.col}>
          <View style={styles.rowSm}>
            <Building2 size={15} color={tint("habits").fg} />
            <Text variant="label">What your company can see</Text>
          </View>
          {["Whether your account is active, and which challenges you joined", `Combined wellness figures for groups of ${n} or more people`, "Leaderboards, with names shown as your company has set", "Your reward orders, so they can be approved and delivered"].map((t) => (
            <View key={t} style={styles.bulletRow}>
              <Check size={14} color={tint("habits").fg} style={styles.mt2} />
              <Text variant="caption" tone="muted" style={styles.flex}>
                {t}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.col}>
          <View style={styles.rowSm}>
            <Lock size={15} color={tint("insight").fg} />
            <Text variant="label">What only you can see</Text>
          </View>
          {["Your steps, activity and workouts", "Water, sleep, habits and meals", "Height, weight, goals and Wellness Score", "Your points history, connected-app data and AI coach chats"].map((t) => (
            <View key={t} style={styles.bulletRow}>
              <Lock size={12} color={tint("insight").fg} style={styles.mt2} />
              <Text variant="caption" tone="muted" style={styles.flex}>
                {t}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <Text variant="small" style={[styles.mt8, { color: colors.mutedForeground }]}>
        Changes take effect immediately and are recorded with the consent version.
      </Text>
    </Card>
  )
}

function HistorySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { colors } = useTheme()
  const q = useApiQuery(["employee", "privacy", "history"], () => privacyApi.history(), { enabled: open })
  return (
    <BottomSheet open={open} onClose={onClose} title="Consent history" description="Every change to your privacy choices, newest first.">
      {q.error ? (
        <ErrorState title="Couldn't load your consent history." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : !q.data ? (
        <SkeletonList count={4} height={56} header={false} />
      ) : q.data.length === 0 ? (
        <Text variant="caption" tone="muted">
          No changes yet.
        </Text>
      ) : (
        q.data.map((e) => {
          const granted = e.action === "granted"
          return (
            <View key={e.id} style={styles.histRow}>
              <View style={[styles.histDot, { backgroundColor: granted ? colors.primarySoft : colors.destructiveSoft }]}>{granted ? <Check size={15} color={colors.success} /> : <X size={15} color={colors.destructive} />}</View>
              <View style={styles.flex}>
                <Text variant="caption">
                  <Text variant="label">{e.title}</Text> — {granted ? "turned on" : "turned off"}
                </Text>
                <Text variant="small" tone="muted">
                  {formatDateTime(e.at)} · Version {e.version}
                </Text>
                {e.note ? (
                  <Text variant="small" tone="muted">
                    {e.note}
                  </Text>
                ) : null}
              </View>
            </View>
          )
        })
      )}
    </BottomSheet>
  )
}

function Centre({ data }: { data: ConsentCentre }) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [confirm, setConfirm] = useState<"health" | "wearable" | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const clear = (key: string) =>
    setOverrides((o) => {
      const next = { ...o }
      delete next[key]
      return next
    })
  const updateConsent = useApiMutation(privacyApi.updateConsent, {
    success: (r) => (r.disconnected.length ? `${SAVED} ${r.disconnected.join(" and ")} disconnected.` : SAVED),
    errorTitle: FAILED,
    onSuccess: (_r, input) => clear(input.type),
    onError: (_e, input) => clear(input.type),
  })
  const updateLeaderboard = useApiMutation(privacyApi.updateLeaderboardVisibility, { success: SAVED, errorTitle: FAILED, onSuccess: () => clear("leaderboard"), onError: () => clear("leaderboard") })
  const updateShoutouts = useApiMutation(privacyApi.updateShoutouts, { success: SAVED, errorTitle: FAILED, onSuccess: () => clear("shoutouts"), onError: () => clear("shoutouts") })

  const applyConsent = (key: ConsentKey, granted: boolean) => {
    setConfirm(null)
    setOverrides((o) => ({ ...o, [key]: granted }))
    updateConsent.mutate({ type: key, granted })
  }
  const onToggle = (c: Consent, granted: boolean) => {
    if (!granted && c.key === "health_data") return setConfirm("health")
    if (!granted && c.key === "wearable_connection" && data.connectedApps.length) return setConfirm("wearable")
    applyConsent(c.key, granted)
  }
  const value = (key: string, server: boolean) => overrides[key] ?? server

  return (
    <>
      <WhoSeesWhat data={data} />

      <GroupLabel>Your consents</GroupLabel>
      <Card padding={12}>
        {data.consents.map((c, i) => {
          const ui = CONSENT_UI[c.key]
          return (
            <View key={c.key}>
              {i > 0 ? <Divider style={styles.rowDivider} /> : null}
              <SwitchRow
                icon={ui.icon}
                tint={ui.tint}
                title={c.title}
                badge={
                  <>
                    {c.required ? (
                      <Text variant="small" tone="destructive" weight="bold">
                        REQUIRED
                      </Text>
                    ) : null}
                    {ui.phase ? <PhaseBadge phase={ui.phase} /> : null}
                  </>
                }
                description={`${c.description}\nVersion ${c.version} · Updated ${formatDate(c.updatedAt)}`}
                value={value(c.key, c.granted)}
                disabled={c.key in overrides}
                onValueChange={(v) => onToggle(c, v)}
              />
            </View>
          )
        })}
      </Card>

      <GroupLabel>Leaderboards & sharing</GroupLabel>
      <Card padding={12}>
        <View style={styles.row}>
          <IconTile icon={Trophy} tint="points" size={36} />
          <View style={styles.flex}>
            <Text variant="bodyMedium">How your name appears</Text>
            <Text variant="caption" tone="muted">
              {data.companyName} shows {LEADERBOARD_NAME_LABEL[data.leaderboard.nameDisplay].toLowerCase()} on leaderboards. You appear as <Text variant="label">{data.leaderboard.example}</Text>
            </Text>
          </View>
        </View>
        <Divider style={styles.rowDivider} />
        <SwitchRow
          icon={EyeOff}
          tint="neutral"
          title="Appear as Anonymous on leaderboards"
          description={
            data.leaderboard.allowOptOut
              ? "Your name and photo are replaced with “Anonymous” on company, department and team leaderboards. Your activity still counts, and you'll still see your own rank."
              : "Your company shows everyone on leaderboards as set above, so this can't be changed. Only your name and leaderboard figures are shown — never your health data."
          }
          value={value("leaderboard", data.leaderboard.hidden)}
          disabled={!data.leaderboard.allowOptOut || "leaderboard" in overrides}
          onValueChange={(v) => {
            setOverrides((o) => ({ ...o, leaderboard: v }))
            updateLeaderboard.mutate({ hidden: v })
          }}
        />
        <Divider style={styles.rowDivider} />
        <SwitchRow
          icon={MessageSquareHeart}
          tint="insight"
          title="Slack / Teams shout-outs"
          badge={<PhaseBadge phase={2} />}
          description={data.shoutouts.companyConnected ? "Let us celebrate your badges and challenge wins in your company's Slack or Teams channel." : "Let us celebrate your badges and challenge wins in Slack or Teams once your company connects them."}
          value={value("shoutouts", data.shoutouts.granted)}
          disabled={"shoutouts" in overrides}
          onValueChange={(v) => {
            setOverrides((o) => ({ ...o, shoutouts: v }))
            updateShoutouts.mutate({ granted: v })
          }}
        />
      </Card>

      <Button title="View consent history" icon={History} variant="outline" onPress={() => setHistoryOpen(true)} testID="consent-history" />

      <GroupLabel>Your data</GroupLabel>
      <ListGroup>
        <ListItem icon={Watch} tint="water" title="Connected apps & devices" subtitle={data.connectedApps.length ? data.connectedApps.join(", ") : "None"} onPress={() => go("/settings/connected-apps")} />
        <ListItem icon={Download} tint="sleep" title="Download my data" subtitle="Get a copy of everything we hold about you" right={<PhaseBadge phase={2} />} onPress={() => go("/settings/download-data")} />
        <ListItem icon={Trash2} destructive title="Delete account" subtitle="Deactivate your account and delete your personal data" onPress={() => go("/settings/delete-account")} />
      </ListGroup>

      <ConfirmDialog
        open={confirm === "health"}
        title="Withdraw health data permission?"
        message={
          "HealthX needs this permission to track your wellness. If you withdraw it:\n\n• Step, activity, water and sleep tracking stops — new data won't be saved.\n• Challenges and leaderboards stop counting your activity.\n• Your Wellness Score is frozen at its current value.\n• You keep your points and can still use rewards, workouts and wellness content.\n\nYou can turn it back on at any time."
        }
        confirmLabel="Withdraw"
        cancelLabel="Keep it on"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => applyConsent("health_data", false)}
      />
      <ConfirmDialog
        open={confirm === "wearable"}
        title="Stop syncing health apps?"
        message={`We'll disconnect ${data.connectedApps.join(" and ")} straight away and stop reading new data from it.\n\nData that already synced stays in your history. You can still log activity manually, and reconnect any time from Connected apps.`}
        confirmLabel="Disconnect"
        cancelLabel="Keep syncing"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => applyConsent("wearable_connection", false)}
      />
      <HistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </>
  )
}

export default function PrivacyCentreScreen() {
  const q = useApiQuery(["employee", "privacy", "consents"], () => privacyApi.consents())
  return (
    <Screen title="Privacy & consent" back backHref="/settings" refreshing={q.isRefetching} onRefresh={() => q.refetch()} testID="privacy-screen">
      {q.data ? (
        <Centre data={q.data} />
      ) : q.error ? (
        <ErrorState title="Couldn't load your privacy settings." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : (
        <SkeletonList count={3} height={200} header={false} />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 6 },
  mt2: { marginTop: 2 },
  mt8: { marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowSm: { flexDirection: "row", alignItems: "center", gap: 6 },
  divider: { marginVertical: 14 },
  rowDivider: { marginVertical: 4 },
  cols: { gap: 16 },
  col: { gap: 6 },
  bulletRow: { flexDirection: "row", gap: 8 },
  histRow: { flexDirection: "row", gap: 12 },
  histDot: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
})

