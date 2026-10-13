/** SCR-M-023 Activity History — by day, synced and manual entries, type filter, infinite scroll. */
import { router } from "expo-router"
import { CalendarSearch, Pencil, Trash2 } from "lucide-react-native"
import { useMemo, useState } from "react"
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, View } from "react-native"
import { BottomSheet, Button, Chip, ConfirmDialog, EmptyState, ErrorState, Notice, Screen, SegmentedControl, SkeletonList, Text } from "@/components/ui"
import { ACTIVITY_META } from "@/features/activity/activity-meta"
import { ReviewPill, SessionRow } from "@/features/activity/session-row"
import { ACTIVITY_TYPES, activityApi, type ReviewStatus } from "@/lib/api/employee/activity"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatDateTime, formatDuration, formatNumber } from "@/lib/format"
import { DAY_MS, toLocalDate } from "@/lib/mock/series"
import { toast } from "@/lib/toast"
import type { ActivitySession, ActivityType } from "@/lib/types"
import { useTheme } from "@/theme/theme"

type Range = "7" | "30" | "90"
type Row = { kind: "day"; date: string } | { kind: "item"; session: ActivitySession }

const PAGE_SIZE = 20

export default function ActivityHistoryScreen() {
  const { colors } = useTheme()
  const [type, setType] = useState<ActivityType | "all">("all")
  const [range, setRange] = useState<Range>("30")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<ActivitySession | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [today] = useState(() => new Date())
  const from = toLocalDate(new Date(today.getTime() - (Number(range) - 1) * DAY_MS))
  const q = useApiQuery(["employee", "activity", "history", type, range, page], () => activityApi.history({ type, from, page, pageSize: PAGE_SIZE }), { placeholderData: (prev) => prev })

  const restore = useApiMutation(activityApi.restore, { success: "Activity restored" })
  const remove = useApiMutation(activityApi.remove, {
    onSuccess: (s) => {
      setConfirmDelete(false)
      setSelected(null)
      toast.success("Activity deleted.", { duration: 5000, action: { label: "Undo", onPress: () => restore.mutate({ id: s.id }) } })
    },
  })

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    let last = ""
    for (const s of q.data?.items ?? []) {
      const day = toLocalDate(new Date(s.startedAt))
      if (day !== last) {
        out.push({ kind: "day", date: day })
        last = day
      }
      out.push({ kind: "item", session: s })
    }
    return out
  }, [q.data])

  const changeFilter = (fn: () => void) => {
    setPage(1)
    fn()
  }
  const review: ReviewStatus | undefined = selected ? q.data?.reviews[selected.id] : undefined
  const canChange = selected?.source === "manual" && review?.status !== "approved"

  const header = (
    <View style={styles.filters}>
      <SegmentedControl
        options={[
          { value: "7", label: "7 days" },
          { value: "30", label: "30 days" },
          { value: "90", label: "90 days" },
        ]}
        value={range}
        onChange={(v) => changeFilter(() => setRange(v))}
        accessibilityLabel="Date range"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip size="sm" label="All" selected={type === "all"} onPress={() => changeFilter(() => setType("all"))} />
        {ACTIVITY_TYPES.map((t) => (
          <Chip key={t} size="sm" emoji={ACTIVITY_META[t].emoji} label={ACTIVITY_META[t].label} selected={type === t} onPress={() => changeFilter(() => setType(t))} />
        ))}
      </ScrollView>
    </View>
  )

  return (
    <Screen title="Activity history" back backHref="/activity" scroll={false}>
      {header}
      {q.isLoading ? (
        <SkeletonList count={5} height={72} header={false} />
      ) : q.error && !q.data ? (
        <ErrorState title="Couldn't load your history." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : (
        <FlatList
          style={styles.list}
          data={rows}
          keyExtractor={(r) => (r.kind === "day" ? `d-${r.date}` : r.session.id)}
          refreshControl={<RefreshControl refreshing={q.isRefetching && page === 1} onRefresh={() => q.refetch()} tintColor={colors.primary} colors={[colors.primary]} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (q.data?.hasMore && !q.isFetching) setPage((p) => p + 1)
          }}
          ListEmptyComponent={<EmptyState icon={CalendarSearch} title="No activities in this period." description="Try a longer date range or another activity type." />}
          ListFooterComponent={q.isFetching && page > 1 ? <ActivityIndicator color={colors.primary} style={styles.footer} /> : <View style={styles.footer} />}
          renderItem={({ item }) => {
            if (item.kind === "day") {
              const totals = q.data?.dayTotals[item.date]
              return (
                <View style={styles.dayHeader}>
                  <Text variant="label">{item.date === toLocalDate(new Date()) ? "Today" : formatDate(item.date, "EEEE, d MMM")}</Text>
                  {totals ? (
                    <Text variant="small" tone="muted">
                      {formatNumber(totals.steps)} steps · {totals.activeMinutes} min
                    </Text>
                  ) : null}
                </View>
              )
            }
            return <SessionRow session={item.session} review={q.data?.reviews[item.session.id]} onPress={() => setSelected(item.session)} />
          }}
        />
      )}

      <BottomSheet
        open={!!selected && !confirmDelete}
        onClose={() => setSelected(null)}
        title={selected ? `${ACTIVITY_META[selected.type].emoji} ${ACTIVITY_META[selected.type].label}` : ""}
        description={selected ? formatDateTime(selected.startedAt) : undefined}
        footer={
          canChange ? (
            <View style={styles.actions}>
              <Button title="Delete" icon={Trash2} variant="outline" size="md" block style={styles.flex} onPress={() => setConfirmDelete(true)} />
              <Button
                title="Edit"
                icon={Pencil}
                size="md"
                block
                style={styles.flex}
                onPress={() => {
                  const id = selected!.id
                  setSelected(null)
                  router.push({ pathname: "/activity/log", params: { id } })
                }}
              />
            </View>
          ) : null
        }
      >
        {selected ? (
          <>
            <View style={styles.detailGrid}>
              <Detail label="Duration" value={formatDuration(selected.durationMin)} />
              <Detail label="Distance" value={selected.distanceKm ? `${formatNumber(selected.distanceKm, 1)} km` : "—"} />
              <Detail label="Calories" value={selected.calories ? `${formatNumber(selected.calories)} kcal` : "—"} />
              <Detail label="Steps" value={selected.steps ? formatNumber(selected.steps) : "—"} />
            </View>
            {selected.notes ? <Text variant="body">“{selected.notes}”</Text> : null}
            {selected.source === "manual" ? (
              <>
                <ReviewPill review={review} />
                <Notice tone={review?.status === "rejected" ? "error" : "info"}>
                  {review?.status === "approved"
                    ? "Approved by your company. Ask HR if it needs correcting."
                    : review?.status === "rejected"
                      ? `Not approved${review.reason ? `: ${review.reason}` : ""}. You can edit and resubmit it.`
                      : "Manual entry — waiting for approval before it can earn points."}
                </Notice>
              </>
            ) : (
              <Notice tone="info">Synced from your health app — it can&apos;t be edited here.</Notice>
            )}
          </>
        ) : null}
      </BottomSheet>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this activity?"
        message="Your daily totals will be updated. You can undo for a few seconds."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => selected && remove.mutate({ id: selected.id })}
      />
    </Screen>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text variant="small" tone="muted">
        {label}
      </Text>
      <Text variant="subtitle">{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  filters: { gap: 10 },
  chips: { gap: 8, paddingRight: 16 },
  list: { flex: 1, marginHorizontal: -4 },
  dayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: 8, paddingTop: 14, paddingBottom: 4 },
  footer: { height: 40, marginTop: 8 },
  actions: { flexDirection: "row", gap: 10 },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 12 },
  detail: { width: "50%", gap: 2 },
})
