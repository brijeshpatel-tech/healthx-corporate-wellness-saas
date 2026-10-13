/**
 * Business Portal — organisation structure (SCR-B-010 Departments, SCR-B-011 Teams & Team Members)
 * plus lookups shared by many screens (filters, pickers).
 */
import type { BusinessSession } from "@/lib/auth/session"
import type { Department, Employee, EmployeeStatus, Location, Team } from "@/lib/types"
import { audit, badRequest, endpoint, newId, notFound } from "../core"
import { companyEmployees, requireRole, type BusinessCtx } from "./common"

export interface OrgLookups {
  departments: (Department & { employeeCount: number })[]
  teams: (Team & { employeeCount: number; departmentName: string })[]
  locations: Location[]
}

export interface PersonRef {
  id: string
  name: string
  email: string
  jobTitle: string
  avatarColor: string
}

export interface PickerPerson extends PersonRef {
  departmentId: string
  teamId: string
  departmentName: string
  teamName: string
  status: EmployeeStatus
}

export interface DepartmentRow extends Department {
  employeeCount: number
  activeCount: number
  teamCount: number
  head?: PersonRef
  locationName?: string
}

export interface DepartmentInput {
  name: string
  description?: string
  headEmployeeId?: string
  locationId?: string
}

export interface TeamRow extends Team {
  departmentName: string
  memberCount: number
  activeCount: number
  managers: PersonRef[]
}

export interface TeamInput {
  name: string
  departmentId: string
  description?: string
  managerIds?: string[]
}

export interface TeamMember extends PersonRef {
  status: EmployeeStatus
  isManager: boolean
  lastActiveAt?: string
}

const ORG_ROLES: BusinessSession["role"][] = ["company_owner", "hr_admin"]

export const personRef = (e: Employee): PersonRef => ({
  id: e.id,
  name: `${e.firstName} ${e.lastName}`,
  email: e.email,
  jobTitle: e.jobTitle,
  avatarColor: e.avatarColor,
})

function findDepartment(ctx: BusinessCtx, id: string) {
  const d = ctx.db.departments.find((x) => x.id === id && x.companyId === ctx.companyId())
  if (!d) throw notFound("Department")
  return d
}

function findTeam(ctx: BusinessCtx, id: string) {
  const t = ctx.db.teams.find((x) => x.id === id && x.companyId === ctx.companyId())
  if (!t) throw notFound("Team")
  return t
}

function toDepartmentRow(ctx: BusinessCtx, d: Department, employees: Employee[]): DepartmentRow {
  const members = employees.filter((e) => e.departmentId === d.id)
  const head = d.headEmployeeId ? ctx.db.employees.find((e) => e.id === d.headEmployeeId) : undefined
  return {
    ...d,
    employeeCount: members.length,
    activeCount: members.filter((e) => e.status === "active").length,
    teamCount: ctx.db.teams.filter((t) => t.departmentId === d.id).length,
    head: head ? personRef(head) : undefined,
    locationName: d.locationId ? ctx.db.locations.find((l) => l.id === d.locationId)?.name : undefined,
  }
}

function toTeamRow(ctx: BusinessCtx, t: Team, employees: Employee[]): TeamRow {
  const members = employees.filter((e) => e.teamId === t.id)
  return {
    ...t,
    departmentName: ctx.db.departments.find((d) => d.id === t.departmentId)?.name ?? "—",
    memberCount: members.length,
    activeCount: members.filter((e) => e.status === "active").length,
    managers: t.managerIds.map((id) => ctx.db.employees.find((e) => e.id === id)).filter((e): e is Employee => !!e).map(personRef),
  }
}

/** Keep `appRole` in step with team-manager assignments. */
function syncManagerRoles(ctx: BusinessCtx, employeeIds: string[]) {
  for (const id of employeeIds) {
    const e = ctx.db.employees.find((x) => x.id === id)
    if (!e) continue
    const managesAny = ctx.db.teams.some((t) => t.managerIds.includes(e.id))
    e.appRole = managesAny ? "team_manager" : "employee"
  }
}

function validateDepartment(ctx: BusinessCtx, input: DepartmentInput, id?: string) {
  const errors: Record<string, string> = {}
  const name = input.name.trim()
  if (name.length < 2) errors.name = "Enter a department name"
  else if (name.length > 60) errors.name = "Keep it under 60 characters"
  else if (ctx.db.departments.some((d) => d.companyId === ctx.companyId() && d.id !== id && d.name.toLowerCase() === name.toLowerCase())) errors.name = "A department with this name already exists"
  if (input.headEmployeeId && !companyEmployees(ctx).some((e) => e.id === input.headEmployeeId)) errors.headEmployeeId = "Choose an active employee"
  if (input.locationId && !ctx.db.locations.some((l) => l.id === input.locationId && l.companyId === ctx.companyId())) errors.locationId = "Choose a location"
  if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
}

function validateTeam(ctx: BusinessCtx, input: TeamInput, id?: string) {
  const errors: Record<string, string> = {}
  const name = input.name.trim()
  if (!ctx.db.departments.some((d) => d.id === input.departmentId && d.companyId === ctx.companyId())) errors.departmentId = "Choose a department"
  if (name.length < 2) errors.name = "Enter a team name"
  else if (name.length > 60) errors.name = "Keep it under 60 characters"
  else if (ctx.db.teams.some((t) => t.companyId === ctx.companyId() && t.id !== id && t.departmentId === input.departmentId && t.name.toLowerCase() === name.toLowerCase()))
    errors.name = "This department already has a team with this name"
  if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
}

export const organizationApi = {
  lookups: endpoint<void, OrgLookups, "business">("business", "GET", "/organization/lookups", (_i, ctx) => {
    const companyId = ctx.companyId()
    const employees = ctx.db.employees.filter((e) => e.companyId === companyId && e.status !== "deactivated")
    const departments = ctx.db.departments.filter((d) => d.companyId === companyId)
    return {
      departments: departments.map((d) => ({ ...d, employeeCount: employees.filter((e) => e.departmentId === d.id).length })),
      teams: ctx.db.teams
        .filter((t) => t.companyId === companyId)
        .map((t) => ({ ...t, employeeCount: employees.filter((e) => e.teamId === t.id).length, departmentName: departments.find((d) => d.id === t.departmentId)?.name ?? "" })),
      locations: ctx.db.locations.filter((l) => l.companyId === companyId),
    }
  }),

  /** Lightweight people list for pickers (no health data). */
  people: endpoint<{ departmentId?: string; teamId?: string }, PickerPerson[], "business">("business", "GET", "/organization/people", (q, ctx) => {
    requireRole(ctx, ORG_ROLES)
    return companyEmployees(ctx)
      .filter((e) => (!q.departmentId || e.departmentId === q.departmentId) && (!q.teamId || e.teamId === q.teamId))
      .map((e) => ({
        ...personRef(e),
        departmentId: e.departmentId,
        teamId: e.teamId,
        status: e.status,
        departmentName: ctx.db.departments.find((d) => d.id === e.departmentId)?.name ?? "—",
        teamName: ctx.db.teams.find((t) => t.id === e.teamId)?.name ?? "No team",
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }),

  // ─── Departments ────────────────────────────────────────────────────

  departments: endpoint<void, DepartmentRow[], "business">("business", "GET", "/organization/departments", (_i, ctx) => {
    requireRole(ctx, ORG_ROLES)
    const employees = companyEmployees(ctx)
    return ctx.db.departments
      .filter((d) => d.companyId === ctx.companyId())
      .map((d) => toDepartmentRow(ctx, d, employees))
      .sort((a, b) => a.name.localeCompare(b.name))
  }),

  createDepartment: endpoint<DepartmentInput, DepartmentRow, "business">("business", "POST", "/organization/departments", (input, ctx) => {
    requireRole(ctx, ORG_ROLES)
    validateDepartment(ctx, input)
    const d: Department = {
      id: newId("dep"),
      companyId: ctx.companyId(),
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      headEmployeeId: input.headEmployeeId || undefined,
      locationId: input.locationId || undefined,
      createdAt: new Date().toISOString(),
    }
    ctx.db.departments.push(d)
    audit(ctx, { action: "Created department", entityType: "Department", entityName: d.name, companyId: d.companyId })
    ctx.save()
    return toDepartmentRow(ctx, d, companyEmployees(ctx))
  }),

  updateDepartment: endpoint<DepartmentInput & { id: string }, DepartmentRow, "business">("business", "PATCH", "/organization/departments/:id", (input, ctx) => {
    requireRole(ctx, ORG_ROLES)
    const d = findDepartment(ctx, input.id)
    validateDepartment(ctx, input, d.id)
    const before = d.name
    d.name = input.name.trim()
    d.description = input.description?.trim() || undefined
    d.headEmployeeId = input.headEmployeeId || undefined
    d.locationId = input.locationId || undefined
    audit(ctx, { action: before === d.name ? "Updated department" : `Renamed department (was ${before})`, entityType: "Department", entityName: d.name, companyId: d.companyId })
    ctx.save()
    return toDepartmentRow(ctx, d, companyEmployees(ctx))
  }),

  /** Move every employee of a department into one team (used before deleting). */
  moveDepartmentMembers: endpoint<{ id: string; targetTeamId: string }, { moved: number }, "business">(
    "business",
    "POST",
    "/organization/departments/:id/move-members",
    ({ id, targetTeamId }, ctx) => {
      requireRole(ctx, ORG_ROLES)
      const d = findDepartment(ctx, id)
      const target = findTeam(ctx, targetTeamId)
      if (target.departmentId === d.id) throw badRequest("Choose a team in another department.", { targetTeamId: "Choose a team in another department" })
      const members = ctx.db.employees.filter((e) => e.companyId === ctx.companyId() && e.departmentId === d.id)
      const affectedManagers: string[] = []
      for (const e of members) {
        e.departmentId = target.departmentId
        e.teamId = target.id
        affectedManagers.push(e.id)
      }
      for (const t of ctx.db.teams.filter((x) => x.departmentId === d.id)) t.managerIds = []
      syncManagerRoles(ctx, affectedManagers)
      audit(ctx, { action: `Moved ${members.length} employees to ${target.name}`, entityType: "Department", entityName: d.name, companyId: d.companyId })
      ctx.save()
      return { moved: members.length }
    },
  ),

  deleteDepartment: endpoint<{ id: string }, { ok: true }, "business">("business", "DELETE", "/organization/departments/:id", ({ id }, ctx) => {
    requireRole(ctx, ORG_ROLES)
    const d = findDepartment(ctx, id)
    const count = ctx.db.employees.filter((e) => e.companyId === ctx.companyId() && e.departmentId === d.id && e.status !== "deactivated").length
    if (count > 0) throw badRequest(`This department still has ${count} ${count === 1 ? "employee" : "employees"}. Move them before deleting.`)
    // Deactivated people keep their history but lose the link.
    ctx.db.employees.filter((e) => e.departmentId === d.id).forEach((e) => {
      e.departmentId = ""
      e.teamId = ""
    })
    ctx.db.teams = ctx.db.teams.filter((t) => t.departmentId !== d.id)
    ctx.db.departments = ctx.db.departments.filter((x) => x.id !== d.id)
    audit(ctx, { action: "Deleted department", entityType: "Department", entityName: d.name, companyId: d.companyId, severity: "warning" })
    ctx.save()
    return { ok: true }
  }),

  // ─── Teams ──────────────────────────────────────────────────────────

  teams: endpoint<{ departmentId?: string; search?: string }, TeamRow[], "business">("business", "GET", "/organization/teams", (q, ctx) => {
    requireRole(ctx, ORG_ROLES)
    const employees = companyEmployees(ctx)
    const search = q.search?.trim().toLowerCase()
    return ctx.db.teams
      .filter((t) => t.companyId === ctx.companyId() && (!q.departmentId || t.departmentId === q.departmentId))
      .map((t) => toTeamRow(ctx, t, employees))
      .filter((t) => !search || t.name.toLowerCase().includes(search) || t.departmentName.toLowerCase().includes(search) || t.managers.some((m) => m.name.toLowerCase().includes(search)))
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName) || a.name.localeCompare(b.name))
  }),

  createTeam: endpoint<TeamInput, TeamRow, "business">("business", "POST", "/organization/teams", (input, ctx) => {
    requireRole(ctx, ORG_ROLES)
    validateTeam(ctx, input)
    const t: Team = {
      id: newId("team"),
      companyId: ctx.companyId(),
      departmentId: input.departmentId,
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      managerIds: [],
      createdAt: new Date().toISOString(),
    }
    ctx.db.teams.push(t)
    audit(ctx, { action: "Created team", entityType: "Team", entityName: t.name, companyId: t.companyId })
    ctx.save()
    return toTeamRow(ctx, t, companyEmployees(ctx))
  }),

  updateTeam: endpoint<TeamInput & { id: string }, TeamRow, "business">("business", "PATCH", "/organization/teams/:id", (input, ctx) => {
    requireRole(ctx, ORG_ROLES)
    const t = findTeam(ctx, input.id)
    validateTeam(ctx, input, t.id)
    const movedDepartment = t.departmentId !== input.departmentId
    t.name = input.name.trim()
    t.description = input.description?.trim() || undefined
    t.departmentId = input.departmentId
    if (movedDepartment) {
      // Members follow their team into the new department.
      ctx.db.employees.filter((e) => e.teamId === t.id).forEach((e) => (e.departmentId = t.departmentId))
    }
    audit(ctx, { action: movedDepartment ? "Moved team to another department" : "Updated team", entityType: "Team", entityName: t.name, companyId: t.companyId })
    ctx.save()
    return toTeamRow(ctx, t, companyEmployees(ctx))
  }),

  deleteTeam: endpoint<{ id: string }, { ok: true }, "business">("business", "DELETE", "/organization/teams/:id", ({ id }, ctx) => {
    requireRole(ctx, ORG_ROLES)
    const t = findTeam(ctx, id)
    const count = ctx.db.employees.filter((e) => e.teamId === t.id && e.status !== "deactivated").length
    if (count > 0) throw badRequest(`This team still has ${count} ${count === 1 ? "member" : "members"}. Move them to another team before deleting.`)
    const managers = [...t.managerIds]
    ctx.db.employees.filter((e) => e.teamId === t.id).forEach((e) => (e.teamId = ""))
    ctx.db.teams = ctx.db.teams.filter((x) => x.id !== t.id)
    syncManagerRoles(ctx, managers)
    audit(ctx, { action: "Deleted team", entityType: "Team", entityName: t.name, companyId: t.companyId, severity: "warning" })
    ctx.save()
    return { ok: true }
  }),

  teamMembers: endpoint<{ id: string }, TeamMember[], "business">("business", "GET", "/organization/teams/:id/members", ({ id }, ctx) => {
    requireRole(ctx, ORG_ROLES)
    const t = findTeam(ctx, id)
    return companyEmployees(ctx)
      .filter((e) => e.teamId === t.id)
      .map((e) => ({ ...personRef(e), status: e.status, isManager: t.managerIds.includes(e.id), lastActiveAt: e.lastActiveAt }))
      .sort((a, b) => Number(b.isManager) - Number(a.isManager) || a.name.localeCompare(b.name))
  }),

  /**
   * Add or remove members. Added people move into this team (and its department);
   * removed people move to `moveToTeamId`, or stay in the department without a team.
   */
  updateTeamMembers: endpoint<{ id: string; add?: string[]; remove?: string[]; moveToTeamId?: string }, { added: number; removed: number }, "business">(
    "business",
    "PUT",
    "/organization/teams/:id/members",
    ({ id, add = [], remove = [], moveToTeamId }, ctx) => {
      requireRole(ctx, ORG_ROLES)
      const t = findTeam(ctx, id)
      const target = moveToTeamId ? findTeam(ctx, moveToTeamId) : undefined
      const touched: string[] = []
      let added = 0
      let removed = 0
      for (const empId of add) {
        const e = ctx.db.employees.find((x) => x.id === empId && x.companyId === ctx.companyId())
        if (!e || e.teamId === t.id) continue
        // Leaving a team they managed
        ctx.db.teams.forEach((other) => (other.managerIds = other.id === e.teamId ? other.managerIds.filter((m) => m !== e.id) : other.managerIds))
        e.teamId = t.id
        e.departmentId = t.departmentId
        touched.push(e.id)
        added++
      }
      for (const empId of remove) {
        const e = ctx.db.employees.find((x) => x.id === empId && x.teamId === t.id)
        if (!e) continue
        t.managerIds = t.managerIds.filter((m) => m !== e.id)
        if (target) {
          e.teamId = target.id
          e.departmentId = target.departmentId
        } else e.teamId = ""
        touched.push(e.id)
        removed++
      }
      syncManagerRoles(ctx, touched)
      if (added) audit(ctx, { action: `Added ${added} ${added === 1 ? "member" : "members"} to team`, entityType: "Team", entityName: t.name, companyId: t.companyId })
      if (removed) audit(ctx, { action: `Removed ${removed} ${removed === 1 ? "member" : "members"} from team${target ? ` (moved to ${target.name})` : ""}`, entityType: "Team", entityName: t.name, companyId: t.companyId })
      ctx.save()
      return { added, removed }
    },
  ),

  /** Team Managers must be members of the team. */
  setTeamManagers: endpoint<{ id: string; managerIds: string[] }, TeamRow, "business">("business", "PUT", "/organization/teams/:id/managers", ({ id, managerIds }, ctx) => {
    requireRole(ctx, ORG_ROLES)
    const t = findTeam(ctx, id)
    const invalid = managerIds.filter((m) => !ctx.db.employees.some((e) => e.id === m && e.teamId === t.id && e.status !== "deactivated"))
    if (invalid.length) throw badRequest("Team Managers must be active members of the team.")
    if (managerIds.length > 3) throw badRequest("A team can have up to 3 Team Managers.")
    const before = [...t.managerIds]
    t.managerIds = [...new Set(managerIds)]
    syncManagerRoles(ctx, [...before, ...t.managerIds])
    audit(ctx, { action: "Updated Team Managers", entityType: "Team", entityName: t.name, companyId: t.companyId })
    ctx.save()
    return toTeamRow(ctx, t, companyEmployees(ctx))
  }),
}
