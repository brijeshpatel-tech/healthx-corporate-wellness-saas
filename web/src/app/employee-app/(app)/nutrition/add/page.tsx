"use client"

import { keepPreviousData } from "@tanstack/react-query"
import { History, SearchX } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { toast } from "sonner"
import { SearchInput } from "@/components/common/misc"
import { EmptyState, ErrorState } from "@/components/common/states"
import { NumberStepper, Segmented, TrackHeader, TrackPage, dayLabel, localDate } from "@/components/employee/track/track-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { MEAL_LABEL, MEAL_TYPES, nutritionApi, type MealType } from "@/lib/api/employee/nutrition"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import type { FoodItem } from "@/lib/types"

function defaultMeal(): MealType {
  const h = new Date().getHours()
  return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 18 ? "snack" : "dinner"
}

/** SCR-M-037 Log Meal – Search & Add Food (Phase 2). */
function AddFood() {
  const params = useSearchParams()
  const router = useRouter()
  const date = params.get("date") ?? localDate()
  const initialMeal = params.get("meal") as MealType | null
  const [meal, setMeal] = useState<MealType>(initialMeal && MEAL_TYPES.includes(initialMeal) ? initialMeal : defaultMeal())
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState<FoodItem | null>(null)
  const [servings, setServings] = useState(1)

  const results = useApiQuery(["employee", "foods", search, page], () => nutritionApi.foods({ q: search, page }), { placeholderData: keepPreviousData })
  const recent = useApiQuery(["employee", "foods", "recent"], () => nutritionApi.recentFoods())
  const add = useApiMutation(nutritionApi.add, {
    errorTitle: "Couldn't add this food. Try again.",
    onSuccess: () => {
      toast.success(`Added to ${MEAL_LABEL[meal]}`)
      router.push(date === localDate() ? "/employee-app/nutrition" : `/employee-app/nutrition?date=${date}`)
    },
  })

  const pick = (f: FoodItem) => {
    setPicked(f)
    setServings(1)
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            Add to <span className="text-muted-foreground">· {dayLabel(date)}</span>
          </p>
        </div>
        <Segmented ariaLabel="Meal" value={meal} onChange={setMeal} className="w-full" options={MEAL_TYPES.map((m) => ({ value: m, label: MEAL_LABEL[m] }))} />
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search foods, e.g. dal, idli, paneer"
          className="w-full sm:w-full [&_input]:h-11 [&_input]:rounded-xl [&_input]:text-base sm:[&_input]:text-sm"
        />
      </div>

      {!search && recent.data?.length ? (
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 px-1 text-sm font-bold">
            <History className="size-4 text-muted-foreground" /> Recent foods
          </h2>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            {recent.data.map((f) => (
              <button key={f.id} type="button" onClick={() => pick(f)} className="shrink-0 rounded-full border bg-card px-3.5 py-2 text-sm font-medium hover:border-primary/40">
                {f.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-bold">{search ? "Results" : "All foods"}</h2>
        {results.error ? (
          <ErrorState error={results.error} onRetry={() => results.refetch()} />
        ) : !results.data ? (
          <Skeleton className="h-80 rounded-xl" />
        ) : results.data.items.length === 0 ? (
          <EmptyState icon={SearchX} title={`No foods found for "${search}".`} description="Try a simpler word, like the main ingredient." />
        ) : (
          <Card className="gap-0 py-0">
            <CardContent className="divide-y p-0">
              {results.data.items.map((f) => (
                <button key={f.id} type="button" onClick={() => pick(f)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{f.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {f.serving} · P {f.proteinG} g · C {f.carbsG} g · F {f.fatG} g
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{f.calories}</span>
                  <span className="text-xs text-muted-foreground">kcal</span>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
        {results.data?.hasMore ? (
          <div className="flex justify-center">
            <Button variant="ghost" onClick={() => setPage((p) => p + 1)} disabled={results.isFetching}>
              {results.isFetching ? <Spinner /> : null} Show more
            </Button>
          </div>
        ) : null}
      </section>

      <Sheet open={!!picked} onOpenChange={(o) => !o && setPicked(null)}>
        <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-3xl">
          {picked ? (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg font-bold">{picked.name}</SheetTitle>
                <SheetDescription>{picked.serving} per serving</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4">
                <NumberStepper label="Servings" value={servings} min={0.25} max={20} step={0.25} onChange={setServings} format={(v) => `${formatNumber(v, 2)} serving${v === 1 ? "" : "s"}`} />
                <div className="flex justify-center gap-2">
                  {[0.5, 1, 1.5, 2].map((v) => (
                    <button key={v} type="button" onClick={() => setServings(v)} aria-pressed={servings === v} className="rounded-full border px-3 py-1 text-xs font-medium aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary">
                      {v}×
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2 rounded-xl bg-muted/40 p-3 text-center">
                  {[
                    { l: "kcal", v: picked.calories * servings, d: 0 },
                    { l: "Protein", v: picked.proteinG * servings, d: 1 },
                    { l: "Carbs", v: picked.carbsG * servings, d: 1 },
                    { l: "Fat", v: picked.fatG * servings, d: 1 },
                  ].map((x) => (
                    <div key={x.l}>
                      <p className="text-base font-bold tabular-nums">
                        {formatNumber(x.v, x.d)}
                        {x.l !== "kcal" ? <span className="text-xs font-medium"> g</span> : null}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{x.l}</p>
                    </div>
                  ))}
                </div>
              </div>
              <SheetFooter className="flex-row gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <Button variant="outline" className="h-11" onClick={() => setPicked(null)}>
                  Cancel
                </Button>
                <Button className="h-11 flex-1" onClick={() => add.mutate({ date, mealType: meal, foodId: picked.id, servings })} disabled={add.isPending}>
                  {add.isPending ? <Spinner /> : null} Add to {MEAL_LABEL[meal]}
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}

export default function AddFoodPage() {
  return (
    <TrackPage narrow>
      <TrackHeader title="Add food" phase={2} subtitle="Search the food list and choose a portion" backHref="/employee-app/nutrition" backLabel="Nutrition" />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <AddFood />
      </Suspense>
    </TrackPage>
  )
}
