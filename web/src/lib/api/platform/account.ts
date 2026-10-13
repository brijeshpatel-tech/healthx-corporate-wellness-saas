/**
 * Platform Admin — my account (profile, password, two-step verification, sessions)
 * and the public password-reset flow used by /admin-portal/forgot-password.
 */
import { DEMO_PASSWORD } from "@/lib/mock/demo-accounts"
import type { PlatformRole } from "@/lib/types"
import { ApiError, audit, badRequest, endpoint, notFound } from "../core"
import { requireAdmin, type AdminCtx } from "./common"

export interface AccountSession {
  id: string
  device: "desktop" | "mobile" | "tablet"
  browser: string
  os: string
  location: string
  ip: string
  createdAt: string
  lastActiveAt: string
  current: boolean
}

export interface AccountProfile {
  id: string
  name: string
  email: string
  role: PlatformRole
  phone: string
  jobTitle: string
  avatarColor: string
  createdAt: string
  lastLoginAt?: string
  passwordUpdatedAt: string
  passwordMinLength: number
  mfa: { enabled: boolean; required: boolean; method: "authenticator"; enrolledAt?: string; backupCodesRemaining: number }
  sessions: AccountSession[]
}

interface AccountState {
  phone: string
  jobTitle: string
  password: string
  passwordUpdatedAt: string
  mfaEnrolledAt?: string
  backupCodes: string[]
  pendingSecret?: string
  sessions: AccountSession[]
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()

const randomCode = (len: number, alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789") => Array.from({ length: len }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")
const backupCodes = () => Array.from({ length: 10 }, () => `${randomCode(4).toLowerCase()}-${randomCode(4).toLowerCase()}`)

function state(ctx: AdminCtx, adminId: string): AccountState {
  const all = ctx.extra<Record<string, AccountState>>("admin-account", () => ({}))
  if (!all[adminId]) {
    all[adminId] = {
      phone: "",
      jobTitle: "HealthX Operations",
      password: DEMO_PASSWORD,
      passwordUpdatedAt: "2026-07-01T09:00:00.000Z",
      mfaEnrolledAt: "2026-02-01T09:30:00.000Z",
      backupCodes: backupCodes().slice(0, 8),
      sessions: [
        { id: "current", device: "desktop", browser: "Chrome 141", os: "Windows 11", location: "Bengaluru, India", ip: "103.48.197.12", createdAt: hoursAgo(1), lastActiveAt: new Date().toISOString(), current: true },
        { id: "ses_iphone", device: "mobile", browser: "Safari", os: "iOS 19", location: "Bengaluru, India", ip: "49.205.33.181", createdAt: hoursAgo(30), lastActiveAt: hoursAgo(2), current: false },
        { id: "ses_laptop", device: "desktop", browser: "Edge 140", os: "macOS 16", location: "Mumbai, India", ip: "106.51.72.9", createdAt: hoursAgo(96), lastActiveAt: hoursAgo(70), current: false },
      ],
    }
  }
  return all[adminId]!
}

const setting = (ctx: AdminCtx, key: string) => ctx.db.systemSettings.find((s) => s.key === key)?.value

function profile(ctx: AdminCtx): AccountProfile {
  const session = requireAdmin(ctx)
  const admin = ctx.db.platformAdmins.find((a) => a.id === session.user.id)
  if (!admin) throw notFound("Account")
  const st = state(ctx, admin.id)
  st.sessions.forEach((s) => s.current && (s.lastActiveAt = new Date().toISOString()))
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    phone: st.phone,
    jobTitle: st.jobTitle,
    avatarColor: admin.avatarColor,
    createdAt: admin.createdAt,
    lastLoginAt: admin.lastLoginAt,
    passwordUpdatedAt: st.passwordUpdatedAt,
    passwordMinLength: Number(setting(ctx, "security.password_min_length") ?? 10),
    mfa: {
      enabled: admin.mfaEnabled,
      required: setting(ctx, "security.require_mfa_admins") !== false,
      method: "authenticator",
      enrolledAt: admin.mfaEnabled ? st.mfaEnrolledAt : undefined,
      backupCodesRemaining: admin.mfaEnabled ? st.backupCodes.length : 0,
    },
    sessions: [...st.sessions].sort((a, b) => Number(b.current) - Number(a.current) || b.lastActiveAt.localeCompare(a.lastActiveAt)),
  }
}

function checkCode(code: string) {
  if (!/^\d{6}$/.test(code)) throw badRequest("Enter the 6-digit code.", { code: "Enter the 6-digit code from your authenticator app" })
  if (code === "000000") throw badRequest("That code isn't right.", { code: "That code isn't right. Try the latest code." })
}

function passwordErrors(password: string, min: number) {
  if (password.length < min) return `Use at least ${min} characters`
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use letters and at least one number"
  return null
}

const me = (ctx: AdminCtx) => {
  const session = requireAdmin(ctx)
  const admin = ctx.db.platformAdmins.find((a) => a.id === session.user.id)
  if (!admin) throw notFound("Account")
  return admin
}

export const accountApi = {
  get: endpoint<void, AccountProfile, "admin">("admin", "GET", "/platform/account", (_i, ctx) => {
    const p = profile(ctx)
    ctx.save()
    return p
  }),

  updateProfile: endpoint<{ name: string; phone?: string; jobTitle?: string }, AccountProfile, "admin">("admin", "PATCH", "/platform/account", (input, ctx) => {
    const admin = me(ctx)
    const errors: Record<string, string> = {}
    if (input.name.trim().length < 2) errors.name = "Enter your full name"
    if (input.phone && !/^\+?[\d\s-]{8,16}$/.test(input.phone.trim())) errors.phone = "Enter a valid phone number"
    if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
    admin.name = input.name.trim()
    const st = state(ctx, admin.id)
    st.phone = input.phone?.trim() ?? ""
    st.jobTitle = input.jobTitle?.trim() ?? ""
    audit(ctx, { action: "Updated own profile", entityType: "Admin user", entityName: admin.name })
    ctx.save()
    return profile(ctx)
  }),

  changePassword: endpoint<{ currentPassword: string; newPassword: string }, { ok: true }, "admin">("admin", "POST", "/platform/account/password", ({ currentPassword, newPassword }, ctx) => {
    const admin = me(ctx)
    const st = state(ctx, admin.id)
    if (currentPassword !== st.password) throw badRequest("Your current password is incorrect.", { currentPassword: "That's not your current password" })
    const min = Number(setting(ctx, "security.password_min_length") ?? 10)
    const err = passwordErrors(newPassword, min)
    if (err) throw badRequest(err, { newPassword: err })
    if (newPassword === currentPassword) throw badRequest("Choose a password you haven't used before.", { newPassword: "New password must be different" })
    st.password = newPassword
    st.passwordUpdatedAt = new Date().toISOString()
    st.sessions = st.sessions.filter((s) => s.current)
    audit(ctx, { action: "Changed password", entityType: "Admin user", entityName: admin.name, severity: "warning" })
    ctx.save()
    return { ok: true }
  }),

  /** Starts authenticator setup (or re-setup) and returns a new secret. */
  startMfaSetup: endpoint<void, { secret: string; otpauthUrl: string }, "admin">("admin", "POST", "/platform/account/mfa/setup", (_i, ctx) => {
    const admin = me(ctx)
    const st = state(ctx, admin.id)
    st.pendingSecret = randomCode(16, "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567")
    ctx.save()
    return { secret: st.pendingSecret, otpauthUrl: `otpauth://totp/HealthX%20Admin:${encodeURIComponent(admin.email)}?secret=${st.pendingSecret}&issuer=HealthX` }
  }),

  confirmMfa: endpoint<{ code: string }, { backupCodes: string[] }, "admin">("admin", "POST", "/platform/account/mfa/verify", ({ code }, ctx) => {
    const admin = me(ctx)
    const st = state(ctx, admin.id)
    if (!st.pendingSecret) throw badRequest("Start the setup again.")
    checkCode(code)
    st.pendingSecret = undefined
    st.mfaEnrolledAt = new Date().toISOString()
    st.backupCodes = backupCodes()
    admin.mfaEnabled = true
    audit(ctx, { action: "Set up two-step verification", entityType: "Admin user", entityName: admin.name, severity: "warning" })
    ctx.save()
    return { backupCodes: st.backupCodes }
  }),

  regenerateBackupCodes: endpoint<{ code: string }, { backupCodes: string[] }, "admin">("admin", "POST", "/platform/account/mfa/backup-codes", ({ code }, ctx) => {
    const admin = me(ctx)
    if (!admin.mfaEnabled) throw badRequest("Turn on two-step verification first.")
    checkCode(code)
    const st = state(ctx, admin.id)
    st.backupCodes = backupCodes()
    audit(ctx, { action: "Regenerated backup codes", entityType: "Admin user", entityName: admin.name, severity: "warning" })
    ctx.save()
    return { backupCodes: st.backupCodes }
  }),

  disableMfa: endpoint<{ password: string }, { ok: true }, "admin">("admin", "POST", "/platform/account/mfa/disable", ({ password }, ctx) => {
    const admin = me(ctx)
    if (setting(ctx, "security.require_mfa_admins") !== false) throw new ApiError("Two-step verification is required for all HealthX admins (System configuration › Security).", 403, "mfa_required")
    const st = state(ctx, admin.id)
    if (password !== st.password) throw badRequest("Your password is incorrect.", { password: "That's not your password" })
    admin.mfaEnabled = false
    st.backupCodes = []
    audit(ctx, { action: "Turned off two-step verification", entityType: "Admin user", entityName: admin.name, severity: "critical" })
    ctx.save()
    return { ok: true }
  }),

  revokeSession: endpoint<{ id: string }, { ok: true }, "admin">("admin", "DELETE", "/platform/account/sessions/:id", ({ id }, ctx) => {
    const admin = me(ctx)
    const st = state(ctx, admin.id)
    const s = st.sessions.find((x) => x.id === id)
    if (!s) throw notFound("Session")
    if (s.current) throw badRequest("Use Sign out to end this session.")
    st.sessions = st.sessions.filter((x) => x.id !== id)
    audit(ctx, { action: "Signed out a device", entityType: "Session", entityName: `${s.browser} on ${s.os}` })
    ctx.save()
    return { ok: true }
  }),

  revokeOtherSessions: endpoint<void, { revoked: number }, "admin">("admin", "POST", "/platform/account/sessions/revoke-others", (_i, ctx) => {
    const admin = me(ctx)
    const st = state(ctx, admin.id)
    const revoked = st.sessions.filter((s) => !s.current).length
    st.sessions = st.sessions.filter((s) => s.current)
    audit(ctx, { action: "Signed out of all other devices", entityType: "Session", entityName: `${revoked} sessions`, severity: "warning" })
    ctx.save()
    return { revoked }
  }),

  // ─── Public (no session): password reset from the emailed link ───────

  checkResetToken: endpoint<{ token: string }, { email: string }, "admin">("admin", "GET", "/platform/auth/password/reset/:token", ({ token }) => {
    if (!token || token === "expired") throw new ApiError("This reset link has expired. Request a new one.", 410, "token_expired")
    return { email: "ar•••@healthx.life" }
  }),

  resetPassword: endpoint<{ token: string; password: string }, { ok: true }, "admin">("admin", "POST", "/platform/auth/password/reset", ({ token, password }, ctx) => {
    if (!token || token === "expired") throw new ApiError("This reset link has expired. Request a new one.", 410, "token_expired")
    const min = Number(setting(ctx, "security.password_min_length") ?? 10)
    const err = passwordErrors(password, min)
    if (err) throw badRequest(err, { password: err })
    return { ok: true }
  }),
}
