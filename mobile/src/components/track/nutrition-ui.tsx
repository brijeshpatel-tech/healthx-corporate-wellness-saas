/** Nutrition pieces (SCR-M-036 / 037): macro bars and the portion sheet used to add or edit a food. */
import { Coffee, Cookie, Moon, Sun, Trash2, type LucideIcon } from "lucide-react-native"
import { StyleSheet, View } from "react-native"
import { BottomSheet, Button, Chip, SegmentedControl, Text } from "@/components/ui"
import { MEAL_LABEL, MEAL_TYPES, type Macros, type MealType } from "@/lib/api/employee/nutrition"
import { formatNumber } from "@/lib/format"
import type { FoodItem } from "@/lib/types"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"
import { NumberStepper } from "./track-ui"

export const MEAL_ICON: Record<MealType, LucideIcon> = { breakfast: Coffee, lunch: Sun, snack: Cookie, dinner: Moon }

/** Meal that fits the time of day. */
export function defaultMeal(): MealType {
  const h = new Date().getHours()
  return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 18 ? "snack" : "dinner"
}

const MACROS = [
  { key: "proteinG", label: "Protein" },
  { key: "carbsG", label: "Carbs" },
  { key: "fatG", label: "Fat" },
] as const

export function MacroBars({ totals, targets }: { totals: Macros; targets: Macros }) {
  const { colors, chart } = useTheme()
  return (
    <View style={styles.macros}>
      {MACROS.map((m, i) => {
        const v = totals[m.key]
        const target = targets[m.key]
        const pct = target ? Math.min(100, (v / target) * 100) : 0
        return (
          <View key={m.key} style={styles.macro} accessibilityLabel={`${m.label} ${formatNumber(v, 0)} of ${target} grams`}>
            <View style={styles.macroHead}>
              <View style={[styles.swatch, { backgroundColor: chart[i] }]} />
              <Text variant="label" style={styles.flex}>
                {m.label}
              </Text>
              <Text variant="small" tone="muted">
                <Text variant="small">{formatNumber(v, 0)} g</Text> / {target} g
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.muted }]}>
              <View style={[styles.fill, { width: `${pct}%`, backgroundColor: chart[i] }]} />
            </View>
          </View>
        )
      })}
    </View>
  )
}

function MacroGrid({ food, servings }: { food: FoodItem; servings: number }) {
  const { colors } = useTheme()
  const items = [
    { l: "kcal", v: food.calories * servings, d: 0, unit: "" },
    { l: "Protein", v: food.proteinG * servings, d: 1, unit: " g" },
    { l: "Carbs", v: food.carbsG * servings, d: 1, unit: " g" },
    { l: "Fat", v: food.fatG * servings, d: 1, unit: " g" },
  ]
  return (
    <View style={[styles.grid, { backgroundColor: colors.muted }]} accessibilityLiveRegion="polite">
      {items.map((x) => (
        <View key={x.l} style={styles.gridCell}>
          <Text variant="subtitle" numberOfLines={1} adjustsFontSizeToFit>
            {formatNumber(x.v, x.d)}
            {x.unit}
          </Text>
          <Text variant="small" tone="muted">
            {x.l}
          </Text>
        </View>
      ))}
    </View>
  )
}

export interface FoodSheetProps {
  open: boolean
  onClose: () => void
  food: FoodItem | null
  servings: number
  onServings: (v: number) => void
  meal: MealType
  onMeal: (m: MealType) => void
  /** Add mode: "Add to Lunch". Edit mode: "Save" + Remove. */
  mode: "add" | "edit"
  saving: boolean
  onSave: () => void
  onRemove?: () => void
}

export function FoodSheet({ open, onClose, food, servings, onServings, meal, onMeal, mode, saving, onSave, onRemove }: FoodSheetProps) {
  return (
    <BottomSheet
      open={open && !!food}
      onClose={onClose}
      title={food?.name}
      description={food ? `${food.serving} per serving` : undefined}
      footer={
        <View style={styles.footer}>
          {mode === "edit" && onRemove ? (
            <Button title="Remove" icon={Trash2} variant="outline" size="md" block style={styles.flex} onPress={onRemove} testID="remove-food" />
          ) : (
            <Button title="Cancel" variant="outline" size="md" block style={styles.flex} onPress={onClose} />
          )}
          <Button title={mode === "add" ? `Add to ${MEAL_LABEL[meal]}` : "Save"} size="md" block style={styles.grow} loading={saving} onPress={onSave} testID="save-food" />
        </View>
      }
    >
      {food ? (
        <>
          <NumberStepper label="Servings" value={servings} min={0.25} max={20} step={0.25} onChange={onServings} format={(v) => `${formatNumber(v, 2)} serving${v === 1 ? "" : "s"}`} hint="0.25 – 20 servings" size="lg" />
          <View style={styles.quick}>
            {[0.5, 1, 1.5, 2].map((v) => (
              <Chip key={v} size="sm" label={`${v}×`} selected={servings === v} onPress={() => onServings(v)} />
            ))}
          </View>
          <MacroGrid food={food} servings={servings} />
          <SegmentedControl options={MEAL_TYPES.map((m) => ({ value: m, label: MEAL_LABEL[m] }))} value={meal} onChange={onMeal} accessibilityLabel="Meal" />
        </>
      ) : null}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flex: 1.6 },
  macros: { gap: 12 },
  macro: { gap: 6 },
  macroHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  grid: { flexDirection: "row", borderRadius: RADIUS.lg, paddingVertical: 12, paddingHorizontal: 6 },
  gridCell: { flex: 1, alignItems: "center", gap: 2, minWidth: 0 },
  quick: { flexDirection: "row", justifyContent: "center", gap: 8 },
  footer: { flexDirection: "row", gap: 10 },
})
