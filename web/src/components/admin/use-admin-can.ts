"use client"

import { useCallback } from "react"
import { adminCan, type AdminPermission } from "@/lib/api/platform/permissions"
import { useSession } from "@/lib/auth/session"

/**
 * Action-level permission check for the Platform Admin Portal.
 *   const can = useAdminCan()
 *   {can("plans.manage") ? <Button>Edit</Button> : null}
 */
export function useAdminCan() {
  const role = useSession("admin")?.role
  return useCallback((permission: AdminPermission) => adminCan(role, permission), [role])
}
