"use client"

/**
 * Business Portal permissions — what each company role may do (docs/roles-permissions.md).
 * Pages use `useCan()` to show/hide actions; the API enforces the same rules.
 */
import type { BusinessRole } from "@/lib/types"
import { useSession } from "./session"

const O: BusinessRole = "company_owner"
const H: BusinessRole = "hr_admin"
const W: BusinessRole = "wellness_manager"
const T: BusinessRole = "team_manager"

export const BUSINESS_PERMISSIONS = {
  "employees.view": [O, H],
  "employees.manage": [O, H],
  "org.manage": [O, H],
  "admins.manage": [O],
  "challenges.view": [O, H, W, T],
  "challenges.manage": [O, H, W],
  "leaderboards.view": [O, H, W, T],
  "announcements.manage": [O, H, W],
  "rewards.manage": [O],
  "orders.view": [O, H],
  "orders.manage": [O, H],
  "points.manage": [O, H],
  "analytics.view": [O, H, W],
  "reports.view": [O, H],
  "programs.manage": [O, H, W],
  "content.manage": [O, W],
  "settings.manage": [O],
  "integrations.manage": [O, H],
  "billing.view": [O],
  "audit.view": [O],
  "team.view": [T],
} as const satisfies Record<string, readonly BusinessRole[]>

export type BusinessPermission = keyof typeof BUSINESS_PERMISSIONS

export function hasPermission(role: BusinessRole | undefined, permission: BusinessPermission) {
  return !!role && (BUSINESS_PERMISSIONS[permission] as readonly BusinessRole[]).includes(role)
}

/** const can = useCan(); can("challenges.manage") */
export function useCan() {
  const session = useSession("business")
  return (permission: BusinessPermission) => hasPermission(session?.role, permission)
}
