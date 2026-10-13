"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, ListPlus, Plus, Save, Send, Timer, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useController, useFieldArray, useForm, useFormState, useWatch, type Control } from "react-hook-form"
import { z } from "zod"
import { CoverPickerField, EMOJI_SETS } from "@/components/admin/cover"
import { FormActions } from "@/components/admin/form-layout"
import { TagInputField } from "@/components/admin/tag-input"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { ChoiceField, SelectField, TextareaField, TextField } from "@/components/common/form-fields"
import { SectionCard } from "@/components/common/misc"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ApiError } from "@/lib/api/core"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { exercisesApi, type ExerciseWithMedia } from "@/lib/api/platform/exercises"
import {
  SECONDS_PER_REP,
  WORKOUT_CATEGORIES,
  WORKOUT_EQUIPMENT,
  WORKOUT_MUSCLE_GROUPS,
  workoutsApi,
  type WorkoutDetail,
  type WorkoutInput,
} from "@/lib/api/platform/workouts"
import { pluralize } from "@/lib/format"
import type { Exercise, Workout } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ExercisePickerDialog } from "./exercise-picker-dialog"
import { MediaThumb } from "./media-input"
import { LEVEL_OPTIONS, LOCATION_ICON, LOCATION_OPTIONS, formatSeconds } from "./meta"
import { WorkoutPreview } from "./workout-preview"

const stepSchema = z
  .object({
    exerciseId: z.string().min(1, "Choose an exercise"),
    mode: z.enum(["time", "reps"]),
    amount: z.number({ error: "Enter a number" }).int("Whole numbers only"),
    restSec: z.number({ error: "Enter a number" }).int("Whole numbers only").min(0, "Can't be negative").max(300, "Max 300 s"),
  })
  .superRefine((s, ctx) => {
    if (s.mode === "time" && (s.amount < 5 || s.amount > 900)) ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter 5–900 s" })
    if (s.mode === "reps" && (s.amount < 1 || s.amount > 200)) ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter 1–200 reps" })
  })

const schema = z.object({
  name: z.string().trim().min(1, "Enter a workout title").max(80, "Keep the title under 80 characters"),
  description: z.string().max(500, "Keep the description under 500 characters"),
  category: z.string().min(1, "Choose a category"),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  location: z.enum(["home", "gym", "outdoor", "office"]),
  equipment: z.array(z.string()),
  muscleGroups: z.array(z.string()),
  calories: z.number({ error: "Enter a number" }).int("Whole numbers only").min(0, "Can't be negative").max(2000, "Max 2,000 kcal"),
  points: z.number({ error: "Enter a number" }).int("Whole numbers only").min(0, "Can't be negative").max(1000, "Max 1,000 points"),
  coverEmoji: z.string().min(1, "Choose a cover"),
  coverColor: z.string().min(1),
  steps: z.array(stepSchema).min(1, "Add at least one exercise"),
})
type Values = z.infer<typeof schema>
type StepValues = Values["steps"][number]

const EMPTY: Values = {
  name: "",
  description: "",
  category: "",
  level: "beginner",
  location: "home",
  equipment: [],
  muscleGroups: [],
  calories: 100,
  points: 50,
  coverEmoji: "🏋️",
  coverColor: "#10b981",
  steps: [],
}

function toValues(d: WorkoutDetail): Values {
  const w = d.workout
  return {
    name: w.name,
    description: w.description,
    category: w.category,
    level: w.level,
    location: w.location,
    equipment: w.equipment,
    muscleGroups: w.muscleGroups,
    calories: w.calories,
    points: w.points,
    coverEmoji: w.coverEmoji,
    coverColor: w.coverColor,
    steps: w.exercises.map((s) => {
      const ex = d.exercises.find((e) => e.id === s.exerciseId)
      return s.reps
        ? { exerciseId: s.exerciseId, mode: "reps" as const, amount: s.reps, restSec: s.restSec }
        : { exerciseId: s.exerciseId, mode: "time" as const, amount: s.durationSec ?? ex?.defaultDurationSec ?? 30, restSec: s.restSec }
    }),
  }
}

/** Seconds for one form step; reps are estimated at ~3 s each. Empty values count as 0. */
const stepSeconds = (s: Partial<StepValues> | undefined) => {
  const amount = typeof s?.amount === "number" ? s.amount : 0
  return s?.mode === "reps" ? amount * SECONDS_PER_REP : amount
}

function totals(steps: (Partial<StepValues> | undefined)[]) {
  const work = steps.reduce((a, s) => a + stepSeconds(s), 0)
  const rest = steps.slice(0, -1).reduce((a, s) => a + (typeof s?.restSec === "number" ? s.restSec : 0), 0)
  const total = work + rest
  return { work, rest, total, minutes: steps.length ? Math.max(1, Math.ceil(total / 60)) : 0 }
}

/** SCR-P-017 Create / Edit Workout — details, exercise sequence builder and live preview. */
export function WorkoutForm({ initial }: { initial?: WorkoutDetail }) {
  const router = useRouter()
  const can = useAdminCan()
  const manage = can("catalog.manage")
  const editing = !!initial
  const current: Workout["status"] | undefined = initial?.workout.status
  const [pickerOpen, setPickerOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [defaultRest, setDefaultRest] = useState<number | "">(15)
  const [pending, setPending] = useState<Workout["status"] | null>(null)

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial ? toValues(initial) : EMPTY })
  const steps = useFieldArray({ control: form.control, name: "steps" })
  const watched = useWatch({ control: form.control })

  const library = useApiQuery(["admin", "exercises", { status: "published" }], () => exercisesApi.list({ status: "published" }))
  const known = useMemo(() => {
    const map = new Map<string, ExerciseWithMedia>()
    initial?.exercises.forEach((e) => map.set(e.id, e))
    library.data?.items.forEach((e) => map.set(e.id, e))
    return map
  }, [initial, library.data])

  const watchedSteps = watched.steps ?? []
  const t = totals(watchedSteps)
  const counts = watchedSteps.reduce<Record<string, number>>((acc, s) => {
    if (s?.exerciseId) acc[s.exerciseId] = (acc[s.exerciseId] ?? 0) + 1
    return acc
  }, {})
  const stepExercises = watchedSteps.map((s) => (s?.exerciseId ? known.get(s.exerciseId) : undefined))
  const muscleSuggestions = [...new Set([...stepExercises.flatMap((e) => e?.muscleGroups ?? []), ...WORKOUT_MUSCLE_GROUPS])]
  const equipmentSuggestions = [...new Set([...stepExercises.flatMap((e) => e?.equipment ?? []), ...WORKOUT_EQUIPMENT])]
  const categories = [...new Set([...WORKOUT_CATEGORIES, ...(initial ? [initial.workout.category] : [])])]

  const onError = (err: ApiError) => {
    if (!err.fieldErrors) return
    Object.entries(err.fieldErrors).forEach(([key, message]) => {
      const m = key.match(/^exercises\.(\d+)\.(\w+)$/)
      if (m) {
        const field = m[2] === "restSec" ? "restSec" : m[2] === "exerciseId" ? "exerciseId" : "amount"
        form.setError(`steps.${Number(m[1])}.${field}` as const, { message })
      } else if (key === "exercises") form.setError("steps", { message })
      else if (key in EMPTY) form.setError(key as keyof Values, { message })
    })
  }
  const done = () => router.push("/admin-portal/workouts")
  const create = useApiMutation(workoutsApi.create, {
    success: (w) => (w.status === "published" ? "Workout published." : "Draft saved."),
    errorTitle: "Couldn't save workout",
    onSuccess: done,
    onError,
  })
  const update = useApiMutation(workoutsApi.update, {
    success: (w) => (w.status === "published" ? (current === "published" ? "Workout updated." : "Workout published.") : current === "published" ? "Workout unpublished and saved as a draft." : "Draft saved."),
    errorTitle: "Couldn't save workout",
    onSuccess: done,
    onError,
  })
  const saving = create.isPending || update.isPending

  const submit = (status: Workout["status"]) =>
    form.handleSubmit((v) => {
      const input: WorkoutInput = {
        name: v.name,
        description: v.description,
        category: v.category,
        level: v.level,
        location: v.location,
        equipment: v.equipment,
        muscleGroups: v.muscleGroups,
        calories: v.calories,
        points: v.points,
        coverEmoji: v.coverEmoji,
        coverColor: v.coverColor,
        exercises: v.steps.map((s) => (s.mode === "reps" ? { exerciseId: s.exerciseId, reps: s.amount, restSec: s.restSec } : { exerciseId: s.exerciseId, durationSec: s.amount, restSec: s.restSec })),
        status,
      }
      setPending(status)
      if (initial) update.mutate({ id: initial.workout.id, ...input })
      else create.mutate(input)
    })()

  const addExercise = (e: Exercise) => {
    steps.append({ exerciseId: e.id, mode: "time", amount: e.defaultDurationSec, restSec: defaultRest === "" ? 15 : defaultRest })
    form.clearErrors("steps")
  }
  const applyRestToAll = () => {
    if (defaultRest === "") return
    watchedSteps.forEach((_, i) => form.setValue(`steps.${i}.restSec`, defaultRest, { shouldDirty: true, shouldValidate: form.formState.isSubmitted }))
  }

  const stepsError = form.formState.errors.steps?.message ?? form.formState.errors.steps?.root?.message
  const preview = (
    <WorkoutPreview
      name={watched.name ?? ""}
      description={watched.description ?? ""}
      coverEmoji={watched.coverEmoji ?? ""}
      coverColor={watched.coverColor ?? "#10b981"}
      level={watched.level ?? "beginner"}
      location={watched.location ?? "home"}
      category={watched.category ?? ""}
      durationMin={t.minutes}
      calories={watched.calories ?? ""}
      points={watched.points ?? ""}
      steps={watchedSteps.map((s, i) => ({ exercise: stepExercises[i], mode: s?.mode ?? "time", amount: s?.amount ?? "", restSec: s?.restSec ?? "" }))}
    />
  )

  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <fieldset disabled={!manage || saving} className="flex min-w-0 flex-col gap-6">
          <SectionCard title="Details" description="What employees see on the workout card and detail screen.">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="name" label="Title" placeholder="e.g. Morning Energiser" required className="sm:col-span-2" />
              <TextareaField control={form.control} name="description" label="Description" placeholder="One or two sentences about the workout." rows={3} maxLength={500} className="sm:col-span-2" />
              <SelectField control={form.control} name="category" label="Category" required options={categories.map((c) => ({ value: c, label: c }))} />
              <SelectField control={form.control} name="level" label="Level" required options={LEVEL_OPTIONS} />
              <ChoiceField
                control={form.control}
                name="location"
                label="Location"
                columns={4}
                className="sm:col-span-2"
                options={LOCATION_OPTIONS.map((o) => ({ ...o, icon: LOCATION_ICON[o.value] }))}
              />
              <TextField control={form.control} name="calories" label="Calories (estimate)" type="number" suffix="kcal" />
              <TextField control={form.control} name="points" label="Points on completion" type="number" suffix="pts" description="Subject to the company's daily points cap." />
            </div>
          </SectionCard>

          <SectionCard title="Equipment & muscle groups" description="Used for the app's filters. Suggestions come from the exercises in the sequence first.">
            <div className="grid gap-4">
              <TagInputField control={form.control} name="equipment" label="Equipment" placeholder="None — or type and press Enter" suggestions={equipmentSuggestions} normalize={(v) => v.trim().toLowerCase()} />
              <TagInputField control={form.control} name="muscleGroups" label="Muscle groups" placeholder="Type and press Enter" suggestions={muscleSuggestions} normalize={(v) => v.trim().toLowerCase()} />
            </div>
          </SectionCard>

          <SectionCard title="Cover" description="Emoji and colour shown as the workout image.">
            <CoverPickerField control={form.control} emojiName="coverEmoji" colorName="coverColor" label="Cover image" emojis={EMOJI_SETS.workout} />
          </SectionCard>

          <SectionCard
            title="Exercise sequence"
            description="Employees follow these steps in order. Duration is calculated automatically."
            actions={
              manage ? (
                <Button type="button" size="sm" onClick={() => setPickerOpen(true)}>
                  <ListPlus data-icon="inline-start" /> Add exercises
                </Button>
              ) : null
            }
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-muted/40 px-3 py-2.5 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <Timer className="size-4 text-primary" />
                  Total <span className="font-semibold tabular-nums">{t.minutes} min</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    ({formatSeconds(t.work)} work + {formatSeconds(t.rest)} rest)
                  </span>
                </span>
                <div className="flex items-center gap-2 sm:ml-auto">
                  <label htmlFor="default-rest" className="text-xs text-muted-foreground">
                    Rest between exercises
                  </label>
                  <div className="relative">
                    <Input
                      id="default-rest"
                      type="number"
                      min={0}
                      max={300}
                      value={defaultRest}
                      onChange={(e) => setDefaultRest(e.target.value === "" ? "" : Math.max(0, Math.min(300, Number(e.target.value))))}
                      className="h-8 w-20 pr-6"
                    />
                    <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">s</span>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={applyRestToAll} disabled={!steps.fields.length || defaultRest === ""}>
                    Apply to all
                  </Button>
                </div>
              </div>

              {steps.fields.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className={cn(
                    "flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed p-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5",
                    stepsError && "border-destructive/60 bg-destructive/5",
                  )}
                >
                  <Plus className="size-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Add exercises from the library</span>
                  <span className="text-xs text-muted-foreground">Set time or reps and rest for each step.</span>
                </button>
              ) : (
                <ol className="space-y-2">
                  {steps.fields.map((f, i) => (
                    <StepRow
                      key={f.id}
                      index={i}
                      count={steps.fields.length}
                      control={form.control}
                      exercise={stepExercises[i]}
                      onMove={(dir) => steps.move(i, i + dir)}
                      onDuplicate={() => steps.insert(i + 1, { ...form.getValues(`steps.${i}`) })}
                      onRemove={() => steps.remove(i)}
                      onModeChange={(mode) => {
                        const ex = stepExercises[i]
                        form.setValue(`steps.${i}.mode`, mode, { shouldDirty: true })
                        form.setValue(`steps.${i}.amount`, mode === "reps" ? (ex?.defaultReps ?? 10) : (ex?.defaultDurationSec ?? 30), { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
                      }}
                    />
                  ))}
                </ol>
              )}
              {stepsError ? (
                <p className="text-xs font-medium text-destructive" role="alert">
                  {stepsError}
                </p>
              ) : null}
              {steps.fields.length > 0 && manage ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                  <Plus data-icon="inline-start" /> Add another exercise
                </Button>
              ) : null}
            </div>
          </SectionCard>
        </fieldset>

        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">App preview</p>
            {preview}
          </div>
        </aside>
      </div>

      <FormActions
        hint={
          <span className="tabular-nums">
            {pluralize(steps.fields.length, "exercise")} · {t.minutes} min
            {editing && current === "published" ? " · Live in the app" : " · Not visible in the app until published"}
          </span>
        }
      >
        <Button variant="ghost" asChild>
          <Link href="/admin-portal/workouts">Cancel</Link>
        </Button>
        <Button type="button" variant="outline" className="lg:hidden" onClick={() => setPreviewOpen(true)}>
          <Eye data-icon="inline-start" /> Preview
        </Button>
        {manage ? (
          current === "published" ? (
            <>
              <Button type="button" variant="outline" onClick={() => submit("draft")} disabled={saving}>
                {saving && pending === "draft" ? <Spinner /> : <EyeOff data-icon="inline-start" />}
                Unpublish & save
              </Button>
              <Button type="button" onClick={() => submit("published")} disabled={saving}>
                {saving && pending === "published" ? <Spinner /> : <Save data-icon="inline-start" />}
                Save changes
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => submit("draft")} disabled={saving}>
                {saving && pending === "draft" ? <Spinner /> : <Save data-icon="inline-start" />}
                Save draft
              </Button>
              <Button type="button" onClick={() => submit("published")} disabled={saving}>
                {saving && pending === "published" ? <Spinner /> : <Send data-icon="inline-start" />}
                Publish
              </Button>
            </>
          )
        ) : null}
      </FormActions>

      <ExercisePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        exercises={library.data?.items ?? []}
        loading={library.isLoading}
        error={library.error ? "Couldn't load exercises. Close and try again." : undefined}
        counts={counts}
        onAdd={addExercise}
      />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>App preview</DialogTitle>
            <DialogDescription>How the workout will look in the Employee App.</DialogDescription>
          </DialogHeader>
          {preview}
        </DialogContent>
      </Dialog>
    </form>
  )
}

function StepNumber({ control, name, suffix, label, width = "w-20" }: { control: Control<Values>; name: `steps.${number}.amount` | `steps.${number}.restSec`; suffix: string; label: string; width?: string }) {
  const { field, fieldState } = useController({ control, name })
  return (
    <div className="relative">
      <Input
        type="number"
        inputMode="numeric"
        aria-label={label}
        aria-invalid={!!fieldState.error}
        className={cn("h-8 pr-9 tabular-nums", width)}
        {...field}
        value={field.value ?? ""}
        onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
      />
      <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
    </div>
  )
}

function StepRow({
  index,
  count,
  control,
  exercise,
  onMove,
  onDuplicate,
  onRemove,
  onModeChange,
}: {
  index: number
  count: number
  control: Control<Values>
  exercise?: ExerciseWithMedia
  onMove: (dir: -1 | 1) => void
  onDuplicate: () => void
  onRemove: () => void
  onModeChange: (mode: "time" | "reps") => void
}) {
  const mode = useWatch({ control, name: `steps.${index}.mode` })
  const amount = useWatch({ control, name: `steps.${index}.amount` })
  const { errors: formErrors } = useFormState({ control, name: `steps.${index}` })
  const stepErrors = formErrors.steps?.[index]
  const errors = [stepErrors?.exerciseId?.message, stepErrors?.amount?.message, stepErrors?.restSec?.message].filter(Boolean)
  const last = index === count - 1

  return (
    <li className={cn("rounded-xl border bg-card p-2.5", errors.length && "border-destructive/50")}>
      <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground tabular-nums">{index + 1}</span>
          <MediaThumb imageUrl={exercise?.image?.url} emoji={exercise?.mediaEmoji ?? "❔"} hasVideo={!!exercise?.video} className="rounded-lg" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{exercise?.name ?? "Unknown exercise"}</div>
            <div className="truncate text-xs text-muted-foreground capitalize">
              {exercise ? exercise.muscleGroups.join(", ") : "Removed from the library"}
              {mode === "reps" && typeof amount === "number" ? <span className="normal-case"> · ≈ {formatSeconds(amount * SECONDS_PER_REP)}</span> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center md:hidden">
            <StepButtons index={index} last={last} onMove={onMove} onDuplicate={onDuplicate} onRemove={onRemove} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-[30px] md:pl-0">
          <ToggleGroup type="single" variant="outline" size="sm" value={mode} onValueChange={(v) => v && onModeChange(v as "time" | "reps")} aria-label="Measure by">
            <ToggleGroupItem value="time" className="px-2 text-xs">
              Time
            </ToggleGroupItem>
            <ToggleGroupItem value="reps" className="px-2 text-xs">
              Reps
            </ToggleGroupItem>
          </ToggleGroup>
          <StepNumber control={control} name={`steps.${index}.amount`} suffix={mode === "reps" ? "reps" : "s"} label={mode === "reps" ? "Reps" : "Duration in seconds"} width={mode === "reps" ? "w-24" : "w-20"} />
          <span className="text-xs text-muted-foreground">Rest</span>
          <StepNumber control={control} name={`steps.${index}.restSec`} suffix="s" label="Rest in seconds" />
          <div className="hidden items-center md:flex">
            <StepButtons index={index} last={last} onMove={onMove} onDuplicate={onDuplicate} onRemove={onRemove} />
          </div>
        </div>
      </div>
      {errors.length ? (
        <p className="mt-1.5 pl-[30px] text-xs font-medium text-destructive" role="alert">
          {errors.join(" · ")}
        </p>
      ) : null}
      {last && !errors.length ? <p className="mt-1 pl-[30px] text-[11px] text-muted-foreground">Rest after the last exercise isn&apos;t counted.</p> : null}
    </li>
  )
}

function StepButtons({ index, last, onMove, onDuplicate, onRemove }: { index: number; last: boolean; onMove: (dir: -1 | 1) => void; onDuplicate: () => void; onRemove: () => void }) {
  return (
    <>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move up">
        <ArrowUp />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => onMove(1)} disabled={last} aria-label="Move down">
        <ArrowDown />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" onClick={onDuplicate} aria-label="Duplicate step">
        <Copy />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Remove step" className="text-muted-foreground hover:text-destructive">
        <Trash2 />
      </Button>
    </>
  )
}
