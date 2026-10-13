"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Footprints, Gauge, Ruler, Target } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { ChoiceField, TextField } from "@/components/common/form-fields"
import { PrivacyNote } from "@/components/common/misc"
import { ACTIVITY_LEVEL_OPTIONS, FITNESS_LEVEL_OPTIONS, GOAL_OPTIONS } from "@/components/employee/engage/account/labels"
import { FormActions, FormSection } from "@/components/employee/engage/account/rows"
import { EngagePage, LoadError } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { profileApi, type MyProfile } from "@/lib/api/employee/profile"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** FRM-08 */
const schema = z.object({
  heightCm: z.number({ error: "Enter your height in cm" }).min(100, "Enter a height between 100 and 250 cm").max(250, "Enter a height between 100 and 250 cm"),
  weightKg: z.number({ error: "Enter your weight in kg" }).min(30, "Enter a weight between 30 and 250 kg").max(250, "Enter a weight between 30 and 250 kg"),
  mainGoal: z.enum(["lose_weight", "stay_active", "build_strength", "reduce_stress", "sleep_better", "eat_healthier"], { error: "Choose your main goal" }),
  activityLevel: z.enum(["sedentary", "light", "moderate", "very_active"], { error: "Choose your activity level" }),
  fitnessLevel: z.enum(["beginner", "intermediate", "advanced"], { error: "Choose your fitness level" }),
  dailyStepGoal: z
    .number({ error: "Enter a daily step goal" })
    .int("Use a whole number")
    .min(1000, "Choose a goal between 1,000 and 50,000 steps")
    .max(50000, "Choose a goal between 1,000 and 50,000 steps"),
})
type Values = z.infer<typeof schema>

const STEP_PRESETS = [6000, 8000, 10000, 12000]

/** SCR-M-071 Edit Profile – Wellness Details. */
export default function WellnessDetailsPage() {
  const q = useApiQuery(["employee", "profile"], () => profileApi.get())
  return (
    <EngagePage size="narrow" title="Wellness details" description="Helps us set the right goals and suggestions for you." backHref="/employee-app/profile" backLabel="Profile">
      <PrivacyNote>
        <span className="font-semibold">Only you can see these details.</span> They&apos;re encrypted and never shown to HR, your manager or company admins.
      </PrivacyNote>
      {q.error ? (
        <LoadError title="Couldn't load your wellness details." error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="space-y-5">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      ) : (
        <WellnessForm data={q.data} />
      )}
    </EngagePage>
  )
}

function WellnessForm({ data }: { data: MyProfile }) {
  const router = useRouter()
  const w = data.wellness
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      heightCm: w.heightCm,
      weightKg: w.weightKg,
      mainGoal: w.mainGoal,
      activityLevel: w.activityLevel,
      fitnessLevel: w.fitnessLevel,
      dailyStepGoal: w.dailyStepGoal,
    },
  })
  const stepGoal = useWatch({ control: form.control, name: "dailyStepGoal" })

  const save = useApiMutation(profileApi.updateWellness, {
    success: "Wellness details updated.",
    errorTitle: "Couldn't save your wellness details",
    onSuccess: () => router.push("/employee-app/profile"),
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
    },
  })

  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-5" noValidate>
      <FormSection icon={Ruler} tone="sky" title="Body measurements">
        <div className="grid grid-cols-2 gap-4">
          <TextField control={form.control} name="heightCm" label="Height" type="number" suffix="cm" description="100–250 cm" required />
          <TextField control={form.control} name="weightKg" label="Weight" type="number" suffix="kg" description="30–250 kg" required />
        </div>
      </FormSection>

      <FormSection icon={Target} tone="rose" title="Main goal" description="What matters most to you right now?">
        <ChoiceField
          control={form.control}
          name="mainGoal"
          columns={2}
          options={GOAL_OPTIONS.map((g) => ({ value: g.value, label: g.label, description: g.description, icon: g.emoji }))}
        />
      </FormSection>

      <FormSection icon={Gauge} tone="violet" title="Activity & fitness">
        <ChoiceField control={form.control} name="activityLevel" label="Activity level" columns={2} options={ACTIVITY_LEVEL_OPTIONS} />
        <ChoiceField control={form.control} name="fitnessLevel" label="Fitness level" columns={3} options={FITNESS_LEVEL_OPTIONS} />
      </FormSection>

      <FormSection icon={Footprints} tone="emerald" title="Daily step goal" description="Your goal on Home, Activity and in your Wellness Score.">
        <TextField control={form.control} name="dailyStepGoal" label="Steps per day" type="number" suffix="steps" description="Between 1,000 and 50,000 steps" required />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick step goals">
          {STEP_PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => form.setValue("dailyStepGoal", n, { shouldDirty: true, shouldValidate: true })}
              className={cn(
                "inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium tabular-nums transition-colors",
                stepGoal === n ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30" : "bg-card hover:bg-muted",
              )}
            >
              {formatNumber(n)}
            </button>
          ))}
        </div>
      </FormSection>

      <FormActions>
        <Button asChild variant="outline">
          <Link href="/employee-app/profile">Cancel</Link>
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Spinner /> : null}
          Save
        </Button>
      </FormActions>
    </form>
  )
}
