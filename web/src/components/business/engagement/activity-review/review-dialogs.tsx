"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight, Ban, CheckCheck, Coins } from "lucide-react"
import { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { TextareaField, TextField } from "@/components/common/form-fields"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import {
  REVIEW_LIMITS,
  UNIT_LABEL,
  activityMeta,
  activityReviewApi,
  formatActivityValue,
  proportionalPoints,
  type ActivityReviewRow,
  type ReviewUnit,
} from "@/lib/api/business/activity-review"
import { useApiMutation } from "@/lib/api/hooks"
import { formatDate, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { RecordSummary } from "./review-bits"

const reasonSchema = z
  .string()
  .trim()
  .min(REVIEW_LIMITS.reasonMin, `Add a short reason (at least ${REVIEW_LIMITS.reasonMin} characters)`)
  .max(REVIEW_LIMITS.reasonMax, `Keep it under ${REVIEW_LIMITS.reasonMax} characters`)

const REJECT_REASONS = [
  "Duplicate of an activity that already synced.",
  "Not enough detail — please add a note and log it again.",
  "Looks like travel by car, bus or train rather than exercise.",
  "Outside the dates or rules of the challenge.",
]

// ─── Reject ─────────────────────────────────────────────────────────────

const rejectSchema = z.object({ reason: reasonSchema })

/** Reject with a reason (required) — the employee sees it in the app; no points are awarded. */
export function RejectActivityDialog({ row, onOpenChange }: { row: ActivityReviewRow | null; onOpenChange: (open: boolean) => void }) {
  const form = useForm<{ reason: string }>({ resolver: zodResolver(rejectSchema), defaultValues: { reason: "" }, mode: "onTouched" })
  const open = !!row
  useEffect(() => {
    if (open) form.reset({ reason: "" })
  }, [open, form])
  const reject = useApiMutation(activityReviewApi.reject, {
    success: (r) => `Rejected — ${r.kind === "manual" ? "no points were added" : "the record won't earn points"}. The employee has been told why.`,
    onSuccess: () => onOpenChange(false),
    onError: (err) => err.fieldErrors?.reason && form.setError("reason", { message: err.fieldErrors.reason }),
  })
  const reason = useWatch({ control: form.control, name: "reason" })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{row?.kind === "suspicious" ? "Reject this record?" : "Reject this manual entry?"}</DialogTitle>
          <DialogDescription>No points are awarded. {row?.employeeName.split(" ")[0] ?? "The employee"} gets a notification with your reason.</DialogDescription>
        </DialogHeader>
        {row ? <RecordSummary row={row} /> : null}
        <form id="reject-activity" noValidate onSubmit={form.handleSubmit((v) => row && reject.mutate({ id: row.id, reason: v.reason.trim() }))} className="flex flex-col gap-3">
          <TextareaField control={form.control} name="reason" label="Reason shown to the employee" placeholder="e.g. This run already synced from Apple Health." rows={3} maxLength={REVIEW_LIMITS.reasonMax} required />
          <div className="flex flex-wrap gap-1.5">
            {REJECT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => form.setValue("reason", r, { shouldDirty: true, shouldValidate: true })}
                className={cn(
                  "max-w-full truncate rounded-full border border-dashed px-2.5 py-1 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground",
                  reason === r && "border-solid border-primary/40 bg-primary/5 text-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="reject-activity" variant="destructive" disabled={reject.isPending}>
            {reject.isPending ? <Spinner /> : <Ban data-icon="inline-start" />}
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Correct / adjust ───────────────────────────────────────────────────

const correctSchema = z.object({
  value: z.number({ error: "Enter the corrected value" }).positive("Enter a value greater than 0"),
  reason: reasonSchema,
})
type CorrectValues = z.infer<typeof correctSchema>

/** Edit the value → points are recomputed proportionally and awarded on the corrected value. */
export function CorrectActivityDialog({ row, onOpenChange }: { row: ActivityReviewRow | null; onOpenChange: (open: boolean) => void }) {
  const form = useForm<CorrectValues>({ resolver: zodResolver(correctSchema), defaultValues: { value: row?.value ?? 0, reason: "" }, mode: "onTouched" })
  const open = !!row
  useEffect(() => {
    if (row) form.reset({ value: row.value, reason: "" })
  }, [row, form])
  const correct = useApiMutation(activityReviewApi.correct, {
    success: (r) => `Corrected to ${formatActivityValue(r.value, r.unit)}${r.points > 0 ? ` — ${formatNumber(r.points)} points awarded` : ""}.`,
    onSuccess: () => onOpenChange(false),
    onError: (err) => Object.entries(err.fieldErrors ?? {}).forEach(([k, message]) => (k === "value" || k === "reason") && form.setError(k, { message })),
  })
  const value = Number(useWatch({ control: form.control, name: "value" })) || 0
  const unit = (row?.unit ?? "min") as ReviewUnit
  const newPoints = row ? proportionalPoints(row.points, row.value, value) : 0
  const changed = !!row && value > 0 && value !== row.value

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{row?.kind === "suspicious" ? "Adjust this record" : "Correct this entry"}</DialogTitle>
          <DialogDescription>Change the value to what really happened. Points are recalculated in proportion and awarded on the corrected value.</DialogDescription>
        </DialogHeader>
        {row ? <RecordSummary row={row} /> : null}
        <form
          id="correct-activity"
          noValidate
          onSubmit={form.handleSubmit((v) => {
            if (!row) return
            if (v.value === row.value) {
              form.setError("value", { message: "Enter a different value — or approve it as it is" })
              return
            }
            correct.mutate({ id: row.id, value: v.value, reason: v.reason.trim() })
          })}
          className="flex flex-col gap-4"
        >
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <TextField control={form.control} name="value" type="number" label={`Corrected value (${UNIT_LABEL[unit] ?? unit})`} suffix={unit === "steps" ? "steps" : unit} required />
            <div className="flex h-full flex-col justify-end sm:pt-6" aria-live="polite">
              <div className="flex h-9 items-center gap-2 rounded-lg border border-dashed px-3 text-sm whitespace-nowrap">
                <Coins className="size-4 text-amber-500" />
                <span className="text-muted-foreground tabular-nums line-through decoration-muted-foreground/60">{formatNumber(row?.points ?? 0)}</span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
                <span className={cn("font-semibold tabular-nums", changed && "text-primary")}>{formatNumber(changed ? newPoints : (row?.points ?? 0))} pts</span>
              </div>
            </div>
          </div>
          <TextareaField
            control={form.control}
            name="reason"
            label="What was corrected and why"
            placeholder="e.g. Confirmed with the employee — the run was 18 km, not 75 km."
            description="Shown to the employee and kept in the review history."
            rows={3}
            maxLength={REVIEW_LIMITS.reasonMax}
            required
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="correct-activity" disabled={correct.isPending}>
            {correct.isPending ? <Spinner /> : <CheckCheck data-icon="inline-start" />}
            Save correction &amp; approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Plain text for a record, used in confirmation copy. */
export const recordLabel = (row: Pick<ActivityReviewRow, "type" | "value" | "unit" | "day">) =>
  `${activityMeta(row.type).label} · ${formatActivityValue(row.value, row.unit)} · ${formatDate(row.day, "d MMM")}`
