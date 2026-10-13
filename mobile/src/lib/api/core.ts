/**
 * API core (mobile twin of web/src/lib/api/core.ts — same exports, so the synced
 * services in src/lib/api/employee/** compile unchanged).
 *
 *   export const waterApi = {
 *     today: endpoint<void, WaterToday, "employee">("employee", "GET", "/me/water/today", (_i, ctx) => ...),
 *   }
 *
 * - Real mode  → `${EXPO_PUBLIC_API_BASE_URL}/api/v1/me/water/today` with the bearer token.
 * - Mock mode  → runs the mock function against the on-device sample database.
 *
 * Path params (":id") are filled from input fields of the same name. Remaining input
 * fields become the query string (GET/DELETE) or the JSON body (POST/PUT/PATCH).
 */
import { Platform } from "react-native"
import { apiUrl, env } from "@/config/env"
import { getSession, useAuthStore, type Portal, type SessionMap } from "@/lib/auth/session"
import type { EmployeePrivate, MockDB } from "@/lib/mock/db"

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export class ApiError extends Error {
  status: number
  code: string
  fieldErrors?: Record<string, string>
  constructor(message: string, status = 400, code = "bad_request", fieldErrors?: Record<string, string>) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

export const notFound = (what = "Record") => new ApiError(`${what} not found`, 404, "not_found")
export const forbidden = (message = "You do not have permission to do this.") => new ApiError(message, 403, "forbidden")
export const badRequest = (message: string, fieldErrors?: Record<string, string>) =>
  new ApiError(message, 422, "validation_error", fieldErrors)

// ─── Mock context ───────────────────────────────────────────────────────

export interface MockContext<P extends Portal = Portal> {
  db: MockDB
  /** Persist the sample database after a change. */
  save: () => void
  /** Current session for this portal (throws 401 if signed out). */
  session: () => SessionMap[P]
  /** Company id of the signed-in business/employee user. */
  companyId: () => string
  /** Private data of the signed-in employee (employee portal). */
  me: () => EmployeePrivate
  extra: <T>(key: string, init: () => T) => T
  now: Date
}

async function createContext<P extends Portal>(portal: P): Promise<MockContext<P>> {
  // Loaded on demand so the sample-data generator isn't needed in real-API builds.
  const { getDb, getExtra, getPrivate, saveDb } = await import("@/lib/mock/db")
  const db = getDb()
  const session = () => {
    const s = getSession(portal)
    if (!s) throw new ApiError("Your session has expired. Please sign in again.", 401, "unauthorized")
    return s
  }
  return {
    db,
    save: saveDb,
    session,
    companyId: () => {
      const s = session() as SessionMap["business"] | SessionMap["employee"]
      if (!("companyId" in s)) throw forbidden()
      return s.companyId
    },
    me: () => getPrivate(session().user.id),
    extra: getExtra,
    now: new Date(),
  }
}

const latency = () => new Promise((r) => setTimeout(r, 180 + Math.random() * 320))
const clone = <T,>(value: T): T => (value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T))

// ─── HTTP (real backend) ────────────────────────────────────────────────

function toQuery(params: Record<string, unknown>) {
  const parts: string[] = []
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue
    const values = Array.isArray(v) ? v : [v]
    values.forEach((item) => parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(item))}`))
  }
  return parts.length ? `?${parts.join("&")}` : ""
}

const CLIENT_APP = `mobile-${Platform.OS}`

/** Exchanges the refresh token for a new access token (POST /auth/refresh). */
async function refreshSession(portal: Portal): Promise<boolean> {
  const s = getSession(portal)
  if (!s?.refreshToken) return false
  try {
    const res = await fetch(apiUrl("/auth/refresh"), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "X-Client-App": CLIENT_APP },
      body: JSON.stringify({ refreshToken: s.refreshToken }),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { accessToken: string; refreshToken?: string; expiresAt?: string }
    useAuthStore.getState().updateSession(portal, {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? s.refreshToken,
      expiresAt: data.expiresAt ?? s.expiresAt,
    })
    return true
  } catch {
    return false
  }
}

export async function http<O>(portal: Portal, method: HttpMethod, path: string, input?: unknown, retried = false): Promise<O> {
  const rest: Record<string, unknown> = { ...(input as Record<string, unknown>) }
  const filledPath = path.replace(/:([A-Za-z_]+)/g, (_, key: string) => {
    const value = rest[key]
    delete rest[key]
    return encodeURIComponent(String(value ?? ""))
  })
  const isBodyMethod = method === "POST" || method === "PUT" || method === "PATCH"
  const url = apiUrl(filledPath) + (isBodyMethod ? "" : toQuery(rest))
  const session = getSession(portal)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), env.apiTimeoutMs)
  try {
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(isBodyMethod ? { "Content-Type": "application/json" } : {}),
        ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        "X-Client-App": CLIENT_APP,
      },
      body: isBodyMethod ? JSON.stringify(rest) : undefined,
    })
    if (res.status === 401 && session) {
      // Silently renew the session once, then retry; otherwise sign out.
      if (!retried && (await refreshSession(portal))) return http<O>(portal, method, path, input, true)
      useAuthStore.getState().clearSession(portal)
    }
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { message?: string; code?: string; errors?: Record<string, string> }
      throw new ApiError(payload.message ?? `Request failed (${res.status})`, res.status, payload.code ?? "http_error", payload.errors)
    }
    if (res.status === 204) return undefined as O
    return (await res.json()) as O
  } catch (err) {
    if (err instanceof ApiError) throw err
    if ((err as Error).name === "AbortError") throw new ApiError("The server took too long to respond.", 408, "timeout")
    throw new ApiError("You're offline. Check your connection and try again.", 0, "network_error")
  } finally {
    clearTimeout(timer)
  }
}

// ─── Endpoint factory ───────────────────────────────────────────────────

export function endpoint<I = void, O = unknown, P extends Portal = Portal>(
  portal: P,
  method: HttpMethod,
  path: string,
  mock: (input: I, ctx: MockContext<P>) => O | Promise<O>,
) {
  const call = async (input: I): Promise<O> => {
    if (!env.useMock) return http<O>(portal, method, path, input)
    await latency()
    const ctx = await createContext(portal)
    const result = await mock(clone(input), ctx)
    return clone(result)
  }
  return Object.assign(call, { method, path, portal })
}

// ─── Mock helpers ───────────────────────────────────────────────────────

export function paginate<T>(items: T[], page = 1, pageSize = 20) {
  const start = (page - 1) * pageSize
  return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize }
}

export function matchesSearch(search: string | undefined, ...fields: (string | undefined | null)[]) {
  if (!search) return true
  const q = search.trim().toLowerCase()
  return fields.some((f) => f?.toLowerCase().includes(q))
}

export function sortBy<T>(items: T[], key: keyof T | ((item: T) => string | number), order: "asc" | "desc" = "asc") {
  const get = typeof key === "function" ? key : (item: T) => item[key] as unknown as string | number
  return [...items].sort((a, b) => {
    const va = get(a)
    const vb = get(b)
    const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb))
    return order === "asc" ? cmp : -cmp
  })
}

/** Records an audit entry in the sample data (who did what). */
export function audit(
  ctx: MockContext,
  entry: { action: string; entityType: string; entityName: string; companyId?: string | null; severity?: "info" | "warning" | "critical" },
) {
  const s = ctx.session() as SessionMap[Portal]
  ctx.db.auditLogs.unshift({
    id: `aud_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    companyId: entry.companyId ?? null,
    actorName: s.user.name,
    actorRole: String(s.role).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    action: entry.action,
    entityType: entry.entityType,
    entityName: entry.entityName,
    ip: "device",
    createdAt: new Date().toISOString(),
    severity: entry.severity ?? "info",
  })
}

export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
