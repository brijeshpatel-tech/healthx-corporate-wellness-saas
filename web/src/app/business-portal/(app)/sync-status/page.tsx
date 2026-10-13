"use client"

import { BellRing, CalendarClock, CheckCircle2, CloudOff, History, RefreshCw, Send, ShieldAlert, SmartphoneNfc, X } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { DataTable, type Column } from "@/components/common/data-table"
import { PrivacyNote, SearchInput, SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { ErrorState } from "@/components/common/states"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { PersonCell } from "@/components/common/user-avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { organizationApi } from "@/lib/api/business/organization"
import { syncApi, type ResyncJob, type SyncIssue, type SyncRow } from "@/lib/api/business/sync"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { localDaysAgo } from "@/lib/mock/series"
import { formatDate, formatDateTime, formatNumber, formatRelative, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

const TABS: { key: SyncIssue | "all"; label: string }[] = [
  { key: "all", label: "All issues" },
  { key: "not_connected", label: "Not connected" },
  { key: "no_sync_3", label: "No sync 3+ days" },
  { key: "no_sync_7", label: "No sync 7+ days" },
  { key: "consent_missing", label: "Consent missing" },
]
const ALL = "all"

/** #363 — Tracker & sync issues (+ #368 bulk resync, Phase 2). Connectivity only — never health data. */
export default function SyncStatusPage() {
  const [issue, setIssue] = useState<SyncIssue | "all">("all")
  const [departmentId, setDepartmentId] = useState(ALL)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [remindOpen, setRemindOpen] = useState<string[] | null>(null)
  const [resyncOpen, setResyncOpen] = useState(false)

  const lookups = useApiQuery(["business", "lookups"], () => organizationApi.lookups())
  const query = { issue, departmentId: departmentId === ALL ? undefined : departmentId, search: search || undefined }
  const q = useApiQuery(["business", "sync-status", query], () => syncApi.overview(query), { placeholderData: (p) => p })
  const counts = q.data?.counts

  const columns: Column<SyncRow>[] = [
    {
      key: "name",
      header: "Employee",
      sortValue: (r) => r.name,
      cell: (r) => (
        <Link href={`/business-portal/employees/${r.id}`} className="block min-w-0 hover:underline" onClick={(e) => e.stopPropagation()}>
          <PersonCell name={r.name} subtitle={r.email} color={r.avatarColor} />
        </Link>
      ),
      className: "max-w-72",
    },
    {
      key: "dept",
      header: "Department / team",
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate text-sm">{r.departmentName}</div>
          <div className="truncate text-xs text-muted-foreground">{r.teamName}</div>
        </div>
      ),
      hideOnMobile: true,
    },
    {
      key: "app",
      header: "Health app",
      sortValue: (r) => r.sync.healthApp,
      cell: (r) => (
        <StatusBadge
          status={r.sync.healthApp === "connected" ? "connected" : r.sync.healthApp === "reconnect" ? "error" : "disconnected"}
          label={r.sync.healthApp === "connected" ? r.sync.provider ?? "Connected" : r.sync.healthApp === "reconnect" ? "Reconnect needed" : "Not connected"}
        />
      ),
    },
    {
      key: "sync",
      header: "Last sync",
      sortValue: (r) => r.sync.daysSinceSync ?? 9999,
      cell: (r) => (
        <span className={cn("text-sm", (r.sync.daysSinceSync ?? 0) >= 7 ? "font-medium text-rose-700 dark:text-rose-400" : (r.sync.daysSinceSync ?? 0) >= 3 ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
          {r.sync.lastSyncAt ? formatRelative(r.sync.lastSyncAt) : "Never"}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "consent",
      header: "Consent",
      cell: (r) => (r.sync.consent === "missing" ? <StatusBadge status="warning" label="Missing" /> : <span className="text-sm text-emerald-700 dark:text-emerald-400">Given</span>),
      hideOnMobile: true,
    },
    {
      key: "contact",
      header: "Follow-up",
      sortValue: (r) => r.reminder?.lastAt ?? "",
      cell: (r) =>
        r.reminder ? (
          <div className="text-xs">
            <div className="font-medium">Reminded {r.reminder.count}×</div>
            <div className="text-muted-foreground">{formatRelative(r.reminder.lastAt)}</div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Not contacted</span>
        ),
      hideOnMobile: true,
    },
    {
      key: "action",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (r) => (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation()
            setRemindOpen([r.id])
          }}
        >
          <Send data-icon="inline-start" /> Remind
        </Button>
      ),
    },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Tracker & sync issues"
        description="Find employees whose steps may be missing because their health app isn't connected, hasn't synced, or consent is off — and nudge them."
        actions={
          <Button variant="outline" onClick={() => setResyncOpen(true)}>
            <History data-icon="inline-start" /> Resync a group <PhaseBadge phase={2} className="ml-1" />
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            { key: "not_connected", label: "Not connected", icon: CloudOff, tone: "slate", hint: "no health app, or needs reconnecting" },
            { key: "no_sync_3", label: "No sync for 3+ days", icon: CalendarClock, tone: "amber", hint: "may be missing recent steps" },
            { key: "no_sync_7", label: "No sync for 7+ days", icon: RefreshCw, tone: "rose", hint: "likely needs help" },
            { key: "consent_missing", label: "Consent missing", icon: ShieldAlert, tone: "violet", hint: "health-data consent is off" },
          ] as const
        ).map((c) => (
          <div
            key={c.key}
            role="button"
            tabIndex={0}
            aria-pressed={issue === c.key}
            onClick={() => setIssue(c.key)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setIssue(c.key)}
            className={cn("cursor-pointer rounded-xl transition-shadow focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none", issue === c.key && "ring-2 ring-primary/40")}
          >
            <StatCard label={c.label} value={counts ? formatNumber(counts[c.key]) : "—"} icon={c.icon} tone={c.tone} hint={c.hint} loading={q.isLoading} className="h-full" />
          </div>
        ))}
      </div>

      {counts ? (
        <p className="-mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-emerald-600" /> {formatNumber(counts.connected)} of {formatNumber(counts.total)} joined employees have a connected health app.
        </p>
      ) : null}

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Tabs
          value={issue}
          onValueChange={(v) => {
            setIssue(v as SyncIssue | "all")
            setSelected([])
          }}
        >
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="flex-none px-3">
                {t.label}
                {counts && t.key !== "all" ? <span className="ml-1 text-xs text-muted-foreground tabular-nums">{counts[t.key]}</span> : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {selected.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <span className="font-semibold">{selected.length} selected</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" onClick={() => setRemindOpen(selected)}>
              <BellRing data-icon="inline-start" /> Send reminder
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              <X data-icon="inline-start" /> Clear
            </Button>
          </div>
        </div>
      ) : null}

      {q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={q.data?.rows ?? []}
          getRowId={(r) => r.id}
          loading={q.isLoading}
          selectable
          selectedIds={selected}
          onSelectedIdsChange={setSelected}
          clientPageSize={15}
          className={q.isFetching && !q.isLoading ? "opacity-80 transition-opacity" : "transition-opacity"}
          emptyTitle={search || departmentId !== ALL ? "No one matches these filters" : "No tracker issues 🎉"}
          emptyDescription={search || departmentId !== ALL ? "Try another department or search." : "Everyone in this view has a connected, recently synced health app."}
          toolbar={
            <>
              <SearchInput value={search} onChange={setSearch} placeholder="Search name or email…" />
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger className="h-9 w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All departments</SelectItem>
                  {lookups.data?.departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="ml-auto text-sm text-muted-foreground">{q.data ? pluralize(q.data.rows.length, "person", "people") : ""}</span>
            </>
          }
        />
      )}

      <ResyncJobs onStart={() => setResyncOpen(true)} />

      <PrivacyNote>This page shows device connection, sync times and consent status only. Steps, sleep and other health data are never visible to company administrators.</PrivacyNote>

      <RemindDialog ids={remindOpen} onClose={() => setRemindOpen(null)} onSent={() => setSelected([])} />
      <ResyncDialog open={resyncOpen} onOpenChange={setResyncOpen} />
    </PageContainer>
  )
}

function RemindDialog({ ids, onClose, onSent }: { ids: string[] | null; onClose: () => void; onSent: () => void }) {
  const [message, setMessage] = useState("")
  const remind = useApiMutation(syncApi.remind, {
    success: (r) => `Reminder sent to ${pluralize(r.sent, "employee")}.`,
    onSuccess: () => {
      setMessage("")
      onSent()
      onClose()
    },
  })
  return (
    <Dialog open={!!ids} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send a reminder</DialogTitle>
          <DialogDescription>
            {ids?.length === 1 ? "They'll" : `${pluralize(ids?.length ?? 0, "person", "people")} will`} get an in-app notification (and a push, if they allow it) with steps to connect or sync their health app.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="remind-msg" className="text-sm font-medium">
            Personal note <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea id="remind-msg" rows={3} maxLength={200} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Leave blank to use the standard message for each person's issue." />
          <p className="text-right text-xs text-muted-foreground tabular-nums">{message.length}/200</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => ids && remind.mutate({ ids, message: message || undefined })} disabled={remind.isPending}>
            {remind.isPending ? <Spinner /> : <Send data-icon="inline-start" />}
            Send reminder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResyncJobs({ onStart }: { onStart: () => void }) {
  const q = useApiQuery(["business", "resync-jobs"], () => syncApi.resyncJobs(), {
    refetchInterval: (query) => (query.state.data?.some((j) => j.status === "running") ? 1000 : false),
  })
  const jobs = q.data ?? []
  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          Bulk resync & historical data recovery <PhaseBadge phase={2} />
        </span>
      }
      description="Ask every connected device in a group to resend activity for a date range — including eligible challenge data."
      actions={
        <Button size="sm" variant="outline" onClick={onStart}>
          <SmartphoneNfc data-icon="inline-start" /> New resync
        </Button>
      }
    >
      {jobs.length === 0 ? (
        <p className="rounded-xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">No resyncs yet.</p>
      ) : (
        <ul className="space-y-3">
          {jobs.map((j) => (
            <JobRow key={j.id} job={j} />
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

function JobRow({ job: j }: { job: ResyncJob }) {
  return (
    <li className="space-y-2 rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {j.scopeLabel} · {formatDate(j.from, "d MMM")} – {formatDate(j.to, "d MMM")}
          </p>
          <p className="text-xs text-muted-foreground">
            {pluralize(j.employees, "device")} · started {formatDateTime(j.startedAt)} by {j.startedBy}
            {j.includeChallenges ? " · incl. challenge data" : ""}
          </p>
        </div>
        <StatusBadge status={j.status === "running" ? "processing" : "completed"} label={j.status === "running" ? `Running ${Math.round(j.progress * 100)}%` : "Completed"} />
      </div>
      {j.status === "running" ? <Progress value={j.progress * 100} className="h-1.5" /> : null}
      {j.result ? (
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Result label="Devices resynced" value={j.result.resynced} />
          <Result label="Days recovered" value={j.result.daysRecovered} />
          <Result label="Challenge entries updated" value={j.result.challengeEntriesUpdated} />
          <Result label="Couldn't reach" value={j.result.failedDevices} warn={j.result.failedDevices > 0} />
        </div>
      ) : null}
    </li>
  )
}

function Result({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2.5 py-2">
      <p className={cn("font-heading text-base font-bold tabular-nums", warn && "text-amber-700 dark:text-amber-400")}>{formatNumber(value)}</p>
      <p className="text-muted-foreground">{label}</p>
    </div>
  )
}

function ResyncDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const lookups = useApiQuery(["business", "lookups"], () => organizationApi.lookups(), { enabled: open })
  const [departmentId, setDepartmentId] = useState(ALL)
  const [teamId, setTeamId] = useState(ALL)
  const [from, setFrom] = useState(localDaysAgo(14))
  const [to, setTo] = useState(localDaysAgo(0))
  const [includeChallenges, setIncludeChallenges] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const teams = useMemo(() => (lookups.data?.teams ?? []).filter((t) => t.departmentId === departmentId), [lookups.data, departmentId])
  const start = useApiMutation(syncApi.startResync, {
    success: (j) => `Resync started for ${pluralize(j.employees, "device")}.`,
    onSuccess: () => {
      setErrors({})
      onOpenChange(false)
    },
    onError: (e) => setErrors(e.fieldErrors ?? {}),
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            Resync a group <PhaseBadge phase={2} />
          </DialogTitle>
          <DialogDescription>Recover missing activity for everyone with a connected health app. Health apps keep up to 90 days of history.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Department</Label>
            <Select
              value={departmentId}
              onValueChange={(v) => {
                setDepartmentId(v)
                setTeamId(ALL)
              }}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Whole company</SelectItem>
                {lookups.data?.departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Team</Label>
            <Select value={teamId} onValueChange={setTeamId} disabled={departmentId === ALL}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All teams</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs-from" className="text-sm font-medium">
              From
            </Label>
            <Input id="rs-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9" aria-invalid={!!errors.from} />
            {errors.from ? <p className="text-xs font-medium text-destructive">{errors.from}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs-to" className="text-sm font-medium">
              To
            </Label>
            <Input id="rs-to" type="date" value={to} min={from} max={localDaysAgo(0)} onChange={(e) => setTo(e.target.value)} className="h-9" aria-invalid={!!errors.to} />
            {errors.to ? <p className="text-xs font-medium text-destructive">{errors.to}</p> : null}
          </div>
          <Label htmlFor="rs-chl" className="flex items-start gap-2.5 text-sm font-normal sm:col-span-2">
            <Checkbox id="rs-chl" checked={includeChallenges} onCheckedChange={(v) => setIncludeChallenges(v === true)} className="mt-0.5" />
            <span>
              <span className="block font-medium">Recalculate eligible challenge progress</span>
              <span className="block text-xs text-muted-foreground">Only for challenges that were running during these dates.</span>
            </span>
          </Label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => start.mutate({ departmentId: departmentId === ALL ? undefined : departmentId, teamId: teamId === ALL ? undefined : teamId, from, to, includeChallenges })}
            disabled={start.isPending}
          >
            {start.isPending ? <Spinner /> : <RefreshCw data-icon="inline-start" />}
            Start resync
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
