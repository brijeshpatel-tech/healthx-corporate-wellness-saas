/**
 * Business Portal — employees & invitations (SCR-B-006..009).
 * Company admins never receive individual health data: only profile, status and points/participation figures.
 */
import type { Employee, EmployeeAppRole, EmployeeStatus, ImportJob, Invitation, ListParams, Paginated } from "@/lib/types"
import { AVATAR_COLORS } from "@/lib/mock/series"
import { audit, badRequest, endpoint, matchesSearch, newId, notFound, paginate, sortBy } from "../core"
import { companyEmployees, requireRole, type BusinessCtx } from "./common"
import { syncInfo, type SyncInfo } from "./sync"

export interface EmployeeQuery extends ListParams {
  departmentId?: string
  teamId?: string
  status?: EmployeeStatus | "all"
  role?: "employee" | "team_manager" | "admin" | "all"
}

export interface EmployeeRow extends Employee {
  departmentName: string
  teamName: string
  invitation?: Pick<Invitation, "id" | "status" | "sentAt" | "expiresAt" | "resentCount">
  /** #360 — health-app connection, last sync and consent status (no health data). */
  sync: SyncInfo
}

export interface EmployeeActivity {
  id: string
  at: string
  title: string
  actor?: string
  kind: "lifecycle" | "admin" | "invitation" | "warning"
}

/**
 * Non-health participation only (client decisions #7 and #18): status, challenges joined, badges count,
 * last active. No per-employee points history is ever returned to company admins.
 */
export interface EmployeeDetail extends EmployeeRow {
  locationName?: string
  managers: { id: string; name: string; avatarColor: string }[]
  engagement: {
    challengesJoined: number
    challengesCompleted: number
    activeChallenges: number
    badgesEarned: number
    lastActiveAt?: string
  }
  challenges: { id: string; name: string; coverEmoji: string; coverColor: string; status: string; joinedAt: string; completed: boolean; endDate: string }[]
  activity: EmployeeActivity[]
  /** Kept for backwards compatibility with older screens. */
  challengesJoined: number
  badgesEarned: number
}

export interface InviteInput {
  firstName: string
  lastName: string
  email: string
  employeeCode?: string
  jobTitle?: string
  departmentId: string
  teamId: string
  locationId?: string
  appRole: EmployeeAppRole
  sendEmail?: boolean
}

export interface UpdateEmployeeInput {
  id: string
  firstName?: string
  lastName?: string
  jobTitle?: string
  phone?: string
  departmentId?: string
  teamId?: string
  locationId?: string
  appRole?: EmployeeAppRole
  employeeCode?: string
}

export type DuplicateMode = "skip" | "update"

export interface ImportPreviewRow extends InviteInput {
  row: number
}

export interface ImportUpdateRow {
  row: number
  employeeId: string
  email: string
  name: string
  changes: Partial<Pick<InviteInput, "firstName" | "lastName" | "jobTitle" | "employeeCode" | "departmentId" | "teamId">>
  summary: string
}

export interface ImportPreview {
  totalRows: number
  valid: ImportPreviewRow[]
  updates: ImportUpdateRow[]
  errors: { row: number; message: string; email?: string }[]
}

export const IMPORT_COLUMNS = ["firstName", "lastName", "email", "department", "team", "jobTitle", "employeeCode"] as const
export const REQUIRED_IMPORT_COLUMNS = ["firstName", "lastName", "email", "department", "team"] as const
export const MAX_IMPORT_ROWS = 10_000

const ADMIN_ROLES: Parameters<typeof requireRole>[1] = ["company_owner", "hr_admin"]

const fullName = (e: Pick<Employee, "firstName" | "lastName">) => `${e.firstName} ${e.lastName}`

function toRow(ctx: BusinessCtx, e: Employee): EmployeeRow {
  const inv = ctx.db.invitations.filter((i) => i.employeeId === e.id).sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0]
  return {
    ...e,
    departmentName: ctx.db.departments.find((d) => d.id === e.departmentId)?.name ?? "—",
    teamName: ctx.db.teams.find((t) => t.id === e.teamId)?.name ?? "No team",
    invitation: inv ? { id: inv.id, status: inv.status, sentAt: inv.sentAt, expiresAt: inv.expiresAt, resentCount: inv.resentCount } : undefined,
    sync: syncInfo(ctx, e),
  }
}

function findEmployee(ctx: BusinessCtx, id: string) {
  const e = ctx.db.employees.find((x) => x.id === id && x.companyId === ctx.companyId())
  if (!e) throw notFound("Employee")
  return e
}

function createInvitation(ctx: BusinessCtx, e: Employee): Invitation {
  const inv: Invitation = {
    id: newId("inv"),
    companyId: e.companyId,
    employeeId: e.id,
    email: e.email,
    token: Math.random().toString(36).slice(2, 10).toUpperCase() + Math.random().toString(36).slice(2, 10).toUpperCase(),
    status: "pending",
    sentAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    resentCount: 0,
  }
  ctx.db.invitations.push(inv)
  return inv
}

function validateInvite(ctx: BusinessCtx, input: InviteInput) {
  const errors: Record<string, string> = {}
  const email = input.email.trim().toLowerCase()
  if (!input.firstName.trim()) errors.firstName = "Enter a first name"
  if (!input.lastName.trim()) errors.lastName = "Enter a last name"
  if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "Enter a valid email address"
  else if (ctx.db.employees.some((e) => e.email.toLowerCase() === email)) errors.email = "An employee with this email already exists"
  const company = ctx.db.companies.find((c) => c.id === ctx.companyId())
  if (company && !errors.email && !company.emailDomains.some((d) => email.endsWith(`@${d}`))) errors.email = `Use a company email (${company.emailDomains.map((d) => `@${d}`).join(", ")})`
  if (input.employeeCode?.trim() && ctx.db.employees.some((e) => e.companyId === ctx.companyId() && e.employeeCode.toLowerCase() === input.employeeCode!.trim().toLowerCase()))
    errors.employeeCode = "This employee ID is already in use"
  if (!ctx.db.departments.some((d) => d.id === input.departmentId)) errors.departmentId = "Choose a department"
  const team = ctx.db.teams.find((t) => t.id === input.teamId)
  if (!team) errors.teamId = "Choose a team"
  else if (team.departmentId !== input.departmentId) errors.teamId = "This team is not in the selected department"
  return errors
}

function addEmployee(ctx: BusinessCtx, input: InviteInput, sendInvite = true): Employee {
  const companyId = ctx.companyId()
  const count = ctx.db.employees.filter((e) => e.companyId === companyId).length
  const e: Employee = {
    id: newId("emp"),
    companyId,
    employeeCode: input.employeeCode?.trim() || `NT${2000 + count}`,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    jobTitle: input.jobTitle?.trim() || "Employee",
    departmentId: input.departmentId,
    teamId: input.teamId,
    locationId: input.locationId,
    appRole: input.appRole,
    status: "invited",
    invitedAt: new Date().toISOString(),
    healthConnected: false,
    avatarColor: AVATAR_COLORS[count % AVATAR_COLORS.length]!,
    stats: { stepsToday: 0, stepsWeek: 0, stepsMonth: 0, pointsBalance: 0, pointsLifetime: 0, pointsMonth: 0, workoutsMonth: 0, activeDaysMonth: 0, badgesCount: 0, currentStreak: 0 },
  }
  ctx.db.employees.push(e)
  if (sendInvite) createInvitation(ctx, e)
  if (input.appRole === "team_manager") {
    const team = ctx.db.teams.find((t) => t.id === input.teamId)
    if (team && !team.managerIds.includes(e.id)) team.managerIds.push(e.id)
  }
  return e
}

/** Validate + create an invited employee inside another mock (e.g. adding a new administrator). */
export function inviteEmployeeInMock(ctx: BusinessCtx, input: InviteInput): Employee {
  const errors = validateInvite(ctx, input)
  if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
  const e = addEmployee(ctx, input, input.sendEmail !== false)
  audit(ctx, { action: "Invited employee", entityType: "Employee", entityName: fullName(e), companyId: e.companyId })
  return e
}

function activityFor(ctx: BusinessCtx, e: Employee): EmployeeActivity[] {
  const name = fullName(e).toLowerCase()
  const items: EmployeeActivity[] = []
  items.push({ id: `${e.id}-invited`, at: e.invitedAt, title: "Invited to HealthX", kind: "invitation" })
  for (const inv of ctx.db.invitations.filter((i) => i.employeeId === e.id)) {
    if (inv.resentCount > 0 && inv.sentAt !== e.invitedAt) items.push({ id: `${inv.id}-resent`, at: inv.sentAt, title: `Invitation resent (${inv.resentCount}×)`, kind: "invitation" })
    if (inv.status === "revoked") items.push({ id: `${inv.id}-revoked`, at: inv.sentAt, title: "Invitation revoked", kind: "warning" })
    if (inv.status === "expired") items.push({ id: `${inv.id}-expired`, at: inv.expiresAt, title: "Invitation expired", kind: "warning" })
  }
  if (e.joinedAt) items.push({ id: `${e.id}-joined`, at: e.joinedAt, title: "Joined the app and accepted the Terms", kind: "lifecycle" })
  for (const log of ctx.db.auditLogs) {
    if (log.companyId !== e.companyId || log.entityName.toLowerCase() !== name) continue
    if (log.entityType !== "Employee" && log.entityType !== "Administrator") continue
    items.push({ id: log.id, at: log.createdAt, title: log.action, actor: `${log.actorName} · ${log.actorRole}`, kind: log.severity === "info" ? "admin" : "warning" })
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40)
}

function detail(ctx: BusinessCtx, e: Employee): EmployeeDetail {
  const parts = ctx.db.participants.filter((p) => p.employeeId === e.id)
  const challenges = parts
    .map((p) => {
      const c = ctx.db.challenges.find((x) => x.id === p.challengeId)
      return c ? { id: c.id, name: c.name, coverEmoji: c.coverEmoji, coverColor: c.coverColor, status: c.status, joinedAt: p.joinedAt, completed: p.completed, endDate: c.endDate } : null
    })
    .filter((c): c is NonNullable<typeof c> => !!c)
    .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
  const team = ctx.db.teams.find((t) => t.id === e.teamId)
  return {
    ...toRow(ctx, e),
    locationName: e.locationId ? ctx.db.locations.find((l) => l.id === e.locationId)?.name : undefined,
    managers: (team?.managerIds ?? [])
      .filter((id) => id !== e.id)
      .map((id) => ctx.db.employees.find((x) => x.id === id))
      .filter((m): m is Employee => !!m)
      .map((m) => ({ id: m.id, name: fullName(m), avatarColor: m.avatarColor })),
    engagement: {
      challengesJoined: challenges.length,
      challengesCompleted: challenges.filter((c) => c.completed).length,
      activeChallenges: challenges.filter((c) => c.status === "active" && !c.completed).length,
      badgesEarned: e.stats.badgesCount,
      lastActiveAt: e.lastActiveAt,
    },
    challenges,
    activity: activityFor(ctx, e),
    challengesJoined: challenges.length,
    badgesEarned: e.stats.badgesCount,
  }
}

/** Row → InviteInput, reading either camelCase or snake_case headers. */
function readRow(raw: Record<string, string>, depts: { id: string; name: string }[], teams: { id: string; name: string; departmentId: string }[]) {
  const lower = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.toLowerCase().replace(/[\s_]/g, ""), v?.trim() ?? ""]))
  const get = (...keys: string[]) => keys.map((k) => lower[k.toLowerCase()]).find((v) => v) ?? ""
  const deptName = get("department")
  const teamName = get("team")
  const dept = depts.find((d) => d.name.toLowerCase() === deptName.toLowerCase())
  const team = teams.find((t) => t.name.toLowerCase() === teamName.toLowerCase() && (!dept || t.departmentId === dept.id))
  const input: InviteInput = {
    firstName: get("firstName", "firstname"),
    lastName: get("lastName", "lastname"),
    email: get("email", "workemail").toLowerCase(),
    jobTitle: get("jobTitle", "title"),
    employeeCode: get("employeeCode", "employeeid", "id"),
    departmentId: dept?.id ?? "",
    teamId: team?.id ?? "",
    appRole: "employee",
  }
  return { input, deptName, teamName, dept, team }
}

export const employeesApi = {
  list: endpoint<EmployeeQuery, Paginated<EmployeeRow>, "business">("business", "GET", "/organization/employees", (q, ctx) => {
    requireRole(ctx, ADMIN_ROLES)
    let list = companyEmployees(ctx, true)
    if (q.departmentId) list = list.filter((e) => e.departmentId === q.departmentId)
    if (q.teamId) list = list.filter((e) => e.teamId === q.teamId)
    if (q.status && q.status !== "all") list = list.filter((e) => e.status === q.status)
    if (q.role === "team_manager") list = list.filter((e) => e.appRole === "team_manager")
    else if (q.role === "admin") list = list.filter((e) => !!e.adminRole)
    else if (q.role === "employee") list = list.filter((e) => e.appRole === "employee" && !e.adminRole)
    list = list.filter((e) => matchesSearch(q.search, `${e.firstName} ${e.lastName}`, e.email, e.employeeCode, e.jobTitle))
    const rows = list.map((e) => toRow(ctx, e))
    const sortKey = q.sort ?? "name"
    const sorted = sortBy(
      rows,
      (r) => (sortKey === "name" ? `${r.firstName} ${r.lastName}` : sortKey === "joined" ? r.joinedAt ?? r.invitedAt : sortKey === "lastActive" ? r.lastActiveAt ?? "" : sortKey === "department" ? r.departmentName : r.status),
      q.order ?? (sortKey === "joined" || sortKey === "lastActive" ? "desc" : "asc"),
    )
    return paginate(sorted, q.page ?? 1, q.pageSize ?? 20)
  }),

  get: endpoint<{ id: string }, EmployeeDetail, "business">("business", "GET", "/organization/employees/:id", ({ id }, ctx) => {
    const session = requireRole(ctx, ADMIN_ROLES)
    const e = findEmployee(ctx, id)
    // #361 Personal-data access log — one entry per admin and employee every 30 minutes.
    const views = ctx.extra<Record<string, string>>("biz-profile-views", () => ({}))
    const key = `${session.user.id}:${e.id}`
    if (!views[key] || Date.now() - new Date(views[key]!).getTime() > 30 * 60_000) {
      views[key] = new Date().toISOString()
      audit(ctx, { action: "Viewed employee profile", entityType: "Employee", entityName: fullName(e), companyId: e.companyId })
      ctx.save()
    }
    return detail(ctx, e)
  }),

  invite: endpoint<InviteInput, EmployeeRow, "business">("business", "POST", "/organization/employees/invite", (input, ctx) => {
    requireRole(ctx, ADMIN_ROLES)
    const errors = validateInvite(ctx, input)
    if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
    const e = addEmployee(ctx, input, input.sendEmail !== false)
    audit(ctx, { action: input.sendEmail === false ? "Added employee (invite not sent)" : "Invited employee", entityType: "Employee", entityName: fullName(e), companyId: e.companyId })
    ctx.save()
    return toRow(ctx, e)
  }),

  /**
   * Validate a CSV before importing. Columns: firstName,lastName,email,department,team,jobTitle,employeeCode.
   * Existing emails are skipped, or turned into updates when `duplicateMode` is "update".
   */
  previewImport: endpoint<{ rows: Record<string, string>[]; columns?: string[]; duplicateMode?: DuplicateMode }, ImportPreview, "business">(
    "business",
    "POST",
    "/organization/employee-imports",
    ({ rows, columns, duplicateMode = "skip" }, ctx) => {
      requireRole(ctx, ADMIN_ROLES)
      if (columns) {
        const normal = columns.map((c) => c.toLowerCase().replace(/[\s_]/g, ""))
        const missing = REQUIRED_IMPORT_COLUMNS.find((c) => !normal.includes(c.toLowerCase()))
        if (missing) throw badRequest(`Missing required column: ${missing}.`)
      }
      if (rows.length === 0) throw badRequest("This file has no employee rows.")
      if (rows.length > MAX_IMPORT_ROWS) throw badRequest(`This file has ${rows.length.toLocaleString("en-IN")} rows. The limit is ${MAX_IMPORT_ROWS.toLocaleString("en-IN")} per import.`)
      const companyId = ctx.companyId()
      const depts = ctx.db.departments.filter((d) => d.companyId === companyId)
      const teams = ctx.db.teams.filter((t) => t.companyId === companyId)
      const valid: ImportPreviewRow[] = []
      const updates: ImportUpdateRow[] = []
      const errors: ImportPreview["errors"] = []
      const seen = new Set<string>()
      rows.forEach((raw, idx) => {
        const row = idx + 2 // header is row 1
        const { input, deptName, teamName, dept, team } = readRow(raw, depts, teams)
        const fail = (message: string) => errors.push({ row, message, email: input.email || undefined })
        if (!input.firstName || !input.lastName) return fail("First and last name are required")
        if (!/^\S+@\S+\.\S+$/.test(input.email)) return fail(input.email ? `Invalid email '${input.email}'` : "Email is required")
        if (seen.has(input.email)) return fail("Duplicate email in this file")
        seen.add(input.email)
        if (!dept) return fail(deptName ? `Unknown department '${deptName}'` : "Department is required")
        if (!team) return fail(teamName ? `Team '${teamName}' not found in ${dept.name}` : "Team is required")
        const existing = ctx.db.employees.find((e) => e.email.toLowerCase() === input.email)
        if (existing) {
          if (existing.companyId !== companyId) return fail("This email belongs to another organisation")
          if (duplicateMode === "skip") return fail("Already an employee — skipped")
          const changes: ImportUpdateRow["changes"] = {}
          const labels: string[] = []
          if (input.firstName !== existing.firstName) {
            changes.firstName = input.firstName
            labels.push("first name")
          }
          if (input.lastName !== existing.lastName) {
            changes.lastName = input.lastName
            labels.push("last name")
          }
          if (input.jobTitle && input.jobTitle !== existing.jobTitle) {
            changes.jobTitle = input.jobTitle
            labels.push("job title")
          }
          if (input.employeeCode && input.employeeCode !== existing.employeeCode) {
            changes.employeeCode = input.employeeCode
            labels.push("employee ID")
          }
          if (team.id !== existing.teamId) {
            changes.departmentId = dept.id
            changes.teamId = team.id
            labels.push(`team → ${team.name}`)
          }
          if (!labels.length) return fail("Already up to date — skipped")
          updates.push({ row, employeeId: existing.id, email: existing.email, name: fullName(existing), changes, summary: labels.join(", ") })
          return
        }
        const fieldErrors = validateInvite(ctx, input)
        const first = Object.values(fieldErrors)[0]
        if (first) return fail(first)
        valid.push({ ...input, row })
      })
      return { totalRows: rows.length, valid, updates, errors }
    },
  ),

  importCsv: endpoint<
    { fileName: string; employees: InviteInput[]; updates?: ImportUpdateRow[]; skipped: { row: number; message: string }[]; sendInvites?: boolean },
    ImportJob & { updatedRows: number },
    "business"
  >("business", "POST", "/organization/employee-imports/confirm", ({ fileName, employees, updates = [], skipped, sendInvites = true }, ctx) => {
    const session = requireRole(ctx, ADMIN_ROLES)
    let created = 0
    const failed: { row: number; message: string }[] = [...skipped]
    for (const input of employees) {
      // Re-validate: data may have changed since the preview.
      if (Object.keys(validateInvite(ctx, input)).length) {
        failed.push({ row: (input as ImportPreviewRow).row ?? 0, message: "Changed since preview — skipped" })
        continue
      }
      addEmployee(ctx, input, sendInvites)
      created++
    }
    let updated = 0
    for (const u of updates) {
      const e = ctx.db.employees.find((x) => x.id === u.employeeId && x.companyId === ctx.companyId())
      if (!e) continue
      Object.assign(e, u.changes)
      updated++
    }
    const job: ImportJob & { updatedRows: number } = {
      id: newId("imp"),
      companyId: ctx.companyId(),
      fileName,
      status: "completed",
      totalRows: employees.length + updates.length + skipped.length,
      createdRows: created,
      updatedRows: updated,
      skippedRows: failed.length,
      errors: failed.sort((a, b) => a.row - b.row),
      createdAt: new Date().toISOString(),
      createdBy: session.user.name,
    }
    ctx.db.importJobs.unshift(job)
    audit(ctx, { action: `Imported employees (CSV): ${created} added, ${updated} updated, ${failed.length} skipped`, entityType: "Import", entityName: fileName, companyId: job.companyId })
    ctx.save()
    return job
  }),

  importJobs: endpoint<void, (ImportJob & { updatedRows?: number })[], "business">("business", "GET", "/organization/employee-imports", (_i, ctx) => {
    requireRole(ctx, ADMIN_ROLES)
    return ctx.db.importJobs.filter((j) => j.companyId === ctx.companyId()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }),

  importErrors: endpoint<{ id: string }, { fileName: string; csv: string }, "business">("business", "GET", "/organization/employee-imports/:id/errors", ({ id }, ctx) => {
    requireRole(ctx, ADMIN_ROLES)
    const job = ctx.db.importJobs.find((j) => j.id === id && j.companyId === ctx.companyId())
    if (!job) throw notFound("Import")
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    return { fileName: `${job.fileName.replace(/\.csv$/i, "")}-errors.csv`, csv: ["Row,Reason", ...job.errors.map((e) => `${e.row},${esc(e.message)}`)].join("\n") }
  }),

  update: endpoint<UpdateEmployeeInput, EmployeeRow, "business">("business", "PATCH", "/organization/employees/:id", (input, ctx) => {
    requireRole(ctx, ADMIN_ROLES)
    const e = findEmployee(ctx, input.id)
    const errors: Record<string, string> = {}
    if (input.firstName !== undefined && !input.firstName.trim()) errors.firstName = "Enter a first name"
    if (input.lastName !== undefined && !input.lastName.trim()) errors.lastName = "Enter a last name"
    if (input.employeeCode !== undefined) {
      const code = input.employeeCode.trim()
      if (!code) errors.employeeCode = "Enter an employee ID"
      else if (ctx.db.employees.some((x) => x.id !== e.id && x.companyId === e.companyId && x.employeeCode.toLowerCase() === code.toLowerCase())) errors.employeeCode = "This employee ID is already in use"
    }
    const deptId = input.departmentId ?? e.departmentId
    if (input.departmentId !== undefined && !ctx.db.departments.some((d) => d.id === deptId && d.companyId === e.companyId)) errors.departmentId = "Choose a department"
    if (input.teamId !== undefined || input.departmentId !== undefined) {
      const team = ctx.db.teams.find((t) => t.id === (input.teamId ?? e.teamId))
      if (!team) errors.teamId = "Choose a team"
      else if (team.departmentId !== deptId) errors.teamId = "Team must belong to the selected department"
    }
    if (input.locationId && !ctx.db.locations.some((l) => l.id === input.locationId && l.companyId === e.companyId)) errors.locationId = "Choose a location"
    if (Object.keys(errors).length) throw badRequest("Couldn't save changes. Please fix the highlighted fields.", errors)

    const changed: string[] = []
    const before = { ...e }
    const { id: _id, ...patch } = input
    void _id
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue
      const value = typeof v === "string" ? v.trim() : v
      const record = e as unknown as Record<string, unknown>
      if (record[k] !== value) {
        changed.push(k)
        record[k] = k === "locationId" && !value ? undefined : value
      }
    }
    // Team Manager assignments follow the team and the role.
    if (before.teamId !== e.teamId || before.appRole !== e.appRole) {
      for (const t of ctx.db.teams) {
        if (t.id !== e.teamId) t.managerIds = t.managerIds.filter((m) => m !== e.id)
      }
      const team = ctx.db.teams.find((t) => t.id === e.teamId)
      if (team) {
        if (e.appRole === "team_manager" && !team.managerIds.includes(e.id)) team.managerIds.push(e.id)
        if (e.appRole === "employee") team.managerIds = team.managerIds.filter((m) => m !== e.id)
      }
    }
    if (changed.length) {
      const label: Record<string, string> = { firstName: "name", lastName: "name", jobTitle: "job title", phone: "phone", departmentId: "department", teamId: "team", locationId: "location", appRole: "role", employeeCode: "employee ID" }
      const what = [...new Set(changed.map((c) => label[c] ?? c))].join(", ")
      audit(ctx, { action: `Updated employee ${what}`, entityType: "Employee", entityName: fullName(e), companyId: e.companyId })
      ctx.save()
    }
    return toRow(ctx, e)
  }),

  deactivate: endpoint<{ id: string; reason?: string }, EmployeeRow, "business">("business", "POST", "/organization/employees/:id/deactivate", ({ id, reason }, ctx) => {
    const session = requireRole(ctx, ADMIN_ROLES)
    const e = findEmployee(ctx, id)
    if (e.id === session.user.id) throw badRequest("You can't deactivate your own account.")
    if (e.adminRole === "company_owner") throw badRequest("The Company Owner can't be deactivated. Transfer ownership first.")
    e.status = "deactivated"
    ctx.db.invitations.filter((i) => i.employeeId === e.id && i.status === "pending").forEach((i) => (i.status = "revoked"))
    audit(ctx, { action: reason ? `Deactivated employee (${reason})` : "Deactivated employee", entityType: "Employee", entityName: fullName(e), companyId: e.companyId, severity: "warning" })
    ctx.save()
    return toRow(ctx, e)
  }),

  reactivate: endpoint<{ id: string }, EmployeeRow, "business">("business", "POST", "/organization/employees/:id/reactivate", ({ id }, ctx) => {
    requireRole(ctx, ADMIN_ROLES)
    const e = findEmployee(ctx, id)
    e.status = e.joinedAt ? "registered" : "invited"
    if (!e.joinedAt) createInvitation(ctx, e)
    audit(ctx, { action: "Reactivated employee", entityType: "Employee", entityName: fullName(e), companyId: e.companyId })
    ctx.save()
    return toRow(ctx, e)
  }),

  resendInvite: endpoint<{ id: string }, { ok: true; email: string }, "business">("business", "POST", "/organization/invitations/:id/resend", ({ id }, ctx) => {
    requireRole(ctx, ADMIN_ROLES)
    const inv = ctx.db.invitations.find((i) => i.id === id && i.companyId === ctx.companyId())
    if (!inv) throw notFound("Invitation")
    inv.status = "pending"
    inv.resentCount++
    inv.sentAt = new Date().toISOString()
    inv.expiresAt = new Date(Date.now() + 14 * 86_400_000).toISOString()
    const e = ctx.db.employees.find((x) => x.id === inv.employeeId)
    if (e && e.status === "deactivated" && !e.joinedAt) e.status = "invited"
    audit(ctx, { action: "Resent invitation", entityType: "Employee", entityName: e ? fullName(e) : inv.email, companyId: inv.companyId })
    ctx.save()
    return { ok: true, email: inv.email }
  }),

  revokeInvite: endpoint<{ id: string }, { ok: true }, "business">("business", "POST", "/organization/invitations/:id/revoke", ({ id }, ctx) => {
    requireRole(ctx, ADMIN_ROLES)
    const inv = ctx.db.invitations.find((i) => i.id === id && i.companyId === ctx.companyId())
    if (!inv) throw notFound("Invitation")
    inv.status = "revoked"
    const e = ctx.db.employees.find((x) => x.id === inv.employeeId)
    if (e && e.status === "invited") e.status = "deactivated"
    audit(ctx, { action: "Revoked invitation", entityType: "Employee", entityName: e ? fullName(e) : inv.email, companyId: inv.companyId, severity: "warning" })
    ctx.save()
    return { ok: true }
  }),

  /** Bulk actions (Phase 2): move team, deactivate, resend invites. */
  bulk: endpoint<{ ids: string[]; action: "deactivate" | "resend_invite" | "move"; teamId?: string }, { updated: number }, "business">(
    "business",
    "POST",
    "/organization/employees/bulk",
    ({ ids, action, teamId }, ctx) => {
      const session = requireRole(ctx, ADMIN_ROLES)
      let updated = 0
      for (const id of ids) {
        const e = ctx.db.employees.find((x) => x.id === id && x.companyId === ctx.companyId())
        if (!e) continue
        if (action === "deactivate") {
          if (e.adminRole === "company_owner" || e.id === session.user.id) continue
          e.status = "deactivated"
        }
        if (action === "resend_invite") {
          const inv = ctx.db.invitations.find((i) => i.employeeId === e.id && i.status !== "accepted")
          if (!inv) continue
          inv.status = "pending"
          inv.resentCount++
          inv.sentAt = new Date().toISOString()
        }
        if (action === "move" && teamId) {
          const team = ctx.db.teams.find((t) => t.id === teamId)
          if (!team) continue
          ctx.db.teams.forEach((t) => (t.managerIds = t.id === team.id ? t.managerIds : t.managerIds.filter((m) => m !== e.id)))
          e.teamId = team.id
          e.departmentId = team.departmentId
          if (e.appRole === "team_manager" && !ctx.db.teams.some((t) => t.managerIds.includes(e.id))) e.appRole = "employee"
        }
        updated++
      }
      const label = action === "deactivate" ? "Bulk deactivated employees" : action === "resend_invite" ? "Bulk resent invitations" : "Bulk moved employees"
      audit(ctx, { action: label, entityType: "Employee", entityName: `${updated} employees`, companyId: ctx.companyId(), severity: action === "deactivate" ? "warning" : "info" })
      ctx.save()
      return { updated }
    },
  ),

  /** Non-health fields only; the export is audit-logged. */
  exportCsv: endpoint<EmployeeQuery, { fileName: string; csv: string }, "business">("business", "GET", "/organization/employees/export", (q, ctx) => {
    requireRole(ctx, ADMIN_ROLES)
    const rows = companyEmployees(ctx, true)
      .filter((e) => (!q.status || q.status === "all" || e.status === q.status) && (!q.departmentId || e.departmentId === q.departmentId) && (!q.teamId || e.teamId === q.teamId))
      .filter((e) => matchesSearch(q.search, `${e.firstName} ${e.lastName}`, e.email, e.employeeCode, e.jobTitle))
      .map((e) => toRow(ctx, e))
    const header = ["Employee ID", "First name", "Last name", "Email", "Job title", "Department", "Team", "App role", "Admin role", "Status", "Invited", "Joined", "Last active", "Health app", "Last sync", "Consent"]
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    const lines = rows.map((r) => [r.employeeCode, r.firstName, r.lastName, r.email, r.jobTitle, r.departmentName, r.teamName, r.appRole, r.adminRole ?? "", r.status, r.invitedAt.slice(0, 10), r.joinedAt?.slice(0, 10) ?? "", r.lastActiveAt?.slice(0, 10) ?? "", r.sync.healthApp.replace("_", " "), r.sync.lastSyncAt?.slice(0, 10) ?? "", r.sync.consent].map(esc).join(","))
    audit(ctx, { action: "Exported employees (CSV)", entityType: "Report", entityName: `${rows.length} employees`, companyId: ctx.companyId() })
    ctx.save()
    return { fileName: `employees-${new Date().toISOString().slice(0, 10)}.csv`, csv: [header.join(","), ...lines].join("\n") }
  }),
}

/** CSV template offered on the import screen. */
export function employeeImportTemplate(sample: { department: string; team: string; domain: string }[]) {
  const header = IMPORT_COLUMNS.join(",")
  const rows = sample.slice(0, 3).map((s, i) => [["Aarav", "Neha", "Rohan"][i], ["Gupta", "Reddy", "Bose"][i], `${["aarav.gupta", "neha.reddy", "rohan.bose"][i]}@${s.domain}`, s.department, s.team, ["Software Engineer", "Account Executive", "Designer"][i], `NT${9001 + i}`].join(","))
  return [header, ...rows].join("\n")
}
