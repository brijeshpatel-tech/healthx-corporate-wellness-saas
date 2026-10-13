"use client"

import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  Coins,
  CreditCard,
  ExternalLink,
  Gift,
  Headset,
  HeartPulse,
  Mail,
  MoreHorizontal,
  Pencil,
  Percent,
  RotateCcw,
  Save,
  Send,
  ShieldOff,
  Smartphone,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { CompanyLogo, SEGMENT_LABEL, SupportAccessDialog, SuspendCompanyDialog } from "@/components/admin/companies/company-actions"
import { ModulePicker } from "@/components/admin/module-picker"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { BarsChart, TrendChart } from "@/components/common/charts"
import { DataTable, type Column } from "@/components/common/data-table"
import { ConfirmDialog, InlineBar, KeyValueList, PrivacyNote, SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { EmptyState, ErrorState, PageSkeleton } from "@/components/common/states"
import { PersonCell } from "@/components/common/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { env } from "@/config/env"
import { businessAuthApi } from "@/lib/api/auth"
import { ApiError } from "@/lib/api/core"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { companiesApi, type CompanyDetail } from "@/lib/api/platform/companies"
import { DIRECTORY_ROLE_LABEL, type DirectoryUser } from "@/lib/api/platform/directory"
import { useAuthStore } from "@/lib/auth/session"
import { formatCompact, formatCurrency, formatDate, formatDateTime, formatNumber, formatPercent, formatRelative, formatShortDate, formatTime, titleCase } from "@/lib/format"
import type { AuditLog, Invoice, ModuleCode } from "@/lib/types"
import { cn } from "@/lib/utils"

type Tab = "overview" | "subscription" | "admins" | "usage" | "audit"

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const can = useAdminCan()
  const [tab, setTab] = useState<Tab>("overview")
  const [suspendOpen, setSuspendOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [reactivateOpen, setReactivateOpen] = useState(false)
  const detail = useApiQuery(["admin", "companies", "detail", id], () => companiesApi.get({ id }), { retry: (n, e) => e.status !== 404 && n < 2 })

  const reactivate = useApiMutation(companiesApi.reactivate, { success: (c) => `${c.name} reactivated — users can sign in again.`, errorTitle: "Couldn't update company status." })
  const resend = useApiMutation(companiesApi.resendOwnerInvite, { success: "Owner invitation resent." })
  const endSupport = useApiMutation(companiesApi.endSupport, { success: "Support session ended." })

  if (detail.isLoading) {
    return (
      <PageContainer>
        <PageSkeleton />
      </PageContainer>
    )
  }
  if (detail.error || !detail.data) {
    return (
      <PageContainer>
        <PageHeader backHref="/admin-portal/companies" backLabel="Companies" title="Company" />
        {detail.error instanceof ApiError && detail.error.status === 404 ? (
          <EmptyState
            icon={Building2}
            title="Company not found"
            description="It may have been removed, or the link is wrong."
            action={
              <Button asChild variant="outline">
                <Link href="/admin-portal/companies">Back to companies</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
        )}
      </PageContainer>
    )
  }

  const d = detail.data
  const c = d.company
  const invite = d.ownerInvitation

  return (
    <PageContainer>
      <PageHeader
        backHref="/admin-portal/companies"
        backLabel="Companies"
        title={
          <span className="flex min-w-0 items-center gap-3">
            <CompanyLogo name={c.name} initials={c.branding.logoInitials} color={c.branding.primaryColor} size="md" />
            <span className="truncate">{c.name}</span>
          </span>
        }
        badge={<StatusBadge status={c.status} />}
        description={
          <>
            {c.legalName} · <span className="font-mono">{c.companyCode}</span> · {c.industry} · {c.city}, {c.country}
          </>
        }
        actions={
          <>
            {can("companies.support") && c.status !== "suspended" && !d.supportSession ? (
              <Button variant="outline" onClick={() => setSupportOpen(true)}>
                <Headset data-icon="inline-start" /> Open as support
              </Button>
            ) : null}
            {can("companies.manage") ? (
              <Button asChild variant="outline">
                <Link href={`/admin-portal/companies/${c.id}/edit`}>
                  <Pencil data-icon="inline-start" /> Edit
                </Link>
              </Button>
            ) : null}
            {can("companies.manage") || can("companies.support") ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More actions">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {can("companies.support") ? (
                    <DropdownMenuItem disabled={invite?.status === "accepted" || c.status === "suspended" || resend.isPending} onClick={() => resend.mutate({ id: c.id })}>
                      <Send /> Resend owner invitation
                    </DropdownMenuItem>
                  ) : null}
                  {can("companies.manage") ? (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href={`/admin-portal/companies/${c.id}/edit`}>
                          <CreditCard /> Change plan
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTab("subscription")}>
                        <Smartphone /> Enable / disable modules
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {c.status === "suspended" ? (
                        <DropdownMenuItem onClick={() => setReactivateOpen(true)}>
                          <RotateCcw /> Reactivate company
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem variant="destructive" onClick={() => setSuspendOpen(true)}>
                          <ShieldOff /> Suspend company
                        </DropdownMenuItem>
                      )}
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </>
        }
      />

      {c.status === "suspended" ? (
        <Banner
          tone="rose"
          icon={ShieldOff}
          title="Suspended — users can't sign in"
          actions={
            can("companies.manage") ? (
              <Button size="sm" variant="outline" onClick={() => setReactivateOpen(true)}>
                <RotateCcw data-icon="inline-start" /> Reactivate
              </Button>
            ) : null
          }
        >
          {d.lastStatusChange?.status === "suspended" ? (
            <>
              Suspended {formatDateTime(d.lastStatusChange.at)} by {d.lastStatusChange.by}
              {d.lastStatusChange.reason ? <> — “{d.lastStatusChange.reason}”</> : null}. All data is kept.
            </>
          ) : (
            "All data is kept. Reactivate to restore access."
          )}
        </Banner>
      ) : null}

      {d.supportSession ? (
        <Banner
          tone="sky"
          icon={Headset}
          title={`Support session active until ${formatTime(d.supportSession.expiresAt)}`}
          actions={
            <>
              {env.useMock && d.businessPortalEmail ? <OpenBusinessPortalButton email={d.businessPortalEmail} /> : null}
              {can("companies.support") ? (
                <Button size="sm" variant="ghost" onClick={() => endSupport.mutate({ id: c.id })} disabled={endSupport.isPending}>
                  <X data-icon="inline-start" /> End session
                </Button>
              ) : null}
            </>
          }
        >
          Started by {d.supportSession.by} — “{d.supportSession.reason}”. Read-only access, recorded in the audit log.
        </Banner>
      ) : null}

      {invite && invite.status !== "accepted" && c.status !== "suspended" ? (
        <Banner
          tone={invite.status === "expired" ? "amber" : "emerald"}
          icon={Mail}
          title={invite.status === "expired" ? "Owner invitation expired" : "Waiting for the Company Owner to accept"}
          actions={
            can("companies.support") ? (
              <Button size="sm" variant="outline" onClick={() => resend.mutate({ id: c.id })} disabled={resend.isPending}>
                <Send data-icon="inline-start" /> Resend invitation
              </Button>
            ) : null
          }
        >
          Sent to {c.ownerEmail} {formatRelative(invite.sentAt)}
          {invite.resentCount ? ` · resent ${invite.resentCount}×` : ""} · {invite.status === "expired" ? `expired ${formatDate(invite.expiresAt)}` : `expires ${formatDate(invite.expiresAt)}`}
        </Banner>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-5">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="h-9">
            <TabsTrigger value="overview" className="px-3">
              Overview
            </TabsTrigger>
            <TabsTrigger value="subscription" className="px-3">
              Subscription & modules
            </TabsTrigger>
            <TabsTrigger value="admins" className="px-3">
              Administrators
              <span className="rounded-md bg-muted-foreground/10 px-1.5 text-[11px] font-semibold tabular-nums">{d.admins.length}</span>
            </TabsTrigger>
            <TabsTrigger value="usage" className="px-3">
              Usage
            </TabsTrigger>
            <TabsTrigger value="audit" className="px-3">
              Audit log
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="flex flex-col gap-6">
          <Overview d={d} onTab={setTab} />
        </TabsContent>
        <TabsContent value="subscription" className="flex flex-col gap-6">
          <SubscriptionTab d={d} />
        </TabsContent>
        <TabsContent value="admins" className="flex flex-col gap-6">
          <AdminsTab d={d} />
        </TabsContent>
        <TabsContent value="usage" className="flex flex-col gap-6">
          <UsageTab d={d} />
        </TabsContent>
        <TabsContent value="audit" className="flex flex-col gap-6">
          <AuditTab entries={d.audit} />
        </TabsContent>
      </Tabs>

      <SuspendCompanyDialog company={c} open={suspendOpen} onOpenChange={setSuspendOpen} />
      <SupportAccessDialog company={c} open={supportOpen} onOpenChange={setSupportOpen} onStarted={() => router.refresh()} />
      <ConfirmDialog
        open={reactivateOpen}
        onOpenChange={setReactivateOpen}
        title={`Reactivate ${c.name}?`}
        description="Employees and admins will be able to sign in again. The change is audit-logged."
        confirmLabel="Reactivate"
        onConfirm={() => reactivate.mutate({ id: c.id })}
      />
    </PageContainer>
  )
}

const BANNER_TONE = {
  rose: { box: "border-rose-500/30 bg-rose-500/6", icon: "text-rose-600 dark:text-rose-400" },
  sky: { box: "border-sky-500/30 bg-sky-500/6", icon: "text-sky-600 dark:text-sky-400" },
  amber: { box: "border-amber-500/40 bg-amber-500/8", icon: "text-amber-600 dark:text-amber-400" },
  emerald: { box: "border-primary/25 bg-primary/5", icon: "text-primary" },
}

function Banner({ tone, icon: Icon, title, children, actions }: { tone: keyof typeof BANNER_TONE; icon: typeof Mail; title: React.ReactNode; children?: React.ReactNode; actions?: React.ReactNode }) {
  const t = BANNER_TONE[tone]
  return (
    <div role="status" className={cn("flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center", t.box)}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Icon className={cn("mt-0.5 size-4.5 shrink-0", t.icon)} />
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium">{title}</p>
          {children ? <div className="text-sm text-muted-foreground">{children}</div> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2 pl-7.5 sm:pl-0">{actions}</div> : null}
    </div>
  )
}

/** Demo only: sign in to the Business Portal as this company's owner in a new tab. */
function OpenBusinessPortalButton({ email }: { email: string }) {
  const setSession = useAuthStore((s) => s.setSession)
  const [busy, setBusy] = useState(false)
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          const session = await businessAuthApi.switchDemoAccount({ email })
          setSession("business", session)
          window.open("/business-portal/dashboard", "_blank", "noopener")
        } catch (e) {
          toast.error("Couldn't open the Business Portal", { description: e instanceof Error ? e.message : undefined })
        } finally {
          setBusy(false)
        }
      }}
    >
      <ExternalLink data-icon="inline-start" /> Open Business Portal
    </Button>
  )
}

// ─── Overview ───────────────────────────────────────────────────────────

function Overview({ d, onTab }: { d: CompanyDetail; onTab: (t: Tab) => void }) {
  const c = d.company
  const u = d.usage
  const sub = d.subscription
  const owner = d.admins.find((a) => a.role === "company_owner")
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard className="h-full" label="Employees invited" value={formatNumber(u.invited)} icon={UserPlus} tone="slate" hint={sub ? `${formatNumber(sub.seats)} seats on plan` : undefined} />
        <StatCard className="h-full" label="Registered" value={formatNumber(u.registered)} icon={UserCheck} tone="sky" hint={`${formatPercent(c.adoption)} of invited`} />
        <StatCard className="h-full" label="Monthly active users" value={formatNumber(u.active)} icon={Users} tone="emerald" hint={`${formatPercent(c.activeRate)} of registered`} />
        <StatCard className="h-full" label="Wellness engagement rate" value={formatPercent(u.wellnessEngagementRate)} icon={Percent} tone="violet" hint={`${formatNumber(u.monthlyActiveWellnessParticipants)} participants`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Company profile">
          <KeyValueList
            items={[
              { label: "Legal name", value: c.legalName },
              { label: "Company code", value: <span className="font-mono">{c.companyCode}</span> },
              { label: "Industry", value: c.industry },
              { label: "Size band", value: SEGMENT_LABEL[c.segment] },
              { label: "Location", value: `${c.city}, ${c.country}` },
              { label: "Timezone", value: c.timezone },
              {
                label: "Email domains",
                value: (
                  <span className="flex flex-wrap gap-1">
                    {c.emailDomains.map((dm) => (
                      <Badge key={dm} variant="secondary" className="font-mono font-normal">
                        @{dm}
                      </Badge>
                    ))}
                  </span>
                ),
              },
              { label: "Created", value: formatDate(c.createdAt) },
              { label: "Last admin activity", value: formatRelative(c.lastActivityAt) },
              {
                label: "Branding",
                value: (
                  <span className="inline-flex items-center gap-2">
                    <span className="size-4 rounded-full ring-1 ring-border" style={{ backgroundColor: c.branding.primaryColor }} />
                    <span className="font-mono text-xs">{c.branding.primaryColor}</span>
                  </span>
                ),
              },
            ]}
          />
        </SectionCard>

        <div className="flex flex-col gap-4">
          <SectionCard
            title="Subscription"
            actions={
              <Button variant="ghost" size="sm" onClick={() => onTab("subscription")}>
                Details
              </Button>
            }
          >
            {sub ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-heading text-lg font-bold">{c.planName}</p>
                    <p className="text-xs text-muted-foreground">
                      {titleCase(sub.billingCycle)} · {sub.status === "trial" && sub.trialEndsAt ? `trial ends ${formatDate(sub.trialEndsAt)}` : `renews ${formatDate(sub.renewalDate)}`}
                    </p>
                  </div>
                  <StatusBadge status={sub.status} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Active seats</span>
                    <span className="font-medium tabular-nums">
                      {formatNumber(sub.activeSeats)} / {formatNumber(sub.seats)}
                    </span>
                  </div>
                  <InlineBar value={sub.activeSeats} max={sub.seats} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">MRR</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(sub.mrr, sub.currency)}</span>
                </div>
              </div>
            ) : (
              <EmptyState icon={CreditCard} title="No subscription" className="py-6" />
            )}
          </SectionCard>

          <SectionCard title="Company Owner">
            {owner ? (
              <div className="flex items-center justify-between gap-3">
                <PersonCell name={`${owner.firstName} ${owner.lastName}`} subtitle={owner.email} color={owner.avatarColor} />
                <StatusBadge status={owner.status} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {c.ownerName} · {c.ownerEmail}
              </p>
            )}
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Daily active employees" description="Last 30 days — employees who opened the app and logged any activity.">
        <TrendChart data={d.usage.trend} series={[{ key: "active", label: "Active employees" }]} xFormatter={(v) => formatShortDate(v)} height={220} />
      </SectionCard>
    </>
  )
}

// ─── Subscription & modules ─────────────────────────────────────────────

function SubscriptionTab({ d }: { d: CompanyDetail }) {
  const can = useAdminCan()
  const c = d.company
  const sub = d.subscription
  const plan = d.plan
  const [modules, setModules] = useState<ModuleCode[]>(c.modules)
  const [prevModules, setPrevModules] = useState(c.modules)
  if (prevModules !== c.modules) {
    setPrevModules(c.modules)
    setModules(c.modules)
  }
  const dirty = modules.length !== c.modules.length || modules.some((m) => !c.modules.includes(m))
  const save = useApiMutation(companiesApi.updateModules, { success: "Modules updated — changes show in the app within a minute." })

  const invoiceColumns: Column<Invoice>[] = [
    { key: "number", header: "Invoice", cell: (i) => <span className="font-mono text-xs">{i.number}</span> },
    { key: "period", header: "Period", cell: (i) => <span className="text-sm">{formatDate(i.periodStart, "MMM yyyy")}</span> },
    { key: "seats", header: "Seats", align: "right", cell: (i) => <span className="tabular-nums">{formatNumber(i.seats)}</span>, hideOnMobile: true },
    { key: "amount", header: "Amount", align: "right", cell: (i) => <span className="font-medium tabular-nums">{formatCurrency(i.amount + i.tax, i.currency)}</span> },
    { key: "status", header: "Status", cell: (i) => <StatusBadge status={i.status} /> },
  ]

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Subscription"
          description="Plan, seats and renewal. Prices are per active employee."
          actions={
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin-portal/subscriptions">
                  All subscriptions <ArrowUpRight data-icon="inline-end" />
                </Link>
              </Button>
              {can("companies.manage") ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin-portal/companies/${c.id}/edit`}>
                    <CreditCard data-icon="inline-start" /> Change plan
                  </Link>
                </Button>
              ) : null}
            </>
          }
        >
          {sub ? (
            <KeyValueList
              columns={3}
              items={[
                { label: "Plan", value: plan ? `${plan.name} · ${formatCurrency(plan.pricePerEmployee, plan.currency)} / employee` : "—" },
                { label: "Status", value: <StatusBadge status={sub.status} /> },
                { label: "Billing cycle", value: titleCase(sub.billingCycle) },
                { label: "Seats", value: `${formatNumber(sub.activeSeats)} active of ${formatNumber(sub.seats)}` },
                { label: "MRR", value: formatCurrency(sub.mrr, sub.currency) },
                { label: "Support level", value: plan ? titleCase(plan.supportLevel) : "—" },
                { label: "Start date", value: formatDate(sub.startDate) },
                { label: sub.status === "trial" ? "Trial ends" : "Renewal date", value: formatDate(sub.status === "trial" ? sub.trialEndsAt : sub.renewalDate) },
                { label: "Currency", value: sub.currency },
              ]}
            />
          ) : (
            <EmptyState icon={CreditCard} title="No subscription yet" description="Assign a plan from Subscriptions." className="py-8" />
          )}
        </SectionCard>
        <SectionCard title="Seat usage" description="Billable active employees vs seat limit.">
          {sub ? (
            <div className="space-y-4">
              <p className="font-heading text-3xl font-bold tabular-nums">
                {formatPercent(sub.seats ? sub.activeSeats / sub.seats : 0)}
                <span className="ml-1 text-sm font-normal text-muted-foreground">used</span>
              </p>
              <InlineBar value={sub.activeSeats} max={sub.seats} className="h-3" color={sub.activeSeats > sub.seats ? "var(--destructive)" : "var(--primary)"} />
              <p className="text-xs text-muted-foreground">
                {sub.activeSeats > sub.seats ? "Over the seat limit — consider increasing seats." : `${formatNumber(Math.max(0, sub.seats - sub.activeSeats))} seats free.`}
              </p>
            </div>
          ) : null}
        </SectionCard>
      </div>

      <SectionCard
        title="Modules"
        description={plan ? `Switch features on or off for this company. Only modules in the ${plan.name} plan can be enabled.` : "Modules available to this company."}
        actions={
          can("companies.manage") && dirty ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setModules(c.modules)}>
                Discard
              </Button>
              <Button size="sm" onClick={() => save.mutate({ id: c.id, modules })} disabled={save.isPending || modules.length === 0}>
                <Save data-icon="inline-start" /> Save modules
              </Button>
            </>
          ) : undefined
        }
      >
        <ModulePicker value={modules} onChange={setModules} available={plan?.modules ?? c.modules} disabled={!can("companies.manage")} />
        {modules.length === 0 ? <p className="mt-2 text-xs font-medium text-destructive">Enable at least one module.</p> : null}
      </SectionCard>

      <SectionCard
        title={
          <span className="inline-flex items-center gap-2">
            Recent invoices <PhaseBadge phase={2} />
          </span>
        }
        description="Last six billing periods (incl. 18% GST). MVP billing is offline — invoices are issued and marked paid manually."
      >
        <DataTable columns={invoiceColumns} rows={d.invoices} getRowId={(i) => i.id} emptyTitle="No invoices yet" emptyDescription="Invoices appear after the first billing period." className="shadow-none ring-0" dense />
      </SectionCard>
    </>
  )
}

// ─── Administrators ─────────────────────────────────────────────────────

function AdminsTab({ d }: { d: CompanyDetail }) {
  const columns: Column<DirectoryUser>[] = [
    { key: "name", header: "Administrator", cell: (u) => <PersonCell name={`${u.firstName} ${u.lastName}`} subtitle={u.email} color={u.avatarColor} />, className: "max-w-72" },
    {
      key: "role",
      header: "Role",
      cell: (u) => <Badge variant={u.role === "company_owner" ? "default" : "secondary"}>{DIRECTORY_ROLE_LABEL[u.role]}</Badge>,
    },
    { key: "status", header: "Status", cell: (u) => <StatusBadge status={u.status} /> },
    { key: "joined", header: "Joined", cell: (u) => <span className="text-sm text-muted-foreground">{u.joinedAt ? formatDate(u.joinedAt) : `Invited ${formatDate(u.invitedAt, "d MMM")}`}</span>, hideOnMobile: true },
    { key: "last", header: "Last sign-in", cell: (u) => <span className="text-sm text-muted-foreground">{formatRelative(u.lastSignInAt)}</span>, hideOnMobile: true },
  ]
  return (
    <>
      <DataTable
        columns={columns}
        rows={d.admins}
        getRowId={(u) => u.id}
        emptyTitle="No administrators yet"
        emptyDescription="The Company Owner appears here once invited."
        toolbar={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Company Owner, HR Admins and Wellness Managers who can sign in to the Business Portal.</p>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin-portal/users?company=${d.company.id}`}>
                All users <ArrowUpRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        }
      />
      <PrivacyNote>Company admins manage people, challenges and rewards. They only ever see combined wellness figures, never an individual&apos;s health data.</PrivacyNote>
    </>
  )
}

// ─── Usage ──────────────────────────────────────────────────────────────

function UsageTab({ d }: { d: CompanyDetail }) {
  const u = d.usage
  if (u.invited === 0) {
    return <EmptyState icon={Users} title="No usage yet" description="Figures appear once the owner invites employees and they start using HealthX." />
  }
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard className="h-full" label="Monthly active wellness participants" value={formatNumber(u.monthlyActiveWellnessParticipants)} icon={HeartPulse} tone="rose" hint={`${formatPercent(u.wellnessEngagementRate)} engagement rate`} />
        <StatCard className="h-full" label="Health data connected" value={formatPercent(u.healthConnectedRate)} icon={Smartphone} tone="sky" hint="of registered employees" />
        <StatCard className="h-full" label="Active challenges" value={formatNumber(u.activeChallenges)} icon={Trophy} tone="amber" hint="running now" />
        <StatCard className="h-full" label="Points awarded" value={formatCompact(u.pointsAwarded30d)} icon={Coins} tone="amber" hint="last 30 days" />
        <StatCard className="h-full" label="Rewards redeemed" value={formatNumber(u.rewardsRedeemed30d)} icon={Gift} tone="violet" hint="last 30 days" />
        <StatCard className="h-full" label="Adoption" value={formatPercent(d.company.adoption)} icon={CalendarClock} tone="emerald" hint="registered ÷ invited" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Daily active employees" description="Last 30 days.">
          <TrendChart data={u.trend} series={[{ key: "active", label: "Active employees" }]} xFormatter={(v) => formatShortDate(v)} height={240} />
        </SectionCard>
        <SectionCard title="Module adoption" description="Share of monthly active employees using each module.">
          {u.moduleAdoption.length ? (
            <BarsChart
              data={u.moduleAdoption.map((m) => ({ name: m.label.split(" (")[0], rate: Math.round(m.rate * 100) }))}
              categoryKey="name"
              series={[{ key: "rate", label: "Active employees using it" }]}
              layout="horizontal"
              valueFormatter={(v) => `${v}%`}
              height={Math.max(200, u.moduleAdoption.length * 32)}
            />
          ) : (
            <EmptyState title="No modules enabled" className="py-8" />
          )}
        </SectionCard>
      </div>
      <PrivacyNote>Aggregated usage only. HealthX staff can&apos;t see any individual employee&apos;s steps, sleep, water or other health data.</PrivacyNote>
    </>
  )
}

// ─── Audit ──────────────────────────────────────────────────────────────

function AuditTab({ entries }: { entries: AuditLog[] }) {
  const columns: Column<AuditLog>[] = [
    { key: "when", header: "Date / time", cell: (l) => <span className="text-sm whitespace-nowrap text-muted-foreground">{formatDateTime(l.createdAt)}</span>, sortValue: (l) => l.createdAt },
    {
      key: "actor",
      header: "Actor",
      cell: (l) => (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{l.actorName}</div>
          <div className="truncate text-xs text-muted-foreground">{l.actorRole}</div>
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      cell: (l) => (
        <div className="min-w-0 max-w-80">
          <div className="text-sm">{l.action}</div>
          <div className="truncate text-xs text-muted-foreground">
            {l.entityType} · {l.entityName}
          </div>
        </div>
      ),
    },
    { key: "severity", header: "Severity", cell: (l) => <StatusBadge status={l.severity} />, hideOnMobile: true },
    { key: "ip", header: "IP", cell: (l) => <span className="font-mono text-xs text-muted-foreground">{l.ip}</span>, hideOnMobile: true },
  ]
  return (
    <DataTable
      columns={columns}
      rows={entries}
      getRowId={(l) => l.id}
      clientPageSize={12}
      emptyTitle="No audit entries yet"
      emptyDescription="Actions by HealthX staff and company admins appear here."
      toolbar={
        <div className="flex w-full flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>Actions by company admins and HealthX staff for this company. Read-only.</span>
          <Link href="/admin-portal/audit-logs" className={cn("inline-flex items-center gap-1 font-medium text-primary hover:underline")}>
            Platform audit log <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      }
    />
  )
}
