"use client"

import { ArrowDown, ArrowUp, BarChart3, Droplets, Dumbbell, Footprints, GripVertical, HeartPulse, ListChecks, Lock, Moon, RotateCcw, Sparkles, Trophy, type LucideIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { ConfirmDialog } from "@/components/common/misc"
import { ErrorState } from "@/components/common/states"
import { PhaseBadge } from "@/components/common/status-badge"
import { TrackHeader, TrackPage } from "@/components/employee/track/track-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { homeApi, type HomeCardKey, type HomeLayout } from "@/lib/api/employee/home"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { cn } from "@/lib/utils"

const ICON: Record<HomeCardKey, { icon: LucideIcon; color: string }> = {
  score: { icon: HeartPulse, color: "bg-emerald-500" },
  steps: { icon: Footprints, color: "bg-sky-500" },
  water: { icon: Droplets, color: "bg-cyan-500" },
  workout: { icon: Dumbbell, color: "bg-violet-500" },
  habits: { icon: ListChecks, color: "bg-emerald-600" },
  sleep: { icon: Moon, color: "bg-indigo-500" },
  challenge: { icon: Trophy, color: "bg-amber-500" },
  rank: { icon: BarChart3, color: "bg-orange-500" },
  summary: { icon: Sparkles, color: "bg-fuchsia-500" },
}

type Row = HomeLayout["cards"][number]

/** SCR-M-021 Customise Home (Phase 2). */
export default function CustomiseHomePage() {
  const q = useApiQuery(["employee", "home-layout"], () => homeApi.layout())
  return (
    <TrackPage>
      <TrackHeader title="Customise Home" phase={2} subtitle="Choose which cards appear on Home and in what order" backHref="/employee-app/home" backLabel="Home" />
      {q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Skeleton className="h-[560px] rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : (
        <Editor key={q.data.cards.map((c) => `${c.key}${c.visible}`).join()} layout={q.data} />
      )}
    </TrackPage>
  )
}

function Editor({ layout }: { layout: HomeLayout }) {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>(layout.cards)
  const [dragging, setDragging] = useState<HomeCardKey | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const listRef = useRef<HTMLUListElement>(null)
  const save = useApiMutation(homeApi.saveLayout, { success: "Home layout updated.", errorTitle: "Couldn't save your layout.", onSuccess: () => router.push("/employee-app/home") })
  const reset = useApiMutation(homeApi.resetLayout, { success: "Home layout reset to default", onSuccess: (l) => setRows(l.cards) })
  const dirty = rows.map((r) => `${r.key}${r.visible}`).join() !== layout.cards.map((r) => `${r.key}${r.visible}`).join()

  const move = (from: number, to: number) =>
    setRows((rs) => {
      if (to < 0 || to >= rs.length || from === to) return rs
      const next = [...rs]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item!)
      return next
    })

  // Pointer-based drag (works with mouse and touch).
  const onPointerDown = (key: HomeCardKey) => (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(key)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !listRef.current) return
    const items = [...listRef.current.querySelectorAll<HTMLLIElement>("[data-row]")]
    const from = items.findIndex((el) => el.dataset.row === dragging)
    let to = from
    items.forEach((el, i) => {
      const r = el.getBoundingClientRect()
      if (e.clientY > r.top + r.height / 2 && i > from) to = i
      if (e.clientY < r.top + r.height / 2 && i < from && to === from) to = i
    })
    if (to !== from) move(from, to)
  }
  const onPointerUp = () => setDragging(null)

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
      <Card className="gap-0 py-0">
        <CardContent className="p-2 sm:p-3">
          <p className="px-2 pt-2 pb-3 text-xs text-muted-foreground">Drag the handle (or use the arrows) to reorder. Turn a card off to hide it.</p>
          <ul ref={listRef} className="space-y-1.5" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            {rows.map((r, i) => {
              const meta = ICON[r.key]
              return (
                <li
                  key={r.key}
                  data-row={r.key}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border bg-card p-2.5 transition-shadow select-none",
                    dragging === r.key && "z-10 shadow-lg ring-2 ring-primary/40",
                    (!r.visible || !r.available) && "bg-muted/30",
                  )}
                >
                  <button
                    type="button"
                    aria-label={`Drag to reorder ${r.label}`}
                    onPointerDown={onPointerDown(r.key)}
                    className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground hover:bg-muted active:cursor-grabbing"
                  >
                    <GripVertical className="size-4" />
                  </button>
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg text-white", meta.color, (!r.visible || !r.available) && "opacity-40")}>
                    <meta.icon className="size-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                      {r.label}
                      {r.phase ? <PhaseBadge phase={2} /> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{!r.available ? "Not available for your company" : r.mandatory ? "Always shown" : r.description}</p>
                  </div>
                  <div className="hidden flex-col sm:flex">
                    <Button variant="ghost" size="icon-xs" aria-label={`Move ${r.label} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>
                      <ArrowUp />
                    </Button>
                    <Button variant="ghost" size="icon-xs" aria-label={`Move ${r.label} down`} disabled={i === rows.length - 1} onClick={() => move(i, i + 1)}>
                      <ArrowDown />
                    </Button>
                  </div>
                  {r.mandatory ? (
                    <span className="flex size-9 items-center justify-center text-muted-foreground" title="This card can't be hidden">
                      <Lock className="size-4" />
                    </span>
                  ) : (
                    <Switch
                      aria-label={`Show ${r.label}`}
                      checked={r.visible && r.available}
                      disabled={!r.available}
                      onCheckedChange={(v) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, visible: v } : x)))}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 lg:sticky lg:top-20">
        <Card className="gap-0 py-0">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-semibold">Preview</p>
            <div className="mx-auto w-full max-w-[240px] rounded-[28px] border-4 border-foreground/80 bg-background p-2.5 shadow-lg">
              <div className="mb-2 h-2 w-16 rounded-full bg-muted" />
              <div className="grid grid-flow-row-dense grid-cols-2 gap-1.5">
                {rows
                  .filter((r) => r.visible && r.available)
                  .map((r) => (
                    <div
                      key={r.key}
                      className={cn(
                        "flex items-center gap-1 rounded-md px-1.5 text-[9px] font-semibold text-white",
                        ICON[r.key].color,
                        r.size === "tile" ? "col-span-1 h-9" : r.size === "wide" ? "col-span-2 h-7" : "col-span-2 h-12",
                      )}
                    >
                      <span className="truncate">{r.label}</span>
                    </div>
                  ))}
              </div>
            </div>
            <p className="text-center text-[11px] text-muted-foreground">Changes apply next time you open Home.</p>
          </CardContent>
        </Card>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11" onClick={() => setConfirmReset(true)} disabled={reset.isPending}>
            {reset.isPending ? <Spinner /> : <RotateCcw data-icon="inline-start" />} Reset to default
          </Button>
          <Button className="h-11 flex-1" disabled={!dirty || save.isPending} onClick={() => save.mutate({ cards: rows.map((r) => ({ key: r.key, visible: r.visible })) })}>
            {save.isPending ? <Spinner /> : null} Save
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset Home to the default layout?"
        description="All cards will be shown again in the standard order."
        confirmLabel="Reset"
        onConfirm={() => reset.mutate()}
      />
    </div>
  )
}
