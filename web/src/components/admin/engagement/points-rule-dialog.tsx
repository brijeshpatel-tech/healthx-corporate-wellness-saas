"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Plus } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { SelectField, TextareaField, TextField } from "@/components/common/form-fields"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { useApiMutation } from "@/lib/api/hooks"
import { today } from "@/lib/api/platform/common"
import { EARNING_EVENTS, pointsRulesApi } from "@/lib/api/platform/points"
import { formatDate } from "@/lib/format"
import { pointsSourceMeta } from "./meta"

const EVENTS = ["steps", "workout", "meditation", "water", "challenge", "streak", "badge", "habit"] as const

const schema = z
  .object({
    label: z.string().trim().min(3, "Enter a rule name.").max(60, "Keep the name under 60 characters."),
    eventType: z.enum(EVENTS, { error: "Choose the event that earns points." }),
    description: z.string().trim().max(200, "Keep the description under 200 characters."),
    points: z.number({ error: "Enter a number" }).int("Use whole points.").min(0, "Points can't be negative.").max(1000, "At most 1,000 points."),
    per: z.string().trim().min(1, "Say what one award is for, e.g. “workout”.").max(40),
    dailyCap: z.union([z.number(), z.literal("")]),
    effectiveFrom: z.string().min(1, "Choose the date the rule applies from."),
  })
  .superRefine((v, ctx) => {
    if (v.dailyCap !== "") {
      if (!Number.isInteger(v.dailyCap) || v.dailyCap < 1 || v.dailyCap > 10000) ctx.addIssue({ code: "custom", path: ["dailyCap"], message: "Daily cap must be 1–10,000 (or empty for no cap)." })
      else if (v.points > 0 && v.dailyCap < v.points) ctx.addIssue({ code: "custom", path: ["dailyCap"], message: "Daily cap can't be lower than the points per event." })
    }
    if (v.effectiveFrom && v.effectiveFrom < today()) ctx.addIssue({ code: "custom", path: ["effectiveFrom"], message: "Effective date can't be in the past." })
  })
type Values = z.infer<typeof schema>

const empty = (): Values => ({ label: "", eventType: "workout", description: "", points: 10, per: "", dailyCap: "", effectiveFrom: today() })

export function PointsRuleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: empty() })
  useEffect(() => {
    if (open) form.reset(empty())
  }, [open, form])
  const create = useApiMutation(pointsRulesApi.create, {
    success: (_r, i) => `Rule added – applies from ${formatDate(i.effectiveFrom, "d MMM")}.`,
    errorTitle: "Couldn't save rule.",
    onSuccess: () => onOpenChange(false),
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
    },
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add points rule</DialogTitle>
          <DialogDescription>New rules apply to events from the effective date. Points already earned never change.</DialogDescription>
        </DialogHeader>
        <form
          id="points-rule-form"
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit((v) => create.mutate({ ...v, dailyCap: v.dailyCap === "" ? null : v.dailyCap }))}
        >
          <TextField control={form.control} name="label" label="Rule name" placeholder="e.g. Log a healthy meal" className="sm:col-span-2" required />
          <SelectField
            control={form.control}
            name="eventType"
            label="Trigger event"
            required
            options={EARNING_EVENTS.map((e) => ({ value: e, label: `${pointsSourceMeta(e).emoji} ${pointsSourceMeta(e).label}` }))}
          />
          <TextField control={form.control} name="per" label="Per" placeholder="e.g. workout, 1,000 steps, day" required />
          <TextareaField control={form.control} name="description" label="Description" rows={2} maxLength={200} className="sm:col-span-2" placeholder="When the points are awarded." />
          <TextField control={form.control} name="points" label="Points" type="number" suffix="pts" description="0–1,000 per event" required />
          <TextField control={form.control} name="dailyCap" label="Daily cap" type="number" placeholder="No cap" description="Max points per person per day" />
          <TextField control={form.control} name="effectiveFrom" label="Effective from" type="date" required />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="points-rule-form" disabled={create.isPending}>
            {create.isPending ? <Spinner /> : <Plus data-icon="inline-start" />}
            Add rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
