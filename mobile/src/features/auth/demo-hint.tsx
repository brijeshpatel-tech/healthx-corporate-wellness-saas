/** Demo hints — only shown in sample-data mode (no API URL configured). */
import type { ReactNode } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { Notice, Text } from "@/components/ui"
import { env } from "@/config/env"

export function DemoHint({ title = "Sample-data mode", children }: { title?: string; children: ReactNode }) {
  if (!env.useMock) return null
  return (
    <Notice tone="demo" title={title}>
      {children}
    </Notice>
  )
}

/** Tappable monospace value inside a demo hint (fills the field when tapped). */
export function DemoValue({ value, onPress }: { value: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Use ${value}`} hitSlop={6} style={styles.value}>
      <Text variant="label" style={styles.mono}>
        {value}
      </Text>
    </Pressable>
  )
}

/** A row of demo values. */
export function DemoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  value: { paddingVertical: 2 },
  mono: { textDecorationLine: "underline" },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 2, marginTop: 4 },
})
