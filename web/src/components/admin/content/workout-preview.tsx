"use client"

import { Clock, Coins, Flame, Timer } from "lucide-react"
import type { ExerciseWithMedia } from "@/lib/api/platform/exercises"
import type { FitnessLevel, Workout } from "@/lib/types"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { MediaThumb } from "./media-input"
import { LEVEL_LABEL, LOCATION_ICON, LOCATION_LABEL, formatSeconds } from "./meta"

export interface PreviewStep {
  exercise?: ExerciseWithMedia
  mode: "time" | "reps"
  amount: number | ""
  restSec: number | ""
}

/** Shows the workout roughly as the Employee App's workout detail screen would. */
export function WorkoutPreview({
  name,
  description,
  coverEmoji,
  coverColor,
  level,
  location,
  category,
  durationMin,
  calories,
  points,
  steps,
  className,
}: {
  name: string
  description: string
  coverEmoji: string
  coverColor: string
  level: FitnessLevel
  location: Workout["location"]
  category: string
  durationMin: number
  calories: number | ""
  points: number | ""
  steps: PreviewStep[]
  className?: string
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[340px] overflow-hidden rounded-[1.75rem] border-[6px] border-foreground/85 bg-background shadow-xl", className)}>
      <div className="relative px-4 pt-5 pb-4 text-white" style={{ background: `linear-gradient(150deg, ${coverColor}, ${coverColor}b8)` }}>
        <div className="flex items-start justify-between gap-2">
          <span className="text-5xl leading-none drop-shadow" aria-hidden>
            {coverEmoji || "❔"}
          </span>
          <span className="rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm">{category || "Category"}</span>
        </div>
        <h3 className="mt-3 line-clamp-2 font-heading text-lg leading-tight font-bold">{name || "Workout title"}</h3>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-medium">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5">
            <Clock className="size-3" /> {durationMin} min
          </span>
          <span className="rounded-full bg-white/20 px-2 py-0.5">{LEVEL_LABEL[level]}</span>
          <span className="rounded-full bg-white/20 px-2 py-0.5">
            {LOCATION_ICON[location]} {LOCATION_LABEL[location]}
          </span>
        </div>
      </div>
      <div className="space-y-3 p-4">
        {description ? <p className="line-clamp-3 text-xs text-muted-foreground">{description}</p> : null}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-muted/60 py-2">
            <Timer className="mx-auto size-3.5 text-muted-foreground" />
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{steps.length}</div>
            <div className="text-[10px] text-muted-foreground">exercises</div>
          </div>
          <div className="rounded-xl bg-muted/60 py-2">
            <Flame className="mx-auto size-3.5 text-orange-500" />
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{calories === "" ? "—" : formatNumber(calories)}</div>
            <div className="text-[10px] text-muted-foreground">kcal</div>
          </div>
          <div className="rounded-xl bg-muted/60 py-2">
            <Coins className="mx-auto size-3.5 text-amber-500" />
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{points === "" ? "—" : `+${formatNumber(points)}`}</div>
            <div className="text-[10px] text-muted-foreground">points</div>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold">Exercises</p>
          {steps.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">Exercises you add will appear here.</p>
          ) : (
            <ol className="max-h-[420px] space-y-1 overflow-y-auto pr-0.5">
              {steps.map((s, i) => (
                <li key={i}>
                  <div className="flex items-center gap-2.5 rounded-xl border bg-card p-2">
                    <MediaThumb imageUrl={s.exercise?.image?.url} emoji={s.exercise?.mediaEmoji ?? "❔"} hasVideo={!!s.exercise?.video} className="size-8 rounded-lg text-base" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">
                        {i + 1}. {s.exercise?.name ?? "Unknown exercise"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{s.amount === "" ? "—" : s.mode === "reps" ? `${s.amount} reps` : formatSeconds(s.amount)}</div>
                    </div>
                  </div>
                  {i < steps.length - 1 && s.restSec !== "" && s.restSec > 0 ? (
                    <div className="py-0.5 pl-12 text-[10px] text-muted-foreground">Rest {formatSeconds(s.restSec)}</div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="rounded-xl bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground">Start workout</div>
      </div>
    </div>
  )
}
