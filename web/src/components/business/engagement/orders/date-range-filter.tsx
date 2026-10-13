"use client"

import { endOfMonth, format, parseISO, startOfMonth, subDays, subMonths } from "date-fns"
import { CalendarDays, X } from "lucide-react"
import { useState } from "react"
import type { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

export interface DateRangeValue {
  /** YYYY-MM-DD (local), inclusive. */
  from?: string
  to?: string
}

const day = (d: Date) => format(d, "yyyy-MM-dd")

function presets(): { label: string; range: DateRangeValue }[] {
  const today = new Date()
  const lastMonth = subMonths(today, 1)
  return [
    { label: "Today", range: { from: day(today), to: day(today) } },
    { label: "Last 7 days", range: { from: day(subDays(today, 6)), to: day(today) } },
    { label: "Last 30 days", range: { from: day(subDays(today, 29)), to: day(today) } },
    { label: "This month", range: { from: day(startOfMonth(today)), to: day(today) } },
    { label: "Last month", range: { from: day(startOfMonth(lastMonth)), to: day(endOfMonth(lastMonth)) } },
  ]
}

export function rangeLabel(v: DateRangeValue) {
  if (!v.from && !v.to) return "Any date"
  if (v.from && v.to && v.from === v.to) return formatDate(v.from, "d MMM yyyy")
  const sameYear = v.from && v.to && v.from.slice(0, 4) === v.to.slice(0, 4)
  return `${v.from ? formatDate(v.from, sameYear ? "d MMM" : "d MMM yyyy") : "…"} – ${v.to ? formatDate(v.to, "d MMM yyyy") : "today"}`
}

/** Date range filter (from / to) with quick presets. */
export function DateRangeFilter({ value, onChange, className }: { value: DateRangeValue; onChange: (v: DateRangeValue) => void; className?: string }) {
  const [open, setOpen] = useState(false)
  const active = !!(value.from || value.to)
  const selected: DateRange | undefined = value.from ? { from: parseISO(value.from), to: value.to ? parseISO(value.to) : undefined } : undefined

  return (
    <div className={cn("relative inline-flex", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("h-9 w-full justify-start font-normal sm:w-auto", active && "pr-8")} aria-label="Filter by date">
            <CalendarDays data-icon="inline-start" className="text-muted-foreground" />
            <span className={active ? "" : "text-muted-foreground"}>{rangeLabel(value)}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <div className="flex flex-col sm:flex-row">
            <div className="flex flex-wrap gap-1 border-b p-2 sm:w-36 sm:flex-col sm:flex-nowrap sm:border-r sm:border-b-0">
              {presets().map((p) => (
                <Button
                  key={p.label}
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    onChange(p.range)
                    setOpen(false)
                  }}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div>
              <Calendar
                mode="range"
                numberOfMonths={1}
                selected={selected}
                defaultMonth={selected?.from}
                disabled={{ after: new Date() }}
                onSelect={(r) => onChange({ from: r?.from ? day(r.from) : undefined, to: r?.to ? day(r.to) : r?.from ? day(r.from) : undefined })}
              />
              <div className="flex items-center justify-between gap-2 border-t p-2">
                <span className="text-xs text-muted-foreground">{rangeLabel(value)}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" disabled={!active} onClick={() => onChange({})}>
                    Clear
                  </Button>
                  <Button size="sm" onClick={() => setOpen(false)}>
                    Done
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {active ? (
        <button
          type="button"
          onClick={() => onChange({})}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Clear date filter"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  )
}
