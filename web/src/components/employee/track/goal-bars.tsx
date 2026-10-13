"use client"

/**
 * Single-series column chart with a dashed goal line (steps, water, sleep).
 * Follows the HealthX chart rules: one series in one colour, bars ≤ 24px with
 * rounded data-ends, hairline grid, one y-axis, tooltip on hover.
 * Days that meet the goal are full strength; the rest are a lighter tint of the same colour.
 */
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatNumber } from "@/lib/format"

export interface GoalBarDatum {
  key: string
  label: string
  value: number
  /** Optional longer label for the tooltip. */
  tooltipLabel?: string
  /** Bar-specific goal (defaults to the chart goal). */
  goal?: number
}

const axisTick = { fill: "var(--muted-foreground)", fontSize: 11 }

export function GoalBars({
  data,
  goal,
  color = "var(--primary)",
  height = 220,
  valueFormatter = (v) => formatNumber(v),
  axisFormatter,
  goalLabel = "Goal",
  highlightKey,
  unitLabel,
}: {
  data: GoalBarDatum[]
  goal?: number
  color?: string
  height?: number
  valueFormatter?: (v: number) => string
  axisFormatter?: (v: number) => string
  goalLabel?: string
  /** Key of a bar to outline (e.g. today / selected day). */
  highlightKey?: string
  unitLabel?: string
}) {
  const max = Math.max(goal ?? 0, ...data.map((d) => Math.max(d.value, d.goal ?? 0)))
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={`${unitLabel ?? "Values"} per period${goal ? `, goal ${valueFormatter(goal)}` : ""}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 14, right: 6, left: -6, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeWidth={1} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} tickMargin={8} interval="preserveStartEnd" minTickGap={4} />
          <YAxis tickLine={false} axisLine={false} tick={axisTick} width={48} domain={[0, Math.ceil(max * 1.12) || 1]} tickFormatter={(v: number) => (axisFormatter ?? valueFormatter)(v)} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            content={(props) => {
              const p = (props.payload as unknown as { payload?: GoalBarDatum }[] | undefined)?.[0]?.payload
              if (!props.active || !p) return null
              const g = p.goal ?? goal
              const met = g !== undefined && p.value >= g
              return (
                <div className="min-w-32 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
                  <p className="mb-1 font-medium text-muted-foreground">{p.tooltipLabel ?? p.label}</p>
                  <p className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: color, opacity: met ? 1 : 0.4 }} />
                    <span className="font-semibold text-foreground tabular-nums">{valueFormatter(p.value)}</span>
                    {unitLabel ? <span className="text-muted-foreground">{unitLabel}</span> : null}
                  </p>
                  {g !== undefined ? <p className="mt-1 text-muted-foreground">{met ? "Goal reached ✓" : `${valueFormatter(Math.max(0, g - p.value))} to goal`}</p> : null}
                </div>
              )
            }}
          />
          {goal !== undefined ? (
            <ReferenceLine
              y={goal}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              strokeOpacity={0.7}
              ifOverflow="extendDomain"
              label={{ value: goalLabel, position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 11 }}
            />
          ) : null}
          <Bar dataKey="value" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => {
              const g = d.goal ?? goal
              const met = g === undefined || d.value >= g
              return <Cell key={d.key} fill={color} fillOpacity={met ? 1 : 0.38} stroke={highlightKey === d.key ? "var(--foreground)" : undefined} strokeWidth={highlightKey === d.key ? 1.5 : 0} />
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
