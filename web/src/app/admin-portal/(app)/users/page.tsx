"use client"

import { Download, Eye, Lock, LockOpen, LogOut, MoreHorizontal, RotateCcw, Send, UserMinus } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { FilterSelect } from "@/components/admin/filter-select"
import { UserDetailSheet, type UserActionHandlers } from "@/components/admin/customers/user-detail-sheet"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { DataTable, type Column } from "@/components/common/data-table"
import { ConfirmDialog, SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { ErrorState } from "@/components/common/states"
import { PersonCell } from "@/components/common/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { DIRECTORY_ROLE_LABEL, type DirectoryRole } from "@/lib/api/platform/directory"
import { usersApi, type UserIssue, type UserQuery, type UserRow } from "@/lib/api/platform/users"
import { downloadText } from "@/lib/download"
import { formatNumber, formatRelative } from "@/lib/format"
import type { EmployeeStatus } from "@/lib/types"

const STATUS_OPTIONS: { value: EmployeeStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "registered", label: "Registered" },
  { value: "invited", label: "Invited" },
  { value: "inactive", label: "Inactive" },
  { value: "deactivated", label: "Deactivated" },
]

const ROLE_OPTIONS = (Object.keys(DIRECTORY_ROLE_LABEL) as DirectoryRole[]).map((r) => ({ value: r, label: DIRECTORY_ROLE_LABEL[r] }))

const ISSUE_OPTIONS: { value: UserIssue; label: string }[] = [
  { value: "locked", label: "Sign-in locked" },
  { value: "not_connected", label: "Health app not connected" },
  { value: "no_sync_7d", label: "No sync for 7+ days" },
]

const PAGE_SIZE = 15

/**
 * SCR-P-006 Users + #366 Employee Support Tools — platform-wide account search (name, email, phone or employee ID).
 * Accepts ?company=<id>, ?status=<status>, ?role=<role>, ?issue=<issue>, ?q=<search>.
 */
function PlatformUsersPage() {
  const can = useAdminCan()
  const canManage = can("users.manage")
  const params = useSearchParams()
  const initialStatus = params.get("status")
  const initialRole = params.get("role")
  const initialIssue = params.get("issue")
  const [search, setSearch] = useState(params.get("q") ?? "")
  const [companyId, setCompanyId] = useState(params.get("company") || "all")
  const [role, setRole] = useState(initialRole && initialRole in DIRECTORY_ROLE_LABEL ? initialRole : "all")
  const [status, setStatus] = useState(initialStatus && STATUS_OPTIONS.some((o) => o.value === initialStatus) ? initialStatus : "all")
  const [issue, setIssue] = useState(initialIssue && ISSUE_OPTIONS.some((o) => o.value === initialIssue) ? initialIssue : "all")
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ kind: "deactivate" | "revoke"; user: UserRow } | null>(null)

  const query: UserQuery = {
    search: search || undefined,
    companyId: companyId === "all" ? undefined : companyId,
    role: role as UserQuery["role"],
    status: status as UserQuery["status"],
    issue: issue as UserQuery["issue"],
    page,
    pageSize: PAGE_SIZE,
  }
  const companies = useApiQuery(["admin", "company-options"], () => usersApi.companies())
  const list = useApiQuery(["admin", "users", query], () => usersApi.list(query), { placeholderData: (prev) => prev })

  const name = (u: UserRow) => `${u.firstName} ${u.lastName}`
  const resend = useApiMutation(usersApi.resendInvitation, { success: (r) => `Invitation resent to ${r.email}` })
  const reactivate = useApiMutation(usersApi.reactivate, { success: (u) => `${name(u)} was reactivated` })
  const deactivate = useApiMutation(usersApi.deactivate, { success: "User deactivated." })
  const revoke = useApiMutation(usersApi.revokeSessions, { success: (u) => `${name(u)} was signed out of all devices` })
  const unlock = useApiMutation(usersApi.unlock, { success: (u) => `${name(u)} can sign in again` })
  const exportCsv = useApiMutation(usersApi.exportCsv, {
    success: (r) => `Exported ${formatNumber(r.count)} users`,
    invalidate: false,
    onSuccess: (r) => downloadText(r.fileName, r.csv),
  })

  const handlers: UserActionHandlers = {
    canManage,
    busy: resend.isPending || reactivate.isPending || deactivate.isPending || revoke.isPending || unlock.isPending,
    onResend: (u) => resend.mutate({ id: u.id }),
    onReactivate: (u) => reactivate.mutate({ id: u.id }),
    onDeactivate: (u) => setConfirm({ kind: "deactivate", user: u }),
    onRevoke: (u) => setConfirm({ kind: "revoke", user: u }),
    onUnlock: (u) => unlock.mutate({ id: u.id }),
  }

  const resetPage =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v)
      setPage(1)
    }
  const filtered = !!search || companyId !== "all" || role !== "all" || status !== "all" || issue !== "all"

  const columns: Column<UserRow>[] = [
    {
      key: "name",
      header: "Name",
      cell: (u) => (
        <PersonCell
          name={name(u)}
          color={u.avatarColor}
          subtitle={
            <>
              <span className="md:hidden">{u.companyName}</span>
              <span className="hidden md:inline">
                <span className="font-mono">{u.employeeCode}</span>
                {u.jobTitle ? ` · ${u.jobTitle}` : ""}
              </span>
            </>
          }
        />
      ),
      className: "max-w-56",
    },
    { key: "email", header: "Email", cell: (u) => <span className="block max-w-56 truncate text-sm text-muted-foreground">{u.email}</span>, hideOnMobile: true },
    {
      key: "company",
      header: "Company",
      cell: (u) => (
        <div className="min-w-0">
          <div className="max-w-44 truncate text-sm">{u.companyName}</div>
          {u.companyStatus === "suspended" ? <div className="text-xs text-rose-600 dark:text-rose-400">Company suspended</div> : null}
        </div>
      ),
      hideOnMobile: true,
    },
    {
      key: "role",
      header: "Role",
      cell: (u) => (u.role === "employee" ? <span className="text-sm text-muted-foreground">Employee</span> : <Badge variant="secondary">{DIRECTORY_ROLE_LABEL[u.role]}</Badge>),
      hideOnMobile: true,
    },
    {
      key: "status",
      header: "Status",
      cell: (u) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={u.status} />
          {u.locked ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 dark:text-rose-400" title="Sign-in locked after 5 failed attempts">
              <Lock className="size-3.5" />
              <span className="hidden lg:inline">Locked</span>
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "last",
      header: "Last sign-in",
      cell: (u) => <span className="text-sm whitespace-nowrap text-muted-foreground">{u.lastSignInAt ? formatRelative(u.lastSignInAt) : "Never"}</span>,
      hideOnMobile: true,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (u) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${name(u)}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setOpenId(u.id)}>
                <Eye /> View details
              </DropdownMenuItem>
              {canManage ? (
                <>
                  {u.status === "invited" ? (
                    <DropdownMenuItem onClick={() => handlers.onResend(u)}>
                      <Send /> Resend invitation
                    </DropdownMenuItem>
                  ) : null}
                  {u.locked ? (
                    <DropdownMenuItem onClick={() => handlers.onUnlock(u)}>
                      <LockOpen /> Unlock sign-in
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem disabled={u.activeSessions === 0} onClick={() => handlers.onRevoke(u)}>
                    <LogOut /> Sign out of all devices
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {u.status === "deactivated" ? (
                    <DropdownMenuItem onClick={() => handlers.onReactivate(u)}>
                      <RotateCcw /> Reactivate
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem variant="destructive" disabled={u.role === "company_owner"} onClick={() => handlers.onDeactivate(u)}>
                      <UserMinus /> Deactivate
                    </DropdownMenuItem>
                  )}
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Users"
        description="Find any employee or admin across all companies by name, email or employee ID, check their account and tracker connection, and help them get back in. Health data is never shown."
        actions={
          <Button variant="outline" onClick={() => exportCsv.mutate({ ...query, page: undefined, pageSize: undefined })} disabled={exportCsv.isPending || !list.data?.total}>
            <Download data-icon="inline-start" /> Export CSV
          </Button>
        }
      />

      {list.error && !list.data ? (
        <ErrorState error={new Error("Couldn't load users.")} onRetry={() => list.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={list.data?.items ?? []}
          getRowId={(u) => u.id}
          loading={list.isLoading}
          onRowClick={(u) => setOpenId(u.id)}
          pagination={list.data ? { page, pageSize: PAGE_SIZE, total: list.data.total, onPageChange: setPage } : undefined}
          emptyTitle={filtered ? "No users match your search." : "No users yet"}
          emptyDescription={filtered ? "Try a different name, email, phone or employee ID, or clear the filters." : "Accounts appear here once companies invite their people."}
          emptyAction={
            filtered ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("")
                  setCompanyId("all")
                  setRole("all")
                  setStatus("all")
                  setIssue("all")
                  setPage(1)
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
          className={list.isFetching && !list.isLoading ? "opacity-80 transition-opacity" : "transition-opacity"}
          toolbar={
            <>
              <SearchInput value={search} onChange={resetPage(setSearch)} placeholder="Search name, email, phone or employee ID…" className="sm:w-72" />
              <FilterSelect
                value={companyId}
                onChange={resetPage(setCompanyId)}
                allLabel="All companies"
                className="sm:w-48"
                options={(companies.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              />
              <FilterSelect value={role} onChange={resetPage(setRole)} allLabel="All roles" options={ROLE_OPTIONS} />
              <FilterSelect
                value={status}
                onChange={resetPage(setStatus)}
                allLabel="All statuses"
                options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: list.data ? `${s.label} (${formatNumber(list.data.statusCounts[s.value])})` : s.label }))}
              />
              <FilterSelect value={issue} onChange={resetPage(setIssue)} allLabel="All accounts" className="sm:w-52" options={ISSUE_OPTIONS} aria-label="Support filter" />
              <span className="ml-auto text-sm text-muted-foreground">{list.data ? `${formatNumber(list.data.total)} ${list.data.total === 1 ? "user" : "users"}` : ""}</span>
            </>
          }
        />
      )}

      <UserDetailSheet userId={openId} onOpenChange={(o) => !o && setOpenId(null)} actions={handlers} />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title={confirm ? (confirm.kind === "deactivate" ? `Deactivate ${name(confirm.user)}?` : `Sign ${name(confirm.user)} out of all devices?`) : ""}
        description={
          confirm?.kind === "deactivate"
            ? `They'll be signed out and can no longer use HealthX at ${confirm.user.companyName}. Their points and history stay on record, and you can reactivate them later.`
            : `This ends ${confirm?.user.activeSessions ?? 0} active session(s) on phones and browsers. They can sign in again with their password.`
        }
        confirmLabel={confirm?.kind === "deactivate" ? "Deactivate" : "Sign out everywhere"}
        onConfirm={() => {
          if (!confirm) return
          if (confirm.kind === "deactivate") deactivate.mutate({ id: confirm.user.id })
          else revoke.mutate({ id: confirm.user.id })
          setConfirm(null)
        }}
      />
    </PageContainer>
  )
}

export default function Page() {
  return (
    <Suspense>
      <PlatformUsersPage />
    </Suspense>
  )
}
