/** SCR-M-062 Wellness Feed (Phase 2) — For you (daily picks), Explore library, Saved. */
import { useLocalSearchParams } from "expo-router"
import { Bookmark, Compass, Sparkles } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { AchievementFeedCard, AnnouncementFeedCard, ArticleFeedCard, ChallengeFeedCard, ContentRow, ContentTile, TipFeedCard, WorkoutFeedCard } from "@/components/engage/grow"
import { ChipScroller, GroupLabel, SearchField, useDebounced } from "@/components/engage/shared"
import { Button, Card, EmptyState, ErrorState, PhaseBadge, Screen, SegmentedControl, SkeletonList, Text } from "@/components/ui"
import { CONTENT_CATEGORY_LABEL, feedApi, type ContentCategory, type FeedCard, type WellnessFeed } from "@/lib/api/employee/feed"
import { useApiQuery } from "@/lib/api/hooks"
import { formatDate } from "@/lib/format"
import { useTheme } from "@/theme/theme"

type Tab = "for-you" | "explore" | "saved"
const TABS: Tab[] = ["for-you", "explore", "saved"]
const CATEGORIES: (ContentCategory | "all")[] = ["all", "movement", "nutrition", "sleep", "mindfulness", "hydration", "general"]

function FeedCardView({ card }: { card: FeedCard }) {
  switch (card.kind) {
    case "tip":
      return <TipFeedCard item={card.content} />
    case "workout":
      return <WorkoutFeedCard workout={card.workout} />
    case "challenge":
      return <ChallengeFeedCard challenge={card.challenge} />
    case "announcement":
      return <AnnouncementFeedCard announcement={card.announcement} />
    case "article":
      return <ArticleFeedCard item={card.content} />
    case "achievement":
      return <AchievementFeedCard achievement={card.achievement} />
  }
}

function ForYou({ data, onExplore }: { data: WellnessFeed; onExplore: () => void }) {
  const { colors } = useTheme()
  if (!data.cards.length) return <EmptyState icon={Sparkles} title="Your feed is being prepared – check back tomorrow." description="We're picking tips, workouts and reads that match your goals." />
  return (
    <View style={styles.gap}>
      <Text variant="caption" tone="muted">
        <Text variant="label">{formatDate(data.date, "EEEE, d MMMM")}</Text> · Picked for your goal: <Text variant="label" tone="primary">{data.goalLabel}</Text>
      </Text>
      {data.cards.map((card) => (
        <FeedCardView key={card.id} card={card} />
      ))}
      <View style={styles.caughtUp}>
        <View style={[styles.spark, { backgroundColor: colors.primarySoft }]}>
          <Sparkles size={20} color={colors.primary} />
        </View>
        <Text variant="subtitle">You&apos;re all caught up</Text>
        <Text variant="caption" tone="muted">
          Fresh picks arrive tomorrow. Want more to read?
        </Text>
        <Button title="Explore the library" icon={Compass} variant="outline" size="md" onPress={onExplore} style={styles.center} />
      </View>
    </View>
  )
}

function Explore() {
  const [category, setCategory] = useState<ContentCategory | "all">("all")
  const [search, setSearch] = useState("")
  const term = useDebounced(search.trim(), 250)
  const q = useApiQuery(["employee", "feed", "library", category, term], () => feedApi.library({ category, q: term || undefined }), { placeholderData: (prev) => prev })
  return (
    <View style={styles.gap}>
      <SearchField value={search} onChangeText={setSearch} placeholder="Search articles and videos…" />
      <ChipScroller<ContentCategory | "all"> accessibilityLabel="Categories" value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: c === "all" ? "All" : CONTENT_CATEGORY_LABEL[c] }))} />
      {q.error && !q.data ? (
        <ErrorState title="Couldn't load the library." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : !q.data ? (
        <SkeletonList count={3} height={230} header={false} />
      ) : q.data.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="Nothing matches your filters."
          description="Try another category or search term."
          action={{
            label: "Clear filters",
            onPress: () => {
              setCategory("all")
              setSearch("")
            },
          }}
        />
      ) : (
        <View style={[styles.gap, q.isFetching && q.isPlaceholderData && styles.dim]}>
          {q.data.map((item) => (
            <ContentTile key={item.id} item={item} from="explore" />
          ))}
        </View>
      )}
    </View>
  )
}

function Saved({ onExplore }: { onExplore: () => void }) {
  const q = useApiQuery(["employee", "feed", "saved"], () => feedApi.saved())
  if (q.error) return <ErrorState title="Couldn't load your saved items." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
  if (!q.data) return <SkeletonList count={3} height={76} header={false} />
  if (!q.data.length)
    return <EmptyState icon={Bookmark} title="Nothing saved yet." description="Tap the bookmark on any article, video or tip to keep it here for later." action={{ label: "Explore content", icon: Compass, onPress: onExplore }} />
  return (
    <View style={styles.group}>
      <GroupLabel>{`${q.data.length} saved ${q.data.length === 1 ? "item" : "items"}`}</GroupLabel>
      <Card padding={4}>
        {q.data.map((item) => (
          <ContentRow key={item.id} item={item} from="saved" />
        ))}
      </Card>
    </View>
  )
}

export default function WellnessFeedScreen() {
  const params = useLocalSearchParams<{ tab?: string }>()
  const [tab, setTab] = useState<Tab>(TABS.includes(params.tab as Tab) ? (params.tab as Tab) : "for-you")
  const feed = useApiQuery(["employee", "feed", "for-you"], () => feedApi.feed())

  return (
    <Screen title="Wellness feed" back right={<PhaseBadge phase={2} />} refreshing={feed.isRefetching} onRefresh={tab === "for-you" ? () => feed.refetch() : undefined} testID="feed-screen">
      <SegmentedControl<Tab>
        value={tab}
        onChange={setTab}
        accessibilityLabel="Feed sections"
        options={[
          { value: "for-you", label: "For you" },
          { value: "explore", label: "Explore" },
          { value: "saved", label: feed.data?.savedCount ? `Saved (${feed.data.savedCount})` : "Saved" },
        ]}
      />
      {tab === "for-you" ? (
        feed.error && !feed.data ? (
          <ErrorState title="Couldn't load your feed." error={feed.error} onRetry={() => feed.refetch()} retrying={feed.isFetching} />
        ) : !feed.data ? (
          <SkeletonList count={3} height={200} />
        ) : (
          <ForYou data={feed.data} onExplore={() => setTab("explore")} />
        )
      ) : tab === "explore" ? (
        <Explore />
      ) : (
        <Saved onExplore={() => setTab("explore")} />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  gap: { gap: 14 },
  group: { gap: 8 },
  dim: { opacity: 0.6 },
  center: { alignSelf: "center", marginTop: 6 },
  caughtUp: { alignItems: "center", gap: 6, paddingVertical: 18 },
  spark: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
})
