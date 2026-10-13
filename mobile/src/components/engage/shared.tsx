/**
 * Building blocks shared by the engagement screens (challenges, leaderboards, rewards, feed, coach, account).
 * Plain StyleSheet + theme tokens, same look as Home: gradient heroes, emoji covers, medallions, confetti.
 */
import { LinearGradient } from "expo-linear-gradient"
import { router } from "expo-router"
import { Search, X, type LucideIcon } from "lucide-react-native"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { ActivityIndicator, Animated, Easing, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { Chip, TextField, Text } from "@/components/ui"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import { useTheme } from "@/theme/theme"
import { RADIUS, shadow } from "@/theme/tokens"

// ─── Navigation & small helpers ─────────────────────────────────────────

/** Push an app path (typed routes are off, so paths are plain strings). */
export const go = (href: string) => router.push(href as never)
export const replace = (href: string) => router.replace(href as never)

/** "#10b981" + 0.2 → "#10b98133". Leaves non-hex colours unchanged. */
export function alpha(color: string, a: number) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color
  return `${color}${Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, "0")}`
}

export const WHITE_70 = "rgba(255,255,255,0.78)"
export const WHITE_85 = "rgba(255,255,255,0.88)"
export const WHITE_20 = "rgba(255,255,255,0.2)"

/** Debounced copy of a value (search boxes). */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** Current time, ticking every second (countdowns). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

/** Native share sheet (web: Web Share API, else copy to clipboard). */
export async function shareText(message: string, title?: string) {
  try {
    if (Platform.OS === "web") {
      const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { share?: (d: { title?: string; text?: string }) => Promise<void> }) : undefined
      if (nav?.share) await nav.share({ title, text: message })
      else if (nav?.clipboard) {
        await nav.clipboard.writeText(message)
        toast.success("Copied to clipboard")
      }
      return
    }
    await Share.share({ message, title })
  } catch {
    // Dismissed by the user — nothing to do.
  }
}

/** Copy on web; share sheet on phones (no clipboard module in this build). Long-press on selectable text also copies. */
export async function copyText(text: string, what: string) {
  if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${what} copied`)
    } catch {
      toast.error("Couldn't copy — select the text instead.")
    }
    return
  }
  await shareText(text, what)
}

/** Save a text file: browser download on web, share sheet ("Save to Files", email…) on phones. */
export async function saveTextFile(fileName: string, content: string, mime = "application/json") {
  if (Platform.OS === "web" && typeof document !== "undefined") {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    return
  }
  await Share.share({ title: fileName, message: content })
}

// ─── Surfaces ───────────────────────────────────────────────────────────

export interface GradientCardProps {
  colors: readonly [string, string, ...string[]]
  children: ReactNode
  /** Big faded emoji in the corner. */
  emoji?: string
  padding?: number
  radius?: number
  onPress?: () => void
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Colourful hero card (gradient, decorative emoji, soft rings). Text inside should be white. */
export function GradientCard({ colors, children, emoji, padding = 18, radius = RADIUS.xxl, onPress, accessibilityLabel, style, testID }: GradientCardProps) {
  const body = (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ borderRadius: radius, padding, overflow: "hidden" }, style]}>
      <View pointerEvents="none" style={[styles.ring, { top: -60, right: -40, width: 170, height: 170 }]} />
      <View pointerEvents="none" style={[styles.ring, { bottom: -70, left: -50, width: 150, height: 150, opacity: 0.6 }]} />
      {emoji ? (
        <View pointerEvents="none" style={styles.bigEmojiWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={styles.bigEmoji}>{emoji}</Text>
        </View>
      ) : null}
      {children}
    </LinearGradient>
  )
  if (!onPress) return <View testID={testID}>{body}</View>
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        haptic.tap()
        onPress()
      }}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  )
}

/** Small translucent pill for text on a gradient. */
export function OnColorPill({ label, icon: Icon, dark, style }: { label: string; icon?: LucideIcon; dark?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.onPill, { backgroundColor: dark ? "rgba(0,0,0,0.18)" : WHITE_20 }, style]}>
      {Icon ? <Icon size={13} color="#ffffff" strokeWidth={2.4} /> : null}
      <Text variant="small" color="#ffffff" weight="semibold" numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

/** Button for use on gradients: white ("solid") or translucent ("glass"). */
export function HeroButton({ title, icon: Icon, onPress, loading, variant = "solid", testID }: { title: string; icon?: LucideIcon; onPress: () => void; loading?: boolean; variant?: "solid" | "glass"; testID?: string }) {
  const solid = variant === "solid"
  const fg = solid ? "#0f172a" : "#ffffff"
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ busy: !!loading, disabled: !!loading }}
      disabled={loading}
      onPress={() => {
        haptic.tap()
        onPress()
      }}
      style={({ pressed }) => [styles.heroBtn, { backgroundColor: solid ? "#ffffff" : "rgba(255,255,255,0.18)" }, pressed && styles.pressed, loading && { opacity: 0.7 }]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : Icon ? <Icon size={16} color={fg} strokeWidth={2.3} /> : null}
      <Text variant="label" color={fg} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  )
}

/** Tinted pill (status / counts) for light surfaces. */
export function TintPill({ label, color, bg, icon: Icon, style }: { label: string; color: string; bg: string; icon?: LucideIcon; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.onPill, { backgroundColor: bg }, style]}>
      {Icon ? <Icon size={13} color={color} strokeWidth={2.4} /> : null}
      <Text variant="small" color={color} weight="semibold" numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

/** Emoji on a soft tinted square (challenge covers, rewards, programs). */
export function EmojiTile({ emoji, color, size = 48, solid, style }: { emoji: string; color: string; size?: number; solid?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size * 0.3, alignItems: "center", justifyContent: "center", overflow: "hidden" }, style]}>
      {solid ? (
        <LinearGradient colors={[color, alpha(color, 0.75)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      ) : (
        <LinearGradient colors={[alpha(color, 0.28), alpha(color, 0.1)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      <Text style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }}>{emoji}</Text>
    </View>
  )
}

const MEDALLION = { sm: 48, md: 64, lg: 96, xl: 124 } as const

/** Glowing emoji medallion for badges and celebrations. */
export function Medallion({ emoji, color, size = "lg", locked }: { emoji: string; color: string; size?: keyof typeof MEDALLION; locked?: boolean }) {
  const { colors } = useTheme()
  const d = MEDALLION[size]
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.medallion,
        { width: d, height: d, borderRadius: d / 2, borderWidth: size === "sm" ? 2 : 3, borderColor: locked ? colors.border : alpha(color, 0.4), backgroundColor: locked ? colors.muted : alpha(color, 0.16) },
        !locked && Platform.OS !== "android" ? { shadowColor: color, shadowOpacity: 0.35, shadowRadius: d / 5, shadowOffset: { width: 0, height: d / 12 } } : null,
      ]}
    >
      {!locked ? <LinearGradient colors={[alpha(color, 0.38), alpha(color, 0.06)]} start={{ x: 0.2, y: 0.1 }} end={{ x: 0.8, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: d / 2 }]} /> : null}
      <Text style={{ fontSize: d * 0.46, lineHeight: d * 0.58, opacity: locked ? 0.35 : 1 }}>{emoji}</Text>
    </View>
  )
}

// ─── Confetti & celebration ─────────────────────────────────────────────

const CONFETTI_COLORS = ["#10b981", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6", "#f97316", "#14b8a6", "#facc15"]

/** Lightweight confetti burst (Animated, no packages). Remount with a new `key` to play again. */
export function Confetti({ pieces = 36, height = 560 }: { pieces?: number; height?: number }) {
  const anims = useMemo(() => Array.from({ length: pieces }, () => new Animated.Value(0)), [pieces])
  useEffect(() => {
    const all = anims.map((a, i) =>
      Animated.timing(a, { toValue: 1, duration: 1700 + ((i * 29) % 1300), delay: (i * 53) % 700, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== "web" }),
    )
    Animated.parallel(all).start()
    return () => all.forEach((x) => x.stop())
  }, [anims])
  return (
    <View pointerEvents="none" style={styles.confetti} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {anims.map((a, i) => {
        const size = 6 + ((i * 17) % 6)
        const round = i % 3 === 0
        const drift = ((i * 71) % 160) - 80
        const spin = 240 + ((i * 97) % 600)
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              top: -16,
              left: `${(i * 37 + 11) % 100}%`,
              width: size,
              height: round ? size : size * 0.45,
              borderRadius: round ? size / 2 : 2,
              backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              opacity: a.interpolate({ inputRange: [0, 0.08, 0.8, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, height] }) },
                { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, drift] }) },
                { rotate: a.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${spin}deg`] }) },
              ],
            }}
          />
        )
      })}
    </View>
  )
}

/** Springs its children in (celebration medallions, success marks). */
export function PopIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const [v] = useState(() => new Animated.Value(0))
  useEffect(() => {
    Animated.spring(v, { toValue: 1, delay, friction: 5, tension: 70, useNativeDriver: Platform.OS !== "web" }).start()
  }, [v, delay])
  return <Animated.View style={{ opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }}>{children}</Animated.View>
}

export interface CelebrationProps {
  open: boolean
  onClose: () => void
  emoji: string
  color?: string
  eyebrow?: string
  title: string
  description?: string
  points?: number
  /** Action buttons. */
  children?: ReactNode
}

/** Full-screen-feeling celebration (badge unlocked, program complete). */
export function CelebrationModal({ open, onClose, emoji, color = "#10b981", eyebrow, title, description, points, children }: CelebrationProps) {
  const { colors, tint } = useTheme()
  const p = tint("points")
  useEffect(() => {
    if (open) haptic.success()
  }, [open])
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.celebrateWrap, { backgroundColor: colors.overlay }]}>
        <View style={[styles.celebrateCard, { backgroundColor: colors.card }]} accessibilityRole="alert">
          <LinearGradient colors={[alpha(color, 0.3), alpha(color, 0)]} style={styles.celebrateGlow} />
          {open ? <Confetti pieces={40} height={460} /> : null}
          <PopIn>
            <Medallion emoji={emoji} color={color} size="xl" />
          </PopIn>
          <View style={styles.celebrateText}>
            {eyebrow ? (
              <Text variant="overline" color={color} align="center">
                {eyebrow}
              </Text>
            ) : null}
            <Text variant="title" align="center">
              {title}
            </Text>
            {description ? (
              <Text variant="body" tone="muted" align="center">
                {description}
              </Text>
            ) : null}
          </View>
          {points ? <TintPill label={`+${points} points`} color={p.fg} bg={p.bg} style={styles.center} /> : null}
          {children ? <View style={styles.celebrateActions}>{children}</View> : null}
        </View>
      </View>
    </Modal>
  )
}

// ─── Inputs & filters ───────────────────────────────────────────────────

export interface ChipOption<T extends string> {
  value: T
  label: string
  emoji?: string
  icon?: LucideIcon
  count?: number
}

/** Horizontally scrolling single-select chips (filters). Bleeds to the screen edge. */
export function ChipScroller<T extends string>({ options, value, onChange, accessibilityLabel }: { options: ChipOption<T>[]; value: T; onChange: (v: T) => void; accessibilityLabel?: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.chipRow} accessibilityLabel={accessibilityLabel}>
      {options.map((o) => (
        <Chip
          key={o.value}
          size="sm"
          label={o.count !== undefined ? `${o.label} · ${o.count}` : o.label}
          emoji={o.emoji}
          icon={o.icon}
          selected={o.value === value}
          onPress={() => onChange(o.value)}
          accessibilityLabel={o.count !== undefined ? `${o.label}, ${o.count}` : o.label}
        />
      ))}
    </ScrollView>
  )
}

/** Search box with a clear button. */
export function SearchField({ value, onChangeText, placeholder, testID }: { value: string; onChangeText: (t: string) => void; placeholder: string; testID?: string }) {
  const { colors } = useTheme()
  return (
    <TextField
      icon={Search}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      returnKeyType="search"
      autoCorrect={false}
      accessibilityLabel={placeholder}
      testID={testID}
      right={
        value ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => onChangeText("")}>
            <X size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : undefined
      }
    />
  )
}

// ─── Text blocks ────────────────────────────────────────────────────────

/** Uppercase group label above a list. */
export function GroupLabel({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={styles.groupLabel}>
      <Text variant="overline" tone="muted" style={styles.flex}>
        {children}
      </Text>
      {right}
    </View>
  )
}

/** Key / value rows inside a card (order details, transaction detail). */
export function InfoRows({ rows }: { rows: [string, string][] }) {
  const { colors } = useTheme()
  return (
    <View style={[styles.infoRows, { borderColor: colors.border, backgroundColor: colors.card }]}>
      {rows.map(([k, v], i) => (
        <View key={k} style={[styles.infoRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
          <Text variant="caption" tone="muted" style={styles.infoKey}>
            {k}
          </Text>
          <Text variant="label" align="right" style={styles.flex} selectable>
            {v}
          </Text>
        </View>
      ))}
    </View>
  )
}

/** Card section with an icon tile header (forms, settings). */
export function SectionCard({ icon: Icon, tint = "neutral", title, description, right, children, style }: { icon?: LucideIcon; tint?: Parameters<ReturnType<typeof useTheme>["tint"]>[0]; title: string; description?: string; right?: ReactNode; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors, scheme, tint: getTint } = useTheme()
  const t = getTint(tint)
  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }, shadow(scheme), style]}>
      <View style={styles.sectionHead}>
        {Icon ? (
          <View style={[styles.sectionIcon, { backgroundColor: t.bg }]}>
            <Icon size={17} color={t.fg} strokeWidth={2.2} />
          </View>
        ) : null}
        <View style={styles.flex}>
          <Text variant="subtitle">{title}</Text>
          {description ? (
            <Text variant="caption" tone="muted">
              {description}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  )
}

/** Bullet line with a coloured dot. */
export function Bullet({ children, color }: { children: ReactNode; color?: string }) {
  const { colors } = useTheme()
  return (
    <View style={styles.bullet}>
      <View style={[styles.bulletDot, { backgroundColor: color ?? colors.primary }]} />
      {typeof children === "string" ? (
        <Text variant="caption" tone="muted" style={styles.flex}>
          {children}
        </Text>
      ) : (
        <View style={styles.flex}>{children}</View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignSelf: "center" },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  ring: { position: "absolute", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.10)" },
  bigEmojiWrap: { position: "absolute", right: -6, top: -18 },
  bigEmoji: { fontSize: 112, lineHeight: 140, opacity: 0.16 },
  heroBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 40, paddingHorizontal: 14, borderRadius: RADIUS.md },
  onPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, height: 24, borderRadius: RADIUS.pill, alignSelf: "flex-start" },
  medallion: { alignItems: "center", justifyContent: "center", overflow: Platform.OS === "android" ? "hidden" : "visible" },
  confetti: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" },
  celebrateWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  celebrateCard: { width: "100%", maxWidth: 400, borderRadius: RADIUS.xxl, paddingHorizontal: 22, paddingTop: 34, paddingBottom: 22, alignItems: "center", gap: 14, overflow: "hidden" },
  celebrateGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 220 },
  celebrateText: { gap: 6, alignItems: "center" },
  celebrateActions: { alignSelf: "stretch", gap: 8, marginTop: 4 },
  bleed: { marginHorizontal: -16, flexGrow: 0 },
  chipRow: { gap: 8, paddingHorizontal: 16, alignItems: "center" },
  groupLabel: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 2, marginBottom: -6 },
  infoRows: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  infoKey: { flexShrink: 0, maxWidth: "45%" },
  section: { borderRadius: RADIUS.xl, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 14 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  sectionIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  bullet: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
})
