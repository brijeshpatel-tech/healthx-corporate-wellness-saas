/**
 * Platform Admin — HealthX admin users (SCR-P-007). Super Admin only (admins.manage).
 * Rules: @healthx.life emails only, unique email, at least one active Super Admin must remain,
 * you can't disable yourself or change your own role.
 */
import { AVATAR_COLORS, hash } from "@/lib/mock/series"
import type { PlatformAdmin, PlatformRole } from "@/lib/types"
import { PLATFORM_ROLE_LABEL } from "@/lib/types"
import { audit, badRequest, endpoint, matchesSearch, newId, notFound } from "../core"
import { requireAdmin, type AdminCtx } from "./common"

export const ADMIN_EMAIL_DOMAIN = "healthx.life"

export interface AdminUserRow extends PlatformAdmin {
  /** Policy: the admin must set up two-step verification before using the portal. */
  mfaRequired: boolean
  isYou: boolean
}

export interface AdminUserQuery {
  search?: string
  role?: PlatformRole | "all"
  status?: PlatformAdmin["status"] | "all"
}

export interface AdminUserList {
  items: AdminUserRow[]
  counts: { total: number; active: number; invited: number; disabled: number; superAdmins: number; activeByRole: Record<PlatformRole, number> }
}

export interface InviteAdminInput {
  name: string
  email: string
  role: PlatformRole
  mfaRequired: boolean
}

export interface UpdateAdminInput {
  id: string
  name?: string
  role?: PlatformRole
  mfaRequired?: boolean
  status?: "active" | "disabled"
}

/** MFA-required flags (not part of the PlatformAdmin record in the sample data). */
const mfaPolicy = (ctx: AdminCtx) => ctx.extra<Record<string, boolean>>("admin-admins-mfa", () => ({}))

function toRow(ctx: AdminCtx, a: PlatformAdmin, meId: string): AdminUserRow {
  return { ...a, mfaRequired: mfaPolicy(ctx)[a.id] ?? true, isYou: a.id === meId }
}

function findAdmin(ctx: AdminCtx, id: string) {
  const a = ctx.db.platformAdmins.find((x) => x.id === id)
  if (!a) throw notFound("Admin")
  return a
}

const activeSuperAdmins = (ctx: AdminCtx) => ctx.db.platformAdmins.filter((a) => a.role === "super_admin" && a.status === "active")

export const adminsApi = {
  list: endpoint<AdminUserQuery, AdminUserList, "admin">("admin", "GET", "/platform/admin-users", (q, ctx) => {
    const me = requireAdmin(ctx)
    const all = ctx.db.platformAdmins
    const items = all
      .filter(
        (a) =>
          matchesSearch(q.search, a.name, a.email) && (!q.role || q.role === "all" || a.role === q.role) && (!q.status || q.status === "all" || a.status === q.status),
      )
      .sort((a, b) => {
        const order = { active: 0, invited: 1, disabled: 2 }
        return order[a.status] - order[b.status] || a.name.localeCompare(b.name)
      })
      .map((a) => toRow(ctx, a, me.user.id))
    return {
      items,
      counts: {
        total: all.length,
        active: all.filter((a) => a.status === "active").length,
        invited: all.filter((a) => a.status === "invited").length,
        disabled: all.filter((a) => a.status === "disabled").length,
        superAdmins: activeSuperAdmins(ctx).length,
        activeByRole: {
          super_admin: all.filter((a) => a.status === "active" && a.role === "super_admin").length,
          support_admin: all.filter((a) => a.status === "active" && a.role === "support_admin").length,
          content_admin: all.filter((a) => a.status === "active" && a.role === "content_admin").length,
        },
      },
    }
  }),

  invite: endpoint<InviteAdminInput, AdminUserRow, "admin">("admin", "POST", "/platform/admin-users", (input, ctx) => {
    const me = requireAdmin(ctx, "admins.manage")
    const name = input.name.trim()
    const email = input.email.trim().toLowerCase()
    const errors: Record<string, string> = {}
    if (name.length < 2) errors.name = "Enter the admin's full name"
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address"
    else if (!email.endsWith(`@${ADMIN_EMAIL_DOMAIN}`)) errors.email = `Use a HealthX email address (@${ADMIN_EMAIL_DOMAIN}).`
    else if (ctx.db.platformAdmins.some((a) => a.email.toLowerCase() === email)) errors.email = "An admin with this email already exists."
    if (!PLATFORM_ROLE_LABEL[input.role]) errors.role = "Choose a role"
    const messages = Object.values(errors)
    if (messages.length) throw badRequest(messages.length === 1 ? messages[0]! : "Please fix the highlighted fields.", errors)
    const admin: PlatformAdmin = {
      id: newId("padm"),
      name,
      email,
      role: input.role,
      status: "invited",
      mfaEnabled: false,
      createdAt: new Date().toISOString(),
      avatarColor: AVATAR_COLORS[hash(email) % AVATAR_COLORS.length]!,
    }
    ctx.db.platformAdmins.push(admin)
    mfaPolicy(ctx)[admin.id] = input.mfaRequired
    audit(ctx, { action: `Invited HealthX admin (${PLATFORM_ROLE_LABEL[input.role]})`, entityType: "Admin user", entityName: `${name} <${email}>`, severity: input.role === "super_admin" ? "warning" : "info" })
    ctx.save()
    return toRow(ctx, admin, me.user.id)
  }),

  update: endpoint<UpdateAdminInput, AdminUserRow, "admin">("admin", "PATCH", "/platform/admin-users/:id", (input, ctx) => {
    const me = requireAdmin(ctx, "admins.manage")
    const a = findAdmin(ctx, input.id)
    const isSelf = a.id === me.user.id
    const lastSuper = a.role === "super_admin" && a.status === "active" && activeSuperAdmins(ctx).length <= 1
    const changes: string[] = []

    if (input.name !== undefined) {
      const name = input.name.trim()
      if (name.length < 2) throw badRequest("Please fix the highlighted fields.", { name: "Enter the admin's full name" })
      if (name !== a.name) {
        a.name = name
        changes.push("name")
      }
    }
    if (input.role !== undefined && input.role !== a.role) {
      if (isSelf) throw badRequest("You can't change your own role. Ask another Super Admin.", { role: "You can't change your own role." })
      if (lastSuper) throw badRequest("You can't change the role of the last Super Admin.", { role: "At least one active Super Admin must remain." })
      changes.push(`role ${PLATFORM_ROLE_LABEL[a.role]} → ${PLATFORM_ROLE_LABEL[input.role]}`)
      a.role = input.role
    }
    if (input.mfaRequired !== undefined && input.mfaRequired !== (mfaPolicy(ctx)[a.id] ?? true)) {
      mfaPolicy(ctx)[a.id] = input.mfaRequired
      changes.push(input.mfaRequired ? "MFA required" : "MFA optional")
    }
    if (input.status !== undefined && input.status !== a.status) {
      if (input.status === "disabled") {
        if (isSelf) throw badRequest("You can't deactivate your own account.")
        if (lastSuper) throw badRequest("You can't deactivate the last Super Admin.")
        a.status = "disabled"
        changes.push("deactivated")
      } else {
        // Re-enable: people who never signed in go back to "invited".
        a.status = a.lastLoginAt ? "active" : "invited"
        changes.push("re-enabled")
      }
    }
    if (!changes.length) return toRow(ctx, a, me.user.id)
    const action = changes.includes("deactivated") ? "Deactivated HealthX admin" : changes.includes("re-enabled") ? "Re-enabled HealthX admin" : `Updated HealthX admin (${changes.join(", ")})`
    audit(ctx, { action, entityType: "Admin user", entityName: a.name, severity: changes.some((c) => c.startsWith("role") || c === "deactivated" || c === "MFA optional") ? "warning" : "info" })
    ctx.save()
    return toRow(ctx, a, me.user.id)
  }),

  resendInvite: endpoint<{ id: string }, { email: string }, "admin">("admin", "POST", "/platform/admin-users/:id/invitation/resend", ({ id }, ctx) => {
    requireAdmin(ctx, "admins.manage")
    const a = findAdmin(ctx, id)
    if (a.status !== "invited") throw badRequest("Only invited admins can be sent a new invitation.")
    audit(ctx, { action: "Resent HealthX admin invitation", entityType: "Admin user", entityName: a.name })
    ctx.save()
    return { email: a.email }
  }),
}
