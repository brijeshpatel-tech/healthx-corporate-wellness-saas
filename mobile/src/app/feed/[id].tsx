/** SCR-M-063 Content Viewer (Phase 2) — article, video, tip or link; save, share, related. Published content only. */
import * as ExpoLinking from "expo-linking"
import { useLocalSearchParams } from "expo-router"
import { CircleCheck, Clock, ExternalLink, Eye, FileX, Lightbulb, Link2, Share2 } from "lucide-react-native"
import { Linking, StyleSheet, View } from "react-native"
import { CategoryPill, ContentCover, ContentRow, SaveLabelled, TYPE_ICON } from "@/components/engage/grow"
import { alpha, go, GroupLabel, shareText } from "@/components/engage/shared"
import { VideoPlayer } from "@/components/engage/video-player"
import { Avatar, Button, Card, EmptyState, ErrorState, PhaseBadge, Screen, Skeleton, Text } from "@/components/ui"
import { CONTENT_CATEGORY_LABEL, CONTENT_TYPE_LABEL, feedApi, type ContentBlock, type ContentDetail } from "@/lib/api/employee/feed"
import { useApiQuery } from "@/lib/api/hooks"
import { formatCompact, formatDate } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

function Blocks({ blocks }: { blocks: ContentBlock[] }) {
  const { colors } = useTheme()
  return (
    <View style={styles.blocks}>
      {blocks.map((b, i) =>
        b.type === "list" ? (
          <View key={i} style={styles.list}>
            {b.intro ? <Text variant="body">{b.intro}</Text> : null}
            {b.items.map((it) => (
              <View key={it} style={[styles.listItem, { backgroundColor: colors.muted }]}>
                <CircleCheck size={18} color={colors.primary} style={styles.mt2} />
                <Text variant="body" style={styles.flex}>
                  {it}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text key={i} variant={b.type === "lead" ? "subtitle" : "body"} selectable style={b.type === "lead" ? styles.lead : undefined}>
            {b.text}
          </Text>
        ),
      )}
    </View>
  )
}

const safeHost = (url: string) => url.replace(/^https?:\/\//, "").split("/")[0] ?? url

function ContentView({ item }: { item: ContentDetail }) {
  const { colors, tint } = useTheme()
  const TypeIcon = TYPE_ICON[item.type]
  const captions = item.blocks.flatMap((b) => (b.type === "list" ? [b.intro ?? "", ...b.items] : b.text.split(/(?<=[.!?])\s+/))).filter(Boolean)
  const share = () => shareText(`${item.title} — ${item.summary}\n${ExpoLinking.createURL(`/feed/${item.id}`)}`, item.title)

  return (
    <>
      {item.type === "video" ? (
        <VideoPlayer title={item.title} emoji={item.coverEmoji} color={item.coverColor} durationSec={item.durationSec ?? item.readMinutes * 60} url={item.url} captions={captions} />
      ) : (
        <View style={styles.coverWrap}>
          <ContentCover item={item} height={item.type === "tip" ? 140 : 190}>
            <View style={styles.coverPill}>
              <CategoryPill category={item.category} onColor />
            </View>
          </ContentCover>
        </View>
      )}

      <View style={styles.header}>
        <View style={styles.eyebrow}>
          <TypeIcon size={13} color={colors.mutedForeground} />
          <Text variant="overline" tone="muted">
            {CONTENT_TYPE_LABEL[item.type]} · {CONTENT_CATEGORY_LABEL[item.category]}
          </Text>
        </View>
        <Text variant="title" accessibilityRole="header">
          {item.title}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.rowSm}>
            <Avatar name={item.fromCompany ? (item.companyName ?? item.author) : item.author} color={item.coverColor} size={26} />
            <Text variant="label">{item.author}</Text>
          </View>
          <View style={styles.rowSm}>
            <Clock size={13} color={colors.mutedForeground} />
            <Text variant="small" tone="muted">
              {item.readMinutes} min {item.type === "video" ? "watch" : "read"}
            </Text>
          </View>
          {item.publishedAt ? (
            <Text variant="small" tone="muted">
              {formatDate(item.publishedAt)}
            </Text>
          ) : null}
          <View style={styles.rowSm}>
            <Eye size={13} color={colors.mutedForeground} />
            <Text variant="small" tone="muted">
              {formatCompact(item.views)}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <SaveLabelled id={item.id} saved={item.saved} />
          <Button title="Share" icon={Share2} variant="outline" size="md" onPress={share} />
        </View>
      </View>

      {item.type === "tip" ? (
        <View style={[styles.tip, { backgroundColor: tint("points").bg, borderColor: alpha("#f59e0b", 0.3) }]}>
          <View style={styles.rowSm}>
            <Lightbulb size={14} color={tint("points").fg} />
            <Text variant="overline" color={tint("points").fg}>
              Quick tip
            </Text>
          </View>
          <Blocks blocks={item.blocks} />
        </View>
      ) : (
        <>
          {item.type === "video" ? <Text variant="heading">About this video</Text> : null}
          <Blocks blocks={item.blocks} />
        </>
      )}

      {item.type === "link" ? (
        <Card>
          <View style={styles.rowCenter}>
            <View style={[styles.linkIcon, { backgroundColor: tint("steps").bg }]}>
              <Link2 size={20} color={tint("steps").fg} />
            </View>
            <View style={styles.flex}>
              <Text variant="label">{item.url ? safeHost(item.url) : "Link unavailable"}</Text>
              <Text variant="small" tone="muted">
                {item.url ? "Opens in your browser." : "This link isn't available right now."}
              </Text>
            </View>
          </View>
          {item.url ? (
            <Button title="Open link" iconRight={ExternalLink} size="md" block style={styles.mt12} onPress={() => Linking.openURL(item.url!).catch(() => toast.error("Couldn't open the link."))} />
          ) : null}
        </Card>
      ) : null}

      {item.tags.length ? (
        <View style={styles.tags}>
          {item.tags.map((t) => (
            <View key={t} style={[styles.tag, { backgroundColor: colors.muted }]}>
              <Text variant="small" tone="muted">
                #{t}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text variant="small" tone="muted">
        {item.fromCompany ? `Shared by ${item.companyName ?? "your company"} for everyone at work.` : "General wellness information from HealthX — not medical advice. Speak to a doctor about any health concerns."}
      </Text>

      {item.related.length ? (
        <View style={styles.group}>
          <GroupLabel>More like this</GroupLabel>
          <Card padding={4}>
            {item.related.map((r) => (
              <ContentRow key={r.id} item={r} />
            ))}
          </Card>
        </View>
      ) : null}
    </>
  )
}

export default function ContentViewerScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>()
  const q = useApiQuery(["employee", "content", id], () => feedApi.content({ id }), { enabled: !!id, retry: (n, e) => e.status !== 404 && n < 1 })
  const backHref = from === "saved" ? "/feed?tab=saved" : from === "explore" ? "/feed?tab=explore" : "/feed"
  return (
    <Screen title={q.data ? CONTENT_TYPE_LABEL[q.data.type] : "Content"} back backHref={backHref} right={<PhaseBadge phase={2} />} refreshing={q.isRefetching} onRefresh={() => q.refetch()} testID="content-viewer">
      {q.data ? (
        <ContentView item={q.data} />
      ) : q.error ? (
        q.error.status === 404 ? (
          <EmptyState icon={FileX} title="This content is unavailable." description="It may have been removed or isn't published yet." action={{ label: "Back to your feed", onPress: () => go("/feed") }} />
        ) : (
          <ErrorState title="This content is unavailable." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
        )
      ) : (
        <>
          <Skeleton height={200} radius={RADIUS.xxl} />
          <Skeleton height={16} width="40%" />
          <Skeleton height={32} width="85%" />
          <Skeleton height={120} radius={RADIUS.lg} />
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt2: { marginTop: 2 },
  mt12: { marginTop: 12 },
  coverWrap: { borderRadius: RADIUS.xxl, overflow: "hidden" },
  coverPill: { position: "absolute", left: 12, top: 12 },
  header: { gap: 10 },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 14, rowGap: 6 },
  rowSm: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 12 },
  actions: { flexDirection: "row", gap: 10 },
  blocks: { gap: 14 },
  lead: { fontSize: 17, lineHeight: 26 },
  list: { gap: 8 },
  listItem: { flexDirection: "row", gap: 10, padding: 12, borderRadius: RADIUS.lg },
  tip: { borderWidth: 1, borderRadius: RADIUS.xl, padding: 14, gap: 10 },
  linkIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  group: { gap: 8, marginTop: 6 },
})
