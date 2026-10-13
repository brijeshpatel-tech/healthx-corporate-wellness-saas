"use client"

import { Building2, CheckCircle2, CircleMinus, ClipboardCopy, Link2, Lock, LockOpen, LogOut, RotateCcw, Send, TriangleAlert, UserMinus } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { KeyValueList, PrivacyNote } from "@/components/common/misc"
import { StatusBadge } from "@/components/common/status-badge"
import { ErrorState } from "@/components/common/states"
import { UserAvatar } from "@/components/common/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { DIRECTORY_ROLE_LABEL, HEALTH_PROVIDER_LABEL } from "@/lib/api/platform/directory"
import { usersApi, type CheckStatus, type UserDetail, type UserRow } from "@/lib/api/platform/users"
import { formatDate, formatDateTime, formatRelative, formatTime, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

export interface UserActionHandlers {
  canManage: boolean
  onResend: (u: UserRow) => void
  onRevoke: (u: UserRow) => void
  onDeactivate: (u: UserRow) => void
  onReactivate: (u: UserRow) => void
  onUnlock: (u: UserRow) => void
  busy?: boolean
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

const CHECK_ICON: Record<CheckStatus, { icon: typeof CheckCircle2; className: string; label: string }> = {
  pass: { icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400", label: "OK" },
  warn: { icon: TriangleAlert, className: "text-amber-600 dark:text-amber-400", label: "Needs attention" },
  na: { icon: CircleMinus, className: "text-muted-foreground", label: "Not applicable" },
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function SignInState({ u }: { u: UserDetail }) {
  if (u.locked)
    return (
      <span className="text-rose-700 dark:text-rose-400">
        <Lock className="mr-1 inline size-3.5 align-[-2px]" />
        Locked until {formatTime(u.lockedUntil)} ({u.failedSignIns} failed attempts)
      </span>
    )
  if (u.failedSignIns > 0) return <span className="text-amber-700 dark:text-amber-400">Not locked · {pluralize(u.failedSignIns, "failed attempt")}</span>
  return <span className="text-muted-foreground">Not locked</span>
}

/** Tracker troubleshooting checklist + "Copy steps to send". */
function Troubleshooting({ u, canManage }: { u: UserDetail; canManage: boolean }) {
  const steps = useApiMutation(usersApi.troubleshootingSteps, {
    invalidate: false,
    onSuccess: async (r) => {
      if (await copyText(r.message)) toast.success("Steps copied", { description: `Paste them into your reply to ${u.firstName}.` })
      else toast.error("Couldn't copy to the clipboard", { description: "Your browser blocked clipboard access." })
    },
  })
  const warnings = u.troubleshooting.filter((c) => c.status === "warn").length
  return (
    <Section
      title="Tracker troubleshooting"
      action={
        canManage ? (
          <Button size="sm" variant="outline" onClick={() => steps.mutate({ id: u.id })} disabled={steps.isPending}>
            <ClipboardCopy data-icon="inline-start" /> Copy steps to send
          </Button>
        ) : null
      }
    >
      <p className="text-xs text-muted-foreground">
        {warnings ? `${pluralize(warnings, "check")} need${warnings === 1 ? "s" : ""} attention.` : "Everything looks fine — if steps are still missing, ask them to tap “Sync now”."}
      </p>
      <ul className="divide-y rounded-xl border">
        {u.troubleshooting.map((c) => {
          const meta = CHECK_ICON[c.status]
          const Icon = meta.icon
          return (
            <li key={c.key} className="flex gap-3 px-3 py-2.5">
              <Icon className={cn("mt-0.5 size-4 shrink-0", meta.className)} aria-label={meta.label} />
              <div className="min-w-0 space-y-0.5">
                <div className="text-sm font-medium">{c.label}</div>
                <div className="text-xs text-muted-foreground">{c.detail}</div>
                {c.status === "warn" && c.fix ? <div className="text-xs text-foreground/80">Fix: {c.fix}</div> : null}
              </div>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

/** Pick a published Help-centre article and copy its link (audit-logged). */
function ShareArticle({ u }: { u: UserDetail }) {
  const [articleId, setArticleId] = useState("")
  const articles = useApiQuery(["admin", "help-articles", "published"], () => usersApi.helpArticles({ status: "published" }))
  const share = useApiMutation(usersApi.shareArticle, {
    invalidate: [["admin", "users", "detail", u.id]],
    onSuccess: async (r) => {
      const url = `${window.location.origin}${r.link}`
      if (await copyText(url)) toast.success("Link copied", { description: `Send “${r.title}” to ${r.firstName}.` })
      else toast.message("Copy this link", { description: url })
    },
  })
  const groups = (articles.data ?? []).reduce<Record<string, { id: string; title: string }[]>>((acc, a) => {
    ;(acc[a.category] ??= []).push(a)
    return acc
  }, {})
  return (
    <Section title="Share a help article">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={articleId} onValueChange={setArticleId} disabled={articles.isLoading}>
          <SelectTrigger className="h-9 w-full min-w-0 sm:flex-1" aria-label="Help article">
            <SelectValue placeholder={articles.isLoading ? "Loading articles…" : articles.error ? "Couldn't load articles" : "Choose an article…"} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {Object.entries(groups).map(([category, items]) => (
              <SelectGroup key={category}>
                <SelectLabel>{category}</SelectLabel>
                {items.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.title}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => share.mutate({ id: u.id, articleId })} disabled={!articleId || share.isPending}>
          <Link2 data-icon="inline-start" /> Copy link
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Only published Help-centre articles are listed. Sharing is audit-logged.</p>
    </Section>
  )
}

/** SCR-P-006 detail drawer + #366 support tools — account, connection and consent status only, never health data. */
export function UserDetailSheet({ userId, onOpenChange, actions }: { userId: string | null; onOpenChange: (open: boolean) => void; actions: UserActionHandlers }) {
  const q = useApiQuery(["admin", "users", "detail", userId], () => usersApi.get({ id: userId! }), { enabled: !!userId, refetchOnWindowFocus: false })
  const u = q.data
  const joined = u ? u.status === "active" || u.status === "registered" || u.status === "inactive" : false

  return (
    <Sheet open={!!userId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b p-5 pr-12">
          {u ? (
            <div className="flex items-center gap-3">
              <UserAvatar name={`${u.firstName} ${u.lastName}`} color={u.avatarColor} size="lg" />
              <div className="min-w-0 space-y-1">
                <SheetTitle className="truncate text-lg font-semibold">
                  {u.firstName} {u.lastName}
                </SheetTitle>
                <SheetDescription className="truncate">{u.email}</SheetDescription>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={u.status} />
                  <Badge variant="secondary">{DIRECTORY_ROLE_LABEL[u.role]}</Badge>
                  {u.locked ? (
                    <Badge className="bg-rose-500/12 text-rose-700 dark:text-rose-300">
                      <Lock /> Sign-in locked
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <>
              <SheetTitle className="sr-only">User details</SheetTitle>
              <SheetDescription className="sr-only">Account lookup</SheetDescription>
              <div className="flex items-center gap-3">
                <Skeleton className="size-14 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-56" />
                </div>
              </div>
            </>
          )}
        </SheetHeader>

        <div className="flex-1 space-y-6 p-5">
          {q.error ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          ) : !u ? (
            <div className="space-y-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <>
              {u.locked && actions.canManage ? (
                <div className="flex flex-col gap-3 rounded-xl border border-rose-500/25 bg-rose-500/6 p-3.5 sm:flex-row sm:items-center">
                  <Lock className="size-5 shrink-0 text-rose-600 dark:text-rose-400" />
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="font-medium">Sign-in is locked after {u.failedSignIns} failed attempts</div>
                    <div className="text-xs text-muted-foreground">It unlocks automatically at {formatTime(u.lockedUntil)}. Unlock now once you&apos;ve confirmed it&apos;s really them.</div>
                  </div>
                  <Button size="sm" onClick={() => actions.onUnlock(u)} disabled={actions.busy}>
                    <LockOpen data-icon="inline-start" /> Unlock sign-in
                  </Button>
                </div>
              ) : null}

              <Section title="Account lookup">
                <KeyValueList
                  items={[
                    {
                      label: "Company",
                      value: (
                        <Link href={`/admin-portal/companies/${u.companyId}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                          <Building2 className="size-3.5" />
                          {u.companyName}
                        </Link>
                      ),
                    },
                    { label: "Employee ID", value: <span className="font-mono">{u.employeeCode}</span> },
                    { label: "Role", value: `${DIRECTORY_ROLE_LABEL[u.role]}${u.jobTitle ? ` · ${u.jobTitle}` : ""}` },
                    { label: "Company status", value: u.companyStatus === "unknown" ? "—" : <StatusBadge status={u.companyStatus} /> },
                    { label: "Phone", value: u.phone ?? "—" },
                    {
                      label: "Invitation",
                      value: u.invitation ? (
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={u.invitation.status} />
                          <span className="text-xs text-muted-foreground">
                            sent {formatDate(u.invitation.sentAt)}
                            {u.invitation.resentCount ? ` · resent ${u.invitation.resentCount}×` : ""}
                          </span>
                        </span>
                      ) : u.joinedAt ? (
                        `Accepted · joined ${formatDate(u.joinedAt)}`
                      ) : (
                        `Invited ${formatDate(u.invitedAt)}`
                      ),
                    },
                    { label: "Last sign-in", value: u.lastSignInAt ? formatRelative(u.lastSignInAt) : "Never" },
                    { label: "Active sessions", value: u.activeSessions ? pluralize(u.activeSessions, "device") : <span className="text-muted-foreground">Not signed in</span> },
                    { label: "Sign-in lock", value: <SignInState u={u} /> },
                    { label: "App version", value: u.appVersion ?? "—" },
                  ]}
                />
              </Section>

              <Separator />
              <Section title="Health app & consent">
                <KeyValueList
                  items={[
                    {
                      label: "Health app",
                      value: u.healthConnected && u.healthProvider ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                          {HEALTH_PROVIDER_LABEL[u.healthProvider]}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Not connected</span>
                      ),
                    },
                    { label: "Last sync", value: u.lastSyncAt ? `${formatRelative(u.lastSyncAt)}` : "—" },
                  ]}
                />
                {u.consents.length ? (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {u.consents.map((c) => (
                      <li key={c.key} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                        <span className="min-w-0 truncate">{c.label}</span>
                        <StatusBadge status={c.granted ? "active" : "revoked"} label={c.granted ? "Granted" : "Withdrawn"} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">{joined ? "No consent choices recorded yet." : "Consent is recorded when they join HealthX."}</p>
                )}
                <PrivacyNote>Only connection, sync and consent status is shown. HealthX staff never see an individual&apos;s steps or other health data.</PrivacyNote>
              </Section>

              <Separator />
              <Troubleshooting u={u} canManage={actions.canManage} />
              {actions.canManage ? <ShareArticle u={u} /> : null}

              <Separator />
              <Section title="Account history">
                {u.activity.length ? (
                  <ol className="space-y-3">
                    {u.activity.map((a) => (
                      <li key={a.id} className="flex gap-3 text-sm">
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/60" />
                        <div className="min-w-0">
                          <div className="font-medium">{a.action}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(a.at)} · {a.actor}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">No account changes recorded yet.</p>
                )}
              </Section>
            </>
          )}
        </div>

        {u && actions.canManage ? (
          <div className="sticky bottom-0 flex flex-wrap gap-2 border-t bg-popover p-4">
            {u.status === "invited" ? (
              <Button variant="outline" onClick={() => actions.onResend(u)} disabled={actions.busy}>
                <Send data-icon="inline-start" /> Resend invitation
              </Button>
            ) : null}
            {u.activeSessions > 0 ? (
              <Button variant="outline" onClick={() => actions.onRevoke(u)} disabled={actions.busy}>
                <LogOut data-icon="inline-start" /> Sign out of all devices
              </Button>
            ) : null}
            {u.status === "deactivated" ? (
              <Button onClick={() => actions.onReactivate(u)} disabled={actions.busy}>
                <RotateCcw data-icon="inline-start" /> Reactivate
              </Button>
            ) : (
              <Button variant="destructive" onClick={() => actions.onDeactivate(u)} disabled={actions.busy || u.role === "company_owner"} className="sm:ml-auto">
                <UserMinus data-icon="inline-start" /> Deactivate
              </Button>
            )}
            {u.role === "company_owner" && u.status !== "deactivated" ? (
              <p className="w-full text-xs text-muted-foreground">The Company Owner can&apos;t be deactivated. Change the company&apos;s owner first.</p>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
