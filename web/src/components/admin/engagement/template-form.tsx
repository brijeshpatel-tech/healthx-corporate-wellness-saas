"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Archive, Eye, Rocket, Save } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { CoverPickerField, EMOJI_SETS } from "@/components/admin/cover"
import { FormActions } from "@/components/admin/form-layout"
import { ListEditorField } from "@/components/admin/list-editor"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { ChoiceField, SelectField, TextareaField, TextField } from "@/components/common/form-fields"
import { ConfirmDialog } from "@/components/common/misc"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { useApiMutation } from "@/lib/api/hooks"
import { templatesApi, type TemplateInput } from "@/lib/api/platform/templates"
import type { ChallengeTemplate } from "@/lib/types"
import { CHALLENGE_METRIC_UNIT } from "@/lib/types"
import { ADMIN, CHALLENGE_TYPE_META, METRIC_META, TEMPLATE_CATEGORY_META, dailyHint } from "./meta"
import { TemplatePreview } from "./template-card"

const CATEGORIES = ["movement", "hydration", "mindfulness", "fitness", "habits", "team"] as const
const TYPES = ["individual", "leaderboard", "team", "company", "collaborative"] as const
const METRICS = ["steps", "distance", "calories", "active_minutes", "workouts", "water", "meditation", "custom"] as const

const schema = z.object({
  name: z.string().trim().min(3, "Enter a template name (at least 3 characters).").max(80, "Keep the name under 80 characters."),
  description: z.string().trim().min(1, "Add a short description.").max(300, "Keep the description under 300 characters."),
  category: z.enum(CATEGORIES, { error: "Choose a category." }),
  type: z.enum(TYPES, { error: "Choose a challenge type." }),
  metric: z.enum(METRICS, { error: "Choose a metric." }),
  target: z.number({ error: "Enter a number" }).positive("Target must be greater than 0.").max(100_000_000, "Target looks too high."),
  durationDays: z.number({ error: "Enter a number" }).int("Use whole days.").min(1, "At least 1 day.").max(90, "At most 90 days."),
  points: z.number({ error: "Enter a number" }).int("Use whole points.").min(0, "Points can't be negative.").max(5000, "At most 5,000 points."),
  rules: z.array(z.string().trim().min(1, "Rules can't be empty.")).min(1, "Add at least one rule.").max(12),
  coverEmoji: z.string().trim().min(1, "Pick a cover icon."),
  coverColor: z.string().min(1),
})
type Values = z.infer<typeof schema>

const EMPTY: Values = {
  name: "",
  description: "",
  category: "movement",
  type: "individual",
  metric: "steps",
  target: 100000,
  durationDays: 30,
  points: 100,
  rules: ["Steps sync automatically from Apple Health, Health Connect or a connected wearable."],
  coverEmoji: "👟",
  coverColor: "#10b981",
}

const toValues = (t: ChallengeTemplate): Values => ({
  name: t.name,
  description: t.description,
  category: t.category,
  type: t.type,
  metric: t.metric,
  target: t.target,
  durationDays: t.durationDays,
  points: t.points,
  rules: [...t.rules],
  coverEmoji: t.coverEmoji,
  coverColor: t.coverColor,
})

/** SCR-P-012 Create / edit challenge template (shared by /new and /[id]). */
export function TemplateForm({ template }: { template?: ChallengeTemplate }) {
  const router = useRouter()
  const can = useAdminCan()
  const canManage = can("catalog.manage")
  const [retireOpen, setRetireOpen] = useState(false)
  const [intent, setIntent] = useState<"draft" | "published">("published")
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: template ? toValues(template) : EMPTY })
  const values = useWatch({ control: form.control }) as Values
  const isPublished = template?.status === "published"

  const onError = (err: ApiError) => {
    if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
  }
  const successText = (status: "draft" | "published") => (status === "draft" ? (isPublished ? "Template moved to draft." : "Draft saved.") : isPublished ? "Template saved." : "Template published.")
  const create = useApiMutation(templatesApi.create, { success: (_o, i) => successText(i.status), onSuccess: () => router.push(`${ADMIN}/challenge-templates`), onError })
  const update = useApiMutation(templatesApi.update, { success: (_o, i) => successText(i.status), onSuccess: () => router.push(`${ADMIN}/challenge-templates`), onError })
  const retire = useApiMutation(templatesApi.setStatus, { success: "Template retired.", onSuccess: () => router.push(`${ADMIN}/challenge-templates`) })
  const pending = create.isPending || update.isPending

  const submit = (status: "draft" | "published") => {
    setIntent(status)
    return form.handleSubmit((v) => {
      const input: TemplateInput = { ...v, status }
      if (template) update.mutate({ ...input, id: template.id })
      else create.mutate(input)
    })()
  }

  const unit = CHALLENGE_METRIC_UNIT[values.metric] ?? ""
  const hint = typeof values.target === "number" && typeof values.durationDays === "number" ? dailyHint(values.target, values.durationDays, values.metric) : undefined

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit(isPublished ? "published" : "draft")
      }}
      noValidate
      className="flex flex-col gap-6"
    >
      {template?.status === "archived" ? (
        <Alert>
          <Archive />
          <AlertTitle>This template is retired</AlertTitle>
          <AlertDescription>Companies can&apos;t start new challenges from it. Publish it again to make it available.</AlertDescription>
        </Alert>
      ) : null}
      {!canManage ? (
        <Alert>
          <Eye />
          <AlertTitle>View only</AlertTitle>
          <AlertDescription>Your HealthX role can view templates but not change them.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <fieldset disabled={!canManage || pending} className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base">Basics</CardTitle>
              <CardDescription>Name and description shown to company admins and employees.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="name" label="Template name" placeholder="e.g. Step Challenge – 100,000 steps in 30 days" className="sm:col-span-2" required />
              <TextareaField control={form.control} name="description" label="Description" rows={3} maxLength={300} placeholder="What employees do and why it helps." className="sm:col-span-2" required />
              <SelectField
                control={form.control}
                name="category"
                label="Category"
                required
                options={CATEGORIES.map((c) => ({ value: c, label: `${TEMPLATE_CATEGORY_META[c].emoji} ${TEMPLATE_CATEGORY_META[c].label}` }))}
              />
              <SelectField
                control={form.control}
                name="metric"
                label="Metric"
                required
                options={METRICS.map((m) => ({ value: m, label: `${METRIC_META[m].emoji} ${METRIC_META[m].label} (${CHALLENGE_METRIC_UNIT[m]})` }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base">Challenge type</CardTitle>
              <CardDescription>How people take part and how winners are decided.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChoiceField
                control={form.control}
                name="type"
                columns={2}
                options={TYPES.map((t) => {
                  const Icon = CHALLENGE_TYPE_META[t].icon
                  return { value: t, label: CHALLENGE_TYPE_META[t].label, description: CHALLENGE_TYPE_META[t].description, icon: <Icon className="size-4 text-primary" /> }
                })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base">Goal &amp; points</CardTitle>
              <CardDescription>Suggested values — companies can adjust them when they launch the challenge.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <TextField control={form.control} name="target" label={`Target (${unit})`} type="number" description={hint ? `Per person — ${hint}` : "Per person over the whole challenge."} required />
              <TextField control={form.control} name="durationDays" label="Duration" type="number" suffix="days" description="1–90 days" required />
              <TextField control={form.control} name="points" label="Suggested points" type="number" suffix="pts" description="Awarded on completion" required />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base">Rules</CardTitle>
              <CardDescription>Short, plain-language rules shown on the challenge page.</CardDescription>
            </CardHeader>
            <CardContent>
              <ListEditorField control={form.control} name="rules" placeholder="e.g. Steps from any connected device count." addLabel="Add rule" max={12} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base">Cover</CardTitle>
              <CardDescription>Icon and colour used on the template and challenge cards.</CardDescription>
            </CardHeader>
            <CardContent>
              <CoverPickerField control={form.control} emojiName="coverEmoji" colorName="coverColor" label={null} emojis={EMOJI_SETS.challenge} />
            </CardContent>
          </Card>
        </fieldset>

        <aside className="min-w-0">
          <div className="space-y-3 lg:sticky lg:top-20">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Eye className="size-4" /> Live preview — how companies see it
            </div>
            <TemplatePreview value={values} />
            <p className="text-xs text-muted-foreground">Company admins pick published templates when they create a challenge, then set dates and participants.</p>
          </div>
        </aside>
      </div>

      {canManage ? (
        <FormActions hint={template ? (isPublished ? "Changes apply to new challenges only — running challenges keep their settings." : "Drafts are only visible to HealthX admins.") : "Drafts are only visible to HealthX admins."}>
          {template && template.status !== "archived" ? (
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setRetireOpen(true)} disabled={pending}>
              <Archive data-icon="inline-start" /> Retire
            </Button>
          ) : null}
          <Button asChild type="button" variant="ghost">
            <Link href={`${ADMIN}/challenge-templates`}>Cancel</Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => submit("draft")} disabled={pending}>
            {pending && intent === "draft" ? <Spinner /> : <Save data-icon="inline-start" />}
            {isPublished ? "Move to draft" : "Save draft"}
          </Button>
          <Button type="button" onClick={() => submit("published")} disabled={pending}>
            {pending && intent === "published" ? <Spinner /> : <Rocket data-icon="inline-start" />}
            {isPublished ? "Save changes" : "Publish"}
          </Button>
        </FormActions>
      ) : null}

      {template ? (
        <ConfirmDialog
          open={retireOpen}
          onOpenChange={setRetireOpen}
          title={`Retire “${template.name}”?`}
          description="Companies will no longer see it when creating challenges. Challenges already running are not affected. You can publish it again later."
          confirmLabel="Retire template"
          destructive
          onConfirm={() => retire.mutate({ id: template.id, status: "archived" })}
        />
      ) : null}
    </form>
  )
}
