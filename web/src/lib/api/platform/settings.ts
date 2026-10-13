/**
 * Platform Admin — System configuration (SCR-P-023).
 * Global settings live in `db.systemSettings` (read by the apps, e.g. minimum app versions),
 * legal document versions in extra storage. Every change is audit-logged.
 */
import { DAY_MS } from "@/lib/mock/series"
import type { SystemSetting } from "@/lib/types"
import { audit, badRequest, endpoint } from "../core"
import { requireAdmin, type AdminCtx } from "./common"

export type SettingGroup = SystemSetting["group"]
export type SettingValue = SystemSetting["value"]

export const SETTING_GROUPS: { id: SettingGroup; title: string; description: string }[] = [
  { id: "app", title: "App & defaults", description: "Mobile app versions, maintenance mode and the defaults new employees start with." },
  { id: "security", title: "Security", description: "Sign-in, sessions, invitations and one-time codes for every account." },
  { id: "notifications", title: "Notifications", description: "Limits and senders for push notifications and emails." },
  { id: "data", title: "Data & analytics privacy", description: "Privacy thresholds, retention and how often data refreshes." },
  { id: "integrations", title: "Integrations & feature flags", description: "Turn health-data sources and integrations on or off platform-wide." },
]

/** Validation rules for number settings (also used by the form). */
export const SETTING_LIMITS: Record<string, { min: number; max: number; unit?: string }> = {
  "app.default_step_goal": { min: 1000, max: 30000, unit: "steps" },
  "app.default_water_goal_ml": { min: 500, max: 6000, unit: "ml" },
  "security.session_timeout_min": { min: 5, max: 240, unit: "min" },
  "security.password_min_length": { min: 8, max: 64, unit: "chars" },
  "security.invitation_expiry_days": { min: 1, max: 90, unit: "days" },
  "security.otp_expiry_min": { min: 1, max: 30, unit: "min" },
  "notifications.daily_push_limit": { min: 1, max: 20 },
  "data.min_group_size": { min: 3, max: 50, unit: "people" },
  "data.retention_days_inactive": { min: 7, max: 365, unit: "days" },
  "data.health_sync_interval_min": { min: 15, max: 1440, unit: "min" },
  "data.leaderboard_refresh_min": { min: 5, max: 1440, unit: "min" },
}

/** Settings the spec lists that are not in the original sample data — added once. */
const EXTRA_SETTINGS: Omit<SystemSetting, "updatedAt">[] = [
  { key: "app.default_step_goal", label: "Default daily step goal", description: "Starting step goal for new employees (they can change it).", group: "app", type: "number", value: 8000 },
  { key: "app.default_water_goal_ml", label: "Default daily water goal (ml)", description: "Starting water goal for new employees.", group: "app", type: "number", value: 2500 },
  { key: "security.invitation_expiry_days", label: "Invitation link expiry (days)", description: "Invitation links stop working after this many days.", group: "security", type: "number", value: 14 },
  { key: "security.otp_expiry_min", label: "One-time code expiry (minutes)", description: "Sign-in and verification codes expire after this time.", group: "security", type: "number", value: 10 },
  { key: "data.leaderboard_refresh_min", label: "Leaderboard refresh interval (minutes)", description: "How often leaderboards are recalculated.", group: "data", type: "number", value: 15 },
]

const VERSION_RE = /^\d+\.\d+\.\d+$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Field name used in forms (React Hook Form treats dots as nesting). */
export const settingField = (key: string) => key.replace(/\./g, "__")

function ensureSettings(ctx: AdminCtx) {
  let added = false
  for (const s of EXTRA_SETTINGS) {
    if (!ctx.db.systemSettings.some((x) => x.key === s.key)) {
      ctx.db.systemSettings.push({ ...s, updatedAt: new Date(Date.now() - 45 * DAY_MS).toISOString() })
      added = true
    }
  }
  if (added) ctx.save()
  return ctx.db.systemSettings
}

// ─── Legal documents ────────────────────────────────────────────────────

export type LegalDocKind = "terms" | "privacy"
export const LEGAL_DOC_LABEL: Record<LegalDocKind, string> = { terms: "Terms of Service", privacy: "Privacy Policy" }

export interface LegalVersion {
  version: string
  summary: string
  effectiveDate: string
  publishedAt: string
  publishedBy: string
}

type LegalStore = Record<LegalDocKind, LegalVersion[]>

const legalStore = (ctx: AdminCtx) =>
  ctx.extra<LegalStore>("admin-legal-docs", () => ({
    terms: [
      { version: "2.0", summary: "Added rewards and redemption terms; clarified points have no cash value.", effectiveDate: "2026-06-01", publishedAt: "2026-05-18T09:00:00.000Z", publishedBy: "Arjun Nair" },
      { version: "1.0", summary: "Initial Terms of Service for HealthX Business.", effectiveDate: "2026-03-01", publishedAt: "2026-02-20T09:00:00.000Z", publishedBy: "Arjun Nair" },
    ],
    privacy: [
      { version: "1.3", summary: "Explained aggregated analytics for employers and the minimum group size.", effectiveDate: "2026-07-15", publishedAt: "2026-07-01T09:00:00.000Z", publishedBy: "Arjun Nair" },
      { version: "1.2", summary: "Added Health Connect and Apple Health data handling.", effectiveDate: "2026-04-10", publishedAt: "2026-04-01T09:00:00.000Z", publishedBy: "Arjun Nair" },
      { version: "1.0", summary: "Initial Privacy Policy.", effectiveDate: "2026-03-01", publishedAt: "2026-02-20T09:00:00.000Z", publishedBy: "Arjun Nair" },
    ],
  }))

const compareVersions = (a: string, b: string) => {
  const pa = a.split(".").map(Number)
  const pb = b.split(".").map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d
  }
  return 0
}

// ─── Types ──────────────────────────────────────────────────────────────

export interface SettingsGroupView {
  id: SettingGroup
  title: string
  description: string
  settings: SystemSetting[]
  updatedAt: string | null
  updatedBy: string | null
}

export interface SystemConfig {
  groups: SettingsGroupView[]
  maintenanceMode: boolean
  legal: Record<LegalDocKind, { current: LegalVersion | null; history: LegalVersion[] }>
}

export interface UpdateConfigInput {
  group: SettingGroup
  values: Record<string, SettingValue>
}

export interface PublishLegalInput {
  document: LegalDocKind
  version: string
  summary: string
  effectiveDate: string
}

const updatedByStore = (ctx: AdminCtx) => ctx.extra<Record<string, string>>("admin-config-updated-by", () => ({}))

function validateValue(s: SystemSetting, raw: SettingValue): { value?: SettingValue; error?: string } {
  if (s.type === "boolean") return typeof raw === "boolean" ? { value: raw } : { error: "Choose on or off" }
  if (s.type === "number") {
    const n = typeof raw === "number" ? raw : Number(raw)
    if (raw === "" || !Number.isFinite(n)) return { error: "Enter a number" }
    if (!Number.isInteger(n)) return { error: "Use a whole number" }
    const lim = SETTING_LIMITS[s.key]
    if (lim && (n < lim.min || n > lim.max)) return { error: `Must be between ${lim.min} and ${lim.max}` }
    if (!lim && n < 0) return { error: "Must be 0 or more" }
    return { value: n }
  }
  const v = String(raw ?? "").trim()
  if (s.type === "select") return s.options?.includes(v) ? { value: v } : { error: "Choose an option" }
  if (!v) return { error: "This field is required" }
  if (s.key.startsWith("app.min_version") && !VERSION_RE.test(v)) return { error: "Use a version like 1.4.0" }
  if (s.key.endsWith("sender_email") && !EMAIL_RE.test(v)) return { error: "Enter a valid email address" }
  return { value: v.slice(0, 200) }
}

const show = (s: SystemSetting, v: SettingValue) => (s.type === "boolean" ? (v ? "On" : "Off") : String(v))

export const settingsApi = {
  get: endpoint<void, SystemConfig, "admin">("admin", "GET", "/platform/config", (_, ctx) => {
    requireAdmin(ctx)
    const all = ensureSettings(ctx)
    const by = updatedByStore(ctx)
    const legal = legalStore(ctx)
    const groups = SETTING_GROUPS.map((g) => {
      const settings = all.filter((s) => s.group === g.id)
      const latest = [...settings].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
      return { ...g, settings, updatedAt: latest?.updatedAt ?? null, updatedBy: latest ? by[latest.key] ?? null : null }
    })
    return {
      groups,
      maintenanceMode: all.find((s) => s.key === "app.maintenance_mode")?.value === true,
      legal: {
        terms: { current: legal.terms[0] ?? null, history: legal.terms },
        privacy: { current: legal.privacy[0] ?? null, history: legal.privacy },
      },
    }
  }),

  update: endpoint<UpdateConfigInput, { changed: number }, "admin">("admin", "PUT", "/platform/config", ({ group, values }, ctx) => {
    const session = requireAdmin(ctx, "settings.manage")
    const all = ensureSettings(ctx)
    const errors: Record<string, string> = {}
    const changes: { s: SystemSetting; value: SettingValue }[] = []
    for (const [key, raw] of Object.entries(values)) {
      const s = all.find((x) => x.key === key && x.group === group)
      if (!s) continue
      const res = validateValue(s, raw)
      if (res.error) errors[settingField(key)] = res.error
      else if (res.value !== s.value) changes.push({ s, value: res.value! })
    }
    if (Object.keys(errors).length) throw badRequest("Couldn't save configuration. Please fix the highlighted fields.", errors)
    const now = new Date().toISOString()
    const by = updatedByStore(ctx)
    for (const { s, value } of changes) {
      const before = s.value
      s.value = value
      s.updatedAt = now
      by[s.key] = session.user.name
      const critical = s.key === "app.maintenance_mode" || s.key === "security.require_mfa_admins"
      audit(ctx, {
        action: s.key === "app.maintenance_mode" ? (value ? "Turned on maintenance mode" : "Turned off maintenance mode") : "Updated system setting",
        entityType: "System",
        entityName: s.label,
        severity: critical ? "critical" : "warning",
      })
      ctx.db.auditLogs[0]!.details = `${s.key}: ${show(s, before)} → ${show(s, value)}`
    }
    ctx.save()
    return { changed: changes.length }
  }),

  publishLegal: endpoint<PublishLegalInput, LegalVersion, "admin">("admin", "POST", "/platform/legal-documents", (input, ctx) => {
    const session = requireAdmin(ctx, "settings.manage")
    const store = legalStore(ctx)
    const list = store[input.document]
    if (!list) throw badRequest("Choose a document.", { document: "Choose a document" })
    const version = input.version.trim()
    const errors: Record<string, string> = {}
    if (!/^\d+(\.\d+){0,2}$/.test(version)) errors.version = "Use a version like 2.1"
    else if (list[0] && compareVersions(version, list[0].version) <= 0) errors.version = `Must be higher than the current version (${list[0].version})`
    if (input.summary.trim().length < 10) errors.summary = "Describe the changes (at least 10 characters)"
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)) errors.effectiveDate = "Choose an effective date"
    else if (input.effectiveDate < new Date(Date.now() - DAY_MS).toISOString().slice(0, 10)) errors.effectiveDate = "The effective date can't be in the past"
    if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
    const entry: LegalVersion = { version, summary: input.summary.trim(), effectiveDate: input.effectiveDate, publishedAt: new Date().toISOString(), publishedBy: session.user.name }
    list.unshift(entry)
    audit(ctx, { action: `Published ${LEGAL_DOC_LABEL[input.document]} v${version}`, entityType: "Legal document", entityName: LEGAL_DOC_LABEL[input.document], severity: "critical" })
    ctx.db.auditLogs[0]!.details = `Effective ${input.effectiveDate}. Employees are asked to accept the new version on next sign-in. Changes: ${entry.summary}`
    ctx.save()
    return entry
  }),
}
