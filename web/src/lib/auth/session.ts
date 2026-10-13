"use client"

/**
 * Sign-in sessions for the three web apps. Each portal keeps its own session,
 * so you can be signed in to the Admin Portal and the Employee App at once.
 */
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { useSyncExternalStore } from "react"
import type { BusinessRole, EmployeeAppRole, PlatformRole } from "@/lib/types"

export type Portal = "admin" | "business" | "employee"

export interface SessionUser {
  id: string
  name: string
  email: string
  avatarColor: string
  jobTitle?: string
}

interface BaseSession {
  accessToken: string
  refreshToken?: string
  expiresAt: string
  user: SessionUser
}

export interface AdminSession extends BaseSession {
  role: PlatformRole
}

export interface BusinessSession extends BaseSession {
  role: BusinessRole
  companyId: string
  companyName: string
  /** Team ids the user manages (Team Manager only). */
  teamIds: string[]
}

export interface EmployeeSession extends BaseSession {
  role: EmployeeAppRole
  companyId: string
  companyName: string
  onboardingCompleted: boolean
}

export interface SessionMap {
  admin: AdminSession
  business: BusinessSession
  employee: EmployeeSession
}

interface AuthState {
  sessions: Partial<SessionMap>
  /** Company chosen on the employee app's "Find your company" screen before sign-in. */
  pendingCompany?: { id: string; name: string; code: string }
  setSession: <P extends Portal>(portal: P, session: SessionMap[P]) => void
  updateSession: <P extends Portal>(portal: P, patch: Partial<SessionMap[P]>) => void
  clearSession: (portal: Portal) => void
  setPendingCompany: (company: AuthState["pendingCompany"]) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      sessions: {},
      setSession: (portal, session) => set((s) => ({ sessions: { ...s.sessions, [portal]: session } })),
      updateSession: (portal, patch) =>
        set((s) => {
          const current = s.sessions[portal]
          if (!current) return s
          return { sessions: { ...s.sessions, [portal]: { ...current, ...patch } } }
        }),
      clearSession: (portal) =>
        set((s) => {
          const next = { ...s.sessions }
          delete next[portal]
          return { sessions: next }
        }),
      setPendingCompany: (pendingCompany) => set({ pendingCompany }),
    }),
    { name: "healthx.sessions", storage: createJSONStorage(() => localStorage) },
  ),
)

/** Read a session outside React (API layer). */
export function getSession<P extends Portal>(portal: P): SessionMap[P] | undefined {
  return useAuthStore.getState().sessions[portal] as SessionMap[P] | undefined
}

/** True once the persisted sessions have loaded in the browser. */
export function useAuthHydrated() {
  return useSyncExternalStore(
    (onChange) => useAuthStore.persist.onFinishHydration(onChange),
    () => useAuthStore.persist.hasHydrated(),
    () => false,
  )
}

export function useSession<P extends Portal>(portal: P): SessionMap[P] | undefined {
  return useAuthStore((s) => s.sessions[portal]) as SessionMap[P] | undefined
}

export const LOGIN_PATH: Record<Portal, string> = {
  admin: "/admin-portal/login",
  business: "/business-portal/login",
  employee: "/employee-app/welcome",
}

export const HOME_PATH: Record<Portal, string> = {
  admin: "/admin-portal/dashboard",
  business: "/business-portal/dashboard",
  employee: "/employee-app/home",
}
