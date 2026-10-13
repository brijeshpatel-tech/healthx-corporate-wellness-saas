"use client"

import { Clock, Coins, Flame, ListOrdered, Users } from "lucide-react"
import Link from "next/link"
import { StatusBadge } from "@/components/common/status-badge"
import { Card } from "@/components/ui/card"
import type { WorkoutRow } from "@/lib/api/business/workouts"
import { formatDuration, formatNumber, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"
import { WorkoutActionsMenu } from "./workout-actions"
import { LEVEL_META, LOCATION_META } from "./workout-meta"

/** Three small bars showing the difficulty level. */
export function LevelBars({ level, className }: { level: WorkoutRow["level"]; className?: string }) {
  const bars = LEVEL_META[level].bars
  return (
    <span className={cn("inline-flex items-end gap-0.5", className)} aria-hidden>
      {[1, 2, 3].map((b) => (
        <span key={b} className={cn("w-1 rounded-sm", b === 1 ? "h-1.5" : b === 2 ? "h-2.5" : "h-3.5", b <= bars ? "bg-current" : "bg-current/20")} />
      ))}
    </span>
  )
}

/** Workout card for the list grid: cover, name, level/location, length, exercises, completions. */
export function WorkoutCard({ workout: w }: { workout: WorkoutRow }) {
  const Loc = LOCATION_META[w.location].icon
  return (
    <Card className={cn("group relative gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md", w.status === "archived" && "opacity-75")}>
      <div className="relative flex h-24 items-end justify-between px-4 pb-3" style={{ background: `linear-gradient(135deg, ${w.coverColor}, ${w.coverColor}b3)` }}>
        <span className="text-4xl leading-none drop-shadow-sm" aria-hidden>
          {w.coverEmoji}
        </span>
        <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">{w.category}</span>
        {w.source === "company" ? (
          <div className="absolute top-2.5 right-2.5 rounded-full bg-background/90 shadow-sm">
            <StatusBadge status={w.status} />
          </div>
        ) : (
          <span className="absolute top-2.5 right-2.5 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold text-foreground shadow-sm">HealthX</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Link href={`/business-portal/workouts/${w.id}`} className="line-clamp-1 font-heading font-semibold after:absolute after:inset-0 hover:underline">
              {w.name}
            </Link>
            <p className="mt-0.5 line-clamp-2 min-h-8 text-xs text-muted-foreground">{w.description || "No description yet."}</p>
          </div>
          <div className="relative z-10 -mt-1 -mr-2">
            <WorkoutActionsMenu workout={w} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 text-foreground">
            <LevelBars level={w.level} className="text-primary" />
            {LEVEL_META[w.level].label}
          </span>
          <span className="inline-flex items-center gap-1">
            <Loc className="size-3.5" />
            {LOCATION_META[w.location].label}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            {formatDuration(w.durationMin)}
          </span>
          <span className="inline-flex items-center gap-1">
            <ListOrdered className="size-3.5" />
            {pluralize(w.exercisesCount, "exercise")}
          </span>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Coins className="size-3.5 text-amber-500" />
            <span className="font-medium text-foreground">{formatNumber(w.points)}</span> pts
          </span>
          <span className="inline-flex items-center gap-1">
            <Flame className="size-3.5 text-orange-500" />~{formatNumber(w.calories)} kcal
          </span>
          <span className="ml-auto inline-flex items-center gap-1">
            <Users className="size-3.5" />
            <span className="font-medium text-foreground tabular-nums">{formatNumber(w.completions)}</span> {w.completions === 1 ? "completion" : "completions"}
          </span>
        </div>
      </div>
    </Card>
  )
}
