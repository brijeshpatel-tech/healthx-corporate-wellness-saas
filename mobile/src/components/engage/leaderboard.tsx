/** Leaderboard pieces: podium, ranked rows with movement, pinned "you" row, privacy note, #348 rank-change toast. */
import { useQueryClient } from "@tanstack/react-query"
import { LinearGradient } from "expo-linear-gradient"
import { ArrowDown, ArrowUp, Crown, EyeOff, Minus, UserRound, UsersRound } from "lucide-react-native"
import { useEffect, useRef } from "react"
import { StyleSheet, View } from "react-native"
import { Avatar, Card, Text } from "@/components/ui"
import { formatNumber } from "@/lib/format"
import { toast } from "@/lib/toast"
import type { LeaderboardEntry, LeaderboardNameDisplay } from "@/lib/types"
import { useTheme } from "@/theme/theme"
import { RADIUS, shadow } from "@/theme/tokens"
import { alpha, PopIn } from "./shared"

/** Leaderboard row as returned by the employee services. */
export interface RankEntry extends LeaderboardEntry {
  masked?: boolean
  group?: boolean
}

const PODIUM = {
  1: { ring: "#f59e0b", block: ["#fbbf24", "#f59e0b"] as const, height: 92 },
  2: { ring: "#94a3b8", block: ["#cbd5e1", "#94a3b8"] as const, height: 66 },
  3: { ring: "#c2774a", block: ["#fdba74", "#ea8a4c"] as const, height: 50 },
} as const

function EntryAvatar({ entry, size }: { entry: RankEntry; size: number }) {
  const { colors } = useTheme()
  if (entry.group)
    return (
      <View style={[styles.round, { width: size, height: size, borderRadius: size / 2, backgroundColor: entry.avatarColor }]}>
        <UsersRound size={size * 0.45} color="#ffffff" />
      </View>
    )
  if (entry.masked && !entry.isMe)
    return (
      <View style={[styles.round, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.muted }]}>
        <UserRound size={size * 0.45} color={colors.mutedForeground} />
      </View>
    )
  return <Avatar name={entry.name} color={entry.avatarColor} size={size} />
}

/** Top-3 podium (2nd · 1st · 3rd) on a soft gold background. */
export function Podium({ entries, unit, valueFormatter = (v) => formatNumber(v) }: { entries: RankEntry[]; unit?: string; valueFormatter?: (v: number) => string }) {
  const { colors, isDark } = useTheme()
  const top = [entries.find((e) => e.rank === 2), entries.find((e) => e.rank === 1), entries.find((e) => e.rank === 3)]
  if (!top[1]) return null
  return (
    <View style={[styles.podiumCard, { borderColor: colors.border }]} accessibilityLabel="Top three">
      <LinearGradient colors={[isDark ? "rgba(245,158,11,0.16)" : "rgba(245,158,11,0.14)", colors.card]} style={StyleSheet.absoluteFill} />
      <View style={styles.podium}>
        {top.map((entry, i) => {
          if (!entry) return <View key={i} style={styles.podiumCol} />
          const s = PODIUM[(entry.rank as 1 | 2 | 3) ?? 3] ?? PODIUM[3]
          const first = entry.rank === 1
          return (
            <View key={entry.id} style={styles.podiumCol} accessible accessibilityLabel={`${entry.rank}. ${entry.isMe ? "You" : entry.name}, ${valueFormatter(entry.value)} ${unit ?? ""}`}>
              <PopIn delay={first ? 0 : 120 * i}>
                <View style={styles.podiumAvatar}>
                  {first ? (
                    <View style={styles.crown}>
                      <Crown size={22} color="#f59e0b" fill="#fbbf24" />
                    </View>
                  ) : null}
                  <View style={[styles.avatarRing, { borderColor: s.ring }]}>
                    <EntryAvatar entry={entry} size={first ? 58 : 46} />
                  </View>
                </View>
              </PopIn>
              <Text variant="label" align="center" numberOfLines={1} tone={entry.isMe ? "primary" : "default"} style={styles.podiumName}>
                {entry.isMe ? "You" : entry.name}
              </Text>
              <Text variant="small" tone="muted" align="center" numberOfLines={1}>
                {valueFormatter(entry.value)}
                {unit ? ` ${unit}` : ""}
              </Text>
              <LinearGradient colors={s.block} style={[styles.block, { height: s.height }]}>
                <Text variant="heading" color="#ffffff">
                  {entry.rank}
                </Text>
              </LinearGradient>
            </View>
          )
        })}
      </View>
    </View>
  )
}

function Movement({ entry }: { entry: RankEntry }) {
  const { colors } = useTheme()
  if (entry.previousRank === undefined) return null
  const diff = entry.previousRank - entry.rank
  if (diff === 0) return <Minus size={12} color={colors.mutedForeground} accessibilityLabel="No change" />
  const up = diff > 0
  const color = up ? colors.success : colors.destructive
  return (
    <View style={styles.move} accessibilityLabel={up ? `Up ${diff}` : `Down ${-diff}`}>
      {up ? <ArrowUp size={11} color={color} strokeWidth={2.6} /> : <ArrowDown size={11} color={color} strokeWidth={2.6} />}
      <Text variant="small" color={color} style={styles.moveText}>
        {Math.abs(diff)}
      </Text>
    </View>
  )
}

/** One ranked row with a bar relative to the leader. */
export function RankRow({ entry, max, unit, valueFormatter = (v) => formatNumber(v), highlight = true }: { entry: RankEntry; max: number; unit?: string; valueFormatter?: (v: number) => string; highlight?: boolean }) {
  const { colors, tint } = useTheme()
  const pct = max > 0 ? Math.max(2, Math.min(100, (entry.value / max) * 100)) : 0
  const me = entry.isMe && highlight
  return (
    <View
      style={[styles.row, me && { backgroundColor: colors.primarySoft, borderColor: alpha(colors.primary, 0.35), borderWidth: 1 }]}
      accessible
      accessibilityLabel={`Rank ${entry.rank}. ${entry.isMe ? "You" : entry.name}. ${valueFormatter(entry.value)} ${unit ?? ""}`}
    >
      <View style={styles.rankCol}>
        <Text variant="label" color={entry.rank <= 3 ? tint("points").fg : colors.mutedForeground}>
          #{entry.rank}
        </Text>
        <Movement entry={entry} />
      </View>
      <EntryAvatar entry={entry} size={36} />
      <View style={styles.flex}>
        <View style={styles.nameRow}>
          <Text variant="bodyMedium" numberOfLines={1} tone={entry.masked && !entry.isMe ? "muted" : "default"} style={styles.shrink}>
            {entry.name}
          </Text>
          {entry.isMe ? (
            <View style={[styles.youTag, { backgroundColor: colors.primary }]}>
              <Text variant="small" color={colors.primaryForeground} weight="bold">
                YOU
              </Text>
            </View>
          ) : null}
          {entry.masked && entry.isMe ? <EyeOff size={12} color={colors.mutedForeground} accessibilityLabel="Hidden from others" /> : null}
        </View>
        <View style={[styles.bar, { backgroundColor: colors.muted }]}>
          <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: entry.isMe ? colors.primary : alpha(colors.primary, 0.45) }]} />
        </View>
        {entry.subtitle ? (
          <Text variant="small" tone="muted" numberOfLines={1}>
            {entry.subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.valueCol}>
        <Text variant="label">{valueFormatter(entry.value)}</Text>
        {unit ? (
          <Text variant="small" tone="muted" numberOfLines={1}>
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

/** Ranked list (after the podium). Returns `meHidden` so the screen can pin the viewer's row. */
export function RankList({ entries, unit, valueFormatter, skipTop = 0 }: { entries: RankEntry[]; unit?: string; valueFormatter?: (v: number) => string; skipTop?: number }) {
  const max = entries[0]?.value ?? 0
  const rows = entries.slice(skipTop)
  if (!rows.length) return null
  return (
    <Card padding={4}>
      {rows.map((e) => (
        <RankRow key={e.id} entry={e} max={max} unit={unit} valueFormatter={valueFormatter} />
      ))}
    </Card>
  )
}

/** The viewer's row, pinned in the screen footer when it isn't in the visible list. */
export function PinnedMe({ me, max, unit, valueFormatter }: { me: RankEntry; max: number; unit?: string; valueFormatter?: (v: number) => string }) {
  const { colors, scheme } = useTheme()
  return (
    <View style={[styles.pinned, { backgroundColor: colors.card, borderColor: alpha(colors.primary, 0.4) }, shadow(scheme, 2)]}>
      <RankRow entry={me} max={max} unit={unit} valueFormatter={valueFormatter} highlight={false} />
    </View>
  )
}

const NAME_MODE_TEXT: Record<LeaderboardNameDisplay, string> = {
  full_name: "Colleagues are shown by full name",
  first_name_initial: "Colleagues are shown by first name and last initial",
  anonymous: "Colleagues are anonymous — only you see your own name",
}

/** Footnote explaining the company's leaderboard privacy setting. */
export function NameDisplayNote({ mode, optedOut }: { mode: LeaderboardNameDisplay; optedOut?: boolean }) {
  const { colors } = useTheme()
  return (
    <View style={styles.note}>
      <EyeOff size={14} color={colors.mutedForeground} style={styles.noteIcon} />
      <Text variant="small" tone="muted" style={styles.flex}>
        {NAME_MODE_TEXT[mode]} (your company&apos;s setting).{" "}
        {optedOut ? "You've hidden yourself from leaderboards — others see you as “Anonymous”." : "You can appear as “Anonymous” — change it in Privacy & consent."}
      </Text>
    </View>
  )
}

/** #348 — show a rank-change alert once (the service also adds it to the notification centre). */
export function useRankAlertToast(alert: string | null | undefined) {
  const qc = useQueryClient()
  const shown = useRef<string | null>(null)
  useEffect(() => {
    if (!alert || shown.current === alert) return
    shown.current = alert
    toast.info(alert, { description: "Rank-change alert · saved in your notifications" })
    void qc.invalidateQueries({ queryKey: ["employee", "notifications"] })
    void qc.invalidateQueries({ queryKey: ["employee", "home"] })
  }, [alert, qc])
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 4 },
  shrink: { flexShrink: 1 },
  round: { alignItems: "center", justifyContent: "center" },
  podiumCard: { borderRadius: RADIUS.xxl, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", paddingTop: 30, paddingHorizontal: 10 },
  podium: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  podiumCol: { flex: 1, alignItems: "center", minWidth: 0 },
  podiumAvatar: { alignItems: "center" },
  crown: { position: "absolute", top: -22, zIndex: 1 },
  avatarRing: { borderWidth: 3, borderRadius: 999, padding: 2 },
  podiumName: { marginTop: 8, alignSelf: "stretch" },
  block: { alignSelf: "stretch", marginTop: 8, borderTopLeftRadius: RADIUS.md, borderTopRightRadius: RADIUS.md, alignItems: "center", paddingTop: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderRadius: RADIUS.lg, minHeight: 60 },
  rankCol: { width: 34, alignItems: "center", gap: 1 },
  move: { flexDirection: "row", alignItems: "center" },
  moveText: { fontSize: 10.5, lineHeight: 13 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  youTag: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  bar: { height: 5, borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },
  valueCol: { alignItems: "flex-end", maxWidth: 96 },
  pinned: { borderRadius: RADIUS.xl, borderWidth: 1, padding: 2 },
  note: { flexDirection: "row", gap: 6, alignItems: "flex-start", paddingHorizontal: 2 },
  noteIcon: { marginTop: 1 },
})
