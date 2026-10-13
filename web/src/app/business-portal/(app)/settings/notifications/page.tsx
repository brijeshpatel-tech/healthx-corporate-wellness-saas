"use client"

import { BellRing, Moon, Save } from "lucide-react"
import { useState } from "react"
import { FieldShell } from "@/components/common/form-fields"
import { SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { ErrorState, PageSkeleton } from "@/components/common/states"
import { PhaseBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { settingsApi, type NotificationSettingsInput, type NotificationSettingsView, type NotificationTypeKey } from "@/lib/api/business/settings"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { cn } from "@/lib/utils"

/** SCR-B-038 — Notification settings (Phase 2). */
export default function NotificationSettingsPage() {
  const q = useApiQuery(["business", "notification-settings"], () => settingsApi.notifications())
  return (
    <PageContainer>
      <PageHeader
        title="Notification settings"
        badge={<PhaseBadge phase={2} />}
        description="Company defaults for automatic reminders. Employees can still turn individual notifications off in the app."
      />
      {q.isLoading ? <PageSkeleton kpis={0} /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <NotificationsForm data={q.data!} />}
    </PageContainer>
  )
}

const toDraft = (d: NotificationSettingsView): NotificationSettingsInput => ({
  types: Object.fromEntries(d.types.map((t) => [t.key, t.enabled])) as Record<NotificationTypeKey, boolean>,
  quietHoursStart: d.quietHoursStart,
  quietHoursEnd: d.quietHoursEnd,
  weeklySummaryDay: d.weeklySummaryDay,
  maxPushesPerDay: d.maxPushesPerDay,
})

function NotificationsForm({ data }: { data: NotificationSettingsView }) {
  const [draft, setDraft] = useState(toDraft(data))
  const [source, setSource] = useState(data)
  const [errors, setErrors] = useState<Record<string, string>>({})
  if (source !== data) {
    setSource(data)
    setDraft(toDraft(data))
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(data))
  const save = useApiMutation(settingsApi.updateNotifications, { success: "Notification settings saved.", onSuccess: () => setErrors({}), onError: (e) => setErrors(e.fieldErrors ?? {}) })
  const enabledCount = Object.values(draft.types).filter(Boolean).length

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <SectionCard className="lg:col-span-2" title="Automatic notifications" description={`${enabledCount} of ${data.types.length} switched on for your company.`}>
        <ul className="divide-y rounded-xl border">
          {data.types.map((t) => (
            <li key={t.key} className="flex items-start justify-between gap-4 px-4 py-3">
              <div className="space-y-0.5">
                <Label htmlFor={`n-${t.key}`} className="text-sm font-medium">
                  {t.label}
                </Label>
                <p className="text-xs text-muted-foreground">{t.description}</p>
              </div>
              <Switch id={`n-${t.key}`} checked={draft.types[t.key]} onCheckedChange={(v) => setDraft((d) => ({ ...d, types: { ...d.types, [t.key]: v } }))} />
            </li>
          ))}
        </ul>
      </SectionCard>

      <div className="flex flex-col gap-6">
        <SectionCard title={<span className="inline-flex items-center gap-2"><Moon className="size-4 text-muted-foreground" /> Quiet hours</span>} description="No push notifications between these times (employee's local time).">
          <div className="grid grid-cols-2 gap-3">
            <FieldShell id="qh-start" label="From" error={errors.quietHoursStart}>
              <Input id="qh-start" type="time" value={draft.quietHoursStart} onChange={(e) => setDraft((d) => ({ ...d, quietHoursStart: e.target.value }))} className="h-9" />
            </FieldShell>
            <FieldShell id="qh-end" label="Until" error={errors.quietHoursEnd}>
              <Input id="qh-end" type="time" value={draft.quietHoursEnd} onChange={(e) => setDraft((d) => ({ ...d, quietHoursEnd: e.target.value }))} className="h-9" />
            </FieldShell>
          </div>
        </SectionCard>

        <SectionCard title={<span className="inline-flex items-center gap-2"><BellRing className="size-4 text-muted-foreground" /> Frequency</span>}>
          <div className="space-y-5">
            <FieldShell label="Weekly summary day" description={draft.types.weeklySummary ? undefined : "Turn on the weekly summary to use this."}>
              <Select value={draft.weeklySummaryDay} onValueChange={(v) => setDraft((d) => ({ ...d, weeklySummaryDay: v as NotificationSettingsInput["weeklySummaryDay"] }))} disabled={!draft.types.weeklySummary}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monday">Monday morning</SelectItem>
                  <SelectItem value="friday">Friday afternoon</SelectItem>
                  <SelectItem value="saturday">Saturday morning</SelectItem>
                  <SelectItem value="sunday">Sunday evening</SelectItem>
                </SelectContent>
              </Select>
            </FieldShell>
            <FieldShell label="Maximum pushes per employee per day" error={errors.maxPushesPerDay}>
              <div className="flex items-center gap-4 pt-1">
                <Slider min={1} max={10} step={1} value={[draft.maxPushesPerDay]} onValueChange={([v]) => setDraft((d) => ({ ...d, maxPushesPerDay: v ?? d.maxPushesPerDay }))} className="flex-1" aria-label="Maximum pushes per day" />
                <span className="w-8 text-right font-heading text-lg font-bold tabular-nums">{draft.maxPushesPerDay}</span>
              </div>
            </FieldShell>
            <p className="text-xs text-muted-foreground">Announcements you send yourself always go out, but count towards this limit.</p>
          </div>
        </SectionCard>
      </div>

      <div className={cn("sticky bottom-4 z-10 flex items-center justify-end gap-2 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur transition-all lg:col-span-3", !dirty && "pointer-events-none translate-y-2 opacity-0")}>
        <span className="mr-auto text-sm text-muted-foreground">Unsaved changes</span>
        <Button variant="outline" onClick={() => setDraft(toDraft(data))}>
          Cancel
        </Button>
        <Button onClick={() => save.mutate(draft)} disabled={save.isPending}>
          {save.isPending ? <Spinner /> : <Save data-icon="inline-start" />}
          Save
        </Button>
      </div>
    </div>
  )
}
