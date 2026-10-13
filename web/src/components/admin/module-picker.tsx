"use client"

import {
  Activity,
  Bot,
  CalendarRange,
  ChartColumn,
  Droplets,
  Dumbbell,
  Gift,
  ListChecks,
  Medal,
  Megaphone,
  Moon,
  Newspaper,
  Plug,
  Trophy,
  Utensils,
  type LucideIcon,
} from "lucide-react"
import { useController, type Control, type FieldPath, type FieldValues } from "react-hook-form"
import { FieldShell } from "@/components/common/form-fields"
import { PhaseBadge } from "@/components/common/status-badge"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { MODULE_LABEL, type ModuleCode } from "@/lib/types"
import { cn } from "@/lib/utils"

export const ALL_MODULES = Object.keys(MODULE_LABEL) as ModuleCode[]

export const MODULE_ICON: Record<ModuleCode, LucideIcon> = {
  activity: Activity,
  water: Droplets,
  workouts: Dumbbell,
  habits: ListChecks,
  challenges: Trophy,
  leaderboards: Medal,
  rewards: Gift,
  announcements: Megaphone,
  analytics: ChartColumn,
  sleep: Moon,
  nutrition: Utensils,
  programs: CalendarRange,
  content: Newspaper,
  ai_coach: Bot,
  integrations: Plug,
}

/** Modules planned after the MVP (shown with a Phase 2 tag). */
export const MODULE_PHASE: Partial<Record<ModuleCode, 2 | 3>> = { sleep: 2, nutrition: 2, programs: 2, content: 2, ai_coach: 2, integrations: 2 }

/** Checkbox cards for module entitlements. `available` limits what can be chosen (e.g. plan modules). */
export function ModulePicker({
  value,
  onChange,
  available = ALL_MODULES,
  disabled,
  columns = 3,
}: {
  value: ModuleCode[]
  onChange: (value: ModuleCode[]) => void
  available?: ModuleCode[]
  disabled?: boolean
  columns?: 2 | 3
}) {
  const toggle = (m: ModuleCode) => onChange(value.includes(m) ? value.filter((x) => x !== m) : ALL_MODULES.filter((x) => x === m || value.includes(x)))
  return (
    <div className={cn("grid gap-2 sm:grid-cols-2", columns === 3 && "lg:grid-cols-3")}>
      {ALL_MODULES.map((m) => {
        const Icon = MODULE_ICON[m]
        const checked = value.includes(m)
        const allowed = available.includes(m)
        const id = `module-${m}`
        return (
          <label
            key={m}
            htmlFor={id}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50",
              checked && "border-primary/50 bg-primary/5",
              (!allowed || disabled) && "cursor-not-allowed opacity-50 hover:bg-transparent",
            )}
          >
            <Checkbox id={id} checked={checked} disabled={!allowed || disabled} onCheckedChange={() => toggle(m)} />
            <Icon className={cn("size-4 shrink-0", checked ? "text-primary" : "text-muted-foreground")} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{MODULE_LABEL[m]}</span>
            {MODULE_PHASE[m] ? <PhaseBadge phase={MODULE_PHASE[m]!} /> : null}
          </label>
        )
      })}
    </div>
  )
}

export function ModulePickerField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  available,
  className,
  columns,
}: {
  control: Control<T>
  name: FieldPath<T>
  label?: React.ReactNode
  description?: React.ReactNode
  available?: ModuleCode[]
  className?: string
  columns?: 2 | 3
}) {
  const { field, fieldState } = useController({ control, name })
  return (
    <FieldShell label={label} description={description} error={fieldState.error?.message} className={className}>
      <ModulePicker value={(field.value as ModuleCode[]) ?? []} onChange={field.onChange} available={available} columns={columns} />
    </FieldShell>
  )
}

/** Compact module list for tables and cards. */
export function ModuleBadges({ modules, max = 4, className }: { modules: ModuleCode[]; max?: number; className?: string }) {
  const shown = modules.slice(0, max)
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {shown.map((m) => (
        <Badge key={m} variant="secondary" className="font-normal">
          {MODULE_LABEL[m].split(" (")[0]}
        </Badge>
      ))}
      {modules.length > max ? (
        <Badge variant="outline" className="font-normal">
          +{modules.length - max}
        </Badge>
      ) : null}
    </div>
  )
}
