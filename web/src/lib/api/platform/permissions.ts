/**
 * Platform Admin action permissions. Page access comes from ADMIN_NAV (config/nav.ts);
 * this matrix decides which *actions* each HealthX role may take on those pages.
 *
 *   Super Admin    – everything
 *   Support Admin  – companies (view + support actions), users, subscriptions (view), orders, support, audit
 *   Content Admin  – templates, rewards, badges, workouts, exercises, habits, content, programs
 *   Help centre articles – all three roles
 */
import type { PlatformRole } from "@/lib/types"

export type AdminPermission =
  | "companies.manage" // create, edit, suspend, reactivate, modules, change plan
  | "companies.support" // open as support, resend owner invitation
  | "users.manage" // deactivate, reactivate, resend invitation, revoke sessions
  | "admins.manage"
  | "plans.manage"
  | "subscriptions.manage"
  | "billing.manage"
  | "catalog.manage" // templates, rewards, categories, badges, workouts, exercises, habits, content, programs
  | "orders.manage"
  | "points.manage"
  | "score.manage"
  | "settings.manage"
  | "ai.manage"
  | "support.manage"
  | "help.manage" // help-centre FAQs & troubleshooting articles
  | "audit.export"
  | "revenue.view"

const SA: PlatformRole[] = ["super_admin"]
const SA_SUP: PlatformRole[] = ["super_admin", "support_admin"]
const SA_CON: PlatformRole[] = ["super_admin", "content_admin"]
const ALL: PlatformRole[] = ["super_admin", "support_admin", "content_admin"]

export const ADMIN_PERMISSIONS: Record<AdminPermission, PlatformRole[]> = {
  "companies.manage": SA,
  "companies.support": SA_SUP,
  "users.manage": SA_SUP,
  "admins.manage": SA,
  "plans.manage": SA,
  "subscriptions.manage": SA,
  "billing.manage": SA,
  "catalog.manage": SA_CON,
  "orders.manage": SA_SUP,
  "points.manage": SA,
  "score.manage": SA,
  "settings.manage": SA,
  "ai.manage": SA,
  "support.manage": SA_SUP,
  "help.manage": ALL,
  "audit.export": SA_SUP,
  "revenue.view": SA,
}

export const adminCan = (role: PlatformRole | undefined, permission: AdminPermission) =>
  role !== undefined && ADMIN_PERMISSIONS[permission].includes(role)
