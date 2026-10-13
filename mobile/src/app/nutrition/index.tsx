/**
 * SCR-M-036 Nutrition Dashboard (Phase 2) — day selector, calories ring, macros, water (from the Water tracker,
 * no double entry) and Breakfast / Lunch / Snacks / Dinner with their foods. Tap a food to edit or remove it.
 */
import { keepPreviousData } from "@tanstack/react-query"
import { router, useLocalSearchParams } from "expo-router"
import { ChevronRight, Droplets, Info, Plus, Utensils } from "lucide-react-native"
import { useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { FoodSheet, MacroBars, MEAL_ICON } from "@/components/track/nutrition-ui"
import { FinePrint, HeaderPhase, PeriodNavigator } from "@/components/track/track-ui"
import { addDays, dayLabel, localDate } from "@/components/track/utils"
import { Button, Card, ConfirmDialog, ErrorState, Notice, ProgressRing, Screen, Skeleton, Text } from "@/components/ui"
import { MEAL_LABEL, nutritionApi, type MealItemRow, type MealType, type NutritionDay } from "@/lib/api/employee/nutrition"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatMl, formatNumber } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

function Totals({ data }: { data: NutritionDay }) {
  const { colors, tint } = useTheme()
  const t = data.totals
  const over = t.calories > data.targets.calories
  const ringColor = over ? tint("streak").fg : colors.primary
  return (
    <Card padding={18}>
      <View style={styles.totals}>
        <ProgressRing value={t.calories} max={data.targets.calories} size={128} stroke={12} color={ringColor} accessibilityLabel={`${formatNumber(t.calories)} of ${formatNumber(data.targets.calories)} kcal`}>
          <Text variant="heading">{formatNumber(t.calories)}</Text>
          <Text variant="small" tone="muted">
            of {formatNumber(data.targets.calories)} kcal
          </Text>
        </ProgressRing>
        <View style={styles.flex}>
          <Text variant="heading">{data.itemsCount === 0 ? "Nothing logged yet" : over ? `${formatNumber(t.calories - data.targets.calories)} kcal over` : `${formatNumber(data.targets.calories - t.calories)} kcal left`}</Text>
          <Text variant="caption" tone="muted">
            General daily guide based on your profile. Targets are to be confirmed.
          </Text>
        </View>
      </View>
      <View style={styles.macros}>
        <MacroBars totals={t} targets={data.targets} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Water ${formatMl(data.waterMl)} of ${formatMl(data.waterGoalMl)}, from the water tracker. Open`}
        onPress={() => {
          haptic.tap()
          router.push("/water")
        }}
        style={({ pressed }) => [styles.water, { backgroundColor: tint("water").bg }, pressed && styles.pressed]}
      >
        <Droplets size={18} color={tint("water").fg} />
        <Text variant="caption" style={styles.flex}>
          Water <Text variant="label">{formatMl(data.waterMl)}</Text> <Text variant="caption" tone="muted">/ {formatMl(data.waterGoalMl)}</Text>
        </Text>
        <Text variant="small" tone="muted">
          From water tracker
        </Text>
        <ChevronRight size={16} color={colors.mutedForeground} />
      </Pressable>
    </Card>
  )
}

function MealCard({ meal, date, onEdit }: { meal: NutritionDay["meals"][number]; date: string; onEdit: (item: MealItemRow, meal: MealType) => void }) {
  const { colors } = useTheme()
  const Icon = MEAL_ICON[meal.type]
  return (
    <Card padding={0} style={styles.clip}>
      <View style={styles.mealHead}>
        <View style={[styles.mealIcon, { backgroundColor: colors.muted }]}>
          <Icon size={18} color={colors.mutedForeground} />
        </View>
        <View style={styles.flex}>
          <Text variant="subtitle">{MEAL_LABEL[meal.type]}</Text>
          <Text variant="small" tone="muted" numberOfLines={1}>
            {meal.items.length ? `${formatNumber(meal.totals.calories)} kcal · P ${formatNumber(meal.totals.proteinG)} g · C ${formatNumber(meal.totals.carbsG)} g · F ${formatNumber(meal.totals.fatG)} g` : "Nothing yet"}
          </Text>
        </View>
        <Button title="Add" icon={Plus} variant="ghost" size="sm" accessibilityLabel={`Add food to ${MEAL_LABEL[meal.type]}`} onPress={() => router.push({ pathname: "/nutrition/add", params: { meal: meal.type, date } })} testID={`add-${meal.type}`} />
      </View>
      {meal.items.map((it) => (
        <Pressable
          key={it.id}
          accessibilityRole="button"
          accessibilityLabel={`${it.food.name}, ${formatNumber(it.servings, 2)} servings, ${formatNumber(it.calories)} kcal. Edit`}
          onPress={() => {
            haptic.tap()
            onEdit(it, meal.type)
          }}
          style={({ pressed }) => [styles.item, { borderTopColor: colors.border }, pressed && { backgroundColor: colors.muted }]}
        >
          <View style={styles.flex}>
            <Text variant="bodyMedium" numberOfLines={1}>
              {it.food.name}
            </Text>
            <Text variant="small" tone="muted" numberOfLines={1}>
              {formatNumber(it.servings, 2)} × {it.food.serving}
            </Text>
          </View>
          <Text variant="label">{formatNumber(it.calories)}</Text>
          <Text variant="small" tone="muted">
            kcal
          </Text>
        </Pressable>
      ))}
    </Card>
  )
}

function Day({ data }: { data: NutritionDay }) {
  const { colors } = useTheme()
  const [editing, setEditing] = useState<{ item: MealItemRow; meal: MealType } | null>(null)
  const [servings, setServings] = useState(1)
  const [meal, setMeal] = useState<MealType>("lunch")
  const [confirm, setConfirm] = useState<MealItemRow | null>(null)
  const update = useApiMutation(nutritionApi.updateItem, { success: "Food updated", errorTitle: "Couldn't update this food", onSuccess: () => setEditing(null) })
  const remove = useApiMutation(nutritionApi.removeItem, { success: "Food removed", errorTitle: "Couldn't remove this food", onSuccess: () => setConfirm(null) })

  return (
    <>
      {!data.moduleEnabled ? <Notice tone="demo" icon={Info} title="Preview">Nutrition isn&apos;t part of your company&apos;s current plan yet. You can try it — your food log stays private to you.</Notice> : null}
      <Totals data={data} />
      {data.itemsCount === 0 ? (
        <View style={[styles.emptyRow, { borderColor: colors.input }]}>
          <Utensils size={18} color={colors.mutedForeground} />
          <Text variant="caption" tone="muted" style={styles.flex}>
            {data.isToday ? "Nothing logged today. Add your breakfast to get started." : "Nothing logged on this day."}
          </Text>
        </View>
      ) : null}
      {data.meals.map((m) => (
        <MealCard
          key={m.type}
          meal={m}
          date={data.date}
          onEdit={(item, type) => {
            setServings(item.servings)
            setMeal(type)
            setEditing({ item, meal: type })
          }}
        />
      ))}

      <FoodSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        food={editing?.item.food ?? null}
        servings={servings}
        onServings={setServings}
        meal={meal}
        onMeal={setMeal}
        mode="edit"
        saving={update.isPending}
        onSave={() => editing && update.mutate({ id: editing.item.id, servings, mealType: meal })}
        onRemove={() => {
          // Close the sheet first (one modal at a time), then confirm.
          setConfirm(editing?.item ?? null)
          setEditing(null)
        }}
      />
      <ConfirmDialog
        open={!!confirm}
        title="Remove this food?"
        message={confirm ? `${confirm.food.name} will be removed from your log.` : undefined}
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && remove.mutate({ id: confirm.id })}
      />
    </>
  )
}

export default function NutritionScreen() {
  const params = useLocalSearchParams<{ date?: string }>()
  const today = localDate()
  const [date, setDate] = useState(params.date && params.date <= today ? params.date : today)
  const q = useApiQuery(["employee", "nutrition", date], () => nutritionApi.day({ date }), { placeholderData: keepPreviousData })

  return (
    <Screen
      title="Nutrition"
      back
      right={<HeaderPhase />}
      refreshing={q.isRefetching && !q.isPlaceholderData}
      onRefresh={() => q.refetch()}
      footer={<Button title="Add food" icon={Plus} onPress={() => router.push({ pathname: "/nutrition/add", params: { date } })} testID="add-food" />}
      testID="nutrition-screen"
    >
      <PeriodNavigator
        label={dayLabel(date)}
        sublabel={formatDate(`${date}T12:00:00`, "EEEE, d MMMM")}
        onPrev={() => setDate(addDays(date, -1))}
        onNext={() => setDate(addDays(date, 1))}
        prevDisabled={date <= addDays(today, -60)}
        nextDisabled={date >= today}
        prevLabel="Previous day"
        nextLabel="Next day"
      />
      {!q.data ? (
        q.error ? (
          <ErrorState title="Couldn't load your food log." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
        ) : (
          <>
            <Skeleton height={300} radius={RADIUS.xl} />
            <Skeleton height={90} radius={RADIUS.xl} />
            <Skeleton height={90} radius={RADIUS.xl} />
          </>
        )
      ) : (
        <View style={[styles.day, q.isPlaceholderData && styles.loading]}>
          <Day data={q.data} />
        </View>
      )}
      <FinePrint>General wellness information, not dietary or medical advice. Nutrition values are estimates.</FinePrint>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  day: { gap: 14 },
  loading: { opacity: 0.55 },
  totals: { flexDirection: "row", alignItems: "center", gap: 16 },
  macros: { marginTop: 18 },
  water: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: RADIUS.lg, marginTop: 16 },
  pressed: { opacity: 0.85 },
  clip: { overflow: "hidden" },
  mealHead: { flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 14, paddingRight: 6, paddingVertical: 10 },
  mealIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  item: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  emptyRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: RADIUS.xl, borderWidth: 1, borderStyle: "dashed" },
})
