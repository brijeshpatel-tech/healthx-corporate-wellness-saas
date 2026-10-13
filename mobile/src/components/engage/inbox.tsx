/** Announcement rows, pinned cards and type meta (SCR-M-059 / 060). */
import { CalendarDays, ChevronRight, Gift, Lightbulb, Megaphone, Pin, Trophy, type LucideIcon } from "lucide-react-native"
import { Pressable, StyleSheet, View } from "react-native"
import { IconTile, Text } from "@/components/ui"
import type { AnnouncementListItem } from "@/lib/api/employee/announcements"
import { formatRelative } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import type { AnnouncementType } from "@/lib/types"
import { useTheme } from "@/theme/theme"
import type { TintName } from "@/theme/tokens"
import { alpha, go, GradientCard, TintPill } from "./shared"

export interface AnnouncementTypeMeta {
  label: string
  chip: string
  icon: LucideIcon
  tint: TintName
  emoji: string
  color: string
}

export const ANNOUNCEMENT_TYPE: Record<AnnouncementType, AnnouncementTypeMeta> = {
  general: { label: "General", chip: "General", icon: Megaphone, tint: "steps", emoji: "📣", color: "#0ea5e9" },
  wellness_tip: { label: "Wellness tip", chip: "Wellness tips", icon: Lightbulb, tint: "habits", emoji: "💡", color: "#10b981" },
  challenge: { label: "Challenge announcement", chip: "Challenges", icon: Trophy, tint: "points", emoji: "🏆", color: "#f59e0b" },
  reward: { label: "Reward announcement", chip: "Rewards", icon: Gift, tint: "insight", emoji: "🎁", color: "#ec4899" },
  event: { label: "Event", chip: "Events", icon: CalendarDays, tint: "workout", emoji: "📅", color: "#8b5cf6" },
}

export const ANNOUNCEMENT_TYPE_ORDER: AnnouncementType[] = ["general", "wellness_tip", "challenge", "reward", "event"]

export function AnnouncementTypePill({ type, full }: { type: AnnouncementType; full?: boolean }) {
  const { tint } = useTheme()
  const meta = ANNOUNCEMENT_TYPE[type]
  const t = tint(meta.tint)
  return <TintPill label={full ? meta.label : meta.label.replace(" announcement", "")} icon={meta.icon} color={t.fg} bg={t.bg} />
}

/** One announcement in a list: type icon, title (bold + dot when unread), excerpt, sender and time. */
export function AnnouncementRow({ item }: { item: AnnouncementListItem }) {
  const { colors } = useTheme()
  const meta = ANNOUNCEMENT_TYPE[item.type]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.read ? "" : "Unread. "}${item.title}. From ${item.author}, ${formatRelative(item.sentAt)}`}
      onPress={() => {
        haptic.tap()
        go(`/announcements/${item.id}`)
      }}
      style={({ pressed }) => [styles.row, !item.read && { backgroundColor: alpha(colors.primary, 0.05) }, pressed && { opacity: 0.85 }]}
      testID={`announcement-${item.id}`}
    >
      <IconTile icon={meta.icon} tint={meta.tint} size={40} />
      <View style={styles.body}>
        <View style={styles.top}>
          <AnnouncementTypePill type={item.type} />
          {item.pinned ? <Pin size={12} color={colors.mutedForeground} accessibilityLabel="Pinned" /> : null}
          <Text variant="small" tone="muted" style={styles.time}>
            {formatRelative(item.sentAt)}
          </Text>
        </View>
        <View style={styles.titleRow}>
          {!item.read ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
          <Text variant={item.read ? "bodyMedium" : "subtitle"} numberOfLines={2} style={styles.flex}>
            {item.title}
          </Text>
        </View>
        <Text variant="caption" tone="muted" numberOfLines={2}>
          {item.excerpt}
        </Text>
        <Text variant="small" tone="muted">
          From {item.author}
        </Text>
      </View>
      <ChevronRight size={16} color={colors.mutedForeground} style={styles.chev} />
    </Pressable>
  )
}

/** Featured gradient card for pinned announcements. */
export function PinnedAnnouncementCard({ item }: { item: AnnouncementListItem }) {
  const meta = ANNOUNCEMENT_TYPE[item.type]
  return (
    <GradientCard colors={[meta.color, alpha(meta.color, 0.72)]} onPress={() => go(`/announcements/${item.id}`)} accessibilityLabel={`Pinned. ${item.title}`} padding={16}>
      <View style={styles.pinRow}>
        <View style={styles.pinEmoji}>
          <Text style={styles.emoji}>{meta.emoji}</Text>
        </View>
        <View style={styles.flex}>
          <View style={styles.pinEyebrow}>
            <Pin size={12} color="#ffffff" />
            <Text variant="small" color="rgba(255,255,255,0.92)" weight="semibold">
              Pinned · {meta.label}
            </Text>
          </View>
          <Text variant="subtitle" color="#ffffff" numberOfLines={3}>
            {item.title}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.9)" numberOfLines={2}>
            {item.excerpt}
          </Text>
          <Text variant="small" color="rgba(255,255,255,0.8)">
            {item.author} · {formatRelative(item.sentAt)}
          </Text>
        </View>
        {!item.read ? (
          <View style={styles.newTag}>
            <Text variant="small" color="#0f172a" weight="bold">
              NEW
            </Text>
          </View>
        ) : null}
      </View>
    </GradientCard>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 4 },
  row: { flexDirection: "row", gap: 12, padding: 12, borderRadius: 16 },
  body: { flex: 1, gap: 4 },
  top: { flexDirection: "row", alignItems: "center", gap: 6 },
  time: { marginLeft: "auto" },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  chev: { marginTop: 12 },
  pinRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  pinEmoji: { width: 46, height: 46, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 24, lineHeight: 30 },
  pinEyebrow: { flexDirection: "row", alignItems: "center", gap: 4 },
  newTag: { backgroundColor: "#ffffff", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
})
