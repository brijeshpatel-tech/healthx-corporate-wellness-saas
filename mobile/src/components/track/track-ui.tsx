/** Small building blocks shared by the tracking screens: stepper, period navigator, fine print, confetti. */
import { ChevronLeft, ChevronRight, Minus, Plus, ShieldAlert, type LucideIcon } from "lucide-react-native"
import { useEffect, useState, type ReactNode } from "react"
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { IconButton, PhaseBadge, Text } from "@/components/ui"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

export interface NumberStepperProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  format?: (value: number) => string
  /** Hint under the value (e.g. the allowed range). */
  hint?: string
  size?: "md" | "lg"
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** − value + control with 44 dp buttons; value is clamped and rounded to the step. */
export function NumberStepper({ label, value, min, max, step, onChange, format = String, hint, size = "md", style, testID }: NumberStepperProps) {
  const set = (v: number) => {
    const next = Math.round(Math.min(max, Math.max(min, v)) / step) * step
    if (next === value) return
    haptic.select()
    onChange(Number(next.toFixed(2)))
  }
  return (
    <View style={[styles.stepper, style]} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: format(value) }} testID={testID}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => set(e.nativeEvent.actionName === "increment" ? value + step : value - step)}
    >
      <IconButton icon={Minus} accessibilityLabel={`Decrease ${label.toLowerCase()}`} onPress={() => set(value - step)} disabled={value <= min} size={size === "lg" ? 52 : 44} />
      <View style={styles.stepperValue}>
        <Text variant={size === "lg" ? "number" : "heading"} numberOfLines={1} adjustsFontSizeToFit>
          {format(value)}
        </Text>
        {hint ? (
          <Text variant="small" tone="muted" numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
      <IconButton icon={Plus} accessibilityLabel={`Increase ${label.toLowerCase()}`} onPress={() => set(value + step)} disabled={value >= max} size={size === "lg" ? 52 : 44} />
    </View>
  )
}

export interface PeriodNavigatorProps {
  label: string
  sublabel?: string
  onPrev: () => void
  onNext: () => void
  prevDisabled?: boolean
  nextDisabled?: boolean
  prevLabel?: string
  nextLabel?: string
}

/** ‹ Label › row for days, weeks and months. */
export function PeriodNavigator({ label, sublabel, onPrev, onNext, prevDisabled, nextDisabled, prevLabel = "Previous", nextLabel = "Next" }: PeriodNavigatorProps) {
  return (
    <View style={styles.period}>
      <IconButton icon={ChevronLeft} variant="ghost" accessibilityLabel={prevLabel} onPress={onPrev} disabled={prevDisabled} />
      <View style={styles.periodLabel}>
        <Text variant="subtitle" align="center" numberOfLines={1} accessibilityLiveRegion="polite">
          {label}
        </Text>
        {sublabel ? (
          <Text variant="small" tone="muted" align="center" numberOfLines={1}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      <IconButton icon={ChevronRight} variant="ghost" accessibilityLabel={nextLabel} onPress={onNext} disabled={nextDisabled} />
    </View>
  )
}

/** "Phase 2" tag for a screen header's right slot (vertically centred with the other actions). */
export function HeaderPhase() {
  return <PhaseBadge phase={2} style={styles.headerPhase} />
}

/** Muted note with an icon — disclaimers ("not medical advice") and small explanations. */
export function FinePrint({ children, icon: Icon = ShieldAlert }: { children: ReactNode; icon?: LucideIcon }) {
  const { colors } = useTheme()
  return (
    <View style={[styles.fine, { backgroundColor: colors.muted, borderColor: colors.border }]} accessibilityRole="text">
      <Icon size={16} color={colors.mutedForeground} style={styles.fineIcon} />
      <Text variant="caption" tone="muted" style={styles.flex}>
        {children}
      </Text>
    </View>
  )
}

/** Big tappable option card with a radio state (goal type, target type…). */
export function OptionCard({ selected, onPress, disabled, children, accessibilityLabel, style, testID }: { selected: boolean; onPress: () => void; disabled?: boolean; children: ReactNode; accessibilityLabel: string; style?: StyleProp<ViewStyle>; testID?: string }) {
  const { colors } = useTheme()
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => {
        haptic.select()
        onPress()
      }}
      style={({ pressed }) => [
        styles.option,
        { backgroundColor: selected ? colors.primarySoft : colors.card, borderColor: selected ? colors.primary : colors.border, borderWidth: selected ? 1.5 : 1 },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      testID={testID}
    >
      {children}
    </Pressable>
  )
}

// ─── Confetti ───────────────────────────────────────────────────────────

const CONFETTI_COLORS = ["#10b981", "#0ea5e9", "#f59e0b", "#8b5cf6", "#f43f5e", "#14b8a6"]
// Deterministic pieces (no randomness during render).
const PIECES = Array.from({ length: 28 }, (_, i) => {
  const angle = (i / 28) * Math.PI * 2
  const dist = 90 + ((i * 37) % 70)
  return {
    x: Math.round(Math.cos(angle) * dist),
    y: Math.round(Math.sin(angle) * dist * 0.8 - 40),
    rot: ((i * 47) % 360) + 360,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
    delay: (i % 6) * 40,
    w: i % 3 === 0 ? 6 : 8,
    h: i % 3 === 0 ? 10 : 6,
  }
})

function Piece({ p, progress }: { p: (typeof PIECES)[number]; progress: Animated.Value }) {
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.x] })
  const translateY = progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, p.y, p.y + 120] })
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.rot}deg`] })
  const opacity = progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] })
  return <Animated.View style={[styles.piece, { width: p.w, height: p.h, backgroundColor: p.color, opacity, transform: [{ translateX }, { translateY }, { rotate }] }]} />
}

/** One-shot confetti burst centred on its parent (skipped when Reduce Motion is on). Re-mount with a new key to replay. */
export function Confetti() {
  const [progress] = useState(() => PIECES.map(() => new Animated.Value(0)))
  useEffect(() => {
    let cancelled = false
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (cancelled || reduced) return
        Animated.stagger(
          8,
          progress.map((v, i) => Animated.timing(v, { toValue: 1, duration: 1400, delay: PIECES[i]!.delay, easing: Easing.bezier(0.2, 0.7, 0.3, 1), useNativeDriver: true })),
        ).start()
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [progress])
  return (
    <View pointerEvents="none" style={styles.confetti} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {PIECES.map((p, i) => (
        <Piece key={i} p={p} progress={progress[i]!} />
      ))}
    </View>
  )
}

/** Springs from 0.6 → 1 when it mounts (check marks, celebration badges). */
export function PopIn({ children, style, delay = 0 }: { children: ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) {
  const [scale] = useState(() => new Animated.Value(0.6))
  const [opacity] = useState(() => new Animated.Value(0))
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 140, delay, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, delay, useNativeDriver: true }),
    ]).start()
  }, [scale, opacity, delay])
  return <Animated.View style={[style, { opacity, transform: [{ scale }] }]}>{children}</Animated.View>
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerPhase: { alignSelf: "center" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepperValue: { flex: 1, alignItems: "center", gap: 2, minWidth: 0 },
  period: { flexDirection: "row", alignItems: "center", gap: 4 },
  periodLabel: { flex: 1, minWidth: 0 },
  fine: { flexDirection: "row", gap: 10, padding: 12, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth },
  fineIcon: { marginTop: 1 },
  option: { borderRadius: RADIUS.xl, padding: 16 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.6 },
  confetti: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", overflow: "visible" },
  piece: { position: "absolute", borderRadius: 2 },
})
