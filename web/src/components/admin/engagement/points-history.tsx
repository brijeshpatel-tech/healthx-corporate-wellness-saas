"use client"

import { ArrowRight } from "lucide-react"
import { ErrorState } from "@/components/common/states"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useApiQuery } from "@/lib/api/hooks"
import { pointsRulesApi, type PointsHistoryEntry, type PointsRuleRow } from "@/lib/api/platform/points"
import { formatDate, formatNumber, formatRelative } from "@/lib/format"

const cap = (v: number | null) => (v === null ? "no cap" : formatNumber(v))

/** Human-readable list of what changed in a history entry. */
export function ChangeSummary({ entry }: { entry: PointsHistoryEntry }) {
  if (!entry.old) {
    return (
      <span>
        Created · {formatNumber(entry.next.points)} pts, cap {cap(entry.next.dailyCap)}
      </span>
    )
  }
  const parts: React.ReactNode[] = []
  if (entry.old.points !== entry.next.points)
    parts.push(
      <span key="p" className="inline-flex items-center gap-1">
        Points {formatNumber(entry.old.points)} <ArrowRight className="size-3" /> <strong className="font-semibold">{formatNumber(entry.next.points)}</strong>
      </span>,
    )
  if (entry.old.dailyCap !== entry.next.dailyCap)
    parts.push(
      <span key="c" className="inline-flex items-center gap-1">
        Cap {cap(entry.old.dailyCap)} <ArrowRight className="size-3" /> <strong className="font-semibold">{cap(entry.next.dailyCap)}</strong>
      </span>,
    )
  if (entry.old.active !== entry.next.active) parts.push(<span key="a">{entry.next.active ? "Activated" : "Deactivated"}</span>)
  return <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">{parts.length ? parts : "No value change"}</span>
}

export function PointsHistorySheet({ rule, onOpenChange }: { rule: PointsRuleRow | null; onOpenChange: (open: boolean) => void }) {
  const q = useApiQuery(["admin", "points-history", rule?.id], () => pointsRulesApi.history({ id: rule!.id }), { enabled: !!rule })
  return (
    <Sheet open={!!rule} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle className="font-heading text-lg">{rule?.label ?? "Rule"} — history</SheetTitle>
          <SheetDescription>Every saved version, newest first. Points already earned are never recalculated.</SheetDescription>
        </SheetHeader>
        <div className="p-4">
          {q.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : q.error ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          ) : (
            <ol className="space-y-3">
              {(q.data ?? []).map((e) => (
                <li key={e.id} className="rounded-xl border bg-card p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={e.version === rule?.version ? "default" : "secondary"}>v{e.version}</Badge>
                    {e.version === rule?.version ? <span className="text-xs font-medium text-primary">Current</span> : null}
                    <span className="ml-auto text-xs text-muted-foreground">{formatRelative(e.at)}</span>
                  </div>
                  <div className="mt-2 text-sm">
                    <ChangeSummary entry={e} />
                  </div>
                  <div className="mt-1.5 text-xs text-muted-foreground">
                    Effective from {formatDate(e.effectiveFrom)} · by {e.by}
                  </div>
                  {e.note ? <p className="mt-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs break-words">“{e.note}”</p> : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
