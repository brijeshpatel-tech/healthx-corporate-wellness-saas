/** Account & settings helpers (SCR-M-070 … 078): choice chips, verify-code sheet, time picker options, standalone screens. */
import { LinearGradient } from "expo-linear-gradient"
import { Check, type LucideIcon } from "lucide-react-native"
import { useState, type ReactNode } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { BottomSheet, Button, OtpInput, Screen, Text } from "@/components/ui"
import { env } from "@/config/env"
import { errorMessage } from "@/lib/api/hooks"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import { useTheme } from "@/theme/theme"
import { RADIUS, type TintName } from "@/theme/tokens"

export interface Choice<T extends string> {
  value: T
  label: string
  description?: string
  emoji?: string
  disabled?: boolean
  hint?: string
}

/** Wrapping chip / card group for single or multiple choice (goals, activities, food…). */
export function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
  multiple,
  columns,
  error,
  accessibilityLabel,
}: {
  options: Choice<T>[]
  value: T | T[]
  onChange: (v: T | T[]) => void
  multiple?: boolean
  /** Card layout with N columns (with descriptions). Default: chips. */
  columns?: number
  error?: string
  accessibilityLabel?: string
}) {
  const { colors } = useTheme()
  const selected = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v)
  const toggle = (v: T) => {
    haptic.select()
    if (!multiple) return onChange(v)
    const list = Array.isArray(value) ? value : []
    onChange(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  }
  return (
    <View style={styles.gap6} accessibilityRole={multiple ? undefined : "radiogroup"} accessibilityLabel={accessibilityLabel}>
      <View style={[styles.wrap, columns ? styles.cards : null]}>
        {options.map((o) => {
          const on = selected(o.value)
          return (
            <Pressable
              key={o.value}
              accessibilityRole={multiple ? "checkbox" : "radio"}
              accessibilityState={{ checked: on, disabled: o.disabled }}
              accessibilityLabel={o.label}
              disabled={o.disabled}
              onPress={() => toggle(o.value)}
              style={({ pressed }) => [
                columns ? [styles.card, { width: `${100 / columns - 3}%` as `${number}%` }] : styles.chip,
                { borderColor: on ? colors.primary : error ? colors.destructive : colors.border, backgroundColor: on ? colors.primarySoft : colors.card },
                o.disabled && styles.disabled,
                pressed && { opacity: 0.8 },
              ]}
            >
              {o.emoji ? <Text variant={columns ? "heading" : "bodyMedium"}>{o.emoji}</Text> : null}
              <View style={columns ? styles.cardText : undefined}>
                <Text variant="label" tone={on ? "primary" : "default"} numberOfLines={2}>
                  {o.label}
                  {o.hint ? (
                    <Text variant="small" tone="muted">
                      {"  "}
                      {o.hint}
                    </Text>
                  ) : null}
                </Text>
                {columns && o.description ? (
                  <Text variant="small" tone="muted" numberOfLines={2}>
                    {o.description}
                  </Text>
                ) : null}
              </View>
              {on && !columns ? <Check size={14} color={colors.primary} strokeWidth={3} /> : null}
              {on && columns ? (
                <View style={[styles.cardCheck, { backgroundColor: colors.primary }]}>
                  <Check size={11} color={colors.primaryForeground} strokeWidth={3} />
                </View>
              ) : null}
            </Pressable>
          )
        })}
      </View>
      {error ? (
        <Text variant="caption" tone="destructive" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  )
}

/** 30-minute steps for quiet-hours pickers. */
export const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 ? "30" : "00"
  return { value: `${String(h).padStart(2, "0")}:${m}`, label: `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? "AM" : "PM"}` }
})
export const timeLabel = (v: string) => TIME_OPTIONS.find((t) => t.value === v)?.label ?? v

/** One-time-code sheet for email / phone verification and re-authentication. */
export function VerifyCodeSheet({ open, title, sentTo, onClose, onVerify, onResend, confirmLabel = "Verify" }: { open: boolean; title: string; sentTo: string; onClose: () => void; onVerify: (code: string) => Promise<void>; onResend: () => Promise<void>; confirmLabel?: string }) {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)
  const submit = async (value = code) => {
    if (!/^\d{6}$/.test(value)) return setError("Enter the 6-digit code.")
    setBusy(true)
    setError(undefined)
    try {
      await onVerify(value)
      setCode("")
    } catch (err) {
      haptic.error()
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  const resend = async () => {
    setResending(true)
    try {
      await onResend()
      toast.success(`New code sent to ${sentTo}`)
    } catch (err) {
      toast.error("Couldn't send the code", { description: errorMessage(err) })
    } finally {
      setResending(false)
    }
  }
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      description={`We sent a 6-digit code to ${sentTo}.${env.useMock ? " Demo: any 6 digits work (000000 = wrong code)." : ""}`}
      footer={
        <>
          <Button title={confirmLabel} loading={busy} onPress={() => submit()} testID="verify-code" />
          <Button title="Resend code" variant="ghost" size="md" loading={resending} onPress={resend} />
        </>
      }
    >
      <OtpInput
        value={code}
        onChange={(v) => {
          setCode(v)
          setError(undefined)
        }}
        onComplete={(v) => submit(v)}
        error={!!error}
      />
      {error ? (
        <Text variant="caption" tone="destructive" align="center">
          {error}
        </Text>
      ) : null}
    </BottomSheet>
  )
}

/** Full-screen message (offline, maintenance, blocked, deleted). */
export function StandaloneScreen({ icon: Icon, tint, eyebrow, title, message, children, testID }: { icon: LucideIcon; tint: TintName; eyebrow: string; title: string; message: string; children?: ReactNode; testID?: string }) {
  const { colors, isDark, tint: getTint } = useTheme()
  const t = getTint(tint)
  return (
    <Screen noHeader testID={testID} background={<LinearGradient pointerEvents="none" colors={isDark ? [t.bg, colors.background] : [t.bg, colors.background]} style={styles.bg} />}>
      <View style={styles.standalone}>
        <View style={[styles.iconRing, { backgroundColor: t.bg, borderColor: colors.card }]}>
          <Icon size={44} color={t.fg} strokeWidth={1.9} />
        </View>
        <Text variant="overline" color={t.fg} align="center">
          {eyebrow}
        </Text>
        <Text variant="title" align="center" accessibilityRole="header">
          {title}
        </Text>
        <Text variant="body" tone="muted" align="center" style={styles.message}>
          {message}
        </Text>
        <View style={styles.actions}>{children}</View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  gap6: { gap: 6 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cards: { gap: 10 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 14, minHeight: 42 },
  card: { flexGrow: 1, borderWidth: 1, borderRadius: RADIUS.lg, padding: 12, gap: 4, minHeight: 64 },
  cardText: { gap: 2, paddingRight: 14 },
  cardCheck: { position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.5 },
  bg: { position: "absolute", top: 0, left: 0, right: 0, height: 360 },
  standalone: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 40 },
  iconRing: { width: 104, height: 104, borderRadius: 52, borderWidth: 4, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  message: { maxWidth: 360 },
  actions: { alignSelf: "stretch", gap: 10, marginTop: 18 },
})
