/**
 * Placeholder for screens that aren't built yet. Replace the route file with the real screen
 * (keep the same path so links from Home / Profile keep working).
 */
import { LinearGradient } from "expo-linear-gradient"
import { router } from "expo-router"
import { Sparkles, type LucideIcon } from "lucide-react-native"
import { StyleSheet, View } from "react-native"
import { Button, Card, Screen, Text } from "@/components/ui"
import { useTheme } from "@/theme/theme"
import { BRAND_GRADIENT } from "@/theme/tokens"

export interface ComingSoonProps {
  title: string
  /** What the screen will do (from the spec). */
  description: string
  icon?: LucideIcon
  /** Spec ids, e.g. "SCR-M-042 – SCR-M-047". */
  spec?: string
  /** Bullet list of what's coming. */
  features?: string[]
  /** Tab roots have no back button. */
  inTabs?: boolean
}

export function ComingSoon({ title, description, icon: Icon = Sparkles, spec, features, inTabs }: ComingSoonProps) {
  const { colors } = useTheme()
  return (
    <Screen title={inTabs ? title : undefined} large={inTabs} back={!inTabs} inTabs={inTabs} subtitle={inTabs ? undefined : spec}>
      <View style={styles.center}>
        <LinearGradient colors={[...BRAND_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.icon}>
          <Icon size={38} color="#ffffff" strokeWidth={2} />
        </LinearGradient>
        {!inTabs ? (
          <Text variant="title" align="center">
            {title}
          </Text>
        ) : null}
        <View style={[styles.pill, { backgroundColor: colors.primarySoft }]}>
          <Text variant="label" tone="primary">
            Coming in the next build
          </Text>
        </View>
        <Text variant="body" tone="muted" align="center" style={styles.desc}>
          {description}
        </Text>
      </View>
      {features?.length ? (
        <Card>
          <View style={styles.list}>
            {features.map((f) => (
              <View key={f} style={styles.item}>
                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                <Text variant="body" style={styles.flex}>
                  {f}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
      {spec && inTabs ? (
        <Text variant="small" tone="muted" align="center">
          {spec}
        </Text>
      ) : null}
      {!inTabs ? <Button title="Back to Home" variant="outline" onPress={() => router.replace("/home")} /> : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: "center", gap: 12, paddingTop: 32, paddingBottom: 8 },
  icon: { width: 84, height: 84, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  desc: { maxWidth: 360 },
  list: { gap: 12 },
  item: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  flex: { flex: 1 },
})
