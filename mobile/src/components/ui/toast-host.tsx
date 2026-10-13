import { CheckCircle2, Info, XCircle } from "lucide-react-native"
import { useEffect, useState } from "react"
import { Animated, Pressable, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { haptic } from "@/lib/haptics"
import { useToastStore, type ToastItem } from "@/lib/toast"
import { useTheme } from "@/theme/theme"
import { RADIUS, shadow } from "@/theme/tokens"
import { Text } from "./text"

/** Renders toasts from `toast.success()/error()/info()` at the top of the screen. Mount once in the root layout. */
export function ToastHost() {
  const items = useToastStore((s) => s.items)
  const insets = useSafeAreaInsets()
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
      {items.map((t) => (
        <ToastView key={t.id} item={t} />
      ))}
    </View>
  )
}

function ToastView({ item }: { item: ToastItem }) {
  const { colors, scheme } = useTheme()
  const dismiss = useToastStore((s) => s.dismiss)
  const [anim] = useState(() => new Animated.Value(0))

  useEffect(() => {
    if (item.tone === "error") haptic.error()
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8, tension: 80 }).start()
    const timer = setTimeout(() => dismiss(item.id), item.duration ?? (item.action ? 5000 : 3500))
    return () => clearTimeout(timer)
  }, [anim, dismiss, item])

  const Icon = item.tone === "success" ? CheckCircle2 : item.tone === "error" ? XCircle : Info
  const iconColor = item.tone === "success" ? colors.success : item.tone === "error" ? colors.destructive : colors.info

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        { backgroundColor: colors.card, borderColor: colors.border, ...shadow(scheme, 2) },
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] },
      ]}
    >
      <Pressable style={styles.row} onPress={() => dismiss(item.id)} accessibilityLabel={`${item.title}. Dismiss`}>
        <Icon size={20} color={iconColor} strokeWidth={2.2} />
        <View style={styles.text}>
          <Text variant="label">{item.title}</Text>
          {item.description ? (
            <Text variant="caption" tone="muted">
              {item.description}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {item.action ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          style={styles.action}
          onPress={() => {
            item.action!.onPress()
            dismiss(item.id)
          }}
        >
          <Text variant="label" tone="primary">
            {item.action.label}
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: 12, right: 12, gap: 8, alignItems: "center", zIndex: 1000, elevation: 1000 },
  toast: {
    width: "100%",
    maxWidth: 480,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  row: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  text: { flex: 1, gap: 1 },
  action: { paddingHorizontal: 6, paddingVertical: 4 },
})
