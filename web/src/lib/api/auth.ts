/**
 * Sign-in services for the three portals.
 * Demo (mock) mode: any password works for the demo accounts, and the
 * verification code is any 6 digits (use 123456). "000000" simulates a wrong code.
 */
import type { AdminSession, BusinessSession, EmployeeSession } from "@/lib/auth/session"
import type { Branding, BusinessRole, Company, Employee } from "@/lib/types"
import { ApiError, badRequest, endpoint, notFound } from "./core"
import type { MockDB } from "@/lib/mock/db"

const DEMO_OTP_FAIL = "000000"
const token = () => `mock.${Math.random().toString(36).slice(2)}.${Date.now().toString(36)}`
const expiresIn = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString()

function checkCode(code: string) {
  if (!/^\d{6}$/.test(code)) throw badRequest("Enter the 6-digit code.", { code: "Enter the 6-digit code." })
  if (code === DEMO_OTP_FAIL) throw badRequest("That code is incorrect. Please try again.", { code: "Incorrect code" })
}

const fullName = (e: Employee) => `${e.firstName} ${e.lastName}`

// ─── Platform Admin ─────────────────────────────────────────────────────

export interface LoginInput {
  email: string
  password: string
}

export interface MfaChallenge {
  mfaRequired: true
  challengeId: string
  maskedDestination: string
  method: "authenticator" | "email"
}

const mask = (email: string) => email.replace(/^(.{2}).*(@.*)$/, "$1•••$2")

export const adminAuthApi = {
  login: endpoint<LoginInput, MfaChallenge, "admin">("admin", "POST", "/platform/auth/login", ({ email, password }, { db }) => {
    if (!password) throw badRequest("Enter your password.")
    const admin = db.platformAdmins.find((a) => a.email.toLowerCase() === email.trim().toLowerCase())
    if (!admin) throw new ApiError("Email or password is incorrect.", 401, "invalid_credentials")
    if (admin.status === "disabled") throw new ApiError("This account has been disabled. Contact another Super Admin.", 403, "account_disabled")
    return { mfaRequired: true, challengeId: `adm:${admin.id}`, maskedDestination: mask(admin.email), method: "authenticator" }
  }),

  verifyMfa: endpoint<{ challengeId: string; code: string }, AdminSession, "admin">("admin", "POST", "/platform/auth/mfa/verify", ({ challengeId, code }, { db, save }) => {
    checkCode(code)
    const admin = db.platformAdmins.find((a) => `adm:${a.id}` === challengeId)
    if (!admin) throw new ApiError("Your sign-in attempt expired. Please start again.", 401, "challenge_expired")
    admin.lastLoginAt = new Date().toISOString()
    save()
    return {
      accessToken: token(),
      refreshToken: token(),
      expiresAt: expiresIn(8),
      role: admin.role,
      user: { id: admin.id, name: admin.name, email: admin.email, avatarColor: admin.avatarColor, jobTitle: "HealthX" },
    }
  }),

  forgotPassword: endpoint<{ email: string }, { sent: true }, "admin">("admin", "POST", "/platform/auth/password/forgot", () => ({ sent: true })),

  logout: endpoint<void, { ok: true }, "admin">("admin", "POST", "/platform/auth/logout", () => ({ ok: true })),
}

// ─── Business Portal ────────────────────────────────────────────────────

function businessRoleOf(e: Employee): BusinessRole | null {
  if (e.adminRole) return e.adminRole
  if (e.appRole === "team_manager") return "team_manager"
  return null
}

export function buildBusinessSession(db: MockDB, e: Employee): BusinessSession {
  const role = businessRoleOf(e)
  if (!role) throw new ApiError("This account does not have access to the Business Portal.", 403, "no_portal_access")
  const company = db.companies.find((c) => c.id === e.companyId)!
  return {
    accessToken: token(),
    refreshToken: token(),
    expiresAt: expiresIn(8),
    role,
    companyId: company.id,
    companyName: company.name,
    teamIds: db.teams.filter((t) => t.managerIds.includes(e.id)).map((t) => t.id),
    user: { id: e.id, name: fullName(e), email: e.email, avatarColor: e.avatarColor, jobTitle: e.jobTitle },
  }
}

export const businessAuthApi = {
  login: endpoint<LoginInput, MfaChallenge, "business">("business", "POST", "/auth/admin/login", ({ email, password }, { db }) => {
    if (!password) throw badRequest("Enter your password.")
    const e = db.employees.find((x) => x.email.toLowerCase() === email.trim().toLowerCase())
    if (!e || !businessRoleOf(e)) throw new ApiError("Email or password is incorrect, or this account is not a company administrator.", 401, "invalid_credentials")
    if (e.status === "deactivated") throw new ApiError("Your account has been deactivated. Contact your Company Owner.", 403, "account_deactivated")
    const company = db.companies.find((c) => c.id === e.companyId)
    if (company?.status === "suspended") throw new ApiError("Your company's HealthX workspace is suspended. Contact HealthX support.", 403, "company_suspended")
    return { mfaRequired: true, challengeId: `biz:${e.id}`, maskedDestination: mask(e.email), method: "email" }
  }),

  verifyMfa: endpoint<{ challengeId: string; code: string }, BusinessSession, "business">("business", "POST", "/auth/admin/mfa/verify", ({ challengeId, code }, { db }) => {
    checkCode(code)
    const e = db.employees.find((x) => `biz:${x.id}` === challengeId)
    if (!e) throw new ApiError("Your sign-in attempt expired. Please start again.", 401, "challenge_expired")
    return buildBusinessSession(db, e)
  }),

  /** Demo only: jump straight into another demo account to preview its role. */
  switchDemoAccount: endpoint<{ email: string }, BusinessSession, "business">("business", "POST", "/auth/admin/demo-switch", ({ email }, { db }) => {
    const e = db.employees.find((x) => x.email === email)
    if (!e) throw notFound("Demo account")
    return buildBusinessSession(db, e)
  }),

  forgotPassword: endpoint<{ email: string }, { sent: true }, "business">("business", "POST", "/auth/admin/password/forgot", () => ({ sent: true })),

  resetPassword: endpoint<{ token: string; password: string }, { ok: true }, "business">("business", "POST", "/auth/admin/password/reset", ({ password }) => {
    if (password.length < 10) throw badRequest("Password must be at least 10 characters.", { password: "At least 10 characters" })
    return { ok: true }
  }),

  getAdminInvitation: endpoint<{ token: string }, { companyName: string; email: string; name: string; role: BusinessRole }, "business">(
    "business",
    "GET",
    "/auth/admin/invitations/:token",
    ({ token: t }, { db }) => {
      if (t === "expired") throw new ApiError("This invitation has expired. Ask your Company Owner to send a new one.", 410, "invitation_expired")
      const e = db.employees.find((x) => x.adminRole === "wellness_manager")!
      return { companyName: db.companies.find((c) => c.id === e.companyId)!.name, email: e.email, name: fullName(e), role: "wellness_manager" }
    },
  ),

  acceptAdminInvitation: endpoint<{ token: string; name: string; password: string }, { ok: true }, "business">(
    "business",
    "POST",
    "/auth/admin/invitations/:token/accept",
    ({ password }) => {
      if (password.length < 10) throw badRequest("Password must be at least 10 characters.", { password: "At least 10 characters" })
      return { ok: true }
    },
  ),

  logout: endpoint<void, { ok: true }, "business">("business", "POST", "/auth/admin/logout", () => ({ ok: true })),
}

// ─── Employee App ───────────────────────────────────────────────────────

export interface CompanyLookup {
  id: string
  name: string
  code: string
  branding: Branding
  signInMethods: ("email" | "phone" | "magic_link" | "google" | "microsoft" | "sso")[]
}

const toLookup = (c: Company): CompanyLookup => ({
  id: c.id,
  name: c.name,
  code: c.companyCode,
  branding: c.branding,
  signInMethods: ["email", "phone", "magic_link", "google", "microsoft"],
})

export function buildEmployeeSession(db: MockDB, e: Employee): EmployeeSession {
  const company = db.companies.find((c) => c.id === e.companyId)!
  const priv = db.private[e.id]
  return {
    accessToken: token(),
    refreshToken: token(),
    expiresAt: expiresIn(24 * 30),
    role: e.appRole,
    companyId: company.id,
    companyName: company.name,
    onboardingCompleted: priv ? priv.onboardingCompleted : e.status !== "invited",
    user: { id: e.id, name: fullName(e), email: e.email, avatarColor: e.avatarColor, jobTitle: e.jobTitle },
  }
}

function assertCanSignIn(db: MockDB, e: Employee | undefined) {
  if (!e) throw new ApiError("We couldn't find an account with those details. Check with your HR team that you've been invited.", 401, "invalid_credentials")
  if (e.status === "deactivated") throw new ApiError("Your account has been deactivated by your company.", 403, "account_deactivated")
  const company = db.companies.find((c) => c.id === e.companyId)
  if (company?.status === "suspended") throw new ApiError("Your company's HealthX access is paused. Please contact your HR team.", 403, "company_suspended")
}

function activate(e: Employee) {
  if (e.status === "invited" || e.status === "registered") {
    e.status = e.status === "invited" ? "registered" : e.status
    e.joinedAt = e.joinedAt ?? new Date().toISOString()
  }
  e.lastActiveAt = new Date().toISOString()
}

export const employeeAuthApi = {
  identifyCompany: endpoint<{ query: string }, CompanyLookup, "employee">("employee", "POST", "/auth/company/identify", ({ query }, { db }) => {
    const q = query.trim().toLowerCase()
    if (!q) throw badRequest("Enter your company code or work email.")
    const domain = q.includes("@") ? q.split("@")[1] : null
    const company = db.companies.find((c) => c.companyCode.toLowerCase() === q || (domain && c.emailDomains.includes(domain)) || c.slug === q)
    if (!company) throw new ApiError("We couldn't find that company. Check the code from your invitation email, or ask your HR team.", 404, "company_not_found")
    if (company.status === "suspended") throw new ApiError("This company's HealthX access is paused. Please contact your HR team.", 403, "company_suspended")
    return toLookup(company)
  }),

  emailLogin: endpoint<LoginInput & { companyId?: string }, EmployeeSession, "employee">("employee", "POST", "/auth/email/login", ({ email, password }, { db, save }) => {
    if (!password) throw badRequest("Enter your password.")
    const e = db.employees.find((x) => x.email.toLowerCase() === email.trim().toLowerCase())
    assertCanSignIn(db, e)
    activate(e!)
    save()
    return buildEmployeeSession(db, e!)
  }),

  sendOtp: endpoint<{ phone: string }, { sent: true; maskedPhone: string }, "employee">("employee", "POST", "/auth/otp/send", ({ phone }) => {
    const digits = phone.replace(/\D/g, "")
    if (digits.length < 10) throw badRequest("Enter a valid mobile number.", { phone: "Enter a valid mobile number" })
    return { sent: true, maskedPhone: `+91 •••••${digits.slice(-5)}` }
  }),

  verifyOtp: endpoint<{ phone: string; code: string }, EmployeeSession, "employee">("employee", "POST", "/auth/otp/verify", ({ phone, code }, { db, save }) => {
    checkCode(code)
    const digits = phone.replace(/\D/g, "").slice(-10)
    const e = db.employees.find((x) => x.phone?.replace(/\D/g, "").endsWith(digits)) ?? db.employees.find((x) => x.firstName === "Priya" && x.lastName === "Sharma")
    assertCanSignIn(db, e)
    activate(e!)
    save()
    return buildEmployeeSession(db, e!)
  }),

  sendMagicLink: endpoint<{ email: string }, { sent: true }, "employee">("employee", "POST", "/auth/magic-link/send", ({ email }) => {
    if (!/^\S+@\S+\.\S+$/.test(email)) throw badRequest("Enter a valid email address.", { email: "Enter a valid email" })
    return { sent: true }
  }),

  consumeMagicLink: endpoint<{ email: string; token: string }, EmployeeSession, "employee">("employee", "POST", "/auth/magic-link/verify", ({ email }, { db, save }) => {
    const e = db.employees.find((x) => x.email.toLowerCase() === email.trim().toLowerCase())
    assertCanSignIn(db, e)
    activate(e!)
    save()
    return buildEmployeeSession(db, e!)
  }),

  oauth: endpoint<{ provider: "google" | "microsoft"; idToken?: string }, EmployeeSession, "employee">("employee", "POST", "/auth/oauth/:provider", (_input, { db, save }) => {
    const e = db.employees.find((x) => x.firstName === "Priya" && x.lastName === "Sharma")
    assertCanSignIn(db, e)
    activate(e!)
    save()
    return buildEmployeeSession(db, e!)
  }),

  getInvitation: endpoint<{ token: string }, { company: CompanyLookup; email: string; firstName: string; lastName: string; department: string; team: string; expiresAt: string }, "employee">(
    "employee",
    "GET",
    "/auth/invitations/:token",
    ({ token: t }, { db }) => {
      const inv = db.invitations.find((i) => i.token.toLowerCase() === t.trim().toLowerCase())
      if (!inv) throw notFound("Invitation")
      if (inv.status === "expired" || new Date(inv.expiresAt) < new Date()) throw new ApiError("This invitation has expired. Ask your HR team to send a new one.", 410, "invitation_expired")
      if (inv.status === "revoked") throw new ApiError("This invitation was cancelled by your company.", 410, "invitation_revoked")
      const e = db.employees.find((x) => x.id === inv.employeeId)!
      return {
        company: toLookup(db.companies.find((c) => c.id === inv.companyId)!),
        email: e.email,
        firstName: e.firstName,
        lastName: e.lastName,
        department: db.departments.find((d) => d.id === e.departmentId)?.name ?? "",
        team: db.teams.find((t) => t.id === e.teamId)?.name ?? "",
        expiresAt: inv.expiresAt,
      }
    },
  ),

  acceptInvitation: endpoint<{ token: string; password: string }, EmployeeSession, "employee">("employee", "POST", "/auth/invitations/:token/accept", (input, ctx) => {
    const { db, save } = ctx
    if (input.password.length < 8) throw badRequest("Password must be at least 8 characters.", { password: "At least 8 characters" })
    const inv = db.invitations.find((i) => i.token.toLowerCase() === input.token.trim().toLowerCase())
    if (!inv) throw notFound("Invitation")
    const e = db.employees.find((x) => x.id === inv.employeeId)!
    inv.status = "accepted"
    e.status = "registered"
    e.joinedAt = new Date().toISOString()
    e.lastActiveAt = e.joinedAt
    save()
    const session = buildEmployeeSession(db, e)
    return { ...session, onboardingCompleted: false }
  }),

  forgotPassword: endpoint<{ email: string }, { sent: true }, "employee">("employee", "POST", "/auth/password/forgot", () => ({ sent: true })),

  acceptTerms: endpoint<{ version: string }, { ok: true }, "employee">("employee", "POST", "/me/terms/accept", (_i, ctx) => {
    ctx.me().termsAcceptedAt = new Date().toISOString()
    ctx.save()
    return { ok: true }
  }),

  logout: endpoint<void, { ok: true }, "employee">("employee", "POST", "/auth/logout", () => ({ ok: true })),
}

