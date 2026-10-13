"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Activity, Dumbbell, Languages, Monitor, Moon, Palette, Ruler, Salad, Sun, Timer } from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { PhaseBadge } from "@/components/common/status-badge"
import { DURATION_OPTIONS, FOOD_OPTIONS, WORKOUT_LOCATION_OPTIONS } from "@/components/employee/engage/account/labels"
import { ChipGroup, FormActions, FormSection } from "@/components/employee/engage/account/rows"
import { EngagePage, LoadError } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { ACTIVITY_OPTIONS, LANGUAGE_OPTIONS, profileApi, type MyProfile } from "@/lib/api/employee/profile"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import type { EmployeePreferences } from "@/lib/types"
import { cn } from "@/lib/utils"

/** FRM-09 */
const schema = z.object({
  activities: z.array(z.string()).min(1, "Choose at least one activity").max(10, "Choose up to 10 activities"),
  workoutLocation: z.enum(["home", "gym", "outdoor", "any"], { error: "Choose where you like to work out" }),
  workoutDurationMin: z.string().min(1, "Choose a workout length"),
  foodPreference: z.enum(["vegetarian", "vegan", "eggetarian", "non_vegetarian", "jain", "no_preference"], { error: "Choose a food preference" }),
  language: z.string().min(1),
  units: z.enum(["metric", "imperial"]),
})
type Values = z.infer<typeof schema>

/** SCR-M-072 Preferences. */
export default function PreferencesPage() {
  const q = useApiQuery(["employee", "profile"], () => profileApi.get())
  return (
    <EngagePage size="narrow" title="Preferences" description="We use these to suggest workouts, challenges and tips you'll enjoy." backHref="/employee-app/settings" backLabel="Settings">
      {q.error ? (
        <LoadError title="Couldn't load your preferences." error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="space-y-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : (
        <PreferencesForm data={q.data} />
      )}
    </EngagePage>
  )
}

function PreferencesForm({ data }: { data: MyProfile }) {
  const p = data.preferences
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      activities: p.activities,
      workoutLocation: p.workoutLocation,
      workoutDurationMin: String(p.workoutDurationMin),
      foodPreference: p.foodPreference,
      language: p.language || "English",
      units: p.units,
    },
  })
  const save = useApiMutation(profileApi.updatePreferences, {
    success: "Preferences saved.",
    errorTitle: "Couldn't save your preferences.",
    onSuccess: (prefs) => form.reset({ ...form.getValues(), activities: prefs.activities }),
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
    },
  })

  const submit = (v: Values) =>
    save.mutate({
      activities: v.activities,
      workoutLocation: v.workoutLocation,
      workoutDurationMin: Number(v.workoutDurationMin),
      foodPreference: v.foodPreference,
      language: v.language,
      units: v.units,
    })

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-5" noValidate>
      <FormSection icon={Activity} tone="emerald" title="Preferred activities" description="Pick everything you enjoy — choose at least one.">
        <Controller
          control={form.control}
          name="activities"
          render={({ field, fieldState }) => (
            <div className="space-y-2">
              <ChipGroup
                multiple
                ariaLabel="Preferred activities"
                invalid={!!fieldState.error}
                options={ACTIVITY_OPTIONS}
                value={field.value}
                onChange={(v) => field.onChange(v as string[])}
              />
              <FieldError message={fieldState.error?.message} />
            </div>
          )}
        />
      </FormSection>

      <FormSection icon={Dumbbell} tone="violet" title="Workouts" description="Where and how long you like to train.">
        <Controller
          control={form.control}
          name="workoutLocation"
          render={({ field, fieldState }) => (
            <div className="space-y-2">
              <p className="text-sm font-medium">Workout location</p>
              <ChipGroup ariaLabel="Workout location" options={WORKOUT_LOCATION_OPTIONS} value={field.value} onChange={(v) => field.onChange(v)} />
              <FieldError message={fieldState.error?.message} />
            </div>
          )}
        />
        <Controller
          control={form.control}
          name="workoutDurationMin"
          render={({ field, fieldState }) => (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Timer className="size-4 text-muted-foreground" /> Preferred workout length
              </p>
              <ChipGroup ariaLabel="Preferred workout length" options={DURATION_OPTIONS} value={field.value} onChange={(v) => field.onChange(v)} />
              <FieldError message={fieldState.error?.message} />
            </div>
          )}
        />
      </FormSection>

      <FormSection icon={Salad} tone="lime" title="Food preference" description="Used for meal ideas and nutrition tips.">
        <Controller
          control={form.control}
          name="foodPreference"
          render={({ field, fieldState }) => (
            <div className="space-y-2">
              <ChipGroup ariaLabel="Food preference" options={FOOD_OPTIONS} value={field.value} onChange={(v) => field.onChange(v)} />
              <FieldError message={fieldState.error?.message} />
            </div>
          )}
        />
      </FormSection>

      <FormSection icon={Languages} tone="sky" title="Language" description="More languages are coming soon. Your choice applies straight away.">
        <Controller
          control={form.control}
          name="language"
          render={({ field }) => (
            <ChipGroup
              ariaLabel="Language"
              options={LANGUAGE_OPTIONS.map((l) => ({ value: l.value, label: l.label, disabled: !l.available, hint: l.available ? undefined : "Soon" }))}
              value={field.value}
              onChange={(v) => field.onChange(v)}
            />
          )}
        />
      </FormSection>

      <FormSection id="units" icon={Ruler} tone="amber" title="Units" badge={<PhaseBadge phase={2} />} description="How distances, weight and height are shown.">
        <Controller
          control={form.control}
          name="units"
          render={({ field }) => (
            <ChipGroup
              ariaLabel="Units"
              options={[
                { value: "metric", label: "Metric (km, kg, cm)" },
                { value: "imperial", label: "Imperial (mi, lb, ft)" },
              ]}
              value={field.value}
              onChange={(v) => field.onChange(v)}
            />
          )}
        />
      </FormSection>

      <AppearanceCard saved={p.theme} />

      <FormActions>
        <Button asChild variant="outline">
          <Link href="/employee-app/settings">Cancel</Link>
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Spinner /> : null}
          Save
        </Button>
      </FormActions>
    </form>
  )
}

const THEMES: { value: EmployeePreferences["theme"]; label: string; icon: typeof Sun; hint: string }[] = [
  { value: "system", label: "System", icon: Monitor, hint: "Match your device" },
  { value: "light", label: "Light", icon: Sun, hint: "Bright and clear" },
  { value: "dark", label: "Dark", icon: Moon, hint: "Easy on the eyes" },
]

/** Theme applies immediately on this device and is saved to the account. */
function AppearanceCard({ saved }: { saved: EmployeePreferences["theme"] }) {
  const { theme, setTheme } = useTheme()
  const current = (theme as EmployeePreferences["theme"] | undefined) ?? saved
  const save = useApiMutation(profileApi.updatePreferences, { errorTitle: "Couldn't save your theme", invalidate: [["employee", "profile"]] })
  return (
    <FormSection id="appearance" icon={Palette} tone="pink" title="Appearance" description="Changes apply straight away.">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
        {THEMES.map((t) => {
          const active = current === t.value
          return (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setTheme(t.value)
                save.mutate({ theme: t.value })
              }}
              className={cn(
                "flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active ? "border-primary bg-primary/8 text-primary ring-1 ring-primary/30" : "bg-card hover:bg-muted",
              )}
            >
              <t.icon className="size-5" />
              <span className="text-sm font-semibold">{t.label}</span>
              <span className="hidden text-[11px] text-muted-foreground sm:block">{t.hint}</span>
            </button>
          )
        })}
      </div>
    </FormSection>
  )
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-xs font-medium text-destructive" role="alert">
      {message}
    </p>
  ) : null
}
