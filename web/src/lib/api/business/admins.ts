/**
 * Business Portal — administrators & roles (SCR-B-012) and admin invitations (SCR-B-004).
 * Only the Company Owner manages administrators. Admin rights are effective at the person's next request.
 */
import type { BusinessSession } from "@/lib/auth/session"
import type { CompanyAdminRole, Employee } from "@/lib/types"
import { ApiError, audit, badRequest, endpoint, forbidden, notFound } from "../core"
import { buildBusinessSession } from "../auth"
import { inviteEmployeeInMock } from "./employees"
import { companyEmployees, requireRole, type BusinessCtx } from "./common"
import { personRef, type PersonRef } from "./organization"

export type AdminStatus = "active" | "invited" | "deactivated"

export interface AdminRow extends PersonRef {
  role: CompanyAdminRole
  status: AdminStatus
  addedAt: string
  lastSignInAt?: string
  isMe: boolean
  mfaMethod: "email" | "authenticator"
  /** Demo convenience: the accept link for pending admin invitations. */
  inviteToken?: string
  inviteExpiresAt?: string
}

export interface AdminsOverview {
  admins: AdminRow[]
  teamManagers: (PersonRef & { teams: string[] })[]
  ownerCount: number
}

export interface AddAdminInput {
  role: Exclude<CompanyAdminRole, "company_owner">
  /** Promote an existing employee… */
  employeeId?: string
  /** …or invite someone new (they are added as an employee too). */
  firstName?: string
  lastName?: string
  email?: string
  departmentId?: string
  teamId?: string
}

export interface AdminInvitation {
  token: string
  companyName: string
  email: string
  name: string
  role: CompanyAdminRole
  invitedBy: string
  expiresAt: string
}

interface AdminMeta {
  addedAt: string
  invitedBy?: string
  inviteToken?: string
  inviteExpiresAt?: string
  inviteStatus?: "pending" | "accepted" | "revoked"
}

type MetaStore = Record<string, AdminMeta>

const meta = (ctx: { extra: BusinessCtx["extra"] }) => ctx.extra<MetaStore>("biz-admin-meta", () => ({}))
const accountStore = (ctx: { extra: BusinessCtx["extra"] }) => ctx.extra<Record<string, { mfa?: { method: "email" | "authenticator" } }>>("biz-account", () => ({}))

const OWNER_ONLY: BusinessSession["role"][] = ["company_owner"]
const fullName = (e: Pick<Employee, "firstName" | "lastName">) => `${e.firstName} ${e.lastName}`
const token = () => `ADM-${Math.random().toString(36).slice(2, 8).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`
const DEMO_TOKEN = "demo"

function toAdminRow(ctx: BusinessCtx, e: Employee, me: string): AdminRow {
  const m = meta(ctx)[e.id]
  const pending = m?.inviteStatus === "pending"
  return {
    ...personRef(e),
    role: e.adminRole!,
    status: e.status === "deactivated" ? "deactivated" : pending || e.status === "invited" ? "invited" : "active",
    addedAt: m?.addedAt ?? e.joinedAt ?? e.invitedAt,
    lastSignInAt: pending ? undefined : e.lastActiveAt,
    isMe: e.id === me,
    mfaMethod: accountStore(ctx)[e.id]?.mfa?.method ?? "email",
    inviteToken: pending ? m?.inviteToken : undefined,
    inviteExpiresAt: pending ? m?.inviteExpiresAt : undefined,
  }
}

function findAdmin(ctx: BusinessCtx, id: string) {
  const e = ctx.db.employees.find((x) => x.id === id && x.companyId === ctx.companyId() && x.adminRole)
  if (!e) throw notFound("Administrator")
  return e
}

function issueInvite(ctx: BusinessCtx, e: Employee, invitedBy: string) {
  const store = meta(ctx)
  store[e.id] = {
    ...(store[e.id] ?? { addedAt: new Date().toISOString() }),
    invitedBy,
    inviteToken: token(),
    inviteExpiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    inviteStatus: "pending",
  }
  return store[e.id]!
}

const ROLE_LABEL: Record<CompanyAdminRole, string> = { company_owner: "Company Owner", hr_admin: "HR Admin", wellness_manager: "Wellness Manager" }

export const adminsApi = {
  list: endpoint<void, AdminsOverview, "business">("business", "GET", "/organization/admins", (_i, ctx) => {
    const session = requireRole(ctx, OWNER_ONLY)
    const employees = companyEmployees(ctx, true)
    const order: Record<CompanyAdminRole, number> = { company_owner: 0, hr_admin: 1, wellness_manager: 2 }
    const admins = employees
      .filter((e) => e.adminRole)
      .map((e) => toAdminRow(ctx, e, session.user.id))
      .sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name))
    const teamManagers = employees
      .filter((e) => e.status !== "deactivated" && ctx.db.teams.some((t) => t.managerIds.includes(e.id)))
      .map((e) => ({ ...personRef(e), teams: ctx.db.teams.filter((t) => t.managerIds.includes(e.id)).map((t) => t.name) }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return { admins, teamManagers, ownerCount: admins.filter((a) => a.role === "company_owner" && a.status !== "deactivated").length }
  }),

  /** Employees who could be made administrators. */
  candidates: endpoint<{ search?: string }, (PersonRef & { departmentName: string; status: Employee["status"] })[], "business">(
    "business",
    "GET",
    "/organization/admins/candidates",
    ({ search }, ctx) => {
      requireRole(ctx, OWNER_ONLY)
      const q = search?.trim().toLowerCase() ?? ""
      return companyEmployees(ctx)
        .filter((e) => !e.adminRole && (!q || `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) || e.email.includes(q) || e.jobTitle.toLowerCase().includes(q)))
        .sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || a.firstName.localeCompare(b.firstName))
        .slice(0, 8)
        .map((e) => ({ ...personRef(e), departmentName: ctx.db.departments.find((d) => d.id === e.departmentId)?.name ?? "—", status: e.status }))
    },
  ),

  add: endpoint<AddAdminInput, AdminRow, "business">("business", "POST", "/organization/admins", (input, ctx) => {
    const session = requireRole(ctx, OWNER_ONLY)
    if (input.role !== "hr_admin" && input.role !== "wellness_manager") throw badRequest("Choose a role.", { role: "Choose a role" })
    let e: Employee | undefined
    if (input.employeeId) {
      e = ctx.db.employees.find((x) => x.id === input.employeeId && x.companyId === ctx.companyId() && x.status !== "deactivated")
      if (!e) throw badRequest("Choose an active employee.", { employeeId: "Choose an active employee" })
    } else {
      const email = input.email?.trim().toLowerCase() ?? ""
      e = ctx.db.employees.find((x) => x.email.toLowerCase() === email && x.companyId === ctx.companyId())
      // New person: create them as an employee first (same validation as Invite Employee).
      e ??= inviteEmployeeInMock(ctx, {
        firstName: input.firstName ?? "",
        lastName: input.lastName ?? "",
        email,
        departmentId: input.departmentId ?? "",
        teamId: input.teamId ?? "",
        appRole: "employee",
        sendEmail: true,
      })
    }
    if (!e) throw notFound("Employee")
    if (e.adminRole) throw badRequest(`${fullName(e)} is already a ${ROLE_LABEL[e.adminRole]}.`, { employeeId: "Already an administrator" })
    e.adminRole = input.role
    const store = meta(ctx)
    store[e.id] = { ...(store[e.id] ?? {}), addedAt: new Date().toISOString(), invitedBy: session.user.name }
    if (e.status === "invited") issueInvite(ctx, e, session.user.name)
    audit(ctx, { action: `Granted ${ROLE_LABEL[input.role]} role`, entityType: "Administrator", entityName: fullName(e), companyId: e.companyId, severity: "warning" })
    ctx.save()
    return toAdminRow(ctx, e, session.user.id)
  }),

  changeRole: endpoint<{ id: string; role: Exclude<CompanyAdminRole, "company_owner"> }, AdminRow, "business">("business", "PATCH", "/organization/admins/:id", ({ id, role }, ctx) => {
    const session = requireRole(ctx, OWNER_ONLY)
    const e = findAdmin(ctx, id)
    if (e.id === session.user.id) throw badRequest("You can't change your own role. Transfer ownership instead.")
    if (e.adminRole === "company_owner") throw badRequest("Use 'Transfer ownership' to change the Company Owner.")
    if (role !== "hr_admin" && role !== "wellness_manager") throw badRequest("Choose a role.")
    const before = e.adminRole!
    e.adminRole = role
    audit(ctx, { action: `Changed role from ${ROLE_LABEL[before]} to ${ROLE_LABEL[role]}`, entityType: "Administrator", entityName: fullName(e), companyId: e.companyId, severity: "warning" })
    ctx.save()
    return toAdminRow(ctx, e, session.user.id)
  }),

  remove: endpoint<{ id: string }, { ok: true }, "business">("business", "DELETE", "/organization/admins/:id", ({ id }, ctx) => {
    const session = requireRole(ctx, OWNER_ONLY)
    const e = findAdmin(ctx, id)
    if (e.adminRole === "company_owner") {
      const owners = companyEmployees(ctx).filter((x) => x.adminRole === "company_owner")
      if (owners.length <= 1) throw badRequest("You can't remove the last Company Owner.")
    }
    if (e.id === session.user.id) throw badRequest("You can't remove your own administrator access.")
    const before = e.adminRole!
    e.adminRole = undefined
    const m = meta(ctx)[e.id]
    if (m) m.inviteStatus = m.inviteStatus === "pending" ? "revoked" : m.inviteStatus
    audit(ctx, { action: `Removed ${ROLE_LABEL[before]} role`, entityType: "Administrator", entityName: fullName(e), companyId: e.companyId, severity: "warning" })
    ctx.save()
    return { ok: true }
  }),

  resendInvite: endpoint<{ id: string }, AdminRow, "business">("business", "POST", "/organization/admins/:id/resend-invite", ({ id }, ctx) => {
    const session = requireRole(ctx, OWNER_ONLY)
    const e = findAdmin(ctx, id)
    if (e.status !== "invited" && meta(ctx)[e.id]?.inviteStatus !== "pending") throw badRequest("This administrator has already set up their account.")
    issueInvite(ctx, e, session.user.name)
    audit(ctx, { action: "Resent administrator invitation", entityType: "Administrator", entityName: fullName(e), companyId: e.companyId })
    ctx.save()
    return toAdminRow(ctx, e, session.user.id)
  }),

  /** Hand the Company Owner role to another active administrator or employee. */
  transferOwnership: endpoint<{ toId: string; myNewRole: Exclude<CompanyAdminRole, "company_owner">; confirmation: string }, { newOwner: string; myNewRole: CompanyAdminRole }, "business">(
    "business",
    "POST",
    "/organization/admins/transfer-ownership",
    ({ toId, myNewRole, confirmation }, ctx) => {
      const session = requireRole(ctx, OWNER_ONLY)
      const company = ctx.db.companies.find((c) => c.id === ctx.companyId())!
      if (confirmation.trim() !== company.name) throw badRequest(`Type ${company.name} exactly to confirm.`, { confirmation: `Type "${company.name}" to confirm` })
      const me = ctx.db.employees.find((x) => x.id === session.user.id)
      const target = ctx.db.employees.find((x) => x.id === toId && x.companyId === company.id)
      if (!me || me.adminRole !== "company_owner") throw forbidden()
      if (!target || target.id === me.id) throw badRequest("Choose who will become the Company Owner.", { toId: "Choose a person" })
      if (target.status !== "active" && target.status !== "registered") throw badRequest("The new owner must have an active HealthX account.", { toId: "Must have an active account" })
      const previousRole = target.adminRole
      target.adminRole = "company_owner"
      me.adminRole = myNewRole
      company.ownerName = fullName(target)
      company.ownerEmail = target.email
      const store = meta(ctx)
      store[target.id] = { ...(store[target.id] ?? {}), addedAt: new Date().toISOString(), invitedBy: session.user.name }
      audit(ctx, {
        action: `Transferred company ownership${previousRole ? ` (was ${ROLE_LABEL[previousRole]})` : ""}`,
        entityType: "Administrator",
        entityName: fullName(target),
        companyId: company.id,
        severity: "critical",
      })
      audit(ctx, { action: `Changed role from Company Owner to ${ROLE_LABEL[myNewRole]}`, entityType: "Administrator", entityName: fullName(me), companyId: company.id, severity: "critical" })
      ctx.save()
      return { newOwner: fullName(target), myNewRole }
    },
  ),

  // ─── Public: accept an admin invitation (no session) ─────────────────

  getInvitation: endpoint<{ token: string }, AdminInvitation, "business">("business", "GET", "/invitations/:token", ({ token: t }, ctx) => {
    const value = t.trim()
    if (!value) throw notFound("Invitation")
    if (value === "expired") throw new ApiError("This invitation has expired. Ask your Company Owner or HealthX to resend it.", 410, "invitation_expired")
    if (value === DEMO_TOKEN) {
      const e = ctx.db.employees.find((x) => x.adminRole === "wellness_manager")!
      const company = ctx.db.companies.find((c) => c.id === e.companyId)!
      return { token: value, companyName: company.name, email: e.email, name: fullName(e), role: "wellness_manager", invitedBy: company.ownerName, expiresAt: new Date(Date.now() + 5 * 86_400_000).toISOString() }
    }
    const store = meta(ctx)
    const entry = Object.entries(store).find(([, m]) => m.inviteToken === value)
    if (!entry) throw new ApiError("We couldn't find this invitation. Check the link in your email.", 404, "not_found")
    const [employeeId, m] = entry
    if (m.inviteStatus === "accepted") throw new ApiError("This invitation has already been used. Sign in instead.", 409, "invitation_used")
    if (m.inviteStatus === "revoked") throw new ApiError("This invitation was cancelled. Ask your Company Owner to send a new one.", 410, "invitation_revoked")
    if (m.inviteExpiresAt && new Date(m.inviteExpiresAt) < new Date()) throw new ApiError("This invitation has expired. Ask your Company Owner or HealthX to resend it.", 410, "invitation_expired")
    const e = ctx.db.employees.find((x) => x.id === employeeId)
    if (!e?.adminRole) throw new ApiError("This invitation is no longer valid.", 410, "invitation_revoked")
    const company = ctx.db.companies.find((c) => c.id === e.companyId)!
    return { token: value, companyName: company.name, email: e.email, name: fullName(e), role: e.adminRole, invitedBy: m.invitedBy ?? company.ownerName, expiresAt: m.inviteExpiresAt ?? "" }
  }),

  acceptInvitation: endpoint<{ token: string; fullName: string; password: string; acceptTerms: boolean }, BusinessSession, "business">(
    "business",
    "POST",
    "/invitations/:token/accept",
    (input, ctx) => {
      const errors: Record<string, string> = {}
      if (input.fullName.trim().split(/\s+/).length < 2) errors.fullName = "Enter your first and last name"
      if (input.password.length < 10 || !/[A-Za-z]/.test(input.password) || !/\d/.test(input.password) || !/[^A-Za-z0-9]/.test(input.password))
        errors.password = "Use at least 10 characters with letters, numbers and a symbol"
      if (!input.acceptTerms) errors.acceptTerms = "Accept the Terms of Use and Privacy Policy to continue"
      if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
      const value = input.token.trim()
      let e: Employee | undefined
      if (value === DEMO_TOKEN) e = ctx.db.employees.find((x) => x.adminRole === "wellness_manager")
      else {
        const entry = Object.entries(meta(ctx)).find(([, m]) => m.inviteToken === value && m.inviteStatus === "pending")
        if (!entry) throw new ApiError("This invitation has expired. Ask your Company Owner or HealthX to resend it.", 410, "invitation_expired")
        e = ctx.db.employees.find((x) => x.id === entry[0])
        entry[1].inviteStatus = "accepted"
      }
      if (!e) throw notFound("Invitation")
      const [first, ...rest] = input.fullName.trim().split(/\s+/)
      e.firstName = first!
      e.lastName = rest.join(" ")
      if (e.status === "invited") e.status = "registered"
      e.joinedAt = e.joinedAt ?? new Date().toISOString()
      e.lastActiveAt = new Date().toISOString()
      ctx.db.invitations.filter((i) => i.employeeId === e!.id && i.status === "pending").forEach((i) => (i.status = "accepted"))
      const accounts = ctx.extra<Record<string, { password?: string; passwordChangedAt?: string; termsAcceptedAt?: string }>>("biz-account", () => ({}))
      accounts[e.id] = { ...(accounts[e.id] ?? {}), password: input.password, passwordChangedAt: new Date().toISOString(), termsAcceptedAt: new Date().toISOString() }
      ctx.db.auditLogs.unshift({
        id: `aud_${Date.now().toString(36)}`,
        companyId: e.companyId,
        actorName: fullName(e),
        actorRole: ROLE_LABEL[e.adminRole ?? "hr_admin"],
        action: "Accepted administrator invitation",
        entityType: "Administrator",
        entityName: fullName(e),
        ip: "127.0.0.1",
        createdAt: new Date().toISOString(),
        severity: "info",
      })
      ctx.save()
      return buildBusinessSession(ctx.db, e)
    },
  ),
}
