/** SCR-M-073 Notification Preferences — channels, types (incl. #348 rank-change alerts, Phase 2), quiet hours. Every change saves straight away. */
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { BellOff, Droplets, Footprints, Gift, ListChecks, Mail, Medal, Megaphone, MoonStar, ShieldCheck, Smartphone, Sparkles, Trophy, type LucideIcon } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { TIME_OPTIONS, timeLabel } from "@/components/engage/account"
import { GroupLabel } from "@/components/engage/shared"
import { Card, ErrorState, IconTile, Notice, PhaseBadge, Screen, SelectField, SkeletonList, SwitchRow, Text } from "@/components/ui"
import type { ApiError } from "@/lib/api/core"
import { profileApi, type NotificationSettings } from "@/lib/api/employee/profile"
import { useApiQuery } from "@/lib/api/hooks"
import { toast } from "@/lib/toast"
import type { TintName } from "@/theme/tokens"

const KEY = ["employee", "notification-preferences"]

type ToggleKey = "reminders" | "waterReminders" | "habitReminders" | "challenges" | "rankChangeAlerts" | "announcements" | "rewards" | "weeklySummary"

const TYPES: { key: ToggleKey; title: string; description: string; icon: LucideIcon; tint: TintName; phase?: 2 }[] = [
  { key: "reminders", title: "Activity & goal reminders", description: "Nudges to move and updates on your daily step goal.", icon: Footprints, tint: "steps" },
  { key: "waterReminders", title: "Hydration reminders", description: "Reminders to drink water through the day.", icon: Droplets, tint: "water" },
  { key: "habitReminders", title: "Habit reminders", description: "A reminder at the time you set for each habit.", icon: ListChecks, tint: "habits" },
  { key: "challenges", title: "Challenge updates", description: "New challenges, reminders and results.", icon: Trophy, tint: "points" },
  { key: "rankChangeAlerts", title: "Rank-change alerts", description: "Tell me when I move up a leaderboard or drop out of the top 3.", icon: Medal, tint: "streak", phase: 2 },
  { key: "announcements", title: "Company announcements", description: "News and updates from your company.", icon: Megaphone, tint: "workout" },
  { key: "rewards", title: "Rewards & orders", description: "Points earned and the status of your reward orders.", icon: Gift, tint: "insight" },
  { key: "weeklySummary", title: "Weekly summary", description: "Your week in numbers, every Monday morning.", icon: Sparkles, tint: "sleep" },
]

function Preferences({ data }: { data: NotificationSettings }) {
  const qc = useQueryClient()
  const [quietDraft, setQuietDraft] = useState<{ start: string; end: string } | null>(null)
  const update = useMutation<NotificationSettings, ApiError, Partial<NotificationSettings>, { revert: Partial<NotificationSettings> }>({
    mutationKey: KEY,
    mutationFn: (patch) => profileApi.updateNotificationPreferences(patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: KEY })
      const prev = qc.getQueryData<NotificationSettings>(KEY)
      const revert = (prev ? Object.fromEntries(Object.keys(patch).map((k) => [k, prev[k as keyof NotificationSettings]])) : {}) as Partial<NotificationSettings>
      qc.setQueryData<NotificationSettings>(KEY, (old) => (old ? { ...old, ...patch } : old))
      return { revert }
    },
    onError: (_err, _patch, ctx) => {
      if (ctx) qc.setQueryData<NotificationSettings>(KEY, (old) => (old ? { ...old, ...ctx.revert } : old))
      toast.error("Couldn't update. Your previous setting is still active.")
    },
    onSuccess: () => toast.success("Saved", { duration: 1500 }),
    onSettled: () => {
      if (qc.isMutating({ mutationKey: KEY }) <= 1) {
        void qc.invalidateQueries({ queryKey: KEY })
        void qc.invalidateQueries({ queryKey: ["employee", "profile"] })
      }
    },
  })
  const set = (patch: Partial<NotificationSettings>) => update.mutate(patch)
  const channelsOff = !data.push && !data.email
  const quiet = quietDraft ?? { start: data.quietHoursStart, end: data.quietHoursEnd }
  const quietError = quietDraft && quietDraft.start === quietDraft.end ? "Quiet hours must end at a different time than they start." : undefined
  const changeQuiet = (field: "start" | "end", value: string) => {
    const next = { ...quiet, [field]: value }
    if (next.start === next.end) return setQuietDraft(next)
    setQuietDraft(null)
    set({ quietHoursStart: next.start, quietHoursEnd: next.end })
  }

  return (
    <>
      <GroupLabel>How we reach you</GroupLabel>
      <Card padding={12}>
        <SwitchRow icon={Smartphone} tint="habits" title="Push notifications" description="On this phone." value={data.push} onValueChange={(v) => set({ push: v })} />
        <SwitchRow icon={Mail} tint="steps" title="Email" description="Sent to your work email address." value={data.email} onValueChange={(v) => set({ email: v })} />
      </Card>
      {channelsOff ? (
        <Notice tone="warning" icon={BellOff} title="Push and email are both off.">
          You won&apos;t receive the notifications below until you turn one of them back on.
        </Notice>
      ) : null}

      <GroupLabel>What to notify me about</GroupLabel>
      <Card padding={12}>
        {TYPES.map((t) => (
          <SwitchRow key={t.key} icon={t.icon} tint={t.tint} title={t.title} description={t.description} badge={t.phase ? <PhaseBadge phase={t.phase} /> : undefined} value={data[t.key]} onValueChange={(v) => set({ [t.key]: v })} />
        ))}
      </Card>

      <GroupLabel>Quiet hours</GroupLabel>
      <Card>
        <View style={styles.row}>
          <IconTile icon={MoonStar} tint="sleep" size={36} />
          <Text variant="caption" tone="muted" style={styles.flex}>
            No push notifications from <Text variant="label">{timeLabel(quiet.start)}</Text> to <Text variant="label">{timeLabel(quiet.end)}</Text>. We&apos;ll hold them until quiet hours end.
          </Text>
        </View>
        <View style={[styles.row2, styles.mt12]}>
          <SelectField label="Starts" value={quiet.start} options={TIME_OPTIONS} onChange={(v) => changeQuiet("start", v)} containerStyle={styles.flex} />
          <SelectField label="Ends" value={quiet.end} options={TIME_OPTIONS} onChange={(v) => changeQuiet("end", v)} error={quietError} containerStyle={styles.flex} />
        </View>
      </Card>

      <Notice tone="privacy" icon={ShieldCheck} title="Service messages are always sent">
        For example security alerts, sign-in codes and changes to your account.
      </Notice>
    </>
  )
}

export default function NotificationPreferencesScreen() {
  const q = useApiQuery(KEY, () => profileApi.notificationPreferences())
  return (
    <Screen title="Notifications" back backHref="/settings" refreshing={q.isRefetching} onRefresh={() => q.refetch()} testID="notification-settings">
      <Text variant="caption" tone="muted">
        Choose what we notify you about. Changes save automatically.
      </Text>
      {q.data ? (
        <Preferences data={q.data} />
      ) : q.error ? (
        <ErrorState title="Couldn't load your notification settings." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : (
        <SkeletonList count={3} height={180} header={false} />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt12: { marginTop: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  row2: { flexDirection: "row", gap: 10 },
})
