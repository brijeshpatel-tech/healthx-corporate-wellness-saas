"use client"

import { Activity, Award, CalendarCheck, CheckCircle2, Clock, Flag, Pencil, RefreshCw, RotateCcw, Send, ShieldCheck, Smartphone, Trophy, UserMinus, UserX, X } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { DeactivateEmployeeDialog } from "@/components/business/people/deactivate-employee-dialog"
import { EditEmployeeSheet } from "@/components/business/people/edit-employee-sheet"
import { ConfirmDialog, KeyValueList, PrivacyNote, SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { EmptyState, ErrorState, PageSkeleton } from "@/components/common/states"
import { StatusBadge } from "@/components/common/status-badge"
import { UserAvatar } from "@/components/common/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { employeesApi, type EmployeeActivity, type EmployeeDetail } from "@/lib/api/business/employees"
import { syncApi } from "@/lib/api/business/sync"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { useSession } from "@/lib/auth/session"
import { formatDate, formatDateTime, formatNumber, formatRelative } from "@/lib/format"
import { BUSINESS_ROLE_LABEL } from "@/lib/types"
import { cn } from "@/lib/utils"

/** SCR-B-007 — Employee detail (work details, status, engagement, activity). No health data. */
export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const q = useApiQuery(["business", "employee", id], () => employeesApi.get({ id }))

  if (q.isLoading) {
    return (
      <PageContainer>
        <PageSkeleton kpis={4} />
      </PageContainer>
    )
  }
  if (q.error?.status === 404) {
    return (
      <PageContainer>
        <EmptyState
          icon={UserX}
          title="Employee not found"
          description="This person may have been removed, or the link is wrong."
          action={
            <Button asChild>
              <Link href="/business-portal/employees">Back to employees</Link>
            </Button>
          }
        />
      </PageContainer>
    )
  }
  if (q.error || !q.data) {
    return (
      <PageContainer>
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </PageContainer>
    )
  }
  return <EmployeeDetailView e={q.data} />
}

function EmployeeDetailView({ e }: { e: EmployeeDetail }) {
  const can = useCan()
  const session = useSession("business")
  const manage = can("employees.manage")
  const name = `${e.firstName} ${e.lastName}`
  const [editOpen, setEditOpen] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [revokeOpen, setRevokeOpen] = useState(false)

  const resend = useApiMutation(employeesApi.resendInvite, { success: (r) => `Invitation resent to ${r.email}.` })
  const revoke = useApiMutation(employeesApi.revokeInvite, { success: "Invitation revoked." })
  const deactivate = useApiMutation(employeesApi.deactivate, { success: "Employee deactivated – they can no longer sign in.", onSuccess: () => setDeactivateOpen(false) })
  const reactivate = useApiMutation(employeesApi.reactivate, { success: (r) => `${r.firstName} ${r.lastName} was reactivated.` })

  const isMe = session?.user.id === e.id
  const canDeactivate = manage && !isMe && e.adminRole !== "company_owner"
  const pendingInvite = e.invitation && (e.invitation.status === "pending" || e.invitation.status === "expired") && e.status === "invited"
  const inviteExpired = e.invitation?.status === "expired" || (e.invitation && new Date(e.invitation.expiresAt) < new Date() && e.status === "invited")

  return (
    <PageContainer>
      <PageHeader
        backHref="/business-portal/employees"
        backLabel="Employees"
        title={name}
        badge={<StatusBadge status={e.status} />}
        description={
          <>
            {e.jobTitle} · {e.email}
          </>
        }
        actions={
          manage ? (
            <>
              {pendingInvite && e.invitation ? (
                <Button variant="outline" onClick={() => resend.mutate({ id: e.invitation!.id })} disabled={resend.isPending}>
                  <Send data-icon="inline-start" /> Resend invitation
                </Button>
              ) : null}
              {e.status === "deactivated" ? (
                <Button variant="outline" onClick={() => reactivate.mutate({ id: e.id })} disabled={reactivate.isPending}>
                  <RotateCcw data-icon="inline-start" /> Reactivate
                </Button>
              ) : canDeactivate ? (
                <Button variant="destructive" onClick={() => setDeactivateOpen(true)}>
                  <UserMinus data-icon="inline-start" /> Deactivate
                </Button>
              ) : null}
              <Button onClick={() => setEditOpen(true)} disabled={e.status === "deactivated"}>
                <Pencil data-icon="inline-start" /> Edit
              </Button>
            </>
          ) : null
        }
      />

      {e.status === "deactivated" ? (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/5 px-4 py-3 text-sm">
          <UserX className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <p>
            <span className="font-semibold">This employee is deactivated.</span> <span className="text-muted-foreground">They can&apos;t sign in. Reactivate them to restore access — their points and history are kept.</span>
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="py-0">
            <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
              <UserAvatar name={name} color={e.avatarColor} size="xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <p className="font-heading text-lg font-bold">{name}</p>
                  <p className="text-sm text-muted-foreground">{e.jobTitle}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{e.departmentName}</Badge>
                  <Badge variant="outline">{e.teamName}</Badge>
                  {e.locationName ? <Badge variant="outline">{e.locationName}</Badge> : null}
                  {e.adminRole ? (
                    <Badge variant="secondary" className="gap-1">
                      <ShieldCheck /> {BUSINESS_ROLE_LABEL[e.adminRole]}
                    </Badge>
                  ) : null}
                  {e.appRole === "team_manager" ? <Badge variant="secondary">Team Manager</Badge> : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <SectionCard
            title="Profile & organisation"
            description="Work details only — HealthX never shows an employee's health data to their company."
            actions={
              manage && e.status !== "deactivated" ? (
                <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
                  <Pencil data-icon="inline-start" /> Edit
                </Button>
              ) : undefined
            }
          >
            <KeyValueList
              items={[
                { label: "Employee ID", value: <span className="font-mono">{e.employeeCode}</span> },
                { label: "Work email", value: e.email },
                { label: "Department", value: e.departmentName },
                { label: "Team", value: e.teamName },
                {
                  label: "Team Manager",
                  value: e.managers.length ? (
                    <span className="flex flex-wrap gap-2">
                      {e.managers.map((m) => (
                        <span key={m.id} className="inline-flex items-center gap-1.5">
                          <UserAvatar name={m.name} color={m.avatarColor} size="xs" />
                          {m.name}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{e.appRole === "team_manager" ? "Manages this team" : "Not assigned"}</span>
                  ),
                },
                { label: "Location", value: e.locationName ?? <span className="text-muted-foreground">Not set</span> },
                { label: "Role in the app", value: e.appRole === "team_manager" ? "Team Manager" : "Employee" },
                { label: "Mobile number", value: e.phone ?? <span className="text-muted-foreground">Not added</span> },
              ]}
            />
          </SectionCard>

          <SectionCard title="Participation" description="Non-health participation only. Steps, sleep, water, workouts, points history and wellness score stay private to the employee.">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MiniStat icon={Trophy} tone="text-violet-600 bg-violet-500/12 dark:text-violet-400" label="Challenges joined" value={formatNumber(e.engagement.challengesJoined)} hint={`${e.engagement.activeChallenges} taking part now`} />
              <MiniStat icon={Flag} tone="text-emerald-600 bg-emerald-500/12 dark:text-emerald-400" label="Challenges completed" value={formatNumber(e.engagement.challengesCompleted)} />
              <MiniStat icon={Award} tone="text-sky-600 bg-sky-500/12 dark:text-sky-400" label="Badges earned" value={formatNumber(e.engagement.badgesEarned)} />
              <MiniStat icon={Activity} tone="text-amber-600 bg-amber-500/14 dark:text-amber-400" label="Last active" value={daysAgoLabel(e.engagement.lastActiveAt)} hint={e.engagement.lastActiveAt ? formatDateTime(e.engagement.lastActiveAt) : undefined} />
            </div>
            {e.joinedAt ? (
              <div className="mt-6 space-y-2">
                <p className="text-sm font-medium">Challenges</p>
                {e.challenges.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">Hasn&apos;t joined a challenge yet.</p>
                ) : (
                  <ul className="grid gap-2 md:grid-cols-2">
                    {e.challenges.slice(0, 8).map((c) => (
                      <li key={c.id}>
                        <Link href={`/business-portal/challenges/${c.id}`} className="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/50">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-base" style={{ backgroundColor: `${c.coverColor}22` }}>
                            {c.coverEmoji}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{c.name}</p>
                            <p className="text-xs text-muted-foreground">Joined {formatDate(c.joinedAt, "d MMM")}</p>
                          </div>
                          {c.completed ? <StatusBadge status="completed" /> : <StatusBadge status={c.status} label={c.status === "active" ? "Taking part" : undefined} tone={c.status === "active" ? "blue" : undefined} />}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">Participation appears once {e.firstName} joins HealthX.</p>
            )}
          </SectionCard>
        </div>

        <div className="flex flex-col gap-6">
          <SectionCard title="Status & invitation">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <StatusBadge status={e.status} />
              </div>
              <Timeline
                items={[
                  { icon: Send, label: "Invited", value: formatDate(e.invitedAt) },
                  { icon: CalendarCheck, label: "Joined", value: e.joinedAt ? formatDate(e.joinedAt) : "Not yet" },
                  { icon: Clock, label: "Last active", value: e.lastActiveAt ? formatRelative(e.lastActiveAt) : "—" },
                ]}
              />
              {e.invitation && e.status === "invited" ? (
                <div className={cn("space-y-3 rounded-xl border p-3", inviteExpired ? "border-amber-500/30 bg-amber-500/5" : "bg-muted/30")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Invitation</span>
                    <StatusBadge status={inviteExpired ? "expired" : e.invitation.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sent {formatRelative(e.invitation.sentAt)}
                    {e.invitation.resentCount ? ` · resent ${e.invitation.resentCount}×` : ""} · {inviteExpired ? "expired" : "expires"} {formatDate(e.invitation.expiresAt)}
                  </p>
                  {manage ? (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => resend.mutate({ id: e.invitation!.id })} disabled={resend.isPending}>
                        <Send data-icon="inline-start" /> Resend
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRevokeOpen(true)}>
                        <X data-icon="inline-start" /> Revoke
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {manage && e.status !== "deactivated" && !canDeactivate ? (
                <p className="text-xs text-muted-foreground">{isMe ? "You can't deactivate your own account." : "The Company Owner can't be deactivated. Transfer ownership first."}</p>
              ) : null}
            </div>
          </SectionCard>

          <TrackerCard e={e} canRemind={manage} />

          <SectionCard title="Activity log" description="Admin changes and account events.">
            <ActivityList items={e.activity} />
          </SectionCard>
        </div>
      </div>

      <PrivacyNote>Employee details show work information, points and participation only. Individual health data (steps, sleep, water, workouts, weight, wellness score) is never visible to company administrators.</PrivacyNote>

      <EditEmployeeSheet employee={e} open={editOpen} onOpenChange={setEditOpen} />
      <DeactivateEmployeeDialog name={`${e.firstName} ${e.lastName}`} open={deactivateOpen} onOpenChange={setDeactivateOpen} pending={deactivate.isPending} onConfirm={(reason) => deactivate.mutate({ id: e.id, reason })} />
      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        destructive
        title="Revoke this invitation?"
        description={`The link sent to ${e.email} will stop working. You can invite ${e.firstName} again later.`}
        confirmLabel="Revoke invitation"
        onConfirm={() => e.invitation && revoke.mutate({ id: e.invitation.id })}
      />
    </PageContainer>
  )
}

function daysAgoLabel(iso?: string) {
  if (!iso) return "—"
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`
}

function TrackerCard({ e, canRemind }: { e: EmployeeDetail; canRemind: boolean }) {
  const remind = useApiMutation(syncApi.remind, { success: `Reminder sent to ${e.firstName}.` })
  const s = e.sync
  const stale = s.daysSinceSync !== null && s.daysSinceSync >= 3
  const needsHelp = e.status !== "invited" && (s.healthApp !== "connected" || stale || s.consent === "missing")
  return (
    <SectionCard title="Health app & consent" description="Connection status only — no health data.">
      <ul className="space-y-3 text-sm">
        <li className="flex items-center gap-3">
          <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Smartphone className="size-3.5" />
          </span>
          <span className="flex-1 text-muted-foreground">Health app</span>
          <StatusBadge
            status={s.healthApp === "connected" ? "connected" : s.healthApp === "reconnect" ? "error" : "disconnected"}
            label={s.healthApp === "connected" ? s.provider ?? "Connected" : s.healthApp === "reconnect" ? "Needs reconnect" : "Not connected"}
          />
        </li>
        <li className="flex items-center gap-3">
          <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <RefreshCw className="size-3.5" />
          </span>
          <span className="flex-1 text-muted-foreground">Last sync</span>
          <span className={cn("font-medium", stale && "text-amber-700 dark:text-amber-400")}>{s.lastSyncAt ? formatRelative(s.lastSyncAt) : "—"}</span>
        </li>
        <li className="flex items-center gap-3">
          <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <CheckCircle2 className="size-3.5" />
          </span>
          <span className="flex-1 text-muted-foreground">Health-data consent</span>
          <StatusBadge status={s.consent === "given" ? "active" : s.consent === "missing" ? "warning" : "pending"} label={s.consent === "given" ? "Given" : s.consent === "missing" ? "Missing" : "After joining"} />
        </li>
      </ul>
      {needsHelp && canRemind ? (
        <Button size="sm" variant="outline" className="mt-4 w-full" onClick={() => remind.mutate({ ids: [e.id] })} disabled={remind.isPending}>
          <Send data-icon="inline-start" /> Send reminder
        </Button>
      ) : null}
    </SectionCard>
  )
}

function MiniStat({ icon: Icon, tone, label, value, hint }: { icon: typeof Trophy; tone: string; label: string; value: string; hint?: string }) {
  return (
    <div className="space-y-2 rounded-xl border p-3">
      <span className={cn("flex size-8 items-center justify-center rounded-lg", tone)}>
        <Icon className="size-4" />
      </span>
      <div>
        <p className="font-heading text-xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  )
}

function Timeline({ items }: { items: { icon: typeof Send; label: string; value: string }[] }) {
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-3 text-sm">
          <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <i.icon className="size-3.5" />
          </span>
          <span className="flex-1 text-muted-foreground">{i.label}</span>
          <span className="font-medium">{i.value}</span>
        </li>
      ))}
    </ul>
  )
}

const KIND_DOT: Record<EmployeeActivity["kind"], string> = {
  lifecycle: "bg-emerald-500",
  admin: "bg-sky-500",
  invitation: "bg-violet-500",
  warning: "bg-amber-500",
}

function ActivityList({ items }: { items: EmployeeActivity[] }) {
  const [showAll, setShowAll] = useState(false)
  if (!items.length) return <p className="text-sm text-muted-foreground">No activity yet.</p>
  const visible = showAll ? items : items.slice(0, 6)
  return (
    <div className="space-y-3">
      <ol className="relative space-y-4 border-l pl-4">
        {visible.map((a) => (
          <li key={a.id} className="relative">
            <span className={cn("absolute top-1.5 -left-[21px] size-2.5 rounded-full ring-4 ring-card", KIND_DOT[a.kind])} />
            <p className="text-sm font-medium">{a.title}</p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(a.at)}
              {a.actor ? ` · ${a.actor}` : ""}
            </p>
          </li>
        ))}
      </ol>
      {items.length > 6 ? (
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAll((s) => !s)}>
          {showAll ? "Show less" : `Show all ${items.length} events`}
        </Button>
      ) : null}
    </div>
  )
}
