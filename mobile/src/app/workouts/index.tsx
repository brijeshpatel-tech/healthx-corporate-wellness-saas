/** SCR-M-029 Workout Library (+ SCR-M-030 Filters sheet) — search, category chips, filters with active count. */
import { keepPreviousData } from "@tanstack/react-query"
import { router, useLocalSearchParams } from "expo-router"
import { History, Search, SearchX, SlidersHorizontal, X } from "lucide-react-native"
import { useState } from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { countFilters, EMPTY_FILTERS, WorkoutFilterSheet, type WorkoutFilters } from "@/components/track/workout-filter-sheet"
import { WorkoutCard } from "@/components/track/workout-ui"
import { Card, Chip, EmptyState, ErrorState, IconButton, Screen, Skeleton, Text, TextField } from "@/components/ui"
import { workoutsApi, type WorkoutQuery } from "@/lib/api/employee/workouts"
import { useApiQuery } from "@/lib/api/hooks"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

export default function WorkoutsScreen() {
  const { colors } = useTheme()
  const params = useLocalSearchParams<{ category?: string }>()
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState(params.category ?? "all")
  const [filters, setFilters] = useState<WorkoutFilters>(EMPTY_FILTERS)
  const [sheet, setSheet] = useState(false)

  const text = search.trim()
  const query: WorkoutQuery = { q: text.length >= 2 ? text : undefined, category, ...filters }
  const list = useApiQuery(["employee", "workouts", query], () => workoutsApi.list(query), { placeholderData: keepPreviousData })
  const values = useApiQuery(["employee", "workouts", "filters"], () => workoutsApi.filters())
  const active = countFilters(filters)
  const filtered = active > 0 || category !== "all" || !!query.q

  const clearAll = () => {
    setFilters(EMPTY_FILTERS)
    setCategory("all")
    setSearch("")
  }

  return (
    <Screen
      title="Workouts"
      back
      right={<IconButton icon={History} accessibilityLabel="Workout history" onPress={() => router.push("/workouts/history")} testID="workout-history" />}
      refreshing={list.isRefetching && !list.isPlaceholderData}
      onRefresh={() => list.refetch()}
      testID="workouts-screen"
    >
      <View style={styles.searchRow}>
        <TextField
          icon={Search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search workouts, e.g. core, yoga"
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Search workouts"
          containerStyle={styles.flex}
          right={
            search ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => setSearch("")}>
                <X size={18} color={colors.mutedForeground} />
              </Pressable>
            ) : undefined
          }
          testID="workout-search"
        />
        <IconButton icon={SlidersHorizontal} size={52} badge={active || undefined} accessibilityLabel={`Filters${active ? `, ${active} active` : ""}`} onPress={() => setSheet(true)} testID="open-filters" />
      </View>
      {text.length === 1 ? (
        <Text variant="small" tone="muted" style={styles.hint}>
          Type at least 2 characters to search.
        </Text>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsScroll}>
        <Chip size="sm" label="All" selected={category === "all"} onPress={() => setCategory("all")} />
        {(values.data?.categories ?? []).map((c) => (
          <Chip key={c} size="sm" label={c} selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </ScrollView>

      {!list.data ? (
        list.error ? (
          <ErrorState title="Couldn't load workouts." error={list.error} onRetry={() => list.refetch()} retrying={list.isFetching} />
        ) : (
          Array.from({ length: 5 }, (_, i) => <Skeleton key={i} height={112} radius={RADIUS.xl} />)
        )
      ) : list.data.items.length === 0 ? (
        <Card>
          <EmptyState icon={SearchX} title="No workouts match your filters." description="Try a different search or fewer filters." action={{ label: "Clear filters", onPress: clearAll }} />
        </Card>
      ) : (
        <>
          <View style={styles.countRow}>
            <Text variant="small" tone="muted">
              {list.data.total} workout{list.data.total === 1 ? "" : "s"}
              {filtered ? " match" : " available"}
            </Text>
            {filtered ? (
              <Text variant="label" tone="primary" onPress={clearAll} accessibilityRole="button">
                Clear all
              </Text>
            ) : null}
          </View>
          <View style={[styles.list, list.isPlaceholderData && styles.loading]}>
            {list.data.items.map((w) => (
              <WorkoutCard key={w.id} w={w} />
            ))}
          </View>
        </>
      )}

      <WorkoutFilterSheet
        open={sheet}
        onClose={() => setSheet(false)}
        values={values.data}
        valuesError={!!values.error}
        all={list.data?.all ?? []}
        base={{ q: query.q, category }}
        initial={filters}
        onApply={(f) => {
          setFilters(f)
          setSheet(false)
        }}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  searchRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  hint: { marginTop: -8 },
  chipsScroll: { marginHorizontal: -16, flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: 16 },
  countRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: -6 },
  list: { gap: 10 },
  loading: { opacity: 0.6 },
})
