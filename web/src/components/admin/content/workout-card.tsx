"use client"

import { Clock, Coins, Dumbbell, ListOrdered, Users } from "lucide-react"
import Link from "next/link"
import { StatusBadge } from "@/components/common/status-badge"
import { Card } from "@/components/ui/card"
import type { WorkoutRow } from "@/lib/api/platform/workouts"
import { formatCompact, formatNumber, formatRelative, pluralize } from "@/lib/format"
import { LevelBadge } from "./bits"
import { LOCATION_ICON, LOCATION_LABEL } from "./meta"
import { WorkoutActionsMenu } from "./workout-actions"

/** Workout card for the library grid. */
export function WorkoutCard({ workout: w }: { workout: WorkoutRow }) {
  return (
    <Card className="group relative gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md">
      <div className="relative flex h-24 items-end justify-between px-4 pb-3" style={{ background: `linear-gradient(135deg, ${w.coverColor}, ${w.coverColor}b3)` }}>
        <span className="text-4xl leading-none drop-shadow-sm" aria-hidden>
          {w.coverEmoji}
        </span>
        <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
          {LOCATION_ICON[w.location]} {LOCATION_LABEL[w.location]}
        </span>
        <div className="absolute top-2.5 right-2.5 rounded-full bg-background/90 shadow-sm">
          <StatusBadge status={w.status} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Link href={`/admin-portal/workouts/${w.id}`} className="line-clamp-1 font-heading font-semibold after:absolute after:inset-0 hover:underline">
              {w.name}
            </Link>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{w.category}</p>
          </div>
          <div className="relative z-10 -mt-1 -mr-2">
            <WorkoutActionsMenu workout={w} />
          </div>
        </div>
        <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">{w.description || "No description yet."}</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <LevelBadge level={w.level} className="text-xs" />
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" /> <span className="font-medium text-foreground">{w.durationMin} min</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ListOrdered className="size-3.5" /> {pluralize(w.exercisesCount, "exercise")}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Dumbbell className="size-3.5 shrink-0" /> <span className="truncate">{w.equipment.length ? w.equipment.join(", ") : "No equipment"}</span>
          </span>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1" title={`${formatNumber(w.completions)} completions`}>
            <Users className="size-3.5" />
            <span className="font-medium text-foreground tabular-nums">{formatCompact(w.completions)}</span> completions
          </span>
          <span className="inline-flex items-center gap-1">
            <Coins className="size-3.5 text-amber-500" />
            <span className="font-medium text-foreground">{formatNumber(w.points)}</span> pts
          </span>
          <span className="ml-auto">Updated {formatRelative(w.updatedAt)}</span>
        </div>
      </div>
    </Card>
  )
}
