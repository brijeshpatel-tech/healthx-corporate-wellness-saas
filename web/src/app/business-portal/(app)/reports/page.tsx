"use client"

import { CalendarClock, CheckCircle2, Download, FileBarChart, Lightbulb, Loader2, Mail, Sparkles } from "lucide-react"
import { useState } from "react"
import { LogoMark } from "@/components/brand/logo"
import { PrintStyles } from "@/components/business/people/print-styles"
import { BarsChart, TrendChart } from "@/components/common/charts"
import { PrivacyNote } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { Delta } from "@/components/common/stat-card"
import { EmptyState, ErrorState } from "@/components/common/states"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { reportsApi, type MonthlyReport, type ReportKpi, type ReportMonth, type ReportSchedule } from "@/lib/api/business/analytics"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatCompact, formatDate, formatDateTime, formatNumber, formatPercent, formatShortDate } from "@/lib/format"
import { cn } from "@/lib/utils"

/** SCR-B-029 — Monthly report (Phase 2): pick a month, preview, download as PDF, schedule email delivery. */
export default function MonthlyReportPage() {
  const list = useApiQuery(["business", "reports"], () => reportsApi.list())
  const [selected, setSelected] = useState<string | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const months = list.data?.months ?? []
  const fallback = months.find((m) => m.status === "ready" && !m.partial) ?? months[0]
  const current = months.find((m) => m.id === selected) ?? fallback

  const generate = useApiMutation(reportsApi.generate, { success: (r) => `${r.label} report is ready.` })

  return (
    <PageContainer>
      <PrintStyles />
      <PageHeader
        className="print:hidden"
        title="Monthly report"
        badge={<PhaseBadge phase={2} />}
        description="A printable summary of wellness participation for HR and leadership. Aggregated figures only."
        actions={
          <>
            <Button variant="outline" onClick={() => setScheduleOpen(true)} disabled={!list.data}>
              <CalendarClock data-icon="inline-start" /> Schedule
            </Button>
            <Button onClick={() => window.print()} disabled={current?.status !== "ready"}>
              <Download data-icon="inline-start" /> Download PDF
            </Button>
          </>
        }
      />

      {list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-[640px] rounded-xl" />
        </div>
      ) : months.length === 0 ? (
        <EmptyState icon={FileBarChart} title="No reports yet." description="Your first report will be available after a full month." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="space-y-3 print:hidden">
            <Select value={current?.id} onValueChange={setSelected}>
              <SelectTrigger className="h-9 w-full lg:hidden">
                <SelectValue placeholder="Choose a month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                    {m.partial ? " (so far)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Card className="hidden gap-0 py-0 lg:flex">
              <CardContent className="p-2">
                <p className="px-2 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Reports</p>
                <ul className="space-y-0.5">
                  {months.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(m.id)}
                        className={cn("flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted", current?.id === m.id && "bg-primary/10 font-semibold text-primary hover:bg-primary/10")}
                      >
                        <span className="truncate">{m.label}</span>
                        {m.partial ? <Badge variant="outline">So far</Badge> : m.status === "ready" ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : <span className="text-xs text-muted-foreground">Not generated</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <ScheduleSummary schedule={list.data!.schedule} recipients={list.data!.recipients} onEdit={() => setScheduleOpen(true)} />
          </aside>

          <div className="min-w-0">
            {current ? (
              current.status === "ready" ? (
                <ReportView month={current} />
              ) : (
                <EmptyState
                  icon={Sparkles}
                  title={`${current.label} hasn't been generated yet`}
                  description={current.partial ? "This month isn't over yet — generate a month-to-date preview." : "Generate it now to preview and download."}
                  action={
                    <Button onClick={() => generate.mutate({ month: current.id })} disabled={generate.isPending}>
                      {generate.isPending ? <Spinner /> : <Sparkles data-icon="inline-start" />}
                      Generate report
                    </Button>
                  }
                />
              )
            ) : null}
          </div>
        </div>
      )}

      {list.data ? <ScheduleDialog open={scheduleOpen} onOpenChange={setScheduleOpen} schedule={list.data.schedule} recipients={list.data.recipients} /> : null}
    </PageContainer>
  )
}

function ScheduleSummary({ schedule, recipients, onEdit }: { schedule: ReportSchedule; recipients: { id: string; name: string }[]; onEdit: () => void }) {
  const names = recipients.filter((r) => schedule.recipientIds.includes(r.id)).map((r) => r.name.split(" ")[0])
  return (
    <div className="space-y-2 rounded-xl border bg-card p-3.5 text-sm">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 font-medium">
          <Mail className="size-4 text-muted-foreground" /> Email delivery
        </span>
        <StatusBadge status={schedule.enabled ? "scheduled" : "paused"} label={schedule.enabled ? "On" : "Off"} />
      </div>
      <p className="text-xs text-muted-foreground">
        {schedule.enabled ? `${schedule.format.toUpperCase()} on day ${schedule.dayOfMonth} of each month to ${names.join(", ") || "no one"}.` : "Reports aren't emailed automatically."}
      </p>
      <Button size="sm" variant="ghost" className="-ml-2" onClick={onEdit}>
        Edit schedule
      </Button>
    </div>
  )
}

function ReportView({ month }: { month: ReportMonth }) {
  const q = useApiQuery(["business", "report", month.id, month.generatedAt], () => reportsApi.get({ id: month.id }))
  const generate = useApiMutation(reportsApi.generate, { success: (r) => `${r.label} report is ready.` })
  if (q.isLoading) return <Skeleton className="h-[720px] rounded-xl" />
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const r = q.data!
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-xs text-muted-foreground">Generated {formatDateTime(r.generatedAt)}</p>
        <Button size="sm" variant="ghost" onClick={() => generate.mutate({ month: month.id })} disabled={generate.isPending}>
          {generate.isPending ? <Loader2 className="animate-spin" /> : <Sparkles data-icon="inline-start" />} Regenerate
        </Button>
      </div>
      <ReportDocument r={r} />
    </div>
  )
}

function kpiValue(k: ReportKpi) {
  if (k.format === "percent") return formatPercent(k.value)
  if (k.format === "compact") return formatCompact(k.value)
  return formatNumber(k.value)
}

/** The printable report itself. */
function ReportDocument({ r }: { r: MonthlyReport }) {
  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-sm print:rounded-none print:border-0 print:shadow-none">
      <header className="flex flex-col gap-4 border-b bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-sky-500/10 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <LogoMark className="size-10" />
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Monthly wellness report</p>
            <h2 className="font-heading text-2xl font-bold">{r.label}</h2>
            <p className="text-sm text-muted-foreground">{r.companyName}</p>
          </div>
        </div>
        <div className="text-sm text-muted-foreground sm:text-right">
          <p>
            {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
          </p>
          {r.partial ? <Badge variant="outline">Month to date</Badge> : <p>Compared with the previous month</p>}
        </div>
      </header>

      <div className="space-y-8 p-6">
        <section className="print-avoid-break grid grid-cols-2 gap-3 md:grid-cols-4">
          {r.kpis.map((k) => (
            <div key={k.key} className="rounded-xl border p-3.5">
              <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
              <p className="mt-1.5 font-heading text-2xl font-bold tabular-nums">{kpiValue(k)}</p>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                {k.format === "percent" ? <Delta value={k.value - k.previous} /> : <Delta value={k.previous ? (k.value - k.previous) / k.previous : 0} />}
                <span>vs last month</span>
              </div>
            </div>
          ))}
        </section>

        <section className="print-avoid-break space-y-3">
          <h3 className="font-heading text-base font-semibold">Highlights</h3>
          <ul className="space-y-2">
            {r.highlights.map((h) => (
              <li key={h} className="flex items-start gap-2.5 text-sm">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" />
                {h}
              </li>
            ))}
          </ul>
        </section>

        <section className="print-avoid-break grid gap-6 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-2">
            <h3 className="font-heading text-base font-semibold">Daily active employees</h3>
            <TrendChart data={r.dailyActive} series={[{ key: "active", label: "Active employees" }]} xFormatter={(v) => formatShortDate(v)} height={220} />
          </div>
          <div className="space-y-3">
            <h3 className="font-heading text-base font-semibold">Adoption</h3>
            {[
              { label: "Invited", value: r.adoption.invited },
              { label: "On HealthX", value: r.adoption.registered },
              { label: "Active this month", value: r.adoption.active },
            ].map((s, i) => (
              <div key={s.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-semibold tabular-nums">{formatNumber(s.value)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${r.adoption.invited ? (s.value / r.adoption.invited) * 100 : 0}%`, backgroundColor: `color-mix(in oklch, var(--primary) ${55 + i * 22}%, var(--muted))` }} />
                </div>
              </div>
            ))}
            <div className="grid grid-cols-3 gap-2 pt-2 text-center">
              {[
                { label: "Workouts", value: r.wellness.workout },
                { label: "Hydration", value: r.wellness.hydration },
                { label: "Habits", value: r.wellness.habit },
              ].map((w) => (
                <div key={w.label} className="rounded-lg bg-muted/60 px-2 py-2">
                  <p className="font-heading text-base font-bold tabular-nums">{formatPercent(w.value)}</p>
                  <p className="text-[11px] text-muted-foreground">{w.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="print-avoid-break grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <h3 className="font-heading text-base font-semibold">Participation by department</h3>
            <BarsChart
              data={r.departments.filter((d) => d.participation !== null).map((d) => ({ name: d.name, participation: Math.round((d.participation ?? 0) * 100) }))}
              categoryKey="name"
              series={[{ key: "participation", label: "Participation" }]}
              layout="horizontal"
              valueFormatter={(v) => `${v}%`}
              height={Math.max(200, r.departments.length * 36)}
            />
          </div>
          <div className="space-y-2">
            <h3 className="font-heading text-base font-semibold">Departments</h3>
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Department</th>
                    <th className="px-3 py-2 text-right font-semibold">Active</th>
                    <th className="px-3 py-2 text-right font-semibold">Rate</th>
                    <th className="hidden px-3 py-2 text-right font-semibold sm:table-cell">Avg steps</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {r.departments.map((d) => (
                    <tr key={d.name}>
                      <td className="px-3 py-2 font-medium">{d.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{d.participation === null ? "—" : `${formatNumber(d.active)} / ${formatNumber(d.employees)}`}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{d.participation === null ? <span className="text-xs text-muted-foreground">Hidden (&lt; {r.minGroupSize})</span> : formatPercent(d.participation)}</td>
                      <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{d.avgSteps === null ? "—" : formatNumber(d.avgSteps)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="print-avoid-break space-y-2">
          <h3 className="font-heading text-base font-semibold">Challenges</h3>
          {r.challenges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No challenges ran this month.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {r.challenges.map((c) => (
                <div key={c.name} className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
                  <span className="text-xl">{c.coverEmoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(c.participants)} participants · {c.completionRate === null ? "completion hidden" : `${formatPercent(c.completionRate)} completed`}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              ))}
            </div>
          )}
        </section>

        <PrivacyNote minGroupSize={r.minGroupSize} />
      </div>
    </article>
  )
}

function ScheduleDialog({
  open,
  onOpenChange,
  schedule,
  recipients,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule: ReportSchedule
  recipients: { id: string; name: string; email: string; role: string }[]
}) {
  const [draft, setDraft] = useState(schedule)
  const [error, setError] = useState<string | null>(null)
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setDraft(schedule)
      setError(null)
    }
  }
  const save = useApiMutation(reportsApi.saveSchedule, {
    success: (s) => (s.enabled ? `Monthly report scheduled for day ${s.dayOfMonth}.` : "Scheduled emails turned off."),
    onSuccess: () => onOpenChange(false),
    onError: (e) => setError(e.fieldErrors?.recipientIds ?? e.message),
  })
  const toggle = (id: string) => setDraft((d) => ({ ...d, recipientIds: d.recipientIds.includes(id) ? d.recipientIds.filter((x) => x !== id) : [...d.recipientIds, id] }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule the monthly report</DialogTitle>
          <DialogDescription>We&apos;ll email last month&apos;s report to the people you choose. Recipients must be company administrators.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-xl border p-3">
            <div>
              <Label htmlFor="sched-on" className="text-sm font-medium">
                Email the report every month
              </Label>
              <p className="text-xs text-muted-foreground">Turn off to stop scheduled emails.</p>
            </div>
            <Switch id="sched-on" checked={draft.enabled} onCheckedChange={(v) => setDraft((d) => ({ ...d, enabled: v }))} />
          </div>
          <div className={cn("grid gap-4 sm:grid-cols-2", !draft.enabled && "pointer-events-none opacity-50")}>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Send on</Label>
              <Select value={String(draft.dayOfMonth)} onValueChange={(v) => setDraft((d) => ({ ...d, dayOfMonth: Number(v) }))}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Day {n} of the month
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Format</Label>
              <RadioGroup value={draft.format} onValueChange={(v) => setDraft((d) => ({ ...d, format: v as ReportSchedule["format"] }))} className="flex gap-4 pt-2">
                {(["pdf", "csv"] as const).map((f) => (
                  <Label key={f} htmlFor={`fmt-${f}`} className="flex items-center gap-2 text-sm font-normal">
                    <RadioGroupItem id={`fmt-${f}`} value={f} /> {f.toUpperCase()}
                  </Label>
                ))}
              </RadioGroup>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-sm font-medium">Recipients</Label>
              <ul className="divide-y rounded-xl border">
                {recipients.map((p) => (
                  <li key={p.id}>
                    <Label htmlFor={`rcp-${p.id}`} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 font-normal">
                      <Checkbox id={`rcp-${p.id}`} checked={draft.recipientIds.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {p.role} · {p.email}
                        </span>
                      </span>
                    </Label>
                  </li>
                ))}
              </ul>
              {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate(draft)} disabled={save.isPending}>
            {save.isPending ? <Spinner /> : <CalendarClock data-icon="inline-start" />}
            Save schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
