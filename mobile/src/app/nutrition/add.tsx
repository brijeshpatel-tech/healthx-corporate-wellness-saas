/** SCR-M-037 Log Meal – Search & Add Food (Phase 2): meal type, food search, recent foods, portion and nutrition preview. */
import { keepPreviousData } from "@tanstack/react-query"
import { useLocalSearchParams } from "expo-router"
import { History, Search, SearchX, X } from "lucide-react-native"
import { useDeferredValue, useState } from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { defaultMeal, FoodSheet } from "@/components/track/nutrition-ui"
import { dayLabel, localDate } from "@/components/track/utils"
import { HeaderPhase } from "@/components/track/track-ui"
import { Button, Card, Chip, EmptyState, ErrorState, goBack, Screen, SectionHeader, SegmentedControl, Skeleton, Text, TextField } from "@/components/ui"
import { MEAL_LABEL, MEAL_TYPES, nutritionApi, type MealType } from "@/lib/api/employee/nutrition"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import type { FoodItem } from "@/lib/types"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

export default function AddFoodScreen() {
  const { colors } = useTheme()
  const params = useLocalSearchParams<{ meal?: string; date?: string }>()
  const today = localDate()
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) && params.date <= today ? params.date : today
  const [meal, setMeal] = useState<MealType>(MEAL_TYPES.includes(params.meal as MealType) ? (params.meal as MealType) : defaultMeal())
  const [search, setSearch] = useState("")
  const q = useDeferredValue(search.trim())
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState<FoodItem | null>(null)
  const [servings, setServings] = useState(1)

  const results = useApiQuery(["employee", "foods", q, page], () => nutritionApi.foods({ q, page }), { placeholderData: keepPreviousData })
  const recent = useApiQuery(["employee", "foods", "recent"], () => nutritionApi.recentFoods())
  const add = useApiMutation(nutritionApi.add, {
    errorTitle: "Couldn't add this food. Try again.",
    onSuccess: () => {
      haptic.success()
      toast.success(`Added to ${MEAL_LABEL[meal]}`)
      setPicked(null)
      goBack("/nutrition")
    },
  })

  const pick = (f: FoodItem) => {
    haptic.tap()
    setServings(1)
    setPicked(f)
  }

  return (
    <Screen title="Add food" subtitle={dayLabel(date)} back backHref="/nutrition" right={<HeaderPhase />} testID="add-food-screen">
      <SegmentedControl options={MEAL_TYPES.map((m) => ({ value: m, label: MEAL_LABEL[m] }))} value={meal} onChange={setMeal} accessibilityLabel="Meal" />
      <TextField
        icon={Search}
        value={search}
        onChangeText={(v) => {
          setSearch(v)
          setPage(1)
        }}
        placeholder="Search foods, e.g. dal, idli, paneer"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Search foods"
        right={
          search ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => setSearch("")}>
              <X size={18} color={colors.mutedForeground} />
            </Pressable>
          ) : undefined
        }
        testID="food-search"
      />

      {!search && recent.data?.length ? (
        <View style={styles.group}>
          <View style={styles.inline}>
            <History size={15} color={colors.mutedForeground} />
            <Text variant="label">Recent foods</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
            {recent.data.map((f) => (
              <Chip key={f.id} size="sm" label={f.name} onPress={() => pick(f)} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <SectionHeader title={search ? "Results" : "All foods"} subtitle={results.data ? `${formatNumber(results.data.total)} food${results.data.total === 1 ? "" : "s"}` : undefined} />
      {!results.data ? (
        results.error ? (
          <ErrorState title="Couldn't load foods" error={results.error} onRetry={() => results.refetch()} retrying={results.isFetching} />
        ) : (
          <Skeleton height={360} radius={RADIUS.xl} />
        )
      ) : results.data.items.length === 0 ? (
        <Card>
          <EmptyState compact icon={SearchX} title={`No foods found for "${search.trim()}".`} description="Try a simpler word, like the main ingredient." />
        </Card>
      ) : (
        <Card padding={0} style={[styles.clip, results.isPlaceholderData && styles.loading]}>
          {results.data.items.map((f, i) => (
            <Pressable
              key={f.id}
              accessibilityRole="button"
              accessibilityLabel={`${f.name}, ${f.serving}, ${f.calories} kcal`}
              onPress={() => pick(f)}
              style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, pressed && { backgroundColor: colors.muted }]}
              testID={`food-${f.id}`}
            >
              <View style={styles.flex}>
                <Text variant="bodyMedium" numberOfLines={1}>
                  {f.name}
                </Text>
                <Text variant="small" tone="muted" numberOfLines={1}>
                  {f.serving} · P {f.proteinG} g · C {f.carbsG} g · F {f.fatG} g
                </Text>
              </View>
              <Text variant="label">{f.calories}</Text>
              <Text variant="small" tone="muted">
                kcal
              </Text>
            </Pressable>
          ))}
        </Card>
      )}
      {results.data?.hasMore ? <Button title="Show more" variant="ghost" size="md" loading={results.isFetching} onPress={() => setPage((p) => p + 1)} style={styles.center} /> : null}

      <FoodSheet
        open={!!picked}
        onClose={() => setPicked(null)}
        food={picked}
        servings={servings}
        onServings={setServings}
        meal={meal}
        onMeal={setMeal}
        mode="add"
        saving={add.isPending}
        onSave={() => picked && add.mutate({ date, mealType: meal, foodId: picked.id, servings })}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  group: { gap: 8 },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  chipsScroll: { marginHorizontal: -16, flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: 16 },
  clip: { overflow: "hidden" },
  loading: { opacity: 0.6 },
  row: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 12 },
  center: { alignSelf: "center" },
})
