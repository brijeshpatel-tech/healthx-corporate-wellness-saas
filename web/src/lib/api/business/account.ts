/** Business Portal — the signed-in administrator's own account (SCR-B-045): profile, password, two-step verification, sessions. */
import type { BusinessSession } from "@/lib/auth/session"
import type { BusinessRole } from "@/lib/types"
import { DEMO_PASSWORD } from "@/lib/mock/demo-accounts"
import { audit, badRequest, endpoint, notFound } from "../core"
import type { BusinessCtx } from "./common"

export interface AccountSession {
  id: string
  device: string
  browser: string
  location: string
  ip: string
  signedInAt: string
  lastActiveAt: string
  current: boolean
}

export interface AccountProfile {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  jobTitle: string
  avatarColor: string
  role: BusinessRole
  companyName: string
  passwordChangedAt?: string
  mfa: { method: "email" | "authenticator"; enrolledAt: string; recoveryCodesLeft: number }
  signInAlerts: boolean
}

interface AccountState {
  password?: string
  passwordChangedAt?: string
  termsAcceptedAt?: string
  signInAlerts?: boolean
  mfa?: { method: "email" | "authenticator"; enrolledAt: string; recoveryCodes: string[]; pendingSecret?: string }
  sessions?: AccountSession[]
}

const store = (ctx: BusinessCtx) => ctx.extra<Record<string, AccountState>>("biz-account", () => ({}))

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
const randomCode = (len: number, alphabet = "abcdefghjkmnpqrstuvwxyz23456789") => Array.from({ length: len }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")
const recoveryCodes = () => Array.from({ length: 10 }, () => `${randomCode(4)}-${randomCode(4)}`)

function me(ctx: BusinessCtx) {
  const session = ctx.session() as BusinessSession
  const e = ctx.db.employees.find((x) => x.id === session.user.id)
  if (!e) throw notFound("Account")
  return { session, e }
}

function state(ctx: BusinessCtx, employeeId: string): AccountState {
  const s = store(ctx)
  const current = (s[employeeId] ??= {})
  current.mfa ??= { method: "email", enrolledAt: "2026-03-20T10:00:00.000Z", recoveryCodes: recoveryCodes() }
  if (!current.sessions) {
    const now = Date.now()
    current.sessions = [
      { id: "ses_current", device: "Windows PC", browser: "Chrome", location: "Bengaluru, India", ip: "49.207.12.81", signedInAt: new Date(now - 2 * 3_600_000).toISOString(), lastActiveAt: new Date(now).toISOString(), current: true },
      { id: "ses_iphone", device: "iPhone 15", browser: "Safari", location: "Bengaluru, India", ip: "106.51.77.140", signedInAt: new Date(now - 3 * 86_400_000).toISOString(), lastActiveAt: new Date(now - 5 * 3_600_000).toISOString(), current: false },
      { id: "ses_laptop", device: "MacBook Air", browser: "Edge", location: "Pune, India", ip: "103.88.41.9", signedInAt: new Date(now - 9 * 86_400_000).toISOString(), lastActiveAt: new Date(now - 2 * 86_400_000).toISOString(), current: false },
    ]
  }
  return current
}

function view(ctx: BusinessCtx): AccountProfile {
  const { session, e } = me(ctx)
  const s = state(ctx, e.id)
  return {
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
    phone: e.phone ?? "",
    jobTitle: e.jobTitle,
    avatarColor: e.avatarColor,
    role: session.role,
    companyName: session.companyName,
    passwordChangedAt: s.passwordChangedAt,
    mfa: { method: s.mfa!.method, enrolledAt: s.mfa!.enrolledAt, recoveryCodesLeft: s.mfa!.recoveryCodes.length },
    signInAlerts: s.signInAlerts ?? true,
  }
}

const strongPassword = (p: string) => p.length >= 10 && /[A-Za-z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p)

export const accountApi = {
  me: endpoint<void, AccountProfile, "business">("business", "GET", "/me", (_i, ctx) => view(ctx)),

  updateProfile: endpoint<{ firstName: string; lastName: string; jobTitle: string; phone: string; signInAlerts: boolean }, AccountProfile, "business">("business", "PATCH", "/me", (input, ctx) => {
    const errors: Record<string, string> = {}
    if (!input.firstName.trim()) errors.firstName = "Enter your first name"
    if (!input.lastName.trim()) errors.lastName = "Enter your last name"
    if (input.phone && input.phone.replace(/\D/g, "").length < 10) errors.phone = "Enter a valid mobile number"
    if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
    const { e } = me(ctx)
    e.firstName = input.firstName.trim()
    e.lastName = input.lastName.trim()
    e.jobTitle = input.jobTitle.trim() || e.jobTitle
    e.phone = input.phone.trim() || undefined
    state(ctx, e.id).signInAlerts = input.signInAlerts
    ctx.save()
    return view(ctx)
  }),

  changePassword: endpoint<{ currentPassword: string; newPassword: string }, { ok: true; signedOut: number }, "business">("business", "POST", "/auth/password/change", (input, ctx) => {
    const { e } = me(ctx)
    const s = state(ctx, e.id)
    if (input.currentPassword !== (s.password ?? DEMO_PASSWORD)) throw badRequest("Current password is incorrect.", { currentPassword: "Current password is incorrect." })
    if (!strongPassword(input.newPassword)) throw badRequest("Use at least 10 characters with letters, numbers and a symbol.", { newPassword: "Use at least 10 characters with letters, numbers and a symbol" })
    if (input.newPassword === input.currentPassword) throw badRequest("Choose a password you haven't used here before.", { newPassword: "Must be different from your current password" })
    s.password = input.newPassword
    s.passwordChangedAt = new Date().toISOString()
    const others = s.sessions!.filter((x) => !x.current).length
    s.sessions = s.sessions!.filter((x) => x.current)
    audit(ctx, { action: "Changed password (other sessions signed out)", entityType: "Administrator", entityName: `${e.firstName} ${e.lastName}`, companyId: e.companyId })
    ctx.save()
    return { ok: true, signedOut: others }
  }),

  startAuthenticatorSetup: endpoint<void, { secret: string; otpauthUri: string }, "business">("business", "POST", "/auth/mfa/setup", (_i, ctx) => {
    const { e, session } = me(ctx)
    const s = state(ctx, e.id)
    const secret = randomCode(32, BASE32)
    s.mfa!.pendingSecret = secret
    ctx.save()
    return { secret, otpauthUri: `otpauth://totp/HealthX%20Business:${encodeURIComponent(e.email)}?secret=${secret}&issuer=HealthX%20(${encodeURIComponent(session.companyName)})` }
  }),

  /** Demo: any 6 digits except 000000 work. */
  confirmAuthenticatorSetup: endpoint<{ code: string }, { recoveryCodes: string[] }, "business">("business", "POST", "/auth/mfa/setup/confirm", ({ code }, ctx) => {
    const { e } = me(ctx)
    const s = state(ctx, e.id)
    if (!s.mfa!.pendingSecret) throw badRequest("Start the set-up again.")
    if (!/^\d{6}$/.test(code)) throw badRequest("Enter the 6-digit code from your app.", { code: "Enter the 6-digit code" })
    if (code === "000000") throw badRequest("That code isn't right.", { code: "That code isn't right." })
    const codes = recoveryCodes()
    s.mfa = { method: "authenticator", enrolledAt: new Date().toISOString(), recoveryCodes: codes }
    audit(ctx, { action: "Turned on authenticator app for two-step verification", entityType: "Administrator", entityName: `${e.firstName} ${e.lastName}`, companyId: e.companyId })
    ctx.save()
    return { recoveryCodes: codes }
  }),

  useEmailCodes: endpoint<{ password: string }, AccountProfile, "business">("business", "POST", "/auth/mfa/email", ({ password }, ctx) => {
    const { e } = me(ctx)
    const s = state(ctx, e.id)
    if (password !== (s.password ?? DEMO_PASSWORD)) throw badRequest("Current password is incorrect.", { password: "Current password is incorrect." })
    s.mfa = { method: "email", enrolledAt: new Date().toISOString(), recoveryCodes: s.mfa!.recoveryCodes }
    audit(ctx, { action: "Switched two-step verification to email codes", entityType: "Administrator", entityName: `${e.firstName} ${e.lastName}`, companyId: e.companyId, severity: "warning" })
    ctx.save()
    return view(ctx)
  }),

  regenerateRecoveryCodes: endpoint<void, { recoveryCodes: string[] }, "business">("business", "POST", "/auth/mfa/recovery-codes", (_i, ctx) => {
    const { e } = me(ctx)
    const s = state(ctx, e.id)
    s.mfa!.recoveryCodes = recoveryCodes()
    audit(ctx, { action: "Generated new recovery codes", entityType: "Administrator", entityName: `${e.firstName} ${e.lastName}`, companyId: e.companyId })
    ctx.save()
    return { recoveryCodes: s.mfa!.recoveryCodes }
  }),

  sessions: endpoint<void, AccountSession[], "business">("business", "GET", "/me/sessions", (_i, ctx) => {
    const { e } = me(ctx)
    const s = state(ctx, e.id)
    const current = s.sessions!.find((x) => x.current)
    if (current) current.lastActiveAt = new Date().toISOString()
    return [...s.sessions!].sort((a, b) => Number(b.current) - Number(a.current) || b.lastActiveAt.localeCompare(a.lastActiveAt))
  }),

  revokeSession: endpoint<{ id: string }, { ok: true }, "business">("business", "DELETE", "/me/sessions/:id", ({ id }, ctx) => {
    const { e } = me(ctx)
    const s = state(ctx, e.id)
    const target = s.sessions!.find((x) => x.id === id)
    if (!target) throw notFound("Session")
    if (target.current) throw badRequest("Use 'Sign out' to end this session.")
    s.sessions = s.sessions!.filter((x) => x.id !== id)
    audit(ctx, { action: `Signed out session (${target.browser} on ${target.device})`, entityType: "Session", entityName: `${e.firstName} ${e.lastName}`, companyId: e.companyId })
    ctx.save()
    return { ok: true }
  }),

  revokeOtherSessions: endpoint<void, { signedOut: number }, "business">("business", "DELETE", "/me/sessions", (_i, ctx) => {
    const { e } = me(ctx)
    const s = state(ctx, e.id)
    const count = s.sessions!.filter((x) => !x.current).length
    s.sessions = s.sessions!.filter((x) => x.current)
    if (count) audit(ctx, { action: `Signed out ${count} other ${count === 1 ? "session" : "sessions"}`, entityType: "Session", entityName: `${e.firstName} ${e.lastName}`, companyId: e.companyId })
    ctx.save()
    return { signedOut: count }
  }),
}
