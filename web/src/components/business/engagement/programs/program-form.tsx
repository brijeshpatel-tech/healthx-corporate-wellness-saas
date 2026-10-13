"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, ArrowRight, CalendarDays, Check, Coins, Lock, Rocket, Save, Trophy, Users } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { FormProvider, useController, useForm, useWatch, type Control, type FieldErrors } from "react-hook-form"
import { z } from "zod"
import { AudienceField } from "@/components/business/engagement/audience-field"
import { CoverPicker, CoverTile } from "@/components/business/engagement/cover-picker"
import { FieldShell, TextField, TextareaField } from "@/components/common/form-fields"
import { KeyValueList, SectionCard } from "@/components/common/misc"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { audienceApi } from "@/lib/api/business/challenges"
import { ApiError } from "@/lib/api/core"
import { PROGRAM_LIMITS, programsApi, type ProgramDetail, type ProgramInput, type ProgramMetric, type ProgramStatus, type ProgramTemplate } from "@/lib/api/business/programs"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"
import { PROGRAM_METRICS, formatGoalTarget, nextMonday, programEnd, suggestGoalLabel, todayYmd } from "./program-meta"
import { WeekBuilder, newWeek } from "./week-builder"

const PROGRAM_EMOJIS = ["🌱", "🧘", "👟", "🏃", "💧", "🥗", "😴", "🧠", "❤️", "🔥", "⚡", "🎯", "🚴", "🏋️", "🌞", "🍎", "🏆", "🌿", "🫶", "🎉"]

const goalSchema = z.object({
  goalId: z.string(),
  label: z.string().trim().max(PROGRAM_LIMITS.goalLabel, `Keep it under ${PROGRAM_LIMITS.goalLabel} characters`),
  metric: z.enum(PROGRAM_METRICS as [ProgramMetric, ...ProgramMetric[]]),
  target: z.number({ error: "Enter a target" }).positive("Target must be greater than 0").max(10_000_000, "That target is too large"),
})

const weekSchema = z.object({
  title: z.string().trim().min(1, "Give this week a title").max(PROGRAM_LIMITS.weekTitle, `Keep it under ${PROGRAM_LIMITS.weekTitle} characters`),
  goals: z.array(goalSchema).min(1, "Add at least one goal").max(PROGRAM_LIMITS.maxGoals, `Up to ${PROGRAM_LIMITS.maxGoals} goals per week`),
})

function makeSchema(opts: { isNew: boolean; startLocked: boolean }) {
  return z
    .object({
      name: z.string().trim().min(3, "Name must be at least 3 characters").max(PROGRAM_LIMITS.name, `Keep the name under ${PROGRAM_LIMITS.name} characters`),
      description: z.string().trim().max(PROGRAM_LIMITS.description, "Keep the description under 600 characters"),
      coverEmoji: z.string().min(1),
      coverColor: z.string().min(1),
      startDate: z.string().min(1, "Choose a start date"),
      weeks: z.array(weekSchema).min(1, "Add at least one week with one goal").max(PROGRAM_LIMITS.maxWeeks, `Programs can run for up to ${PROGRAM_LIMITS.maxWeeks} weeks`),
      audienceType: z.enum(["all", "departments", "teams", "selected"]),
      audienceIds: z.array(z.string()),
      completionPoints: z.number({ error: "Enter points (0 for none)" }).int("Use whole points").min(0, "Points can't be negative").max(PROGRAM_LIMITS.maxPoints, `Up to ${formatNumber(PROGRAM_LIMITS.maxPoints)} points`),
      combinedChallengeId: z.string(),
    })
    .superRefine((v, ctx) => {
      if (!opts.startLocked && opts.isNew && v.startDate && v.startDate < todayYmd()) ctx.addIssue({ code: "custom", path: ["startDate"], message: "Start date can't be in the past" })
      if (v.audienceType !== "all" && v.audienceIds.length === 0) {
        const what = v.audienceType === "departments" ? "department" : v.audienceType === "teams" ? "team" : "employee"
        ctx.addIssue({ code: "custom", path: ["audienceIds"], message: `Choose at least one ${what}` })
      }
    })
}

export type ProgramFormValues = z.infer<ReturnType<typeof makeSchema>>

const STEPS = [
  { key: "details", label: "Details", fields: ["name", "description", "coverEmoji", "coverColor", "startDate"] },
  { key: "weeks", label: "Weekly goals", fields: ["weeks"] },
  { key: "people", label: "Participants & points", fields: ["audienceType", "audienceIds", "completionPoints", "combinedChallengeId"] },
  { key: "review", label: "Review", fields: [] },
] as const

const stepOfField = (name: string) => {
  const root = name.split(".")[0]!
  const i = STEPS.findIndex((s) => (s.fields as readonly string[]).includes(root))
  return i < 0 ? 0 : i
}

const firstErrorStep = (errors: FieldErrors<ProgramFormValues>) => Math.min(...Object.keys(errors).map(stepOfField), 3)

export function blankProgramValues(): ProgramFormValues {
  return {
    name: "",
    description: "",
    coverEmoji: "🌱",
    coverColor: "#10b981",
    startDate: nextMonday(),
    weeks: [newWeek(1)],
    audienceType: "all",
    audienceIds: [],
    completionPoints: 100,
    combinedChallengeId: "none",
  }
}

export function valuesFromTemplate(t: ProgramTemplate): ProgramFormValues {
  return {
    ...blankProgramValues(),
    name: t.name,
    description: t.description,
    coverEmoji: t.coverEmoji,
    coverColor: t.coverColor,
    weeks: t.weeks.map((w) => ({ title: w.title, goals: w.goals.map((g) => ({ goalId: g.id, label: g.label, metric: g.metric, target: g.target })) })),
    completionPoints: t.durationWeeks * 50,
  }
}

export function valuesFromProgram(p: ProgramDetail): ProgramFormValues {
  return {
    name: p.name,
    description: p.description,
    coverEmoji: p.coverEmoji,
    coverColor: p.coverColor,
    startDate: p.startDate ?? nextMonday(),
    weeks: p.weeks.map((w) => ({ title: w.title, goals: w.goals.map((g) => ({ goalId: g.id, label: g.label, metric: g.metric, target: g.target })) })),
    audienceType: p.audienceType,
    audienceIds: p.audienceIds,
    completionPoints: p.completionPoints,
    combinedChallengeId: p.combinedChallenge?.id ?? "none",
  }
}

/** SCR-B-031 Create / Edit Program — details → weekly goals → participants & points → review. */
export function ProgramForm({
  initial,
  program,
  templateId,
  notice,
}: {
  initial: ProgramFormValues
  /** Existing program when editing. */
  program?: ProgramDetail
  templateId?: string
  notice?: React.ReactNode
}) {
  const router = useRouter()
  const startLocked = program?.lockedFields.includes("startDate") ?? false
  const [schema] = useState(() => makeSchema({ isNew: !program, startLocked }))
  const form = useForm<ProgramFormValues>({ resolver: zodResolver(schema), defaultValues: initial })
  const [step, setStep] = useState(0)
  const [lastAction, setLastAction] = useState<"draft" | "publish">("draft")
  const v = useWatch({ control: form.control }) as ProgramFormValues
  const status: ProgramStatus = program?.status ?? "draft"
  const isDraft = status === "draft"

  const save = useApiMutation(
    (input: ProgramInput) => (program ? programsApi.update({ ...input, id: program.id }) : programsApi.create(input)),
    {
      success: (p, input) =>
        input.publish ? (p.status === "active" ? "Program published." : `Program published – starts ${formatDate(p.startDate, "EEE d MMM")}.`) : isDraft ? "Draft saved" : "Changes saved",
      onSuccess: (p) => router.push(`/business-portal/programs/${p.id}`),
      onError: (err) => {
        if (err instanceof ApiError && err.fieldErrors) {
          const keys = Object.keys(err.fieldErrors)
          keys.forEach((k) => form.setError(k as keyof ProgramFormValues, { message: err.fieldErrors![k] }))
          if (keys.length) setStep(Math.min(...keys.map(stepOfField)))
        }
      },
    },
  )

  const toInput = (values: ProgramFormValues, publish: boolean): ProgramInput => ({
    name: values.name,
    description: values.description,
    coverEmoji: values.coverEmoji,
    coverColor: values.coverColor,
    startDate: values.startDate,
    weeks: values.weeks.map((w) => ({
      title: w.title,
      goals: w.goals.map((g) => ({ id: g.goalId || undefined, label: g.label.trim() || suggestGoalLabel(g.target, g.metric), metric: g.metric, target: g.target })),
    })),
    audienceType: values.audienceType,
    audienceIds: values.audienceType === "all" ? [] : values.audienceIds,
    completionPoints: values.completionPoints,
    combinedChallengeId: values.combinedChallengeId === "none" ? null : values.combinedChallengeId,
    templateId: templateId ?? null,
    publish,
  })

  const submit = (publish: boolean) => {
    setLastAction(publish ? "publish" : "draft")
    void form.handleSubmit(
      (values) => save.mutate(toInput(values, publish)),
      (errors) => setStep(firstErrorStep(errors)),
    )()
  }

  const goTo = async (target: number) => {
    if (target <= step) return setStep(target)
    for (let s = step; s < target; s++) {
      const ok = await form.trigger(STEPS[s]!.fields as unknown as (keyof ProgramFormValues)[], { shouldFocus: true })
      if (!ok) return setStep(s)
    }
    setStep(target)
  }

  const end = programEnd(v.startDate, v.weeks?.length ?? 0)
  const primaryLabel = isDraft ? "Publish" : "Save changes"

  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (step < 3) void goTo(step + 1)
          else submit(isDraft)
        }}
        className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"
      >
        <div className="flex min-w-0 flex-col gap-6">
          <Stepper step={step} onStep={(s) => void goTo(s)} />
          {notice}

          <div hidden={step !== 0}>
            <SectionCard title="Program details" description="Give the program a clear name and tell employees what they'll get out of it.">
              <div className="flex flex-col gap-5">
                <TextField control={form.control} name="name" label="Name" required placeholder="e.g. Healthy Habits in 4 Weeks" />
                <TextareaField control={form.control} name="description" label="Description" rows={3} maxLength={PROGRAM_LIMITS.description} placeholder="What's it about and who is it for?" />
                <CoverControl control={form.control} />
                <StartDateField control={form.control} locked={startLocked} weeks={v.weeks?.length ?? 0} />
              </div>
            </SectionCard>
          </div>

          <div hidden={step !== 1}>
            <SectionCard title="Weekly goals" description={`Each week has a theme and 1–${PROGRAM_LIMITS.maxGoals} goals. Duration follows the number of weeks (${pluralize(v.weeks?.length ?? 0, "week")}).`}>
              <WeekBuilder locked={program?.lockedFields.includes("weeks")} />
            </SectionCard>
          </div>

          <div hidden={step !== 2} className="flex flex-col gap-6">
            <SectionCard title="Participants" description="Who can enrol. They're notified when you publish.">
              <AudienceControl control={form.control} locked={program?.lockedFields.includes("audienceType")} />
            </SectionCard>
            <SectionCard title="Points & challenge">
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField control={form.control} name="completionPoints" label="Completion points" type="number" suffix="pts" required description="Awarded when someone completes every week." />
                <ChallengeControl control={form.control} />
              </div>
            </SectionCard>
          </div>

          {step === 3 ? <Review values={v} status={status} /> : null}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
          <ProgramCardPreview values={v} end={end} />
        </aside>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:-mx-6 sm:px-6 lg:col-span-2 lg:-mx-8 lg:px-8">
          <Button asChild variant="ghost" className="mr-auto">
            <Link href={program ? `/business-portal/programs/${program.id}` : "/business-portal/programs"}>Cancel</Link>
          </Button>
          {isDraft ? (
            <Button type="button" variant="outline" disabled={save.isPending} onClick={() => submit(false)}>
              {save.isPending && lastAction === "draft" ? <Spinner /> : <Save data-icon="inline-start" />}
              Save draft
            </Button>
          ) : null}
          {step > 0 ? (
            <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={save.isPending}>
              <ArrowLeft data-icon="inline-start" /> Back
            </Button>
          ) : null}
          {step < 3 ? (
            <Button type="submit" disabled={save.isPending}>
              Next <ArrowRight data-icon="inline-end" />
            </Button>
          ) : (
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && lastAction === "publish" ? <Spinner /> : isDraft ? <Rocket data-icon="inline-start" /> : <Check data-icon="inline-start" />}
              {primaryLabel}
            </Button>
          )}
        </div>
      </form>
    </FormProvider>
  )
}

function Stepper({ step, onStep }: { step: number; onStep: (s: number) => void }) {
  return (
    <nav aria-label="Steps">
      <p className="mb-2 text-xs font-medium text-muted-foreground sm:hidden">
        Step {step + 1} of {STEPS.length} · {STEPS[step]!.label}
      </p>
      <ol className="flex items-center gap-1.5 sm:gap-2">
        {STEPS.map((s, i) => {
          const done = i < step
          const current = i === step
          return (
            <li key={s.key} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => onStep(i)}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-left text-sm transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                  current ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                    current ? "border-primary bg-primary text-primary-foreground" : done ? "border-primary/40 bg-primary/10 text-primary" : "bg-card",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className="hidden truncate sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 ? <span className={cn("h-px flex-1", done ? "bg-primary/50" : "bg-border")} aria-hidden /> : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function CoverControl({ control }: { control: Control<ProgramFormValues> }) {
  const emoji = useController({ control, name: "coverEmoji" })
  const color = useController({ control, name: "coverColor" })
  return <CoverPicker emoji={emoji.field.value} color={color.field.value} onEmojiChange={emoji.field.onChange} onColorChange={color.field.onChange} emojis={PROGRAM_EMOJIS} />
}

function StartDateField({ control, locked, weeks }: { control: Control<ProgramFormValues>; locked: boolean; weeks: number }) {
  const { field, fieldState } = useController({ control, name: "startDate" })
  const end = programEnd(field.value, weeks)
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FieldShell
        id="f-startDate"
        label="Start date"
        required
        error={fieldState.error?.message}
        description={locked ? "Locked — the program has started." : "Programs work best starting on a Monday."}
      >
        <div className="relative">
          <Input id="f-startDate" type="date" className="h-9" min={locked ? undefined : todayYmd()} disabled={locked} aria-invalid={!!fieldState.error} {...field} />
          {locked ? <Lock className="pointer-events-none absolute top-1/2 right-9 size-3.5 -translate-y-1/2 text-muted-foreground" /> : null}
        </div>
      </FieldShell>
      <FieldShell label="Duration" description="Set by the number of weeks in the goal builder.">
        <div className="flex h-9 items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm">
          <CalendarDays className="size-4 text-muted-foreground" />
          <span className="font-medium">{pluralize(weeks, "week")}</span>
          {end ? <span className="truncate text-muted-foreground">· ends {formatDate(end, "EEE d MMM")}</span> : null}
        </div>
      </FieldShell>
    </div>
  )
}

function AudienceControl({ control, locked }: { control: Control<ProgramFormValues>; locked?: boolean }) {
  const type = useController({ control, name: "audienceType" })
  const ids = useController({ control, name: "audienceIds" })
  return (
    <div className="flex flex-col gap-3">
      {locked ? (
        <p className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" /> The audience can&apos;t change after the program starts.
        </p>
      ) : null}
      <AudienceField
        label="Who can enrol"
        value={{ audienceType: type.field.value, audienceIds: ids.field.value }}
        onChange={(a) => {
          type.field.onChange(a.audienceType)
          ids.field.onChange(a.audienceIds)
        }}
        error={ids.fieldState.error?.message}
        disabled={locked}
      />
    </div>
  )
}

function ChallengeControl({ control }: { control: Control<ProgramFormValues> }) {
  const { field, fieldState } = useController({ control, name: "combinedChallengeId" })
  const options = useApiQuery(["business", "programs", "challenge-options"], () => programsApi.challengeOptions())
  return (
    <FieldShell id="f-combinedChallengeId" label="Combined challenge" error={fieldState.error?.message} description="Optional — link a challenge that runs alongside the program.">
      <Select value={field.value || "none"} onValueChange={field.onChange} disabled={options.isLoading}>
        <SelectTrigger id="f-combinedChallengeId" className="h-9 w-full">
          <SelectValue placeholder={options.isLoading ? "Loading challenges…" : "No challenge"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No challenge</SelectItem>
          {(options.data ?? []).map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.coverEmoji} {c.name} <span className="text-muted-foreground">· {c.status}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  )
}

function ProgramCardPreview({ values, end }: { values: ProgramFormValues; end: string }) {
  const goals = (values.weeks ?? []).reduce((n, w) => n + (w.goals?.length ?? 0), 0)
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex h-24 items-end justify-between px-4 pb-3" style={{ background: `linear-gradient(135deg, ${values.coverColor}, ${values.coverColor}b3)` }}>
        <span className="text-4xl leading-none drop-shadow-sm" aria-hidden>
          {values.coverEmoji}
        </span>
        <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">{pluralize(values.weeks?.length ?? 0, "week")}</span>
      </div>
      <CardContent className="space-y-3 p-4">
        <div>
          <p className={cn("line-clamp-2 font-heading font-semibold", !values.name?.trim() && "text-muted-foreground")}>{values.name?.trim() || "Program name"}</p>
          <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{values.description?.trim() || "A short description helps employees decide to enrol."}</p>
        </div>
        <ul className="space-y-1.5 border-t pt-3 text-xs">
          <li className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="size-3.5" />
            {values.startDate ? `${formatDate(values.startDate, "d MMM")} – ${end ? formatDate(end, "d MMM yyyy") : "…"}` : "No start date"}
          </li>
          <li className="flex items-center gap-2 text-muted-foreground">
            <Check className="size-3.5" /> {pluralize(goals, "weekly goal")}
          </li>
          <li className="flex items-center gap-2 text-muted-foreground">
            <Coins className="size-3.5 text-amber-500" /> {Number.isFinite(values.completionPoints) ? formatNumber(values.completionPoints) : 0} points on completion
          </li>
        </ul>
        <p className="text-[11px] text-muted-foreground">How the program card looks in the Employee App.</p>
      </CardContent>
    </Card>
  )
}

function Review({ values, status }: { values: ProgramFormValues; status: ProgramStatus }) {
  const audience = { audienceType: values.audienceType, audienceIds: values.audienceIds ?? [] }
  const estimate = useApiQuery(["business", "audience", "estimate", audience], () => audienceApi.estimate(audience), { placeholderData: (p) => p })
  const options = useApiQuery(["business", "programs", "challenge-options"], () => programsApi.challengeOptions())
  const challenge = options.data?.find((c) => c.id === values.combinedChallengeId)
  const end = programEnd(values.startDate, values.weeks?.length ?? 0)
  const today = todayYmd()
  const startsNow = values.startDate <= today
  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Review" description={status === "draft" ? `Publishing makes it ${startsNow ? "live straight away" : `scheduled to start ${formatDate(values.startDate, "EEE d MMM")}`} and notifies everyone in the audience.` : "Check your changes before saving."}>
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <CoverTile emoji={values.coverEmoji} color={values.coverColor} size="lg" />
            <div className="min-w-0">
              <p className="font-heading font-semibold">{values.name}</p>
              <StatusBadge status={status === "draft" ? (startsNow ? "active" : "scheduled") : status} label={status === "draft" ? (startsNow ? "Goes live on publish" : "Scheduled on publish") : undefined} />
            </div>
          </div>
          <KeyValueList
            items={[
              { label: "Dates", value: `${formatDate(values.startDate, "EEE d MMM")} – ${end ? formatDate(end, "EEE d MMM yyyy") : "…"}` },
              { label: "Duration", value: pluralize(values.weeks?.length ?? 0, "week") },
              {
                label: "Participants",
                value: (
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-4 text-muted-foreground" />
                    {estimate.data ? `${estimate.data.label} · ${formatNumber(estimate.data.joined)} on the app` : "Estimating…"}
                  </span>
                ),
              },
              {
                label: "Completion points",
                value: (
                  <span className="inline-flex items-center gap-1.5">
                    <Coins className="size-4 text-amber-500" /> {formatNumber(values.completionPoints)} pts
                  </span>
                ),
              },
              {
                label: "Combined challenge",
                value: challenge ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Trophy className="size-4 text-violet-500" /> {challenge.name}
                  </span>
                ) : (
                  "None"
                ),
              },
            ]}
          />
        </div>
      </SectionCard>
      <SectionCard title="Week by week">
        <ol className="space-y-3">
          {(values.weeks ?? []).map((w, i) => (
            <li key={i} className="rounded-xl border p-3">
              <p className="text-sm font-semibold">
                <span className="text-muted-foreground">Week {i + 1} · </span>
                {w.title}
              </p>
              <ul className="mt-2 space-y-1">
                {w.goals.map((g, j) => (
                  <li key={j} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0">{g.label?.trim() || suggestGoalLabel(g.target, g.metric)}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatGoalTarget(g.target, g.metric)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </SectionCard>
    </div>
  )
}
