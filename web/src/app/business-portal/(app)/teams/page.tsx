"use client"

import { Crown, MoreHorizontal, Pencil, Plus, Trash2, UsersRound } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useMemo, useState } from "react"
import { TeamDialog } from "@/components/business/people/team-dialog"
import { TeamMembersSheet } from "@/components/business/people/team-members-sheet"
import { DataTable, type Column } from "@/components/common/data-table"
import { ConfirmDialog, SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { ErrorState } from "@/components/common/states"
import { UserAvatar } from "@/components/common/user-avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { organizationApi, type TeamRow } from "@/lib/api/business/organization"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { formatDate, formatPercent, pluralize } from "@/lib/format"

function TeamsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const can = useCan()
  const manage = can("org.manage")
  const departmentId = params.get("department") ?? "all"
  const [search, setSearch] = useState("")
  const [dialog, setDialog] = useState<{ open: boolean; team?: TeamRow | null }>({ open: false })
  const [panel, setPanel] = useState<TeamRow | null>(null)
  const [toDelete, setToDelete] = useState<TeamRow | null>(null)

  const setDepartment = (v: string) => router.replace(v === "all" ? pathname : `${pathname}?department=${v}`, { scroll: false })

  const lookups = useApiQuery(["business", "lookups"], () => organizationApi.lookups())
  const query = { departmentId: departmentId === "all" ? undefined : departmentId }
  const q = useApiQuery(["business", "teams", query], () => organizationApi.teams(query), { placeholderData: (prev) => prev })
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase()
    return (q.data ?? []).filter((t) => !s || t.name.toLowerCase().includes(s) || t.departmentName.toLowerCase().includes(s) || t.managers.some((m) => m.name.toLowerCase().includes(s)))
  }, [q.data, search])
  const withoutManager = (q.data ?? []).filter((t) => t.managers.length === 0 && t.memberCount > 0).length

  const remove = useApiMutation(organizationApi.deleteTeam, { success: (_r, i) => `${q.data?.find((t) => t.id === i.id)?.name ?? "Team"} deleted.` })

  const columns: Column<TeamRow>[] = [
    {
      key: "name",
      header: "Team",
      sortValue: (t) => t.name,
      cell: (t) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/12 text-sky-600 dark:text-sky-400">
            <UsersRound className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium">{t.name}</div>
            <div className="truncate text-xs text-muted-foreground">{t.departmentName}</div>
          </div>
        </div>
      ),
    },
    {
      key: "managers",
      header: "Team Manager(s)",
      cell: (t) =>
        t.managers.length ? (
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex -space-x-2">
              {t.managers.map((m) => (
                <Tooltip key={m.id}>
                  <TooltipTrigger asChild>
                    <span>
                      <UserAvatar name={m.name} color={m.avatarColor} size="sm" className="ring-2 ring-card" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{m.name}</TooltipContent>
                </Tooltip>
              ))}
            </div>
            <span className="truncate text-sm">{t.managers.length === 1 ? t.managers[0]!.name : `${t.managers.length} managers`}</span>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400">
            <Crown className="size-3.5" /> Not assigned
          </span>
        ),
      hideOnMobile: true,
    },
    {
      key: "members",
      header: "Members",
      align: "right",
      sortValue: (t) => t.memberCount,
      cell: (t) => (
        <div className="text-right">
          <div className="font-semibold tabular-nums">{t.memberCount}</div>
          <div className="text-xs text-muted-foreground">{t.memberCount ? `${formatPercent(t.activeCount / t.memberCount)} active` : "empty"}</div>
        </div>
      ),
    },
    { key: "created", header: "Created", sortValue: (t) => t.createdAt, cell: (t) => <span className="text-sm text-muted-foreground">{formatDate(t.createdAt)}</span>, hideOnMobile: true },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (t) =>
        manage ? (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.name}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => setPanel(t)}>
                  <UsersRound /> Members & managers
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDialog({ open: true, team: t })}>
                  <Pencil /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setToDelete(t)}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null,
    },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Teams"
        description="Create teams within departments, manage members and assign Team Managers."
        actions={
          manage ? (
            <Button onClick={() => setDialog({ open: true, team: null })}>
              <Plus data-icon="inline-start" /> Add team
            </Button>
          ) : null
        }
      />

      {withoutManager > 0 && manage ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] px-4 py-2.5 text-sm">
          <Crown className="size-4 text-amber-600" />
          <span>
            <span className="font-semibold">{pluralize(withoutManager, "team")}</span> {withoutManager === 1 ? "has" : "have"} no Team Manager yet.
          </span>
          <span className="text-muted-foreground">Open a team to assign one.</span>
        </div>
      ) : null}

      {q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(t) => t.id}
          loading={q.isLoading}
          onRowClick={manage ? (t) => setPanel(t) : undefined}
          clientPageSize={20}
          emptyTitle={search || departmentId !== "all" ? "No teams match these filters" : "No teams yet."}
          emptyDescription={search || departmentId !== "all" ? "Try another department or search." : "Create teams inside your departments, then add members and Team Managers."}
          emptyAction={
            manage && !search ? (
              <Button onClick={() => setDialog({ open: true, team: null })}>
                <Plus data-icon="inline-start" /> Add team
              </Button>
            ) : undefined
          }
          toolbar={
            <>
              <SearchInput value={search} onChange={setSearch} placeholder="Search teams or managers…" />
              <Select value={departmentId} onValueChange={setDepartment}>
                <SelectTrigger className="h-9 w-48">
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
              <span className="ml-auto text-sm text-muted-foreground">{q.data ? pluralize(rows.length, "team") : ""}</span>
            </>
          }
        />
      )}

      <TeamDialog
        open={dialog.open}
        team={dialog.team}
        defaultDepartmentId={departmentId === "all" ? undefined : departmentId}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        onCreated={(t) => setPanel(t)}
      />
      <TeamMembersSheet team={panel} open={!!panel} onOpenChange={(o) => !o && setPanel(null)} onEdit={(t) => setDialog({ open: true, team: t })} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        destructive={!toDelete?.memberCount}
        title={toDelete?.memberCount ? `${toDelete.name} still has members` : `Delete ${toDelete?.name}?`}
        description={
          toDelete?.memberCount
            ? `This team still has ${pluralize(toDelete.memberCount, "member")}. Move them to another team before deleting — open the team and use "Remove from team".`
            : "This can't be undone. Challenges that targeted this team keep their results."
        }
        confirmLabel={toDelete?.memberCount ? "Open team" : "Delete team"}
        onConfirm={() => {
          if (!toDelete) return
          if (toDelete.memberCount) setPanel(toDelete)
          else remove.mutate({ id: toDelete.id })
          setToDelete(null)
        }}
      />
    </PageContainer>
  )
}

/** SCR-B-011 — Teams & team members. */
export default function Page() {
  return (
    <Suspense>
      <TeamsPage />
    </Suspense>
  )
}
