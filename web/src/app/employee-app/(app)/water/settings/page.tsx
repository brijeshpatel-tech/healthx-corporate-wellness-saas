"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { BellRing, Droplets, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { SelectField, SwitchField, TextField } from "@/components/common/form-fields"
import { ErrorState } from "@/components/common/states"
import { IconBubble, NumberStepper, TrackHeader, TrackPage } from "@/components/employee/track/track-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { waterApi } from "@/lib/api/employee/water"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import type { WaterSettings } from "@/lib/types"

const schema = z
  .object({
    goalL: z.number().min(1, "Choose a goal between 1 and 5 litres.").max(5, "Choose a goal between 1 and 5 litres."),
    remindersEnabled: z.boolean(),
    reminderStart: z.string().regex(/^\d{2}:\d{2}$/, "Choose a start time"),
    reminderEnd: z.string().regex(/^\d{2}:\d{2}$/, "Choose an end time"),
    reminderEveryMin: z.string(),
  })
  .refine((v) => !v.remindersEnabled || v.reminderEnd > v.reminderStart, { path: ["reminderEnd"], message: "End time must be after start time" })
type Values = z.infer<typeof schema>

/** SCR-M-026 Water Goal & Reminders. */
export default function WaterSettingsPage() {
  const q = useApiQuery(["employee", "water", "today"], () => waterApi.today())
  return (
    <TrackPage narrow>
      <TrackHeader title="Goal & reminders" subtitle="Set your daily water goal and smart hydration reminders" backHref="/employee-app/water" backLabel="Water" />
      {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data ? <Skeleton className="h-[480px] rounded-xl" /> : <SettingsForm settings={q.data.settings} />}
    </TrackPage>
  )
}

function SettingsForm({ settings }: { settings: WaterSettings }) {
  const router = useRouter()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      goalL: Math.round(settings.goalMl / 100) / 10,
      remindersEnabled: settings.remindersEnabled,
      reminderStart: settings.reminderStart,
      reminderEnd: settings.reminderEnd,
      reminderEveryMin: String(settings.reminderEveryMin),
    },
  })
  const goalL = useWatch({ control: form.control, name: "goalL" })
  const enabled = useWatch({ control: form.control, name: "remindersEnabled" })
  const every = Number(useWatch({ control: form.control, name: "reminderEveryMin" }))
  const start = useWatch({ control: form.control, name: "reminderStart" })
  const end = useWatch({ control: form.control, name: "reminderEnd" })
  const windowMin = (() => {
    const [sh, sm] = start.split(":").map(Number) as [number, number]
    const [eh, em] = end.split(":").map(Number) as [number, number]
    return eh * 60 + em - (sh * 60 + sm)
  })()
  const reminders = windowMin > 0 ? Math.floor(windowMin / every) + 1 : 0

  const save = useApiMutation(waterApi.updateSettings, {
    success: (s) => `Water goal updated to ${formatNumber(s.goalMl / 1000, 1)} L.`,
    errorTitle: "Couldn't save your settings",
    onSuccess: () => router.push("/employee-app/water"),
    onError: (e) => {
      if (e.fieldErrors?.goalMl) form.setError("goalL", { message: e.fieldErrors.goalMl })
      if (e.fieldErrors?.reminderEnd) form.setError("reminderEnd", { message: e.fieldErrors.reminderEnd })
    },
  })

  const onSubmit = form.handleSubmit((v) =>
    save.mutate({
      goalMl: Math.round(v.goalL * 10) * 100,
      remindersEnabled: v.remindersEnabled,
      reminderStart: v.reminderStart,
      reminderEnd: v.reminderEnd,
      reminderEveryMin: Number(v.reminderEveryMin),
    }),
  )

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Card className="gap-0 py-0">
        <CardContent className="space-y-5 p-5">
          <div className="flex items-center gap-3">
            <IconBubble icon={Droplets} tone="cyan" />
            <div>
              <p className="font-semibold">Daily water goal</p>
              <p className="text-xs text-muted-foreground">Between 1 and 5 litres, in 0.1 L steps</p>
            </div>
          </div>
          <NumberStepper label="Daily water goal" value={goalL} min={1} max={5} step={0.1} onChange={(v) => form.setValue("goalL", Math.round(v * 10) / 10, { shouldDirty: true, shouldValidate: true })} format={(v) => `${v.toFixed(1)} L`} />
          <div className="flex justify-center gap-2">
            {[2, 2.5, 3].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => form.setValue("goalL", v, { shouldDirty: true, shouldValidate: true })}
                className="rounded-full border px-3 py-1.5 text-xs font-medium hover:border-primary/40 aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary"
                aria-pressed={goalL === v}
              >
                {v.toFixed(1)} L
              </button>
            ))}
          </div>
          {form.formState.errors.goalL ? <p className="text-center text-xs font-medium text-destructive">{form.formState.errors.goalL.message}</p> : null}
          <p className="text-center text-xs text-muted-foreground">About {Math.round((goalL * 1000) / 250)} glasses of 250 ml a day. Today&apos;s progress recalculates when you save.</p>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <IconBubble icon={BellRing} tone="violet" />
            <div>
              <p className="font-semibold">Hydration reminders</p>
              <p className="text-xs text-muted-foreground">Gentle nudges during your day</p>
            </div>
          </div>
          <SwitchField control={form.control} name="remindersEnabled" label="Smart reminders" description="Remind me to drink water at regular intervals." />
          {enabled ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <TextField control={form.control} name="reminderStart" label="From" type="time" />
                <TextField control={form.control} name="reminderEnd" label="Until" type="time" />
              </div>
              <SelectField
                control={form.control}
                name="reminderEveryMin"
                label="Remind me every"
                options={[30, 45, 60, 90, 120, 180].map((m) => ({ value: String(m), label: m < 60 ? `${m} minutes` : m === 60 ? "1 hour" : `${m / 60} hours` }))}
              />
              <p className="text-xs text-muted-foreground">{reminders > 0 ? `Up to ${reminders} reminders a day.` : "Choose a time window to see how many reminders you'll get."}</p>
            </>
          ) : null}
          <div className="flex items-start gap-2.5 rounded-xl bg-violet-500/8 p-3 text-xs text-violet-900 dark:text-violet-200">
            <Sparkles className="mt-0.5 size-4 shrink-0" />
            <p>
              <strong>Smart</strong> means reminders skip times right after you log water, and stop for the day once you reach your goal. Quiet hours from your notification settings always apply.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1 sm:flex-none" onClick={() => router.push("/employee-app/water")}>
          Cancel
        </Button>
        <Button type="submit" className="h-11 flex-1 sm:min-w-40 sm:flex-none" disabled={save.isPending}>
          {save.isPending ? <Spinner /> : null}
          Save
        </Button>
      </div>
    </form>
  )
}
