"use client"

import { Download, FileUp, MoreHorizontal, RotateCcw, Send, UserMinus, UserPlus, Users, X } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { InviteEmployeeDialog } from "@/components/business/invite-employee-dialog"
import { DataTable, type Column } from "@/components/common/data-table"
import { ConfirmDialog, SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { ErrorState } from "@/components/common/states"
import { PersonCell } from "@/components/common/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { employeesApi, type EmployeeQuery, type EmployeeRow } from "@/lib/api/business/employees"
import { organizationApi } from "@/lib/api/business/organization"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { downloadText } from "@/lib/download"
import { formatDate, formatNumber, formatRelative } from "@/lib/format"
import { BUSINESS_ROLE_LABEL } from "@/lib/types"
import { cn } from "@/lib/utils"

const STATUSES = ["all", "active", "registered", "invited", "inactive", "deactivated"] as const

function EmployeesPage() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [search, setSearch] = useState("")
  const [departmentId, setDepartmentId] = useState("all")
  const [teamId, setTeamId] = useState("all")
  const [status, setStatus] = useState<EmployeeQuery["status"]>((params.get("status") as EmployeeQuery["status"]) ?? "all")
  const [role, setRole] = useState<EmployeeQuery["role"]>("all")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [confirm, setConfirm] = useState<{ kind: "deactivate" | "revoke"; row: EmployeeRow } | null>(null)
  const inviteOpen = params.get("invite") === "1"
  const setInviteOpen = (open: boolean) => router.replace(open ? `${pathname}?invite=1` : pathname, { scroll: false })

  const lookups = useApiQuery(["business", "lookups"], () => organizationApi.lookups())
  const query: EmployeeQuery = {
    search: search || undefined,
    departmentId: departmentId === "all" ? undefined : departmentId,
    teamId: teamId === "all" ? undefined : teamId,
    status,
    role,
    page,
    pageSize: 15,
  }
  const list = useApiQuery(["business", "employees", query], () => employeesApi.list(query), { placeholderData: (prev) => prev })

  const resend = useApiMutation(employeesApi.resendInvite, { success: "Invitation resent" })
  const revoke = useApiMutation(employeesApi.revokeInvite, { success: "Invitation revoked" })
  const deactivate = useApiMutation(employeesApi.deactivate, { success: (e) => `${e.firstName} ${e.lastName} was deactivated` })
  const reactivate = useApiMutation(employeesApi.reactivate, { success: (e) => `${e.firstName} ${e.lastName} was reactivated` })
  const bulk = useApiMutation(employeesApi.bulk, { success: (r) => `${r.updated} employees updated`, onSuccess: () => setSelected([]) })
  const exportCsv = useApiMutation(employeesApi.exportCsv, { success: "Export ready", invalidate: false, onSuccess: (r) => downloadText(r.fileName, r.csv) })

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setPage(1)
  }
  const teams = (lookups.data?.teams ?? []).filter((t) => departmentId === "all" || t.departmentId === departmentId)

  const columns: Column<EmployeeRow>[] = [
    {
      key: "name",
      header: "Employee",
      cell: (r) => <PersonCell name={`${r.firstName} ${r.lastName}`} subtitle={r.email} color={r.avatarColor} />,
      className: "max-w-48 sm:max-w-72",
    },
    { key: "code", header: "ID", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.employeeCode}</span>, className: "hidden 2xl:table-cell", headerClassName: "hidden 2xl:table-cell" },
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
      key: "role",
      header: "Role",
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.adminRole ? <Badge variant="secondary">{BUSINESS_ROLE_LABEL[r.adminRole]}</Badge> : null}
          {r.appRole === "team_manager" ? <Badge variant="outline">Team Manager</Badge> : null}
          {!r.adminRole && r.appRole === "employee" ? <span className="text-sm text-muted-foreground">Employee</span> : null}
        </div>
      ),
      hideOnMobile: true,
    },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "health",
      header: "Health app",
      cell: (r) =>
        r.status === "invited" ? (
          <span className="text-xs text-muted-foreground">After joining</span>
        ) : (
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm">
              <span className={cn("size-1.5 shrink-0 rounded-full", r.sync.healthApp === "connected" ? "bg-emerald-500" : r.sync.healthApp === "reconnect" ? "bg-rose-500" : "bg-slate-400")} />
              {r.sync.healthApp === "connected" ? r.sync.provider ?? "Connected" : r.sync.healthApp === "reconnect" ? "Reconnect needed" : "Not connected"}
            </div>
            <div className={cn("text-xs text-muted-foreground", (r.sync.daysSinceSync ?? 0) >= 3 && "font-medium text-amber-700 dark:text-amber-400")}>{r.sync.lastSyncAt ? `Synced ${formatRelative(r.sync.lastSyncAt)}` : "Never synced"}</div>
          </div>
        ),
      hideOnMobile: true,
    },
    {
      key: "consent",
      header: "Consent",
      cell: (r) =>
        r.sync.consent === "given" ? (
          <span className="text-sm text-emerald-700 dark:text-emerald-400">Given</span>
        ) : r.sync.consent === "missing" ? (
          <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Missing</span>
        ) : (
          <span className="text-xs text-muted-foreground">Pending</span>
        ),
      hideOnMobile: true,
    },
    {
      key: "joined",
      header: "Joined",
      cell: (r) => (
        <div className="text-sm">
          {r.joinedAt ? formatDate(r.joinedAt) : <span className="text-muted-foreground">Invited {formatDate(r.invitedAt, "d MMM")}</span>}
        </div>
      ),
      className: "hidden 2xl:table-cell",
      headerClassName: "hidden 2xl:table-cell",
    },
    { key: "active", header: "Last active", cell: (r) => <span className="text-sm text-muted-foreground">{r.lastActiveAt ? formatRelative(r.lastActiveAt) : "—"}</span>, hideOnMobile: true },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.firstName}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild>
                <Link href={`/business-portal/employees/${r.id}`}>View details</Link>
              </DropdownMenuItem>
              {r.invitation && r.status === "invited" ? (
                <>
                  <DropdownMenuItem onClick={() => resend.mutate({ id: r.invitation!.id })}>
                    <Send /> Resend invitation
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConfirm({ kind: "revoke", row: r })}>
                    <X /> Revoke invitation
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuSeparator />
              {r.status === "deactivated" ? (
                <DropdownMenuItem onClick={() => reactivate.mutate({ id: r.id })}>
                  <RotateCcw /> Reactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem variant="destructive" disabled={r.adminRole === "company_owner"} onClick={() => setConfirm({ kind: "deactivate", row: r })}>
                  <UserMinus /> Deactivate
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Employees"
        description="Invite and manage people in your company. Company admins never see individual health data."
        actions={
          <>
            <Button variant="outline" onClick={() => exportCsv.mutate(query)} disabled={exportCsv.isPending}>
              <Download data-icon="inline-start" /> Export CSV
            </Button>
            <Button asChild variant="outline">
              <Link href="/business-portal/employees/import">
                <FileUp data-icon="inline-start" /> Import CSV
              </Link>
            </Button>
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus data-icon="inline-start" /> Invite employee
            </Button>
          </>
        }
      />

      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <span className="font-semibold">{selected.length} selected</span>
          <PhaseBadge phase={2} />
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => bulk.mutate({ ids: selected, action: "resend_invite" })}>
              <Send data-icon="inline-start" /> Resend invites
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Users data-icon="inline-start" /> Move to team
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-72 overflow-y-auto">
                {lookups.data?.departments.map((d) => (
                  <DropdownMenuSub key={d.id}>
                    <DropdownMenuSubTrigger>{d.name}</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {lookups.data?.teams
                        .filter((t) => t.departmentId === d.id)
                        .map((t) => (
                          <DropdownMenuItem key={t.id} onClick={() => bulk.mutate({ ids: selected, action: "move", teamId: t.id })}>
                            {t.name}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="destructive" onClick={() => bulk.mutate({ ids: selected, action: "deactivate" })}>
              <UserMinus data-icon="inline-start" /> Deactivate
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      {list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={list.data?.items ?? []}
          getRowId={(r) => r.id}
          loading={list.isLoading}
          onRowClick={(r) => router.push(`/business-portal/employees/${r.id}`)}
          selectable
          selectedIds={selected}
          onSelectedIdsChange={setSelected}
          pagination={list.data ? { page, pageSize: list.data.pageSize, total: list.data.total, onPageChange: setPage } : undefined}
          emptyTitle={search || status !== "all" || departmentId !== "all" ? "No employees match these filters" : "No employees yet"}
          emptyDescription={search || status !== "all" ? "Try a different search or clear the filters." : "Invite employees or import a CSV file."}
          className={list.isFetching && !list.isLoading ? "opacity-80 transition-opacity" : "transition-opacity"}
          toolbar={
            <>
              <SearchInput value={search} onChange={resetPage(setSearch)} placeholder="Search name, email or ID…" />
              <Select
                value={departmentId}
                onValueChange={(v) => {
                  setDepartmentId(v)
                  setTeamId("all")
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-9 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {lookups.data?.departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={teamId} onValueChange={resetPage(setTeamId)}>
                <SelectTrigger className="h-9 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teams</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={resetPage((v: string) => setStatus(v as EmployeeQuery["status"]))}>
                <SelectTrigger className="h-9 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "all" ? "All statuses" : s[0]!.toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={role} onValueChange={resetPage((v: string) => setRole(v as EmployeeQuery["role"]))}>
                <SelectTrigger className="h-9 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="employee">Employees</SelectItem>
                  <SelectItem value="team_manager">Team Managers</SelectItem>
                  <SelectItem value="admin">Company admins</SelectItem>
                </SelectContent>
              </Select>
              <span className="ml-auto text-sm text-muted-foreground">{list.data ? `${formatNumber(list.data.total)} people` : ""}</span>
            </>
          }
        />
      )}

      <InviteEmployeeDialog open={inviteOpen} onOpenChange={setInviteOpen} />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title={confirm?.kind === "deactivate" ? `Deactivate ${confirm.row.firstName} ${confirm.row.lastName}?` : "Revoke this invitation?"}
        description={
          confirm?.kind === "deactivate"
            ? "They will be signed out and can no longer use HealthX. Their points stay on record and you can reactivate them later."
            : "The invitation link will stop working. You can invite this person again later."
        }
        confirmLabel={confirm?.kind === "deactivate" ? "Deactivate" : "Revoke invitation"}
        onConfirm={() => {
          if (!confirm) return
          if (confirm.kind === "deactivate") deactivate.mutate({ id: confirm.row.id })
          else if (confirm.row.invitation) revoke.mutate({ id: confirm.row.invitation.id })
          setConfirm(null)
        }}
      />
    </PageContainer>
  )
}

export default function Page() {
  return (
    <Suspense>
      <EmployeesPage />
    </Suspense>
  )
}
