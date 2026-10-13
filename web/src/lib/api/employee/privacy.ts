/**
 * Employee app — privacy & data rights (own data only).
 * SCR-M-075 Privacy & Consent Centre, SCR-M-076 Connected Apps & Devices,
 * SCR-M-077 Download My Data (Phase 2), SCR-M-078 Delete Account.
 * Fitbit/Garmin are Phase 2 (OAuth); "other wearables" (#286) is out of scope.
 */
import type { EmployeePrivate } from "@/lib/mock/db"
import type { Consent, ConsentKey, Employee, HealthConnection, HealthProvider, LeaderboardNameDisplay } from "@/lib/types"
import { DAY_MS } from "@/lib/mock/series"
import { audit, badRequest, endpoint, forbidden, newId, notFound, type MockContext } from "../core"
import { DELETION_GRACE_DAYS, PROVIDER_NAME, deletionDueDate, photoOf } from "./profile"

type Ctx = MockContext<"employee">

// ─── Types ──────────────────────────────────────────────────────────────

export type ConsentHistoryKey = ConsentKey | "leaderboard_visibility" | "shoutouts"

export interface ConsentHistoryEntry {
  id: string
  key: ConsentHistoryKey
  title: string
  action: "granted" | "withdrawn"
  version: string
  at: string
  note?: string
}

export interface ConsentCentre {
  consents: Consent[]
  companyName: string
  minGroupSize: number
  leaderboard: {
    nameDisplay: LeaderboardNameDisplay
    /** How the employee's name currently appears, e.g. "Priya S." */
    example: string
    allowOptOut: boolean
    /** true = appears as "Anonymous" on leaderboards. */
    hidden: boolean
    updatedAt?: string
  }
  /** Slack / Teams shout-outs (Phase 2). */
  shoutouts: { granted: boolean; updatedAt?: string; companyConnected: boolean }
  connectedApps: string[]
  deletionRequestedAt?: string
  dataExportRequestedAt?: string
}

export type ConnectionProvider = HealthProvider
export type ConnectionStatus = "not_connected" | "connected" | "error" | "disconnected"

export interface ConnectionRow {
  provider: ConnectionProvider
  name: string
  platform: string
  description: string
  status: ConnectionStatus
  /** Phase 2 providers (Fitbit, Garmin — OAuth). */
  phase?: 2
  connectedAt?: string
  lastSyncAt?: string
  disconnectedAt?: string
  dataTypes: string[]
}

export interface ConnectionsOverview {
  rows: ConnectionRow[]
  anyConnected: boolean
  wearableConsent: boolean
  minGroupSize: number
}

export interface DataExport {
  id: string
  requestedAt: string
  readyAt: string
  expiresAt: string
  status: "preparing" | "ready" | "expired"
  /** 0..1 while preparing. */
  progress: number
  fileName: string
}

export interface DataExportOverview {
  current: DataExport | null
  included: { key: string; label: string; description: string }[]
  linkValidDays: number
}

export interface DeletionInfo {
  requestedAt?: string
  deleteBy?: string
  graceDays: number
  pointsBalance: number
  pendingOrders: number
  completedOrders: number
  badgesCount: number
  connectedApps: string[]
  email: string
}

export interface DeletionRequestInput {
  reason?: string
  details?: string
  confirmation: string
  method: "password" | "code"
  password?: string
  code?: string
}

// ─── Constants ──────────────────────────────────────────────────────────

const PROVIDERS: Record<HealthProvider, { platform: string; description: string; phase?: 2 }> = {
  apple_health: { platform: "iPhone & Apple Watch", description: "Steps, workouts and sleep from your iPhone or Apple Watch." },
  health_connect: { platform: "Android phones & Wear OS", description: "Steps, exercise and sleep from Android apps and watches." },
  fitbit: { platform: "Fitbit trackers & watches", description: "Sign in with your Fitbit account to sync steps, activity and sleep.", phase: 2 },
  garmin: { platform: "Garmin watches", description: "Sign in with Garmin Connect to sync activity, workouts and sleep.", phase: 2 },
}

const EXPORT_PREPARE_MS = 20_000
const EXPORT_VALID_DAYS = 7

const EXPORT_INCLUDES: DataExportOverview["included"] = [
  { key: "profile", label: "Profile & preferences", description: "Your contact details, wellness details, goals and settings." },
  { key: "activity", label: "Activity & steps", description: "Daily steps, distance, active minutes and logged sessions." },
  { key: "water_sleep", label: "Water & sleep", description: "Every water log and sleep record." },
  { key: "workouts_habits", label: "Workouts & habits", description: "Workout history and habit check-ins." },
  { key: "points", label: "Points, badges & orders", description: "Your points ledger, badges and reward orders." },
  { key: "consents", label: "Consents & connections", description: "Your privacy choices, their history and connected apps." },
]

const COMPANY_NAME_LABEL: Record<LeaderboardNameDisplay, string> = {
  full_name: "Full name",
  first_name_initial: "First name and last initial",
  anonymous: "Anonymous",
}
export { COMPANY_NAME_LABEL as LEADERBOARD_NAME_LABEL }

// ─── Extra sample data owned by this feature ───────────────────────────

const historyStore = (ctx: Ctx) => ctx.extra("emp-consent-history", () => ({}) as Record<string, ConsentHistoryEntry[]>)
const privacyExtra = (ctx: Ctx) =>
  ctx.extra("emp-privacy-extra", () => ({}) as Record<string, { shoutouts?: boolean; shoutoutsUpdatedAt?: string; leaderboardUpdatedAt?: string }>)
const healthMeta = (ctx: Ctx) => ctx.extra("emp-health-meta", () => ({}) as Record<string, Partial<Record<HealthProvider, { disconnectedAt?: string }>>>)
const exportStore = (ctx: Ctx) => ctx.extra("emp-data-exports", () => ({}) as Record<string, { id: string; requestedAt: string; notified?: boolean }>)
const deletionStore = (ctx: Ctx) => ctx.extra("emp-deletion-requests", () => ({}) as Record<string, { reason?: string; details?: string; at: string }>)

// ─── Helpers ────────────────────────────────────────────────────────────

function employeeOf(ctx: Ctx, me: EmployeePrivate): Employee {
  const emp = ctx.db.employees.find((e) => e.id === me.employeeId)
  if (!emp) throw notFound("Employee")
  return emp
}

function settingsOf(ctx: Ctx, emp: Employee) {
  const s = ctx.db.settings[emp.companyId]
  return {
    minGroupSize: s?.minAnalyticsGroupSize ?? 5,
    nameDisplay: s?.leaderboardNameDisplay ?? "first_name_initial",
    allowOptOut: s?.allowLeaderboardOptOut ?? true,
  }
}

const exampleName = (emp: Employee, mode: LeaderboardNameDisplay) =>
  mode === "full_name" ? `${emp.firstName} ${emp.lastName}` : mode === "first_name_initial" ? `${emp.firstName} ${emp.lastName.charAt(0)}.` : "Colleague #1042"

/** Consent history — seeded from the current consents the first time it's read. */
function historyOf(ctx: Ctx, me: EmployeePrivate): ConsentHistoryEntry[] {
  const store = historyStore(ctx)
  if (!store[me.employeeId]) {
    store[me.employeeId] = me.consents
      .map((c) => ({
        id: newId("cnh"),
        key: c.key,
        title: c.title,
        action: c.granted ? ("granted" as const) : ("withdrawn" as const),
        version: c.version,
        at: c.updatedAt,
        note: c.granted ? "Given when you joined HealthX" : "Not given when you joined HealthX",
      }))
      .sort((a, b) => b.at.localeCompare(a.at))
    ctx.save()
  }
  return store[me.employeeId]!
}

function record(ctx: Ctx, me: EmployeePrivate, entry: Omit<ConsentHistoryEntry, "id" | "at"> & { at?: string }) {
  const list = historyOf(ctx, me)
  list.unshift({ id: newId("cnh"), at: entry.at ?? new Date().toISOString(), ...entry })
}

const connectedNames = (me: EmployeePrivate) => me.healthConnections.filter((h) => h.status === "connected").map((h) => PROVIDER_NAME[h.provider] ?? h.provider)

function syncHealthFlag(ctx: Ctx, me: EmployeePrivate) {
  const emp = employeeOf(ctx, me)
  emp.healthConnected = me.healthConnections.some((h) => h.status === "connected")
}

/** Disconnects every connected/erroring health app. Returns the names disconnected. */
function disconnectAll(ctx: Ctx, me: EmployeePrivate) {
  const meta = (healthMeta(ctx)[me.employeeId] ??= {})
  const names: string[] = []
  const now = new Date().toISOString()
  for (const h of me.healthConnections) {
    if (h.status === "connected" || h.status === "error") {
      h.status = "disconnected"
      h.connectedAt = undefined
      meta[h.provider] = { disconnectedAt: now }
      names.push(PROVIDER_NAME[h.provider] ?? h.provider)
    }
  }
  syncHealthFlag(ctx, me)
  return names
}

function centre(ctx: Ctx): ConsentCentre {
  const me = ctx.me()
  const emp = employeeOf(ctx, me)
  const s = settingsOf(ctx, emp)
  const x = privacyExtra(ctx)[me.employeeId] ?? {}
  return {
    consents: me.consents,
    companyName: ctx.db.companies.find((c) => c.id === emp.companyId)?.name ?? "your company",
    minGroupSize: s.minGroupSize,
    leaderboard: { nameDisplay: s.nameDisplay, example: exampleName(emp, s.nameDisplay), allowOptOut: s.allowOptOut, hidden: me.leaderboardOptOut, updatedAt: x.leaderboardUpdatedAt },
    shoutouts: {
      granted: x.shoutouts ?? false,
      updatedAt: x.shoutoutsUpdatedAt,
      companyConnected: ctx.db.integrations.some((i) => i.companyId === emp.companyId && (i.provider === "slack" || i.provider === "microsoft_teams") && i.status === "connected"),
    },
    connectedApps: connectedNames(me),
    deletionRequestedAt: me.deletionRequestedAt,
    dataExportRequestedAt: me.dataExportRequestedAt,
  }
}

function rowOf(ctx: Ctx, me: EmployeePrivate, h: HealthConnection): ConnectionRow {
  const def = PROVIDERS[h.provider]
  const meta = healthMeta(ctx)[me.employeeId]?.[h.provider]
  const status: ConnectionStatus =
    h.status === "connected" ? "connected" : h.status === "error" ? "error" : meta?.disconnectedAt ? "disconnected" : "not_connected"
  return {
    provider: h.provider,
    name: PROVIDER_NAME[h.provider] ?? h.provider,
    platform: def.platform,
    description: def.description,
    status,
    phase: def.phase,
    connectedAt: h.connectedAt,
    lastSyncAt: h.lastSyncAt,
    disconnectedAt: status === "disconnected" ? meta?.disconnectedAt : undefined,
    dataTypes: h.dataTypes,
  }
}

function overview(ctx: Ctx): ConnectionsOverview {
  const me = ctx.me()
  const emp = employeeOf(ctx, me)
  const order: HealthProvider[] = ["apple_health", "health_connect", "fitbit", "garmin"]
  const rows = order.map((p) => me.healthConnections.find((h) => h.provider === p)).filter((h): h is HealthConnection => !!h).map((h) => rowOf(ctx, me, h))
  return {
    rows,
    anyConnected: me.healthConnections.some((h) => h.status === "connected"),
    wearableConsent: me.consents.find((c) => c.key === "wearable_connection")?.granted ?? false,
    minGroupSize: settingsOf(ctx, emp).minGroupSize,
  }
}

function connectionOf(me: EmployeePrivate, provider: string) {
  const h = me.healthConnections.find((x) => x.provider === provider)
  if (!h) throw notFound("Health app")
  return h
}

function exportOf(ctx: Ctx, me: EmployeePrivate, now: Date): DataExport | null {
  const rec = exportStore(ctx)[me.employeeId]
  if (!rec || !me.dataExportRequestedAt) return null
  const requested = new Date(rec.requestedAt).getTime()
  const readyAt = requested + EXPORT_PREPARE_MS
  const expiresAt = readyAt + EXPORT_VALID_DAYS * DAY_MS
  const t = now.getTime()
  const status: DataExport["status"] = t < readyAt ? "preparing" : t < expiresAt ? "ready" : "expired"
  if (status !== "preparing" && !rec.notified) {
    // "Notify when ready" — drop a notification into the employee's inbox once.
    rec.notified = true
    me.notifications.unshift({
      id: newId("ntf"),
      type: "system",
      title: "Your data is ready to download",
      body: `Your HealthX data export is ready. The download link is valid for ${EXPORT_VALID_DAYS} days.`,
      createdAt: new Date(readyAt).toISOString(),
      read: false,
      href: "/employee-app/settings/download-data",
    })
    ctx.save()
  }
  return {
    id: rec.id,
    requestedAt: rec.requestedAt,
    readyAt: new Date(readyAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    status,
    progress: status === "preparing" ? Math.min(0.97, Math.max(0.04, (t - requested) / EXPORT_PREPARE_MS)) : 1,
    fileName: `healthx-my-data-${rec.requestedAt.slice(0, 10)}.json`,
  }
}

// ─── Service ────────────────────────────────────────────────────────────

export const privacyApi = {
  // SCR-M-075 ───────────────────────────────────────────────────────────
  consents: endpoint<void, ConsentCentre, "employee">("employee", "GET", "/me/consents", (_i, ctx) => centre(ctx)),

  /** Grant or withdraw one consent. Withdrawing the wearable consent also disconnects health apps. */
  updateConsent: endpoint<{ type: ConsentKey; granted: boolean }, { consent: Consent; disconnected: string[] }, "employee">(
    "employee",
    "PUT",
    "/me/consents/:type",
    ({ type, granted }, ctx) => {
      const me = ctx.me()
      const consent = me.consents.find((c) => c.key === type)
      if (!consent) throw notFound("Consent")
      if (typeof granted !== "boolean") throw badRequest("Choose on or off.")
      let disconnected: string[] = []
      if (consent.granted !== granted) {
        consent.granted = granted
        consent.updatedAt = new Date().toISOString()
        if (type === "wearable_connection" && !granted) disconnected = disconnectAll(ctx, me)
        if (type === "ai_personalisation") me.aiConsent = granted
        if (type === "notifications") {
          me.notificationPreferences.push = granted
          me.notificationPreferences.email = granted
        }
        record(ctx, me, {
          key: type,
          title: consent.title,
          action: granted ? "granted" : "withdrawn",
          version: consent.version,
          at: consent.updatedAt,
          note: disconnected.length ? `Disconnected ${disconnected.join(" and ")}` : undefined,
        })
        ctx.save()
      }
      return { consent, disconnected }
    },
  ),

  /** "Show my name on leaderboards" (#158) — when hidden, the employee appears as "Anonymous" (if the company allows it). */
  updateLeaderboardVisibility: endpoint<{ hidden: boolean }, ConsentCentre, "employee">("employee", "PUT", "/me/consents/leaderboard_visibility", ({ hidden }, ctx) => {
    const me = ctx.me()
    const emp = employeeOf(ctx, me)
    if (!settingsOf(ctx, emp).allowOptOut && hidden) throw forbidden("Your company requires everyone to appear on leaderboards.")
    if (me.leaderboardOptOut !== hidden) {
      me.leaderboardOptOut = hidden
      const x = (privacyExtra(ctx)[me.employeeId] ??= {})
      x.leaderboardUpdatedAt = new Date().toISOString()
      record(ctx, me, { key: "leaderboard_visibility", title: "Show my name on leaderboards", action: hidden ? "withdrawn" : "granted", version: "2026.1", at: x.leaderboardUpdatedAt, note: hidden ? "You now appear as Anonymous" : undefined })
      ctx.save()
    }
    return centre(ctx)
  }),

  /** Slack / Teams shout-outs (Phase 2). */
  updateShoutouts: endpoint<{ granted: boolean }, ConsentCentre, "employee">("employee", "PUT", "/me/consents/shoutouts", ({ granted }, ctx) => {
    const me = ctx.me()
    const x = (privacyExtra(ctx)[me.employeeId] ??= {})
    if ((x.shoutouts ?? false) !== granted) {
      x.shoutouts = granted
      x.shoutoutsUpdatedAt = new Date().toISOString()
      record(ctx, me, { key: "shoutouts", title: "Slack / Teams shout-outs", action: granted ? "granted" : "withdrawn", version: "2026.2", at: x.shoutoutsUpdatedAt })
      ctx.save()
    }
    return centre(ctx)
  }),

  history: endpoint<void, ConsentHistoryEntry[], "employee">("employee", "GET", "/me/consents/history", (_i, ctx) =>
    [...historyOf(ctx, ctx.me())].sort((a, b) => b.at.localeCompare(a.at)),
  ),

  // SCR-M-076 ───────────────────────────────────────────────────────────
  connections: endpoint<void, ConnectionsOverview, "employee">("employee", "GET", "/me/health-connections", (_i, ctx) => overview(ctx)),

  connect: endpoint<{ provider: HealthProvider }, ConnectionRow, "employee">("employee", "POST", "/me/health-connections/:provider", ({ provider }, ctx) => {
    const me = ctx.me()
    const h = connectionOf(me, provider)
    const now = new Date().toISOString()
    h.status = "connected"
    h.connectedAt = now
    h.lastSyncAt = now
    const meta = healthMeta(ctx)[me.employeeId]
    if (meta?.[provider]) delete meta[provider]
    const consent = me.consents.find((c) => c.key === "wearable_connection")
    if (consent && !consent.granted) {
      consent.granted = true
      consent.updatedAt = now
      record(ctx, me, { key: "wearable_connection", title: consent.title, action: "granted", version: consent.version, at: now, note: `Given when you connected ${PROVIDER_NAME[provider]}` })
    }
    syncHealthFlag(ctx, me)
    ctx.save()
    return rowOf(ctx, me, h)
  }),

  sync: endpoint<{ provider: HealthProvider }, ConnectionRow, "employee">("employee", "POST", "/me/health-connections/:provider/sync", ({ provider }, ctx) => {
    const me = ctx.me()
    const h = connectionOf(me, provider)
    if (h.status !== "connected" && h.status !== "error") throw badRequest(`Connect ${PROVIDER_NAME[provider]} first.`)
    h.status = "connected"
    h.lastSyncAt = new Date().toISOString()
    syncHealthFlag(ctx, me)
    ctx.save()
    return rowOf(ctx, me, h)
  }),

  disconnect: endpoint<{ provider: HealthProvider }, ConnectionRow, "employee">("employee", "DELETE", "/me/health-connections/:provider", ({ provider }, ctx) => {
    const me = ctx.me()
    const h = connectionOf(me, provider)
    if (h.status !== "connected" && h.status !== "error") throw badRequest(`${PROVIDER_NAME[provider]} isn't connected.`)
    h.status = "disconnected"
    h.connectedAt = undefined
    const meta = (healthMeta(ctx)[me.employeeId] ??= {})
    meta[provider] = { disconnectedAt: new Date().toISOString() }
    syncHealthFlag(ctx, me)
    ctx.save()
    return rowOf(ctx, me, h)
  }),

  // SCR-M-077 (Phase 2) ─────────────────────────────────────────────────
  dataExports: endpoint<void, DataExportOverview, "employee">("employee", "GET", "/me/data-exports", (_i, ctx) => ({
    current: exportOf(ctx, ctx.me(), ctx.now),
    included: EXPORT_INCLUDES,
    linkValidDays: EXPORT_VALID_DAYS,
  })),

  dataExport: endpoint<{ id: string }, DataExport, "employee">("employee", "GET", "/me/data-exports/:id", ({ id }, ctx) => {
    const current = exportOf(ctx, ctx.me(), ctx.now)
    if (!current || current.id !== id) throw notFound("Data export")
    return current
  }),

  requestDataExport: endpoint<void, DataExport, "employee">("employee", "POST", "/me/data-exports", (_i, ctx) => {
    const me = ctx.me()
    const current = exportOf(ctx, me, ctx.now)
    if (current && current.status !== "expired") throw badRequest("You already have an active request. You can ask for a new copy once the current link expires.")
    const requestedAt = ctx.now.toISOString()
    exportStore(ctx)[me.employeeId] = { id: newId("dex"), requestedAt }
    me.dataExportRequestedAt = requestedAt
    ctx.save()
    return exportOf(ctx, me, ctx.now)!
  }),

  /** Download payload — everything we hold about the employee, as JSON. */
  downloadDataExport: endpoint<{ id: string }, Record<string, unknown>, "employee">("employee", "GET", "/me/data-exports/:id/download", ({ id }, ctx) => {
    const me = ctx.me()
    const current = exportOf(ctx, me, ctx.now)
    if (!current || current.id !== id) throw notFound("Data export")
    if (current.status === "preparing") throw badRequest("Your file is still being prepared.")
    if (current.status === "expired") throw badRequest("This download link has expired. Please request a new copy.")
    const emp = employeeOf(ctx, me)
    const workoutName = (wid: string) => ctx.db.workouts.find((w) => w.id === wid)?.name
    const habitName = (hid: string) => ctx.db.habits.find((h) => h.id === hid)?.name
    return {
      format: "HealthX personal data export",
      version: 1,
      exportedAt: ctx.now.toISOString(),
      requestedAt: current.requestedAt,
      account: {
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        phone: emp.phone ?? null,
        jobTitle: emp.jobTitle,
        employeeCode: emp.employeeCode,
        company: ctx.db.companies.find((c) => c.id === emp.companyId)?.name,
        department: ctx.db.departments.find((d) => d.id === emp.departmentId)?.name,
        team: ctx.db.teams.find((t) => t.id === emp.teamId)?.name,
        location: ctx.db.locations.find((l) => l.id === emp.locationId)?.name ?? null,
        joinedAt: emp.joinedAt ?? null,
        hasProfilePhoto: !!photoOf(ctx, emp.id),
      },
      wellnessProfile: me.profile,
      preferences: me.preferences,
      notificationPreferences: me.notificationPreferences,
      consents: me.consents,
      consentHistory: historyOf(ctx, me),
      leaderboardHidden: me.leaderboardOptOut,
      healthConnections: me.healthConnections,
      activityDaily: me.daily,
      activitySessions: me.sessions,
      water: me.water,
      waterDaily: me.waterDaily,
      sleep: me.sleep,
      workouts: me.workoutSessions.map((w) => ({ ...w, workoutName: workoutName(w.workoutId) })),
      habits: me.habits.map((h) => ({ ...h, name: h.custom?.name ?? habitName(h.habitId) })),
      meals: me.meals,
      wellnessScores: me.scores,
      pointsLedger: me.transactions,
      pointsBalance: emp.stats.pointsBalance,
      badges: me.badges.filter((b) => b.earnedAt).map((b) => ({ ...b, name: ctx.db.badges.find((x) => x.id === b.badgeId)?.name })),
      orders: ctx.db.orders
        .filter((o) => o.employeeId === emp.id)
        .map((o) => ({ ...o, rewardName: ctx.db.rewards.find((r) => r.id === o.rewardId)?.name })),
      aiCoachMessages: me.aiMessages,
    }
  }),

  // SCR-M-078 ───────────────────────────────────────────────────────────
  deletionInfo: endpoint<void, DeletionInfo, "employee">("employee", "GET", "/me/deletion-request", (_i, ctx) => {
    const me = ctx.me()
    const emp = employeeOf(ctx, me)
    const orders = ctx.db.orders.filter((o) => o.employeeId === emp.id)
    return {
      requestedAt: me.deletionRequestedAt,
      deleteBy: me.deletionRequestedAt ? deletionDueDate(me.deletionRequestedAt) : undefined,
      graceDays: DELETION_GRACE_DAYS,
      pointsBalance: emp.stats.pointsBalance,
      pendingOrders: orders.filter((o) => !["delivered", "cancelled", "rejected"].includes(o.status)).length,
      completedOrders: orders.filter((o) => o.status === "delivered").length,
      badgesCount: emp.stats.badgesCount,
      connectedApps: connectedNames(me),
      email: emp.email,
    }
  }),

  /** Sends a one-time code to the employee's email for re-authentication. */
  sendReauthCode: endpoint<void, { sentTo: string }, "employee">("employee", "POST", "/me/reauth/code", (_i, ctx) => {
    const emp = employeeOf(ctx, ctx.me())
    const [user = "", domain = ""] = emp.email.split("@")
    return { sentTo: `${user.slice(0, 2)}${"•".repeat(Math.max(2, user.length - 2))}@${domain}` }
  }),

  requestDeletion: endpoint<DeletionRequestInput, { requestedAt: string; deleteBy: string }, "employee">("employee", "POST", "/me/deletion-request", (input, ctx) => {
    const errors: Record<string, string> = {}
    if ((input.confirmation ?? "").trim() !== "DELETE") errors.confirmation = "Type DELETE in capital letters to confirm"
    if (input.method === "code") {
      if (!/^\d{6}$/.test(input.code ?? "")) errors.code = "Enter the 6-digit code"
      else if (input.code === "000000") errors.code = "That code is incorrect. Please try again."
    } else if (!input.password) errors.password = "Enter your password"
    if ((input.details ?? "").length > 500) errors.details = "Use 500 characters or fewer"
    if (Object.keys(errors).length) throw badRequest(Object.values(errors)[0]!, errors)
    const me = ctx.me()
    if (me.deletionRequestedAt) throw badRequest("You've already asked us to delete your account.")
    const now = new Date().toISOString()
    me.deletionRequestedAt = now
    deletionStore(ctx)[me.employeeId] = { reason: input.reason || undefined, details: input.details?.trim() || undefined, at: now }
    const emp = employeeOf(ctx, me)
    audit(ctx, { action: "Requested account deletion", entityType: "Employee", entityName: `${emp.firstName} ${emp.lastName}`, companyId: emp.companyId, severity: "warning" })
    ctx.save()
    return { requestedAt: now, deleteBy: deletionDueDate(now) }
  }),

  cancelDeletion: endpoint<void, { ok: true }, "employee">("employee", "DELETE", "/me/deletion-request", (_i, ctx) => {
    const me = ctx.me()
    if (!me.deletionRequestedAt) throw badRequest("There's no deletion request to cancel.")
    me.deletionRequestedAt = undefined
    delete deletionStore(ctx)[me.employeeId]
    const emp = employeeOf(ctx, me)
    audit(ctx, { action: "Cancelled account deletion request", entityType: "Employee", entityName: `${emp.firstName} ${emp.lastName}`, companyId: emp.companyId })
    ctx.save()
    return { ok: true }
  }),
}
