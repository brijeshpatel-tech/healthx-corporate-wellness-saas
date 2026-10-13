"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronsUpDown, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { useController, useForm, useWatch, type Control, type UseFormReturn } from "react-hook-form"
import { z } from "zod"
import { FieldShell, SelectField, TextareaField, TextField } from "@/components/common/form-fields"
import { UserAvatar } from "@/components/common/user-avatar"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import {
  ACTIVITY_TYPE_META,
  REVIEW_LIMITS,
  UNIT_LABEL,
  activityReviewApi,
  suggestedPoints,
  type ReviewEmployeeOption,
  type ReviewUnit,
} from "@/lib/api/business/activity-review"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

const ymd = (d: Date) => formatDate(d, "yyyy-MM-dd")
const today = () => ymd(new Date())
const oldest = () => ymd(new Date(Date.now() - REVIEW_LIMITS.missingMaxDaysAgo * 86_400_000))

const schema = z
  .object({
    employeeId: z.string().min(1, "Choose an employee"),
    type: z.string().min(1, "Choose an activity type"),
    date: z.string().min(1, "Choose a date"),
    unit: z.enum(["min", "km", "steps"]),
    value: z.number({ error: "Enter a value" }).positive("Enter a value greater than 0"),
    points: z.number({ error: "Enter points (0 for none)" }).int("Use whole points").min(0, "Points can't be negative").max(REVIEW_LIMITS.maxPoints, `Up to ${REVIEW_LIMITS.maxPoints} points`),
    reason: z.string().trim().min(REVIEW_LIMITS.reasonMin, "Say why this record is being added").max(REVIEW_LIMITS.reasonMax, `Keep it under ${REVIEW_LIMITS.reasonMax} characters`),
  })
  .superRefine((v, ctx) => {
    if (v.date > today()) ctx.addIssue({ code: "custom", path: ["date"], message: "The date can't be in the future" })
    else if (v.date && v.date < oldest()) ctx.addIssue({ code: "custom", path: ["date"], message: `Only the last ${REVIEW_LIMITS.missingMaxDaysAgo} days can be added` })
    const units = ACTIVITY_TYPE_META[v.type]?.units ?? []
    if (v.type && !units.includes(v.unit)) ctx.addIssue({ code: "custom", path: ["unit"], message: "Choose a unit for this activity" })
    const max = v.unit === "min" ? 600 : v.unit === "km" ? 300 : 100_000
    if (v.value > max) ctx.addIssue({ code: "custom", path: ["value"], message: `Up to ${formatNumber(max)} ${UNIT_LABEL[v.unit]}` })
  })
type Values = z.infer<typeof schema>

const TYPES = Object.entries(ACTIVITY_TYPE_META).filter(([key]) => key !== "other")
const DEFAULTS: Values = { employeeId: "", type: "walking", date: "", unit: "min", value: 30, points: suggestedPoints("walking", 30, "min"), reason: "" }

/** #365 — an admin records an activity the employee's tracker missed (approved straight away, with a reason). */
export function MissingActivityDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: DEFAULTS, mode: "onTouched" })
  const employees = useApiQuery(["business", "activity-review", "employees"], () => activityReviewApi.employeeOptions(), { enabled: open })
  useEffect(() => {
    if (open) form.reset({ ...DEFAULTS, date: today() })
  }, [open, form])
  const add = useApiMutation(activityReviewApi.addMissing, {
    success: (r) => `Activity added${r.points > 0 ? ` and ${formatNumber(r.points)} points awarded` : ""}. The employee has been notified.`,
    onSuccess: () => onOpenChange(false),
    onError: (err) => Object.entries(err.fieldErrors ?? {}).forEach(([k, message]) => form.setError(k as keyof Values, { message })),
  })
  const [type, unit, value] = useWatch({ control: form.control, name: ["type", "unit", "value"] })
  const units = ACTIVITY_TYPE_META[type]?.units ?? ["min"]
  const suggestion = suggestedPoints(type, Number(value) || 0, unit)

  /** Keep points in line with the suggestion until the admin types their own number. */
  const syncPoints = (next: Partial<Pick<Values, "type" | "unit" | "value">>) => {
    if (form.getFieldState("points").isDirty) return
    const v = { type, unit, value, ...next }
    form.setValue("points", suggestedPoints(v.type, Number(v.value) || 0, v.unit))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Record a missing activity</DialogTitle>
          <DialogDescription>For activity a tracker missed — for example during a sync outage. It&apos;s approved straight away, added to the employee&apos;s history and they&apos;re notified.</DialogDescription>
        </DialogHeader>
        <form
          id="missing-activity"
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit((v) => add.mutate({ employeeId: v.employeeId, type: v.type, date: v.date, unit: v.unit as ReviewUnit, value: v.value, points: v.points, reason: v.reason.trim() }))}
        >
          <EmployeeField control={form.control} options={employees.data ?? []} loading={employees.isLoading} className="sm:col-span-2" />
          <FieldShell id="f-type" label="Activity" required error={form.formState.errors.type?.message}>
            <TypeSelect
              value={type}
              onChange={(t) => {
                form.setValue("type", t, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
                const nextUnits = ACTIVITY_TYPE_META[t]?.units ?? ["min"]
                const nextUnit = nextUnits.includes(unit) ? unit : nextUnits[0]!
                if (nextUnit !== unit) form.setValue("unit", nextUnit, { shouldDirty: true })
                syncPoints({ type: t, unit: nextUnit })
              }}
            />
          </FieldShell>
          <TextField control={form.control} name="date" type="date" label="Date" required />
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2 sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)] sm:gap-4">
            <ValueField form={form} onValue={(n) => syncPoints({ value: n })} />
            <SelectField
              control={form.control}
              name="unit"
              label="Unit"
              options={units.map((u) => ({ value: u, label: UNIT_LABEL[u] }))}
              disabled={units.length === 1}
            />
            <TextField
              control={form.control}
              name="points"
              type="number"
              label="Points to award"
              suffix="pts"
              description={`Suggested: ${formatNumber(suggestion)} pts`}
              className="col-span-2 sm:col-span-1"
            />
          </div>
          <TextareaField
            control={form.control}
            name="reason"
            label="Reason"
            placeholder="e.g. Health Connect outage on 8 Oct — confirmed with IT and the employee."
            description="Shown to the employee and kept in the review history."
            rows={3}
            maxLength={REVIEW_LIMITS.reasonMax}
            required
            className="sm:col-span-2"
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="missing-activity" disabled={add.isPending}>
            {add.isPending ? <Spinner /> : <Plus data-icon="inline-start" />}
            Add &amp; award points
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ValueField({ form, onValue }: { form: UseFormReturn<Values>; onValue: (n: number) => void }) {
  const error = form.formState.errors.value?.message
  return (
    <FieldShell id="f-value" label="Amount" required error={error}>
      <Input
        id="f-value"
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        aria-invalid={!!error}
        className="h-9"
        {...form.register("value", { valueAsNumber: true, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onValue(Number(e.target.value)) })}
      />
    </FieldShell>
  )
}

function TypeSelect({ value, onChange }: { value: string; onChange: (type: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Activity" className="flex flex-wrap gap-1.5">
      {TYPES.map(([key, meta]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          onClick={() => onChange(key)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
            value === key && "border-primary bg-primary/10 text-primary hover:bg-primary/10",
          )}
        >
          <span aria-hidden>{meta.emoji}</span>
          {meta.label}
        </button>
      ))}
    </div>
  )
}

function EmployeeField({ control, options, loading, className }: { control: Control<Values>; options: ReviewEmployeeOption[]; loading?: boolean; className?: string }) {
  const { field, fieldState } = useController({ control, name: "employeeId" })
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.id === field.value)
  return (
    <FieldShell id="f-employeeId" label="Employee" required error={fieldState.error?.message} className={className}>
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <Button
            id="f-employeeId"
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={!!fieldState.error}
            onBlur={field.onBlur}
            className={cn("h-10 w-full justify-between px-2.5 font-normal", fieldState.error && "border-destructive ring-3 ring-destructive/20")}
          >
            {selected ? (
              <span className="flex min-w-0 items-center gap-2">
                <UserAvatar name={selected.name} color={selected.avatarColor} size="xs" />
                <span className="truncate font-medium">{selected.name}</span>
                <span className="hidden truncate text-xs text-muted-foreground sm:inline">· {selected.departmentName}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">{loading ? "Loading employees…" : "Search for an employee…"}</span>
            )}
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 p-0">
          <Command>
            <CommandInput placeholder="Name or department…" />
            <CommandList>
              <CommandEmpty>No employees found.</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem
                    key={o.id}
                    value={`${o.name} ${o.departmentName}`}
                    onSelect={() => {
                      field.onChange(o.id)
                      setOpen(false)
                    }}
                  >
                    <UserAvatar name={o.name} color={o.avatarColor} size="xs" />
                    <span className="min-w-0 flex-1 truncate">{o.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{o.departmentName}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </FieldShell>
  )
}
