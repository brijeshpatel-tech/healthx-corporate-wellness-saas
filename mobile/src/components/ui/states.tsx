import { CloudOff, RotateCw, type LucideIcon } from "lucide-react-native"
import { useEffect, useState } from "react"
import { Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native"
import { errorMessage } from "@/lib/api/hooks"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"
import { Button } from "./button"
import { Text } from "./text"

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: { label: string; onPress: () => void; icon?: LucideIcon }
  style?: StyleProp<ViewStyle>
  compact?: boolean
}

/** Friendly "nothing here yet" block with a helpful action. */
export function EmptyState({ icon: Icon, title, description, action, style, compact }: EmptyStateProps) {
  const { colors } = useTheme()
  return (
    <View style={[styles.wrap, compact && styles.compact, style]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
        <Icon size={26} color={colors.primary} strokeWidth={2} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {description ? (
        <Text variant="body" tone="muted" align="center" style={styles.desc}>
          {description}
        </Text>
      ) : null}
      {action ? <Button title={action.label} icon={action.icon} onPress={action.onPress} size="md" style={styles.action} /> : null}
    </View>
  )
}

export interface ErrorStateProps {
  error?: unknown
  /** Screen-specific message from the spec, e.g. "Couldn't load your history." */
  title?: string
  onRetry?: () => void
  retrying?: boolean
  style?: StyleProp<ViewStyle>
}

/** Error block with the API message and a Retry button. */
export function ErrorState({ error, title = "Something went wrong", onRetry, retrying, style }: ErrorStateProps) {
  const { colors } = useTheme()
  return (
    <View style={[styles.wrap, style]} accessibilityRole="alert">
      <View style={[styles.iconWrap, { backgroundColor: colors.destructiveSoft }]}>
        <CloudOff size={26} color={colors.destructive} strokeWidth={2} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {error ? (
        <Text variant="body" tone="muted" align="center" style={styles.desc}>
          {errorMessage(error)}
        </Text>
      ) : null}
      {onRetry ? <Button title="Retry" icon={RotateCw} variant="outline" size="md" loading={retrying} onPress={onRetry} style={styles.action} /> : null}
    </View>
  )
}

export interface SkeletonProps {
  width?: DimensionValue
  height?: number
  radius?: number
  style?: StyleProp<ViewStyle>
}

/** Pulsing placeholder while data loads. */
export function Skeleton({ width = "100%", height = 16, radius = RADIUS.md, style }: SkeletonProps) {
  const { colors } = useTheme()
  const [opacity] = useState(() => new Animated.Value(0.55))
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [opacity])
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.skeleton, opacity }, style]} />
}

/** A column of skeleton cards — a quick loading layout for most screens. */
export function SkeletonList({ count = 4, height = 88, header = true }: { count?: number; height?: number; header?: boolean }) {
  return (
    <View style={styles.list} accessibilityLabel="Loading" accessibilityRole="progressbar">
      {header ? <Skeleton height={180} radius={RADIUS.xl} /> : null}
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} height={height} radius={RADIUS.xl} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", paddingVertical: 40, paddingHorizontal: 24, gap: 8 },
  compact: { paddingVertical: 20 },
  iconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  desc: { maxWidth: 320 },
  action: { marginTop: 12, alignSelf: "center" },
  list: { gap: 12 },
})
