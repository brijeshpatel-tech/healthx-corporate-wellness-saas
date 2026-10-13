"use client"

import { ChevronDown } from "lucide-react"
import { Fragment } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { AnalyticsData } from "@/lib/api/platform/analytics"
import { formatNumber, formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Activation funnel: horizontal bars sized against "Invited", with step conversion between rows. */
export function ActivationFunnel({ steps }: { steps: AnalyticsData["funnel"] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => (
        <Fragment key={s.key}>
          {i > 0 ? (
            <li aria-hidden className="flex items-center gap-1.5 py-1.5 pl-1 text-xs text-muted-foreground">
              <ChevronDown className="size-3.5" />
              <span className="font-semibold text-foreground tabular-nums">{formatPercent(s.ofPrevious)}</span> continue
            </li>
          ) : null}
          <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[180px_minmax(0,1fr)_120px]">
            <span className="text-sm font-medium">{s.label}</span>
            <span className="text-right text-sm tabular-nums sm:order-last">
              <span className="font-semibold">{formatNumber(s.value)}</span> <span className="text-xs text-muted-foreground">{formatPercent(s.ofInvited)}</span>
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="col-span-2 h-7 w-full overflow-hidden rounded-md bg-muted sm:col-span-1" tabIndex={0} aria-label={`${s.label}: ${formatNumber(s.value)}`}>
                  <div className="h-full rounded-r-[4px] bg-primary transition-all" style={{ width: `${Math.max(1.5, s.ofInvited * 100)}%`, opacity: 1 - i * 0.12 }} />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {formatNumber(s.value)} {s.label.toLowerCase()} · {formatPercent(s.ofInvited, 1)} of invited
              </TooltipContent>
            </Tooltip>
          </li>
        </Fragment>
      ))}
    </ol>
  )
}

/** Cohort retention table with a single-hue heat tint (brand colour, darker = higher retention). */
export function CohortTable({ rows }: { rows: AnalyticsData["retention"] }) {
  const cell = (v: number | null, label: string, cohort: string) => {
    if (v === null)
      return (
        <td className="p-1">
          <div className="flex h-10 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground" title="Cohort too young">
            —
          </div>
        </td>
      )
    const strength = Math.round(8 + Math.max(0, Math.min(1, v)) * 50)
    return (
      <td className="p-1">
        <div
          className="flex h-10 items-center justify-center rounded-md text-sm font-semibold tabular-nums"
          style={{ backgroundColor: `color-mix(in oklch, var(--primary) ${strength}%, transparent)` }}
          title={`${cohort} cohort · ${label}: ${formatPercent(v, 1)} still active`}
        >
          {formatPercent(v)}
        </div>
      </td>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <th className="p-2 text-left">Signup month</th>
            <th className="p-2 text-right">Employees</th>
            <th className="p-2">Day 7</th>
            <th className="p-2">Day 30</th>
            <th className="p-2">Day 90</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cohort}>
              <td className="p-2 font-medium whitespace-nowrap">{r.cohort}</td>
              <td className="p-2 text-right text-muted-foreground tabular-nums">{formatNumber(r.size)}</td>
              {cell(r.d7, "day 7", r.cohort)}
              {cell(r.d30, "day 30", r.cohort)}
              {cell(r.d90, "day 90", r.cohort)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-16 rounded-sm" style={{ background: "linear-gradient(to right, color-mix(in oklch, var(--primary) 12%, transparent), color-mix(in oklch, var(--primary) 58%, transparent))" }} />
          Lower → higher retention
        </span>
        <span className={cn("inline-flex items-center gap-1.5")}>
          <span className="inline-block h-2.5 w-4 rounded-sm border border-dashed" /> Cohort too young to measure
        </span>
      </div>
    </div>
  )
}
