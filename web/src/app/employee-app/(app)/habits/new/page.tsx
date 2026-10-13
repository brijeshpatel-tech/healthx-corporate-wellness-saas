"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { TextField } from "@/components/common/form-fields"
import { UNIT_LABEL, targetText } from "@/components/employee/track/habit-ui"
import { InfoNote, NumberStepper, TrackHeader, TrackPage } from "@/components/employee/track/track-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { UNIT_RANGE, habitsApi, type HabitUnit } from "@/lib/api/employee/habits"
import { useApiMutation } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

const ICONS = ["✅", "📚", "🧘", "🚶", "💪", "🥗", "🍎", "💧", "😴", "🎯", "🎨", "🎸", "🌱", "☀️", "🧹", "📝", "🙏", "🫶", "🚴", "🏊"]
const TYPES: { value: Exclude<HabitUnit, "steps">; label: string; hint: string }[] = [
  { value: "check", label: "Yes / no", hint: "Tick it off once a day" },
  { value: "times", label: "Times", hint: "e.g. 3 stretch breaks" },
  { value: "minutes", label: "Minutes", hint: "e.g. 20 minutes reading" },
  { value: "glasses", label: "Glasses", hint: "e.g. 2 cups of green tea" },
  { value: "hours", label: "Hours", hint: "e.g. 1 hour offline" },
]

const schema = z.object({
  name: z.string().trim().min(2, "Habit name must be 2–40 characters").max(40, "Habit name must be 2–40 characters"),
  icon: z.string().min(1, "Pick an icon"),
  unit: z.enum(["check", "times", "minutes", "glasses", "hours"]),
  target: z.number(),
})
type Values = z.infer<typeof schema>

/** SCR-M-041 Create Custom Habit (Phase 2). */
export default function NewHabitPage() {
  const router = useRouter()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", icon: "✅", unit: "check", target: 1 } })
  const [icon, unit, target, name] = useWatch({ control: form.control, name: ["icon", "unit", "target", "name"] })
  const range = UNIT_RANGE[unit]
  const create = useApiMutation(habitsApi.createCustom, {
    success: "Habit created.",
    onSuccess: () => router.push("/employee-app/habits"),
    onError: (e) => {
      if (e.fieldErrors?.name) form.setError("name", { message: e.fieldErrors.name })
    },
  })

  const onSubmit = form.handleSubmit((v) => create.mutate({ name: v.name, icon: v.icon, unit: v.unit, target: v.unit === "check" ? 1 : v.target }))

  return (
    <TrackPage narrow>
      <TrackHeader title="Create a habit" phase={2} subtitle="Track something personal that isn't in the HealthX list" backHref="/employee-app/habits/choose" backLabel="Choose habits" />
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Card className="gap-0 py-0">
          <CardContent className="flex items-center gap-4 p-4 sm:p-5">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-muted text-4xl">{icon}</span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{name.trim() || "Your new habit"}</p>
              <p className="text-sm text-muted-foreground">{targetText(unit, unit === "check" ? 1 : target)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardContent className="space-y-5 p-4 sm:p-5">
            <TextField control={form.control} name="name" label="Habit name" placeholder="e.g. Read for 20 minutes" required />
            <div className="space-y-2">
              <p className="text-sm font-medium">Icon</p>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-10" role="radiogroup" aria-label="Icon">
                {ICONS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={icon === i}
                    onClick={() => form.setValue("icon", i)}
                    className={cn("flex aspect-square items-center justify-center rounded-xl border text-2xl transition-all hover:border-primary/40", icon === i && "border-primary bg-primary/8 ring-1 ring-primary/30")}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">How will you track it?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    aria-pressed={unit === t.value}
                    onClick={() => {
                      form.setValue("unit", t.value)
                      const r = UNIT_RANGE[t.value]
                      form.setValue("target", t.value === "check" ? 1 : t.value === "minutes" ? 20 : t.value === "hours" ? 4 : Math.max(r.min, 3))
                    }}
                    className={cn("rounded-xl border p-3 text-left transition-all hover:border-primary/40", unit === t.value && "border-primary bg-primary/6 ring-1 ring-primary/30")}
                  >
                    <p className="text-sm font-semibold">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{t.hint}</p>
                  </button>
                ))}
              </div>
            </div>
            {unit !== "check" ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Daily target</p>
                <NumberStepper label="Daily target" value={target} min={range.min} max={range.max} step={range.step} onChange={(v) => form.setValue("target", v)} format={(v) => `${formatNumber(v, unit === "hours" ? 1 : 0)} ${UNIT_LABEL[unit]}`} />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <InfoNote>Custom habits count towards your streaks and Wellness Score habits, but don&apos;t earn points (to be confirmed by your company).</InfoNote>

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-11 flex-1 sm:flex-none" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" className="h-11 flex-1 sm:min-w-36 sm:flex-none" disabled={create.isPending}>
            {create.isPending ? <Spinner /> : null} Create
          </Button>
        </div>
      </form>
    </TrackPage>
  )
}
