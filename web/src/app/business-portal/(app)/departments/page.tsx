"use client"

import { ArrowRightLeft, MoreHorizontal, Network, Pencil, Plus, Trash2, Users, UsersRound } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { DepartmentDialog } from "@/components/business/people/department-dialog"
import { DataTable, type Column } from "@/components/common/data-table"
import { ConfirmDialog, InlineBar, SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { ErrorState } from "@/components/common/states"
import { PersonCell } from "@/components/common/user-avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { organizationApi, type DepartmentRow } from "@/lib/api/business/organization"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { formatDate, formatNumber, formatPercent, pluralize } from "@/lib/format"

/** SCR-B-010 — Departments. */
export default function DepartmentsPage() {
  const router = useRouter()
  const can = useCan()
  const manage = can("org.manage")
  const [search, setSearch] = useState("")
  const [dialog, setDialog] = useState<{ open: boolean; department?: DepartmentRow | null }>({ open: false })
  const [toDelete, setToDelete] = useState<DepartmentRow | null>(null)

  const q = useApiQuery(["business", "departments"], () => organizationApi.departments())
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase()
    return (q.data ?? []).filter((d) => !s || d.name.toLowerCase().includes(s) || d.head?.name.toLowerCase().includes(s) || d.description?.toLowerCase().includes(s))
  }, [q.data, search])

  const totals = useMemo(() => {
    const list = q.data ?? []
    return { departments: list.length, teams: list.reduce((a, d) => a + d.teamCount, 0), employees: list.reduce((a, d) => a + d.employeeCount, 0), largest: [...list].sort((a, b) => b.employeeCount - a.employeeCount)[0] }
  }, [q.data])
  const maxEmployees = Math.max(1, ...(q.data ?? []).map((d) => d.employeeCount))

  const columns: Column<DepartmentRow>[] = [
    {
      key: "name",
      header: "Department",
      sortValue: (d) => d.name,
      cell: (d) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Network className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium">{d.name}</div>
            <div className="truncate text-xs text-muted-foreground">{d.description || (d.locationName ? d.locationName : "No description")}</div>
          </div>
        </div>
      ),
      className: "max-w-80",
    },
    {
      key: "head",
      header: "Head",
      cell: (d) => (d.head ? <PersonCell name={d.head.name} subtitle={d.head.jobTitle} color={d.head.avatarColor} /> : <span className="text-sm text-muted-foreground">Not assigned</span>),
      hideOnMobile: true,
    },
    {
      key: "employees",
      header: "Employees",
      sortValue: (d) => d.employeeCount,
      cell: (d) => (
        <div className="w-36 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold tabular-nums">{formatNumber(d.employeeCount)}</span>
            <span className="text-xs text-muted-foreground">{d.employeeCount ? `${formatPercent(d.activeCount / d.employeeCount)} active` : "—"}</span>
          </div>
          <InlineBar value={d.employeeCount} max={maxEmployees} />
        </div>
      ),
    },
    { key: "teams", header: "Teams", align: "right", sortValue: (d) => d.teamCount, cell: (d) => <span className="tabular-nums">{d.teamCount}</span>, hideOnMobile: true },
    { key: "created", header: "Created", sortValue: (d) => d.createdAt, cell: (d) => <span className="text-sm text-muted-foreground">{formatDate(d.createdAt)}</span>, hideOnMobile: true },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (d) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${d.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild>
                <Link href={`/business-portal/teams?department=${d.id}`}>
                  <UsersRound /> View teams
                </Link>
              </DropdownMenuItem>
              {manage ? (
                <>
                  <DropdownMenuItem onClick={() => setDialog({ open: true, department: d })}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setToDelete(d)}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
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
        title="Departments"
        description="Organise people into departments. They're used for challenge audiences, filters and privacy-safe analytics."
        actions={
          manage ? (
            <Button onClick={() => setDialog({ open: true, department: null })}>
              <Plus data-icon="inline-start" /> Add department
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Departments" value={formatNumber(totals.departments)} icon={Network} tone="emerald" loading={q.isLoading} />
        <StatCard label="Teams" value={formatNumber(totals.teams)} icon={UsersRound} tone="sky" loading={q.isLoading} href="/business-portal/teams" />
        <StatCard label="Employees assigned" value={formatNumber(totals.employees)} icon={Users} tone="violet" loading={q.isLoading} hint={totals.largest ? `Largest: ${totals.largest.name}` : undefined} />
      </div>

      {q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(d) => d.id}
          loading={q.isLoading}
          onRowClick={(d) => router.push(`/business-portal/teams?department=${d.id}`)}
          emptyTitle={search ? "No departments match your search" : "No departments yet"}
          emptyDescription={search ? "Try a different name." : "Add departments like Engineering, Sales, Marketing and HR."}
          emptyAction={
            !search && manage ? (
              <Button onClick={() => setDialog({ open: true, department: null })}>
                <Plus data-icon="inline-start" /> Add department
              </Button>
            ) : undefined
          }
          toolbar={
            <>
              <SearchInput value={search} onChange={setSearch} placeholder="Search departments or heads…" />
              <span className="ml-auto text-sm text-muted-foreground">{q.data ? pluralize(rows.length, "department") : ""}</span>
            </>
          }
        />
      )}

      <DepartmentDialog open={dialog.open} department={dialog.department} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} />
      <DeleteDepartmentDialog key={toDelete?.id ?? "none"} department={toDelete} onClose={() => setToDelete(null)} />
    </PageContainer>
  )
}

function DeleteDepartmentDialog({ department, onClose }: { department: DepartmentRow | null; onClose: () => void }) {
  const hasPeople = !!department && department.employeeCount > 0
  const [targetTeamId, setTargetTeamId] = useState("")
  const lookups = useApiQuery(["business", "lookups"], () => organizationApi.lookups(), { enabled: hasPeople })
  const move = useApiMutation(organizationApi.moveDepartmentMembers, { invalidate: false })
  const remove = useApiMutation(organizationApi.deleteDepartment, {
    success: () => `${department?.name ?? "Department"} deleted.`,
    onSuccess: () => {
      setTargetTeamId("")
      onClose()
    },
  })

  if (!department) return null

  if (!hasPeople) {
    return (
      <ConfirmDialog
        open
        onOpenChange={(o) => !o && onClose()}
        destructive
        title={`Delete ${department.name}?`}
        description={department.teamCount ? `Its ${pluralize(department.teamCount, "empty team")} will be deleted too. This can't be undone.` : "This can't be undone."}
        confirmLabel="Delete department"
        onConfirm={() => remove.mutate({ id: department.id })}
      />
    )
  }

  const otherDepartments = (lookups.data?.departments ?? []).filter((d) => d.id !== department.id)
  const busy = move.isPending || remove.isPending
  return (
    <AlertDialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Move people before deleting</AlertDialogTitle>
          <AlertDialogDescription>
            This department still has {pluralize(department.employeeCount, "employee")}. Move them before deleting.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Move everyone in {department.name} to</Label>
          <Select value={targetTeamId} onValueChange={setTargetTeamId}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder={lookups.isLoading ? "Loading teams…" : "Choose a team"} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {otherDepartments.map((d) => (
                <SelectGroup key={d.id}>
                  <SelectLabel>{d.name}</SelectLabel>
                  {(lookups.data?.teams ?? [])
                    .filter((t) => t.departmentId === d.id)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <Alert>
            <AlertDescription className="text-xs">Team Manager assignments in {department.name} are cleared. You can also move people one by one from the Employees page.</AlertDescription>
          </Alert>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={!targetTeamId || busy}
            onClick={() =>
              move.mutate({ id: department.id, targetTeamId }, { onSuccess: () => remove.mutate({ id: department.id }) })
            }
          >
            {busy ? <Spinner /> : <ArrowRightLeft data-icon="inline-start" />}
            Move {formatNumber(department.employeeCount)} &amp; delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
