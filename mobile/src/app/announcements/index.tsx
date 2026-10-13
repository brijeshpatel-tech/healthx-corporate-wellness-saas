/** SCR-M-059 Announcements — pinned first, type filter, unread state, load more, mark all as read. */
import { keepPreviousData } from "@tanstack/react-query"
import { CheckCheck, Megaphone } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { ANNOUNCEMENT_TYPE, ANNOUNCEMENT_TYPE_ORDER, AnnouncementRow, PinnedAnnouncementCard } from "@/components/engage/inbox"
import { ChipScroller, GroupLabel } from "@/components/engage/shared"
import { Button, Card, EmptyState, ErrorState, IconButton, Screen, SkeletonList, Text } from "@/components/ui"
import { announcementsApi, type AnnouncementTypeFilter } from "@/lib/api/employee/announcements"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"

const PAGE_SIZE = 20

export default function AnnouncementsScreen() {
  const [type, setType] = useState<AnnouncementTypeFilter>("all")
  const [pages, setPages] = useState(1)
  const q = useApiQuery(["employee", "announcements", "list", { type, pages }], () => announcementsApi.list({ type, page: 1, pageSize: PAGE_SIZE * pages }), { placeholderData: keepPreviousData })
  const markAll = useApiMutation(announcementsApi.markAllRead, {
    success: (r) => (r.marked ? `${r.marked} announcement${r.marked === 1 ? "" : "s"} marked as read` : "Everything is already read"),
  })
  const data = q.data
  const pinned = data?.items.filter((a) => a.pinned) ?? []
  const rest = data?.items.filter((a) => !a.pinned) ?? []

  return (
    <Screen
      title="Announcements"
      subtitle={data?.unread ? `${data.unread} unread` : data?.companyName}
      back
      right={<IconButton icon={CheckCheck} variant="ghost" accessibilityLabel="Mark all as read" disabled={!data?.unread || markAll.isPending} onPress={() => markAll.mutate()} testID="mark-all-announcements" />}
      refreshing={q.isRefetching && !q.isPlaceholderData}
      onRefresh={() => q.refetch()}
      testID="announcements-screen"
    >
      {q.error && !data ? (
        <ErrorState title="Couldn't load announcements." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : !data ? (
        <SkeletonList count={4} height={110} />
      ) : data.counts.all === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements from your company yet." description="When your HR or wellness team shares news, tips or challenges, you'll find them here." />
      ) : (
        <>
          <ChipScroller<AnnouncementTypeFilter>
            accessibilityLabel="Filter by type"
            value={type}
            onChange={(t) => {
              setType(t)
              setPages(1)
            }}
            options={[
              { value: "all", label: "All", count: data.counts.all },
              ...ANNOUNCEMENT_TYPE_ORDER.filter((t) => data.counts[t] > 0 || t === type).map((t) => ({ value: t as AnnouncementTypeFilter, label: ANNOUNCEMENT_TYPE[t].chip, icon: ANNOUNCEMENT_TYPE[t].icon, count: data.counts[t] })),
            ]}
          />
          {data.items.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title={`No ${type === "all" ? "" : `${ANNOUNCEMENT_TYPE[type].chip.toLowerCase()} `}announcements yet.`}
              description="Try another type to see more."
              action={{ label: "Show all announcements", onPress: () => setType("all") }}
            />
          ) : (
            <View style={[styles.gap, q.isFetching && q.isPlaceholderData && styles.dim]}>
              {pinned.map((a) => (
                <PinnedAnnouncementCard key={a.id} item={a} />
              ))}
              {rest.length ? (
                <View style={styles.group}>
                  <GroupLabel>{pinned.length ? "Latest" : type === "all" ? "All announcements" : ANNOUNCEMENT_TYPE[type].chip}</GroupLabel>
                  <Card padding={4}>
                    {rest.map((a) => (
                      <AnnouncementRow key={a.id} item={a} />
                    ))}
                  </Card>
                </View>
              ) : null}
              {data.total > data.items.length ? (
                <Button title="Load more" variant="outline" loading={q.isFetching && q.isPlaceholderData} onPress={() => setPages((p) => p + 1)} />
              ) : (
                <Text variant="small" tone="muted" align="center">
                  You&apos;ve seen every announcement.
                </Text>
              )}
            </View>
          )}
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  gap: { gap: 14 },
  group: { gap: 8 },
  dim: { opacity: 0.6 },
})
