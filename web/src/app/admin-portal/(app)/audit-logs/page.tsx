"use client"

import { Download, FilterX, Fingerprint, Lock } from "lucide-react"
import { useState } from "react"
import { FilterSelect } from "@/components/admin/filter-select"
import { AuditLogSheet } from "@/components/admin/platform/audit-log-sheet"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { DataTable, type Column } from "@/components/common/data-table"
import { SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { ErrorState } from "@/components/common/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Toggle } from "@/components/ui/toggle"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { AUDIT_RANGE_LABEL, auditApi, type AuditQuery, type AuditRange, type AuditRow } from "@/lib/api/platform/audit"
import { downloadText } from "@/lib/download"
import { formatDate, formatNumber, formatTime } from "@/lib/format"

const SEVERITIES = [
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "critical", label: "Critical" },
]

/** SCR-P-025 Audit logs (read-only). */
export default function AuditLogsPage() {
  const can = useAdminCan()
  const [search, setSearch] = useState("")
  const [org, setOrg] = useState("all")
  const [actor, setActor] = useState("all")
  const [action, setAction] = useState("all")
  const [severity, setSeverity] = useState("all")
  const [personalOnly, setPersonalOnly] = useState(false)
  const [range, setRange] = useState<AuditRange>("30d")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<AuditRow | null>(null)

  const facets = useApiQuery(["admin", "audit-facets"], () => auditApi.facets())
  const customInvalid = range === "custom" && !!from && !!to && from > to
  const query: AuditQuery = {
    search: search || undefined,
    org: org === "all" ? undefined : org,
    actor: actor === "all" ? undefined : actor,
    action: action === "all" ? undefined : action,
    severity: severity === "all" ? undefined : (severity as AuditQuery["severity"]),
    category: personalOnly ? "personal_data" : undefined,
    range,
    from: range === "custom" && from ? from : undefined,
    to: range === "custom" && to ? to : undefined,
    page,
    pageSize: 20,
  }
  const list = useApiQuery(["admin", "audit-logs", query], () => auditApi.list(query), { placeholderData: (prev) => prev, enabled: !customInvalid })
  const exportCsv = useApiMutation(auditApi.exportCsv, {
    success: (r) => `Exported ${formatNumber(r.count)} entries`,
    onSuccess: (r) => downloadText(r.fileName, r.csv),
  })

  const reset =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v)
      setPage(1)
    }
  const filtered = !!search || org !== "all" || actor !== "all" || action !== "all" || severity !== "all" || personalOnly || range !== "30d"
  const clear = () => {
    setSearch("")
    setOrg("all")
    setActor("all")
    setAction("all")
    setSeverity("all")
    setPersonalOnly(false)
    setRange("30d")
    setFrom("")
    setTo("")
    setPage(1)
  }

  const columns: Column<AuditRow>[] = [
    {
      key: "date",
      header: "Date / time",
      cell: (r) => (
        <div className="text-sm whitespace-nowrap">
          <div>{formatDate(r.createdAt)}</div>
          <div className="text-xs text-muted-foreground">{formatTime(r.createdAt)}</div>
        </div>
      ),
    },
    {
      key: "company",
      header: "Company",
      cell: (r) => (r.companyId ? <span className="block max-w-44 truncate text-sm">{r.companyName}</span> : <Badge variant="secondary">Platform</Badge>),
      hideOnMobile: true,
    },
    {
      key: "actor",
      header: "Actor",
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{r.actorName}</div>
          <div className="truncate text-xs text-muted-foreground">{r.actorRole}</div>
        </div>
      ),
      hideOnMobile: true,
    },
    {
      key: "action",
      header: "Action",
      cell: (r) => (
        <div className="min-w-0 max-w-64">
          <div className="text-sm font-medium break-words">{r.action}</div>
          {r.personalData ? (
            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 dark:text-violet-300">
              <Fingerprint className="size-3" /> Personal data
            </span>
          ) : null}
          <div className="truncate text-xs text-muted-foreground md:hidden">
            {r.actorName} · {r.companyId ? r.companyName : "Platform"}
          </div>
        </div>
      ),
    },
    {
      key: "target",
      header: "Target",
      cell: (r) => (
        <div className="min-w-0 max-w-56">
          <div className="text-xs text-muted-foreground">{r.entityType}</div>
          <div className="truncate text-sm">{r.entityName}</div>
        </div>
      ),
      hideOnMobile: true,
    },
    { key: "severity", header: "Severity", cell: (r) => <StatusBadge status={r.severity} /> },
    { key: "ip", header: "IP", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.ip}</span>, hideOnMobile: true },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Audit logs"
        description="Every sign-in, configuration change and admin action across the platform and all companies, including consent changes."
        actions={
          can("audit.export") ? (
            <Button variant="outline" onClick={() => exportCsv.mutate({ ...query, page: undefined, pageSize: undefined })} disabled={exportCsv.isPending || customInvalid || list.data?.total === 0}>
              {exportCsv.isPending ? <Spinner /> : <Download data-icon="inline-start" />}
              Export CSV
            </Button>
          ) : null
        }
      />

      <div className="flex items-start gap-2.5 rounded-xl border bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" />
        <p>Logs are immutable and read-only. Personal-data access (who viewed, changed, deleted or exported personal data) is tagged, and exports are themselves recorded as personal-data access.</p>
      </div>

      {list.error && !customInvalid ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={customInvalid ? [] : (list.data?.items ?? [])}
          getRowId={(r) => r.id}
          loading={list.isLoading && !customInvalid}
          onRowClick={setSelected}
          pagination={list.data && !customInvalid ? { page, pageSize: list.data.pageSize, total: list.data.total, onPageChange: setPage } : undefined}
          emptyTitle={customInvalid ? "Check the date range" : "No entries for these filters."}
          emptyDescription={customInvalid ? "The start date must be before the end date." : "Try a wider date range or clear the filters."}
          emptyAction={
            filtered ? (
              <Button variant="outline" onClick={clear}>
                <FilterX data-icon="inline-start" /> Clear filters
              </Button>
            ) : undefined
          }
          className={list.isFetching && !list.isLoading ? "opacity-80 transition-opacity" : "transition-opacity"}
          toolbar={
            <>
              <SearchInput value={search} onChange={reset(setSearch)} placeholder="Search action, actor, target or IP…" />
              <FilterSelect
                value={org}
                onChange={reset(setOrg)}
                allLabel="All companies"
                className="sm:w-48"
                options={[{ value: "platform", label: "Platform only" }, ...(facets.data?.companies ?? []).map((c) => ({ value: c.id, label: c.name }))]}
              />
              <FilterSelect value={actor} onChange={reset(setActor)} allLabel="All actors" className="sm:w-44" options={(facets.data?.actors ?? []).map((a) => ({ value: a.name, label: a.name }))} />
              <FilterSelect value={action} onChange={reset(setAction)} allLabel="All actions" className="sm:w-52" options={(facets.data?.actions ?? []).map((a) => ({ value: a, label: a }))} />
              <FilterSelect value={severity} onChange={reset(setSeverity)} allLabel="All severities" className="sm:w-36" options={SEVERITIES} />
              <Toggle
                variant="outline"
                pressed={personalOnly}
                onPressedChange={reset(setPersonalOnly)}
                aria-label="Show personal-data access only"
                className="h-9 gap-1.5 px-2.5 data-[state=on]:border-violet-500/40 data-[state=on]:bg-violet-500/10 data-[state=on]:text-violet-800 dark:data-[state=on]:text-violet-200"
              >
                <Fingerprint /> Personal data access <PhaseBadge phase={2} />
              </Toggle>
              <FilterSelect
                value={range}
                onChange={reset((v: string) => setRange(v as AuditRange))}
                className="sm:w-40"
                aria-label="Date range"
                options={(Object.keys(AUDIT_RANGE_LABEL) as AuditRange[]).map((r) => ({ value: r, label: AUDIT_RANGE_LABEL[r] }))}
              />
              {range === "custom" ? (
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <Input type="date" aria-label="From date" value={from} max={to || undefined} onChange={(e) => reset(setFrom)(e.target.value)} className="h-9 w-full min-w-0 flex-1 sm:w-40" aria-invalid={customInvalid} />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input type="date" aria-label="To date" value={to} min={from || undefined} onChange={(e) => reset(setTo)(e.target.value)} className="h-9 w-full min-w-0 flex-1 sm:w-40" aria-invalid={customInvalid} />
                </div>
              ) : null}
              {filtered ? (
                <Button variant="ghost" size="sm" onClick={clear}>
                  <FilterX data-icon="inline-start" /> Clear
                </Button>
              ) : null}
              <span className="ml-auto text-sm text-muted-foreground">{list.data && !customInvalid ? `${formatNumber(list.data.total)} entries` : ""}</span>
            </>
          }
        />
      )}

      <AuditLogSheet entry={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </PageContainer>
  )
}
