"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarClock, Check, Save, Send } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useController, useForm, useWatch, type Control } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { AudienceField } from "@/components/business/engagement/audience-field"
import { FieldShell, SwitchField, TextField, TextareaField } from "@/components/common/form-fields"
import { ConfirmDialog, SectionCard } from "@/components/common/misc"
import { PhaseBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ANNOUNCEMENT_LIMITS, announcementsApi, type AnnouncementDetail, type AnnouncementInput } from "@/lib/api/business/announcements"
import { audienceApi } from "@/lib/api/business/challenges"
import { ApiError } from "@/lib/api/core"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { useSession } from "@/lib/auth/session"
import { formatNumber } from "@/lib/format"
import type { AnnouncementType, Channel } from "@/lib/types"
import { cn } from "@/lib/utils"
import { COMPOSER_CHANNELS, COMPOSER_TYPES, CHANNEL_META, TYPE_META, formatSchedule, nextAt, toLocalInput } from "./announcement-meta"
import { AnnouncementPreview } from "./announcement-preview"

const schema = z
  .object({
    title: z.string().trim().min(1, "Enter a title").max(ANNOUNCEMENT_LIMITS.title, `Keep the title under ${ANNOUNCEMENT_LIMITS.title} characters`),
    body: z.string().trim().min(1, "Write a message").max(ANNOUNCEMENT_LIMITS.body, "Keep the message under 1,000 characters"),
    type: z.enum(["general", "wellness_tip", "challenge", "reward", "event"]),
    channels: z.array(z.enum(["push", "in_app", "email"])).min(1, "Choose push, in-app or both"),
    audienceType: z.enum(["all", "departments", "teams", "selected"]),
    audienceIds: z.array(z.string()),
    linkLabel: z.string().trim().max(ANNOUNCEMENT_LIMITS.linkLabel, `Keep the label under ${ANNOUNCEMENT_LIMITS.linkLabel} characters`),
    linkHref: z.string().trim().max(ANNOUNCEMENT_LIMITS.linkHref, "That link is too long"),
    pinned: z.boolean(),
    sendOption: z.enum(["now", "schedule"]),
    scheduledAt: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.audienceType !== "all" && v.audienceIds.length === 0) {
      const what = v.audienceType === "departments" ? "department" : v.audienceType === "teams" ? "team" : "employee"
      ctx.addIssue({ code: "custom", path: ["audienceIds"], message: `Choose at least one ${what}` })
    }
    if (v.linkHref && !v.linkLabel) ctx.addIssue({ code: "custom", path: ["linkLabel"], message: "Add a button label" })
    if (v.linkLabel && !v.linkHref) ctx.addIssue({ code: "custom", path: ["linkHref"], message: "Add a link" })
    if (v.linkHref && !/^\/\S*$/.test(v.linkHref) && !/^https?:\/\/[^\s.]+\.\S+$/i.test(v.linkHref))
      ctx.addIssue({ code: "custom", path: ["linkHref"], message: "Use a web address (https://…) or an app path (/employee-app/…)" })
  })

export type AnnouncementFormValues = z.infer<typeof schema>

const FIELD_MAP: Record<string, keyof AnnouncementFormValues> = { "link.label": "linkLabel", "link.href": "linkHref" }

export function emptyAnnouncementValues(): AnnouncementFormValues {
  return {
    title: "",
    body: "",
    type: "general",
    channels: ["push", "in_app"],
    audienceType: "all",
    audienceIds: [],
    linkLabel: "",
    linkHref: "",
    pinned: false,
    sendOption: "now",
    scheduledAt: toLocalInput(nextAt(9)),
  }
}

export function valuesFromAnnouncement(a: AnnouncementDetail): AnnouncementFormValues {
  return {
    title: a.title,
    body: a.body,
    type: a.type,
    channels: a.channels,
    audienceType: a.audienceType,
    audienceIds: a.audienceIds,
    linkLabel: a.link?.label ?? "",
    linkHref: a.link?.href ?? "",
    pinned: a.pinned,
    sendOption: a.status === "scheduled" ? "schedule" : "now",
    scheduledAt: a.scheduledAt ? toLocalInput(new Date(a.scheduledAt)) : toLocalInput(nextAt(9)),
  }
}

type Delivery = AnnouncementInput["delivery"]

/** SCR-B-022 Create / Edit Announcement. */
export function AnnouncementForm({
  initial,
  announcementId,
  notice,
}: {
  initial: AnnouncementFormValues
  /** Set when editing an existing draft / scheduled announcement. */
  announcementId?: string
  /** Shown above the form, e.g. "Pre-filled from a challenge". */
  notice?: React.ReactNode
}) {
  const router = useRouter()
  const session = useSession("business")
  const form = useForm<AnnouncementFormValues>({ resolver: zodResolver(schema), defaultValues: initial })
  const [confirmSend, setConfirmSend] = useState<AnnouncementFormValues | null>(null)
  const [lastDelivery, setLastDelivery] = useState<Delivery>("draft")

  const v = useWatch({ control: form.control })
  const audience = { audienceType: v.audienceType ?? "all", audienceIds: v.audienceIds ?? [] }
  const estimate = useApiQuery(["business", "audience", "estimate", audience], () => audienceApi.estimate(audience), { placeholderData: (p) => p })

  const save = useApiMutation((input: AnnouncementInput) => (announcementId ? announcementsApi.update({ ...input, id: announcementId }) : announcementsApi.create(input)), {
    onSuccess: (a, input) => {
      if (input.delivery === "now") {
        toast.success(`Announcement sent to ${formatNumber(a.stats.recipients)} employees.`)
        router.push(`/business-portal/announcements/${a.id}`)
      } else if (input.delivery === "schedule") {
        toast.success(`Scheduled for ${formatSchedule(a.scheduledAt)}.`)
        router.push("/business-portal/announcements")
      } else {
        toast.success("Draft saved")
        router.push("/business-portal/announcements")
      }
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) {
        Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(FIELD_MAP[k] ?? (k as keyof AnnouncementFormValues), { message }, { shouldFocus: true }))
      }
    },
  })

  const toInput = (values: AnnouncementFormValues, delivery: Delivery): AnnouncementInput => ({
    title: values.title,
    body: values.body,
    type: values.type,
    channels: values.channels,
    audienceType: values.audienceType,
    audienceIds: values.audienceType === "all" ? [] : values.audienceIds,
    link: values.linkLabel && values.linkHref ? { label: values.linkLabel, href: values.linkHref } : null,
    pinned: values.pinned,
    delivery,
    scheduledAt: delivery === "schedule" ? new Date(values.scheduledAt).toISOString() : undefined,
  })

  const submit = (delivery: Delivery) => {
    setLastDelivery(delivery)
    return form.handleSubmit((values) => {
      if (delivery === "schedule") {
        const at = values.scheduledAt ? new Date(values.scheduledAt).getTime() : Number.NaN
        if (Number.isNaN(at)) return form.setError("scheduledAt", { message: "Choose a date and time" }, { shouldFocus: true })
        if (at <= Date.now() + 60_000) return form.setError("scheduledAt", { message: "Choose a time in the future" }, { shouldFocus: true })
      }
      if (delivery === "now") return setConfirmSend(values)
      save.mutate(toInput(values, delivery))
    })()
  }

  const sendOption = v.sendOption ?? "now"
  const reach = estimate.data?.joined
  const pendingFor = (d: Delivery) => save.isPending && lastDelivery === d

  return (
    <>
      <form
        className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]"
        onSubmit={(e) => {
          e.preventDefault()
          void submit(sendOption === "schedule" ? "schedule" : "now")
        }}
        noValidate
      >
        <div className="flex min-w-0 flex-col gap-6">
          {notice}
          <SectionCard title="Message" description="Short and friendly works best — say what's happening and what to do next.">
            <div className="flex flex-col gap-5">
              <TypePicker control={form.control} />
              <TextField
                control={form.control}
                name="title"
                label="Title"
                required
                placeholder="e.g. Our October Step Challenge starts Monday"
                description={<Counter text="Used as the push notification title." length={v.title?.length ?? 0} max={ANNOUNCEMENT_LIMITS.title} />}
              />
              <TextareaField
                control={form.control}
                name="body"
                label="Message"
                required
                rows={6}
                maxLength={ANNOUNCEMENT_LIMITS.body}
                placeholder="Tell employees what's happening, why it matters and what they should do."
                description="Line breaks are kept in the app."
              />
              <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <TextField control={form.control} name="linkLabel" label="Button label" placeholder="e.g. View challenge" description="Optional call to action." />
                <TextField control={form.control} name="linkHref" label="Button link" placeholder="https://… or /employee-app/challenges" description="A web address or an Employee App path." />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Audience"
            description={
              <>
                Everyone, departments or teams. Only people who use the HealthX app receive it.{" "}
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  Selected people <PhaseBadge phase={2} />
                </span>
              </>
            }
          >
            <AudienceControl control={form.control} />
          </SectionCard>

          <SectionCard title="Delivery">
            <div className="flex flex-col gap-5">
              <ChannelsField control={form.control} />
              <SwitchField control={form.control} name="pinned" label="Pin to the top" description="Pinned announcements stay at the top of the list in the app and here." />
              <SendOptionField control={form.control} />
            </div>
          </SectionCard>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
          <AnnouncementPreview
            title={v.title ?? ""}
            body={v.body ?? ""}
            type={(v.type ?? "general") as AnnouncementType}
            channels={(v.channels ?? []) as Channel[]}
            link={{ label: v.linkLabel, href: v.linkHref }}
            pinned={v.pinned}
            companyName={session?.companyName}
            timeLabel={sendOption === "schedule" && v.scheduledAt ? formatSchedule(v.scheduledAt) : "now"}
          />
          <Card className="gap-0 py-0">
            <CardContent className="space-y-2 p-4 text-sm">
              <p className="font-medium">Summary</p>
              <SummaryRow label="Reaches">
                {reach === undefined ? "Estimating…" : <span className="font-semibold tabular-nums">{formatNumber(reach)} people</span>}
                {estimate.data && estimate.data.total > estimate.data.joined ? <span className="text-muted-foreground"> · {formatNumber(estimate.data.total - estimate.data.joined)} not on the app yet</span> : null}
              </SummaryRow>
              <SummaryRow label="Channels">{(v.channels ?? []).length ? (v.channels ?? []).map((c) => CHANNEL_META[c as Channel].label).join(", ") : <span className="text-destructive">None</span>}</SummaryRow>
              <SummaryRow label="When">{sendOption === "schedule" ? (v.scheduledAt ? formatSchedule(v.scheduledAt) : "—") : "As soon as you send"}</SummaryRow>
            </CardContent>
          </Card>
        </aside>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:-mx-6 sm:px-6 lg:col-span-2 lg:-mx-8 lg:px-8">
          <Button asChild variant="ghost" className="mr-auto">
            <Link href={announcementId ? `/business-portal/announcements/${announcementId}` : "/business-portal/announcements"}>Cancel</Link>
          </Button>
          <Button type="button" variant="outline" disabled={save.isPending} onClick={() => void submit("draft")}>
            {pendingFor("draft") ? <Spinner /> : <Save data-icon="inline-start" />}
            Save draft
          </Button>
          {sendOption === "schedule" ? (
            <Button type="submit" disabled={save.isPending}>
              {pendingFor("schedule") ? <Spinner /> : <CalendarClock data-icon="inline-start" />}
              Schedule
            </Button>
          ) : (
            <Button type="submit" disabled={save.isPending}>
              {pendingFor("now") ? <Spinner /> : <Send data-icon="inline-start" />}
              Send now
            </Button>
          )}
        </div>
      </form>

      <ConfirmDialog
        open={!!confirmSend}
        onOpenChange={(o) => !o && setConfirmSend(null)}
        title={reach !== undefined ? `Send to ${formatNumber(reach)} ${reach === 1 ? "person" : "people"} now?` : "Send this announcement now?"}
        description="It's delivered straight away by the channels you chose. Sent announcements can't be edited — you can duplicate them instead."
        confirmLabel="Send now"
        onConfirm={() => {
          if (confirmSend) save.mutate(toInput(confirmSend, "now"))
          setConfirmSend(null)
        }}
      />
    </>
  )
}

function Counter({ text, length, max }: { text: string; length: number; max: number }) {
  return (
    <span className="flex justify-between gap-2">
      <span>{text}</span>
      <span className={cn("tabular-nums", length > max && "font-medium text-destructive")}>
        {length}/{max}
      </span>
    </span>
  )
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-xs">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  )
}

function TypePicker({ control }: { control: Control<AnnouncementFormValues> }) {
  const { field } = useController({ control, name: "type" })
  return (
    <FieldShell label="Type" description="Employees can filter announcements by type in the app.">
      <div role="radiogroup" aria-label="Announcement type" className="flex flex-wrap gap-2">
        {(field.value === "event" ? [...COMPOSER_TYPES, "event" as const] : COMPOSER_TYPES).map((t) => {
          const meta = TYPE_META[t]
          const active = field.value === t
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => field.onChange(t)}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                active && "border-primary bg-primary/5 text-primary ring-1 ring-primary/30",
              )}
            >
              <meta.icon className="size-4" />
              {meta.label}
            </button>
          )
        })}
      </div>
    </FieldShell>
  )
}

function AudienceControl({ control }: { control: Control<AnnouncementFormValues> }) {
  const type = useController({ control, name: "audienceType" })
  const ids = useController({ control, name: "audienceIds" })
  return (
    <AudienceField
      label="Send to"
      estimateLabel="in audience"
      value={{ audienceType: type.field.value, audienceIds: ids.field.value }}
      onChange={(a) => {
        type.field.onChange(a.audienceType)
        ids.field.onChange(a.audienceIds)
      }}
      error={ids.fieldState.error?.message}
    />
  )
}

function ChannelsField({ control }: { control: Control<AnnouncementFormValues> }) {
  const { field, fieldState } = useController({ control, name: "channels" })
  const value = (field.value ?? []) as Channel[]
  const options: Channel[] = value.includes("email") ? [...COMPOSER_CHANNELS, "email"] : COMPOSER_CHANNELS
  const toggle = (c: Channel) => field.onChange(value.includes(c) ? value.filter((x) => x !== c) : options.filter((x) => x === c || value.includes(x)))
  return (
    <FieldShell label="Channels" required error={fieldState.error?.message} description="Both respect each employee's notification settings.">
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((c) => {
          const meta = CHANNEL_META[c]
          const on = value.includes(c)
          const id = `ch-${c}`
          return (
            <label
              key={c}
              htmlFor={id}
              className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50", on && "border-primary bg-primary/5 ring-1 ring-primary/30")}
            >
              <Checkbox id={id} checked={on} onCheckedChange={() => toggle(c)} className="mt-0.5" aria-invalid={!!fieldState.error} />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <meta.icon className="size-4 text-muted-foreground" /> {meta.label}
                </span>
                <span className="block text-xs text-muted-foreground">{meta.description}</span>
              </span>
            </label>
          )
        })}
      </div>
    </FieldShell>
  )
}

function SendOptionField({ control }: { control: Control<AnnouncementFormValues> }) {
  const option = useController({ control, name: "sendOption" })
  const at = useController({ control, name: "scheduledAt" })
  const presets = [
    { label: "Tomorrow, 09:00", date: nextAt(9, (new Date().getDay() + 1) % 7) },
    { label: "Monday, 09:00", date: nextAt(9, 1) },
    { label: "Friday, 16:00", date: nextAt(16, 5) },
  ]
  const choices = [
    { value: "now", label: "Send now", description: "Delivered as soon as you send.", icon: Send },
    { value: "schedule", label: "Schedule", description: "Pick a date and time.", icon: CalendarClock },
  ] as const
  return (
    <div className="flex flex-col gap-3">
      <FieldShell label="When to send">
        <div role="radiogroup" aria-label="When to send" className="grid gap-2 sm:grid-cols-2">
          {choices.map((c) => {
            const active = option.field.value === c.value
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => option.field.onChange(c.value)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                  active && "border-primary bg-primary/5 ring-1 ring-primary/30",
                )}
              >
                <c.icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{c.label}</span>
                  <span className="block text-xs text-muted-foreground">{c.description}</span>
                </span>
                {active ? <Check className="size-4 text-primary" /> : null}
              </button>
            )
          })}
        </div>
      </FieldShell>
      {option.field.value === "schedule" ? (
        <FieldShell id="f-scheduledAt" label="Date and time" required error={at.fieldState.error?.message} description="Your local time. We deliver it automatically.">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              id="f-scheduledAt"
              type="datetime-local"
              className="h-9 sm:w-60"
              min={toLocalInput(new Date())}
              aria-invalid={!!at.fieldState.error}
              {...at.field}
            />
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <Button key={p.label} type="button" size="sm" variant="outline" onClick={() => at.field.onChange(toLocalInput(p.date))}>
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        </FieldShell>
      ) : null}
    </div>
  )
}

export { PrefillNotice } from "./prefill-notice"
