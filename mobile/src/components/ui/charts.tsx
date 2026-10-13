/**
 * Small SVG charts (single y-axis, palette from the theme, tap a bar / point to see its value).
 * Mark specs follow the dataviz rules: bars ≤ 24 px with a 4 px rounded data-end,
 * 2 px lines, ≥ 8 px markers with a surface ring, hairline recessive grid, text in text colours.
 */
import { useState } from "react"
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native"
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg"
import { formatCompact, formatNumber } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"
import { FONTS } from "@/theme/tokens"
import { Text } from "./text"

export interface ChartPoint {
  /** Unique key (e.g. the date). */
  key: string
  /** Short x-axis label (e.g. "M", "12"). */
  label: string
  value: number
  /** Longer label for the selected-value readout (e.g. "Mon, 12 Oct"). */
  detail?: string
}

/** Clean axis ticks: 0, step, 2·step … covering max. */
function niceTicks(max: number, count = 3) {
  if (max <= 0) return [0, 1]
  const raw = max / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw
  const ticks: number[] = []
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 100) / 100)
  if (ticks[ticks.length - 1]! < max) ticks.push(ticks[ticks.length - 1]! + step)
  return ticks
}

const AXIS_W = 40
const LABEL_H = 22
const TOP = 10

function useWidth() {
  const [width, setWidth] = useState(0)
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))
  return { width, onLayout }
}

function Readout({ point, unit, format, fallback }: { point?: ChartPoint; unit?: string; format: (v: number) => string; fallback?: string }) {
  return (
    <View style={styles.readout}>
      {point ? (
        <Text variant="label" numberOfLines={1}>
          {point.detail ?? point.label} · {format(point.value)}
          {unit ? ` ${unit}` : ""}
        </Text>
      ) : (
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {fallback ?? "Tap a bar to see its value"}
        </Text>
      )}
    </View>
  )
}

export interface BarChartProps {
  data: ChartPoint[]
  /** Horizontal reference line, e.g. the daily goal. */
  goal?: number
  goalLabel?: string
  height?: number
  /** Bar colour (default: brand primary). */
  color?: string
  /** Bars below the goal use a lighter shade of the same colour. */
  dimBelowGoal?: boolean
  unit?: string
  format?: (v: number) => string
  /** Accessible summary, e.g. "Steps per day this week". */
  accessibilityLabel: string
  /** Hide the tap readout row (compact cards). */
  compact?: boolean
}

export function BarChart({ data, goal, goalLabel = "Goal", height = 160, color, dimBelowGoal = true, unit, format = formatNumber, accessibilityLabel, compact }: BarChartProps) {
  const { colors } = useTheme()
  const { width, onLayout } = useWidth()
  const [selected, setSelected] = useState<number | null>(null)
  const barColor = color ?? colors.primary
  const maxValue = Math.max(goal ?? 0, ...data.map((d) => d.value), 1)
  const ticks = niceTicks(maxValue)
  const top = ticks[ticks.length - 1]!
  const plotH = height - LABEL_H - TOP
  const plotW = Math.max(0, width - AXIS_W)
  const slot = data.length ? plotW / data.length : 0
  const barW = Math.max(4, Math.min(24, slot * 0.62))
  const y = (v: number) => TOP + plotH - (v / top) * plotH
  const labelEvery = data.length > 16 ? Math.ceil(data.length / 8) : 1

  const barPath = (x: number, v: number) => {
    const h = Math.max(2, (v / top) * plotH)
    const r = Math.min(4, barW / 2, h)
    const yTop = TOP + plotH - h
    const base = TOP + plotH
    return `M${x},${base} L${x},${yTop + r} Q${x},${yTop} ${x + r},${yTop} L${x + barW - r},${yTop} Q${x + barW},${yTop} ${x + barW},${yTop + r} L${x + barW},${base} Z`
  }

  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="image">
      {!compact ? (
        <Readout point={selected != null ? data[selected] : undefined} unit={unit} format={format} fallback={goal ? `${goalLabel}: ${format(goal)}${unit ? ` ${unit}` : ""} · tap a bar for details` : undefined} />
      ) : null}
      <View style={{ height }} onLayout={onLayout}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {ticks.map((t) => (
              <Line key={t} x1={AXIS_W} x2={width} y1={y(t)} y2={y(t)} stroke={colors.border} strokeWidth={1} />
            ))}
            {ticks.map((t) => (
              <SvgText key={`l${t}`} x={AXIS_W - 8} y={y(t) + 4} fontSize={10.5} fontFamily={FONTS.medium} fill={colors.mutedForeground} textAnchor="end">
                {formatCompact(t)}
              </SvgText>
            ))}
            {data.map((d, i) => {
              const x = AXIS_W + i * slot + (slot - barW) / 2
              const met = goal === undefined || d.value >= goal
              const isSel = selected === i
              return (
                <Path
                  key={d.key}
                  d={barPath(x, d.value)}
                  fill={barColor}
                  opacity={selected != null && !isSel ? 0.35 : dimBelowGoal && !met ? 0.45 : 1}
                />
              )
            })}
            {goal ? (
              <>
                <Line x1={AXIS_W} x2={width} y1={y(goal)} y2={y(goal)} stroke={colors.foreground} strokeOpacity={0.55} strokeWidth={1.5} />
              </>
            ) : null}
            {data.map((d, i) =>
              i % labelEvery === 0 || i === data.length - 1 ? (
                <SvgText
                  key={`x${d.key}`}
                  x={AXIS_W + i * slot + slot / 2}
                  y={height - 6}
                  fontSize={10.5}
                  fontFamily={selected === i ? FONTS.bold : FONTS.medium}
                  fill={selected === i ? colors.foreground : colors.mutedForeground}
                  textAnchor="middle"
                >
                  {d.label}
                </SvgText>
              ) : null,
            )}
          </Svg>
        ) : null}
        {/* Hit targets: whole column per bar (bigger than the mark). */}
        <View style={[StyleSheet.absoluteFill, { left: AXIS_W, flexDirection: "row" }]}>
          {data.map((d, i) => (
            <Pressable
              key={d.key}
              style={{ flex: 1 }}
              accessibilityLabel={`${d.detail ?? d.label}: ${format(d.value)}${unit ? ` ${unit}` : ""}`}
              onPress={() => {
                haptic.select()
                setSelected((s) => (s === i ? null : i))
              }}
            />
          ))}
        </View>
      </View>
    </View>
  )
}

export interface LineChartProps {
  data: ChartPoint[]
  height?: number
  color?: string
  /** Fixed y-range, e.g. [0, 100] for scores. Default 0 … nice max. */
  domain?: [number, number]
  unit?: string
  format?: (v: number) => string
  accessibilityLabel: string
}

export function LineChart({ data, height = 170, color, domain, unit, format = formatNumber, accessibilityLabel }: LineChartProps) {
  const { colors } = useTheme()
  const { width, onLayout } = useWidth()
  const [selected, setSelected] = useState<number | null>(null)
  const stroke = color ?? colors.primary
  const min = domain ? domain[0] : 0
  const ticks = domain ? [domain[0], Math.round((domain[0] + domain[1]) / 2), domain[1]] : niceTicks(Math.max(1, ...data.map((d) => d.value)))
  const top = ticks[ticks.length - 1]!
  const plotH = height - LABEL_H - TOP
  const plotW = Math.max(0, width - AXIS_W - 12)
  const x = (i: number) => AXIS_W + 6 + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2)
  const y = (v: number) => TOP + plotH - ((v - min) / (top - min || 1)) * plotH
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ")
  const area = data.length ? `${line} L${x(data.length - 1)},${TOP + plotH} L${x(0)},${TOP + plotH} Z` : ""
  const last = data.length - 1
  const focus = selected ?? last
  const labelEvery = Math.max(1, Math.ceil(data.length / 6))

  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="image">
      <Readout point={data[focus]} unit={unit} format={format} />
      <View style={{ height }} onLayout={onLayout}>
        {width > 0 && data.length ? (
          <Svg width={width} height={height}>
            {ticks.map((t) => (
              <Line key={t} x1={AXIS_W} x2={width} y1={y(t)} y2={y(t)} stroke={colors.border} strokeWidth={1} />
            ))}
            {ticks.map((t) => (
              <SvgText key={`l${t}`} x={AXIS_W - 8} y={y(t) + 4} fontSize={10.5} fontFamily={FONTS.medium} fill={colors.mutedForeground} textAnchor="end">
                {formatCompact(t)}
              </SvgText>
            ))}
            <Path d={area} fill={stroke} opacity={0.1} />
            <Path d={line} stroke={stroke} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {selected != null ? <Line x1={x(focus)} x2={x(focus)} y1={TOP} y2={TOP + plotH} stroke={colors.mutedForeground} strokeOpacity={0.5} strokeWidth={1} /> : null}
            <Circle cx={x(focus)} cy={y(data[focus]!.value)} r={5} fill={stroke} stroke={colors.card} strokeWidth={2} />
            {data.map((d, i) =>
              i % labelEvery === 0 || i === last ? (
                <SvgText key={`x${d.key}`} x={x(i)} y={height - 6} fontSize={10.5} fontFamily={FONTS.medium} fill={colors.mutedForeground} textAnchor="middle">
                  {d.label}
                </SvgText>
              ) : null,
            )}
          </Svg>
        ) : null}
        <View style={[StyleSheet.absoluteFill, { left: AXIS_W, flexDirection: "row" }]}>
          {data.map((d, i) => (
            <Pressable
              key={d.key}
              style={{ flex: 1 }}
              accessibilityLabel={`${d.detail ?? d.label}: ${format(d.value)}${unit ? ` ${unit}` : ""}`}
              onPress={() => {
                haptic.select()
                setSelected((s) => (s === i ? null : i))
              }}
            />
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  readout: { minHeight: 22, justifyContent: "center", marginBottom: 4 },
})
