"use client"

import { Download, Eye, FilePen, FileOutput, ShieldCheck, Trash2 } from "lucide-react"
import { useState } from "react"
import { DataTable, type Column } from "@/components/common/data-table"
import { KeyValueList, SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { ErrorState } from "@/components/common/states"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { UserAvatar } from "@/components/common/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { auditApi, type AuditQuery, type AuditRow, type PersonalAccess } from "@/lib/api/business/audit"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { downloadText } from "@/lib/download"
import { localDaysAgo } from "@/lib/mock/series"
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format"

const ALL = "all"
const PRESETS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: ALL, label: "All time" },
  { value: "custom", label: "Custom range" },
]
const ACCESS: Record<PersonalAccess, { label: string; icon: typeof Eye; tone: "blue" | "violet" | "amber" | "red" }> = {
  viewed: { label: "Viewed", icon: Eye, tone: "blue" },
  modified: { label: "Changed", icon: FilePen, tone: "violet" },
  exported: { label: "Exported", icon: FileOutput, tone: "amber" },
  removed: { label: "Removed", icon: Trash2, tone: "red" },
}

/** SCR-B-043 — Audit logs (Phase 2) incl. #361 personal-data access log. Read-only. */
export default function AuditLogsPage() {
  const [scope, setScope] = useState<"all" | "personal_data">("all")
  const [preset, setPreset] = useState("30")
  const [from, setFrom] = useState(localDaysAgo(30))
  const [to, setTo] = useState(localDaysAgo(0))
  const [actor, setActor] = useState(ALL)
  const [entityType, setEntityType] = useState(ALL)
  const [severity, setSeverity] = useState(ALL)
  const [access, setAccess] = useState(ALL)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<AuditRow | null>(null)

  const range = preset === ALL ? {} : preset === "custom" ? { from, to } : { from: localDaysAgo(Number(preset)), to: localDaysAgo(0) }
  const query: AuditQuery = {
    ...range,
    scope,
    actor: actor === ALL ? undefined : actor,
    entityType: entityType === ALL || scope === "personal_data" ? undefined : entityType,
    severity: severity === ALL || scope === "personal_data" ? undefined : (severity as AuditQuery["severity"]),
    access: access === ALL || scope !== "personal_data" ? undefined : (access as PersonalAccess),
    search: search || undefined,
    page,
    pageSize: 20,
  }
  const q = useApiQuery(["business", "audit", query], () => auditApi.list(query), { placeholderData: (p) => p })
  const exportCsv = useApiMutation(auditApi.exportCsv, { success: (r) => `${formatNumber(r.count)} entries exported.`, onSuccess: (r) => downloadText(r.fileName, r.csv) })
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setPage(1)
  }

  const columns: Column<AuditRow>[] = [
    { key: "when", header: "Date & time", cell: (l) => <span className="text-sm whitespace-nowrap">{formatDateTime(l.createdAt)}</span> },
    {
      key: "user",
      header: "User",
      cell: (l) => (
        <div className="flex min-w-0 items-center gap-2">
          <UserAvatar name={l.actorName} size="xs" color="#64748b" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{l.actorName}</div>
            <div className="truncate text-xs text-muted-foreground">{l.actorRole}</div>
          </div>
        </div>
      ),
      hideOnMobile: true,
    },
    {
      key: "action",
      header: "Action",
      cell: (l) => (
        <div className="min-w-0">
          <div className="text-sm">{l.action}</div>
          <div className="truncate text-xs text-muted-foreground">
            {l.entityType} · {l.entityName}
          </div>
        </div>
      ),
      className: "max-w-[28rem]",
    },
    ...(scope === "personal_data"
      ? [
          {
            key: "access",
            header: "Access",
            cell: (l: AuditRow) => (l.access ? <StatusBadge status={l.access} label={ACCESS[l.access].label} tone={ACCESS[l.access].tone} /> : null),
          } satisfies Column<AuditRow>,
        ]
      : [{ key: "severity", header: "Level", cell: (l: AuditRow) => <StatusBadge status={l.severity} />, hideOnMobile: true } satisfies Column<AuditRow>]),
    { key: "ip", header: "IP address", cell: (l) => <span className="font-mono text-xs text-muted-foreground">{l.ip}</span>, hideOnMobile: true },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Audit logs"
        badge={<PhaseBadge phase={2} />}
        description="A read-only record of what administrators did in your company, including every time personal data was viewed, changed, exported or removed."
        actions={
          <Button variant="outline" onClick={() => exportCsv.mutate({ ...query, page: undefined, pageSize: undefined })} disabled={exportCsv.isPending}>
            <Download data-icon="inline-start" /> Export CSV
          </Button>
        }
      />

      <Tabs
        value={scope}
        onValueChange={(v) => {
          setScope(v as typeof scope)
          setPage(1)
        }}
      >
        <TabsList>
          <TabsTrigger value="all" className="px-3">
            All activity
          </TabsTrigger>
          <TabsTrigger value="personal_data" className="px-3">
            <ShieldCheck /> Personal data access
            {q.data ? <span className="ml-1 text-xs text-muted-foreground tabular-nums">{q.data.personalCount}</span> : null}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={q.data?.items ?? []}
          getRowId={(l) => l.id}
          loading={q.isLoading}
          onRowClick={setOpen}
          pagination={q.data ? { page, pageSize: q.data.pageSize, total: q.data.total, onPageChange: setPage } : undefined}
          className={q.isFetching && !q.isLoading ? "opacity-80 transition-opacity" : "transition-opacity"}
          emptyTitle="No activity in this period."
          emptyDescription="Try a longer date range or clear the filters."
          toolbar={
            <>
              <SearchInput value={search} onChange={reset(setSearch)} placeholder="Search action, target or IP…" className="sm:w-60" />
              <Select value={preset} onValueChange={reset(setPreset)}>
                <SelectTrigger className="h-9 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {preset === "custom" ? (
                <div className="flex items-center gap-1.5">
                  <Input type="date" value={from} max={to} onChange={(e) => reset(setFrom)(e.target.value)} className="h-9 w-36" aria-label="From" />
                  <span className="text-muted-foreground">–</span>
                  <Input type="date" value={to} min={from} onChange={(e) => reset(setTo)(e.target.value)} className="h-9 w-36" aria-label="To" />
                </div>
              ) : null}
              <Select value={actor} onValueChange={reset(setActor)}>
                <SelectTrigger className="h-9 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All users</SelectItem>
                  {q.data?.actors.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {scope === "personal_data" ? (
                <Select value={access} onValueChange={reset(setAccess)}>
                  <SelectTrigger className="h-9 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Any access type</SelectItem>
                    {(Object.keys(ACCESS) as PersonalAccess[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {ACCESS[k].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <Select value={entityType} onValueChange={reset(setEntityType)}>
                    <SelectTrigger className="h-9 w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All targets</SelectItem>
                      {q.data?.entityTypes.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={severity} onValueChange={reset(setSeverity)}>
                    <SelectTrigger className="h-9 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Any level</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
              <span className="ml-auto text-sm text-muted-foreground">{q.data ? `${formatNumber(q.data.total)} entries` : ""}</span>
            </>
          }
        />
      )}

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {open ? (
            <>
              <SheetHeader className="border-b pr-12">
                <SheetTitle>{open.action}</SheetTitle>
                <SheetDescription>{formatDateTime(open.createdAt)} · {formatRelative(open.createdAt)}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 p-4">
                {open.personalData ? (
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck /> Personal data · {open.access ? ACCESS[open.access].label : ""}
                  </Badge>
                ) : null}
                <KeyValueList
                  columns={1}
                  items={[
                    { label: "User", value: `${open.actorName} (${open.actorRole})` },
                    { label: "Target", value: `${open.entityType} · ${open.entityName}` },
                    { label: "Level", value: <StatusBadge status={open.severity} /> },
                    { label: "IP address", value: <span className="font-mono">{open.ip}</span> },
                    { label: "Entry ID", value: <span className="font-mono text-xs">{open.id}</span> },
                  ]}
                />
                <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">Audit entries are read-only — they can&apos;t be edited or deleted.</p>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </PageContainer>
  )
}
