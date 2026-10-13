"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { format, subDays } from "date-fns"
import { Award, Coins, Info, Users } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useController, useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { AudienceField } from "@/components/business/engagement/audience-field"
import { TextareaField, TextField } from "@/components/common/form-fields"
import { ConfirmDialog, SectionCard } from "@/components/common/misc"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { MAX_ADJUSTMENT_POINTS, MAX_AWARD_BACKDATE_DAYS, MIN_REASON_LENGTH, pointsApi } from "@/lib/api/business/points"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber, pluralize } from "@/lib/format"

const day = (d: Date) => format(d, "yyyy-MM-dd")

function makeSchema(today: string, oldest: string) {
  return z.object({
    audience: z
      .object({ audienceType: z.enum(["all", "departments", "teams", "selected"]), audienceIds: z.array(z.string()) })
      .refine((a) => a.audienceType === "all" || a.audienceIds.length > 0, "Choose who receives the points"),
    points: z
      .union([z.literal(""), z.number()])
      .refine((v) => v !== "" && Number.isInteger(v) && v >= 1 && v <= MAX_ADJUSTMENT_POINTS, `Enter a whole number from 1 to ${formatNumber(MAX_ADJUSTMENT_POINTS)}`),
    awardDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the award date")
      .refine((d) => d <= today, "The award date can't be in the future")
      .refine((d) => d >= oldest, `Choose a date in the last ${MAX_AWARD_BACKDATE_DAYS} days`),
    reason: z.string().trim().min(MIN_REASON_LENGTH, `Give a reason (at least ${MIN_REASON_LENGTH} characters)`).max(200, "Keep the reason under 200 characters"),
  })
}
type Values = z.infer<ReturnType<typeof makeSchema>>

/** #352 Bulk award points — employees, teams, departments or everyone, with points, reason and date. */
export function AwardPointsForm() {
  const router = useRouter()
  const [dates] = useState(() => ({ today: day(new Date()), oldest: day(subDays(new Date(), MAX_AWARD_BACKDATE_DAYS)) }))
  const [schema] = useState(() => makeSchema(dates.today, dates.oldest))
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { audience: { audienceType: "all", audienceIds: [] }, points: "", awardDate: dates.today, reason: "" },
  })
  const { field: audienceField, fieldState: audienceState } = useController({ control: form.control, name: "audience" })
  const [points, awardDate, reason] = useWatch({ control: form.control, name: ["points", "awardDate", "reason"] })
  const [confirm, setConfirm] = useState<Values | null>(null)

  const each = typeof points === "number" && Number.isInteger(points) && points > 0 ? points : 0
  const previewInput = { ...audienceField.value, points: each }
  const preview = useApiQuery(["business", "points", "bulk-preview", previewInput], () => pointsApi.bulkPreview(previewInput), { placeholderData: (p) => p })

  const award = useApiMutation(pointsApi.bulkAward, {
    errorTitle: "Couldn't award the points",
    success: (r) => `${pluralize(r.recipients, "employee")} received ${formatNumber(r.award.pointsEach)} points – ${formatNumber(r.totalPoints)} in total.`,
    onSuccess: () => router.push("/business-portal/points"),
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
    },
  })

  const p = preview.data
  const ready = !!p && p.recipients > 0 && each > 0

  return (
    <form noValidate onSubmit={form.handleSubmit((v) => setConfirm(v))} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        <SectionCard title="Recipients" description="Everyone, whole departments or teams, or specific people. Only people who use the app receive points.">
          <AudienceField
            value={audienceField.value}
            onChange={(v) => {
              audienceField.onChange(v)
              form.clearErrors("audience")
            }}
            error={audienceState.error?.message ?? (audienceState.error as { root?: { message?: string } } | undefined)?.root?.message}
            label="Who receives the points"
            estimateLabel="people"
          />
        </SectionCard>

        <SectionCard title="Award" description="Everyone in the group gets the same number of points.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="points" label="Points per person" type="number" placeholder="e.g. 50" suffix="pts" required description={`1 to ${formatNumber(MAX_ADJUSTMENT_POINTS)} points.`} />
            <TextField control={form.control} name="awardDate" label="Award date" type="date" required description={`Today or up to ${MAX_AWARD_BACKDATE_DAYS} days back.`} />
            <TextareaField
              control={form.control}
              name="reason"
              label="Reason"
              placeholder="e.g. Thank you for joining the Diwali Wellness Walk!"
              description="Employees see this with the points in their wallet and notification."
              rows={3}
              maxLength={200}
              required
              className="sm:col-span-2"
            />
          </div>
        </SectionCard>
      </div>

      <aside className="min-w-0">
        <div className="flex flex-col gap-4 lg:sticky lg:top-20">
          <SectionCard title="Summary">
            <div className="flex flex-col gap-4">
              {preview.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <div className={preview.isFetching ? "space-y-1 opacity-70 transition-opacity" : "space-y-1 transition-opacity"}>
                  <p className="flex items-baseline gap-1.5">
                    <Coins className="size-5 shrink-0 self-center text-amber-500" />
                    <span className="font-heading text-3xl font-bold tracking-tight tabular-nums">{formatNumber(p?.totalPoints ?? 0)}</span>
                    <span className="text-sm text-muted-foreground">points in total</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{pluralize(p?.recipients ?? 0, "employee")}</span> will receive{" "}
                    <span className="font-semibold text-foreground">{each ? `${formatNumber(each)} points` : "— points"}</span>
                    {p && each ? ` = ${formatNumber(p.totalPoints)} points.` : "."}
                  </p>
                </div>
              )}
              <dl className="grid gap-2 border-t pt-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Recipients</dt>
                  <dd className="truncate text-right font-medium">{p?.label ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Award date</dt>
                  <dd className="font-medium">{/^\d{4}-\d{2}-\d{2}$/.test(awardDate ?? "") ? formatDate(awardDate) : "—"}</dd>
                </div>
                {reason?.trim() ? (
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Reason</dt>
                    <dd className="line-clamp-3 text-sm break-words">{reason.trim()}</dd>
                  </div>
                ) : null}
              </dl>
              {p && p.skipped > 0 ? (
                <p className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  <Users className="mt-0.5 size-3.5 shrink-0" />
                  {pluralize(p.skipped, "person", "people")} in this group {p.skipped === 1 ? "doesn't" : "don't"} use the app yet and won&apos;t receive points.
                </p>
              ) : null}
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" /> Recipients are notified, the points appear in their wallet and the award is recorded in the audit log. Points never expire.
              </p>
              <div className="flex flex-col gap-2">
                <Button type="submit" className="h-9 w-full" disabled={award.isPending || (!!p && p.recipients === 0)}>
                  {award.isPending ? <Spinner /> : <Award data-icon="inline-start" />}
                  Award points
                </Button>
                <Button asChild type="button" variant="ghost" className="w-full">
                  <Link href="/business-portal/points">Cancel</Link>
                </Button>
              </div>
            </div>
          </SectionCard>
        </div>
      </aside>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={ready ? `Award ${formatNumber(p.totalPoints)} points to ${pluralize(p.recipients, "employee")}?` : "Award points?"}
        description={
          ready ? (
            <>
              {formatNumber(each)} points each for &ldquo;{confirm?.reason.trim()}&rdquo;. Points can&apos;t be taken back in bulk — you&apos;d have to deduct them one person at a time.
            </>
          ) : (
            "Check the recipients and points first."
          )
        }
        confirmLabel="Award points"
        onConfirm={() => {
          if (confirm) award.mutate({ ...confirm.audience, points: confirm.points === "" ? 0 : confirm.points, reason: confirm.reason, awardDate: confirm.awardDate })
          setConfirm(null)
        }}
      />
    </form>
  )
}
