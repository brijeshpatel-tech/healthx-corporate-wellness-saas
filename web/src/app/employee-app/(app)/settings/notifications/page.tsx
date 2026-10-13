"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { LucideIcon } from "lucide-react"
import { BellOff, Droplets, Footprints, Gift, ListChecks, Mail, Medal, Megaphone, MoonStar, ShieldCheck, Smartphone, Sparkles, Trophy } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { FieldShell } from "@/components/common/form-fields"
import { PhaseBadge } from "@/components/common/status-badge"
import { SwitchRow } from "@/components/employee/engage/account/rows"
import { EngagePage, IconTile, LoadError, MenuGroup, type Tone } from "@/components/employee/engage/page"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import type { ApiError } from "@/lib/api/core"
import { profileApi, type NotificationSettings } from "@/lib/api/employee/profile"
import { useApiQuery } from "@/lib/api/hooks"

const KEY = ["employee", "notification-preferences"]

type ToggleKey = "reminders" | "waterReminders" | "habitReminders" | "challenges" | "rankChangeAlerts" | "announcements" | "rewards" | "weeklySummary"

const TYPES: { key: ToggleKey; title: string; description: string; icon: LucideIcon; tone: Tone; phase?: 2 }[] = [
  { key: "reminders", title: "Activity & goal reminders", description: "Nudges to move and updates on your daily step goal.", icon: Footprints, tone: "sky" },
  { key: "waterReminders", title: "Hydration reminders", description: "Reminders to drink water through the day.", icon: Droplets, tone: "cyan" },
  { key: "habitReminders", title: "Habit reminders", description: "A reminder at the time you set for each habit.", icon: ListChecks, tone: "emerald" },
  { key: "challenges", title: "Challenge updates", description: "New challenges, reminders and results.", icon: Trophy, tone: "amber" },
  { key: "rankChangeAlerts", title: "Rank-change alerts", description: "Tell me when I move up a leaderboard or drop out of the top 3", icon: Medal, tone: "orange", phase: 2 },
  { key: "announcements", title: "Company announcements", description: "News and updates from your company.", icon: Megaphone, tone: "violet" },
  { key: "rewards", title: "Rewards & orders", description: "Points earned and the status of your reward orders.", icon: Gift, tone: "pink" },
  { key: "weeklySummary", title: "Weekly summary", description: "Your week in numbers, every Monday morning.", icon: Sparkles, tone: "indigo" },
]

const TIMES = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 ? "30" : "00"
  const value = `${String(h).padStart(2, "0")}:${m}`
  const label = `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? "AM" : "PM"}`
  return { value, label }
})
const timeLabel = (v: string) => TIMES.find((t) => t.value === v)?.label ?? v

/** SCR-M-073 Notification Preferences — every change saves straight away. */
export default function NotificationPreferencesPage() {
  const q = useApiQuery(KEY, () => profileApi.notificationPreferences())
  return (
    <EngagePage size="narrow" title="Notifications" description="Choose what we notify you about. Changes save automatically and apply within a minute." backHref="/employee-app/settings" backLabel="Settings">
      {q.error ? (
        <LoadError title="Couldn't load your notification settings." error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="space-y-5">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-[30rem] rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : (
        <Preferences data={q.data} />
      )}
    </EngagePage>
  )
}

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
    onSettled: () => {
      // Refresh once the last in-flight change has finished so quick taps don't flicker.
      if (qc.isMutating({ mutationKey: KEY }) <= 1) {
        void qc.invalidateQueries({ queryKey: KEY })
        void qc.invalidateQueries({ queryKey: ["employee", "profile"] })
      }
    },
  })

  const set = (patch: Partial<NotificationSettings>) => update.mutate(patch)
  const channelsOff = !data.push && !data.email
  const quiet = quietDraft ?? { start: data.quietHoursStart, end: data.quietHoursEnd }
  const quietError = quietDraft && quietDraft.start === quietDraft.end ? "Quiet hours must end at a different time than they start." : null

  const changeQuiet = (field: "start" | "end", value: string) => {
    const next = { ...quiet, [field]: value }
    if (next.start === next.end) {
      setQuietDraft(next)
      return
    }
    setQuietDraft(null)
    set({ quietHoursStart: next.start, quietHoursEnd: next.end })
  }

  return (
    <>
      <MenuGroup title="How we reach you">
        <SwitchRow id="np-push" icon={Smartphone} tone="emerald" title="Push notifications" description="On this browser and your phone." checked={data.push} onCheckedChange={(v) => set({ push: v })} />
        <SwitchRow id="np-email" icon={Mail} tone="sky" title="Email" description="Sent to your work email address." checked={data.email} onCheckedChange={(v) => set({ email: v })} />
      </MenuGroup>

      {channelsOff ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4 text-sm" role="status">
          <BellOff className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p>
            <span className="font-semibold">Push and email are both off.</span> <span className="text-muted-foreground">You won&apos;t receive the notifications below until you turn one of them back on.</span>
          </p>
        </div>
      ) : null}

      <MenuGroup title="What to notify me about">
        {TYPES.map((t) => (
          <SwitchRow
            key={t.key}
            id={`np-${t.key}`}
            icon={t.icon}
            tone={t.tone}
            title={t.title}
            badge={t.phase ? <PhaseBadge phase={t.phase} /> : undefined}
            description={t.description}
            checked={data[t.key]}
            onCheckedChange={(v) => set({ [t.key]: v })}
          />
        ))}
      </MenuGroup>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Quiet hours</h2>
        <div className="space-y-4 rounded-2xl border bg-card p-4 shadow-xs">
          <div className="flex items-start gap-3">
            <IconTile icon={MoonStar} tone="indigo" size="sm" />
            <p className="text-sm text-muted-foreground">
              No push notifications from <span className="font-medium text-foreground">{timeLabel(quiet.start)}</span> to{" "}
              <span className="font-medium text-foreground">{timeLabel(quiet.end)}</span>. We&apos;ll hold them until quiet hours end.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TimeSelect id="quiet-start" label="Starts" value={quiet.start} onChange={(v) => changeQuiet("start", v)} />
            <TimeSelect id="quiet-end" label="Ends" value={quiet.end} onChange={(v) => changeQuiet("end", v)} error={quietError ?? undefined} />
          </div>
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-2xl border bg-muted/40 p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Service messages are always sent</span> — for example security alerts, sign-in codes and changes to your account.
        </p>
      </div>
    </>
  )
}

function TimeSelect({ id, label, value, onChange, error }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <FieldShell id={id} label={label} error={error}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-11 w-full rounded-xl" aria-invalid={!!error}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {TIMES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  )
}
