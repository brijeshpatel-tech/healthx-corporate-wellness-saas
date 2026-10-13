/**
 * Platform Admin — Users (SCR-P-006) + Employee Support Tools (#366).
 * Platform-wide account search across every company (name, email, phone or employee ID), account lookup,
 * tracker troubleshooting, shareable help articles and sign-in unlocking.
 * Basic account, connection and consent status only — never health data.
 * Real employee records (Nimbus) are changed in db.employees / db.invitations so the change also
 * shows in the Business Portal and the Employee App.
 */
import { formatRelative, formatTime } from "@/lib/format"
import { DAY_MS, noise } from "@/lib/mock/series"
import type { CompanyStatus, EmployeeStatus, Invitation, ListParams, Paginated } from "@/lib/types"
import { audit, badRequest, endpoint, matchesSearch, newId, notFound, paginate } from "../core"
import { companyName, companyOptions, toCsv, today, requireAdmin, type AdminCtx } from "./common"
import { DIRECTORY_ROLE_LABEL, HEALTH_PROVIDER_LABEL, directoryUsers, findDirectoryUser, updateDirectoryUser, type DirectoryRole, type DirectoryUser } from "./directory"
import { helpArticleLink, helpArticles } from "./help"

/** Support filters (#366): accounts that typically need help. */
export type UserIssue = "locked" | "not_connected" | "no_sync_7d"

export interface UserQuery extends ListParams {
  companyId?: string
  role?: DirectoryRole | "all"
  status?: EmployeeStatus | "all"
  issue?: UserIssue | "all"
}

export interface UserRow extends DirectoryUser {
  companyName: string
  companyStatus: CompanyStatus | "unknown"
  /** Sign-in locked after 5 failed attempts (lock not yet expired). */
  locked: boolean
}

export type CheckStatus = "pass" | "warn" | "na"

export interface TroubleshootCheck {
  key: string
  label: string
  status: CheckStatus
  detail: string
  /** What the employee should do when the check doesn't pass. */
  fix?: string
}

export interface UserActivity {
  id: string
  at: string
  action: string
  actor: string
}

export interface UserDetail extends UserRow {
  companyCode?: string
  planName?: string
  invitation?: Pick<Invitation, "status" | "sentAt" | "expiresAt" | "resentCount">
  appVersion?: string
  troubleshooting: TroubleshootCheck[]
  activity: UserActivity[]
}

export interface HelpArticleOption {
  id: string
  title: string
  category: string
}

export interface UserListResult extends Paginated<UserRow> {
  /** Counts per status for the whole (unfiltered by status) result. */
  statusCounts: Record<EmployeeStatus, number>
}

const STATUS_ORDER: EmployeeStatus[] = ["active", "registered", "invited", "inactive", "deactivated"]

const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim()

const isLocked = (u: Pick<DirectoryUser, "failedSignIns" | "lockedUntil">) => u.failedSignIns >= 5 && !!u.lockedUntil && new Date(u.lockedUntil).getTime() > Date.now()
const syncAgeDays = (u: Pick<DirectoryUser, "lastSyncAt">) => (u.lastSyncAt ? (Date.now() - new Date(u.lastSyncAt).getTime()) / DAY_MS : Number.POSITIVE_INFINITY)
const hasJoined = (u: Pick<DirectoryUser, "status">) => u.status === "active" || u.status === "registered" || u.status === "inactive"

function matchesIssue(u: DirectoryUser, issue: UserQuery["issue"]) {
  if (!issue || issue === "all") return true
  if (issue === "locked") return isLocked(u)
  if (issue === "not_connected") return hasJoined(u) && !u.healthConnected
  return u.healthConnected && syncAgeDays(u) >= 7
}

function toRow(ctx: AdminCtx, u: DirectoryUser): UserRow {
  const company = ctx.db.companies.find((c) => c.id === u.companyId)
  return { ...u, companyName: company?.name ?? companyName(ctx, u.companyId), companyStatus: company?.status ?? "unknown", locked: isLocked(u) }
}

const check = (key: string, label: string, status: CheckStatus, detail: string, fix?: string): TroubleshootCheck => ({ key, label, status, detail, fix })

/** Tracker troubleshooting checklist (#366) from connection / consent / sync status only. */
function troubleshoot(u: DirectoryUser): { checks: TroubleshootCheck[]; appVersion?: string } {
  if (!hasJoined(u)) {
    return { checks: [check("joined", "Joined HealthX", "warn", "Hasn't signed up yet, so there's nothing to sync.", "Accept the invitation email and sign in to the HealthX app.")] }
  }
  const provider = u.healthProvider ? HEALTH_PROVIDER_LABEL[u.healthProvider] : "Apple Health or Health Connect"
  const age = syncAgeDays(u)
  const connected = u.healthConnected
  const permission = u.consents.find((c) => c.key === "wearable_connection") ?? u.consents.find((c) => c.key === "health_data")
  const outdated = noise(`app:${u.id}`, 1) < 0.18
  const appVersion = outdated ? "3.2.0" : "3.4.2"
  const needsConnection = "Connect a health app first."
  const checks: TroubleshootCheck[] = [
    connected
      ? check("connected", "Health app connected", "pass", `${provider} is connected.`)
      : check("connected", "Health app connected", "warn", "No health app is connected.", "In HealthX go to Profile → Health connections and connect Apple Health (iPhone) or Health Connect (Android)."),
    permission?.granted
      ? check("permissions", "App permissions granted", "pass", "Permission to read activity is granted.")
      : check("permissions", "App permissions granted", "warn", "Permission to read activity is off or withdrawn.", `Allow Steps, Distance and Workouts for HealthX in ${provider} permissions.`),
  ]
  if (!connected) {
    checks.push(check("sync", "Synced in the last 24 hours", "na", needsConnection), check("background", "Background refresh on", "na", needsConnection), check("account", "Correct account connected", "na", needsConnection))
  } else {
    const last = u.lastSyncAt ? `Last sync ${formatRelative(u.lastSyncAt)}.` : "Never synced."
    checks.push(
      age <= 1 ? check("sync", "Synced in the last 24 hours", "pass", last) : check("sync", "Synced in the last 24 hours", "warn", last, "Open HealthX and tap “Sync now” on the Activity screen."),
      age <= 1
        ? check("background", "Background refresh on", "pass", "Data arrives without opening the app.")
        : check("background", "Background refresh on", "warn", "Data only arrives when the app is opened.", "Turn on Background App Refresh for HealthX (iPhone) or allow background activity / unrestricted battery (Android)."),
      age < 7
        ? check("account", "Correct account connected", "pass", "Activity is arriving for this account.")
        : check("account", "Correct account connected", "warn", "No data for 7+ days — the phone may use a different health account.", `Check the phone or watch writes steps to ${provider} on the same account, then reconnect in HealthX.`),
    )
  }
  checks.push(
    outdated
      ? check("version", "App version up to date", "warn", `Using ${appVersion} — 3.4.2 is available.`, "Update HealthX from the App Store or Google Play.")
      : check("version", "App version up to date", "pass", `Using the latest version (${appVersion}).`),
  )
  return { checks, appVersion }
}

/** Message HealthX support can paste into a ticket or email. */
function troubleshootingMessage(u: DirectoryUser) {
  const fixes = troubleshoot(u)
    .checks.filter((c) => c.status === "warn" && c.fix)
    .map((c) => c.fix!)
  const steps = fixes.length ? fixes : ["Open HealthX and tap “Sync now” on the Activity screen.", "Keep Background App Refresh / background activity on for HealthX."]
  return [
    `Hi ${u.firstName},`,
    "",
    "Thanks for getting in touch. These steps should get your activity syncing again:",
    ...steps.map((f, i) => `${i + 1}. ${f}`),
    "",
    "New steps can take up to 15 minutes to appear after syncing. If anything is still missing after 24 hours, reply to this message or raise a ticket from Help centre in the app.",
    "",
    "— HealthX Support",
  ].join("\n")
}

/** Audit the support "lookup" at most once per admin per account every 10 minutes. */
function auditLookup(ctx: AdminCtx, u: DirectoryUser) {
  const me = requireAdmin(ctx)
  const name = fullName(u)
  const recent = ctx.db.auditLogs.find(
    (l) => l.action === "Looked up account (support)" && l.entityName === name && l.actorName === me.user.name && Date.now() - new Date(l.createdAt).getTime() < 10 * 60_000,
  )
  if (recent) return
  audit(ctx, { action: "Looked up account (support)", entityType: "User", entityName: name, companyId: u.companyId })
  ctx.save()
}

function filterUsers(ctx: AdminCtx, q: UserQuery, ignoreStatus = false) {
  const digits = (q.search ?? "").replace(/[^\d]/g, "")
  return directoryUsers(ctx).filter(
    (u) =>
      (!q.companyId || q.companyId === "all" || u.companyId === q.companyId) &&
      (!q.role || q.role === "all" || u.role === q.role) &&
      (ignoreStatus || !q.status || q.status === "all" || u.status === q.status) &&
      matchesIssue(u, q.issue) &&
      (matchesSearch(q.search, fullName(u), u.email, u.phone, u.employeeCode) || (digits.length >= 4 && (u.phone ?? "").replace(/[^\d]/g, "").includes(digits))),
  )
}

const sortRows = (rows: UserRow[]) =>
  [...rows].sort((a, b) => {
    const t = (b.lastSignInAt ?? "").localeCompare(a.lastSignInAt ?? "")
    return t !== 0 ? t : fullName(a).localeCompare(fullName(b))
  })

/** Latest invitation of a real employee (Nimbus). */
const latestInvitation = (ctx: AdminCtx, employeeId: string) =>
  ctx.db.invitations.filter((i) => i.employeeId === employeeId).sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0]

/** Re-sends (or creates) the pending invitation of a real employee so the Business Portal shows it too. */
function bumpInvitation(ctx: AdminCtx, u: DirectoryUser) {
  if (u.source !== "employee") return
  const now = new Date()
  const expires = new Date(now.getTime() + 14 * 86_400_000).toISOString()
  const inv = latestInvitation(ctx, u.id)
  if (inv) {
    inv.status = "pending"
    inv.resentCount++
    inv.sentAt = now.toISOString()
    inv.expiresAt = expires
  } else {
    ctx.db.invitations.push({
      id: newId("inv"),
      companyId: u.companyId,
      employeeId: u.id,
      email: u.email,
      token: Math.random().toString(36).slice(2, 10).toUpperCase() + Math.random().toString(36).slice(2, 10).toUpperCase(),
      status: "pending",
      sentAt: now.toISOString(),
      expiresAt: expires,
      resentCount: 0,
    })
  }
}

export const usersApi = {
  list: endpoint<UserQuery, UserListResult, "admin">("admin", "GET", "/platform/users", (q, ctx) => {
    requireAdmin(ctx)
    const base = filterUsers(ctx, q, true)
    const statusCounts = Object.fromEntries(STATUS_ORDER.map((s) => [s, base.filter((u) => u.status === s).length])) as Record<EmployeeStatus, number>
    const rows = sortRows(filterUsers(ctx, q).map((u) => toRow(ctx, u)))
    return { ...paginate(rows, q.page ?? 1, q.pageSize ?? 20), statusCounts }
  }),

  /** Companies for the filter (id + name). */
  companies: endpoint<void, { id: string; name: string }[], "admin">("admin", "GET", "/platform/organizations/options", (_, ctx) => {
    requireAdmin(ctx)
    return companyOptions(ctx).map((c) => ({ id: c.id, name: c.name }))
  }),

  get: endpoint<{ id: string }, UserDetail, "admin">("admin", "GET", "/platform/users/:id", ({ id }, ctx) => {
    requireAdmin(ctx)
    const u = findDirectoryUser(ctx, id)
    const company = ctx.db.companies.find((c) => c.id === u.companyId)
    const plan = company ? ctx.db.plans.find((p) => p.id === company.planId) : undefined
    const inv = u.source === "employee" ? latestInvitation(ctx, u.id) : undefined
    auditLookup(ctx, u)
    const name = fullName(u)
    const activity: UserActivity[] = ctx.db.auditLogs
      .filter((l) => l.companyId === u.companyId && (l.entityName === name || l.entityName === u.email) && (l.entityType === "User" || l.entityType === "Employee"))
      .slice(0, 6)
      .map((l) => ({ id: l.id, at: l.createdAt, action: l.action, actor: `${l.actorName} · ${l.actorRole}` }))
    const { checks, appVersion } = troubleshoot(u)
    return {
      ...toRow(ctx, u),
      companyCode: company?.companyCode,
      planName: plan?.name,
      invitation: inv ? { status: inv.status, sentAt: inv.sentAt, expiresAt: inv.expiresAt, resentCount: inv.resentCount } : undefined,
      appVersion,
      troubleshooting: checks,
      activity,
    }
  }),

  deactivate: endpoint<{ id: string; reason?: string }, UserRow, "admin">("admin", "POST", "/platform/users/:id/deactivate", ({ id, reason }, ctx) => {
    requireAdmin(ctx, "users.manage")
    const u = findDirectoryUser(ctx, id)
    if (u.status === "deactivated") throw badRequest("This user is already deactivated.")
    if (u.role === "company_owner") throw badRequest("The Company Owner can't be deactivated. Change the company's owner first.")
    const updated = updateDirectoryUser(ctx, id, { status: "deactivated", activeSessions: 0 })
    if (u.source === "employee") ctx.db.invitations.filter((i) => i.employeeId === id && i.status === "pending").forEach((i) => (i.status = "revoked"))
    audit(ctx, { action: reason ? `Deactivated user (${reason})` : "Deactivated user", entityType: "User", entityName: fullName(u), companyId: u.companyId, severity: "warning" })
    ctx.save()
    return toRow(ctx, updated)
  }),

  reactivate: endpoint<{ id: string }, UserRow, "admin">("admin", "POST", "/platform/users/:id/reactivate", ({ id }, ctx) => {
    requireAdmin(ctx, "users.manage")
    const u = findDirectoryUser(ctx, id)
    if (u.status !== "deactivated") throw badRequest("Only deactivated users can be reactivated.")
    const status: EmployeeStatus = u.joinedAt ? "registered" : "invited"
    const updated = updateDirectoryUser(ctx, id, status === "invited" ? { status, invitedAt: new Date().toISOString() } : { status })
    if (status === "invited") bumpInvitation(ctx, u)
    audit(ctx, { action: "Reactivated user", entityType: "User", entityName: fullName(u), companyId: u.companyId })
    ctx.save()
    return toRow(ctx, updated)
  }),

  resendInvitation: endpoint<{ id: string }, { email: string }, "admin">("admin", "POST", "/platform/users/:id/invitation/resend", ({ id }, ctx) => {
    requireAdmin(ctx, "users.manage")
    const u = findDirectoryUser(ctx, id)
    if (u.status !== "invited") throw badRequest("This person has already joined — there's no invitation to resend.")
    const company = ctx.db.companies.find((c) => c.id === u.companyId)
    if (company?.status === "suspended") throw badRequest("This company is suspended. Reactivate the company before resending invitations.")
    updateDirectoryUser(ctx, id, { invitedAt: new Date().toISOString() })
    bumpInvitation(ctx, u)
    audit(ctx, { action: "Resent invitation", entityType: "User", entityName: fullName(u), companyId: u.companyId })
    ctx.save()
    return { email: u.email }
  }),

  revokeSessions: endpoint<{ id: string }, UserRow, "admin">("admin", "POST", "/platform/users/:id/sessions/revoke", ({ id }, ctx) => {
    requireAdmin(ctx, "users.manage")
    const u = findDirectoryUser(ctx, id)
    if (u.activeSessions === 0) throw badRequest("This user isn't signed in on any device.")
    const updated = updateDirectoryUser(ctx, id, { activeSessions: 0 })
    audit(ctx, { action: `Signed user out of all devices (${u.activeSessions})`, entityType: "User", entityName: fullName(u), companyId: u.companyId, severity: "warning" })
    ctx.save()
    return toRow(ctx, updated)
  }),

  unlock: endpoint<{ id: string }, UserRow, "admin">("admin", "POST", "/platform/users/:id/unlock", ({ id }, ctx) => {
    requireAdmin(ctx, "users.manage")
    const u = findDirectoryUser(ctx, id)
    if (!isLocked(u) && u.failedSignIns === 0) throw badRequest("This account isn't locked.")
    const updated = updateDirectoryUser(ctx, id, { failedSignIns: 0, lockedUntil: null })
    audit(ctx, { action: `Unlocked sign-in (${u.failedSignIns} failed attempts)`, entityType: "User", entityName: fullName(u), companyId: u.companyId, severity: "warning" })
    ctx.save()
    return toRow(ctx, updated)
  }),

  /** Published Help-centre articles that can be shared with an employee. */
  helpArticles: endpoint<{ status: "published" }, HelpArticleOption[], "admin">("admin", "GET", "/platform/help/articles", (_, ctx) => {
    requireAdmin(ctx)
    return helpArticles(ctx)
      .filter((a) => a.status === "published")
      .sort((a, b) => a.category.localeCompare(b.category) || a.order - b.order)
      .map((a) => ({ id: a.id, title: a.title, category: a.category }))
  }),

  shareArticle: endpoint<{ id: string; articleId: string }, { link: string; title: string; firstName: string }, "admin">(
    "admin",
    "POST",
    "/platform/users/:id/help-articles/share",
    ({ id, articleId }, ctx) => {
      requireAdmin(ctx, "users.manage")
      const u = findDirectoryUser(ctx, id)
      const article = helpArticles(ctx).find((a) => a.id === articleId && a.status === "published")
      if (!article) throw notFound("Help article")
      audit(ctx, { action: `Shared help article “${article.title}”`, entityType: "User", entityName: fullName(u), companyId: u.companyId })
      ctx.save()
      return { link: helpArticleLink(article.id), title: article.title, firstName: u.firstName }
    },
  ),

  /** Ready-to-send troubleshooting steps for this account (audit-logged as shared). */
  troubleshootingSteps: endpoint<{ id: string }, { message: string }, "admin">("admin", "POST", "/platform/users/:id/troubleshooting/share", ({ id }, ctx) => {
    requireAdmin(ctx, "users.manage")
    const u = findDirectoryUser(ctx, id)
    audit(ctx, { action: "Shared tracker troubleshooting steps", entityType: "User", entityName: fullName(u), companyId: u.companyId })
    ctx.save()
    return { message: troubleshootingMessage(u) }
  }),

  exportCsv: endpoint<UserQuery, { fileName: string; csv: string; count: number }, "admin">("admin", "GET", "/platform/users/export", (q, ctx) => {
    requireAdmin(ctx)
    const rows = sortRows(filterUsers(ctx, q).map((u) => toRow(ctx, u)))
    const csv = toCsv(
      ["Name", "Employee ID", "Email", "Phone", "Company", "Role", "Status", "Health app", "Last sync", "Sign-in locked", "Invited", "Joined", "Last sign-in"],
      rows.map((r) => [
        fullName(r),
        r.employeeCode,
        r.email,
        r.phone ?? "",
        r.companyName,
        DIRECTORY_ROLE_LABEL[r.role],
        r.status,
        r.healthProvider ? HEALTH_PROVIDER_LABEL[r.healthProvider] : "Not connected",
        r.lastSyncAt?.slice(0, 10) ?? "",
        r.locked ? `Yes, until ${formatTime(r.lockedUntil)}` : "No",
        r.invitedAt.slice(0, 10),
        r.joinedAt?.slice(0, 10) ?? "",
        r.lastSignInAt?.slice(0, 10) ?? "",
      ]),
    )
    audit(ctx, { action: `Exported ${rows.length} users`, entityType: "User", entityName: "User directory", companyId: q.companyId && q.companyId !== "all" ? q.companyId : null })
    ctx.save()
    return { fileName: `healthx-users-${today()}.csv`, csv, count: rows.length }
  }),
}
