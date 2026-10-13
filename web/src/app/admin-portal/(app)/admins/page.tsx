"use client"

import { MoreHorizontal, Pencil, RotateCcw, Send, ShieldCheck, ShieldOff, UserMinus, UserPlus } from "lucide-react"
import { useState } from "react"
import { AdminUserDialog } from "@/components/admin/customers/admin-user-dialog"
import { RoleBadge, RoleDescriptions, ROLE_INFO } from "@/components/admin/customers/admin-roles"
import { FilterSelect } from "@/components/admin/filter-select"
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
import { Skeleton } from "@/components/ui/skeleton"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { adminsApi, type AdminUserQuery, type AdminUserRow } from "@/lib/api/platform/admins"
import { formatNumber, formatRelative } from "@/lib/format"
import type { PlatformRole } from "@/lib/types"

function MfaCell({ a }: { a: AdminUserRow }) {
  if (a.mfaEnabled)
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
        <ShieldCheck className="size-4" /> On
      </span>
    )
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${a.mfaRequired ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
      <ShieldOff className="size-4" /> {a.mfaRequired ? "Setup pending" : "Off"}
    </span>
  )
}

/** SCR-P-007 HealthX admin users — Super Admin only. */
export default function HealthXAdminsPage() {
  const can = useAdminCan()
  const canManage = can("admins.manage")
  const [search, setSearch] = useState("")
  const [role, setRole] = useState("all")
  const [status, setStatus] = useState("all")
  const [dialog, setDialog] = useState<{ open: boolean; admin: AdminUserRow | null }>({ open: false, admin: null })
  const [confirm, setConfirm] = useState<AdminUserRow | null>(null)

  const query: AdminUserQuery = { search: search || undefined, role: role as AdminUserQuery["role"], status: status as AdminUserQuery["status"] }
  const list = useApiQuery(["admin", "admin-users", query], () => adminsApi.list(query), { placeholderData: (prev) => prev })
  const counts = list.data?.counts
  const isLastSuper = (a: AdminUserRow) => a.role === "super_admin" && a.status === "active" && (counts?.superAdmins ?? 0) <= 1

  const update = useApiMutation(adminsApi.update, {
    success: (a) => (a.status === "disabled" ? `${a.name} was deactivated` : `${a.name} can sign in again`),
  })
  const resend = useApiMutation(adminsApi.resendInvite, { success: (r) => `Invitation resent to ${r.email}` })

  const columns: Column<AdminUserRow>[] = [
    {
      key: "name",
      header: "Name",
      cell: (a) => (
        <div className="flex min-w-0 items-center gap-2">
          <PersonCell
            name={a.name}
            color={a.avatarColor}
            subtitle={
              <>
                <span className="md:hidden">{ROLE_INFO[a.role].label}</span>
                <span className="hidden md:inline">Added {formatRelative(a.createdAt)}</span>
              </>
            }
          />
          {a.isYou ? (
            <Badge variant="outline" className="shrink-0">
              You
            </Badge>
          ) : null}
        </div>
      ),
      sortValue: (a) => a.name,
    },
    { key: "email", header: "Email", cell: (a) => <span className="block max-w-60 truncate text-sm text-muted-foreground">{a.email}</span>, hideOnMobile: true },
    { key: "role", header: "Role", cell: (a) => <RoleBadge role={a.role} />, hideOnMobile: true, sortValue: (a) => a.role },
    { key: "mfa", header: "MFA", cell: (a) => <MfaCell a={a} />, hideOnMobile: true },
    { key: "status", header: "Status", cell: (a) => <StatusBadge status={a.status} label={a.status === "disabled" ? "Deactivated" : undefined} /> },
    {
      key: "last",
      header: "Last sign-in",
      cell: (a) => <span className="text-sm whitespace-nowrap text-muted-foreground">{a.lastLoginAt ? formatRelative(a.lastLoginAt) : "Never"}</span>,
      hideOnMobile: true,
      sortValue: (a) => a.lastLoginAt ?? "",
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (a) =>
        canManage ? (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${a.name}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => setDialog({ open: true, admin: a })}>
                  <Pencil /> Edit
                </DropdownMenuItem>
                {a.status === "invited" ? (
                  <DropdownMenuItem onClick={() => resend.mutate({ id: a.id })}>
                    <Send /> Resend invite
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                {a.status === "disabled" ? (
                  <DropdownMenuItem onClick={() => update.mutate({ id: a.id, status: "active" })}>
                    <RotateCcw /> Re-enable
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem variant="destructive" disabled={a.isYou || isLastSuper(a)} onClick={() => setConfirm(a)}>
                    <UserMinus /> Deactivate
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null,
    },
  ]

  const filtered = !!search || role !== "all" || status !== "all"

  return (
    <PageContainer>
      <PageHeader
        title="HealthX admin users"
        description="People at HealthX who can use this Platform Admin portal. Every change here is audit-logged."
        actions={
          canManage ? (
            <Button onClick={() => setDialog({ open: true, admin: null })}>
              <UserPlus data-icon="inline-start" /> Add admin
            </Button>
          ) : null
        }
      />

      {counts ? (
        <RoleDescriptions counts={counts.activeByRole} />
      ) : list.isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : null}

      {list.error && !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={list.data?.items ?? []}
          getRowId={(a) => a.id}
          loading={list.isLoading}
          onRowClick={canManage ? (a) => setDialog({ open: true, admin: a }) : undefined}
          emptyTitle={filtered ? "No admins match these filters" : "No admin users yet"}
          emptyDescription={filtered ? "Try a different search or clear the filters." : "Invite the first HealthX admin."}
          className={list.isFetching && !list.isLoading ? "opacity-80 transition-opacity" : "transition-opacity"}
          toolbar={
            <>
              <SearchInput value={search} onChange={setSearch} placeholder="Search name or email…" />
              <FilterSelect
                value={role}
                onChange={setRole}
                allLabel="All roles"
                options={(Object.keys(ROLE_INFO) as PlatformRole[]).map((r) => ({ value: r, label: ROLE_INFO[r].label }))}
              />
              <FilterSelect
                value={status}
                onChange={setStatus}
                allLabel="All statuses"
                options={[
                  { value: "active", label: "Active" },
                  { value: "invited", label: "Invited" },
                  { value: "disabled", label: "Deactivated" },
                ]}
              />
              <span className="ml-auto text-sm text-muted-foreground">
                {counts ? `${formatNumber(counts.active)} active · ${formatNumber(counts.invited)} invited · ${formatNumber(counts.disabled)} deactivated` : ""}
              </span>
            </>
          }
        />
      )}

      <AdminUserDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        admin={dialog.admin}
        lastSuperAdmin={dialog.admin ? isLastSuper(dialog.admin) : false}
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title={confirm ? `Deactivate ${confirm.name}?` : ""}
        description="They'll be signed out and can no longer sign in to the Platform Admin portal. You can re-enable them later."
        confirmLabel="Deactivate"
        onConfirm={() => {
          if (confirm) update.mutate({ id: confirm.id, status: "disabled" })
          setConfirm(null)
        }}
      />
    </PageContainer>
  )
}
