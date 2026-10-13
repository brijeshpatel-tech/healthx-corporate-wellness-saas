/**
 * Platform-wide user directory (basic account fields only — never health data).
 *
 * Companies with real employee records in the sample DB (Nimbus) are read from `db.employees`.
 * Every other company gets a small, deterministic set of accounts (owner, admins, a sample of
 * employees) stored in `extra["admin-directory"]`, so search and account actions work everywhere.
 */
import { DAY_MS, noise } from "@/lib/mock/series"
import type { Company, Employee, EmployeeStatus } from "@/lib/types"
import { notFound } from "../core"
import { emailFor, syntheticPerson, type AdminCtx } from "./common"

export type DirectoryRole = "company_owner" | "hr_admin" | "wellness_manager" | "team_manager" | "employee"

export const DIRECTORY_ROLE_LABEL: Record<DirectoryRole, string> = {
  company_owner: "Company Owner",
  hr_admin: "HR Admin",
  wellness_manager: "Wellness Manager",
  team_manager: "Team Manager",
  employee: "Employee",
}

export interface DirectoryUser {
  id: string
  /** "employee" = real record in db.employees; "directory" = sample account in extra storage. */
  source: "employee" | "directory"
  companyId: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  jobTitle?: string
  role: DirectoryRole
  status: EmployeeStatus
  invitedAt: string
  joinedAt?: string
  lastSignInAt?: string
  avatarColor: string
  /** Signed-in devices / sessions. */
  activeSessions: number
  /** Employee ID from the HR system (searchable). */
  employeeCode: string
  // Support lookup (connection & consent status only — never health data)
  healthConnected: boolean
  healthProvider: HealthProviderCode | null
  lastSyncAt?: string
  consents: ConsentStatus[]
  /** Failed sign-in attempts since the last success; 5 locks the account for 30 minutes. */
  failedSignIns: number
  lockedUntil?: string
}

export type HealthProviderCode = "apple_health" | "health_connect"

export interface ConsentStatus {
  key: string
  label: string
  granted: boolean
  updatedAt?: string
}

export const HEALTH_PROVIDER_LABEL: Record<HealthProviderCode, string> = { apple_health: "Apple Health", health_connect: "Health Connect" }

const CONSENT_LABELS: { key: string; label: string }[] = [
  { key: "health_data", label: "Health data" },
  { key: "wearable_connection", label: "Health app connection" },
  { key: "data_sharing", label: "Aggregated data sharing with company" },
  { key: "notifications", label: "Notifications" },
  { key: "analytics", label: "Analytics participation" },
  { key: "ai_personalisation", label: "AI personalisation" },
]

/** Deterministic connection / consent / lock state for accounts without private records. */
function supportState(key: string, status: EmployeeStatus, lastSignInAt: string | undefined, connectedHint?: boolean) {
  const joined = status === "active" || status === "registered" || status === "inactive"
  const connected = joined && (connectedHint ?? noise(key, 41) < (status === "active" ? 0.9 : 0.55))
  const stale = noise(key, 43) < 0.12 ? 8 * DAY_MS : 0
  const lastSync = connected && lastSignInAt ? new Date(new Date(lastSignInAt).getTime() - Math.floor(noise(key, 42) * 6) * 3_600_000 - stale).toISOString() : undefined
  const consentGranted = (k: string, i: number) => {
    if (k === "health_data") return true
    if (k === "wearable_connection") return connected
    return noise(key, 50 + i) < (k === "ai_personalisation" ? 0.35 : 0.85)
  }
  const consents: ConsentStatus[] = joined ? CONSENT_LABELS.map((c, i) => ({ key: c.key, label: c.label, granted: consentGranted(c.key, i), updatedAt: lastSignInAt })) : []
  let failed = 0
  if (status === "active" && noise(key, 44) < 0.03) failed = 5
  else if (noise(key, 45) < 0.08) failed = 1 + Math.floor(noise(key, 46) * 3)
  return {
    healthConnected: connected,
    healthProvider: connected ? ((noise(key, 47) < 0.55 ? "apple_health" : "health_connect") as HealthProviderCode) : null,
    lastSyncAt: lastSync,
    consents,
    failedSignIns: failed,
    lockedUntil: failed >= 5 ? new Date(Date.now() + 18 * 60_000).toISOString() : undefined,
  }
}

type Store = Record<string, DirectoryUser[]>

const store = (ctx: AdminCtx) => ctx.extra<Store>("admin-directory-v2", () => ({}))
const sessionStore = (ctx: AdminCtx) => ctx.extra<Record<string, number>>("admin-user-sessions", () => ({}))
const lockStore = (ctx: AdminCtx) => ctx.extra<Record<string, { failedSignIns: number; lockedUntil?: string }>>("admin-user-locks", () => ({}))

const hasRealEmployees = (ctx: AdminCtx, companyId: string) => ctx.db.employees.some((e) => e.companyId === companyId)

const roleOf = (e: Employee): DirectoryRole => e.adminRole ?? (e.appRole === "team_manager" ? "team_manager" : "employee")

function fromEmployee(ctx: AdminCtx, e: Employee): DirectoryUser {
  const sessions = sessionStore(ctx)[e.id]
  const joined = e.status === "active" || e.status === "registered" || e.status === "inactive"
  return {
    id: e.id,
    source: "employee",
    companyId: e.companyId,
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
    phone: e.phone,
    jobTitle: e.jobTitle,
    role: roleOf(e),
    status: e.status,
    invitedAt: e.invitedAt,
    joinedAt: e.joinedAt,
    lastSignInAt: e.lastActiveAt,
    avatarColor: e.avatarColor,
    activeSessions: sessions ?? (e.status === "active" ? 1 + Math.floor(noise(e.id, 7) * 3) : joined && e.status === "registered" ? 1 : 0),
    employeeCode: e.employeeCode,
    ...employeeSupport(ctx, e),
  }
}

/** Connection & consent status of a real employee: read from their app record when it exists. */
function employeeSupport(ctx: AdminCtx, e: Employee) {
  const base = supportState(`emp:${e.id}`, e.status, e.lastActiveAt, e.healthConnected)
  const lock = lockStore(ctx)[e.id]
  const result = { ...base, ...(lock ?? {}) }
  const priv = ctx.db.private[e.id]
  if (!priv) return result
  const conn = priv.healthConnections.find((c) => c.status === "connected")
  return {
    ...result,
    healthConnected: !!conn,
    healthProvider: conn && (conn.provider === "apple_health" || conn.provider === "health_connect") ? conn.provider : null,
    lastSyncAt: conn?.lastSyncAt,
    consents: priv.consents.map((c) => ({ key: c.key, label: CONSENT_LABELS.find((l) => l.key === c.key)?.label ?? c.title, granted: c.granted, updatedAt: c.updatedAt })),
  }
}

const TITLES: Record<DirectoryRole, string[]> = {
  company_owner: ["Chief People Officer", "Founder & CEO", "Director, HR"],
  hr_admin: ["HR Business Partner", "HR Manager", "People Operations Lead"],
  wellness_manager: ["Wellbeing Lead", "Employee Experience Manager"],
  team_manager: ["Engineering Manager", "Operations Lead", "Sales Manager", "Team Lead"],
  employee: ["Analyst", "Associate", "Executive", "Engineer", "Specialist", "Consultant", "Coordinator"],
}

/** Builds the sample accounts for one company (deterministic per company id). */
function generate(company: Company): DirectoryUser[] {
  const key = `dir:${company.id}`
  const domain = company.emailDomains[0] ?? `${company.slug}.com`
  const created = new Date(company.createdAt).getTime()
  const now = Date.now()
  const span = Math.max(1, Math.floor((now - created) / DAY_MS))
  const iso = (t: number) => new Date(Math.min(now, t)).toISOString()
  const onboarding = company.status === "onboarding"
  const roles: DirectoryRole[] = ["company_owner", "hr_admin"]
  if (company.segment !== "smb") roles.push("wellness_manager")
  roles.push("team_manager", "team_manager")
  const employeeCount = 8 + Math.floor(noise(key, 99) * 7)
  for (let i = 0; i < employeeCount; i++) roles.push("employee")

  return roles.map((role, i) => {
    const r = noise(key, i * 11)
    let status: EmployeeStatus
    if (role === "company_owner") status = onboarding ? (r < 0.5 ? "invited" : "registered") : "active"
    else if (onboarding) status = r < 0.7 ? "invited" : "registered"
    else if (role !== "employee") status = r < 0.85 ? "active" : "registered"
    else status = r < 0.62 ? "active" : r < 0.74 ? "registered" : r < 0.84 ? "inactive" : r < 0.96 ? "invited" : "deactivated"
    const p = role === "company_owner" ? null : syntheticPerson(key, i)
    const [first, ...rest] = role === "company_owner" ? company.ownerName.split(" ") : [p!.first, p!.last]
    const last = rest.join(" ") || "—"
    const invitedAt = created + Math.floor(noise(key, i * 11 + 1) * Math.min(span, 40)) * DAY_MS
    const joinedAt = status === "invited" ? undefined : invitedAt + Math.floor(1 + noise(key, i * 11 + 2) * 4) * DAY_MS
    const lastSignIn =
      status === "active" ? now - Math.floor(noise(key, i * 11 + 3) * 3 * DAY_MS) : status === "registered" ? now - (4 + Math.floor(noise(key, i * 11 + 3) * 10)) * DAY_MS : status === "inactive" ? now - (25 + Math.floor(noise(key, i * 11 + 3) * 40)) * DAY_MS : undefined
    const titles = TITLES[role]
    return {
      id: `dir_${company.id.replace(/^org_/, "")}_${i + 1}`,
      source: "directory" as const,
      companyId: company.id,
      firstName: first ?? "Owner",
      lastName: last,
      email: role === "company_owner" ? company.ownerEmail : emailFor(first ?? "user", last, domain),
      phone: noise(key, i * 11 + 4) < 0.7 ? `+91 9${String(Math.floor(100000000 + noise(key, i * 11 + 5) * 899999999))}` : undefined,
      jobTitle: titles[Math.floor(noise(key, i * 11 + 6) * titles.length)],
      role,
      status,
      invitedAt: iso(invitedAt),
      joinedAt: joinedAt ? iso(joinedAt) : undefined,
      lastSignInAt: lastSignIn ? iso(lastSignIn) : undefined,
      avatarColor: p?.color ?? company.branding.primaryColor,
      activeSessions: status === "active" ? 1 + Math.floor(noise(key, i * 11 + 8) * 3) : status === "registered" ? 1 : 0,
      employeeCode: `${company.companyCode.replace(/\d+$/, "")}${String(1001 + i)}`,
      ...supportState(`${key}:${i}`, status, lastSignIn ? iso(lastSignIn) : undefined),
    }
  })
}

function ensure(ctx: AdminCtx, company: Company): DirectoryUser[] {
  const s = store(ctx)
  if (!s[company.id]) s[company.id] = generate(company)
  // Sample accounts with 5+ failed attempts stay locked (rolling 30-minute window) until support unlocks them.
  const now = Date.now()
  for (const u of s[company.id]!) {
    if (u.failedSignIns >= 5 && (!u.lockedUntil || new Date(u.lockedUntil).getTime() <= now)) u.lockedUntil = new Date(now + 18 * 60_000).toISOString()
  }
  return s[company.id]!
}

/** All accounts of one company. */
export function companyUsers(ctx: AdminCtx, companyId: string): DirectoryUser[] {
  if (hasRealEmployees(ctx, companyId)) return ctx.db.employees.filter((e) => e.companyId === companyId).map((e) => fromEmployee(ctx, e))
  const company = ctx.db.companies.find((c) => c.id === companyId)
  return company ? ensure(ctx, company) : []
}

/** Every account across all companies. */
export function directoryUsers(ctx: AdminCtx): DirectoryUser[] {
  return ctx.db.companies.flatMap((c) => companyUsers(ctx, c.id))
}

/** Owner, HR admins and wellness managers of a company. */
export function companyAdmins(ctx: AdminCtx, companyId: string): DirectoryUser[] {
  const order: DirectoryRole[] = ["company_owner", "hr_admin", "wellness_manager"]
  return companyUsers(ctx, companyId)
    .filter((u) => order.includes(u.role))
    .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))
}

export function findDirectoryUser(ctx: AdminCtx, id: string): DirectoryUser {
  const employee = ctx.db.employees.find((e) => e.id === id)
  if (employee) return fromEmployee(ctx, employee)
  for (const list of Object.values(store(ctx))) {
    const u = list.find((x) => x.id === id)
    if (u) return u
  }
  throw notFound("User")
}

/**
 * Updates account fields (status, sessions, invitedAt, name/email for owners).
 * Real employees are changed in db.employees so the change shows in every portal.
 */
export type DirectoryPatch = Partial<Pick<DirectoryUser, "status" | "activeSessions" | "invitedAt" | "firstName" | "lastName" | "email" | "joinedAt" | "failedSignIns">> & {
  /** Pass null to clear a sign-in lock. */
  lockedUntil?: string | null
}

export function updateDirectoryUser(ctx: AdminCtx, id: string, patch: DirectoryPatch): DirectoryUser {
  const employee = ctx.db.employees.find((e) => e.id === id)
  if (employee) {
    if (patch.failedSignIns !== undefined || patch.lockedUntil !== undefined) {
      const current = lockStore(ctx)[id] ?? { failedSignIns: fromEmployee(ctx, employee).failedSignIns, lockedUntil: fromEmployee(ctx, employee).lockedUntil }
      lockStore(ctx)[id] = {
        failedSignIns: patch.failedSignIns ?? current.failedSignIns,
        lockedUntil: patch.lockedUntil === null ? undefined : (patch.lockedUntil ?? current.lockedUntil),
      }
    }
    if (patch.status) employee.status = patch.status
    if (patch.invitedAt) employee.invitedAt = patch.invitedAt
    if (patch.firstName) employee.firstName = patch.firstName
    if (patch.lastName) employee.lastName = patch.lastName
    if (patch.email) employee.email = patch.email
    if (patch.activeSessions !== undefined) sessionStore(ctx)[id] = patch.activeSessions
    return fromEmployee(ctx, employee)
  }
  for (const list of Object.values(store(ctx))) {
    const u = list.find((x) => x.id === id)
    if (u) {
      const { lockedUntil, ...rest } = patch
      Object.assign(u, Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)))
      if (lockedUntil === null) delete u.lockedUntil
      else if (lockedUntil !== undefined) u.lockedUntil = lockedUntil
      return u
    }
  }
  throw notFound("User")
}

/** Adds an account (e.g. the invited owner of a newly created company). */
type NewDirectoryUser = Omit<DirectoryUser, "id" | "source" | "employeeCode" | "healthConnected" | "healthProvider" | "consents" | "failedSignIns"> & Partial<Pick<DirectoryUser, "employeeCode">>

export function addDirectoryUser(ctx: AdminCtx, user: NewDirectoryUser): DirectoryUser {
  const s = store(ctx)
  const list = (s[user.companyId] ??= [])
  const created: DirectoryUser = {
    employeeCode: user.employeeCode ?? `ADM${String(1001 + list.length)}`,
    healthConnected: false,
    healthProvider: null,
    consents: [],
    failedSignIns: 0,
    ...user,
    id: `dir_${user.companyId.replace(/^org_/, "")}_${list.length + 1}_${Date.now().toString(36)}`,
    source: "directory",
  }
  list.push(created)
  return created
}

/** Starts an empty account list for a new company (so no sample people are generated for it). */
export function initCompanyDirectory(ctx: AdminCtx, companyId: string) {
  store(ctx)[companyId] = []
}
