"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { addDays, differenceInCalendarDays, parseISO } from "date-fns"
import { CalendarClock, Plus, Rocket, Save, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useController, useFieldArray, useForm, useWatch, type Control } from "react-hook-form"
import { z } from "zod"
import { AudienceField } from "@/components/business/engagement/audience-field"
import { CoverPicker } from "@/components/business/engagement/cover-picker"
import { PhoneFrame } from "@/components/business/engagement/phone-frame"
import { ChoiceField, FieldShell, TextareaField, TextField } from "@/components/common/form-fields"
import { SectionCard } from "@/components/common/misc"
import { PhaseBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { challengesApi, type ChallengeDetail, type ChallengeInput, type RewardOption } from "@/lib/api/business/challenges"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, pluralize } from "@/lib/format"
import type { ChallengeMetric, ChallengeTemplate } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatMetricValue, METRIC_META, metricUnit, TYPE_META } from "./challenge-meta"
import { ChallengePreview } from "./challenge-preview"
import { JourneySection, PLACE_META, PrizesSection, ScoringSection } from "./form-sections"
import { SetupChecklist, type ChecklistItem } from "./setup-checklist"

const TYPES = ["individual", "leaderboard", "team", "company", "collaborative"] as const
const METRICS = ["steps", "distance", "calories", "active_minutes", "workouts", "water", "meditation", "custom"] as const
const DEFAULT_RULES = ["Progress syncs automatically from your phone or wearable.", "Manual entries are reviewed and may not count."]
const RULE_SUGGESTIONS = [
  "Join any time before the end date — earlier progress still counts.",
  "Points are awarded within 24 hours of the challenge ending.",
  "Be honest with check-ins — this one is on trust!",
  "Ranking uses the average per active member, so group size doesn't matter.",
]

const todayStr = () => formatDate(new Date(), "yyyy-MM-dd")
const num = z.union([z.number(), z.literal("")])
const n = (v: number | "" | undefined) => (v === "" || v === undefined ? 0 : v)

function makeSchema() {
  const today = todayStr()
  return z
    .object({
      name: z.string().trim().min(3, "Name must be at least 3 characters").max(80, "Keep the name under 80 characters"),
      description: z.string().max(600, "Keep the description under 600 characters"),
      coverEmoji: z.string().min(1, "Choose an emoji"),
      coverColor: z.string().min(1),
      type: z.enum(TYPES),
      teamUnit: z.enum(["department", "team"]),
      metric: z.enum(METRICS),
      customMetricLabel: z.string().trim().max(40, "Keep it under 40 characters"),
      target: z.number({ error: "Enter a target" }).positive("Target must be greater than 0").max(100_000_000, "That target is too large"),
      startDate: z.string().min(1, "Choose a start date"),
      endDate: z.string().min(1, "Choose an end date"),
      useWarmup: z.boolean(),
      warmupStartDate: z.string(),
      audienceType: z.enum(["all", "departments", "teams", "selected"]),
      audienceIds: z.array(z.string()),
      points: z.number({ error: "Enter points (0 for none)" }).int("Use whole points").min(0, "Points can't be negative").max(10000, "Up to 10,000 points"),
      rewardId: z.string(),
      prizes: z.array(z.object({ place: z.union([z.literal(1), z.literal(2), z.literal(3)]), text: z.string().max(80, "Keep it under 80 characters"), rewardId: z.string(), points: num })),
      scoringMethod: z.enum(["total", "best_days", "bands"]),
      bestDays: num,
      ofDays: num,
      bands: z.array(z.object({ min: num, points: num })),
      useJourney: z.boolean(),
      journeyName: z.string(),
      journeyKm: num,
      milestones: z.array(z.object({ id: z.string(), name: z.string(), km: num, points: num })),
      rules: z.array(z.object({ value: z.string().max(200, "Keep each rule under 200 characters") })).max(12, "Up to 12 rules"),
    })
    .superRefine((v, ctx) => {
      const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message })
      if (v.metric === "custom" && !v.customMetricLabel.trim()) issue(["customMetricLabel"], "Name what people check in for")
      if (v.startDate && v.startDate < today) issue(["startDate"], "Start date can't be in the past")
      if (v.startDate && v.endDate && v.endDate <= v.startDate) issue(["endDate"], "End date must be after start date.")
      else if (v.startDate && v.endDate && differenceInCalendarDays(parseISO(v.endDate), parseISO(v.startDate)) > 365) issue(["endDate"], "Challenges can run for up to a year")
      if (v.useWarmup) {
        if (!v.warmupStartDate) issue(["warmupStartDate"], "Choose when the warm-up starts")
        else if (v.startDate && v.warmupStartDate >= v.startDate) issue(["warmupStartDate"], "Warm-up must start before scoring starts")
        else if (v.warmupStartDate < today) issue(["warmupStartDate"], "Warm-up can't start in the past")
        else if (v.startDate && differenceInCalendarDays(parseISO(v.startDate), parseISO(v.warmupStartDate)) > 14) issue(["warmupStartDate"], "Keep the warm-up to 14 days or less")
      }
      if (v.audienceType !== "all" && v.audienceIds.length === 0)
        issue(["audienceIds"], v.audienceType === "departments" ? "Choose at least one department" : v.audienceType === "teams" ? "Choose at least one team" : "Choose at least one employee")
      v.prizes.forEach((p, i) => {
        if (p.points !== "" && (p.points < 0 || p.points > 10000)) issue(["prizes", i, "points"], "0–10,000 points")
      })
      if (v.type !== "collaborative" && v.scoringMethod === "best_days") {
        const duration = v.startDate && v.endDate ? differenceInCalendarDays(parseISO(v.endDate), parseISO(v.startDate)) + 1 : 0
        if (!(n(v.bestDays) >= 1)) issue(["bestDays"], "At least 1 day")
        if (!(n(v.ofDays) > n(v.bestDays))) issue(["ofDays"], "Must be more than the best days")
        else if (duration && n(v.ofDays) > duration) issue(["ofDays"], "Longer than the challenge")
      }
      if (v.type !== "collaborative" && v.scoringMethod === "bands") {
        if (v.bands.length === 0) issue(["scoringMethod"], "Add at least one band")
        v.bands.forEach((b, i) => {
          if (!(n(b.min) > 0)) issue(["bands", i, "min"], "Above 0")
          if (!(n(b.points) > 0)) issue(["bands", i, "points"], "Above 0")
        })
        if (new Set(v.bands.map((b) => n(b.min))).size !== v.bands.length) issue(["scoringMethod"], "Each band needs a different minimum")
      }
      if (v.useJourney && (v.metric === "steps" || v.metric === "distance")) {
        if (v.journeyName.trim().length < 3) issue(["journeyName"], "Give the route a name")
        if (!(n(v.journeyKm) > 0) || n(v.journeyKm) > 10000) issue(["journeyKm"], "1–10,000 km")
        v.milestones.forEach((m, i) => {
          if (!m.name.trim()) issue(["milestones", i, "name"], "Name it")
          if (!(n(m.km) > 0) || n(m.km) > n(v.journeyKm)) issue(["milestones", i, "km"], "Within the route")
        })
      }
    })
}
type Values = z.infer<ReturnType<typeof makeSchema>>

/** Next Monday (or tomorrow if that's sooner than 3 days away). */
function suggestedStart() {
  const now = new Date()
  const daysToMonday = (8 - now.getDay()) % 7 || 7
  return formatDate(addDays(now, daysToMonday < 3 ? 1 : daysToMonday), "yyyy-MM-dd")
}

const emptyPrizes = (): Values["prizes"] => PLACE_META.map((m) => ({ place: m.place, text: "", rewardId: "none", points: "" }))
const defaultBands = (metric: ChallengeMetric): Values["bands"] =>
  metric === "steps"
    ? [
        { min: 5000, points: 1 },
        { min: 8000, points: 2 },
        { min: 10000, points: 3 },
      ]
    : []

const extrasDefaults = (metric: ChallengeMetric) => ({
  useWarmup: false,
  warmupStartDate: "",
  prizes: emptyPrizes(),
  scoringMethod: "total" as const,
  bestDays: 5 as number | "",
  ofDays: 7 as number | "",
  bands: defaultBands(metric),
  useJourney: false,
  journeyName: "",
  journeyKm: "" as number | "",
  milestones: [] as Values["milestones"],
})

export function valuesFromTemplate(t: ChallengeTemplate | null): Values {
  const start = suggestedStart()
  const days = t?.durationDays ?? 30
  const metric = t?.metric ?? "steps"
  return {
    name: t?.name ?? "",
    description: t?.description ?? "",
    coverEmoji: t?.coverEmoji ?? "🏆",
    coverColor: t?.coverColor ?? "#10b981",
    type: t?.type ?? "individual",
    teamUnit: "department",
    metric,
    customMetricLabel: t?.metric === "custom" ? (t.name.toLowerCase().includes("sugar") ? "Sugar-free days" : "Check-ins") : "",
    target: t?.target ?? 300000,
    startDate: start,
    endDate: formatDate(addDays(parseISO(start), days - 1), "yyyy-MM-dd"),
    audienceType: "all",
    audienceIds: [],
    points: t?.points ?? 100,
    rewardId: "none",
    rules: (t?.rules ?? DEFAULT_RULES).map((value) => ({ value })),
    ...extrasDefaults(metric),
  }
}

function valuesFromChallenge(c: ChallengeDetail): Values {
  const s = c.settings
  const prizes = emptyPrizes().map((p) => {
    const found = s.prizes.find((x) => x.place === p.place)
    return found ? { place: p.place, text: found.text ?? "", rewardId: found.rewardId ?? "none", points: (found.points ?? "") as number | "" } : p
  })
  return {
    name: c.name,
    description: c.description,
    coverEmoji: c.coverEmoji,
    coverColor: c.coverColor,
    type: c.type,
    teamUnit: c.teamUnit ?? "department",
    metric: c.metric,
    customMetricLabel: c.customMetricLabel ?? "",
    target: c.target,
    startDate: c.startDate,
    endDate: c.endDate,
    audienceType: c.audienceType,
    audienceIds: c.audienceIds,
    points: c.points,
    rewardId: c.rewardId ?? "none",
    rules: c.rules.map((value) => ({ value })),
    ...extrasDefaults(c.metric),
    useWarmup: !!s.warmupStartDate,
    warmupStartDate: s.warmupStartDate ?? "",
    prizes,
    scoringMethod: s.scoring.method,
    bestDays: s.scoring.bestDays ?? 5,
    ofDays: s.scoring.ofDays ?? 7,
    bands: s.scoring.bands?.length ? s.scoring.bands : defaultBands(c.metric),
    useJourney: !!s.journey,
    journeyName: s.journey?.name ?? "",
    journeyKm: s.journey?.totalKm ?? "",
    milestones: (s.journey?.milestones ?? []).map((m) => ({ id: m.id, name: m.name, km: m.km, points: m.points ?? "" })),
  }
}

/** SCR-B-014 Create / Edit challenge form with setup checklist and a live employee preview. Only drafts and scheduled challenges reach it (fairness lock). */
export function ChallengeForm({ challenge, template }: { challenge?: ChallengeDetail; template?: ChallengeTemplate | null }) {
  const router = useRouter()
  const isEdit = !!challenge
  const status = challenge?.status ?? "draft"
  const [schema] = useState(makeSchema)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: challenge ? valuesFromChallenge(challenge) : valuesFromTemplate(template ?? null), mode: "onTouched" })
  const rules = useFieldArray({ control: form.control, name: "rules" })
  const v = useWatch({ control: form.control }) as Values
  const errors = form.formState.errors
  const [pending, setPending] = useState<"draft" | "publish" | null>(null)
  const rewards = useApiQuery(["business", "challenges", "reward-options"], () => challengesApi.rewardOptions())
  const reward = rewards.data?.find((r) => r.id === v.rewardId)

  const durationDays = v.startDate && v.endDate && v.endDate > v.startDate ? differenceInCalendarDays(parseISO(v.endDate), parseISO(v.startDate)) + 1 : 0
  const startsInFuture = !!v.startDate && v.startDate > todayStr()
  const unit = metricUnit(v.metric, v.customMetricLabel)
  const competitive = v.type !== "collaborative"
  const journeyAvailable = v.metric === "steps" || v.metric === "distance"

  const onSuccess = (c: ChallengeDetail) => {
    setPending(null)
    router.push(`/business-portal/challenges/${c.id}`)
  }
  const onError = (err: { fieldErrors?: Record<string, string> }) => {
    setPending(null)
    const alias: Record<string, string> = { scoring: "scoringMethod", journey: "journeyName" }
    Object.entries(err.fieldErrors ?? {}).forEach(([k, message]) => form.setError((alias[k] ?? k) as keyof Values, { message }))
  }
  const successMessage = (c: ChallengeDetail, input: ChallengeInput) =>
    input.publish ? (c.status === "active" ? "Challenge published – it's live now." : `Challenge published – starts ${formatDate(c.startDate, "EEEE d MMM")}.`) : isEdit && status !== "draft" ? "Changes saved" : "Draft saved"
  const create = useApiMutation(challengesApi.create, { success: successMessage, onSuccess, onError })
  const update = useApiMutation(challengesApi.update, { success: successMessage, onSuccess, onError })

  const submit = (publish: boolean) =>
    form.handleSubmit(
      (values) => {
        setPending(publish ? "publish" : "draft")
        const comp = values.type !== "collaborative"
        const input: ChallengeInput = {
          name: values.name,
          description: values.description,
          coverEmoji: values.coverEmoji,
          coverColor: values.coverColor,
          type: values.type,
          teamUnit: values.type === "team" ? values.teamUnit : undefined,
          metric: values.metric,
          customMetricLabel: values.metric === "custom" ? values.customMetricLabel : undefined,
          target: values.target,
          startDate: values.startDate,
          endDate: values.endDate,
          audienceType: values.audienceType,
          audienceIds: values.audienceType === "all" ? [] : values.audienceIds,
          points: values.points,
          rewardId: values.rewardId === "none" ? undefined : values.rewardId,
          rules: values.rules.map((r) => r.value.trim()).filter(Boolean),
          templateId: challenge?.templateId ?? template?.id,
          prizes: comp
            ? values.prizes
                .map((p) => ({ place: p.place, text: p.text.trim() || undefined, rewardId: p.rewardId === "none" ? undefined : p.rewardId, points: p.points === "" ? undefined : p.points }))
                .filter((p) => p.text || p.rewardId || p.points)
            : [],
          warmupStartDate: values.useWarmup ? values.warmupStartDate : undefined,
          scoring: !comp
            ? { method: "total" }
            : values.scoringMethod === "best_days"
              ? { method: "best_days", bestDays: n(values.bestDays), ofDays: n(values.ofDays) }
              : values.scoringMethod === "bands"
                ? { method: "bands", bands: values.bands.map((b) => ({ min: n(b.min), points: n(b.points) })) }
                : { method: "total" },
          journey:
            values.useJourney && (values.metric === "steps" || values.metric === "distance")
              ? { name: values.journeyName, totalKm: n(values.journeyKm), milestones: values.milestones.map((m) => ({ id: m.id, name: m.name, km: n(m.km), points: m.points === "" ? undefined : m.points })) }
              : null,
          publish,
        }
        if (challenge) update.mutate({ ...input, id: challenge.id })
        else create.mutate(input)
      },
      () => document.querySelector("[aria-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" }),
    )()

  const busy = create.isPending || update.isPending
  const perDay = v.target > 0 && durationDays > 0 ? v.target / durationDays : 0
  const targetBasis =
    v.type === "collaborative"
      ? "Combined total for everyone taking part."
      : v.type === "team"
        ? "Target per participant; groups are ranked on their average."
        : v.type === "leaderboard"
          ? "A finishing line — the highest totals win, and everyone who reaches it completes."
          : "Each participant's personal target."

  const prizeCount = (v.prizes ?? []).filter((p) => p.text?.trim() || (p.rewardId && p.rewardId !== "none") || n(p.points) > 0).length
  const checklist: ChecklistItem[] = [
    { id: "name", label: "Name & description", state: (v.name ?? "").trim().length >= 3 ? "done" : "missing", hint: "Give the challenge a clear name.", target: "sec-basics" },
    { id: "metric", label: "Metric & target", state: v.target > 0 && (v.metric !== "custom" || !!v.customMetricLabel?.trim()) ? "done" : "missing", hint: "Set a target above 0.", target: "sec-metric" },
    {
      id: "dates",
      label: "Dates",
      state: v.startDate && v.endDate && v.endDate > v.startDate && v.startDate >= todayStr() && (!v.useWarmup || (!!v.warmupStartDate && v.warmupStartDate < v.startDate && v.warmupStartDate >= todayStr())) ? "done" : "missing",
      hint: "Start today or later and end after the start.",
      target: "sec-dates",
    },
    { id: "audience", label: "Participants", state: v.audienceType === "all" || (v.audienceIds ?? []).length > 0 ? "done" : "missing", hint: "Pick who can join.", target: "sec-participants" },
    { id: "points", label: "Points or reward", state: v.points > 0 || (v.rewardId && v.rewardId !== "none") ? "done" : "optional", hint: "Points motivate people to finish.", target: "sec-points" },
    ...(competitive ? [{ id: "prizes", label: "Winner prizes", state: prizeCount > 0 ? "done" : "optional", hint: "Recommended for competitions.", target: "sec-prizes" } as ChecklistItem] : []),
    { id: "rules", label: "Rules", state: (v.rules ?? []).some((r) => r.value?.trim()) ? "done" : "optional", hint: "Add at least one clear rule.", target: "sec-rules" },
    { id: "cover", label: "Cover image", state: "done", target: "sec-basics" },
  ]

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-6">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <div id="sec-basics" className="scroll-mt-20">
            <SectionCard title="1. Basics" description="What employees see first in the app.">
              <div className="grid gap-4">
                <TextField control={form.control} name="name" label="Challenge name" placeholder="e.g. October Step Up" required />
                <TextareaField control={form.control} name="description" label="Description" placeholder="Tell people what to do and why it matters." rows={3} maxLength={600} />
                <CoverPicker
                  emoji={v.coverEmoji}
                  color={v.coverColor}
                  onEmojiChange={(e) => form.setValue("coverEmoji", e, { shouldDirty: true })}
                  onColorChange={(c) => form.setValue("coverColor", c, { shouldDirty: true })}
                  label="Cover image"
                />
              </div>
            </SectionCard>
          </div>

          <SectionCard title="2. Challenge type" description="How people take part and win.">
            <div className="grid gap-4">
              <ChoiceField
                control={form.control}
                name="type"
                columns={2}
                options={TYPES.map((t) => {
                  const Icon = TYPE_META[t].icon
                  return { value: t, label: TYPE_META[t].label, description: TYPE_META[t].description, icon: <Icon className="size-4 text-primary" /> }
                })}
              />
              {v.type === "team" ? (
                <ChoiceField
                  control={form.control}
                  name="teamUnit"
                  label="What competes"
                  options={[
                    { value: "department", label: "Department vs department", description: "Every department is one side." },
                    { value: "team", label: "Team vs team", description: "Smaller groups, closer competition." },
                  ]}
                />
              ) : null}
            </div>
          </SectionCard>

          <div id="sec-metric" className="scroll-mt-20">
            <SectionCard title="3. Metric & target" description="What counts, and how much is needed. These are locked once the challenge starts.">
              <div className="grid gap-4">
                <MetricPicker control={form.control} />
                {v.metric === "custom" ? (
                  <TextField control={form.control} name="customMetricLabel" label="What do people check in for?" placeholder="e.g. Sugar-free days" description="Shown as the unit, e.g. “7 sugar-free days”." required />
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField control={form.control} name="target" type="number" label="Target" required suffix={unit.length <= 5 ? unit : undefined} description={targetBasis} />
                  <div className="flex flex-col justify-end rounded-xl border border-dashed p-3 text-sm sm:mt-6">
                    <span className="text-xs text-muted-foreground">Per-day pace</span>
                    <span className="font-medium">
                      {perDay > 0 ? (v.type === "collaborative" ? `${formatMetricValue(Math.round(perDay), v.metric, v.customMetricLabel)} a day across everyone` : METRIC_META[v.metric].dailyHint?.(perDay)) : "Set a target and dates"}
                    </span>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          <div id="sec-dates" className="scroll-mt-20">
            <SectionCard title="4. Dates" description="Scoring counts from 00:00 on the start date to 23:59 on the end date. Dates lock once the challenge starts.">
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <TextField control={form.control} name="startDate" type="date" label="Start date" required />
                  <TextField control={form.control} name="endDate" type="date" label="End date" required />
                  <div className="flex flex-col justify-end rounded-xl border border-dashed p-3 text-sm sm:mt-6">
                    <span className="text-xs text-muted-foreground">Duration</span>
                    <span className="font-medium">{durationDays > 0 ? `${pluralize(durationDays, "day")} · ends ${formatDate(v.endDate, "EEE d MMM")}` : "—"}</span>
                  </div>
                </div>
                <div className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        Warm-up period <PhaseBadge phase={2} />
                      </p>
                      <p className="text-xs text-muted-foreground">Let people join and connect their trackers before scoring starts. The challenge is locked once warm-up begins.</p>
                    </div>
                    <Switch
                      checked={!!v.useWarmup}
                      onCheckedChange={(on) => {
                        form.setValue("useWarmup", on, { shouldDirty: true })
                        if (on && !v.warmupStartDate && v.startDate) {
                          const s = addDays(parseISO(v.startDate), -3)
                          form.setValue("warmupStartDate", formatDate(s < new Date() ? new Date() : s, "yyyy-MM-dd"), { shouldDirty: true })
                        }
                      }}
                      aria-label="Use a warm-up period"
                    />
                  </div>
                  {v.useWarmup ? (
                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <TextField control={form.control} name="warmupStartDate" type="date" label="Warm-up starts" required />
                      <div className="flex flex-col justify-end rounded-xl border border-dashed p-3 text-sm sm:col-span-2 sm:mt-6">
                        <span className="text-xs text-muted-foreground">Warm-up</span>
                        <span className="font-medium">
                          {v.warmupStartDate && v.startDate && v.warmupStartDate < v.startDate ? `${pluralize(differenceInCalendarDays(parseISO(v.startDate), parseISO(v.warmupStartDate)), "day")} to join before scoring starts` : "—"}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </SectionCard>
          </div>

          <div id="sec-participants" className="scroll-mt-20">
            <SectionCard title="5. Participants" description="Only employees in this group can see and join the challenge.">
              <AudienceField
                value={{ audienceType: v.audienceType, audienceIds: v.audienceIds ?? [] }}
                onChange={(a) => {
                  form.setValue("audienceType", a.audienceType, { shouldDirty: true })
                  form.setValue("audienceIds", a.audienceIds, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
                }}
                error={errors.audienceIds?.message}
                estimateLabel="in this group"
              />
            </SectionCard>
          </div>

          <div id="sec-points" className="scroll-mt-20">
            <SectionCard title="6. Points & reward" description="Points go to everyone who completes the challenge. A reward is optional.">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField control={form.control} name="points" type="number" label="Points for completing" suffix="pts" required description="0–10,000. Typical: 50–150." />
                <RewardSelect control={form.control} options={rewards.data ?? []} loading={rewards.isLoading} />
              </div>
            </SectionCard>
          </div>

          {competitive ? (
            <div id="sec-prizes" className="scroll-mt-20">
              <SectionCard title="7. Winner prizes" description="Optional prizes for 1st, 2nd and 3rd place — a prize description, a catalogue reward and/or bonus points.">
                <PrizesSection control={form.control} rewards={rewards.data ?? []} teamUnit={v.teamUnit} type={v.type} />
              </SectionCard>
            </div>
          ) : null}

          <SectionCard
            title={
              <span className="inline-flex items-center gap-2">
                {competitive ? "8." : "7."} Scoring <PhaseBadge phase={2} />
              </span>
            }
            description="How progress is counted for rankings. Locked once the challenge starts."
          >
            <ScoringSection
              control={form.control}
              unit={unit}
              error={errors.scoringMethod?.message}
              disabledReason={!competitive ? "Collaborative challenges always count the combined total." : undefined}
            />
          </SectionCard>

          <SectionCard
            title={
              <span className="inline-flex items-center gap-2">
                {competitive ? "9." : "8."} Walking journey <PhaseBadge phase={2} />
              </span>
            }
            description="A virtual route with milestones for walking challenges."
          >
            <JourneySection control={form.control} setValue={form.setValue} available={journeyAvailable} />
          </SectionCard>

          <div id="sec-rules" className="scroll-mt-20">
            <SectionCard title={`${competitive ? "10." : "9."} Rules`} description="Short, clear rules shown on the challenge page.">
              <div className="flex flex-col gap-2">
                {rules.fields.map((field, i) => (
                  <div key={field.id} className="flex items-start gap-2">
                    <span className="mt-2 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <Input {...form.register(`rules.${i}.value`)} placeholder="Write a rule…" className="h-9" aria-label={`Rule ${i + 1}`} aria-invalid={!!errors.rules?.[i]?.value} />
                      {errors.rules?.[i]?.value ? <p className="mt-1 text-xs font-medium text-destructive">{errors.rules[i]?.value?.message}</p> : null}
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => rules.remove(i)} aria-label={`Remove rule ${i + 1}`}>
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                {errors.rules?.message || errors.rules?.root?.message ? <p className="text-xs font-medium text-destructive">{errors.rules?.message ?? errors.rules?.root?.message}</p> : null}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => rules.append({ value: "" })} disabled={rules.fields.length >= 12}>
                    <Plus data-icon="inline-start" /> Add rule
                  </Button>
                  {RULE_SUGGESTIONS.filter((s) => !v.rules?.some((r) => r.value === s))
                    .slice(0, 2)
                    .map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={rules.fields.length >= 12}
                        onClick={() => rules.append({ value: s })}
                        className="max-w-full truncate rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      >
                        + {s}
                      </button>
                    ))}
                </div>
              </div>
            </SectionCard>
          </div>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pb-2">
          <SetupChecklist items={checklist} />
          <PhoneFrame label="Preview — as employees will see it">
            <ChallengePreview
              data={{
                name: v.name,
                description: v.description,
                coverEmoji: v.coverEmoji,
                coverColor: v.coverColor,
                type: v.type,
                teamUnit: v.teamUnit,
                metric: v.metric,
                customMetricLabel: v.customMetricLabel,
                target: Number(v.target) || 0,
                startDate: v.startDate,
                endDate: v.endDate,
                points: Number(v.points) || 0,
                reward: reward ? { name: reward.name, imageEmoji: reward.imageEmoji } : null,
                rules: (v.rules ?? []).map((r) => r.value),
                durationDays,
                warmupStartDate: v.useWarmup ? v.warmupStartDate : undefined,
                prizes: competitive
                  ? (v.prizes ?? [])
                      .map((p) => {
                        const r = rewards.data?.find((x) => x.id === p.rewardId)
                        const label = [p.text?.trim(), r ? `${r.imageEmoji} ${r.name}` : "", n(p.points) > 0 ? `+${n(p.points)} pts` : ""].filter(Boolean).join(" · ")
                        return { place: p.place, label }
                      })
                      .filter((p) => p.label)
                  : [],
                journey: v.useJourney && journeyAvailable && n(v.journeyKm) > 0 ? { name: v.journeyName, totalKm: n(v.journeyKm) } : null,
              }}
            />
          </PhoneFrame>
        </aside>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <p className="mr-auto hidden text-xs text-muted-foreground sm:block">
          {status === "draft"
            ? startsInFuture
              ? `Publishing schedules it to start ${v.startDate ? formatDate(v.startDate, "EEE d MMM") : ""}. Eligible employees get a notification.`
              : "Publishing makes it live straight away and notifies eligible employees."
            : "You can edit until the challenge starts — after that it's locked to keep it fair."}
        </p>
        <Button asChild variant="ghost">
          <Link href={challenge ? `/business-portal/challenges/${challenge.id}` : "/business-portal/challenges"}>Cancel</Link>
        </Button>
        {status === "draft" ? (
          <>
            <Button type="button" variant="outline" onClick={() => submit(false)} disabled={busy}>
              {pending === "draft" ? <Spinner /> : <Save data-icon="inline-start" />}
              Save draft
            </Button>
            <Button type="button" onClick={() => submit(true)} disabled={busy}>
              {pending === "publish" ? <Spinner /> : startsInFuture ? <CalendarClock data-icon="inline-start" /> : <Rocket data-icon="inline-start" />}
              {startsInFuture ? "Schedule challenge" : "Publish now"}
            </Button>
          </>
        ) : (
          <Button type="button" onClick={() => submit(false)} disabled={busy}>
            {busy ? <Spinner /> : <Save data-icon="inline-start" />}
            Save changes
          </Button>
        )}
      </div>
    </form>
  )
}

function MetricPicker({ control }: { control: Control<Values> }) {
  const { field, fieldState } = useController({ control, name: "metric" })
  return (
    <FieldShell label="Metric" required error={fieldState.error?.message}>
      <div role="radiogroup" aria-label="Metric" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {METRICS.map((m) => {
          const active = field.value === m
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => field.onChange(m as ChallengeMetric)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                active && "border-primary bg-primary/5 font-medium ring-1 ring-primary/30",
              )}
            >
              <span className="text-lg leading-none">{METRIC_META[m].emoji}</span>
              <span className="min-w-0">
                <span className="block truncate">{METRIC_META[m].label}</span>
                <span className="block truncate text-[11px] font-normal text-muted-foreground">{m === "custom" ? "your own label" : METRIC_META[m].unit}</span>
              </span>
            </button>
          )
        })}
      </div>
    </FieldShell>
  )
}

function RewardSelect({ control, options, loading }: { control: Control<Values>; options: RewardOption[]; loading?: boolean }) {
  const { field, fieldState } = useController({ control, name: "rewardId" })
  const company = options.filter((o) => o.source === "company")
  const healthx = options.filter((o) => o.source === "healthx")
  return (
    <FieldShell id="f-rewardId" label="Reward (optional)" error={fieldState.error?.message} description="Given to everyone who finishes, on top of points.">
      <Select value={field.value} onValueChange={field.onChange} disabled={loading}>
        <SelectTrigger id="f-rewardId" className="h-9 w-full" aria-invalid={!!fieldState.error}>
          <SelectValue placeholder={loading ? "Loading rewards…" : "No reward"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No reward</SelectItem>
          {company.length ? (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Company rewards</SelectLabel>
                {company.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.imageEmoji} {r.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </>
          ) : null}
          {healthx.length ? (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>HealthX catalogue</SelectLabel>
                {healthx.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.imageEmoji} {r.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </>
          ) : null}
        </SelectContent>
      </Select>
    </FieldShell>
  )
}
