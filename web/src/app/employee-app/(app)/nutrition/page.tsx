"use client"

import { keepPreviousData } from "@tanstack/react-query"
import { Coffee, Cookie, Droplets, Info, Moon, Plus, ShieldAlert, Sun, Trash2, Utensils } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { ProgressRing } from "@/components/common/charts"
import { ConfirmDialog } from "@/components/common/misc"
import { ErrorState } from "@/components/common/states"
import { NumberStepper, PeriodNavigator, Segmented, TrackHeader, TrackPage, addDays, dayLabel, localDate } from "@/components/employee/track/track-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { MEAL_LABEL, MEAL_TYPES, nutritionApi, type MealItemRow, type MealType, type NutritionDay } from "@/lib/api/employee/nutrition"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatMl, formatNumber } from "@/lib/format"

const MEAL_ICON: Record<MealType, typeof Coffee> = { breakfast: Coffee, lunch: Sun, snack: Cookie, dinner: Moon }
const MACROS = [
  { key: "proteinG", label: "Protein", color: "var(--chart-1)" },
  { key: "carbsG", label: "Carbs", color: "var(--chart-2)" },
  { key: "fatG", label: "Fat", color: "var(--chart-3)" },
] as const

/** SCR-M-036 Nutrition Dashboard (Phase 2). */
function Nutrition() {
  const params = useSearchParams()
  const router = useRouter()
  const today = localDate()
  const date = params.get("date") && params.get("date")! <= today ? params.get("date")! : today
  const setDate = (d: string) => router.replace(d === today ? "/employee-app/nutrition" : `/employee-app/nutrition?date=${d}`, { scroll: false })
  const q = useApiQuery(["employee", "nutrition", date], () => nutritionApi.day({ date }), { placeholderData: keepPreviousData })

  return (
    <>
      <PeriodNavigator
        className="sm:max-w-sm"
        label={dayLabel(date)}
        sublabel={new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        onPrev={() => setDate(addDays(date, -1))}
        onNext={() => setDate(addDays(date, 1))}
        prevDisabled={date <= addDays(today, -60)}
        nextDisabled={date >= today}
      />
      {q.error ? (
        <ErrorState error={new Error("Couldn't load your food log.")} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : (
        <Day data={q.data} />
      )}
    </>
  )
}

function Day({ data }: { data: NutritionDay }) {
  const [editing, setEditing] = useState<{ item: MealItemRow; meal: MealType } | null>(null)
  const t = data.totals
  const over = t.calories > data.targets.calories
  return (
    <>
      {!data.moduleEnabled ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-violet-500/25 bg-violet-500/8 px-3.5 py-2.5 text-xs text-violet-900 dark:text-violet-200">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>Preview: Nutrition isn&apos;t part of your company&apos;s current plan yet. You can try it — your food log stays private to you.</p>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card className="gap-0 py-0">
          <CardContent className="space-y-5 p-5">
            <div className="flex items-center gap-5">
              <ProgressRing value={t.calories} max={data.targets.calories} size={136} stroke={13} color={over ? "#f97316" : "var(--primary)"}>
                <span className="font-heading text-3xl font-extrabold tabular-nums">{formatNumber(t.calories)}</span>
                <span className="text-[11px] text-muted-foreground">of {formatNumber(data.targets.calories)} kcal</span>
              </ProgressRing>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-lg font-bold">{data.itemsCount === 0 ? "Nothing logged yet" : over ? `${formatNumber(t.calories - data.targets.calories)} kcal over` : `${formatNumber(data.targets.calories - t.calories)} kcal left`}</p>
                <p className="text-xs text-muted-foreground">General daily guide based on your profile. Targets are to be confirmed.</p>
              </div>
            </div>
            <div className="space-y-3">
              {MACROS.map((m) => {
                const v = t[m.key]
                const target = data.targets[m.key]
                return (
                  <div key={m.key} className="space-y-1">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: m.color }} />
                        {m.label}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        <span className="font-semibold text-foreground">{formatNumber(v, 0)} g</span> / {target} g
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (v / target) * 100)}%`, backgroundColor: m.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <Link href="/employee-app/water" className="flex items-center gap-3 rounded-xl bg-cyan-500/8 p-3 transition-colors hover:bg-cyan-500/12">
              <Droplets className="size-5 text-cyan-600 dark:text-cyan-400" />
              <span className="flex-1 text-sm">
                Water <span className="font-semibold">{formatMl(data.waterMl)}</span> <span className="text-muted-foreground">/ {formatMl(data.waterGoalMl)}</span>
              </span>
              <span className="text-xs text-muted-foreground">From water tracker</span>
            </Link>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {data.itemsCount === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed bg-card/50 p-4">
              <Utensils className="size-5 text-muted-foreground" />
              <p className="flex-1 text-sm text-muted-foreground">{data.isToday ? "Nothing logged today. Add your breakfast to get started." : "Nothing logged on this day."}</p>
            </div>
          ) : null}
          {data.meals.map((meal) => {
            const Icon = MEAL_ICON[meal.type]
            return (
              <Card key={meal.type} className="gap-0 py-0">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-muted">
                      <Icon className="size-4.5 text-muted-foreground" />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{MEAL_LABEL[meal.type]}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{meal.items.length ? `${formatNumber(meal.totals.calories)} kcal · P ${formatNumber(meal.totals.proteinG)} g · C ${formatNumber(meal.totals.carbsG)} g · F ${formatNumber(meal.totals.fatG)} g` : "Nothing yet"}</p>
                    </div>
                    <Button asChild variant="ghost" size="sm" className="h-9">
                      <Link href={`/employee-app/nutrition/add?meal=${meal.type}&date=${data.date}`}>
                        <Plus data-icon="inline-start" /> Add
                      </Link>
                    </Button>
                  </div>
                  {meal.items.length ? (
                    <ul className="divide-y border-t">
                      {meal.items.map((it) => (
                        <li key={it.id}>
                          <button type="button" onClick={() => setEditing({ item: it, meal: meal.type })} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{it.food.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {formatNumber(it.servings, 2)} × {it.food.serving}
                              </p>
                            </div>
                            <span className="text-sm font-semibold tabular-nums">{formatNumber(it.calories)}</span>
                            <span className="text-xs text-muted-foreground">kcal</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <EditItemSheet editing={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function EditItemSheet({ editing, onClose }: { editing: { item: MealItemRow; meal: MealType } | null; onClose: () => void }) {
  const [servings, setServings] = useState(1)
  const [meal, setMeal] = useState<MealType>("lunch")
  const [confirm, setConfirm] = useState(false)
  const [prevId, setPrevId] = useState<string | null>(null)
  if ((editing?.item.id ?? null) !== prevId) {
    setPrevId(editing?.item.id ?? null)
    if (editing) {
      setServings(editing.item.servings)
      setMeal(editing.meal)
    }
  }
  const update = useApiMutation(nutritionApi.updateItem, { success: "Food updated", onSuccess: onClose })
  const remove = useApiMutation(nutritionApi.removeItem, { success: "Food removed", onSuccess: onClose })
  const f = editing?.item.food
  return (
    <>
      <Sheet open={!!editing} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-3xl">
          {f ? (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg font-bold">{f.name}</SheetTitle>
                <SheetDescription>{f.serving} per serving</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4">
                <NumberStepper label="Servings" value={servings} min={0.25} max={20} step={0.25} onChange={setServings} format={(v) => `${formatNumber(v, 2)} serving${v === 1 ? "" : "s"}`} />
                <div className="grid grid-cols-4 gap-2 rounded-xl bg-muted/40 p-3 text-center">
                  {[
                    { l: "kcal", v: f.calories * servings },
                    { l: "Protein", v: f.proteinG * servings },
                    { l: "Carbs", v: f.carbsG * servings },
                    { l: "Fat", v: f.fatG * servings },
                  ].map((x) => (
                    <div key={x.l}>
                      <p className="text-sm font-bold tabular-nums">{formatNumber(x.v, x.l === "kcal" ? 0 : 1)}</p>
                      <p className="text-[11px] text-muted-foreground">{x.l}</p>
                    </div>
                  ))}
                </div>
                <Segmented ariaLabel="Meal" value={meal} onChange={setMeal} className="w-full" options={MEAL_TYPES.map((m) => ({ value: m, label: MEAL_LABEL[m] }))} />
              </div>
              <SheetFooter className="flex-row gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <Button variant="destructive" className="h-11" onClick={() => setConfirm(true)} disabled={remove.isPending}>
                  <Trash2 data-icon="inline-start" /> Remove
                </Button>
                <Button className="h-11 flex-1" onClick={() => editing && update.mutate({ id: editing.item.id, servings, mealType: meal })} disabled={update.isPending}>
                  {update.isPending ? <Spinner /> : null} Save
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Remove this food?" description={f ? `${f.name} will be removed from your log.` : undefined} confirmLabel="Remove" destructive onConfirm={() => editing && remove.mutate({ id: editing.item.id })} />
    </>
  )
}

export default function NutritionPage() {
  return (
    <TrackPage>
      <TrackHeader title="Nutrition" phase={2} subtitle="Your daily food log with calories and macros" />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Nutrition />
      </Suspense>
      <div className="flex items-start gap-2.5 rounded-xl border bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground" role="note">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        <p>General wellness information, not dietary or medical advice. Nutrition values are estimates.</p>
      </div>
    </TrackPage>
  )
}
