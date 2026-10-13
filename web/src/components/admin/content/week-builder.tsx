"use client"

import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react"
import { useController, useFieldArray, useFormState, useWatch, type Control } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { GoalMetric } from "@/lib/api/platform/programs"
import { pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"
import { GOAL_METRIC_OPTIONS, GOAL_METRIC_UNIT } from "./meta"

export interface GoalValues {
  id: string
  label: string
  metric: GoalMetric
  target: number
}
export interface WeekValues {
  title: string
  goals: GoalValues[]
}
/** Program template form values (the builder edits `weeks`). */
export interface WeeksForm {
  name: string
  description: string
  coverEmoji: string
  coverColor: string
  weeks: WeekValues[]
}

export const goalId = () => `g_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
export const newGoal = (): GoalValues => ({ id: goalId(), label: "", metric: "steps", target: 50000 })

const MAX_WEEKS = 12
const MAX_GOALS = 6

/** Week / goal builder for program templates: add, remove and reorder weeks; add and remove goals per week. */
export function WeekBuilder({ control, disabled }: { control: Control<WeeksForm>; disabled?: boolean }) {
  const weeks = useFieldArray({ control, name: "weeks" })
  const { errors } = useFormState({ control, name: "weeks" })
  const rootError = errors.weeks?.message ?? errors.weeks?.root?.message

  return (
    <div className="space-y-3">
      {weeks.fields.length === 0 ? (
        <div className={cn("rounded-xl border border-dashed p-8 text-center", rootError && "border-destructive/60 bg-destructive/5")}>
          <p className="text-sm font-medium">No weeks yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Add a week, then give it one or more goals.</p>
        </div>
      ) : (
        <ol className="space-y-3">
          {weeks.fields.map((f, i) => (
            <WeekCard
              key={f.id}
              control={control}
              index={i}
              count={weeks.fields.length}
              disabled={disabled}
              onMove={(dir) => weeks.move(i, i + dir)}
              onRemove={() => weeks.remove(i)}
            />
          ))}
        </ol>
      )}
      {rootError ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          {rootError}
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        onClick={() => weeks.append({ title: `Week ${weeks.fields.length + 1}`, goals: [newGoal()] })}
        disabled={disabled || weeks.fields.length >= MAX_WEEKS}
      >
        <Plus data-icon="inline-start" /> Add week
      </Button>
      {weeks.fields.length >= MAX_WEEKS ? <p className="text-xs text-muted-foreground">Templates can have up to {MAX_WEEKS} weeks.</p> : null}
    </div>
  )
}

function WeekCard({
  control,
  index,
  count,
  disabled,
  onMove,
  onRemove,
}: {
  control: Control<WeeksForm>
  index: number
  count: number
  disabled?: boolean
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const goals = useFieldArray({ control, name: `weeks.${index}.goals` })
  const title = useController({ control, name: `weeks.${index}.title` })
  const { errors } = useFormState({ control, name: `weeks.${index}.goals` })
  const goalsError = errors.weeks?.[index]?.goals?.message ?? errors.weeks?.[index]?.goals?.root?.message

  return (
    <li className={cn("rounded-xl border bg-card", (title.fieldState.error || goalsError) && "border-destructive/50")}>
      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
        <span className="flex h-7 shrink-0 items-center rounded-md bg-primary/10 px-2 text-xs font-semibold text-primary tabular-nums">Week {index + 1}</span>
        <Input
          {...title.field}
          value={title.field.value ?? ""}
          placeholder="Week title, e.g. Move more"
          aria-label={`Week ${index + 1} title`}
          aria-invalid={!!title.fieldState.error}
          className="h-8 min-w-0 flex-1 bg-background"
        />
        <div className="flex shrink-0 items-center">
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onMove(-1)} disabled={disabled || index === 0} aria-label="Move week up">
            <ArrowUp />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onMove(1)} disabled={disabled || index === count - 1} aria-label="Move week down">
            <ArrowDown />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} disabled={disabled} aria-label="Remove week" className="text-muted-foreground hover:text-destructive">
            <Trash2 />
          </Button>
        </div>
      </div>
      {title.fieldState.error ? <p className="px-3 pt-2 text-xs font-medium text-destructive">{title.fieldState.error.message}</p> : null}
      <div className="space-y-2 p-3">
        {goals.fields.map((g, gi) => (
          <GoalRow key={g.id} control={control} week={index} index={gi} disabled={disabled} onRemove={() => goals.remove(gi)} />
        ))}
        {goalsError ? (
          <p className="text-xs font-medium text-destructive" role="alert">
            {goalsError}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => goals.append(newGoal())} disabled={disabled || goals.fields.length >= MAX_GOALS} className="text-primary">
            <Plus data-icon="inline-start" /> Add goal
          </Button>
          <span className="text-xs text-muted-foreground">{pluralize(goals.fields.length, "goal")}</span>
        </div>
      </div>
    </li>
  )
}

function GoalRow({ control, week, index, disabled, onRemove }: { control: Control<WeeksForm>; week: number; index: number; disabled?: boolean; onRemove: () => void }) {
  const label = useController({ control, name: `weeks.${week}.goals.${index}.label` })
  const metric = useController({ control, name: `weeks.${week}.goals.${index}.metric` })
  const target = useController({ control, name: `weeks.${week}.goals.${index}.target` })
  const metricValue = useWatch({ control, name: `weeks.${week}.goals.${index}.metric` })
  const errors = [label.fieldState.error?.message, metric.fieldState.error?.message, target.fieldState.error?.message].filter(Boolean)

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_170px_140px_auto]">
        <Input
          {...label.field}
          value={label.field.value ?? ""}
          placeholder="Goal, e.g. Walk 7,000 steps a day"
          aria-label="Goal"
          aria-invalid={!!label.fieldState.error}
          className="h-9 sm:col-span-1"
        />
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} disabled={disabled} aria-label="Remove goal" className="text-muted-foreground hover:text-destructive sm:order-last">
          <X />
        </Button>
        <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-2 sm:contents">
          <Select value={metric.field.value} onValueChange={metric.field.onChange} disabled={disabled}>
            <SelectTrigger className="h-9 w-full" aria-label="Metric" aria-invalid={!!metric.fieldState.error}>
              <SelectValue placeholder="Metric" />
            </SelectTrigger>
            <SelectContent>
              {GOAL_METRIC_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Input
              {...target.field}
              type="number"
              inputMode="decimal"
              value={target.field.value ?? ""}
              onChange={(e) => target.field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
              aria-label="Target for the week"
              aria-invalid={!!target.fieldState.error}
              className="h-9 pr-16 tabular-nums"
            />
            <span className="pointer-events-none absolute top-1/2 right-2.5 max-w-14 -translate-y-1/2 truncate text-xs text-muted-foreground">{GOAL_METRIC_UNIT[metricValue ?? "steps"]}</span>
          </div>
        </div>
      </div>
      {errors.length ? <p className="mt-1 text-xs font-medium text-destructive">{errors.join(" · ")}</p> : null}
    </div>
  )
}
