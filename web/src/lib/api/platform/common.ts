/**
 * Shared helpers for Platform Admin mock services (portal "admin").
 * Keep this file free of `@/lib/mock/seed` and `@/lib/mock/random` imports.
 */
import type { AdminSession } from "@/lib/auth/session"
import { AVATAR_COLORS, DAY_MS, noise } from "@/lib/mock/series"
import type { Company, Plan } from "@/lib/types"
import { forbidden, notFound, type MockContext } from "../core"
import { adminCan, type AdminPermission } from "./permissions"

export type AdminCtx = MockContext<"admin">

/** Current HealthX admin; optionally checks an action permission (403 otherwise). */
export function requireAdmin(ctx: AdminCtx, permission?: AdminPermission): AdminSession {
  const s = ctx.session() as AdminSession
  if (permission && !adminCan(s.role, permission)) throw forbidden("Your HealthX role can't do this. Ask a Super Admin.")
  return s
}

// ─── Periods ────────────────────────────────────────────────────────────

export const PERIOD_DAYS = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 } as const
export type Period = keyof typeof PERIOD_DAYS
export const PERIOD_LABEL: Record<Period, string> = { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", "12m": "Last 12 months" }

export const withinDays = (iso: string | undefined, days: number, now = Date.now()) => !!iso && now - new Date(iso).getTime() <= days * DAY_MS

// ─── Numbers ────────────────────────────────────────────────────────────

export const ratio = (a: number, b: number) => (b > 0 ? a / b : 0)
export const sum = <T>(items: T[], get: (item: T) => number) => items.reduce((a, i) => a + get(i), 0)
export const round = (value: number, digits = 0) => Number(value.toFixed(digits))

// ─── Lookups ────────────────────────────────────────────────────────────

export function findCompany(ctx: AdminCtx, id: string): Company {
  const c = ctx.db.companies.find((x) => x.id === id)
  if (!c) throw notFound("Company")
  return c
}

export const companyName = (ctx: AdminCtx, id: string | null | undefined) => (id ? ctx.db.companies.find((c) => c.id === id)?.name ?? "Unknown company" : "HealthX Platform")

export const planOf = (ctx: AdminCtx, id: string): Plan | undefined => ctx.db.plans.find((p) => p.id === id)

/** Lightweight option lists used by filters across admin screens. */
export const companyOptions = (ctx: AdminCtx) =>
  [...ctx.db.companies].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, name: c.name, status: c.status, planId: c.planId }))

// ─── CSV ────────────────────────────────────────────────────────────────

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const toCsv = (header: string[], rows: unknown[][]) => [header.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n")

export const today = () => new Date().toISOString().slice(0, 10)

// ─── Synthetic people (for companies without full employee records) ──────

const FIRST = ["Aarav", "Diya", "Rohan", "Isha", "Kabir", "Meera", "Arjun", "Nisha", "Vivaan", "Anika", "Aditya", "Kavya", "Siddharth", "Pooja", "Rahul", "Tanvi", "Nikhil", "Riya", "Varun", "Sana", "Karthik", "Lakshmi", "Manish", "Neha", "Yash", "Shreya", "Harsh", "Ira", "Dev", "Aditi"]
const LAST = ["Sharma", "Iyer", "Reddy", "Nair", "Gupta", "Patel", "Menon", "Kulkarni", "Banerjee", "Rao", "Singh", "Joshi", "Desai", "Chopra", "Pillai", "Mukherjee", "Bhat", "Kapoor", "Agarwal", "Shetty"]

/** Deterministic full name for (key, index). */
export function syntheticPerson(key: string, index: number) {
  const first = FIRST[Math.floor(noise(key, index * 3) * FIRST.length)]!
  const last = LAST[Math.floor(noise(key, index * 3 + 1) * LAST.length)]!
  const color = AVATAR_COLORS[Math.floor(noise(key, index * 3 + 2) * AVATAR_COLORS.length)]!
  return { first, last, name: `${first} ${last}`, color }
}

export const emailFor = (first: string, last: string, domain: string) => `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "") + `@${domain}`
