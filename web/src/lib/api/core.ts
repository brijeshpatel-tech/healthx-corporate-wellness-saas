/**
 * API core. Every service function is declared once with its real REST route
 * and a mock implementation:
 *
 *   export const employeesApi = {
 *     list: endpoint<EmployeeQuery, Paginated<Employee>>("business", "GET", "/organization/employees", (q, ctx) => ...),
 *   }
 *
 * - Real mode  → calls `${NEXT_PUBLIC_API_BASE_URL}/api/v1/organization/employees?…` with the portal's bearer token.
 * - Mock mode  → runs the mock function against the in-browser sample database.
 *
 * Path params (":id") are filled from input fields of the same name. Remaining input
 * fields become the query string (GET/DELETE) or the JSON body (POST/PUT/PATCH).
 */
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
  // Loaded on demand so the sample-data generator never ships in real-API builds' main bundle.
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
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue
    if (Array.isArray(v)) v.forEach((item) => qs.append(k, String(item)))
    else qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `?${s}` : ""
}

export async function http<O>(portal: Portal, method: HttpMethod, path: string, input?: unknown): Promise<O> {
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
        "X-Client-App": `web-${portal}`,
      },
      body: isBodyMethod ? JSON.stringify(rest) : undefined,
    })
    if (res.status === 401) useAuthStore.getState().clearSession(portal)
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { message?: string; code?: string; errors?: Record<string, string> }
      throw new ApiError(payload.message ?? res.statusText, res.status, payload.code ?? "http_error", payload.errors)
    }
    if (res.status === 204) return undefined as O
    return (await res.json()) as O
  } catch (err) {
    if (err instanceof ApiError) throw err
    if ((err as Error).name === "AbortError") throw new ApiError("The server took too long to respond.", 408, "timeout")
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0, "network_error")
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
    ip: "127.0.0.1",
    createdAt: new Date().toISOString(),
    severity: entry.severity ?? "info",
  })
}

export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
