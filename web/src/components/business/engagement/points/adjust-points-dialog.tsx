"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Minus, Plus, SlidersHorizontal } from "lucide-react"
import { useEffect } from "react"
import { useController, useForm } from "react-hook-form"
import { z } from "zod"
import { ChoiceField, FieldShell, TextareaField, TextField } from "@/components/common/form-fields"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { MAX_ADJUSTMENT_POINTS, MIN_REASON_LENGTH, pointsApi } from "@/lib/api/business/points"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import { EmployeePicker } from "./employee-picker"

const schema = z.object({
  employeeId: z.string().min(1, "Choose an employee"),
  direction: z.enum(["credit", "debit"]),
  points: z
    .union([z.literal(""), z.number()])
    .refine((v) => v !== "" && Number.isInteger(v) && v >= 1 && v <= MAX_ADJUSTMENT_POINTS, `Enter a whole number from 1 to ${formatNumber(MAX_ADJUSTMENT_POINTS)}`),
  reason: z.string().trim().min(MIN_REASON_LENGTH, `Give a reason (at least ${MIN_REASON_LENGTH} characters)`).max(200, "Keep the reason under 200 characters"),
})
type Values = z.infer<typeof schema>

const blank: Values = { employeeId: "", direction: "credit", points: "", reason: "" }

/** FRM-43 single manual adjustment (add / deduct with a reason). Audit-logged, shown in the employee's wallet and in the admin awards log. */
export function AdjustPointsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const employees = useApiQuery(["business", "points", "eligible"], () => pointsApi.eligibleEmployees(), { enabled: open, staleTime: 60_000 })
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: blank })
  const { field: employeeField, fieldState: employeeState } = useController({ control: form.control, name: "employeeId" })

  useEffect(() => {
    if (open) form.reset(blank)
  }, [open, form])

  const adjust = useApiMutation(pointsApi.adjust, {
    errorTitle: "Couldn't save the adjustment",
    success: (r) => `Adjustment saved – ${formatNumber(r.points)} points ${r.direction === "credit" ? "added" : "deducted"}.`,
    onSuccess: () => onOpenChange(false),
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }, { shouldFocus: true }))
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adjust points</DialogTitle>
          <DialogDescription>Add or deduct points for one employee, e.g. to correct a mistake. They&apos;re notified, it shows in their wallet and it&apos;s recorded in the audit log.</DialogDescription>
        </DialogHeader>
        <form
          id="adjust-points-form"
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit((v) => adjust.mutate({ employeeId: v.employeeId, direction: v.direction, points: v.points === "" ? 0 : v.points, reason: v.reason }))}
        >
          <FieldShell id="f-employeeId" label="Employee" required error={employeeState.error?.message}>
            <EmployeePicker
              id="f-employeeId"
              value={employeeField.value}
              onChange={(id) => {
                employeeField.onChange(id)
                form.clearErrors(["employeeId", "points"])
              }}
              employees={employees.data ?? []}
              loading={employees.isLoading}
              invalid={!!employeeState.error}
            />
          </FieldShell>
          <ChoiceField
            control={form.control}
            name="direction"
            label="Adjustment"
            options={[
              { value: "credit", label: "Add points", description: "A bonus or a correction in their favour", icon: <Plus className="size-4 text-emerald-600 dark:text-emerald-400" /> },
              { value: "debit", label: "Deduct points", description: "Can't take their balance below zero", icon: <Minus className="size-4 text-rose-600 dark:text-rose-400" /> },
            ]}
          />
          <TextField control={form.control} name="points" label="Points" type="number" placeholder="e.g. 200" suffix="pts" required description={`1 to ${formatNumber(MAX_ADJUSTMENT_POINTS)} points.`} />
          <TextareaField
            control={form.control}
            name="reason"
            label="Reason"
            placeholder="e.g. Steps from 3 Oct didn't sync because of an app outage"
            description="The employee sees this reason in their wallet."
            rows={2}
            maxLength={200}
            required
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="adjust-points-form" disabled={adjust.isPending}>
            {adjust.isPending ? <Spinner /> : <SlidersHorizontal data-icon="inline-start" />}
            Save adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
