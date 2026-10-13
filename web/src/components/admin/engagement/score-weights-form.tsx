"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, History, RotateCcw, Save } from "lucide-react"
import { useForm, useWatch, type UseFormReturn } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { FormActions } from "@/components/admin/form-layout"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { DonutChart } from "@/components/common/charts"
import { ChoiceField, TextareaField, TextField } from "@/components/common/form-fields"
import { SectionCard } from "@/components/common/misc"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { useApiMutation } from "@/lib/api/hooks"
import { today } from "@/lib/api/platform/common"
import { SCORE_COMPONENTS, scoreApi, type ScoreVersion, type ScoreWeightsData } from "@/lib/api/platform/score"
import { formatDate, formatRelative } from "@/lib/format"
import type { WellnessScoreWeights } from "@/lib/types"
import { cn } from "@/lib/utils"
import { SCORE_COMPONENT_META } from "./meta"

const weight = z.number({ error: "Enter a number" }).int("Whole numbers only.").min(0, "Use 0–100.").max(100, "Use 0–100.")

const schema = z
  .object({
    weights: z.object({ activity: weight, sleep: weight, hydration: weight, exercise: weight, habits: weight, mindfulness: weight }),
    effectiveFrom: z.string().min(1, "Choose the date the new weights apply from."),
    missingHandling: z.enum(["redistribute", "zero"]),
    note: z.string().trim().min(5, "Add a short note explaining the change (at least 5 characters).").max(300, "Keep the note under 300 characters."),
  })
  .superRefine((v, ctx) => {
    const total = SCORE_COMPONENTS.reduce((a, k) => a + (Number.isFinite(v.weights[k]) ? v.weights[k] : 0), 0)
    if (total !== 100) ctx.addIssue({ code: "custom", path: ["weights"], message: `Weights must add up to 100% (currently ${total}%).` })
    if (v.effectiveFrom && v.effectiveFrom < today()) ctx.addIssue({ code: "custom", path: ["effectiveFrom"], message: "Effective date can't be in the past." })
  })
type Values = z.infer<typeof schema>

const totalOf = (w: Partial<WellnessScoreWeights> | undefined) => SCORE_COMPONENTS.reduce((a, k) => a + (typeof w?.[k] === "number" && Number.isFinite(w[k]) ? w[k]! : 0), 0)

const summary = (w: WellnessScoreWeights) => SCORE_COMPONENTS.map((k) => `${SCORE_COMPONENT_META[k].label} ${w[k]}`).join(" · ")

/** Thin stacked bar of weights; doubles as the live total meter. */
function WeightsBar({ weights, className }: { weights: Partial<WellnessScoreWeights>; className?: string }) {
  const total = totalOf(weights)
  const scale = Math.max(100, total)
  return (
    <div className={cn("flex h-2.5 w-full overflow-hidden rounded-full bg-muted", total > 100 && "ring-2 ring-destructive/50", className)} role="img" aria-label={`Weights total ${total}%`}>
      {SCORE_COMPONENTS.map((k) => {
        const v = typeof weights[k] === "number" ? weights[k]! : 0
        return v > 0 ? <span key={k} className="h-full border-r border-card last:border-r-0" style={{ width: `${(v / scale) * 100}%`, backgroundColor: SCORE_COMPONENT_META[k].color }} /> : null
      })}
    </div>
  )
}

function WeightRow({ form, k, current, disabled }: { form: UseFormReturn<Values>; k: (typeof SCORE_COMPONENTS)[number]; current: number; disabled: boolean }) {
  const meta = SCORE_COMPONENT_META[k]
  const Icon = meta.icon
  const raw = useWatch({ control: form.control, name: `weights.${k}` }) as number | ""
  const value = typeof raw === "number" && Number.isFinite(raw) ? raw : 0
  const error = form.formState.errors.weights?.[k]?.message
  const diff = value - current
  const set = (v: number | "") => form.setValue(`weights.${k}`, v as number, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3 sm:grid-cols-[auto_minmax(0,180px)_minmax(0,1fr)_auto]">
      <span className="flex size-9 items-center justify-center rounded-xl" style={{ backgroundColor: `color-mix(in oklch, ${meta.color} 16%, transparent)`, color: meta.color }}>
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{meta.label}</span>
          {diff !== 0 ? <span className={cn("text-[11px] font-semibold tabular-nums", diff > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{diff > 0 ? `+${diff}` : diff}</span> : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">{meta.description}</p>
      </div>
      <Slider
        value={[value]}
        min={0}
        max={100}
        step={1}
        disabled={disabled}
        onValueChange={([v]) => set(v ?? 0)}
        aria-label={`${meta.label} weight`}
        className="col-span-3 row-start-2 [&_[data-slot=slider-range]]:bg-(--range) sm:col-span-1 sm:col-start-3 sm:row-start-1"
        style={{ "--range": meta.color } as React.CSSProperties}
      />
      <div className="col-start-3 row-start-1 sm:col-start-4">
        <div className="relative">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={raw}
            disabled={disabled}
            aria-label={`${meta.label} %`}
            aria-invalid={!!error}
            onChange={(e) => set(e.target.value === "" ? "" : Math.round(Number(e.target.value)))}
            className="h-9 w-20 pr-7 text-right tabular-nums"
          />
          <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">%</span>
        </div>
        {error ? <p className="mt-1 text-[11px] font-medium text-destructive">{error}</p> : null}
      </div>
    </div>
  )
}

/** SCR-P-022 weights editor + version history. */
export function ScoreWeightsForm({ data }: { data: ScoreWeightsData }) {
  const can = useAdminCan()
  const canManage = can("score.manage")
  const current = data.current
  const defaults: Values = { weights: { ...current.weights }, effectiveFrom: today(), missingHandling: current.missingHandling, note: "" }
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults })
  const weights = useWatch({ control: form.control, name: "weights" })
  const total = totalOf(weights)
  const remaining = 100 - total

  const save = useApiMutation(scoreApi.save, {
    success: "Weights saved – apply from the next daily calculation.",
    errorTitle: "Couldn't save weights.",
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) {
        Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as "note", { message }))
      }
    },
  })

  const restore = (v: ScoreVersion) => {
    form.reset({ ...form.getValues(), weights: { ...v.weights }, missingHandling: v.missingHandling, note: `Restore version ${v.version} weights.` }, { keepDefaultValues: true })
    window.scrollTo({ top: 0, behavior: "smooth" })
    toast.info(`Version ${v.version} weights loaded — review and save to apply them.`)
  }
  const resetDefaults = () => {
    form.setValue("weights", { ...data.defaults }, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
    toast.info("Default weights loaded — add a note and save to apply them.")
  }

  const nextVersion = (data.versions[0]?.version ?? 0) + 1
  const weightsError = form.formState.errors.weights?.message ?? form.formState.errors.weights?.root?.message

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((v) => save.mutate(v, { onSuccess: () => form.reset({ ...v, note: "" }) }))}
      className="flex flex-col gap-6"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <fieldset disabled={!canManage || save.isPending} className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base">Component weights</CardTitle>
              <CardDescription>How much each area counts towards an employee&apos;s daily Wellness Score (0–100).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={cn(
                  "space-y-2 rounded-xl border p-3.5",
                  total === 100 ? "border-emerald-500/30 bg-emerald-500/6" : total > 100 ? "border-destructive/40 bg-destructive/5" : "border-amber-500/40 bg-amber-500/8",
                )}
                aria-live="polite"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">Total</span>
                  <span className={cn("font-heading text-2xl font-bold tabular-nums", total === 100 ? "text-emerald-700 dark:text-emerald-400" : total > 100 ? "text-destructive" : "text-amber-700 dark:text-amber-400")}>
                    {total}%
                  </span>
                </div>
                <WeightsBar weights={weights} />
                <p className={cn("flex items-center gap-1.5 text-xs font-medium", total === 100 ? "text-emerald-700 dark:text-emerald-400" : total > 100 ? "text-destructive" : "text-amber-800 dark:text-amber-300")} role={total === 100 ? undefined : "alert"}>
                  {total === 100 ? (
                    <>
                      <CheckCircle2 className="size-3.5" /> Weights add up to 100% — ready to save.
                    </>
                  ) : (
                    <>
                      Weights must add up to 100% (currently {total}%). {remaining > 0 ? `Add ${remaining}% more.` : `Remove ${-remaining}%.`}
                    </>
                  )}
                </p>
              </div>
              <div className="divide-y">
                {SCORE_COMPONENTS.map((k) => (
                  <WeightRow key={k} form={form} k={k} current={current.weights[k]} disabled={!canManage || save.isPending} />
                ))}
              </div>
              {weightsError && total !== 100 ? <p className="sr-only">{weightsError}</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base">When and how it applies</CardTitle>
              <CardDescription>Scores already calculated are never changed.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="effectiveFrom" label="Effective from" type="date" description="Used from the first daily calculation on this date." required />
              <div className="hidden sm:block" />
              <ChoiceField
                control={form.control}
                name="missingHandling"
                label="Missing-component handling"
                className="sm:col-span-2"
                options={[
                  { value: "redistribute", label: "Redistribute the weight", description: "If someone doesn't track e.g. sleep, its weight is shared across the components they do track." },
                  { value: "zero", label: "Count as zero", description: "Untracked components score 0 — encourages complete tracking but can feel harsh." },
                ]}
              />
              <TextareaField control={form.control} name="note" label="Change note" rows={2} maxLength={300} placeholder="Why are the weights changing?" className="sm:col-span-2" required />
            </CardContent>
          </Card>
        </fieldset>

        <aside className="min-w-0">
          <div className="space-y-4 lg:sticky lg:top-20">
            <SectionCard title="Weight mix" description={`Live preview of version ${nextVersion}`}>
              <DonutChart
                data={SCORE_COMPONENTS.map((k) => ({ name: SCORE_COMPONENT_META[k].label, value: typeof weights?.[k] === "number" ? Math.max(0, weights[k]) : 0, color: SCORE_COMPONENT_META[k].color }))}
                centerValue={`${total}%`}
                centerLabel="total"
                height={160}
                valueFormatter={(v) => `${v}%`}
                className="justify-center [&_ul]:hidden"
              />
              <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {SCORE_COMPONENTS.map((k) => (
                  <li key={k} className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: SCORE_COMPONENT_META[k].color }} />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{SCORE_COMPONENT_META[k].label}</span>
                    <span className="font-semibold tabular-nums">{typeof weights?.[k] === "number" ? weights[k] : 0}%</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
            <div className="rounded-xl border bg-muted/30 p-3.5 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Current: version {current.version}</p>
              <p className="mt-1">{summary(current.weights)}</p>
              <p className="mt-1">
                Since {formatDate(current.effectiveFrom)} · {current.missingHandling === "redistribute" ? "missing data redistributed" : "missing data counts as zero"}
              </p>
            </div>
          </div>
        </aside>
      </div>

      <SectionCard
        title={
          <span className="inline-flex items-center gap-2">
            <History className="size-4 text-muted-foreground" /> Version history
          </span>
        }
        description="Every saved configuration. Restore loads a version into the editor — it isn't applied until you save."
      >
        <ol className="divide-y">
          {data.versions.map((v) => (
            <li key={v.version} className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 md:flex-row md:items-center md:gap-6">
              <div className="flex shrink-0 items-center gap-2 md:w-36">
                <Badge variant={v.current ? "default" : "secondary"}>v{v.version}</Badge>
                {v.current ? <span className="text-xs font-semibold text-primary">Current</span> : null}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <WeightsBar weights={v.weights} className="h-2 max-w-md" />
                <p className="text-xs text-muted-foreground">{summary(v.weights)}</p>
                {v.note ? <p className="text-sm break-words">{v.note}</p> : null}
              </div>
              <div className="shrink-0 text-xs text-muted-foreground md:w-48 md:text-right">
                <div>
                  {v.updatedBy} · {formatRelative(v.updatedAt)}
                </div>
                <div>Effective {formatDate(v.effectiveFrom)}</div>
                <div>{v.missingHandling === "redistribute" ? "Redistribute missing" : "Missing = zero"}</div>
              </div>
              <div className="shrink-0 md:w-24 md:text-right">
                {!v.current && canManage ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => restore(v)}>
                    <RotateCcw data-icon="inline-start" /> Restore
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </SectionCard>

      {canManage ? (
        <FormActions hint={`Saving creates version ${nextVersion}. Employees see it from the next daily calculation.`}>
          <Button type="button" variant="outline" onClick={resetDefaults} disabled={save.isPending}>
            <RotateCcw data-icon="inline-start" /> Reset to defaults
          </Button>
          <Button type="submit" disabled={save.isPending || total !== 100}>
            {save.isPending ? <Spinner /> : <Save data-icon="inline-start" />}
            Save weights
          </Button>
        </FormActions>
      ) : null}
    </form>
  )
}
