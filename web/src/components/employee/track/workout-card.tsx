import { Building2, CheckCircle2, Clock, Coins, Dumbbell } from "lucide-react"
import Link from "next/link"
import type { WorkoutCard as WorkoutCardData } from "@/lib/api/employee/workouts"
import { LEVEL_LABEL, LOCATION_LABEL } from "./activity-meta"

/** Workout tile used in the library (cover, title, duration, level, equipment, points). */
export function WorkoutCard({ w }: { w: WorkoutCardData }) {
  return (
    <Link href={`/employee-app/workouts/${w.id}`} className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative flex h-32 items-center justify-center overflow-hidden" style={{ background: `linear-gradient(135deg, ${w.coverColor}, ${w.coverColor}b3)` }}>
        <div className="bg-grid absolute inset-0 opacity-15" />
        <span className="relative text-6xl drop-shadow-sm transition-transform duration-300 group-hover:scale-110">{w.coverEmoji}</span>
        <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur">
          <Coins className="size-3" /> +{w.points} pts
        </span>
        {w.companyMade ? (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-800">
            <Building2 className="size-3" /> Your company
          </span>
        ) : null}
        {w.doneCount ? (
          <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
            <CheckCircle2 className="size-3" /> Done {w.doneCount}×
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div>
          <p className="line-clamp-1 font-semibold">{w.name}</p>
          <p className="text-xs text-muted-foreground">{w.category}</p>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" /> {w.durationMin} min
          </span>
          <span>{LEVEL_LABEL[w.level]}</span>
          <span>{LOCATION_LABEL[w.location]}</span>
          <span className="inline-flex items-center gap-1" title={w.equipment.length ? w.equipment.join(", ") : "No equipment"}>
            <Dumbbell className="size-3.5" /> {w.equipment.length ? w.equipment.length : "None"}
          </span>
        </div>
      </div>
    </Link>
  )
}
