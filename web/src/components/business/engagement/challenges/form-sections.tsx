"use client"

/**
 * Extra sections of the challenge composer: winner prizes (#359), custom scoring (#369, P2),
 * walking journey (#374, P2). They read/write the parent form through `control` + `setValue`.
 */
import { Flag, MapPin, Plus, Trash2 } from "lucide-react"
import { useController, useFieldArray, useWatch, type Control, type FieldValues, type Path, type UseFormSetValue } from "react-hook-form"
import { FieldShell, TextField } from "@/components/common/form-fields"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import type { RewardOption } from "@/lib/api/business/challenges"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

export const PLACE_META = [
  { place: 1 as const, label: "1st place", medal: "🥇" },
  { place: 2 as const, label: "2nd place", medal: "🥈" },
  { place: 3 as const, label: "3rd place", medal: "🥉" },
]

type Num = number | ""

export interface PrizeValues {
  place: 1 | 2 | 3
  text: string
  rewardId: string
  points: Num
}

export interface ExtraValues extends FieldValues {
  prizes: PrizeValues[]
  scoringMethod: "total" | "best_days" | "bands"
  bestDays: Num
  ofDays: Num
  bands: { min: Num; points: Num }[]
  useJourney: boolean
  journeyName: string
  journeyKm: Num
  milestones: { id: string; name: string; km: Num; points: Num }[]
}

// ─── Prizes (#359) ──────────────────────────────────────────────────────

export function PrizesSection<T extends ExtraValues>({ control, rewards, teamUnit, type }: { control: Control<T>; rewards: RewardOption[]; teamUnit?: "department" | "team"; type: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {type === "team"
          ? `Prizes go to every participant in the winning ${teamUnit === "team" ? "teams" : "departments"}.`
          : "Prizes go to the top 3 on the challenge leaderboard when it ends. Leave a place empty for no prize."}
      </p>
      <div className="grid gap-3">
        {PLACE_META.map((m, i) => (
          <PrizeRow key={m.place} control={control} index={i} medal={m.medal} label={m.label} rewards={rewards} />
        ))}
      </div>
    </div>
  )
}

function PrizeRow<T extends ExtraValues>({ control, index, medal, label, rewards }: { control: Control<T>; index: number; medal: string; label: string; rewards: RewardOption[] }) {
  const reward = useController({ control, name: `prizes.${index}.rewardId` as Path<T> })
  const company = rewards.filter((r) => r.source === "company")
  const healthx = rewards.filter((r) => r.source === "healthx")
  return (
    <div className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_7rem] sm:items-start">
      <div className="flex items-center gap-2 sm:h-9 sm:pt-0">
        <span className="text-2xl leading-none" aria-hidden>
          {medal}
        </span>
        <span className="text-sm font-semibold sm:hidden">{label}</span>
      </div>
      <TextField control={control} name={`prizes.${index}.text` as Path<T>} placeholder={`${label} prize, e.g. Fitness band`} />
      <FieldShell id={`f-prize-${index}-reward`} error={reward.fieldState.error?.message}>
        <Select value={(reward.field.value as string) || "none"} onValueChange={reward.field.onChange}>
          <SelectTrigger id={`f-prize-${index}-reward`} className="h-9 w-full" aria-label={`${label} reward`}>
            <SelectValue placeholder="No catalogue reward" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No catalogue reward</SelectItem>
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
      <TextField control={control} name={`prizes.${index}.points` as Path<T>} type="number" placeholder="Bonus" suffix="pts" />
    </div>
  )
}

// ─── Scoring (#369) ─────────────────────────────────────────────────────

export function ScoringSection<T extends ExtraValues>({ control, unit, error, disabledReason }: { control: Control<T>; unit: string; error?: string; disabledReason?: string }) {
  const method = useController({ control, name: "scoringMethod" as Path<T> })
  const bands = useFieldArray({ control, name: "bands" as never })
  const options = [
    { value: "total", label: "Total", description: `Everything logged counts (${unit}).` },
    { value: "best_days", label: "Best days", description: "Only the best N days in every M days count." },
    { value: "bands", label: "Score bands", description: "Each day earns points by reaching bands." },
  ] as const
  if (disabledReason) return <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">{disabledReason}</p>
  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Scoring method" className="grid gap-2 sm:grid-cols-3">
        {options.map((o) => {
          const active = method.field.value === o.value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => method.field.onChange(o.value)}
              className={cn("rounded-xl border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none", active && "border-primary bg-primary/5 ring-1 ring-primary/30")}
            >
              <span className="block text-sm font-medium">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.description}</span>
            </button>
          )
        })}
      </div>
      {method.field.value === "best_days" ? (
        <div className="flex flex-wrap items-end gap-3">
          <TextField control={control} name={"bestDays" as Path<T>} type="number" label="Count the best" suffix="days" className="w-40" />
          <TextField control={control} name={"ofDays" as Path<T>} type="number" label="out of every" suffix="days" className="w-40" />
          <p className="pb-2 text-xs text-muted-foreground">e.g. best 5 of 7 days — a missed day or two won&apos;t hurt anyone&apos;s ranking.</p>
        </div>
      ) : null}
      {method.field.value === "bands" ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Each day earns the points of the highest band reached. Rankings and the target then use band points.</p>
          {bands.fields.map((f, i) => (
            <div key={f.id} className="flex items-start gap-2">
              <TextField control={control} name={`bands.${i}.min` as Path<T>} type="number" placeholder="Minimum" suffix={unit.length <= 5 ? unit : undefined} className="flex-1" />
              <span className="pt-2 text-sm text-muted-foreground">=</span>
              <TextField control={control} name={`bands.${i}.points` as Path<T>} type="number" placeholder="Points" suffix="pts" className="w-32" />
              <Button type="button" variant="ghost" size="icon" onClick={() => bands.remove(i)} aria-label={`Remove band ${i + 1}`}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="self-start" disabled={bands.fields.length >= 6} onClick={() => bands.append({ min: "", points: "" } as never)}>
            <Plus data-icon="inline-start" /> Add band
          </Button>
        </div>
      ) : null}
      {error ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

// ─── Walking journey (#374) ─────────────────────────────────────────────

export function JourneySection<T extends ExtraValues>({ control, setValue, available, error }: { control: Control<T>; setValue: UseFormSetValue<T>; available: boolean; error?: string }) {
  const use = useController({ control, name: "useJourney" as Path<T> })
  const milestones = useFieldArray({ control, name: "milestones" as never })
  const km = Number(useWatch({ control, name: "journeyKm" as Path<T> })) || 0
  const ms = (useWatch({ control, name: "milestones" as Path<T> }) as ExtraValues["milestones"] | undefined) ?? []
  if (!available) return <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">Walking journeys are available for steps or distance challenges.</p>
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Turn progress into a virtual route</p>
          <p className="text-xs text-muted-foreground">Participants see themselves moving along the route and unlock milestones (1 km ≈ 1,320 steps).</p>
        </div>
        <Switch checked={!!use.field.value} onCheckedChange={(v) => use.field.onChange(v)} aria-label="Use a walking journey" />
      </div>
      {use.field.value ? (
        <>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <TextField control={control} name={"journeyName" as Path<T>} label="Route name" placeholder="e.g. Bengaluru to Coorg trail" required />
            <TextField control={control} name={"journeyKm" as Path<T>} type="number" label="Route length" suffix="km" required />
          </div>
          {km > 0 ? <RoutePreview totalKm={km} milestones={ms.map((m) => ({ name: m.name, km: Number(m.km) || 0 }))} /> : null}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Milestones</p>
            {milestones.fields.map((f, i) => (
              <div key={f.id} className="flex items-start gap-2">
                <MapPin className="mt-2.5 size-4 shrink-0 text-muted-foreground" />
                <TextField control={control} name={`milestones.${i}.name` as Path<T>} placeholder="Milestone name" className="min-w-0 flex-1" />
                <TextField control={control} name={`milestones.${i}.km` as Path<T>} type="number" placeholder="At" suffix="km" className="w-28" />
                <TextField control={control} name={`milestones.${i}.points` as Path<T>} type="number" placeholder="Bonus" suffix="pts" className="hidden w-28 sm:block" />
                <Button type="button" variant="ghost" size="icon" onClick={() => milestones.remove(i)} aria-label={`Remove milestone ${i + 1}`}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              disabled={milestones.fields.length >= 12}
              onClick={() => {
                milestones.append({ id: `ms_${Date.now().toString(36)}`, name: "", km: "", points: "" } as never)
                if (!km) setValue("journeyKm" as Path<T>, 100 as never)
              }}
            >
              <Plus data-icon="inline-start" /> Add milestone
            </Button>
          </div>
        </>
      ) : null}
      {error ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Horizontal route with milestone pins; optional markers for average and leader positions. */
export function RoutePreview({
  totalKm,
  milestones,
  averageKm,
  leaderKm,
  color = "var(--primary)",
}: {
  totalKm: number
  milestones: { name: string; km: number; reached?: number | null }[]
  averageKm?: number
  leaderKm?: number
  color?: string
}) {
  const pct = (km: number) => `${Math.max(0, Math.min(100, (km / Math.max(1, totalKm)) * 100))}%`
  return (
    <div className="rounded-xl border bg-muted/30 px-4 pt-10 pb-12">
      <div className="relative h-2.5 rounded-full bg-muted">
        {averageKm !== undefined ? <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: pct(averageKm), backgroundColor: color }} /> : null}
        <span className="absolute -top-7 left-0 -translate-x-1/2 text-[11px] font-medium text-muted-foreground">Start</span>
        <Flag className="absolute -top-7 right-0 size-4 translate-x-1/2 text-muted-foreground" />
        {milestones
          .filter((m) => m.km > 0)
          .map((m, i) => (
            <div key={`${m.name}-${i}`} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: pct(m.km) }}>
              <span className={cn("block size-3.5 rounded-full border-2 border-background", averageKm !== undefined && m.km <= averageKm ? "bg-primary" : "bg-muted-foreground/60")} />
              <span className={cn("absolute top-5 left-1/2 w-20 -translate-x-1/2 text-center text-[10px] leading-tight text-muted-foreground", i % 2 === 1 && "top-auto bottom-5")}>
                {m.name || "Milestone"}
                <br />
                <span className="tabular-nums">{formatNumber(m.km)} km</span>
              </span>
            </div>
          ))}
        {leaderKm !== undefined && leaderKm > 0 ? (
          <span className="absolute -top-1.5 -translate-x-1/2 text-base" style={{ left: pct(leaderKm) }} title={`Leader: ${formatNumber(leaderKm, 1)} km`} aria-label={`Leader at ${formatNumber(leaderKm, 1)} km`}>
            🏃
          </span>
        ) : null}
      </div>
    </div>
  )
}
