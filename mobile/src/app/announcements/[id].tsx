/** SCR-M-060 Announcement Detail — cover, type, sender, full message, linked challenge, call to action; opening marks it read. */
import { useLocalSearchParams } from "expo-router"
import { ArrowRight, Check, Megaphone, Pin } from "lucide-react-native"
import { useEffect, useRef } from "react"
import { StyleSheet, View } from "react-native"
import { ANNOUNCEMENT_TYPE, AnnouncementRow, AnnouncementTypePill } from "@/components/engage/inbox"
import { alpha, EmojiTile, go, GradientCard, GroupLabel, TintPill } from "@/components/engage/shared"
import { Avatar, Button, Card, EmptyState, ErrorState, Screen, Skeleton, Text } from "@/components/ui"
import { announcementsApi, type AnnouncementDetail } from "@/lib/api/employee/announcements"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDateTime, formatRelative, formatShortDate } from "@/lib/format"
import { openHref } from "@/lib/routes"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

function Detail({ data }: { data: AnnouncementDetail }) {
  const { colors, tint } = useTheme()
  const meta = ANNOUNCEMENT_TYPE[data.type]
  const cover = data.challenge ? { emoji: data.challenge.emoji, color: data.challenge.color } : { emoji: meta.emoji, color: meta.color }
  const paragraphs = data.body.split(/\n{2,}/).filter(Boolean)
  return (
    <>
      <GradientCard colors={[cover.color, alpha(cover.color, 0.7)]} padding={0}>
        <View style={styles.cover}>
          <View style={styles.coverEmoji}>
            <Text style={styles.emoji}>{cover.emoji}</Text>
          </View>
        </View>
      </GradientCard>

      <View style={styles.meta}>
        <AnnouncementTypePill type={data.type} full />
        {data.pinned ? <TintPill label="Pinned" icon={Pin} color={colors.mutedForeground} bg={colors.muted} /> : null}
        <Text variant="small" tone="muted">
          {formatDateTime(data.sentAt)}
        </Text>
      </View>
      <Text variant="title" accessibilityRole="header">
        {data.title}
      </Text>
      <View style={styles.author}>
        <Avatar name={data.author} color={data.authorColor} size={40} />
        <View style={styles.flex}>
          <Text variant="label" numberOfLines={1}>
            {data.author}
            {data.authorTitle ? (
              <Text variant="caption" tone="muted">
                {" "}
                · {data.authorTitle}
              </Text>
            ) : null}
          </Text>
          <Text variant="small" tone="muted" numberOfLines={1}>
            On behalf of {data.companyName} · {formatRelative(data.sentAt)}
          </Text>
        </View>
      </View>

      <View style={[styles.body, { borderTopColor: colors.border }]}>
        {paragraphs.map((p, i) => (
          <Text key={i} variant="body" selectable>
            {p}
          </Text>
        ))}
      </View>

      {data.challenge ? (
        <Card onPress={() => go(`/challenges/${data.challenge!.id}`)} accessibilityLabel={`Open challenge ${data.challenge.name}`}>
          <View style={styles.row}>
            <EmojiTile emoji={data.challenge.emoji} color={data.challenge.color} size={46} solid />
            <View style={styles.flex}>
              <Text variant="label" numberOfLines={1}>
                {data.challenge.name}
              </Text>
              <Text variant="small" tone="muted">
                {data.challenge.status === "scheduled" ? `Starts ${formatShortDate(data.challenge.startDate)}` : data.challenge.status === "completed" ? `Ended ${formatShortDate(data.challenge.endDate)}` : `Ends ${formatShortDate(data.challenge.endDate)}`} · +
                {data.challenge.points} pts
              </Text>
            </View>
            {data.challenge.joined ? <TintPill label="Joined" icon={Check} color={tint("habits").fg} bg={tint("habits").bg} /> : <TintPill label="Not joined" color={colors.primary} bg={colors.primarySoft} />}
          </View>
        </Card>
      ) : null}

      {data.cta ? <Button title={data.cta.label} iconRight={ArrowRight} onPress={() => openHref(data.cta!.href)} testID="announcement-cta" /> : null}

      {data.more.length ? (
        <View style={styles.more}>
          <GroupLabel>{`More from ${data.companyName}`}</GroupLabel>
          <Card padding={4}>
            {data.more.map((a) => (
              <AnnouncementRow key={a.id} item={a} />
            ))}
          </Card>
        </View>
      ) : null}
    </>
  )
}

export default function AnnouncementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const q = useApiQuery(["employee", "announcements", "detail", id], () => announcementsApi.get({ id }), { enabled: !!id, retry: (n, e) => e.status !== 404 && e.status !== 403 && n < 1 })
  const { mutate: markRead } = useApiMutation(announcementsApi.markRead, { invalidate: [["employee", "announcements", "list"], ["employee", "home"], ["employee", "feed"]] })

  // Opening the announcement marks it as read (once per id).
  const marked = useRef<string | null>(null)
  useEffect(() => {
    if (!q.data || q.data.read || marked.current === q.data.id) return
    marked.current = q.data.id
    markRead({ id: q.data.id })
  }, [q.data, markRead])

  return (
    <Screen title="Announcement" back backHref="/announcements" refreshing={q.isRefetching} onRefresh={() => q.refetch()} testID="announcement-detail">
      {q.data ? (
        <Detail data={q.data} />
      ) : q.error ? (
        q.error.status === 404 || q.error.status === 403 ? (
          <EmptyState icon={Megaphone} title="This announcement is no longer available." description="It may have been withdrawn, or it wasn't sent to you." action={{ label: "Back to announcements", onPress: () => go("/announcements") }} />
        ) : (
          <ErrorState title="Couldn't load this announcement." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
        )
      ) : (
        <>
          <Skeleton height={170} radius={RADIUS.xxl} />
          <Skeleton height={20} width="40%" />
          <Skeleton height={34} width="85%" />
          <Skeleton height={140} radius={RADIUS.lg} />
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  cover: { height: 170, alignItems: "center", justifyContent: "center" },
  coverEmoji: { width: 100, height: 100, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 56, lineHeight: 68 },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  author: { flexDirection: "row", alignItems: "center", gap: 12 },
  body: { gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  more: { gap: 8, marginTop: 8 },
})
