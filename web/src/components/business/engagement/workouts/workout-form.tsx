"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowDown, ArrowUp, Clock, Dumbbell, Flame, Plus, Rocket, Save, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useFieldArray, useForm, useWatch, type UseFormReturn } from "react-hook-form"
import { z } from "zod"
import { CoverPicker } from "@/components/business/engagement/cover-picker"
import { PhoneFrame } from "@/components/business/engagement/phone-frame"
import { ChoiceField, FieldShell, SelectField, TextareaField, TextField } from "@/components/common/form-fields"
import { SectionCard } from "@/components/common/misc"
import { EmptyState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  stepWorkSec,
  WORKOUT_CATEGORIES,
  WORKOUT_EQUIPMENT,
  WORKOUT_LEVELS,
  WORKOUT_LIMITS,
  WORKOUT_LOCATIONS,
  WORKOUT_MUSCLE_GROUPS,
  workoutDurationMin,
  workoutsApi,
  type ExerciseOption,
  type WorkoutDetail,
  type WorkoutInput,
} from "@/lib/api/business/workouts"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import type { Workout } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ExercisePickerDialog } from "./exercise-picker"
import { capitalize, formatSeconds, LEVEL_META, LOCATION_META, WORKOUT_EMOJIS } from "./workout-meta"

const num = z.union([z.number(), z.literal("")])
const L = WORKOUT_LIMITS

const schema = z
  .object({
    name: z.string().trim().min(L.nameMin, `Use at least ${L.nameMin} characters`).max(L.nameMax, `Keep the name under ${L.nameMax} characters`),
    description: z.string().max(L.descriptionMax, `Keep the description under ${L.descriptionMax} characters`),
    category: z.string().min(1, "Choose a category"),
    level: z.enum(["beginner", "intermediate", "advanced"]),
    location: z.enum(["home", "gym", "outdoor", "office"]),
    equipment: z.array(z.string()),
    muscleGroups: z.array(z.string()),
    calories: z.number({ error: "Enter an estimate (0 if unsure)" }).int("Whole numbers only").min(0, "0 or more").max(L.caloriesMax, `Up to ${formatNumber(L.caloriesMax)} kcal`),
    points: z.number({ error: "Enter points (0 for none)" }).int("Whole numbers only").min(0, "0 or more").max(L.pointsMax, `Up to ${L.pointsMax} points`),
    coverEmoji: z.string().min(1, "Choose an emoji"),
    coverColor: z.string().min(1),
    steps: z
      .array(z.object({ exerciseId: z.string(), mode: z.enum(["time", "reps"]), durationSec: num, reps: num, restSec: num }))
      .min(1, "Add at least one exercise")
      .max(L.maxExercises, `Up to ${L.maxExercises} exercises`),
  })
  .superRefine((v, ctx) => {
    v.steps.forEach((s, i) => {
      if (s.mode === "time" && !(typeof s.durationSec === "number" && s.durationSec >= L.durationMin && s.durationSec <= L.durationMax))
        ctx.addIssue({ code: "custom", path: ["steps", i, "durationSec"], message: `${L.durationMin}–${L.durationMax} s` })
      if (s.mode === "reps" && !(typeof s.reps === "number" && s.reps >= 1 && s.reps <= L.repsMax)) ctx.addIssue({ code: "custom", path: ["steps", i, "reps"], message: `1–${L.repsMax} reps` })
      if (!(typeof s.restSec === "number" && s.restSec >= 0 && s.restSec <= L.restMax)) ctx.addIssue({ code: "custom", path: ["steps", i, "restSec"], message: `0–${L.restMax} s` })
    })
  })
type Values = z.infer<typeof schema>
type Step = Values["steps"][number]

const toSteps = (w: Workout): Step[] =>
  w.exercises.map((s) => ({ exerciseId: s.exerciseId, mode: s.reps ? "reps" : "time", durationSec: s.reps ? 30 : (s.durationSec ?? 30), reps: s.reps ?? 10, restSec: s.restSec }))

const defaults = (w?: Workout): Values =>
  w
    ? {
        name: w.name,
        description: w.description,
        category: w.category,
        level: w.level,
        location: w.location,
        equipment: w.equipment,
        muscleGroups: w.muscleGroups,
        calories: w.calories,
        points: w.points,
        coverEmoji: w.coverEmoji || "💪",
        coverColor: w.coverColor || "#10b981",
        steps: toSteps(w),
      }
    : { name: "", description: "", category: "Full Body", level: "beginner", location: "home", equipment: [], muscleGroups: [], calories: 120, points: 50, coverEmoji: "💪", coverColor: "#10b981", steps: [] }

const stepInput = (s: Step) => (s.mode === "reps" ? { reps: Number(s.reps) || 0 } : { durationSec: Number(s.durationSec) || 0 })

/** #372 (Phase 2) — create / edit a company workout from HealthX exercises, with a live app preview. */
export function WorkoutForm({ detail }: { detail?: WorkoutDetail }) {
  const router = useRouter()
  const workout = detail?.workout
  const status = workout?.status ?? "draft"
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults(workout), mode: "onTouched" })
  const steps = useFieldArray({ control: form.control, name: "steps" })
  const v = useWatch({ control: form.control }) as Values
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pending, setPending] = useState<"draft" | "publish" | null>(null)
  const exercises = useApiQuery(["business", "workouts", "exercises"], () => workoutsApi.exercises())
  const byId = useMemo(() => new Map([...(exercises.data ?? []), ...(detail?.exercises ?? [])].map((e) => [e.id, e])), [exercises.data, detail?.exercises])

  const plan = (v.steps ?? []).map((s) => ({ ...stepInput(s), restSec: Number(s.restSec) || 0 }))
  const totalMin = plan.length ? workoutDurationMin(plan) : 0
  const usedCounts = (v.steps ?? []).reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.exerciseId]: (acc[s.exerciseId] ?? 0) + 1 }), {})

  const onSuccess = (w: Workout) => {
    setPending(null)
    router.push(`/business-portal/workouts/${w.id}`)
  }
  const onError = (err: { fieldErrors?: Record<string, string> }) => {
    setPending(null)
    Object.entries(err.fieldErrors ?? {}).forEach(([k, message]) => form.setError(k.replace(/^exercises/, "steps") as keyof Values, { message }))
  }
  const success = (w: Workout, input: WorkoutInput) => (input.publish && status !== "published" ? `“${w.name}” is live — employees can find it in the app.` : workout ? "Changes saved" : "Draft saved")
  const create = useApiMutation(workoutsApi.create, { success, onSuccess, onError })
  const update = useApiMutation(workoutsApi.update, { success, onSuccess, onError })
  const busy = create.isPending || update.isPending

  const submit = (publish: boolean) =>
    form.handleSubmit(
      (values) => {
        setPending(publish ? "publish" : "draft")
        const input: WorkoutInput = {
          name: values.name,
          description: values.description,
          category: values.category,
          level: values.level,
          location: values.location,
          equipment: values.equipment,
          muscleGroups: values.muscleGroups,
          calories: values.calories,
          points: values.points,
          coverEmoji: values.coverEmoji,
          coverColor: values.coverColor,
          exercises: values.steps.map((s) => ({ exerciseId: s.exerciseId, ...stepInput(s), restSec: Number(s.restSec) || 0 })),
          publish,
        }
        if (workout) update.mutate({ ...input, id: workout.id })
        else create.mutate(input)
      },
      () => document.querySelector("[aria-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" }),
    )()

  const addExercise = (e: ExerciseOption) => {
    if (steps.fields.length >= L.maxExercises) return
    steps.append({ exerciseId: e.id, mode: e.defaultReps ? "reps" : "time", durationSec: e.defaultDurationSec || 30, reps: e.defaultReps ?? 10, restSec: 15 })
    form.clearErrors("steps")
  }
  const toggleTag = (field: "equipment" | "muscleGroups", tag: string) => {
    const list = v[field] ?? []
    form.setValue(field, list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag], { shouldDirty: true })
  }
  const stepsError = form.formState.errors.steps?.message ?? form.formState.errors.steps?.root?.message

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-6">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <SectionCard title="Basics" description="What employees see in the workout library.">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="name" label="Workout name" placeholder="e.g. 10-minute desk reset" required className="sm:col-span-2" />
              <TextareaField control={form.control} name="description" label="Description" placeholder="Who it's for and what it does." rows={3} maxLength={L.descriptionMax} className="sm:col-span-2" />
              <SelectField control={form.control} name="category" label="Category" required options={WORKOUT_CATEGORIES.map((c) => ({ value: c, label: c }))} />
              <ChoiceField
                control={form.control}
                name="location"
                label="Where"
                columns={4}
                options={WORKOUT_LOCATIONS.map((l) => {
                  const Icon = LOCATION_META[l].icon
                  return { value: l, label: LOCATION_META[l].label, icon: <Icon className="size-4 text-primary" /> }
                })}
                className="sm:col-span-2"
              />
              <ChoiceField control={form.control} name="level" label="Level" columns={3} options={WORKOUT_LEVELS.map((l) => ({ value: l, label: LEVEL_META[l].label, description: LEVEL_META[l].description }))} className="sm:col-span-2" />
              <CoverPicker
                emoji={v.coverEmoji}
                color={v.coverColor}
                emojis={WORKOUT_EMOJIS}
                onEmojiChange={(e) => form.setValue("coverEmoji", e, { shouldDirty: true })}
                onColorChange={(c) => form.setValue("coverColor", c, { shouldDirty: true })}
                className="sm:col-span-2"
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Exercises"
            description="Pick exercises from the HealthX library, then set time or reps and the rest after each one."
            actions={
              <Button type="button" size="sm" onClick={() => setPickerOpen(true)} disabled={steps.fields.length >= L.maxExercises}>
                <Plus data-icon="inline-start" /> Add exercises
              </Button>
            }
          >
            {steps.fields.length === 0 ? (
              <EmptyState
                icon={Dumbbell}
                title="No exercises yet"
                description="Add at least one exercise. Each comes with a video, image and step-by-step instructions."
                action={
                  <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>
                    <Plus data-icon="inline-start" /> Add exercises
                  </Button>
                }
                className={cn("py-8", stepsError && "border-destructive/40")}
              />
            ) : (
              <ol className="space-y-2">
                {steps.fields.map((f, i) => {
                  const s = v.steps?.[i]
                  const ex = byId.get(f.exerciseId)
                  const errs = form.formState.errors.steps?.[i]
                  return (
                    <li key={f.id} className="rounded-xl border p-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">{i + 1}</span>
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-lg" aria-hidden>
                          {ex?.mediaEmoji ?? "🏋️"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{ex?.name ?? "Exercise"}</p>
                          <p className="truncate text-xs text-muted-foreground">{ex ? ex.muscleGroups.map(capitalize).join(", ") : ""}</p>
                          {errs?.exerciseId?.message ? <p className="text-xs font-medium text-destructive">{errs.exerciseId.message}</p> : null}
                        </div>
                        <div className="flex shrink-0 items-center">
                          <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => steps.move(i, i - 1)} aria-label={`Move ${ex?.name ?? "exercise"} up`}>
                            <ArrowUp />
                          </Button>
                          <Button type="button" variant="ghost" size="icon-sm" disabled={i === steps.fields.length - 1} onClick={() => steps.move(i, i + 1)} aria-label={`Move ${ex?.name ?? "exercise"} down`}>
                            <ArrowDown />
                          </Button>
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => steps.remove(i)} aria-label={`Remove ${ex?.name ?? "exercise"}`}>
                            <Trash2 className="text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-start gap-3 pl-9">
                        <ToggleGroup
                          type="single"
                          variant="outline"
                          size="sm"
                          value={s?.mode ?? "time"}
                          onValueChange={(m) => m && form.setValue(`steps.${i}.mode`, m as Step["mode"], { shouldDirty: true, shouldValidate: form.formState.isSubmitted })}
                          aria-label="Measure by"
                        >
                          <ToggleGroupItem value="time" className="h-8 px-2.5 text-xs">
                            Time
                          </ToggleGroupItem>
                          <ToggleGroupItem value="reps" className="h-8 px-2.5 text-xs">
                            Reps
                          </ToggleGroupItem>
                        </ToggleGroup>
                        {s?.mode === "reps" ? (
                          <NumberBox label="Reps" name={`steps.${i}.reps`} form={form} suffix="reps" error={errs?.reps?.message} />
                        ) : (
                          <NumberBox label="Work" name={`steps.${i}.durationSec`} form={form} suffix="sec" error={errs?.durationSec?.message} />
                        )}
                        <NumberBox label="Rest after" name={`steps.${i}.restSec`} form={form} suffix="sec" error={errs?.restSec?.message} />
                        <span className="self-center text-xs text-muted-foreground">≈ {formatSeconds(stepWorkSec(stepInput(s ?? f)))}</span>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
            {stepsError ? (
              <p className="mt-2 text-xs font-medium text-destructive" role="alert">
                {stepsError}
              </p>
            ) : null}
            {steps.fields.length ? (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="size-4" /> Total ≈ <span className="font-semibold text-foreground">{totalMin} min</span> · {steps.fields.length} {steps.fields.length === 1 ? "exercise" : "exercises"} · rest after the last exercise isn&apos;t counted
              </p>
            ) : null}
          </SectionCard>

          <SectionCard title="Details" description="Helps people filter and choose the right workout.">
            <div className="grid gap-5">
              <TagPicker label="Equipment" values={v.equipment ?? []} options={WORKOUT_EQUIPMENT} onToggle={(t) => toggleTag("equipment", t)} emptyHint="None selected = no equipment needed" />
              <TagPicker label="Muscle groups" values={v.muscleGroups ?? []} options={WORKOUT_MUSCLE_GROUPS} onToggle={(t) => toggleTag("muscleGroups", t)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField control={form.control} name="calories" type="number" label="Calories (estimate)" suffix="kcal" required />
                <TextField control={form.control} name="points" type="number" label="Points for completing" suffix="pts" required description={`0–${L.pointsMax}. HealthX workouts usually give 50.`} />
              </div>
            </div>
          </SectionCard>
        </div>

        <aside className="lg:sticky lg:top-20">
          <PhoneFrame label="Preview — as employees will see it">
            <div className="overflow-hidden rounded-2xl bg-card text-[13px] shadow-sm ring-1 ring-foreground/5">
              <div className="flex h-28 items-center justify-center" style={{ background: `linear-gradient(135deg, ${v.coverColor}, ${v.coverColor}b3)` }}>
                <span className="text-5xl drop-shadow">{v.coverEmoji}</span>
              </div>
              <div className="space-y-3 p-3">
                <div>
                  <p className="font-heading text-base leading-tight font-bold break-words">{v.name || "Workout name"}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {v.category} · {LEVEL_META[v.level].label} · {LOCATION_META[v.location].label}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <PreviewStat icon={<Clock className="size-3" />} value={totalMin ? `${totalMin} min` : "—"} />
                  <PreviewStat icon={<Flame className="size-3" />} value={`${Number(v.calories) || 0} kcal`} />
                  <PreviewStat icon={<span className="text-[10px]">⭐</span>} value={`+${Number(v.points) || 0}`} />
                </div>
                {v.description ? <p className="line-clamp-3 text-[12px] text-muted-foreground">{v.description}</p> : null}
                <ul className="space-y-1">
                  {(v.steps ?? []).slice(0, 5).map((s, i) => {
                    const ex = byId.get(s.exerciseId)
                    return (
                      <li key={`${s.exerciseId}-${i}`} className="flex items-center gap-2 rounded-lg bg-muted/50 px-2 py-1.5 text-[12px]">
                        <span>{ex?.mediaEmoji ?? "🏋️"}</span>
                        <span className="min-w-0 flex-1 truncate">{ex?.name ?? "Exercise"}</span>
                        <span className="text-muted-foreground">{s.mode === "reps" ? `${Number(s.reps) || 0} reps` : formatSeconds(Number(s.durationSec) || 0)}</span>
                      </li>
                    )
                  })}
                  {(v.steps ?? []).length > 5 ? <li className="text-center text-[11px] text-muted-foreground">+{(v.steps ?? []).length - 5} more</li> : null}
                </ul>
                <div className="flex h-9 items-center justify-center rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: v.coverColor }}>
                  Start workout
                </div>
              </div>
            </div>
          </PhoneFrame>
        </aside>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <p className="mr-auto hidden text-xs text-muted-foreground sm:block">
          {status === "published" ? "This workout is live — changes show in the app straight away." : "Drafts are only visible to admins. Publish to add it to the app's workout library."}
        </p>
        <Button asChild variant="ghost">
          <Link href={workout ? `/business-portal/workouts/${workout.id}` : "/business-portal/workouts"}>Cancel</Link>
        </Button>
        {status === "published" ? (
          <Button type="button" onClick={() => submit(false)} disabled={busy}>
            {busy ? <Spinner /> : <Save data-icon="inline-start" />}
            Save changes
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={() => submit(false)} disabled={busy}>
              {pending === "draft" ? <Spinner /> : <Save data-icon="inline-start" />}
              Save draft
            </Button>
            <Button type="button" onClick={() => submit(true)} disabled={busy}>
              {pending === "publish" ? <Spinner /> : <Rocket data-icon="inline-start" />}
              Publish
            </Button>
          </>
        )}
      </div>

      <ExercisePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        exercises={exercises.data ?? []}
        loading={exercises.isLoading}
        error={exercises.error}
        onRetry={() => exercises.refetch()}
        usedCounts={usedCounts}
        onAdd={addExercise}
        disabled={steps.fields.length >= L.maxExercises}
      />
    </form>
  )
}

function NumberBox({ label, name, form, suffix, error }: { label: string; name: `steps.${number}.${"durationSec" | "reps" | "restSec"}`; form: UseFormReturn<Values>; suffix: string; error?: string }) {
  const value = useWatch({ control: form.control, name })
  return (
    <FieldShell id={`f-${name}`} error={error} className="w-28">
      <div className="relative">
        <Input
          id={`f-${name}`}
          type="number"
          inputMode="numeric"
          aria-label={label}
          aria-invalid={!!error}
          className="h-8 pr-10 text-sm"
          value={value === "" || value === undefined ? "" : String(value)}
          onChange={(e) => form.setValue(name, e.target.value === "" ? "" : Number(e.target.value), { shouldDirty: true, shouldValidate: form.formState.isSubmitted })}
        />
        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
      </div>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </FieldShell>
  )
}

function TagPicker({ label, values, options, onToggle, emptyHint }: { label: string; values: string[]; options: readonly string[]; onToggle: (tag: string) => void; emptyHint?: string }) {
  return (
    <FieldShell label={label} description={values.length === 0 ? emptyHint : `${values.length} selected`}>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((o) => {
          const on = values.includes(o)
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(o)}
              className={cn("h-7 rounded-full border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground", on && "border-primary bg-primary/10 text-primary hover:text-primary")}
            >
              {capitalize(o)}
            </button>
          )
        })}
      </div>
    </FieldShell>
  )
}

function PreviewStat({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <span className="flex items-center justify-center gap-1 rounded-lg bg-muted/60 px-1.5 py-1 text-[11px] font-medium">
      {icon}
      {value}
    </span>
  )
}
