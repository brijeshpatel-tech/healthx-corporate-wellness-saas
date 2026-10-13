/** HealthX brand mark (gradient tile + pulse icon) and wordmark. */
import { LinearGradient } from "expo-linear-gradient"
import { HeartPulse } from "lucide-react-native"
import { StyleSheet, View } from "react-native"
import { Text } from "@/components/ui"
import { BRAND_GRADIENT } from "@/theme/tokens"

export function BrandMark({ size = 56 }: { size?: number }) {
  return (
    <LinearGradient colors={[...BRAND_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.mark, { width: size, height: size, borderRadius: size * 0.3 }]}>
      <HeartPulse size={size * 0.52} color="#ffffff" strokeWidth={2.2} />
    </LinearGradient>
  )
}

export function BrandLogo({ size = 40, inverse }: { size?: number; inverse?: boolean }) {
  return (
    <View style={styles.row} accessibilityLabel="HealthX">
      <BrandMark size={size} />
      <Text variant="heading" color={inverse ? "#ffffff" : undefined} style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }}>
        Health<Text variant="heading" color={inverse ? "#d1fae5" : "#059669"} style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }}>X</Text>
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  mark: { alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
})
