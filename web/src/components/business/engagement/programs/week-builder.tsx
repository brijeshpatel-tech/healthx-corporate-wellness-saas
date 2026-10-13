"use client"

import { ChevronDown, ChevronUp, Copy, Lock, Plus, Trash2 } from "lucide-react"
import { useController, useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { FieldShell } from "@/components/common/form-fields"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PROGRAM_LIMITS, type ProgramMetric } from "@/lib/api/business/programs"
import { formatShortDate, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"
import { PROGRAM_METRICS, PROGRAM_METRIC_META, addDaysYmd, suggestGoalLabel } from "./program-meta"
import type { ProgramFormValues } from "./program-form"

export const newGoal = (metric: ProgramMetric = "steps") => ({ goalId: "", label: "", metric, target: PROGRAM_METRIC_META[metric].defaultTarget })
export const newWeek = (n: number) => ({ title: n === 1 ? "Get started" : `Week ${n}`, goals: [newGoal()] })

/** Week-by-week goal builder: add / remove / reorder weeks, up to 5 goals per week. */
export function WeekBuilder({ locked }: { locked?: boolean }) {
  const { control, formState, getValues } = useFormContext<ProgramFormValues>()
  const weeks = useFieldArray({ control, name: "weeks" })
  const startDate = useWatch({ control, name: "startDate" })
  const rootError = (formState.errors.weeks as { root?: { message?: string }; message?: string } | undefined)?.root?.message ?? formState.errors.weeks?.message
  const atMax = weeks.fields.length >= PROGRAM_LIMITS.maxWeeks

  return (
    <div className="flex flex-col gap-4">
      {locked ? (
        <p className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" /> The program has started, so its weeks and goals can no longer change.
        </p>
      ) : null}
      {weeks.fields.map((w, i) => (
        <WeekCard
          key={w.id}
          index={i}
          count={weeks.fields.length}
          startDate={startDate}
          locked={locked}
          onRemove={() => weeks.remove(i)}
          onMove={(dir) => weeks.move(i, i + dir)}
          onDuplicate={() => {
            const src = getValues(`weeks.${i}`)
            weeks.insert(i + 1, { title: `${src.title} (again)`.slice(0, PROGRAM_LIMITS.weekTitle), goals: src.goals.map((g) => ({ ...g, goalId: "" })) })
          }}
          disableDuplicate={atMax}
        />
      ))}
      {rootError ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          {rootError}
        </p>
      ) : null}
      {!locked ? (
        <Button type="button" variant="outline" className="h-10 border-dashed" onClick={() => weeks.append(newWeek(weeks.fields.length + 1))} disabled={atMax}>
          <Plus data-icon="inline-start" /> {atMax ? `Up to ${PROGRAM_LIMITS.maxWeeks} weeks` : `Add week ${weeks.fields.length + 1}`}
        </Button>
      ) : null}
    </div>
  )
}

function WeekCard({
  index,
  count,
  startDate,
  locked,
  onRemove,
  onMove,
  onDuplicate,
  disableDuplicate,
}: {
  index: number
  count: number
  startDate?: string
  locked?: boolean
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  onDuplicate: () => void
  disableDuplicate: boolean
}) {
  const { control, register, formState } = useFormContext<ProgramFormValues>()
  const goals = useFieldArray({ control, name: `weeks.${index}.goals` })
  const weekErrors = formState.errors.weeks?.[index]
  const titleError = weekErrors?.title?.message
  const goalsError = (weekErrors?.goals as { root?: { message?: string }; message?: string } | undefined)?.root?.message ?? weekErrors?.goals?.message
  const from = startDate ? addDaysYmd(startDate, index * 7) : ""
  const to = startDate ? addDaysYmd(startDate, index * 7 + 6) : ""

  return (
    <section className="rounded-xl border bg-card" aria-label={`Week ${index + 1}`}>
      <header className="flex flex-wrap items-start gap-3 border-b p-3 sm:items-center">
        <span className="flex size-9 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
          <span className="text-[9px] leading-none font-semibold tracking-wide uppercase">Week</span>
          <span className="text-sm leading-tight font-bold">{index + 1}</span>
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <Input
            {...register(`weeks.${index}.title`)}
            disabled={locked}
            placeholder="Week theme, e.g. Move more"
            aria-label={`Week ${index + 1} title`}
            aria-invalid={!!titleError}
            className="h-9 font-medium"
          />
          {titleError ? (
            <p className="mt-1 text-xs font-medium text-destructive" role="alert">
              {titleError}
            </p>
          ) : from ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {formatShortDate(from)} – {formatShortDate(to)} · {pluralize(goals.fields.length, "goal")}
            </p>
          ) : null}
        </div>
        {!locked ? (
          <div className="flex items-center gap-0.5">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Move week up" disabled={index === 0} onClick={() => onMove(-1)}>
              <ChevronUp />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Move week down" disabled={index === count - 1} onClick={() => onMove(1)}>
              <ChevronDown />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Duplicate week" disabled={disableDuplicate} onClick={onDuplicate}>
              <Copy />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove week ${index + 1}`} disabled={count <= 1} onClick={onRemove} className="text-muted-foreground hover:text-destructive">
              <Trash2 />
            </Button>
          </div>
        ) : null}
      </header>

      <ul className="divide-y">
        {goals.fields.map((g, j) => (
          <GoalRow key={g.id} week={index} index={j} locked={locked} canRemove={goals.fields.length > 1} onRemove={() => goals.remove(j)} />
        ))}
      </ul>

      <footer className="flex flex-wrap items-center gap-2 border-t px-3 py-2">
        {goalsError ? (
          <p className="text-xs font-medium text-destructive" role="alert">
            {goalsError}
          </p>
        ) : null}
        {!locked ? (
          <Button type="button" variant="ghost" size="sm" className="ml-auto text-primary" onClick={() => goals.append(newGoal())} disabled={goals.fields.length >= PROGRAM_LIMITS.maxGoals}>
            <Plus data-icon="inline-start" /> {goals.fields.length >= PROGRAM_LIMITS.maxGoals ? `Up to ${PROGRAM_LIMITS.maxGoals} goals` : "Add goal"}
          </Button>
        ) : null}
      </footer>
    </section>
  )
}

function GoalRow({ week, index, locked, canRemove, onRemove }: { week: number; index: number; locked?: boolean; canRemove: boolean; onRemove: () => void }) {
  const { control, setValue, formState } = useFormContext<ProgramFormValues>()
  const metric = useController({ control, name: `weeks.${week}.goals.${index}.metric` })
  const { field: targetField } = useController({ control, name: `weeks.${week}.goals.${index}.target` })
  const targetValue = useWatch({ control, name: `weeks.${week}.goals.${index}.target` })
  const label = useController({ control, name: `weeks.${week}.goals.${index}.label` })
  const errors = formState.errors.weeks?.[week]?.goals?.[index]
  const m = (metric.field.value ?? "steps") as ProgramMetric
  const meta = PROGRAM_METRIC_META[m]
  const suggestion = suggestGoalLabel(Number(targetValue), m)
  const idBase = `w${week}-g${index}`

  return (
    <li className="grid gap-3 p-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,9rem)_minmax(0,1fr)_auto] sm:items-start">
      <FieldShell id={`${idBase}-metric`} label={<span className="text-xs">Metric</span>} error={errors?.metric?.message}>
        <Select
          value={m}
          disabled={locked}
          onValueChange={(v) => {
            metric.field.onChange(v)
            setValue(`weeks.${week}.goals.${index}.target`, PROGRAM_METRIC_META[v as ProgramMetric].defaultTarget, { shouldValidate: formState.isSubmitted })
          }}
        >
          <SelectTrigger id={`${idBase}-metric`} className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROGRAM_METRICS.map((x) => (
              <SelectItem key={x} value={x}>
                {PROGRAM_METRIC_META[x].emoji} {PROGRAM_METRIC_META[x].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldShell>
      <FieldShell id={`${idBase}-target`} label={<span className="text-xs">Weekly target</span>} error={errors?.target?.message}>
        <div className="relative">
          <Input
            id={`${idBase}-target`}
            type="number"
            inputMode="decimal"
            min={0}
            disabled={locked}
            aria-invalid={!!errors?.target}
            className="h-9 pr-16"
            {...targetField}
            value={Number.isFinite(targetValue) ? targetValue : ""}
            onChange={(e) => targetField.onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">{meta.unit}</span>
        </div>
      </FieldShell>
      <FieldShell id={`${idBase}-label`} label={<span className="text-xs">Goal as employees see it</span>} error={errors?.label?.message} description={!label.field.value && suggestion ? "Leave blank to use the suggestion." : undefined}>
        <Input
          id={`${idBase}-label`}
          disabled={locked}
          placeholder={suggestion || "e.g. Walk 7,000 steps a day"}
          aria-invalid={!!errors?.label}
          className="h-9"
          {...label.field}
          value={label.field.value ?? ""}
        />
      </FieldShell>
      {!locked ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove goal ${index + 1}`}
          disabled={!canRemove}
          onClick={onRemove}
          className={cn("justify-self-end text-muted-foreground hover:text-destructive sm:mt-6")}
        >
          <Trash2 />
        </Button>
      ) : null}
    </li>
  )
}
