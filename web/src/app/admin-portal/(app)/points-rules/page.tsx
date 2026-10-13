"use client"

import { CalendarClock, Coins, History, Info, Plus, Save, Undo2 } from "lucide-react"
import { useState } from "react"
import { pointsSourceMeta } from "@/components/admin/engagement/meta"
import { ChangeSummary, PointsHistorySheet } from "@/components/admin/engagement/points-history"
import { PointsRuleDialog } from "@/components/admin/engagement/points-rule-dialog"
import { FormActions } from "@/components/admin/form-layout"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { EmptyState, ErrorState } from "@/components/common/states"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { ApiError } from "@/lib/api/core"
import { today } from "@/lib/api/platform/common"
import { pointsRulesApi, type PointsRuleRow } from "@/lib/api/platform/points"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber, formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

type Draft = { points: number | ""; dailyCap: number | ""; active: boolean }

const toDraft = (r: PointsRuleRow): Draft => ({ points: r.points, dailyCap: r.dailyCap ?? "", active: r.active })
const same = (a: Draft, b: Draft) => a.points === b.points && a.dailyCap === b.dailyCap && a.active === b.active

function validate(d: Draft): { points?: string; dailyCap?: string } {
  const e: { points?: string; dailyCap?: string } = {}
  if (d.points === "" || !Number.isInteger(d.points) || d.points < 0 || d.points > 1000) e.points = "0–1,000 whole points"
  if (d.dailyCap !== "") {
    if (!Number.isInteger(d.dailyCap) || d.dailyCap < 1 || d.dailyCap > 10000) e.dailyCap = "1–10,000, or empty"
    else if (typeof d.points === "number" && d.points > 0 && d.dailyCap < d.points) e.dailyCap = "Can't be below points"
  }
  return e
}

const GRID = "md:grid md:grid-cols-[minmax(0,1fr)_104px_120px_64px_128px_40px] md:items-center md:gap-4"

export default function PointsRulesPage() {
  const can = useAdminCan()
  const canManage = can("points.manage")
  const q = useApiQuery(["admin", "points-rules"], () => pointsRulesApi.list())
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [effectiveFrom, setEffectiveFrom] = useState(today())
  const [note, setNote] = useState("")
  const [historyFor, setHistoryFor] = useState<PointsRuleRow | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const rules = q.data?.rules ?? []
  const changed = rules.filter((r) => drafts[r.id] && !same(drafts[r.id]!, toDraft(r)))
  const invalid = changed.some((r) => Object.keys(validate(drafts[r.id]!)).length > 0)
  const dateError = !effectiveFrom ? "Choose a date" : effectiveFrom < today() ? "Can't be in the past" : undefined

  const edit = (r: PointsRuleRow, patch: Partial<Draft>) => {
    setDrafts((prev) => {
      const next = { ...(prev[r.id] ?? toDraft(r)), ...patch }
      const copy = { ...prev }
      if (same(next, toDraft(r))) delete copy[r.id]
      else copy[r.id] = next
      return copy
    })
    setServerErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(`${r.id}.`))))
  }

  const discard = () => {
    setDrafts({})
    setServerErrors({})
    setNote("")
  }

  const save = useApiMutation(pointsRulesApi.save, {
    success: (r) => (r.updated === 1 ? `Rule updated – applies from ${formatDate(r.effectiveFrom, "d MMM")}.` : `${r.updated} rules updated – apply from ${formatDate(r.effectiveFrom, "d MMM")}.`),
    errorTitle: "Couldn't save rule.",
    onSuccess: () => discard(),
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) setServerErrors(err.fieldErrors)
    },
  })

  const submit = () => {
    if (invalid || dateError || changed.length === 0) return
    save.mutate({
      effectiveFrom,
      note: note.trim() || undefined,
      changes: changed.map((r) => {
        const d = drafts[r.id]!
        return { id: r.id, points: d.points as number, dailyCap: d.dailyCap === "" ? null : d.dailyCap, active: d.active }
      }),
    })
  }

  return (
    <PageContainer className={changed.length ? "pb-0 sm:pb-0 lg:pb-0" : undefined}>
      <PageHeader
        title="Points rules"
        description="The central rules that decide how many points employees earn. Nothing is hard-coded — every company's app reads these values."
        actions={
          canManage ? (
            <Button onClick={() => setAddOpen(true)}>
              <Plus data-icon="inline-start" /> Add rule
            </Button>
          ) : null
        }
      />

      <Alert>
        <Info />
        <AlertDescription>
          Edit points and daily caps right in the table, then save them with an effective date. Changes apply to new events from that date — points already earned never change. Every save creates a new rule version and is audit-logged.
        </AlertDescription>
      </Alert>

      {q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <div className={cn("hidden border-b bg-muted/40 px-4 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase", GRID)}>
            <span>Rule &amp; trigger</span>
            <span>Points</span>
            <span>Daily cap</span>
            <span>Active</span>
            <span>Version</span>
            <span className="sr-only">History</span>
          </div>
          {q.isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b px-4 py-4 last:border-0">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-28" />
              </div>
            ))
          ) : rules.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={Coins} title="No points rules yet" description="Add rules for steps, workouts, meditation, water, challenges and streaks." className="border-0 bg-transparent" />
            </div>
          ) : (
            rules.map((r) => {
              const d = drafts[r.id] ?? toDraft(r)
              const dirty = !!drafts[r.id]
              const errs = validate(d)
              const pointsError = errs.points ?? serverErrors[`${r.id}.points`]
              const capError = errs.dailyCap ?? serverErrors[`${r.id}.dailyCap`]
              const src = pointsSourceMeta(r.eventType)
              return (
                <div key={r.id} className={cn("space-y-3 border-b px-4 py-3.5 last:border-0 md:space-y-0", GRID, dirty && "bg-amber-500/6", !d.active && "text-muted-foreground")}>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("font-medium", d.active && "text-foreground")}>{r.label}</span>
                      {dirty ? <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-300">Edited</Badge> : null}
                      {!r.active ? <Badge variant="outline">Inactive</Badge> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5">
                        {src.emoji} {src.label}
                      </span>
                      {r.per ? <span>per {r.per}</span> : null}
                    </div>
                    {r.description ? <p className="line-clamp-2 text-xs text-muted-foreground">{r.description}</p> : null}
                  </div>

                  <div className="grid grid-cols-[1fr_1fr_auto] items-start gap-3 md:contents">
                    <div className="space-y-1">
                      <Label htmlFor={`pts-${r.id}`} className="text-xs text-muted-foreground md:sr-only">
                        Points
                      </Label>
                      <Input
                        id={`pts-${r.id}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={1000}
                        value={d.points}
                        disabled={!canManage || save.isPending}
                        aria-invalid={!!pointsError}
                        onChange={(e) => edit(r, { points: e.target.value === "" ? "" : Number(e.target.value) })}
                        className="h-9 tabular-nums"
                      />
                      {pointsError ? <p className="text-[11px] font-medium text-destructive">{pointsError}</p> : null}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`cap-${r.id}`} className="text-xs text-muted-foreground md:sr-only">
                        Daily cap
                      </Label>
                      <Input
                        id={`cap-${r.id}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        placeholder="No cap"
                        value={d.dailyCap}
                        disabled={!canManage || save.isPending}
                        aria-invalid={!!capError}
                        onChange={(e) => edit(r, { dailyCap: e.target.value === "" ? "" : Number(e.target.value) })}
                        className="h-9 tabular-nums"
                      />
                      {capError ? <p className="text-[11px] font-medium text-destructive">{capError}</p> : null}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`act-${r.id}`} className="text-xs text-muted-foreground md:sr-only">
                        Active
                      </Label>
                      <div className="flex h-9 items-center">
                        <Switch id={`act-${r.id}`} checked={d.active} disabled={!canManage || save.isPending} onCheckedChange={(v) => edit(r, { active: v })} aria-label={`${r.label} active`} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 md:contents">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">v{r.version}</span> · updated {formatRelative(r.updatedAt)}
                      <div className={cn(r.scheduled && "font-medium text-sky-700 dark:text-sky-300")}>
                        {r.scheduled ? <CalendarClock className="mr-1 inline size-3" /> : null}
                        {r.scheduled ? "Applies" : "Effective"} from {formatDate(r.effectiveFrom, "d MMM")}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => setHistoryFor(r)} aria-label={`History for ${r.label}`}>
                      <History />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </Card>
      )}

      <SectionCard title="Recent changes" description="Latest rule versions across all rules.">
        {q.isLoading ? (
          <Skeleton className="h-32 rounded-lg" />
        ) : (q.data?.recentChanges.length ?? 0) === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No changes yet.</p>
        ) : (
          <ol className="divide-y">
            {q.data!.recentChanges.map((e) => (
              <li key={e.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{e.ruleLabel}</span>
                    <Badge variant="secondary">v{e.version}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <ChangeSummary entry={e} />
                  </div>
                  {e.note ? <p className="text-xs break-words text-muted-foreground">“{e.note}”</p> : null}
                </div>
                <div className="shrink-0 text-xs text-muted-foreground sm:text-right">
                  <div>From {formatDate(e.effectiveFrom)}</div>
                  <div>
                    {e.by} · {formatRelative(e.at)}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>

      {changed.length > 0 && canManage ? (
        <FormActions
          className="sm:flex-col sm:items-stretch lg:flex-row lg:items-end"
          hint={
            <span className="text-sm font-medium text-foreground">
              {changed.length === 1 ? "1 rule changed" : `${formatNumber(changed.length)} rules changed`}
              {invalid ? <span className="ml-2 text-destructive">— fix the highlighted values</span> : null}
            </span>
          }
        >
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end lg:w-auto">
            <div className="space-y-1">
              <Label htmlFor="pr-effective" className="text-xs">
                Effective from
              </Label>
              <Input id="pr-effective" type="date" min={today()} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} aria-invalid={!!(dateError ?? serverErrors.effectiveFrom)} className="h-9 sm:w-40" />
              {dateError ?? serverErrors.effectiveFrom ? <p className="text-[11px] font-medium text-destructive">{dateError ?? serverErrors.effectiveFrom}</p> : null}
            </div>
            <div className="min-w-0 flex-1 space-y-1 lg:w-72">
              <Label htmlFor="pr-note" className="text-xs">
                Change note
              </Label>
              <Input id="pr-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Why are you changing this? (optional)" className="h-9" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={discard} disabled={save.isPending} className="h-9 flex-1 sm:flex-none">
                <Undo2 data-icon="inline-start" /> Discard
              </Button>
              <Button onClick={submit} disabled={save.isPending || invalid || !!dateError} className="h-9 flex-1 sm:flex-none">
                {save.isPending ? <Spinner /> : <Save data-icon="inline-start" />} Save changes
              </Button>
            </div>
          </div>
        </FormActions>
      ) : null}

      <PointsHistorySheet rule={historyFor} onOpenChange={(o) => !o && setHistoryFor(null)} />
      <PointsRuleDialog open={addOpen} onOpenChange={setAddOpen} />
    </PageContainer>
  )
}
