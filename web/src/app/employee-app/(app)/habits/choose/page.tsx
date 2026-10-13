"use client"

import { PenLine } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ErrorState } from "@/components/common/states"
import { PhaseBadge } from "@/components/common/status-badge"
import { HABIT_CATEGORY_LABEL, UNIT_LABEL, targetText } from "@/components/employee/track/habit-ui"
import { TrackHeader, TrackPage } from "@/components/employee/track/track-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { UNIT_RANGE, habitsApi, type LibraryHabit, type TodayHabit } from "@/lib/api/employee/habits"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** SCR-M-039 Choose Habits. */
export default function ChooseHabitsPage() {
  const q = useApiQuery(["employee", "habits", "library"], () => habitsApi.library())
  return (
    <TrackPage narrow>
      <TrackHeader title="Choose habits" subtitle="Pick the habits you want to build and set a daily target" backHref="/employee-app/habits" backLabel="My habits" />
      {q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <Chooser habits={q.data.habits} custom={q.data.custom} />
      )}
    </TrackPage>
  )
}

function Chooser({ habits, custom }: { habits: LibraryHabit[]; custom: TodayHabit[] }) {
  const router = useRouter()
  const [sel, setSel] = useState<Record<string, number>>(() => Object.fromEntries(habits.filter((h) => h.selected).map((h) => [h.id, h.target])))
  const [error, setError] = useState<string | null>(null)
  const save = useApiMutation(habitsApi.saveSelection, { success: "Habits updated.", errorTitle: "Couldn't save your habits.", onSuccess: () => router.push("/employee-app/habits") })
  const count = Object.keys(sel).length + custom.length

  const groups = new Map<string, LibraryHabit[]>()
  for (const h of habits) groups.set(h.category, [...(groups.get(h.category) ?? []), h])

  const submit = () => {
    if (count < 1) {
      setError("Choose at least one habit.")
      return
    }
    setError(null)
    save.mutate({ selections: Object.entries(sel).map(([habitId, target]) => ({ habitId, target })) })
  }

  return (
    <>
      <Link href="/employee-app/habits/new" className="flex items-center gap-3 rounded-2xl border border-dashed border-violet-500/40 bg-violet-500/6 p-4 transition-colors hover:bg-violet-500/10">
        <span className="flex size-11 items-center justify-center rounded-xl bg-violet-500 text-white">
          <PenLine className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            Create your own <PhaseBadge phase={2} />
          </p>
          <p className="text-xs text-muted-foreground">A personal habit that isn&apos;t in the list</p>
        </div>
      </Link>

      {custom.length ? (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-bold">Your custom habits</h2>
          <Card className="gap-0 py-0">
            <CardContent className="divide-y p-0">
              {custom.map((h) => (
                <Link key={h.id} href={`/employee-app/habits/${h.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-xl">{h.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{h.name}</p>
                    <p className="text-xs text-muted-foreground">{targetText(h.unit, h.target)}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">Edit</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {[...groups.entries()].map(([cat, list]) => (
        <section key={cat} className="space-y-2">
          <h2 className="px-1 text-sm font-bold">{HABIT_CATEGORY_LABEL[cat] ?? cat}</h2>
          <Card className="gap-0 py-0">
            <CardContent className="divide-y p-0">
              {list.map((h) => {
                const on = h.id in sel
                const range = UNIT_RANGE[h.unit]
                const target = sel[h.id] ?? h.target
                return (
                  <div key={h.id} className={cn("px-4 py-3 transition-colors", on && "bg-primary/4")}>
                    <label htmlFor={`hab-${h.id}`} className="flex cursor-pointer items-center gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">{h.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{h.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {h.description}
                          {h.autoCompleteFrom ? " · Auto-tracked" : ""}
                        </p>
                      </div>
                      <Switch
                        id={`hab-${h.id}`}
                        checked={on}
                        onCheckedChange={(v) =>
                          setSel((s) => {
                            const next = { ...s }
                            if (v) next[h.id] = h.target
                            else delete next[h.id]
                            return next
                          })
                        }
                      />
                    </label>
                    {on && h.unit !== "check" ? (
                      <div className="mt-3 ml-14 flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">Daily target</span>
                        <div className="flex items-center gap-1.5">
                          <Button type="button" variant="outline" size="icon" className="size-8 rounded-full" disabled={target <= range.min} onClick={() => setSel((s) => ({ ...s, [h.id]: Math.max(range.min, target - range.step) }))} aria-label="Decrease target">
                            −
                          </Button>
                          <span className="min-w-20 text-center text-sm font-bold tabular-nums">
                            {formatNumber(target, h.unit === "hours" ? 1 : 0)} {UNIT_LABEL[h.unit]}
                          </span>
                          <Button type="button" variant="outline" size="icon" className="size-8 rounded-full" disabled={target >= range.max} onClick={() => setSel((s) => ({ ...s, [h.id]: Math.min(range.max, target + range.step) }))} aria-label="Increase target">
                            +
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </section>
      ))}

      <div className="sticky bottom-20 z-10 flex items-center gap-2 rounded-2xl border bg-background/90 p-2 shadow-lg backdrop-blur md:bottom-4">
        <p className="flex-1 px-2 text-sm">
          {error ? <span className="font-medium text-destructive">{error}</span> : <span className="text-muted-foreground">{count} selected</span>}
        </p>
        <Button type="button" variant="ghost" className="h-11" onClick={() => router.push("/employee-app/habits")}>
          Cancel
        </Button>
        <Button type="button" className="h-11 min-w-28" onClick={submit} disabled={save.isPending}>
          {save.isPending ? <Spinner /> : null} Save
        </Button>
      </div>
    </>
  )
}
