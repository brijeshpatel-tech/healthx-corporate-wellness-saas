import { Image, StyleSheet, View } from "react-native"
import { initials } from "@/lib/format"
import { Text } from "./text"

export interface AvatarProps {
  name: string
  color?: string
  photoUrl?: string | null
  size?: number
}

/** Round avatar: photo, or initials on the person's colour. */
export function Avatar({ name, color = "#10b981", photoUrl, size = 44 }: AvatarProps) {
  const style = { width: size, height: size, borderRadius: size / 2 }
  if (photoUrl) return <Image source={{ uri: photoUrl }} style={style} accessibilityLabel={name} />
  return (
    <View style={[styles.base, style, { backgroundColor: color }]} accessibilityLabel={name}>
      <Text variant="label" color="#fff" style={{ fontSize: size * 0.36, lineHeight: size * 0.44 }}>
        {initials(name)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
})
