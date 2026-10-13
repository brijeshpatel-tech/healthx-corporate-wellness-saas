"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import { employeeAuthApi } from "@/lib/api/auth"
import { LOGIN_PATH, useAuthStore } from "@/lib/auth/session"

/**
 * Employee sign-out (same steps as the shell's account menu): revoke the session
 * (ignoring network errors — it's revoked when back online), clear local data, go to sign-in.
 */
export function useEmployeeSignOut(redirectTo: string = LOGIN_PATH.employee) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)

  const signOut = useCallback(async () => {
    setPending(true)
    try {
      await employeeAuthApi.logout()
    } catch {
      // ignore — local sign-out is enough
    }
    useAuthStore.getState().clearSession("employee")
    queryClient.clear()
    router.replace(redirectTo)
  }, [queryClient, redirectTo, router])

  return { signOut, pending }
}
