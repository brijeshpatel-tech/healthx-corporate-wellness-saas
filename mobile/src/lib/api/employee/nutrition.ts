// AUTO-SYNCED from web/src/lib — edit in web/, then run npm run sync-shared
/** Employee app — nutrition (SCR-M-036, SCR-M-037 — Phase 2). Own data only. */
import type { FoodItem, Meal } from "@/lib/types"
import { toLocalDate } from "@/lib/mock/series"
import { badRequest, endpoint, newId, notFound, type MockContext } from "../core"

type Ctx = MockContext<"employee">
export type MealType = Meal["type"]

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "snack", "dinner"]
export const MEAL_LABEL: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", snack: "Snacks", dinner: "Dinner" }

export interface Macros {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

export interface MealItemRow extends Macros {
  /** `${mealId}~${index}` */
  id: string
  food: FoodItem
  servings: number
}

export interface NutritionDay {
  date: string
  isToday: boolean
  meals: { type: MealType; items: MealItemRow[]; totals: Macros }[]
  totals: Macros
  targets: Macros
  waterMl: number
  waterGoalMl: number
  itemsCount: number
  /** False when the company's plan doesn't include Nutrition (preview only). */
  moduleEnabled: boolean
}

const round1 = (n: number) => Math.round(n * 10) / 10

const macrosOf = (f: FoodItem, servings: number): Macros => ({
  calories: Math.round(f.calories * servings),
  proteinG: round1(f.proteinG * servings),
  carbsG: round1(f.carbsG * servings),
  fatG: round1(f.fatG * servings),
})

const sum = (rows: Macros[]): Macros => ({
  calories: rows.reduce((a, r) => a + r.calories, 0),
  proteinG: round1(rows.reduce((a, r) => a + r.proteinG, 0)),
  carbsG: round1(rows.reduce((a, r) => a + r.carbsG, 0)),
  fatG: round1(rows.reduce((a, r) => a + r.fatG, 0)),
})

/** General daily targets (TBC — not defined in the PDF). Simple estimate from body weight and activity level. */
function targets(ctx: Ctx): Macros {
  const p = ctx.me().profile
  const factor = { sedentary: 28, light: 31, moderate: 34, very_active: 38 }[p.activityLevel] ?? 32
  const calories = Math.round((p.weightKg * factor) / 50) * 50
  return { calories, proteinG: Math.round(p.weightKg * 1.0), carbsG: Math.round((calories * 0.5) / 4), fatG: Math.round((calories * 0.28) / 9) }
}

function parseItemId(id: string) {
  const [mealId, idx] = id.split("~")
  return { mealId: mealId ?? "", index: Number(idx) }
}

function day(ctx: Ctx, date: string): NutritionDay {
  const me = ctx.me()
  const foods = new Map(ctx.db.foods.map((f) => [f.id, f]))
  const meals = MEAL_TYPES.map((type) => {
    const items: MealItemRow[] = []
    for (const meal of me.meals.filter((m) => m.date === date && m.type === type)) {
      meal.items.forEach((it, index) => {
        const food = foods.get(it.foodId)
        if (food) items.push({ id: `${meal.id}~${index}`, food, servings: it.servings, ...macrosOf(food, it.servings) })
      })
    }
    return { type, items, totals: sum(items) }
  })
  const waterMl = me.water.filter((w) => toLocalDate(new Date(w.at)) === date).reduce((a, w) => a + w.amountMl, 0) || me.waterDaily.find((w) => w.date === date)?.totalMl || 0
  return {
    date,
    isToday: date === toLocalDate(new Date()),
    meals,
    totals: sum(meals.map((m) => m.totals)),
    targets: targets(ctx),
    waterMl,
    waterGoalMl: me.waterSettings.goalMl,
    itemsCount: meals.reduce((a, m) => a + m.items.length, 0),
    moduleEnabled: ctx.db.companies.find((c) => c.id === ctx.companyId())?.modules.includes("nutrition") ?? false,
  }
}

function validateServings(servings: number) {
  if (!Number.isFinite(servings) || servings < 0.25 || servings > 20) throw badRequest("Choose a quantity between 0.25 and 20 servings.", { servings: "0.25–20 servings" })
}

export const nutritionApi = {
  day: endpoint<{ date: string }, NutritionDay, "employee">("employee", "GET", "/me/nutrition", ({ date }, ctx) => {
    if (date > toLocalDate(new Date())) throw badRequest("You can't view future days.")
    return day(ctx, date)
  }),

  foods: endpoint<{ q?: string; page?: number }, { items: FoodItem[]; total: number; hasMore: boolean }, "employee">("employee", "GET", "/foods", ({ q, page = 1 }, ctx) => {
    const text = q?.trim().toLowerCase() ?? ""
    const terms = text.split(/\s+/).filter(Boolean)
    const items = ctx.db.foods.filter((f) => terms.every((t) => f.name.toLowerCase().includes(t) || f.tags.some((tag) => tag.includes(t))))
    const pageSize = 20
    return { items: items.slice(0, page * pageSize), total: items.length, hasMore: items.length > page * pageSize }
  }),

  recentFoods: endpoint<void, FoodItem[], "employee">("employee", "GET", "/me/nutrition/recent-foods", (_i, ctx) => {
    const ids: string[] = []
    for (const meal of [...ctx.me().meals].sort((a, b) => b.date.localeCompare(a.date))) for (const it of meal.items) if (!ids.includes(it.foodId)) ids.push(it.foodId)
    return ids
      .slice(0, 8)
      .map((id) => ctx.db.foods.find((f) => f.id === id))
      .filter((f): f is FoodItem => !!f)
  }),

  add: endpoint<{ date: string; mealType: MealType; foodId: string; servings: number }, NutritionDay, "employee">("employee", "POST", "/me/nutrition", ({ date, mealType, foodId, servings }, ctx) => {
    if (!MEAL_TYPES.includes(mealType)) throw badRequest("Choose a meal.", { mealType: "Choose a meal" })
    if (!ctx.db.foods.some((f) => f.id === foodId)) throw badRequest("Choose a food.", { foodId: "Choose a food" })
    if (date > toLocalDate(new Date())) throw badRequest("You can't log food for a future day.")
    validateServings(servings)
    const me = ctx.me()
    let meal = me.meals.find((m) => m.date === date && m.type === mealType)
    if (!meal) {
      meal = { id: newId("meal"), date, type: mealType, items: [] }
      me.meals.push(meal)
    }
    meal.items.push({ foodId, servings })
    ctx.save()
    return day(ctx, date)
  }),

  updateItem: endpoint<{ id: string; servings: number; mealType?: MealType }, NutritionDay, "employee">("employee", "PATCH", "/me/nutrition/:id", ({ id, servings, mealType }, ctx) => {
    validateServings(servings)
    const me = ctx.me()
    const { mealId, index } = parseItemId(id)
    const meal = me.meals.find((m) => m.id === mealId)
    const item = meal?.items[index]
    if (!meal || !item) throw notFound("Food entry")
    item.servings = servings
    if (mealType && mealType !== meal.type) {
      meal.items.splice(index, 1)
      let target = me.meals.find((m) => m.date === meal.date && m.type === mealType)
      if (!target) {
        target = { id: newId("meal"), date: meal.date, type: mealType, items: [] }
        me.meals.push(target)
      }
      target.items.push(item)
    }
    me.meals = me.meals.filter((m) => m.items.length > 0)
    ctx.save()
    return day(ctx, meal.date)
  }),

  removeItem: endpoint<{ id: string }, NutritionDay, "employee">("employee", "DELETE", "/me/nutrition/:id", ({ id }, ctx) => {
    const me = ctx.me()
    const { mealId, index } = parseItemId(id)
    const meal = me.meals.find((m) => m.id === mealId)
    if (!meal || !meal.items[index]) throw notFound("Food entry")
    meal.items.splice(index, 1)
    me.meals = me.meals.filter((m) => m.items.length > 0)
    ctx.save()
    return day(ctx, meal.date)
  }),
}
