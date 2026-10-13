/** Company logo (image or initials on the brand colour) with its name — shown once the company is identified. */
import { Image, StyleSheet, View } from "react-native"
import { Text } from "@/components/ui"
import type { Branding } from "@/lib/types"

export function CompanyLogo({ branding, size = 48 }: { branding?: Partial<Branding> | null; size?: number }) {
  const style = { width: size, height: size, borderRadius: size * 0.28 }
  if (branding?.logoUrl) return <Image source={{ uri: branding.logoUrl }} style={style} accessibilityIgnoresInvertColors />
  return (
    <View style={[style, styles.initials, { backgroundColor: branding?.primaryColor ?? "#0ea5e9" }]}>
      <Text variant="heading" color="#ffffff" style={{ fontSize: size * 0.36, lineHeight: size * 0.46 }}>
        {branding?.logoInitials ?? "HX"}
      </Text>
    </View>
  )
}

export function CompanyBadge({ name, branding, caption }: { name: string; branding?: Partial<Branding> | null; caption?: string }) {
  return (
    <View style={styles.row}>
      <CompanyLogo branding={branding} size={44} />
      <View style={styles.flex}>
        {caption ? (
          <Text variant="small" tone="muted">
            {caption}
          </Text>
        ) : null}
        <Text variant="subtitle" numberOfLines={1}>
          {name}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  initials: { alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
})
