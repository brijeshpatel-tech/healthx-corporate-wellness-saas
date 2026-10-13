"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, Lock, Save, Trophy } from "lucide-react"
import { useEffect } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { ChoiceField, SelectField, SwitchField, TextField } from "@/components/common/form-fields"
import { SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { ErrorState, PageSkeleton } from "@/components/common/states"
import { UserAvatar } from "@/components/common/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { TIMEZONES } from "@/lib/api/business/locations"
import { settingsApi, type CompanySettingsView } from "@/lib/api/business/settings"
import { ApiError } from "@/lib/api/core"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { displayName, formatDateTime, formatNumber } from "@/lib/format"
import type { LeaderboardNameDisplay, ModuleCode } from "@/lib/types"
import { cn } from "@/lib/utils"

const schema = z
  .object({
    leaderboardNameDisplay: z.enum(["full_name", "first_name_initial", "anonymous"]),
    showProfilePhotos: z.boolean(),
    allowLeaderboardOptOut: z.boolean(),
    defaultStepGoal: z.number({ message: "Enter a number" }).int().min(1000, "At least 1,000 steps").max(50000, "At most 50,000 steps"),
    defaultWaterGoalMl: z.number({ message: "Enter a number" }).int().min(500, "At least 500 ml").max(6000, "At most 6,000 ml"),
    weekStartsOn: z.enum(["monday", "sunday"]),
    defaultLanguage: z.string().min(1),
    timezone: z.string().min(1),
    allowManualActivity: z.boolean(),
    manualActivityEarnsPoints: z.boolean(),
    minAnalyticsGroupSize: z.number({ message: "Enter a number" }).int().min(5, "5 is the privacy minimum").max(50, "At most 50"),
    lowParticipationPct: z.number({ message: "Enter a number" }).int().min(10, "At least 10%").max(95, "At most 95%"),
    enabledModules: z.array(z.string()),
  })
  .refine((v) => v.allowManualActivity || !v.manualActivityEarnsPoints, { path: ["manualActivityEarnsPoints"], message: "Allow manual activity first" })
type Values = z.infer<typeof schema>

const toValues = (s: CompanySettingsView): Values => ({
  leaderboardNameDisplay: s.leaderboardNameDisplay,
  showProfilePhotos: s.showProfilePhotos,
  allowLeaderboardOptOut: s.allowLeaderboardOptOut,
  defaultStepGoal: s.defaultStepGoal,
  defaultWaterGoalMl: s.defaultWaterGoalMl,
  weekStartsOn: s.weekStartsOn,
  defaultLanguage: s.defaultLanguage,
  timezone: s.timezone,
  allowManualActivity: s.allowManualActivity,
  manualActivityEarnsPoints: s.manualActivityEarnsPoints,
  minAnalyticsGroupSize: s.minAnalyticsGroupSize,
  lowParticipationPct: Math.round(s.lowParticipationThreshold * 100),
  enabledModules: s.modules.filter((m) => m.enabled).map((m) => m.code),
})

const SAMPLE = [
  { firstName: "Priya", lastName: "Sharma", color: "#8b5cf6", value: 84210 },
  { firstName: "Arjun", lastName: "Menon", color: "#0ea5e9", value: 79655 },
  { firstName: "Kavya", lastName: "Reddy", color: "#f59e0b", value: 77302 },
]

/** SCR-B-041 — Company settings (Company Owner). */
export default function CompanySettingsPage() {
  const q = useApiQuery(["business", "company-settings"], () => settingsApi.settings())
  return (
    <PageContainer>
      <PageHeader title="Company settings" description="Company-wide rules for privacy, goals, points and analytics. Changes apply in the app straight away." />
      {q.isLoading ? <PageSkeleton kpis={0} /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <SettingsForm settings={q.data!} />}
    </PageContainer>
  )
}

function SettingsForm({ settings }: { settings: CompanySettingsView }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(settings) })
  useEffect(() => form.reset(toValues(settings)), [settings, form])
  const [nameDisplay, showPhotos, allowManual] = useWatch({ control: form.control, name: ["leaderboardNameDisplay", "showProfilePhotos", "allowManualActivity"] })
  const dirty = form.formState.isDirty

  useEffect(() => {
    if (!allowManual && form.getValues("manualActivityEarnsPoints")) form.setValue("manualActivityEarnsPoints", false, { shouldDirty: true })
  }, [allowManual, form])

  const save = useApiMutation(settingsApi.updateSettings, {
    success: (r) => r.message,
    onError: (err) => {
      if (!(err instanceof ApiError) || !err.fieldErrors) return
      Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError((k === "lowParticipationThreshold" ? "lowParticipationPct" : k) as keyof Values, { message }))
    },
  })

  const submit = form.handleSubmit((v) =>
    save.mutate({
      leaderboardNameDisplay: v.leaderboardNameDisplay,
      showProfilePhotos: v.showProfilePhotos,
      allowLeaderboardOptOut: v.allowLeaderboardOptOut,
      defaultStepGoal: v.defaultStepGoal,
      defaultWaterGoalMl: v.defaultWaterGoalMl,
      weekStartsOn: v.weekStartsOn,
      defaultLanguage: v.defaultLanguage,
      timezone: v.timezone,
      allowManualActivity: v.allowManualActivity,
      manualActivityEarnsPoints: v.manualActivityEarnsPoints,
      minAnalyticsGroupSize: v.minAnalyticsGroupSize,
      lowParticipationThreshold: v.lowParticipationPct / 100,
      enabledModules: v.enabledModules as ModuleCode[],
    }),
  )

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6">
      <SectionCard title="Leaderboard privacy" description="How employees appear on leaderboards in the app and the portal. Only leaderboard totals are ever shown.">
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <ChoiceField
              control={form.control}
              name="leaderboardNameDisplay"
              label="Show names as"
              columns={1}
              options={[
                { value: "full_name", label: "Full name", description: "Priya Sharma" },
                { value: "first_name_initial", label: "First name + initial", description: "Priya S. — recommended balance of recognition and privacy" },
                { value: "anonymous", label: "Anonymous", description: "Colleague — employees still see their own position" },
              ]}
            />
            <SwitchField control={form.control} name="showProfilePhotos" label="Show profile photos" description="Otherwise coloured initials are used." />
            <SwitchField control={form.control} name="allowLeaderboardOptOut" label="Let employees opt out of named display" description="They appear as 'Colleague' on leaderboards." />
          </div>
          <div className="lg:col-span-2">
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Preview</p>
            <div className="overflow-hidden rounded-xl border bg-background">
              <div className="flex items-center gap-2 border-b px-3 py-2 text-sm font-semibold">
                <Trophy className="size-4 text-amber-500" /> Steps this week
              </div>
              <ol className="divide-y">
                {SAMPLE.map((p, i) => {
                  const name = displayName(p, nameDisplay as LeaderboardNameDisplay)
                  return (
                    <li key={p.firstName} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="w-4 text-sm font-bold text-muted-foreground tabular-nums">{i + 1}</span>
                      <UserAvatar name={nameDisplay === "anonymous" ? "?" : `${p.firstName} ${p.lastName}`} color={nameDisplay === "anonymous" ? "#94a3b8" : p.color} size="sm" className={cn(showPhotos && nameDisplay !== "anonymous" && "ring-2 ring-primary/30 ring-offset-1 ring-offset-background")} />
                      <span className="flex-1 truncate text-sm font-medium">{name}</span>
                      <span className="text-sm font-semibold tabular-nums">{formatNumber(p.value)}</span>
                    </li>
                  )
                })}
              </ol>
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Default goals & calendar" description="New employees start with these; they can change their own goals.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="defaultStepGoal" label="Daily step goal" type="number" suffix="steps" />
            <TextField control={form.control} name="defaultWaterGoalMl" label="Daily water goal" type="number" suffix="ml" />
            <SelectField control={form.control} name="weekStartsOn" label="Week starts on" options={[{ value: "monday", label: "Monday" }, { value: "sunday", label: "Sunday" }]} description="Used for weekly leaderboards" />
            <SelectField control={form.control} name="defaultLanguage" label="Default language" options={["English", "Hindi", "Tamil", "Telugu", "Kannada", "Marathi"].map((l) => ({ value: l, label: l }))} />
            <SelectField control={form.control} name="timezone" label="Timezone" className="sm:col-span-2" options={TIMEZONES.map((t) => ({ value: t.value, label: t.label }))} />
          </div>
        </SectionCard>

        <SectionCard title="Activity & points" description="Rules for manual entries and points.">
          <div className="space-y-3">
            <SwitchField control={form.control} name="allowManualActivity" label="Allow manual activity entries" description="Employees can log activities their phone didn't track." />
            <SwitchField control={form.control} name="manualActivityEarnsPoints" label="Manual entries earn points" description="Off by default to keep leaderboards fair. Manual entries are approved by an admin first." disabled={!allowManual} />
            <p className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" /> Points never expire, and the same activity never earns points twice.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Rewards" description="How reward orders are handled.">
          <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Approve reward orders before fulfilment</p>
              <p className="text-xs text-muted-foreground">Every order starts as &quot;Pending approval&quot; and an HR Admin or the Company Owner reviews it first.</p>
            </div>
            <Badge variant="secondary" className="gap-1">
              <Lock /> Always on
            </Badge>
          </div>
        </SectionCard>

        <SectionCard title="Analytics thresholds" description="Privacy and alert levels for analytics.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="minAnalyticsGroupSize" label="Minimum group size" type="number" suffix="people" description="Smaller groups are always hidden" />
            <TextField control={form.control} name="lowParticipationPct" label="Low-participation alert" type="number" suffix="%" description="Flag departments and teams below this" />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Modules" description={`What employees see in the app. Your ${settings.planName} plan decides which modules are available.`}>
        <Controller
          control={form.control}
          name="enabledModules"
          render={({ field }) => (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {settings.modules.map((m) => {
                const on = m.locked || field.value.includes(m.code)
                const disabled = m.locked || !m.included
                return (
                  <label key={m.code} className={cn("flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5", !m.included && "bg-muted/40")}>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{m.label}</span>
                      <span className="block text-xs text-muted-foreground">{m.locked ? "Always on" : m.included ? (on ? "Visible to employees" : "Hidden") : "Not in your plan"}</span>
                    </span>
                    {m.included ? (
                      <Switch
                        checked={on && m.included}
                        disabled={disabled}
                        onCheckedChange={(v) => field.onChange(v ? [...field.value, m.code] : field.value.filter((x) => x !== m.code))}
                        aria-label={m.label}
                      />
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <Lock /> Upgrade
                      </Badge>
                    )}
                  </label>
                )
              })}
            </div>
          )}
        />
      </SectionCard>

      <div className={cn("sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-2 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur transition-all", !dirty && "pointer-events-none translate-y-2 opacity-0")}>
        <span className="mr-auto text-sm text-muted-foreground">Unsaved changes · these apply to everyone in the company</span>
        <Button type="button" variant="outline" onClick={() => form.reset(toValues(settings))}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Spinner /> : <Save data-icon="inline-start" />}
          Save
        </Button>
      </div>
      {settings.updatedAt ? <p className="-mt-4 text-xs text-muted-foreground">Last changed {formatDateTime(settings.updatedAt)} by {settings.updatedBy}</p> : null}
    </form>
  )
}
