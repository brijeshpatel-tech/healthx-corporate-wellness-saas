/**
 * Business Portal — tracker & sync status (#360 Employee sync-status tracking, #363 Tracker & sync issues,
 * #368 Bulk resync & historical data recovery — Phase 2).
 * Only device connectivity, sync times and consent status are exposed — never health data.
 */
import type { BusinessSession } from "@/lib/auth/session"
import type { Employee } from "@/lib/types"
import { DAY_MS, noise } from "@/lib/mock/series"
import { audit, badRequest, endpoint, matchesSearch, newId } from "../core"
import { companyEmployees, requireRole, type BusinessCtx } from "./common"

export type HealthAppStatus = "connected" | "not_connected" | "reconnect"
export type ConsentStatus = "given" | "missing" | "pending"
export type SyncIssue = "not_connected" | "no_sync_3" | "no_sync_7" | "consent_missing"

export interface SyncInfo {
  healthApp: HealthAppStatus
  provider?: string
  lastSyncAt?: string
  daysSinceSync: number | null
  consent: ConsentStatus
}

export interface SyncRow {
  id: string
  name: string
  email: string
  jobTitle: string
  avatarColor: string
  departmentName: string
  teamName: string
  status: Employee["status"]
  sync: SyncInfo
  issues: SyncIssue[]
  reminder?: { count: number; lastAt: string }
}

export interface SyncOverview {
  counts: Record<SyncIssue, number> & { connected: number; total: number }
  rows: SyncRow[]
}

export interface ResyncJob {
  id: string
  scopeLabel: string
  from: string
  to: string
  includeChallenges: boolean
  employees: number
  startedAt: string
  startedBy: string
  durationMs: number
  status: "running" | "completed"
  progress: number
  result?: { resynced: number; daysRecovered: number; challengeEntriesUpdated: number; failedDevices: number }
}

const ROLES: BusinessSession["role"][] = ["company_owner", "hr_admin"]
const PROVIDER_LABEL: Record<string, string> = { apple_health: "Apple Health", health_connect: "Health Connect", fitbit: "Fitbit", garmin: "Garmin" }

const daysSince = (iso?: string) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS) : null)

/** Connection, last sync and consent for one employee (from their app data when available). */
export function syncInfo(ctx: Pick<BusinessCtx, "db">, e: Employee): SyncInfo {
  if (e.status === "invited") return { healthApp: "not_connected", daysSinceSync: null, consent: "pending" }
  const priv = ctx.db.private[e.id]
  if (priv) {
    const conn = priv.healthConnections.find((c) => c.status === "connected") ?? priv.healthConnections.find((c) => c.status === "error")
    const healthConsent = priv.consents.find((c) => c.key === "health_data")?.granted ?? false
    return {
      healthApp: !conn ? "not_connected" : conn.status === "error" ? "reconnect" : "connected",
      provider: conn ? PROVIDER_LABEL[conn.provider] : undefined,
      lastSyncAt: conn?.lastSyncAt,
      daysSinceSync: daysSince(conn?.lastSyncAt),
      consent: healthConsent ? "given" : "missing",
    }
  }
  const key = `sync:${e.id}`
  const provider = noise(key, 1) < 0.55 ? "Apple Health" : "Health Connect"
  const consent: ConsentStatus = noise(key, 3) < 0.07 ? "missing" : "given"
  if (!e.healthConnected) return { healthApp: "not_connected", daysSinceSync: null, consent }
  const r = noise(key, 2)
  const base = e.lastActiveAt ? Math.min(Date.now(), new Date(e.lastActiveAt).getTime()) : Date.now()
  let last: number
  let healthApp: HealthAppStatus = "connected"
  if (r < 0.04) {
    healthApp = "reconnect"
    last = Date.now() - (9 + Math.round(noise(key, 4) * 11)) * DAY_MS
  } else if (r < 0.1 || e.status === "inactive") {
    last = Math.min(base, Date.now() - (8 + Math.round(noise(key, 4) * 9)) * DAY_MS)
  } else if (r < 0.19) {
    last = Date.now() - (3 + Math.round(noise(key, 4) * 3)) * DAY_MS - 3_600_000
  } else {
    last = base - Math.round(noise(key, 5) * 6) * 3_600_000
  }
  const lastSyncAt = new Date(last).toISOString()
  return { healthApp, provider, lastSyncAt, daysSinceSync: daysSince(lastSyncAt), consent }
}

export function syncIssues(s: SyncInfo, status: Employee["status"]): SyncIssue[] {
  const issues: SyncIssue[] = []
  if (status === "invited") return issues
  if (s.healthApp !== "connected") issues.push("not_connected")
  if (s.healthApp !== "not_connected" && s.daysSinceSync !== null) {
    if (s.daysSinceSync >= 7) issues.push("no_sync_7")
    if (s.daysSinceSync >= 3) issues.push("no_sync_3")
  }
  if (s.consent === "missing") issues.push("consent_missing")
  return issues
}

const reminders = (ctx: BusinessCtx) => ctx.extra<Record<string, { count: number; lastAt: string }>>("biz-sync-reminders", () => ({}))
const jobsStore = (ctx: BusinessCtx) => ctx.extra<Record<string, ResyncJob[]>>("biz-resync-jobs", () => ({}))

function jobView(job: ResyncJob): ResyncJob {
  const elapsed = Date.now() - new Date(job.startedAt).getTime()
  const progress = Math.min(1, elapsed / job.durationMs)
  if (progress < 1) return { ...job, status: "running", progress, result: undefined }
  const k = `resync:${job.id}`
  const days = Math.max(1, Math.round((new Date(job.to).getTime() - new Date(job.from).getTime()) / DAY_MS) + 1)
  const failed = Math.round(job.employees * (0.02 + noise(k, 1) * 0.04))
  return {
    ...job,
    status: "completed",
    progress: 1,
    result: {
      resynced: job.employees - failed,
      failedDevices: failed,
      daysRecovered: Math.round((job.employees - failed) * days * (0.08 + noise(k, 2) * 0.1)),
      challengeEntriesUpdated: job.includeChallenges ? Math.round((job.employees - failed) * (0.6 + noise(k, 3))) : 0,
    },
  }
}

export const syncApi = {
  overview: endpoint<{ issue?: SyncIssue | "all"; departmentId?: string; search?: string }, SyncOverview, "business">("business", "GET", "/organization/sync-status", (q, ctx) => {
    requireRole(ctx, ROLES)
    const sent = reminders(ctx)
    const all = companyEmployees(ctx).filter((e) => e.status !== "invited")
    const rows: SyncRow[] = all.map((e) => {
      const sync = syncInfo(ctx, e)
      return {
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        email: e.email,
        jobTitle: e.jobTitle,
        avatarColor: e.avatarColor,
        departmentName: ctx.db.departments.find((d) => d.id === e.departmentId)?.name ?? "—",
        teamName: ctx.db.teams.find((t) => t.id === e.teamId)?.name ?? "No team",
        status: e.status,
        sync,
        issues: syncIssues(sync, e.status),
        reminder: sent[e.id],
      }
    })
    const counts = {
      not_connected: rows.filter((r) => r.issues.includes("not_connected")).length,
      no_sync_3: rows.filter((r) => r.issues.includes("no_sync_3")).length,
      no_sync_7: rows.filter((r) => r.issues.includes("no_sync_7")).length,
      consent_missing: rows.filter((r) => r.issues.includes("consent_missing")).length,
      connected: rows.filter((r) => r.sync.healthApp === "connected").length,
      total: rows.length,
    }
    const filtered = rows
      .filter((r) => (q.issue && q.issue !== "all" ? r.issues.includes(q.issue) : r.issues.length > 0))
      .filter((r) => !q.departmentId || all.find((e) => e.id === r.id)?.departmentId === q.departmentId)
      .filter((r) => matchesSearch(q.search, r.name, r.email, r.jobTitle))
      .sort((a, b) => (b.sync.daysSinceSync ?? 999) - (a.sync.daysSinceSync ?? 999) || a.name.localeCompare(b.name))
    return { counts, rows: filtered }
  }),

  /** Follow-up message: lands in the employee's notification centre (and as a push, if allowed). */
  remind: endpoint<{ ids: string[]; message?: string }, { sent: number }, "business">("business", "POST", "/organization/sync-status/reminders", ({ ids, message }, ctx) => {
    requireRole(ctx, ROLES)
    if (!ids.length) throw badRequest("Choose at least one employee.")
    const store = reminders(ctx)
    const now = new Date().toISOString()
    let sent = 0
    for (const id of ids) {
      const e = ctx.db.employees.find((x) => x.id === id && x.companyId === ctx.companyId())
      if (!e || e.status === "deactivated") continue
      const info = syncInfo(ctx, e)
      const title = info.consent === "missing" ? "Review your HealthX data consent" : info.healthApp === "connected" ? "Your steps haven't synced lately" : "Connect your health app"
      const body =
        message?.trim() ||
        (info.consent === "missing"
          ? "Turn on health-data consent in Privacy & consent so your activity counts towards challenges."
          : info.healthApp === "connected"
            ? "Open HealthX and tap “Sync now” so your recent activity counts towards challenges."
            : "Connect Apple Health or Health Connect so your steps count towards challenges and points.")
      ctx.db.private[e.id]?.notifications.unshift({ id: newId("ntf"), type: "reminder", title, body, createdAt: now, read: false, href: "/employee-app/activity" })
      const prev = store[e.id]
      store[e.id] = { count: (prev?.count ?? 0) + 1, lastAt: now }
      sent++
    }
    const single = sent === 1 ? ctx.db.employees.find((x) => x.id === ids[0]) : undefined
    audit(ctx, {
      action: `Sent tracker reminder to ${sent} ${sent === 1 ? "employee" : "employees"}`,
      entityType: "Employee",
      entityName: single ? `${single.firstName} ${single.lastName}` : `${sent} employees`,
      companyId: ctx.companyId(),
    })
    ctx.save()
    return { sent }
  }),

  resyncJobs: endpoint<void, ResyncJob[], "business">("business", "GET", "/organization/sync-status/resync-jobs", (_i, ctx) => {
    requireRole(ctx, ROLES)
    return (jobsStore(ctx)[ctx.companyId()] ?? []).map(jobView)
  }),

  /** Phase 2: ask connected devices in a group to resend data for a date range (incl. eligible challenge data). */
  startResync: endpoint<{ departmentId?: string; teamId?: string; from: string; to: string; includeChallenges: boolean }, ResyncJob, "business">(
    "business",
    "POST",
    "/organization/sync-status/resync",
    (input, ctx) => {
      const session = requireRole(ctx, ROLES)
      const errors: Record<string, string> = {}
      const from = new Date(`${input.from}T00:00:00`)
      const to = new Date(`${input.to}T00:00:00`)
      if (Number.isNaN(from.getTime())) errors.from = "Choose a start date"
      if (Number.isNaN(to.getTime())) errors.to = "Choose an end date"
      else if (to.getTime() > Date.now()) errors.to = "The end date can't be in the future"
      if (!errors.from && !errors.to && from > to) errors.to = "End date must be after the start date"
      if (!errors.from && Date.now() - from.getTime() > 90 * DAY_MS) errors.from = "Health apps keep up to 90 days of history"
      if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
      const group = companyEmployees(ctx).filter((e) => (!input.departmentId || e.departmentId === input.departmentId) && (!input.teamId || e.teamId === input.teamId))
      const connected = group.filter((e) => syncInfo(ctx, e).healthApp !== "not_connected")
      if (!connected.length) throw badRequest("No one in this group has a connected health app.")
      const label = input.teamId
        ? ctx.db.teams.find((t) => t.id === input.teamId)?.name ?? "Team"
        : input.departmentId
          ? ctx.db.departments.find((d) => d.id === input.departmentId)?.name ?? "Department"
          : "Whole company"
      const job: ResyncJob = {
        id: newId("rsj"),
        scopeLabel: label,
        from: input.from,
        to: input.to,
        includeChallenges: input.includeChallenges,
        employees: connected.length,
        startedAt: new Date().toISOString(),
        startedBy: session.user.name,
        durationMs: Math.min(14_000, 5_000 + connected.length * 40),
        status: "running",
        progress: 0,
      }
      const store = jobsStore(ctx)
      store[ctx.companyId()] = [job, ...(store[ctx.companyId()] ?? [])].slice(0, 20)
      audit(ctx, { action: `Started resync (${input.from} to ${input.to}${input.includeChallenges ? ", incl. challenge data" : ""})`, entityType: "Integration", entityName: `${label} · ${connected.length} devices`, companyId: ctx.companyId() })
      ctx.save()
      return jobView(job)
    },
  ),
}
