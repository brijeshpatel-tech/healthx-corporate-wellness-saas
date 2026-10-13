/**
 * Customise Home list (SCR-M-021, Phase 2): drag the handle (or use the arrows) to reorder, switch to show / hide.
 * Mandatory cards can't be hidden; cards for modules the company hasn't enabled are greyed out.
 */
import { ArrowDown, ArrowUp, BarChart3, Droplets, Dumbbell, Footprints, GripVertical, HeartPulse, ListChecks, Lock, Moon, Sparkles, Trophy, type LucideIcon } from "lucide-react-native"
import { useEffect, useState } from "react"
import { Animated, PanResponder, Pressable, StyleSheet, Switch, View, type PanResponderInstance } from "react-native"
import { PhaseBadge, Text } from "@/components/ui"
import type { HomeCardKey, HomeLayout } from "@/lib/api/employee/home"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"
import { RADIUS, shadow, type TintName } from "@/theme/tokens"

export type LayoutRow = HomeLayout["cards"][number]

export const CARD_ICON: Record<HomeCardKey, { icon: LucideIcon; tint: TintName }> = {
  score: { icon: HeartPulse, tint: "habits" },
  steps: { icon: Footprints, tint: "steps" },
  water: { icon: Droplets, tint: "water" },
  workout: { icon: Dumbbell, tint: "workout" },
  habits: { icon: ListChecks, tint: "habits" },
  sleep: { icon: Moon, tint: "sleep" },
  challenge: { icon: Trophy, tint: "points" },
  rank: { icon: BarChart3, tint: "streak" },
  summary: { icon: Sparkles, tint: "insight" },
}

const ROW_H = 68
const GAP = 8
const STRIDE = ROW_H + GAP

interface ReorderBindings {
  rows: LayoutRow[]
  onChange: (rows: LayoutRow[]) => void
  onDrag: (key: HomeCardKey | null) => void
}

/**
 * Drag-to-reorder state that lives outside React renders (gesture events fire many times a second).
 * Rows move as the finger crosses half a row; the lifted row follows the finger via `dy`.
 */
class ReorderController {
  readonly dy = new Animated.Value(0)
  private bindings: ReorderBindings = { rows: [], onChange: () => undefined, onDrag: () => undefined }
  private drag: { start: number; current: number } | null = null
  private responders = new Map<HomeCardKey, PanResponderInstance>()

  bind(b: ReorderBindings) {
    // Keep our own order while dragging; the parent catches up through onChange.
    this.bindings = this.drag ? { ...b, rows: this.bindings.rows } : b
  }

  private commit(next: LayoutRow[]) {
    this.bindings.rows = next
    this.bindings.onChange(next)
  }

  move(from: number, to: number) {
    const list = this.bindings.rows
    if (to < 0 || to >= list.length || from === to) return
    const next = [...list]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item!)
    haptic.select()
    this.commit(next)
  }

  toggle(key: HomeCardKey, visible: boolean) {
    this.commit(this.bindings.rows.map((x) => (x.key === key ? { ...x, visible } : x)))
  }

  responder(key: HomeCardKey) {
    let r = this.responders.get(key)
    if (!r) {
      r = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => this.start(key),
        onPanResponderMove: (_e, g) => this.moveTo(g.dy),
        onPanResponderRelease: () => this.end(),
        onPanResponderTerminate: () => this.end(),
      })
      this.responders.set(key, r)
    }
    return r
  }

  private start(key: HomeCardKey) {
    const i = this.bindings.rows.findIndex((r) => r.key === key)
    this.drag = { start: i, current: i }
    this.dy.setValue(0)
    this.bindings.onDrag(key)
    haptic.tap()
  }

  private moveTo(gdy: number) {
    const d = this.drag
    if (!d) return
    const target = Math.max(0, Math.min(this.bindings.rows.length - 1, d.start + Math.round(gdy / STRIDE)))
    if (target !== d.current) {
      this.move(d.current, target)
      d.current = target
    }
    this.dy.setValue(gdy - (target - d.start) * STRIDE)
  }

  private end() {
    if (!this.drag) return
    this.drag = null
    Animated.spring(this.dy, { toValue: 0, friction: 7, useNativeDriver: true }).start(() => this.bindings.onDrag(null))
  }
}

function DragHandle({ label, responder }: { label: string; responder: PanResponderInstance }) {
  const { colors } = useTheme()
  return (
    <View {...responder.panHandlers} style={styles.handle} accessibilityLabel={`Drag to reorder ${label}`} accessibilityHint="Or use the arrow buttons">
      <GripVertical size={18} color={colors.mutedForeground} />
    </View>
  )
}

export function HomeLayoutEditor({ rows, onChange, onDragChange }: { rows: LayoutRow[]; onChange: (rows: LayoutRow[]) => void; onDragChange: (dragging: boolean) => void }) {
  const { colors, tint, scheme } = useTheme()
  const [dragging, setDragging] = useState<HomeCardKey | null>(null)
  const [ctl] = useState(() => new ReorderController())
  useEffect(() => {
    ctl.bind({
      rows,
      onChange,
      onDrag: (key) => {
        setDragging(key)
        onDragChange(key !== null)
      },
    })
  }, [ctl, rows, onChange, onDragChange])

  return (
    <View style={styles.list}>
      {rows.map((r, i) => {
        const meta = CARD_ICON[r.key]
        const t = tint(meta.tint)
        const off = !r.visible || !r.available
        const isDragging = dragging === r.key
        return (
          <Animated.View
            key={r.key}
            style={[
              styles.row,
              { backgroundColor: off ? colors.muted : colors.card, borderColor: isDragging ? colors.primary : colors.border },
              isDragging && [styles.lifted, shadow(scheme, 2), { transform: [{ translateY: ctl.dy }, { scale: 1.02 }] }],
            ]}
            testID={`layout-${r.key}`}
          >
            <DragHandle label={r.label} responder={ctl.responder(r.key)} />
            <View style={[styles.icon, { backgroundColor: t.bg }, off && styles.faded]}>
              <meta.icon size={18} color={t.fg} />
            </View>
            <View style={styles.body}>
              <View style={styles.titleRow}>
                <Text variant="bodyMedium" numberOfLines={1} style={styles.shrink}>
                  {r.label}
                </Text>
                {r.phase ? <PhaseBadge phase={2} /> : null}
              </View>
              <Text variant="small" tone="muted" numberOfLines={1}>
                {!r.available ? "Not available for your company" : r.mandatory ? "Always shown" : r.description}
              </Text>
            </View>
            <View style={styles.arrows}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Move ${r.label} up`} disabled={i === 0} hitSlop={4} onPress={() => ctl.move(i, i - 1)} style={[styles.arrow, i === 0 && styles.disabled]}>
                <ArrowUp size={15} color={colors.mutedForeground} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Move ${r.label} down`} disabled={i === rows.length - 1} hitSlop={4} onPress={() => ctl.move(i, i + 1)} style={[styles.arrow, i === rows.length - 1 && styles.disabled]}>
                <ArrowDown size={15} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {r.mandatory ? (
              <View style={styles.lock} accessibilityLabel="This card can't be hidden">
                <Lock size={16} color={colors.mutedForeground} />
              </View>
            ) : (
              <Switch
                accessibilityLabel={`Show ${r.label}`}
                value={r.visible && r.available}
                disabled={!r.available}
                onValueChange={(v) => {
                  haptic.select()
                  ctl.toggle(r.key, v)
                }}
                trackColor={{ false: colors.input, true: colors.primary }}
                thumbColor="#ffffff"
                ios_backgroundColor={colors.input}
              />
            )}
          </Animated.View>
        )
      })}
    </View>
  )
}

/** Mini phone preview of the visible cards (tiles sit two per row). */
export function HomePreview({ rows }: { rows: LayoutRow[] }) {
  const { colors, tint } = useTheme()
  const visible = rows.filter((r) => r.visible && r.available)
  const lines: LayoutRow[][] = []
  for (const r of visible) {
    const last = lines[lines.length - 1]
    if (r.size === "tile" && last && last.length === 1 && last[0]!.size === "tile") last.push(r)
    else lines.push([r])
  }
  return (
    <View style={[styles.phone, { borderColor: colors.foreground, backgroundColor: colors.background }]} accessibilityLabel={`Preview: ${visible.map((r) => r.label).join(", ")}`}>
      <View style={[styles.notch, { backgroundColor: colors.border }]} />
      {lines.map((line) => (
        <View key={line.map((r) => r.key).join("-")} style={styles.previewLine}>
          {line.map((r) => (
            <View key={r.key} style={[styles.previewCard, { backgroundColor: tint(CARD_ICON[r.key].tint).fg, height: r.size === "tile" ? 30 : r.size === "wide" ? 22 : 38 }]}>
              <Text variant="small" color="#ffffff" numberOfLines={1} style={styles.previewText}>
                {r.label}
              </Text>
            </View>
          ))}
          {line.length === 1 && line[0]!.size === "tile" ? <View style={styles.previewSpacer} /> : null}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: GAP },
  row: { height: ROW_H, flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 10, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth },
  lifted: { zIndex: 10, borderWidth: 1.5 },
  handle: { width: 36, height: ROW_H, alignItems: "center", justifyContent: "center" },
  icon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  faded: { opacity: 0.45 },
  body: { flex: 1, gap: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  shrink: { flexShrink: 1 },
  arrows: { gap: 2 },
  arrow: { width: 28, height: 24, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.3 },
  lock: { width: 51, alignItems: "center" },
  phone: { alignSelf: "center", width: 200, borderWidth: 3, borderRadius: 26, padding: 10, gap: 5 },
  notch: { width: 56, height: 6, borderRadius: 3, alignSelf: "center", marginBottom: 4 },
  previewLine: { flexDirection: "row", gap: 5 },
  previewCard: { flex: 1, borderRadius: 6, justifyContent: "center", paddingHorizontal: 6 },
  previewText: { fontSize: 9, lineHeight: 11 },
  previewSpacer: { flex: 1 },
})
