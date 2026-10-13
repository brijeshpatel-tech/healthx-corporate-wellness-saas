"use client"

import { keepPreviousData } from "@tanstack/react-query"
import { CalendarDays, Flame, MapPin, Pencil, Timer, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/common/misc"
import { EmptyState, ErrorState } from "@/components/common/states"
import { ACTIVITY_META, SOURCE_LABEL } from "@/components/employee/track/activity-meta"
import { ReviewNote, SourceBadge } from "@/components/employee/track/review-badge"
import { Chip, Segmented, TrackHeader, TrackPage, addDays, dayLabel, localDate } from "@/components/employee/track/track-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ACTIVITY_TYPES, activityApi } from "@/lib/api/employee/activity"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDuration, formatNumber, formatTime } from "@/lib/format"
import type { ActivitySession, ActivityType } from "@/lib/types"

type Range = "7" | "30" | "90"
const PAGE = 20

/** SCR-M-023 Activity History. */
export default function ActivityHistoryPage() {
  const router = useRouter()
  const [type, setType] = useState<ActivityType | "all">("all")
  const [range, setRange] = useState<Range>("30")
  const [pageSize, setPageSize] = useState(PAGE)
  const [selected, setSelected] = useState<ActivitySession | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const from = addDays(localDate(), -Number(range) + 1)
  const q = useApiQuery(["employee", "activity", "history", type, range, pageSize], () => activityApi.history({ type, from, to: localDate(), pageSize }), { placeholderData: keepPreviousData })

  const restore = useApiMutation(activityApi.restore, { success: "Activity restored" })
  const remove = useApiMutation(activityApi.remove, {
    onSuccess: (s) => {
      setSelected(null)
      toast.success("Activity deleted.", { duration: 5000, action: { label: "Undo", onClick: () => restore.mutate({ id: s.id }) } })
    },
  })

  // Infinite scroll
  const sentinel = useRef<HTMLDivElement>(null)
  const hasMore = !!q.data?.hasMore
  const fetching = q.isFetching
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore) return
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !fetching) setPageSize((p) => p + PAGE)
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, fetching])

  const groups = new Map<string, ActivitySession[]>()
  for (const s of q.data?.items ?? []) {
    const d = localDate(new Date(s.startedAt))
    groups.set(d, [...(groups.get(d) ?? []), s])
  }

  const resetPaging = () => setPageSize(PAGE)
  const selectedReview = selected ? q.data?.reviews[selected.id] : undefined

  return (
    <TrackPage narrow>
      <TrackHeader title="Activity history" subtitle="Synced and manual activities, newest first" backHref="/employee-app/activity" backLabel="Activity" />

      <div className="space-y-3">
        <Segmented
          ariaLabel="Date range"
          value={range}
          onChange={(v) => {
            setRange(v)
            resetPaging()
          }}
          options={[
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
          ]}
        />
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip
            selected={type === "all"}
            onClick={() => {
              setType("all")
              resetPaging()
            }}
          >
            All types
          </Chip>
          {ACTIVITY_TYPES.map((t) => (
            <Chip
              key={t}
              selected={type === t}
              onClick={() => {
                setType(t)
                resetPaging()
              }}
              className="shrink-0"
            >
              <span>{ACTIVITY_META[t].emoji}</span> {ACTIVITY_META[t].label}
            </Chip>
          ))}
        </div>
      </div>

      {q.error ? (
        <ErrorState error={new Error("Couldn't load your history.")} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : q.data.items.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No activities in this period." description="Try a longer date range or another activity type." />
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([date, items]) => {
            const totals = q.data.dayTotals[date]
            return (
              <section key={date} className="space-y-2">
                <div className="flex items-baseline justify-between gap-2 px-1">
                  <h2 className="text-sm font-bold">{dayLabel(date)}</h2>
                  {totals ? (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatNumber(totals.steps)} steps · {totals.activeMinutes} active min
                    </p>
                  ) : null}
                </div>
                <Card className="gap-0 py-0">
                  <CardContent className="divide-y p-0">
                    {items.map((s) => {
                      const meta = ACTIVITY_META[s.type]
                      return (
                        <button key={s.id} type="button" onClick={() => setSelected(s)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40">
                          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">{meta.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{s.source === "workout" && s.notes ? s.notes : meta.label}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {formatTime(s.startedAt)} · {formatDuration(s.durationMin)}
                              {s.distanceKm ? ` · ${formatNumber(s.distanceKm, 1)} km` : ""}
                            </p>
                          </div>
                          <SourceBadge session={s} review={q.data.reviews[s.id]} />
                        </button>
                      )
                    })}
                  </CardContent>
                </Card>
              </section>
            )
          })}
          <div ref={sentinel} className="flex justify-center py-2">
            {q.data.hasMore ? (
              <Button variant="ghost" onClick={() => setPageSize((p) => p + PAGE)} disabled={q.isFetching}>
                {q.isFetching ? <Spinner /> : null} Load more
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">That&apos;s everything for this period</p>
            )}
          </div>
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="bottom" className="mx-auto max-h-[85svh] max-w-lg rounded-t-3xl pb-[env(safe-area-inset-bottom)]">
          {selected ? (
            <>
              <SheetHeader className="items-center pt-6 text-center">
                <span className="flex size-16 items-center justify-center rounded-2xl bg-muted text-4xl">{ACTIVITY_META[selected.type].emoji}</span>
                <SheetTitle className="text-lg font-bold">{selected.source === "workout" && selected.notes ? selected.notes : ACTIVITY_META[selected.type].label}</SheetTitle>
                <SheetDescription>
                  {dayLabel(localDate(new Date(selected.startedAt)))} at {formatTime(selected.startedAt)} · {SOURCE_LABEL[selected.source]}
                </SheetDescription>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-2 px-4">
                <Stat icon={Timer} label="Duration" value={formatDuration(selected.durationMin)} />
                <Stat icon={MapPin} label="Distance" value={selected.distanceKm ? `${formatNumber(selected.distanceKm, 1)} km` : "—"} />
                <Stat icon={Flame} label="Calories" value={selected.calories ? `${formatNumber(selected.calories)} kcal` : "—"} />
              </div>
              {selected.steps ? <p className="px-4 text-center text-sm text-muted-foreground">{formatNumber(selected.steps)} steps counted towards your daily total</p> : null}
              {selected.notes && selected.source === "manual" ? <p className="mx-4 rounded-xl bg-muted/40 p-3 text-sm">{selected.notes}</p> : null}
              {selected.source === "manual" ? (
                <div className="px-4">
                  <ReviewNote review={selectedReview} />
                </div>
              ) : null}
              <SheetFooter className="flex-row gap-2">
                {selected.source === "manual" && selectedReview?.status === "approved" ? (
                  <p className="w-full text-center text-xs text-muted-foreground">Approved entries are locked. Ask your HR team if something needs correcting.</p>
                ) : selected.source === "manual" ? (
                  <>
                    <Button variant="outline" className="h-11 flex-1" onClick={() => router.push(`/employee-app/activity/log?id=${selected.id}`)}>
                      <Pencil data-icon="inline-start" /> Edit
                    </Button>
                    <Button variant="destructive" className="h-11 flex-1" onClick={() => setConfirmDelete(true)} disabled={remove.isPending}>
                      {remove.isPending ? <Spinner /> : <Trash2 data-icon="inline-start" />} Delete
                    </Button>
                  </>
                ) : (
                  <p className="w-full text-center text-xs text-muted-foreground">Synced activities are read-only. Edit them in your health app.</p>
                )}
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this activity?"
        description="Your daily totals, streaks and points will be recalculated. You can undo for a few seconds."
        confirmLabel="Delete"
        destructive
        onConfirm={() => selected && remove.mutate({ id: selected.id })}
      />
    </TrackPage>
  )
}

function Stat({ icon: Icon, label, value }: { icon: typeof Timer; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/40 p-3 text-center">
      <Icon className="size-4 text-muted-foreground" />
      <p className="text-sm font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}
