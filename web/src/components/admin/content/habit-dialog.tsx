"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Save } from "lucide-react"
import { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { EMOJI_SETS } from "@/components/admin/cover"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { ChoiceField, SelectField, TextField, TextareaField } from "@/components/common/form-fields"
import { PhaseBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { useApiMutation } from "@/lib/api/hooks"
import { habitsApi, type HabitInput, type HabitRow } from "@/lib/api/platform/habits"
import { EmojiPickerField } from "./bits"
import { AUTO_COMPLETE_OPTIONS, HABIT_CATEGORY_OPTIONS, HABIT_UNIT_OPTIONS, habitTargetLabel } from "./meta"

const optionalTarget = z.union([z.number({ error: "Enter a number" }).positive("Must be more than 0"), z.literal("")])

const schema = z
  .object({
    name: z.string().trim().min(1, "Enter a habit name").max(50, "Keep the name under 50 characters"),
    description: z.string().max(160, "Keep the description under 160 characters"),
    icon: z.string().trim().min(1, "Choose an icon"),
    category: z.enum(["movement", "hydration", "sleep", "mindfulness", "nutrition", "productivity"]),
    unit: z.enum(["times", "minutes", "glasses", "hours", "steps", "check"]),
    defaultTarget: z.number({ error: "Enter a number" }).positive("Default target must be more than 0"),
    minTarget: optionalTarget,
    maxTarget: optionalTarget,
    points: z.number({ error: "Enter a number" }).int("Whole points only").min(0, "Can't be negative").max(100, "At most 100 points"),
    autoCompleteFrom: z.enum(["none", "steps", "water", "sleep", "workout"]),
    status: z.enum(["active", "draft", "archived"]),
  })
  .superRefine((v, ctx) => {
    if (v.unit === "check" && v.defaultTarget !== 1) ctx.addIssue({ code: "custom", path: ["defaultTarget"], message: "Yes / no habits have a target of 1" })
    if (v.unit !== "check" && v.minTarget !== "" && v.minTarget > v.defaultTarget) ctx.addIssue({ code: "custom", path: ["minTarget"], message: "Can't be above the default target" })
    if (v.unit !== "check" && v.maxTarget !== "" && v.maxTarget < v.defaultTarget) ctx.addIssue({ code: "custom", path: ["maxTarget"], message: "Can't be below the default target" })
  })
type Values = z.infer<typeof schema>

const EMPTY: Values = {
  name: "",
  description: "",
  icon: "👟",
  category: "movement",
  unit: "times",
  defaultTarget: 1,
  minTarget: "",
  maxTarget: "",
  points: 5,
  autoCompleteFrom: "none",
  status: "active",
}

const toValues = (h: HabitRow): Values => ({
  name: h.name,
  description: h.description,
  icon: h.icon,
  category: h.category,
  unit: h.unit,
  defaultTarget: h.defaultTarget,
  minTarget: h.minTarget ?? "",
  maxTarget: h.maxTarget ?? "",
  points: h.points,
  autoCompleteFrom: h.autoCompleteFrom ?? "none",
  status: h.status,
})

/** SCR-P-019 habit editor (add + edit). */
export function HabitDialog({ open, onOpenChange, habit }: { open: boolean; onOpenChange: (open: boolean) => void; habit: HabitRow | null }) {
  const can = useAdminCan()
  const manage = can("catalog.manage")
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY })
  const unit = useWatch({ control: form.control, name: "unit" })
  const target = useWatch({ control: form.control, name: "defaultTarget" })

  useEffect(() => {
    if (open) form.reset(habit ? toValues(habit) : EMPTY)
  }, [open, habit, form])

  useEffect(() => {
    if (unit === "check") {
      form.setValue("defaultTarget", 1)
      form.setValue("minTarget", "")
      form.setValue("maxTarget", "")
    }
  }, [unit, form])

  const onError = (err: ApiError) => {
    if (err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => k in EMPTY && form.setError(k as keyof Values, { message }))
  }
  const create = useApiMutation(habitsApi.create, { success: "Habit saved.", errorTitle: "Couldn't save habit.", onSuccess: () => onOpenChange(false), onError })
  const update = useApiMutation(habitsApi.update, { success: "Habit saved.", errorTitle: "Couldn't save habit.", onSuccess: () => onOpenChange(false), onError })
  const saving = create.isPending || update.isPending

  const onSubmit = form.handleSubmit((v) => {
    const input: HabitInput = { ...v, minTarget: v.minTarget === "" ? null : v.minTarget, maxTarget: v.maxTarget === "" ? null : v.maxTarget }
    if (habit) update.mutate({ id: habit.id, ...input })
    else create.mutate(input)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{habit ? (manage ? "Edit habit" : habit.name) : "Add habit"}</DialogTitle>
          <DialogDescription>Employees pick habits from this library and check in daily to earn points.</DialogDescription>
        </DialogHeader>
        <form id="habit-form" onSubmit={onSubmit} noValidate>
          <fieldset disabled={!manage || saving} className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="name" label="Habit name" placeholder="e.g. Drink 8 glasses of water" required className="sm:col-span-2" />
            <TextareaField control={form.control} name="description" label="Description" placeholder="One short sentence shown under the habit." rows={2} maxLength={160} className="sm:col-span-2" />
            <EmojiPickerField control={form.control} name="icon" label="Icon" required emojis={EMOJI_SETS.habit} className="sm:col-span-2" />
            <SelectField control={form.control} name="category" label="Category" required options={HABIT_CATEGORY_OPTIONS} />
            <SelectField control={form.control} name="unit" label="Target type" required options={HABIT_UNIT_OPTIONS} />
            <TextField
              control={form.control}
              name="defaultTarget"
              label="Default daily target"
              type="number"
              required
              disabled={unit === "check"}
              description={typeof target === "number" && target > 0 ? habitTargetLabel(target, unit) : undefined}
            />
            <TextField control={form.control} name="points" label="Points per completion" type="number" suffix="pts" required />
            {unit !== "check" ? (
              <>
                <TextField control={form.control} name="minTarget" label="Min target" type="number" placeholder="Optional" description="Lowest target an employee can set." />
                <TextField control={form.control} name="maxTarget" label="Max target" type="number" placeholder="Optional" description="Highest target an employee can set." />
              </>
            ) : null}
            <SelectField
              control={form.control}
              name="autoCompleteFrom"
              label={
                <span className="inline-flex items-center gap-1.5">
                  Auto-complete from <PhaseBadge phase={2} />
                </span>
              }
              options={AUTO_COMPLETE_OPTIONS}
              description="Marks the habit done automatically from tracked data."
              className="sm:col-span-2"
            />
            <ChoiceField
              control={form.control}
              name="status"
              label="Status"
              columns={3}
              className="sm:col-span-2"
              options={[
                { value: "active", label: "Active", description: "Employees can pick it." },
                { value: "draft", label: "Draft", description: "Not shown yet." },
                { value: "archived", label: "Deactivated", description: "Hidden for new selection." },
              ]}
            />
          </fieldset>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {manage ? "Cancel" : "Close"}
          </Button>
          {manage ? (
            <Button type="submit" form="habit-form" disabled={saving}>
              {saving ? <Spinner /> : <Save data-icon="inline-start" />}
              Save habit
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
