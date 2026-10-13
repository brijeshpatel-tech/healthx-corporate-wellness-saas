"use client"

import { Copy, Crown, HeartHandshake, KeyRound, Mail, MoreHorizontal, Send, ShieldCheck, ShieldPlus, UserCog, UserMinus, UsersRound } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { AddAdminDialog } from "@/components/business/people/add-admin-dialog"
import { TransferOwnershipDialog } from "@/components/business/people/transfer-ownership-dialog"
import { DataTable, type Column } from "@/components/common/data-table"
import { ConfirmDialog, SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { ErrorState } from "@/components/common/states"
import { StatusBadge } from "@/components/common/status-badge"
import { PersonCell, UserAvatar } from "@/components/common/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { adminsApi, type AdminRow } from "@/lib/api/business/admins"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { useSession } from "@/lib/auth/session"
import { formatDate, formatRelative } from "@/lib/format"
import { BUSINESS_ROLE_LABEL, type CompanyAdminRole } from "@/lib/types"
import { cn } from "@/lib/utils"

const ROLE_META: Record<CompanyAdminRole, { icon: typeof Crown; tone: string; summary: string }> = {
  company_owner: { icon: Crown, tone: "bg-amber-500/14 text-amber-600 dark:text-amber-400", summary: "Everything, including administrators, settings, branding, rewards and billing." },
  hr_admin: { icon: UserCog, tone: "bg-sky-500/12 text-sky-600 dark:text-sky-400", summary: "Employees, departments, teams, challenges, announcements, orders and analytics." },
  wellness_manager: { icon: HeartHandshake, tone: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400", summary: "Challenges, programmes and content, with challenge and wellness analytics." },
}

/** SCR-B-012 — Administrators & roles (Company Owner only). */
export default function AdministratorsPage() {
  const session = useSession("business")
  const [addOpen, setAddOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [toRemove, setToRemove] = useState<AdminRow | null>(null)
  const [roleChange, setRoleChange] = useState<{ admin: AdminRow; role: Exclude<CompanyAdminRole, "company_owner"> } | null>(null)
  const q = useApiQuery(["business", "admins"], () => adminsApi.list())

  const changeRole = useApiMutation(adminsApi.changeRole, { success: "Role updated." })
  const remove = useApiMutation(adminsApi.remove, { success: (_r, i) => `${q.data?.admins.find((a) => a.id === i.id)?.name ?? "Administrator"} no longer has portal access.` })
  const resend = useApiMutation(adminsApi.resendInvite, { success: (a) => `Invitation resent to ${a.email}.` })

  const copyInvite = async (a: AdminRow) => {
    if (!a.inviteToken) return
    const url = `${window.location.origin}/business-portal/accept-invite?token=${a.inviteToken}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Invitation link copied", { description: "Demo only — normally this goes by email." })
    } catch {
      toast.message("Invitation link", { description: url })
    }
  }

  const counts = (role: CompanyAdminRole) => q.data?.admins.filter((a) => a.role === role && a.status !== "deactivated").length ?? 0

  const columns: Column<AdminRow>[] = [
    {
      key: "name",
      header: "Administrator",
      sortValue: (a) => a.name,
      cell: (a) => (
        <div className="flex min-w-0 items-center gap-2">
          <PersonCell name={a.name} subtitle={a.email} color={a.avatarColor} />
          {a.isMe ? <Badge variant="outline">You</Badge> : null}
        </div>
      ),
      className: "max-w-80",
    },
    {
      key: "role",
      header: "Role",
      sortValue: (a) => a.role,
      cell: (a) => {
        const M = ROLE_META[a.role]
        return (
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <span className={cn("flex size-6 items-center justify-center rounded-md", M.tone)}>
              <M.icon className="size-3.5" />
            </span>
            {BUSINESS_ROLE_LABEL[a.role]}
          </span>
        )
      },
    },
    { key: "status", header: "Status", cell: (a) => <StatusBadge status={a.status} label={a.status === "invited" ? "Invitation sent" : undefined} />, hideOnMobile: true },
    {
      key: "signin",
      header: "Last sign-in",
      sortValue: (a) => a.lastSignInAt ?? "",
      cell: (a) => <span className="text-sm text-muted-foreground">{a.lastSignInAt ? formatRelative(a.lastSignInAt) : "Never"}</span>,
      hideOnMobile: true,
    },
    {
      key: "mfa",
      header: "2-step",
      cell: (a) =>
        a.status === "invited" ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm">
            {a.mfaMethod === "authenticator" ? <KeyRound className="size-3.5 text-emerald-600" /> : <Mail className="size-3.5 text-emerald-600" />}
            {a.mfaMethod === "authenticator" ? "App" : "Email"}
          </span>
        ),
      hideOnMobile: true,
    },
    { key: "added", header: "Added", sortValue: (a) => a.addedAt, cell: (a) => <span className="text-sm text-muted-foreground">{formatDate(a.addedAt)}</span>, hideOnMobile: true },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (a) =>
        a.isMe ? (
          <Button asChild variant="ghost" size="sm">
            <Link href="/business-portal/account">My account</Link>
          </Button>
        ) : a.role === "company_owner" ? (
          <span className="text-xs text-muted-foreground">Owner</span>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${a.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Change role</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={a.role} onValueChange={(v) => v !== a.role && setRoleChange({ admin: a, role: v as Exclude<CompanyAdminRole, "company_owner"> })}>
                <DropdownMenuRadioItem value="hr_admin">HR Admin</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="wellness_manager">Wellness Manager</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              {a.status === "invited" ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => resend.mutate({ id: a.id })}>
                    <Send /> Resend invitation
                  </DropdownMenuItem>
                  {a.inviteToken ? (
                    <DropdownMenuItem onClick={() => copyInvite(a)}>
                      <Copy /> Copy invitation link
                    </DropdownMenuItem>
                  ) : null}
                </>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/business-portal/employees/${a.id}`}>
                  <UsersRound /> View employee profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setToRemove(a)}>
                <UserMinus /> Remove administrator
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
    },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Administrators & roles"
        description="Decide who can manage HealthX for your company. Administrators never see individual health data."
        actions={
          <>
            <Button variant="outline" onClick={() => setTransferOpen(true)}>
              <Crown data-icon="inline-start" /> Transfer ownership
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <ShieldPlus data-icon="inline-start" /> Add administrator
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(ROLE_META) as CompanyAdminRole[]).map((role) => {
          const M = ROLE_META[role]
          return (
            <Card key={role} className="gap-0 py-0">
              <CardContent className="flex items-start gap-3 p-4">
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", M.tone)}>
                  <M.icon className="size-5" />
                </span>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <p className="font-heading font-semibold">{BUSINESS_ROLE_LABEL[role]}</p>
                    {q.isLoading ? <Skeleton className="h-4 w-6" /> : <span className="text-sm text-muted-foreground tabular-nums">{counts(role)}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{M.summary}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={q.data?.admins ?? []}
          getRowId={(a) => a.id}
          loading={q.isLoading}
          emptyTitle="No administrators yet"
          emptyDescription="Add an HR Admin or Wellness Manager to share the work."
        />
      )}

      <SectionCard
        title={
          <span className="inline-flex items-center gap-2">
            <UsersRound className="size-4 text-muted-foreground" /> Team Managers
          </span>
        }
        description="Team Managers see their own team's combined progress. They're assigned per team."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/business-portal/teams">Manage on Teams</Link>
          </Button>
        }
      >
        {q.isLoading ? (
          <Skeleton className="h-20" />
        ) : q.data?.teamManagers.length ? (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {q.data.teamManagers.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
                <UserAvatar name={m.name} color={m.avatarColor} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.teams.join(", ")}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No Team Managers assigned yet.</p>
        )}
      </SectionCard>

      <div className="flex items-start gap-2.5 rounded-xl border bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>Role changes are audit-logged and take effect at the person&apos;s next request. At least one Company Owner must always remain — use Transfer ownership to hand the role to someone else.</p>
      </div>

      <AddAdminDialog open={addOpen} onOpenChange={setAddOpen} />
      <TransferOwnershipDialog open={transferOpen} onOpenChange={setTransferOpen} companyName={session?.companyName ?? ""} />
      <ConfirmDialog
        open={!!roleChange}
        onOpenChange={(o) => !o && setRoleChange(null)}
        title={roleChange ? `Make ${roleChange.admin.name} ${roleChange.role === "hr_admin" ? "an HR Admin" : "a Wellness Manager"}?` : ""}
        description={roleChange ? ROLE_META[roleChange.role].summary : undefined}
        confirmLabel="Change role"
        onConfirm={() => {
          if (roleChange) changeRole.mutate({ id: roleChange.admin.id, role: roleChange.role })
          setRoleChange(null)
        }}
      />
      <ConfirmDialog
        open={!!toRemove}
        onOpenChange={(o) => !o && setToRemove(null)}
        destructive
        title={`Remove ${toRemove?.name ?? ""} as ${toRemove ? BUSINESS_ROLE_LABEL[toRemove.role] : "administrator"}?`}
        description="They'll lose access to the Business Portal at their next request. They stay an employee and keep using the HealthX app."
        confirmLabel="Remove administrator"
        onConfirm={() => {
          if (toRemove) remove.mutate({ id: toRemove.id })
          setToRemove(null)
        }}
      />
    </PageContainer>
  )
}
