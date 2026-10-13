"use client"

import { ArrowRight, Lock } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { FieldShell } from "@/components/common/form-fields"
import { OnboardingFrame, OnboardingGate, useOnboardingState } from "@/components/employee/track/onboarding-frame"
import { Chip, Segmented } from "@/components/employee/track/track-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { onboardingApi, type OnboardingState, type WellnessGoal, type WellnessInput } from "@/lib/api/employee/onboarding"
import { useApiMutation } from "@/lib/api/hooks"
import { cn } from "@/lib/utils"

const GOALS: { value: WellnessGoal; label: string; emoji: string }[] = [
  { value: "stay_active", label: "Stay active", emoji: "🏃" },
  { value: "lose_weight", label: "Lose weight", emoji: "⚖️" },
  { value: "build_strength", label: "Build strength", emoji: "💪" },
  { value: "reduce_stress", label: "Reduce stress", emoji: "🧘" },
  { value: "sleep_better", label: "Sleep better", emoji: "😴" },
  { value: "eat_healthier", label: "Eat healthier", emoji: "🥗" },
]
const ACTIVITY: { value: WellnessInput["activityLevel"]; label: string; hint: string }[] = [
  { value: "sedentary", label: "Mostly sitting", hint: "Desk job, little exercise" },
  { value: "light", label: "Lightly active", hint: "Some walking most days" },
  { value: "moderate", label: "Moderately active", hint: "Exercise 2–3 times a week" },
  { value: "very_active", label: "Very active", hint: "Exercise most days" },
]
const FITNESS: { value: WellnessInput["fitnessLevel"]; label: string; hint: string }[] = [
  { value: "beginner", label: "Beginner", hint: "Just getting started" },
  { value: "intermediate", label: "Intermediate", hint: "Work out regularly" },
  { value: "advanced", label: "Advanced", hint: "Train hard most weeks" },
]
const ACTIVITIES = ["Walking", "Running", "Cycling", "Yoga", "Gym", "Swimming", "Sports", "Dancing", "Meditation", "Hiking"]

type Units = "metric" | "imperial"

/** SCR-M-014 Health & Wellness Goals — onboarding step 2 of 4. */
export default function GoalsPage() {
  const q = useOnboardingState()
  return (
    <OnboardingFrame step={2} backHref="/employee-app/onboarding/profile" title="Your wellness goals" subtitle="Pick what matters to you — we'll tailor workouts, tips and goals.">
      <OnboardingGate query={q}>{(s) => <GoalsForm state={s} />}</OnboardingGate>
    </OnboardingFrame>
  )
}

function GoalsForm({ state }: { state: OnboardingState }) {
  const router = useRouter()
  const w = state.wellness
  const [goals, setGoals] = useState<WellnessGoal[]>(w.goals)
  const [units, setUnits] = useState<Units>("metric")
  const [cm, setCm] = useState(w.heightCm ? String(w.heightCm) : "")
  const [ft, setFt] = useState(w.heightCm ? String(Math.floor(w.heightCm / 30.48)) : "")
  const [inch, setInch] = useState(w.heightCm ? String(Math.round((w.heightCm / 2.54) % 12)) : "")
  const [kg, setKg] = useState(w.weightKg ? String(w.weightKg) : "")
  const [lb, setLb] = useState(w.weightKg ? String(Math.round(w.weightKg * 2.20462)) : "")
  const [activityLevel, setActivityLevel] = useState(w.activityLevel)
  const [fitnessLevel, setFitnessLevel] = useState(w.fitnessLevel)
  const [activities, setActivities] = useState<string[]>(w.activities)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const heightCm = units === "metric" ? Number(cm) : (Number(ft) * 12 + Number(inch || 0)) * 2.54
  const weightKg = units === "metric" ? Number(kg) : Number(lb) / 2.20462

  const save = useApiMutation(onboardingApi.saveWellness, {
    onSuccess: () => router.push("/employee-app/onboarding/permissions"),
    onError: (e) => e.fieldErrors && setErrors(e.fieldErrors),
  })

  const validate = () => {
    const e: Record<string, string> = {}
    if (!goals.length) e.goals = "Choose at least one goal"
    if (!heightCm || heightCm < 100 || heightCm > 250) e.heightCm = units === "metric" ? "Enter a height between 100 and 250 cm." : "Enter a height between 3 ft 4 in and 8 ft 2 in."
    if (!weightKg || weightKg < 30 || weightKg > 300) e.weightKg = units === "metric" ? "Enter a weight between 30 and 300 kg." : "Enter a weight between 66 and 660 lb."
    if (!activityLevel) e.activityLevel = "Choose your activity level"
    if (!fitnessLevel) e.fitnessLevel = "Choose your fitness level"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    save.mutate({ goals, heightCm: Math.round(heightCm), weightKg: Math.round(weightKg * 10) / 10, activityLevel: activityLevel as WellnessInput["activityLevel"], fitnessLevel: fitnessLevel as WellnessInput["fitnessLevel"], activities })
  }

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-6" noValidate>
      <FieldShell label="What would you like to focus on?" error={errors.goals} required>
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map((g) => {
            const on = goals.includes(g.value)
            return (
              <button
                key={g.value}
                type="button"
                aria-pressed={on}
                onClick={() => setGoals((x) => toggle(x, g.value))}
                className={cn("flex items-center gap-2.5 rounded-2xl border bg-card p-3 text-left text-sm font-semibold transition-all hover:border-primary/40", on && "border-primary bg-primary/8 ring-1 ring-primary/30")}
              >
                <span className="text-2xl leading-none">{g.emoji}</span>
                {g.label}
              </button>
            )
          })}
        </div>
      </FieldShell>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Height & weight</p>
          <Segmented
            ariaLabel="Units"
            value={units}
            onChange={setUnits}
            options={[
              { value: "metric", label: "cm · kg" },
              { value: "imperial", label: "ft · lb" },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FieldShell id="height" label="Height" error={errors.heightCm}>
            {units === "metric" ? (
              <UnitInput id="height" value={cm} onChange={setCm} unit="cm" placeholder="170" invalid={!!errors.heightCm} />
            ) : (
              <div className="flex gap-1.5">
                <UnitInput id="height" value={ft} onChange={setFt} unit="ft" placeholder="5" invalid={!!errors.heightCm} />
                <UnitInput value={inch} onChange={setInch} unit="in" placeholder="7" invalid={!!errors.heightCm} />
              </div>
            )}
          </FieldShell>
          <FieldShell id="weight" label="Weight" error={errors.weightKg}>
            {units === "metric" ? <UnitInput id="weight" value={kg} onChange={setKg} unit="kg" placeholder="65" invalid={!!errors.weightKg} /> : <UnitInput id="weight" value={lb} onChange={setLb} unit="lb" placeholder="145" invalid={!!errors.weightKg} />}
          </FieldShell>
        </div>
      </div>

      <FieldShell label="How active are you day to day?" error={errors.activityLevel} required>
        <div className="grid gap-2">
          {ACTIVITY.map((a) => (
            <Option key={a.value} selected={activityLevel === a.value} onClick={() => setActivityLevel(a.value)} label={a.label} hint={a.hint} />
          ))}
        </div>
      </FieldShell>

      <FieldShell label="Your fitness level" error={errors.fitnessLevel} required>
        <div className="grid grid-cols-3 gap-2">
          {FITNESS.map((f) => (
            <Option key={f.value} selected={fitnessLevel === f.value} onClick={() => setFitnessLevel(f.value)} label={f.label} hint={f.hint} compact />
          ))}
        </div>
      </FieldShell>

      <FieldShell label="Activities you enjoy" description="Optional — pick as many as you like">
        <div className="flex flex-wrap gap-2">
          {ACTIVITIES.map((a) => (
            <Chip key={a} selected={activities.includes(a.toLowerCase())} onClick={() => setActivities((x) => toggle(x, a.toLowerCase()))}>
              {a}
            </Chip>
          ))}
        </div>
      </FieldShell>

      <p className="flex items-start gap-2 rounded-xl bg-emerald-500/8 p-3 text-xs text-emerald-900 dark:text-emerald-200">
        <Lock className="mt-0.5 size-3.5 shrink-0" /> Only you can see these details. They&apos;re encrypted and never shared with your employer.
      </p>

      <div className="mt-auto grid grid-cols-[auto_1fr] gap-2">
        <Button type="button" variant="outline" className="h-12" onClick={() => router.push("/employee-app/onboarding/profile")}>
          Back
        </Button>
        <Button type="submit" className="h-12 text-base" disabled={save.isPending}>
          {save.isPending ? <Spinner /> : null} Continue {!save.isPending ? <ArrowRight data-icon="inline-end" /> : null}
        </Button>
      </div>
    </form>
  )
}

function UnitInput({ id, value, onChange, unit, placeholder, invalid }: { id?: string; value: string; onChange: (v: string) => void; unit: string; placeholder?: string; invalid?: boolean }) {
  return (
    <div className="relative min-w-0 flex-1">
      <Input id={id} type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-11 pr-10 text-base" aria-invalid={invalid} />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">{unit}</span>
    </div>
  )
}

function Option({ selected, onClick, label, hint, compact }: { selected: boolean; onClick: () => void; label: string; hint: string; compact?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn("rounded-xl border bg-card text-left transition-all hover:border-primary/40", compact ? "p-2.5" : "flex items-center justify-between gap-3 p-3", selected && "border-primary bg-primary/8 ring-1 ring-primary/30")}
    >
      <span className="block text-sm font-semibold">{label}</span>
      <span className="block text-xs text-muted-foreground">{hint}</span>
    </button>
  )
}
