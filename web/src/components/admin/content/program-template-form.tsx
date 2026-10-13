"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarRange, Save, Send, Target } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { CoverPickerField, CoverTile, EMOJI_SETS } from "@/components/admin/cover"
import { FormActions, FormSection } from "@/components/admin/form-layout"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { TextareaField, TextField } from "@/components/common/form-fields"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { useApiMutation } from "@/lib/api/hooks"
import { programTemplatesApi, type ProgramTemplateInput, type ProgramTemplateRow, type TemplateStatus } from "@/lib/api/platform/programs"
import { formatNumber, pluralize } from "@/lib/format"
import { GOAL_METRIC_UNIT } from "./meta"
import { WeekBuilder, newGoal } from "./week-builder"

const goalSchema = z.object({
  id: z.string(),
  label: z.string().trim().min(1, "Describe the goal").max(80, "Keep the goal under 80 characters"),
  metric: z.enum(["steps", "distance", "calories", "active_minutes", "workouts", "water", "meditation", "custom", "habit"]),
  target: z.number({ error: "Enter a target" }).positive("Target must be more than 0"),
})

const schema = z
  .object({
    name: z.string().trim().min(1, "Enter a template name").max(80, "Keep the name under 80 characters"),
    description: z.string().max(400, "Keep the description under 400 characters"),
    coverEmoji: z.string().trim().min(1, "Choose a cover"),
    coverColor: z.string().min(1),
    weeks: z
      .array(z.object({ title: z.string().trim().min(1, "Give this week a title").max(60, "Keep the title under 60 characters"), goals: z.array(goalSchema).max(6, "Up to 6 goals a week") }))
      .max(12, "Templates can have up to 12 weeks"),
  })
  .superRefine((v, ctx) => {
    if (!v.weeks.some((w) => w.goals.length > 0)) {
      ctx.addIssue({ code: "custom", path: ["weeks"], message: "At least 1 week with 1 goal" })
      return
    }
    v.weeks.forEach((w, i) => {
      if (w.goals.length === 0) ctx.addIssue({ code: "custom", path: ["weeks", i, "goals"], message: "Add a goal or remove this week" })
    })
  })
type Values = z.infer<typeof schema>

const EMPTY: Values = {
  name: "",
  description: "",
  coverEmoji: "🌱",
  coverColor: "#10b981",
  weeks: [{ title: "Week 1", goals: [newGoal()] }],
}

const toValues = (t: ProgramTemplateRow): Values => ({
  name: t.name,
  description: t.description,
  coverEmoji: t.coverEmoji,
  coverColor: t.coverColor,
  weeks: t.weeks.map((w) => ({ title: w.title, goals: w.goals.map((g) => ({ ...g })) })),
})

/** SCR-P-032 program template editor: details, cover and the week / goal builder. */
export function ProgramTemplateForm({ initial }: { initial?: ProgramTemplateRow }) {
  const router = useRouter()
  const can = useAdminCan()
  const manage = can("catalog.manage")
  const current = initial?.status
  const [pending, setPending] = useState<TemplateStatus | null>(null)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial ? toValues(initial) : EMPTY })
  const v = useWatch({ control: form.control })
  const weeks = v.weeks ?? []
  const goalsCount = weeks.reduce((a, w) => a + (w?.goals?.length ?? 0), 0)

  const onError = (err: ApiError) => {
    if (!err.fieldErrors) return
    Object.entries(err.fieldErrors).forEach(([key, message]) => {
      if (key in EMPTY || key.startsWith("weeks")) form.setError(key as keyof Values, { message })
    })
  }
  const done = () => router.push("/admin-portal/program-templates")
  const successText = (t: ProgramTemplateRow) => (t.status === "active" ? (current === "active" ? "Template updated." : "Template published.") : "Draft saved.")
  const create = useApiMutation(programTemplatesApi.create, { success: successText, errorTitle: "Couldn't save template.", onSuccess: done, onError })
  const update = useApiMutation(programTemplatesApi.update, { success: successText, errorTitle: "Couldn't save template.", onSuccess: done, onError })
  const saving = create.isPending || update.isPending

  const submit = (status: TemplateStatus) =>
    form.handleSubmit((values) => {
      const input: ProgramTemplateInput = { ...values, status }
      setPending(status)
      if (initial) update.mutate({ id: initial.id, ...input })
      else create.mutate(input)
    })()

  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-8">
      <fieldset disabled={!manage || saving} className="flex min-w-0 flex-col gap-8">
        <FormSection
          title="Template details"
          description="Companies see this when they pick a template, then copy it into their own program."
          aside={
            <div className="hidden rounded-xl border bg-card p-3 lg:block">
              <div className="flex items-center gap-3">
                <CoverTile emoji={v.coverEmoji || "❔"} color={v.coverColor ?? "#10b981"} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{v.name || "Template name"}</p>
                  <p className="text-xs text-muted-foreground">
                    {pluralize(weeks.length, "week")} · {pluralize(goalsCount, "goal")}
                  </p>
                </div>
              </div>
            </div>
          }
        >
          <TextField control={form.control} name="name" label="Name" placeholder="e.g. 30-Day Healthy Lifestyle" required className="sm:col-span-2" />
          <TextareaField control={form.control} name="description" label="Description" placeholder="What the program helps employees achieve." rows={3} maxLength={400} className="sm:col-span-2" />
          <CoverPickerField control={form.control} emojiName="coverEmoji" colorName="coverColor" label="Cover image" emojis={EMOJI_SETS.challenge} className="sm:col-span-2" />
        </FormSection>

        <FormSection
          title="Weeks & goals"
          description="Each week has its own goals. Duration is the number of weeks. Targets are totals for the week."
          contentClassName="sm:grid-cols-1"
          aside={
            weeks.length ? (
              <ol className="hidden space-y-1.5 lg:block">
                {weeks.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <CalendarRange className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="font-medium">
                        Week {i + 1}: {w?.title || "Untitled"}
                      </span>
                      {(w?.goals ?? []).map((g, gi) => (
                        <span key={gi} className="flex items-center gap-1 text-muted-foreground">
                          <Target className="size-3 shrink-0" />
                          <span className="truncate">
                            {g?.label || "Goal"}
                            {typeof g?.target === "number" ? ` · ${formatNumber(g.target)} ${GOAL_METRIC_UNIT[g.metric ?? "steps"]}` : ""}
                          </span>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ol>
            ) : null
          }
        >
          <WeekBuilder control={form.control} disabled={!manage || saving} />
        </FormSection>
      </fieldset>

      <FormActions
        hint={
          <span className="tabular-nums">
            {pluralize(weeks.length, "week")} · {pluralize(goalsCount, "goal")}
            {current === "active" ? " · Available to companies" : " · Companies can't see it until published"}
          </span>
        }
      >
        <Button variant="ghost" asChild>
          <Link href="/admin-portal/program-templates">Cancel</Link>
        </Button>
        {manage ? (
          current === "active" ? (
            <Button type="button" onClick={() => submit("active")} disabled={saving}>
              {saving && pending === "active" ? <Spinner /> : <Save data-icon="inline-start" />}
              Save changes
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => submit("draft")} disabled={saving}>
                {saving && pending === "draft" ? <Spinner /> : <Save data-icon="inline-start" />}
                Save draft
              </Button>
              <Button type="button" onClick={() => submit("active")} disabled={saving}>
                {saving && pending === "active" ? <Spinner /> : <Send data-icon="inline-start" />}
                Publish
              </Button>
            </>
          )
        ) : null}
      </FormActions>
    </form>
  )
}
