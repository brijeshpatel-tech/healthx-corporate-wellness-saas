"use client"

import { CheckCircle2, Clock, FilterX, Hourglass, Inbox } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { FilterSelect } from "@/components/admin/filter-select"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { DataTable, type Column } from "@/components/common/data-table"
import { SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { StatusBadge } from "@/components/common/status-badge"
import { ErrorState } from "@/components/common/states"
import { UserAvatar } from "@/components/common/user-avatar"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useApiQuery } from "@/lib/api/hooks"
import { REQUESTER_TYPE_LABEL, supportApi, TICKET_CATEGORY_LABEL, TICKET_PRIORITY_LABEL, TICKET_STATUS_LABEL, type RequesterType, type TicketQuery, type TicketRow, type TicketStatus } from "@/lib/api/platform/support"
import { formatNumber, formatRelative } from "@/lib/format"

const STATUS_TABS: (TicketStatus | "all")[] = ["all", "open", "pending", "resolved", "closed"]

/** SCR-P-030 Support — ticket list. */
export default function SupportPage() {
  const router = useRouter()
  const can = useAdminCan()
  const [status, setStatus] = useState<TicketStatus | "all">("all")
  const [search, setSearch] = useState("")
  const [priority, setPriority] = useState("all")
  const [companyId, setCompanyId] = useState("all")
  const [assigneeId, setAssigneeId] = useState("all")
  const [requesterType, setRequesterType] = useState("all")
  const [page, setPage] = useState(1)

  const lookups = useApiQuery(["admin", "support-lookups"], () => supportApi.lookups())
  const query: TicketQuery = {
    status,
    search: search || undefined,
    priority: priority === "all" ? undefined : (priority as TicketQuery["priority"]),
    companyId: companyId === "all" ? undefined : companyId,
    assigneeId: assigneeId === "all" ? undefined : assigneeId,
    requesterType: requesterType === "all" ? undefined : (requesterType as RequesterType),
    page,
    pageSize: 15,
  }
  const list = useApiQuery(["admin", "support-tickets", query], () => supportApi.list(query), { placeholderData: (prev) => prev })
  const k = list.data?.kpis

  const reset =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v)
      setPage(1)
    }
  const filtered = !!search || priority !== "all" || companyId !== "all" || assigneeId !== "all" || requesterType !== "all"
  const clear = () => {
    setSearch("")
    setPriority("all")
    setCompanyId("all")
    setAssigneeId("all")
    setRequesterType("all")
    setPage(1)
  }

  const columns: Column<TicketRow>[] = [
    {
      key: "ticket",
      header: "Ticket",
      cell: (r) => (
        <div className="min-w-0 max-w-80">
          <div className="font-mono text-xs text-muted-foreground">{r.number}</div>
          <div className="truncate text-sm font-medium">{r.subject}</div>
          <div className="truncate text-xs text-muted-foreground md:hidden">
            {r.companyName} · {REQUESTER_TYPE_LABEL[r.requesterType]}
          </div>
        </div>
      ),
    },
    {
      key: "company",
      header: "Company",
      cell: (r) => (
        <div className="min-w-0 max-w-52">
          <div className="truncate text-sm">{r.companyName}</div>
          <div className="truncate text-xs text-muted-foreground">
            {r.requester} · <span className={r.requesterType === "employee" ? "text-sky-700 dark:text-sky-400" : "text-violet-700 dark:text-violet-400"}>{REQUESTER_TYPE_LABEL[r.requesterType]}</span>
          </div>
        </div>
      ),
      hideOnMobile: true,
    },
    { key: "category", header: "Category", cell: (r) => <span className="text-sm text-muted-foreground">{TICKET_CATEGORY_LABEL[r.category]}</span>, hideOnMobile: true },
    { key: "priority", header: "Priority", cell: (r) => <StatusBadge status={r.priority} label={TICKET_PRIORITY_LABEL[r.priority]} dot={false} />, hideOnMobile: true },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} label={TICKET_STATUS_LABEL[r.status]} /> },
    {
      key: "assignee",
      header: "Assignee",
      cell: (r) =>
        r.assignee ? (
          <div className="flex items-center gap-2">
            <UserAvatar name={r.assignee.name} color={r.assignee.avatarColor} size="xs" />
            <span className="truncate text-sm">{r.assignee.name}</span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Unassigned</span>
        ),
      hideOnMobile: true,
    },
    { key: "updated", header: "Updated", cell: (r) => <span className="text-sm whitespace-nowrap text-muted-foreground">{formatRelative(r.updatedAt)}</span>, hideOnMobile: true },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Support tickets"
        description={
          can("support.manage")
            ? "Tickets raised by company admins (Business Portal) and employees (app Help centre). Reply, add internal notes, assign and resolve."
            : "Tickets raised by company admins and employees. You can view tickets; only Support and Super Admins can reply."
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open" value={k ? formatNumber(k.open) : "—"} icon={Inbox} tone="amber" loading={list.isLoading} hint={k ? `${formatNumber(k.unassigned)} unassigned` : undefined} />
        <StatCard label="Pending" value={k ? formatNumber(k.pending) : "—"} icon={Hourglass} tone="sky" loading={list.isLoading} hint="waiting on customer" />
        <StatCard label="Resolved this week" value={k ? formatNumber(k.resolvedThisWeek) : "—"} icon={CheckCircle2} tone="emerald" loading={list.isLoading} />
        <StatCard
          label="Avg first response"
          value={k?.avgFirstResponseHours != null ? `${formatNumber(k.avgFirstResponseHours, 1)} h` : "—"}
          icon={Clock}
          tone="violet"
          loading={list.isLoading}
          hint="target under 4 h"
        />
      </div>

      <Tabs value={status} onValueChange={(v) => reset(setStatus)(v as TicketStatus | "all")}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList>
            {STATUS_TABS.map((s) => (
              <TabsTrigger key={s} value={s} className="px-3">
                {s === "all" ? "All" : TICKET_STATUS_LABEL[s]}
                {list.data ? <span className="text-xs text-muted-foreground tabular-nums">{list.data.counts[s]}</span> : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={list.data?.items ?? []}
          getRowId={(r) => r.id}
          loading={list.isLoading}
          onRowClick={(r) => router.push(`/admin-portal/support/${r.id}`)}
          pagination={list.data ? { page, pageSize: list.data.pageSize, total: list.data.total, onPageChange: setPage } : undefined}
          emptyTitle={filtered ? "No tickets match these filters" : status === "open" || status === "all" ? "No open tickets." : `No ${TICKET_STATUS_LABEL[status].toLowerCase()} tickets.`}
          emptyDescription={filtered ? "Try a different search or clear the filters." : "New requests from companies will appear here."}
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
              <SearchInput value={search} onChange={reset(setSearch)} placeholder="Search ticket, subject, requester…" />
              <FilterSelect value={priority} onChange={reset(setPriority)} allLabel="All priorities" className="sm:w-36" options={(Object.keys(TICKET_PRIORITY_LABEL) as (keyof typeof TICKET_PRIORITY_LABEL)[]).map((p) => ({ value: p, label: TICKET_PRIORITY_LABEL[p] }))} />
              <FilterSelect value={companyId} onChange={reset(setCompanyId)} allLabel="All companies" className="sm:w-48" options={(lookups.data?.companies ?? []).map((c) => ({ value: c.id, label: c.name }))} />
              <FilterSelect
                value={requesterType}
                onChange={reset(setRequesterType)}
                allLabel="All requesters"
                className="sm:w-40"
                options={(Object.keys(REQUESTER_TYPE_LABEL) as RequesterType[]).map((t) => ({ value: t, label: REQUESTER_TYPE_LABEL[t] === "Employee" ? "Employees" : "Company admins" }))}
              />
              <FilterSelect
                value={assigneeId}
                onChange={reset(setAssigneeId)}
                allLabel="Any assignee"
                className="sm:w-40"
                options={[{ value: "unassigned", label: "Unassigned" }, ...(lookups.data?.staff ?? []).map((s) => ({ value: s.id, label: s.name }))]}
              />
              <span className="ml-auto text-sm text-muted-foreground">{list.data ? `${formatNumber(list.data.total)} tickets` : ""}</span>
            </>
          }
        />
      )}
    </PageContainer>
  )
}
