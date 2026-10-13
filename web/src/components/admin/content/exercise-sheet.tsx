"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Save } from "lucide-react"
import { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { ListEditorField } from "@/components/admin/list-editor"
import { TagInputField } from "@/components/admin/tag-input"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { ChoiceField, SelectField, TextField } from "@/components/common/form-fields"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { useApiMutation } from "@/lib/api/hooks"
import { EXERCISE_EMOJIS, exercisesApi, type ExerciseInput, type ExerciseRow } from "@/lib/api/platform/exercises"
import { pluralize } from "@/lib/format"
import { EmojiPickerField } from "./bits"
import { MediaField } from "./media-input"
import { LEVEL_OPTIONS, formatSeconds } from "./meta"

const mediaSchema = z.object({ url: z.string().min(1), fileName: z.string().optional(), sizeBytes: z.number().optional() })

const schema = z.object({
  name: z.string().trim().min(1, "Enter an exercise name").max(60, "Keep the name under 60 characters"),
  mediaEmoji: z.string().trim().min(1, "Choose a fallback icon"),
  video: mediaSchema.nullable(),
  image: mediaSchema.nullable(),
  instructions: z.array(z.string()).refine((list) => list.some((s) => s.trim()), "Add at least one instruction step"),
  muscleGroups: z.array(z.string()).min(1, "Add at least one muscle group"),
  equipment: z.array(z.string()),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  defaultDurationSec: z.number({ error: "Enter a number" }).int("Whole seconds only").min(5, "At least 5 seconds").max(600, "At most 600 seconds"),
  defaultReps: z.union([z.number({ error: "Enter a number" }).int("Whole numbers only").min(1, "At least 1 rep").max(200, "At most 200 reps"), z.literal("")]),
  status: z.enum(["published", "draft"]),
})
type Values = z.infer<typeof schema>

const EMPTY: Values = { name: "", mediaEmoji: "🤸", video: null, image: null, instructions: [], muscleGroups: [], equipment: [], level: "beginner", defaultDurationSec: 40, defaultReps: "", status: "published" }

const toValues = (e: ExerciseRow): Values => ({
  name: e.name,
  mediaEmoji: e.mediaEmoji,
  video: e.video ?? null,
  image: e.image ?? null,
  instructions: e.instructions,
  muscleGroups: e.muscleGroups,
  equipment: e.equipment,
  level: e.level,
  defaultDurationSec: e.defaultDurationSec,
  defaultReps: e.defaultReps ?? "",
  status: e.status,
})

/** SCR-P-018 exercise editor drawer (create + edit). */
export function ExerciseSheet({
  open,
  onOpenChange,
  exercise,
  muscleGroups,
  equipment,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exercise: ExerciseRow | null
  muscleGroups: string[]
  equipment: string[]
}) {
  const can = useAdminCan()
  const manage = can("catalog.manage")
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY })
  const reps = useWatch({ control: form.control, name: "defaultReps" })
  const emoji = useWatch({ control: form.control, name: "mediaEmoji" })
  const image = useWatch({ control: form.control, name: "image" })

  useEffect(() => {
    if (open) form.reset(exercise ? toValues(exercise) : EMPTY)
  }, [open, exercise, form])

  const onError = (err: ApiError) => {
    if (err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => k in EMPTY && form.setError(k as keyof Values, { message }))
  }
  const create = useApiMutation(exercisesApi.create, { success: "Exercise saved.", errorTitle: "Couldn't save exercise", onSuccess: () => onOpenChange(false), onError })
  const update = useApiMutation(exercisesApi.update, { success: "Exercise saved.", errorTitle: "Couldn't save exercise", onSuccess: () => onOpenChange(false), onError })
  const saving = create.isPending || update.isPending

  const onSubmit = form.handleSubmit((v) => {
    const input: ExerciseInput = { ...v, instructions: v.instructions.map((s) => s.trim()).filter(Boolean), defaultReps: v.defaultReps === "" ? null : v.defaultReps }
    if (exercise) update.mutate({ id: exercise.id, ...input })
    else create.mutate(input)
  })

  const lockedPublished = !!exercise && exercise.status === "published" && exercise.usedInPublished > 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b p-4 pr-12 sm:p-6 sm:pr-12">
          <SheetTitle className="text-lg font-semibold">{exercise ? (manage ? "Edit exercise" : exercise.name) : "Add exercise"}</SheetTitle>
          <SheetDescription>
            {exercise
              ? exercise.usedIn > 0
                ? `Used in ${pluralize(exercise.usedIn, "workout")}. Changes to defaults don't alter existing workout steps.`
                : "Not used in any workout yet."
              : "Exercises are the building blocks of workouts. Only published exercises can be added to a workout."}
          </SheetDescription>
        </SheetHeader>
        <form id="exercise-form" onSubmit={onSubmit} noValidate className="flex-1">
          <fieldset disabled={!manage || saving} className="grid gap-5 p-4 sm:grid-cols-2 sm:p-6">
            <TextField control={form.control} name="name" label="Exercise name" placeholder="e.g. Bodyweight Squats" required className="sm:col-span-2" />
            <div className="space-y-4 rounded-xl border bg-muted/30 p-3 sm:col-span-2 sm:p-4">
              <div>
                <p className="text-sm font-semibold">Media</p>
                <p className="text-xs text-muted-foreground">A short demo video, an image and the steps below are shown in the workout player.</p>
              </div>
              <MediaField control={form.control} name="video" kind="video" label="Short video" emoji={emoji || "🤸"} posterUrl={image?.url} disabled={!manage || saving} />
              <MediaField control={form.control} name="image" kind="image" label="Image" description="Also used as the thumbnail and video poster." emoji={emoji || "🤸"} disabled={!manage || saving} />
              <EmojiPickerField control={form.control} name="mediaEmoji" label="Fallback icon" required emojis={EXERCISE_EMOJIS} description="Shown when there is no image." />
            </div>
            <ListEditorField
              control={form.control}
              name="instructions"
              label="Instructions"
              required
              placeholder="Add a step, e.g. Stand with feet shoulder-width apart."
              addLabel="Add step"
              max={10}
              description="Short, numbered steps shown during the workout."
              className="sm:col-span-2"
            />
            <TagInputField
              control={form.control}
              name="muscleGroups"
              label="Muscle groups"
              required
              suggestions={muscleGroups}
              normalize={(v) => v.trim().toLowerCase()}
              className="sm:col-span-2"
            />
            <TagInputField control={form.control} name="equipment" label="Equipment" placeholder="None — or type and press Enter" suggestions={equipment} normalize={(v) => v.trim().toLowerCase()} className="sm:col-span-2" />
            <SelectField control={form.control} name="level" label="Level" required options={LEVEL_OPTIONS} className="sm:col-span-2" />
            <TextField control={form.control} name="defaultDurationSec" label="Default duration" type="number" suffix="sec" required description="Used when the step is timed." />
            <TextField
              control={form.control}
              name="defaultReps"
              label="Default reps"
              type="number"
              suffix="reps"
              placeholder="Optional"
              description={typeof reps === "number" && reps > 0 ? `≈ ${formatSeconds(reps * 3)} at ~3 s per rep` : "Leave empty for timed-only exercises."}
            />
            <ChoiceField
              control={form.control}
              name="status"
              label="Status"
              className="sm:col-span-2"
              options={[
                { value: "published", label: "Published", description: "Can be added to workouts." },
                { value: "draft", label: "Draft", description: lockedPublished ? "Not available — used in published workouts." : "Hidden from the workout builder." },
              ]}
            />
          </fieldset>
        </form>
        <SheetFooter className="sticky bottom-0 flex-row justify-end gap-2 border-t bg-popover p-4 sm:px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {manage ? "Cancel" : "Close"}
          </Button>
          {manage ? (
            <Button type="submit" form="exercise-form" disabled={saving}>
              {saving ? <Spinner /> : <Save data-icon="inline-start" />}
              Save exercise
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
