"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { BedDouble, Moon, Sunrise, Trash2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { TextField } from "@/components/common/form-fields"
import { ConfirmDialog } from "@/components/common/misc"
import { ErrorState } from "@/components/common/states"
import { TrackHeader, TrackPage, addDays, formatHM, localDate } from "@/components/employee/track/track-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { sleepApi } from "@/lib/api/employee/sleep"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { cn } from "@/lib/utils"

const QUALITY = [
  { value: 1, emoji: "😫", label: "Awful" },
  { value: 2, emoji: "😕", label: "Poor" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😴", label: "Great" },
] as const

/** Minutes between bedtime and wake-up (crossing midnight). */
function durationOf(bed: string, wake: string) {
  if (!/^\d{2}:\d{2}$/.test(bed) || !/^\d{2}:\d{2}$/.test(wake)) return null
  const [bh, bm] = bed.split(":").map(Number) as [number, number]
  const [wh, wm] = wake.split(":").map(Number) as [number, number]
  let d = wh * 60 + wm - (bh * 60 + bm)
  if (d <= 0) d += 24 * 60
  return d
}

const schema = z
  .object({
    nightOf: z.string().min(1, "Choose the night"),
    bedtime: z.string().regex(/^\d{2}:\d{2}$/, "Enter your bedtime"),
    wakeTime: z.string().regex(/^\d{2}:\d{2}$/, "Enter your wake-up time"),
    quality: z.number().int().min(1, "Rate your sleep").max(5),
  })
  .superRefine((v, ctx) => {
    if (v.nightOf > localDate()) ctx.addIssue({ code: "custom", path: ["nightOf"], message: "Choose last night or earlier" })
    else if (v.nightOf < addDays(localDate(), -30)) ctx.addIssue({ code: "custom", path: ["nightOf"], message: "You can log sleep from the last 30 nights" })
    const d = durationOf(v.bedtime, v.wakeTime)
    if (d !== null && (d < 60 || d > 16 * 60)) ctx.addIssue({ code: "custom", path: ["wakeTime"], message: "Wake-up time must be after bedtime (1–16 hours of sleep)" })
  })
type Values = z.infer<typeof schema>

/** SCR-M-028 Log Sleep (Phase 2). Also edits / deletes a manual record (?id=). */
function LogSleep() {
  const params = useSearchParams()
  const id = params.get("id")
  const existing = useApiQuery(["employee", "sleep", "item", id], () => sleepApi.get({ id: id! }), { enabled: !!id })
  if (id && existing.error) return <ErrorState error={existing.error} onRetry={() => existing.refetch()} />
  if (id && !existing.data) return <Skeleton className="h-[480px] rounded-xl" />
  const time = (iso: string) => {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  }
  const defaults: Values = existing.data
    ? { nightOf: existing.data.nightOf, bedtime: time(existing.data.bedtime), wakeTime: time(existing.data.wakeTime), quality: existing.data.quality }
    : { nightOf: params.get("night") ?? addDays(localDate(), -1), bedtime: "23:00", wakeTime: "07:00", quality: 4 }
  return <SleepForm id={id} defaults={defaults} />
}

function SleepForm({ id, defaults }: { id: string | null; defaults: Values }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults })
  const [bed, wake, quality] = useWatch({ control: form.control, name: ["bedtime", "wakeTime", "quality"] })
  const duration = durationOf(bed, wake)

  const onError = (e: { fieldErrors?: Record<string, string> }) => {
    if (e.fieldErrors) for (const [k, v] of Object.entries(e.fieldErrors)) form.setError(k as keyof Values, { message: v })
  }
  const create = useApiMutation(sleepApi.create, { success: (r) => `Sleep saved: ${formatHM(r.durationMin)}`, onSuccess: () => router.push("/employee-app/sleep"), onError })
  const update = useApiMutation(sleepApi.update, { success: (r) => `Sleep updated: ${formatHM(r.durationMin)}`, onSuccess: () => router.push("/employee-app/sleep"), onError })
  const remove = useApiMutation(sleepApi.remove, { success: "Sleep record deleted", onSuccess: () => router.push("/employee-app/sleep") })
  const pending = create.isPending || update.isPending

  const onSubmit = form.handleSubmit((v) => {
    const input = { nightOf: v.nightOf, bedtime: v.bedtime, wakeTime: v.wakeTime, quality: v.quality as 1 | 2 | 3 | 4 | 5 }
    if (id) update.mutate({ ...input, id })
    else create.mutate(input)
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-col items-center gap-1 bg-gradient-to-br from-indigo-600 to-violet-700 px-5 py-6 text-white">
          <Moon className="size-6 text-white/85" />
          <p className="font-heading text-4xl font-extrabold tabular-nums" aria-live="polite">
            {duration ? formatHM(duration) : "—"}
          </p>
          <p className="text-sm text-white/80">{duration && duration >= 7 * 60 ? "Nice — that's a healthy night's sleep" : "Calculated sleep duration"}</p>
        </div>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <TextField control={form.control} name="nightOf" label="Night of" type="date" required description="The evening you went to bed" />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <BedDouble className="size-3.5" /> Bedtime
              </p>
              <TextField control={form.control} name="bedtime" type="time" />
            </div>
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sunrise className="size-3.5" /> Wake-up
              </p>
              <TextField control={form.control} name="wakeTime" type="time" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">How did you sleep?</p>
            <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Sleep quality">
              {QUALITY.map((q) => (
                <button
                  key={q.value}
                  type="button"
                  role="radio"
                  aria-checked={quality === q.value}
                  onClick={() => form.setValue("quality", q.value, { shouldValidate: true })}
                  className={cn("flex flex-col items-center gap-1 rounded-2xl border p-2 text-[11px] font-medium transition-all hover:border-primary/40", quality === q.value && "border-primary bg-primary/8 ring-1 ring-primary/30")}
                >
                  <span className="text-2xl leading-none">{q.emoji}</span>
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {id ? (
          <Button type="button" variant="destructive" className="h-11" onClick={() => setConfirm(true)} disabled={remove.isPending}>
            {remove.isPending ? <Spinner /> : <Trash2 data-icon="inline-start" />} Delete
          </Button>
        ) : null}
        <Button type="button" variant="outline" className="ml-auto h-11 flex-1 sm:flex-none" onClick={() => router.push("/employee-app/sleep")}>
          Cancel
        </Button>
        <Button type="submit" className="h-11 flex-1 sm:min-w-36 sm:flex-none" disabled={pending}>
          {pending ? <Spinner /> : null} Save
        </Button>
      </div>

      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Delete this night?" description="This sleep record will be removed from your history." confirmLabel="Delete" destructive onConfirm={() => id && remove.mutate({ id })} />
    </form>
  )
}

export default function LogSleepPage() {
  return (
    <TrackPage narrow>
      <Suspense>
        <Header />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-[480px] rounded-xl" />}>
        <LogSleep />
      </Suspense>
    </TrackPage>
  )
}

function Header() {
  const id = useSearchParams().get("id")
  return <TrackHeader title={id ? "Edit sleep" : "Log sleep"} phase={2} subtitle="Record when you went to bed and woke up" backHref="/employee-app/sleep" backLabel="Sleep" />
}
