"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Save } from "lucide-react"
import { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { CoverPickerField, CoverTile, EMOJI_SETS } from "@/components/admin/cover"
import { ChoiceField, SelectField, TextareaField, TextField } from "@/components/common/form-fields"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { useApiMutation } from "@/lib/api/hooks"
import { badgesApi } from "@/lib/api/platform/badges"
import { formatNumber } from "@/lib/format"
import type { Badge } from "@/lib/types"
import { cn } from "@/lib/utils"
import { CRITERIA_META, RARITY_META } from "./meta"

const CRITERIA = ["first_workout", "streak", "steps_total", "water_goal", "early_activity", "challenge", "custom"] as const
const RARITIES = ["common", "rare", "epic", "legendary"] as const

const schema = z.object({
  name: z.string().trim().min(2, "Enter a badge name.").max(40, "Keep the name under 40 characters."),
  description: z.string().trim().min(1, "Add a short description employees will see.").max(160, "Keep the description under 160 characters."),
  icon: z.string().trim().min(1, "Pick an icon."),
  color: z.string().min(1),
  criteriaType: z.enum(CRITERIA, { error: "Choose a criteria type." }),
  threshold: z.number({ error: "Enter a number" }).positive("Threshold must be greater than 0.").max(100_000_000, "Threshold looks too high."),
  criteria: z.string().trim().min(1, "Describe how the badge is earned.").max(120, "Keep this under 120 characters."),
  rarity: z.enum(RARITIES),
  points: z.number({ error: "Enter a number" }).int("Use whole points.").min(0, "Points can't be negative.").max(1000, "At most 1,000 points."),
  status: z.enum(["active", "draft", "archived"]),
})
type Values = z.infer<typeof schema>

const EMPTY: Values = { name: "", description: "", icon: "🏅", color: "#f59e0b", criteriaType: "streak", threshold: 7, criteria: "", rarity: "common", points: 50, status: "active" }

const toValues = (b: Badge): Values => ({
  name: b.name,
  description: b.description,
  icon: b.icon,
  color: b.color,
  criteriaType: b.criteriaType,
  threshold: b.threshold,
  criteria: b.criteria,
  rarity: b.rarity,
  points: b.points,
  status: b.status,
})

/** Add / edit badge (SCR-P-020 editor). */
export function BadgeDialog({ open, onOpenChange, badge }: { open: boolean; onOpenChange: (open: boolean) => void; badge?: Badge | null }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY })
  const v = useWatch({ control: form.control }) as Values
  useEffect(() => {
    if (open) form.reset(badge ? toValues(badge) : EMPTY)
  }, [open, badge, form])

  const onError = (err: ApiError) => {
    if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
  }
  const create = useApiMutation(badgesApi.create, { success: "Badge saved.", errorTitle: "Couldn't save badge.", onSuccess: () => onOpenChange(false), onError })
  const update = useApiMutation(badgesApi.update, { success: "Badge saved.", errorTitle: "Couldn't save badge.", onSuccess: () => onOpenChange(false), onError })
  const pending = create.isPending || update.isPending
  const unit = CRITERIA_META[v.criteriaType]?.many

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{badge ? "Edit badge" : "Add badge"}</DialogTitle>
          <DialogDescription>Badges are earned automatically in the Employee App when the criteria are met.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
          <CoverTile emoji={v.icon || "🏅"} color={v.color} size="lg" solid />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("font-heading font-semibold break-words", !v.name?.trim() && "text-muted-foreground")}>{v.name?.trim() || "Badge name"}</span>
              <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-semibold", RARITY_META[v.rarity]?.className)}>{RARITY_META[v.rarity]?.label}</span>
            </div>
            <p className="truncate text-sm text-muted-foreground">{v.description?.trim() || "What employees see under the badge."}</p>
            <p className="text-xs text-muted-foreground">{typeof v.points === "number" && v.points > 0 ? `+${formatNumber(v.points)} bonus points` : "No bonus points"}</p>
          </div>
        </div>

        <form id="badge-form" noValidate className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit((values) => (badge ? update.mutate({ ...values, id: badge.id }) : create.mutate(values)))}>
          <TextField control={form.control} name="name" label="Badge name" placeholder="e.g. Hydration Hero" required />
          <SelectField
            control={form.control}
            name="status"
            label="Status"
            options={[
              { value: "active", label: "Active — can be earned" },
              { value: "draft", label: "Draft — hidden" },
              { value: "archived", label: "Inactive" },
            ]}
          />
          <TextareaField control={form.control} name="description" label="Description" rows={2} maxLength={160} className="sm:col-span-2" required />
          <CoverPickerField control={form.control} emojiName="icon" colorName="color" label="Icon" emojis={EMOJI_SETS.badge} className="sm:col-span-2" />
          <SelectField control={form.control} name="criteriaType" label="Criteria type" required options={CRITERIA.map((c) => ({ value: c, label: CRITERIA_META[c].label }))} />
          <TextField control={form.control} name="threshold" label="Threshold" type="number" description={unit ? `Number of ${unit}` : "Target value for the custom rule"} required />
          <TextField control={form.control} name="criteria" label="Criteria (shown to employees)" placeholder="e.g. Reach your water goal on 14 days" className="sm:col-span-2" required />
          <ChoiceField
            control={form.control}
            name="rarity"
            label="Rarity"
            columns={4}
            className="sm:col-span-2"
            options={RARITIES.map((r) => ({ value: r, label: RARITY_META[r].label }))}
          />
          <TextField control={form.control} name="points" label="Bonus points" type="number" suffix="pts" description="Added to the wallet when earned (0–1,000)." />
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="badge-form" disabled={pending}>
            {pending ? <Spinner /> : <Save data-icon="inline-start" />}
            Save badge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
