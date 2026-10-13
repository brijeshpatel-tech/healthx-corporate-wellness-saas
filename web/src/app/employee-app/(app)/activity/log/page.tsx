"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, Ban, CheckCircle2, Info } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { TextareaField, TextField } from "@/components/common/form-fields"
import { EmptyState, ErrorState } from "@/components/common/states"
import { ACTIVITY_META } from "@/components/employee/track/activity-meta"
import { ReviewNote } from "@/components/employee/track/review-badge"
import { TrackHeader, TrackPage, addDays, localDate } from "@/components/employee/track/track-ui"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { activityApi, type ManualActivityInput } from "@/lib/api/employee/activity"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import type { ActivitySession, ActivityType } from "@/lib/types"
import { cn } from "@/lib/utils"

const TYPES = ["walking", "running", "cycling", "swimming", "yoga", "meditation", "strength"] as const satisfies readonly ActivityType[]
type LoggableType = (typeof TYPES)[number]
const asLoggable = (t: ActivityType): LoggableType => ((TYPES as readonly ActivityType[]).includes(t) ? (t as LoggableType) : "walking")

const schema = z
  .object({
    type: z.enum(TYPES, { message: "Choose an activity type" }),
    date: z.string().min(1, "Choose a date"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Choose a start time"),
    durationMin: z.number({ message: "Enter a duration" }).int("Use whole minutes").min(1, "Enter a duration between 1 and 600 minutes").max(600, "Enter a duration between 1 and 600 minutes"),
    distanceKm: z.union([z.number().min(0.1, "Enter a distance between 0.1 and 300 km").max(300, "Enter a distance between 0.1 and 300 km"), z.literal("")]).optional(),
    notes: z.string().max(200, "Keep notes under 200 characters").optional(),
  })
  .superRefine((v, ctx) => {
    const today = localDate()
    if (v.date > today) ctx.addIssue({ code: "custom", path: ["date"], message: "Date can't be in the future" })
    else if (v.date < addDays(today, -7)) ctx.addIssue({ code: "custom", path: ["date"], message: "You can log activities from the last 7 days" })
    else if (v.date === today && v.startTime) {
      const now = new Date()
      const [h, m] = v.startTime.split(":").map(Number) as [number, number]
      if (h * 60 + m > now.getHours() * 60 + now.getMinutes()) ctx.addIssue({ code: "custom", path: ["startTime"], message: "Start time can't be in the future" })
    }
  })
type Values = z.infer<typeof schema>

function nowHM(offsetMin = 0) {
  const d = new Date(Date.now() - offsetMin * 60_000)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

/** SCR-M-024 Log Activity (manual entry). Also edits a manual entry (?id=). */
function LogActivity() {
  const params = useSearchParams()
  const id = params.get("id")
  const settings = useApiQuery(["employee", "activity", "summary", localDate()], () => activityApi.summary({ date: localDate() }))
  const existing = useApiQuery(["employee", "activity", "item", id], () => activityApi.get({ id: id! }), { enabled: !!id })

  if (settings.error) return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />
  if (!settings.data || (id && !existing.data && !existing.error)) return <Skeleton className="h-[520px] rounded-xl" />
  if (existing.error) return <ErrorState error={existing.error} onRetry={() => existing.refetch()} />
  if (!settings.data.manual.allowed)
    return (
      <EmptyState
        icon={Ban}
        title="Manual entries are turned off"
        description="Your company only counts activity synced from Apple Health or Health Connect."
        action={
          <Button asChild>
            <Link href="/employee-app/activity">Back to activity</Link>
          </Button>
        }
      />
    )
  if (existing.data?.review?.status === "approved")
    return (
      <EmptyState
        icon={CheckCircle2}
        title="This entry has been approved"
        description="Approved entries are locked. Ask your HR team if something needs correcting."
        action={
          <Button asChild>
            <Link href="/employee-app/activity/history">Back to history</Link>
          </Button>
        }
      />
    )
  return (
    <>
      {existing.data?.review?.status === "rejected" ? <ReviewNote review={existing.data.review} /> : null}
      <LogForm earnsPoints={settings.data.manual.earnsPoints} existing={existing.data} />
    </>
  )
}

function LogForm({ earnsPoints, existing }: { earnsPoints: boolean; existing?: ActivitySession }) {
  const router = useRouter()
  const [overlap, setOverlap] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? {
          type: asLoggable(existing.type),
          date: localDate(new Date(existing.startedAt)),
          startTime: nowHMFrom(existing.startedAt),
          durationMin: existing.durationMin,
          distanceKm: existing.distanceKm ?? "",
          notes: existing.notes ?? "",
        }
      : { type: "walking", date: localDate(), startTime: nowHM(30), durationMin: 30, distanceKm: "", notes: "" },
  })
  const type = useWatch({ control: form.control, name: "type" })
  const duration = useWatch({ control: form.control, name: "durationMin" })
  const meta = ACTIVITY_META[type]

  const onError = (e: ApiError) => {
    if (e.code === "activity_overlap") setOverlap(e.message)
    if (e.fieldErrors) for (const [k, v] of Object.entries(e.fieldErrors)) form.setError(k as keyof Values, { message: v })
  }
  const create = useApiMutation(activityApi.create, {
    onSuccess: (r) => {
      toast.success("Activity saved", { description: r.review.points ? `Sent to HR for approval — +${r.review.points} points once approved.` : "Sent to HR for approval." })
      router.push("/employee-app/activity")
    },
    onError,
  })
  const update = useApiMutation(activityApi.update, {
    success: "Activity updated",
    onSuccess: () => router.push("/employee-app/activity/history"),
    onError,
  })
  const pending = create.isPending || update.isPending

  const submit = (allowOverlap: boolean) =>
    form.handleSubmit((v) => {
      setOverlap(null)
      const input: ManualActivityInput = {
        type: v.type,
        date: v.date,
        startTime: v.startTime,
        durationMin: v.durationMin,
        distanceKm: ACTIVITY_META[v.type].hasDistance && v.distanceKm !== "" && v.distanceKm !== undefined ? v.distanceKm : null,
        notes: v.notes,
        allowOverlap,
      }
      if (existing) update.mutate({ ...input, id: existing.id })
      else create.mutate(input)
    })

  return (
    <form onSubmit={submit(false)} className="flex flex-col gap-5" noValidate>
      <Card className="gap-0 py-0">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <p className="text-sm font-semibold">Activity type</p>
          <div className="grid grid-cols-4 gap-2">
            {TYPES.map((t) => {
              const m = ACTIVITY_META[t]
              const active = type === t
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={active}
                  onClick={() => form.setValue("type", t, { shouldValidate: true })}
                  className={cn(
                    "flex min-h-20 min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border bg-card p-1.5 text-[11px] font-medium transition-all hover:border-primary/40 sm:text-xs",
                    active && "border-primary bg-primary/8 ring-1 ring-primary/30",
                  )}
                >
                  <span className="text-2xl leading-none">{m.emoji}</span>
                  {m.label}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="date" label="Date" type="date" required />
            <TextField control={form.control} name="startTime" label="Start time" type="time" required />
          </div>
          <div className="space-y-2">
            <TextField control={form.control} name="durationMin" label="Duration" type="number" suffix="min" required />
            <div className="flex flex-wrap gap-2">
              {[10, 20, 30, 45, 60, 90].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => form.setValue("durationMin", m, { shouldValidate: true })}
                  className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40", duration === m && "border-primary bg-primary/10 text-primary")}
                >
                  {m} min
                </button>
              ))}
            </div>
          </div>
          {meta.hasDistance ? <TextField control={form.control} name="distanceKm" label="Distance (optional)" type="number" suffix="km" placeholder="e.g. 3.5" /> : null}
          <TextareaField control={form.control} name="notes" label="Notes (optional)" rows={2} maxLength={200} placeholder="e.g. Evening swim at the club" />
        </CardContent>
      </Card>

      <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-200">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          This entry will be labelled <strong>Manual</strong> and shows <strong>Pending approval</strong> until your HR team reviews it.{" "}
          {earnsPoints ? "Any points are added only after it's approved." : "At your company, manual entries count towards your totals but don't earn points."}
        </p>
      </div>

      {overlap ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>{overlap}</AlertTitle>
          <AlertDescription>
            <p>Check the time, or save it anyway if both happened.</p>
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => submit(true)()} disabled={pending}>
              Save anyway
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="sticky bottom-20 z-10 flex gap-2 rounded-2xl border bg-background/90 p-2 shadow-lg backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <Button type="button" variant="outline" className="h-11 flex-1 md:flex-none" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" className="h-11 flex-1 md:min-w-40 md:flex-none" disabled={pending}>
          {pending ? <Spinner /> : null}
          {existing ? "Save changes" : "Save activity"}
        </Button>
      </div>
    </form>
  )
}

function nowHMFrom(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export default function LogActivityPage() {
  return (
    <TrackPage narrow>
      <Suspense>
        <Header />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-[520px] rounded-xl" />}>
        <LogActivity />
      </Suspense>
    </TrackPage>
  )
}

function Header() {
  const id = useSearchParams().get("id")
  return (
    <TrackHeader
      title={id ? "Edit activity" : "Log activity"}
      subtitle={id ? "Update a manual entry" : "Add something your phone or wearable didn't capture"}
      backHref={id ? "/employee-app/activity/history" : "/employee-app/activity"}
      backLabel={id ? "History" : "Activity"}
    />
  )
}
