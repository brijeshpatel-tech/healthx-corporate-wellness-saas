"use client"

import { ArrowRightLeft, Crown, MoreHorizontal, Pencil, Search, ShieldMinus, UserMinus, UserPlus, X } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { StatusBadge } from "@/components/common/status-badge"
import { UserAvatar } from "@/components/common/user-avatar"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { organizationApi, type TeamMember, type TeamRow } from "@/lib/api/business/organization"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatRelative, pluralize } from "@/lib/format"
import { EmployeeCombobox, EmployeeMultiSelect } from "./employee-picker"

const NO_TEAM = "none"
const MAX_MANAGERS = 3

/** SCR-B-011 side panel — members, add/remove, assign Team Managers. */
export function TeamMembersSheet({ team, open, onOpenChange, onEdit }: { team: TeamRow | null; open: boolean; onOpenChange: (open: boolean) => void; onEdit?: (team: TeamRow) => void }) {
  const [adding, setAdding] = useState(false)
  const [toAdd, setToAdd] = useState<string[]>([])
  const [filter, setFilter] = useState("")
  const [removing, setRemoving] = useState<TeamMember | null>(null)
  const [managerPick, setManagerPick] = useState<string | undefined>()

  const id = team?.id ?? ""
  const members = useApiQuery(["business", "team-members", id], () => organizationApi.teamMembers({ id }), { enabled: open && !!team })
  const people = useApiQuery(["business", "people", "all"], () => organizationApi.people({}), { enabled: open && adding })
  const teams = useApiQuery(["business", "teams", {}], () => organizationApi.teams({}), { enabled: open && !!team })
  const current = teams.data?.find((t) => t.id === id) ?? team

  const updateMembers = useApiMutation(organizationApi.updateTeamMembers, {
    success: (r) => (r.added ? `${pluralize(r.added, "member")} added to ${team?.name}.` : `${pluralize(r.removed, "member")} removed from ${team?.name}.`),
    onSuccess: () => {
      setToAdd([])
      setAdding(false)
      setRemoving(null)
    },
  })
  const setManagers = useApiMutation(organizationApi.setTeamManagers, { success: "Team updated.", onSuccess: () => setManagerPick(undefined) })

  const list = useMemo(() => {
    const s = filter.trim().toLowerCase()
    return (members.data ?? []).filter((m) => !s || m.name.toLowerCase().includes(s) || m.jobTitle.toLowerCase().includes(s) || m.email.includes(s))
  }, [members.data, filter])

  const managerIds = current?.managerIds ?? []
  const candidates = (members.data ?? []).filter((m) => !m.isManager && m.status !== "invited").map((m) => ({ ...m, hint: m.jobTitle }))
  const addable = (people.data ?? []).filter((p) => p.teamId !== id).map((p) => ({ ...p, hint: `${p.teamName} · ${p.departmentName}` }))

  const toggleManager = (memberId: string, makeManager: boolean) => {
    const next = makeManager ? [...managerIds, memberId] : managerIds.filter((m) => m !== memberId)
    setManagers.mutate({ id, managerIds: next })
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) {
          setAdding(false)
          setToAdd([])
          setFilter("")
        }
      }}
    >
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        {team ? (
          <>
            <SheetHeader className="border-b pr-12">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <SheetTitle className="text-lg font-semibold">{current?.name}</SheetTitle>
                  <SheetDescription>
                    {current?.departmentName} · {pluralize(current?.memberCount ?? 0, "member")}
                  </SheetDescription>
                </div>
                {onEdit && current ? (
                  <Button size="sm" variant="outline" onClick={() => onEdit(current)}>
                    <Pencil data-icon="inline-start" /> Edit
                  </Button>
                ) : null}
              </div>
              {current?.description ? <p className="pt-1 text-sm text-muted-foreground">{current.description}</p> : null}
            </SheetHeader>

            <div className="flex-1 space-y-6 overflow-y-auto p-4">
              {/* Team Managers */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Team Managers</h3>
                  <span className="text-xs text-muted-foreground">
                    {managerIds.length}/{MAX_MANAGERS}
                  </span>
                </div>
                {current?.managers.length ? (
                  <ul className="space-y-2">
                    {current.managers.map((m) => (
                      <li key={m.id} className="flex items-center gap-3 rounded-xl border bg-amber-500/[0.04] px-3 py-2">
                        <UserAvatar name={m.name} color={m.avatarColor} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{m.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{m.jobTitle}</p>
                        </div>
                        <Button size="icon-sm" variant="ghost" aria-label={`Remove ${m.name} as Team Manager`} disabled={setManagers.isPending} onClick={() => toggleManager(m.id, false)}>
                          <X />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-dashed px-3 py-3 text-sm text-muted-foreground">No Team Manager yet. Team Managers see their team&apos;s combined progress — never individual health data.</p>
                )}
                {managerIds.length < MAX_MANAGERS ? (
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <EmployeeCombobox people={candidates} value={managerPick} onChange={setManagerPick} placeholder={candidates.length ? "Choose a member…" : "Add members first"} disabled={!candidates.length} />
                    </div>
                    <Button disabled={!managerPick || setManagers.isPending} onClick={() => managerPick && toggleManager(managerPick, true)}>
                      {setManagers.isPending ? <Spinner /> : <Crown data-icon="inline-start" />}
                      Assign
                    </Button>
                  </div>
                ) : null}
              </section>

              {/* Members */}
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Members ({members.data?.length ?? "…"})</h3>
                  {!adding ? (
                    <Button size="sm" onClick={() => setAdding(true)}>
                      <UserPlus data-icon="inline-start" /> Add members
                    </Button>
                  ) : null}
                </div>

                {adding ? (
                  <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">People you add move from their current team into {team.name} ({current?.departmentName}).</p>
                    {people.isLoading ? <Skeleton className="h-48" /> : <EmployeeMultiSelect people={addable} selected={toAdd} onChange={setToAdd} />}
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setAdding(false)
                          setToAdd([])
                        }}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" disabled={!toAdd.length || updateMembers.isPending} onClick={() => updateMembers.mutate({ id, add: toAdd })}>
                        {updateMembers.isPending ? <Spinner /> : <UserPlus data-icon="inline-start" />}
                        {toAdd.length ? `Add ${pluralize(toAdd.length, "member")}` : "Add members"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {(members.data?.length ?? 0) > 6 ? (
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter members…" className="h-9 pl-8" />
                  </div>
                ) : null}

                {members.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 rounded-xl" />
                    ))}
                  </div>
                ) : list.length === 0 ? (
                  <p className="rounded-xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">{filter ? "No members match." : "This team has no members yet."}</p>
                ) : (
                  <ul className="divide-y rounded-xl border">
                    {list.map((m) => (
                      <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                        <UserAvatar name={m.name} color={m.avatarColor} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Link href={`/business-portal/employees/${m.id}`} className="truncate text-sm font-medium hover:underline">
                              {m.name}
                            </Link>
                            {m.isManager ? (
                              <Badge variant="secondary" className="gap-1">
                                <Crown /> Manager
                              </Badge>
                            ) : null}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {m.jobTitle}
                            {m.lastActiveAt ? ` · active ${formatRelative(m.lastActiveAt)}` : ""}
                          </p>
                        </div>
                        <StatusBadge status={m.status} className="hidden sm:inline-flex" />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.name}`}>
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            {m.isManager ? (
                              <DropdownMenuItem onClick={() => toggleManager(m.id, false)}>
                                <ShieldMinus /> Remove as Team Manager
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem disabled={managerIds.length >= MAX_MANAGERS || m.status === "invited"} onClick={() => toggleManager(m.id, true)}>
                                <Crown /> Make Team Manager
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setRemoving(m)}>
                              <UserMinus /> Remove from team
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <RemoveMemberDialog
              key={removing?.id ?? "none"}
              member={removing}
              team={current ?? team}
              teams={teams.data ?? []}
              pending={updateMembers.isPending}
              onCancel={() => setRemoving(null)}
              onConfirm={(moveToTeamId) => removing && updateMembers.mutate({ id, remove: [removing.id], moveToTeamId })}
            />
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function RemoveMemberDialog({
  member,
  team,
  teams,
  pending,
  onCancel,
  onConfirm,
}: {
  member: TeamMember | null
  team: TeamRow
  teams: TeamRow[]
  pending: boolean
  onCancel: () => void
  onConfirm: (moveToTeamId?: string) => void
}) {
  const [target, setTarget] = useState(NO_TEAM)
  const departments = [...new Map(teams.map((t) => [t.departmentId, t.departmentName])).entries()]
  return (
    <AlertDialog open={!!member} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {member?.name} from {team.name}?</AlertDialogTitle>
          <AlertDialogDescription>Choose where they go next. Their points, badges and challenge history stay with them.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Move to</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={NO_TEAM}>No team (stay in {team.departmentName})</SelectItem>
              {departments.map(([deptId, deptName]) => (
                <SelectGroup key={deptId}>
                  <SelectLabel>{deptName}</SelectLabel>
                  {teams
                    .filter((t) => t.departmentId === deptId && t.id !== team.id)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          {member?.isManager ? <p className="text-xs text-amber-700 dark:text-amber-400">They&apos;ll also stop being this team&apos;s Team Manager.</p> : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant={target === NO_TEAM ? "destructive" : "default"} className={target === NO_TEAM ? "bg-destructive text-white hover:bg-destructive/90" : undefined} disabled={pending} onClick={() => onConfirm(target === NO_TEAM ? undefined : target)}>
            {pending ? <Spinner /> : target === NO_TEAM ? <UserMinus data-icon="inline-start" /> : <ArrowRightLeft data-icon="inline-start" />}
            {target === NO_TEAM ? "Remove from team" : "Move member"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
