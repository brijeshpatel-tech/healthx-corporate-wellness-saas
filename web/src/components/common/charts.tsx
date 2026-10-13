"use client"

/**
 * Chart wrappers (Recharts) following the HealthX data-viz rules:
 * - categorical colours come from --chart-1..8 in fixed order (never cycled or ranked)
 * - single-series charts use the brand colour and show no legend box
 * - 2px lines, ~10% area wash, bars ≤ 24px with 4px rounded data-end, hairline solid grid
 * - one y-axis only; tooltip lists every series, value first
 */
import { useId } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

export const SERIES_COLORS = Array.from({ length: 8 }, (_, i) => `var(--chart-${i + 1})`)
export const BRAND_COLOR = "var(--primary)"

export interface Series {
  key: string
  label: string
  /** Defaults to the next categorical slot (or brand colour for a single series). */
  color?: string
}

type Formatter = (value: number) => string

const axisTick = { fill: "var(--muted-foreground)", fontSize: 12 }

function resolveColors(series: Series[]) {
  return series.map((s, i) => s.color ?? (series.length === 1 ? BRAND_COLOR : SERIES_COLORS[i % SERIES_COLORS.length]!))
}

interface TooltipEntry {
  dataKey?: string | number
  name?: string
  value?: number | string
  color?: string
  payload?: Record<string, unknown>
}

function VizTooltip({
  active,
  payload,
  label,
  series,
  colors,
  valueFormatter,
  labelFormatter,
}: {
  active?: boolean
  payload?: readonly TooltipEntry[]
  label?: string | number
  series: Series[]
  colors: string[]
  valueFormatter: Formatter
  labelFormatter?: (label: string) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-36 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      {label !== undefined ? <div className="mb-1.5 font-medium text-muted-foreground">{labelFormatter ? labelFormatter(String(label)) : label}</div> : null}
      <div className="space-y-1">
        {series.map((s, i) => {
          const entry = payload.find((p) => p.dataKey === s.key)
          if (!entry) return null
          return (
            <div key={s.key} className="flex items-center gap-2">
              <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: colors[i] }} />
              <span className="font-semibold text-foreground tabular-nums">{valueFormatter(Number(entry.value ?? 0))}</span>
              <span className="text-muted-foreground">{s.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ChartLegend({ series, colors, shape = "line" }: { series: Series[]; colors?: string[]; shape?: "line" | "rect" }) {
  const c = colors ?? resolveColors(series)
  if (series.length < 2) return null
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {series.map((s, i) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className={shape === "line" ? "h-0.5 w-3.5 rounded-full" : "size-2.5 rounded-[3px]"} style={{ backgroundColor: c[i] }} />
          {s.label}
        </span>
      ))}
    </div>
  )
}

/** Line / area chart over time. */
export function TrendChart({
  data,
  xKey = "date",
  series,
  variant = "area",
  height = 260,
  valueFormatter = (v) => formatNumber(v),
  xFormatter,
  tooltipLabelFormatter,
  yDomain,
  className,
}: {
  data: Record<string, unknown>[]
  xKey?: string
  series: Series[]
  variant?: "area" | "line"
  height?: number
  valueFormatter?: Formatter
  xFormatter?: (value: string) => string
  tooltipLabelFormatter?: (value: string) => string
  yDomain?: [number | "auto", number | "auto"]
  className?: string
}) {
  const uid = useId().replace(/:/g, "")
  const colors = resolveColors(series)
  const Chart = variant === "area" ? AreaChart : LineChart
  return (
    <div className={cn("space-y-3", className)}>
      <ChartLegend series={series} colors={colors} />
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs>
              {series.map((s, i) => (
                <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors[i]} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={colors[i]} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeWidth={1} />
            <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={axisTick} tickMargin={8} minTickGap={24} tickFormatter={xFormatter} />
            <YAxis tickLine={false} axisLine={false} tick={axisTick} width={56} tickFormatter={(v: number) => valueFormatter(v)} domain={yDomain} />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeOpacity: 0.4 }}
              content={(props) => (
                <VizTooltip
                  active={props.active}
                  payload={props.payload as unknown as TooltipEntry[]}
                  label={props.label as string}
                  series={series}
                  colors={colors}
                  valueFormatter={valueFormatter}
                  labelFormatter={tooltipLabelFormatter ?? xFormatter}
                />
              )}
            />
            {series.map((s, i) =>
              variant === "area" ? (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={colors[i]}
                  strokeWidth={2}
                  fill={`url(#${uid}-${s.key})`}
                  dot={false}
                  activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--card)" }}
                />
              ) : (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={colors[i]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--card)" }}
                />
              ),
            )}
          </Chart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Column (vertical) or bar (horizontal) chart. */
export function BarsChart({
  data,
  categoryKey,
  series,
  layout = "vertical",
  stacked,
  height = 260,
  valueFormatter = (v) => formatNumber(v),
  categoryFormatter,
  highlightCategory,
  className,
}: {
  data: Record<string, unknown>[]
  categoryKey: string
  series: Series[]
  /** "vertical" = columns, "horizontal" = bars. */
  layout?: "vertical" | "horizontal"
  stacked?: boolean
  height?: number
  valueFormatter?: Formatter
  categoryFormatter?: (value: string) => string
  /** Category value to emphasise (others are dimmed) — single series only. */
  highlightCategory?: string
  className?: string
}) {
  const colors = resolveColors(series)
  const horizontal = layout === "horizontal"
  return (
    <div className={cn("space-y-3", className)}>
      <ChartLegend series={series} colors={colors} shape="rect" />
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 12, left: horizontal ? 8 : -8, bottom: 0 }} barGap={2} barCategoryGap="24%">
            <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke="var(--chart-grid)" strokeWidth={1} />
            {horizontal ? (
              <>
                <XAxis type="number" tickLine={false} axisLine={false} tick={axisTick} tickFormatter={(v: number) => valueFormatter(v)} />
                <YAxis type="category" dataKey={categoryKey} tickLine={false} axisLine={false} tick={axisTick} width={120} tickFormatter={categoryFormatter} />
              </>
            ) : (
              <>
                <XAxis dataKey={categoryKey} tickLine={false} axisLine={false} tick={axisTick} tickMargin={8} tickFormatter={categoryFormatter} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} tick={axisTick} width={56} tickFormatter={(v: number) => valueFormatter(v)} />
              </>
            )}
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              content={(props) => (
                <VizTooltip active={props.active} payload={props.payload as unknown as TooltipEntry[]} label={props.label as string} series={series} colors={colors} valueFormatter={valueFormatter} labelFormatter={categoryFormatter} />
              )}
            />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={colors[i]}
                stackId={stacked ? "stack" : undefined}
                maxBarSize={24}
                radius={stacked && i < series.length - 1 ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                stroke={stacked ? "var(--card)" : undefined}
                strokeWidth={stacked ? 2 : 0}
              >
                {highlightCategory && series.length === 1
                  ? data.map((row, idx) => <Cell key={idx} fillOpacity={String(row[categoryKey]) === highlightCategory ? 1 : 0.35} />)
                  : null}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Donut with centre label and a legend list (values shown, so colour is never the only key). */
export function DonutChart({
  data,
  centerLabel,
  centerValue,
  height = 200,
  valueFormatter = (v) => formatNumber(v),
  className,
}: {
  data: { name: string; value: number; color?: string }[]
  centerLabel?: string
  centerValue?: string
  height?: number
  valueFormatter?: Formatter
  className?: string
}) {
  const total = data.reduce((a, d) => a + d.value, 0)
  const colors = data.map((d, i) => d.color ?? SERIES_COLORS[i % SERIES_COLORS.length]!)
  return (
    <div className={cn("flex flex-col items-center gap-4 sm:flex-row", className)}>
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="100%" paddingAngle={1.5} stroke="var(--card)" strokeWidth={2} startAngle={90} endAngle={-270}>
              {data.map((d, i) => (
                <Cell key={d.name} fill={colors[i]} />
              ))}
            </Pie>
            <Tooltip
              content={(props) => {
                const p = (props.payload as unknown as TooltipEntry[] | undefined)?.[0]
                if (!props.active || !p) return null
                return (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
                    <span className="font-semibold tabular-nums">{valueFormatter(Number(p.value))}</span> <span className="text-muted-foreground">{p.name}</span>
                  </div>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {centerValue ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-heading text-2xl font-bold tabular-nums">{centerValue}</span>
            {centerLabel ? <span className="text-xs text-muted-foreground">{centerLabel}</span> : null}
          </div>
        ) : null}
      </div>
      <ul className="w-full min-w-0 space-y-2 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: colors[i] }} />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{d.name}</span>
            <span className="font-semibold tabular-nums">{valueFormatter(d.value)}</span>
            <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Tiny trend line for tiles and table rows. */
export function Sparkline({ values, color = BRAND_COLOR, height = 32, className }: { values: number[]; color?: string; height?: number; className?: string }) {
  const data = values.map((v, i) => ({ i, v }))
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 3, right: 3, bottom: 3, left: 3 }}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Circular progress (wellness score, rings). */
export function ProgressRing({
  value,
  max = 100,
  size = 120,
  stroke = 10,
  color = BRAND_COLOR,
  trackColor = "var(--muted)",
  children,
  className,
}: {
  value: number
  max?: number
  size?: number
  stroke?: number
  color?: string
  trackColor?: string
  children?: React.ReactNode
  className?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, max ? value / max : 0))
  return (
    <div className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${Math.round(pct * 100)}%`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}
