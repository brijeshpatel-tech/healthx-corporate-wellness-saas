/**
 * Sign-in sessions (mobile twin of web/src/lib/auth/session.ts — same exports, so the
 * synced services compile unchanged). The mobile app only uses the "employee" portal.
 *
 * Persistence: zustand `persist` → AsyncStorage. The access / refresh tokens are split
 * out and kept in the device keychain / keystore (expo-secure-store) on iOS and Android.
 */
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as SecureStore from "expo-secure-store"
import { useSyncExternalStore } from "react"
import { Platform } from "react-native"
import { create } from "zustand"
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware"
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
  /** Company chosen on the "Find your company" screen before sign-in. */
  pendingCompany?: { id: string; name: string; code: string }
  setSession: <P extends Portal>(portal: P, session: SessionMap[P]) => void
  updateSession: <P extends Portal>(portal: P, patch: Partial<SessionMap[P]>) => void
  clearSession: (portal: Portal) => void
  setPendingCompany: (company: AuthState["pendingCompany"]) => void
}

// ─── Storage: state in AsyncStorage, tokens in SecureStore (native) ─────

const TOKENS_KEY = "healthx.tokens"
const useSecureStore = Platform.OS === "ios" || Platform.OS === "android"

type Tokens = Partial<Record<Portal, { accessToken: string; refreshToken?: string }>>
type Persisted = { state: { sessions?: Partial<SessionMap> } & Record<string, unknown>; version?: number }

const sessionStorage: StateStorage = {
  getItem: async (name) => {
    const raw = await AsyncStorage.getItem(name)
    if (!raw || !useSecureStore) return raw
    try {
      const data = JSON.parse(raw) as Persisted
      const tokens = JSON.parse((await SecureStore.getItemAsync(TOKENS_KEY)) ?? "{}") as Tokens
      const sessions = { ...data.state.sessions }
      for (const portal of Object.keys(sessions) as Portal[]) {
        const t = tokens[portal]
        // A session without its tokens can't be used — drop it (user signs in again).
        if (!t) delete sessions[portal]
        else sessions[portal] = { ...sessions[portal]!, ...t } as never
      }
      return JSON.stringify({ ...data, state: { ...data.state, sessions } })
    } catch {
      return null
    }
  },
  setItem: async (name, value) => {
    if (!useSecureStore) return AsyncStorage.setItem(name, value)
    const data = JSON.parse(value) as Persisted
    const tokens: Tokens = {}
    const sessions: Record<string, unknown> = {}
    for (const [portal, s] of Object.entries(data.state.sessions ?? {}) as [Portal, SessionMap[Portal]][]) {
      const { accessToken, refreshToken, ...rest } = s
      tokens[portal] = { accessToken, refreshToken }
      sessions[portal] = rest
    }
    await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(tokens))
    await AsyncStorage.setItem(name, JSON.stringify({ ...data, state: { ...data.state, sessions } }))
  },
  removeItem: async (name) => {
    if (useSecureStore) await SecureStore.deleteItemAsync(TOKENS_KEY)
    await AsyncStorage.removeItem(name)
  },
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
    { name: "healthx.sessions", storage: createJSONStorage(() => sessionStorage) },
  ),
)

/** Read a session outside React (API layer). */
export function getSession<P extends Portal>(portal: P): SessionMap[P] | undefined {
  return useAuthStore.getState().sessions[portal] as SessionMap[P] | undefined
}

/** True once the saved sessions have been loaded from device storage. */
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

/** Mobile routes (Expo Router). Only the employee portal exists in the mobile app. */
export const LOGIN_PATH: Record<Portal, string> = {
  admin: "/welcome",
  business: "/welcome",
  employee: "/welcome",
}

export const HOME_PATH: Record<Portal, string> = {
  admin: "/home",
  business: "/home",
  employee: "/home",
}

/** Where a signed-in employee who hasn't finished onboarding goes. */
export const ONBOARDING_PATH = "/onboarding/profile"
