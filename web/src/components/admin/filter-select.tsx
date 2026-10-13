"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Period } from "@/lib/api/platform/common"
import { cn } from "@/lib/utils"

/**
 * Compact filter dropdown with an "All …" option (value "all").
 *   <FilterSelect value={status} onChange={setStatus} allLabel="All statuses" options={[{ value: "active", label: "Active" }]} />
 */
export function FilterSelect({
  value,
  onChange,
  options,
  allLabel,
  className,
  placeholder,
  "aria-label": ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: React.ReactNode }[]
  allLabel?: string
  className?: string
  placeholder?: string
  "aria-label"?: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-9 w-full sm:w-40", className)} aria-label={ariaLabel ?? allLabel}>
        <SelectValue placeholder={placeholder ?? allLabel} />
      </SelectTrigger>
      <SelectContent>
        {allLabel ? <SelectItem value="all">{allLabel}</SelectItem> : null}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const PERIODS: { value: Period; label: string; short: string }[] = [
  { value: "7d", label: "7 days", short: "7D" },
  { value: "30d", label: "30 days", short: "30D" },
  { value: "90d", label: "90 days", short: "90D" },
  { value: "12m", label: "12 months", short: "12M" },
]

/** Date-range presets shared by dashboards and analytics. */
export function PeriodFilter({
  value,
  onChange,
  periods = ["7d", "30d", "90d", "12m"],
  className,
}: {
  value: Period
  onChange: (value: Period) => void
  periods?: Period[]
  className?: string
}) {
  return (
    <ToggleGroup type="single" variant="outline" value={value} onValueChange={(v) => v && onChange(v as Period)} className={className} aria-label="Date range">
      {PERIODS.filter((p) => periods.includes(p.value)).map((p) => (
        <ToggleGroupItem key={p.value} value={p.value} className="px-3" aria-label={p.label}>
          <span className="hidden sm:inline">{p.label}</span>
          <span className="sm:hidden">{p.short}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
