/**
 * Platform Admin — System health (SCR-P-029). Phase 2.
 * In production this proxies the monitoring tools (status checks, Sentry, CloudWatch).
 * The mock derives a stable picture from the sample DB (integration errors, feature flags)
 * plus small time-bucketed noise so "Refresh" shows live-looking numbers.
 */
import { noise } from "@/lib/mock/series"
import { endpoint } from "../core"
import { requireAdmin, type AdminCtx } from "./common"

export type HealthStatus = "operational" | "degraded" | "outage" | "disabled"

export interface ServiceHealth {
  id: string
  name: string
  description: string
  status: HealthStatus
  uptime30d: number
  latencyMs: number
  latency24h: number[]
  note?: string
}

export interface IntegrationHealth {
  id: string
  name: string
  kind: "Health data" | "Messaging" | "HR systems"
  status: HealthStatus
  connected: number
  connectedLabel: string
  successRate: number | null
  lastSyncAt: string | null
  phase?: 2
  note?: string
}

export interface QueueHealth {
  id: string
  name: string
  depth: number
  processingPerMin: number
  oldestWaitSec: number
  workers: number
  status: HealthStatus
}

export interface RecentError {
  id: string
  message: string
  service: string
  level: "fatal" | "error" | "warning"
  count: number
  usersAffected: number
  firstSeen: string
  lastSeen: string
}

export interface SystemHealth {
  checkedAt: string
  overall: "operational" | "degraded" | "outage"
  summary: string
  services: ServiceHealth[]
  integrations: IntegrationHealth[]
  queues: QueueHealth[]
  errors: RecentError[]
  monitoring: { label: string; url: string }[]
}

const SERVICES = [
  { id: "api", name: "API", description: "Public & app REST API (api.healthx.life)", latency: 142 },
  { id: "database", name: "Database", description: "PostgreSQL primary + read replica", latency: 9 },
  { id: "cache", name: "Cache", description: "Redis — sessions, leaderboards", latency: 2 },
  { id: "queues", name: "Job queues", description: "Background workers (BullMQ)", latency: 48 },
  { id: "push", name: "Push notifications", description: "APNs & Firebase Cloud Messaging", latency: 310 },
  { id: "email", name: "Email", description: "Transactional email (invitations, codes)", latency: 820 },
  { id: "sync", name: "Health-data sync", description: "Apple Health & Health Connect ingestion", latency: 460 },
] as const

const statusStore = (ctx: AdminCtx) => ctx.extra<Record<string, HealthStatus>>("admin-system-health-status", () => ({}))

const setting = (ctx: AdminCtx, key: string) => ctx.db.systemSettings.find((s) => s.key === key)?.value

export const healthApi = {
  get: endpoint<void, SystemHealth, "admin">("admin", "GET", "/platform/system-health", (_, ctx) => {
    requireAdmin(ctx)
    const now = Date.now()
    const bucket = Math.floor(now / 60_000) // changes every minute
    const ago = (min: number) => new Date(now - min * 60_000).toISOString()
    const overrides = statusStore(ctx)

    const services: ServiceHealth[] = SERVICES.map((s, i) => {
      const status = overrides[s.id] ?? "operational"
      const jitter = 0.85 + noise(`svc:${s.id}`, bucket) * 0.3
      const latency24h = Array.from({ length: 24 }, (_, h) => Math.round(s.latency * (0.8 + noise(`svc24:${s.id}`, bucket - h * 60) * 0.45)))
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        status,
        uptime30d: Number((99.9 + noise(`up:${s.id}`, 1) * 0.099 - (status === "operational" ? 0 : 0.4)).toFixed(3)),
        latencyMs: Math.round(s.latency * jitter * (status === "degraded" ? 3 : 1)),
        latency24h,
        note: i === 4 && status === "operational" ? "APNs feedback service healthy" : undefined,
      }
    })

    // Integrations — derived from feature flags and real integration records.
    const nimbusInts = ctx.db.integrations
    const failing = nimbusInts.filter((x) => x.status === "error")
    const hrms = nimbusInts.filter((x) => x.provider.startsWith("hrms_"))
    const connected = (provider: string) => nimbusInts.filter((x) => x.provider === provider && x.status === "connected").length
    const withIntegrations = ctx.db.companies.filter((c) => c.modules.includes("integrations") && c.status !== "suspended")
    const extraCompanies = (key: string, share: number) => withIntegrations.filter((c) => c.id !== "org_nimbus" && noise(`int:${key}:${c.id}`, 1) < share).length
    const registered = ctx.db.companies.reduce((a, c) => a + (c.status === "suspended" ? 0 : c.registeredCount), 0)
    const healthFlag = (key: string) => setting(ctx, key) !== false
    const integrations: IntegrationHealth[] = [
      {
        id: "apple_health",
        name: "Apple Health",
        kind: "Health data",
        status: healthFlag("integrations.apple_health_enabled") ? "operational" : "disabled",
        connected: Math.round(registered * 0.41),
        connectedLabel: "employees connected",
        successRate: 0.996,
        lastSyncAt: ago(1),
        note: healthFlag("integrations.apple_health_enabled") ? undefined : "Turned off in System configuration",
      },
      {
        id: "health_connect",
        name: "Health Connect",
        kind: "Health data",
        status: healthFlag("integrations.health_connect_enabled") ? "operational" : "disabled",
        connected: Math.round(registered * 0.37),
        connectedLabel: "employees connected",
        successRate: 0.991,
        lastSyncAt: ago(2),
        note: healthFlag("integrations.health_connect_enabled") ? undefined : "Turned off in System configuration",
      },
      {
        id: "fitbit",
        name: "Fitbit",
        kind: "Health data",
        phase: 2,
        status: setting(ctx, "integrations.fitbit_enabled") === true ? "operational" : "disabled",
        connected: setting(ctx, "integrations.fitbit_enabled") === true ? Math.round(registered * 0.04) : 0,
        connectedLabel: "employees connected",
        successRate: setting(ctx, "integrations.fitbit_enabled") === true ? 0.984 : null,
        lastSyncAt: setting(ctx, "integrations.fitbit_enabled") === true ? ago(6) : null,
        note: setting(ctx, "integrations.fitbit_enabled") === true ? undefined : "Not enabled yet (Phase 2)",
      },
      { id: "slack", name: "Slack", kind: "Messaging", status: "operational", connected: connected("slack") + extraCompanies("slack", 0.5), connectedLabel: "companies", successRate: 0.999, lastSyncAt: ago(4) },
      { id: "teams", name: "Microsoft Teams", kind: "Messaging", status: "operational", connected: connected("microsoft_teams") + extraCompanies("teams", 0.35), connectedLabel: "companies", successRate: 0.997, lastSyncAt: ago(11) },
      {
        id: "hrms",
        name: "HRMS sync",
        kind: "HR systems",
        status: failing.some((x) => x.provider.startsWith("hrms_")) ? "degraded" : "operational",
        connected: hrms.filter((x) => x.status !== "disconnected" && x.status !== "coming_soon").length + extraCompanies("hrms", 0.4),
        connectedLabel: "connections",
        successRate: failing.length ? 0.962 : 0.998,
        lastSyncAt: ago(27),
        note: failing.find((x) => x.provider.startsWith("hrms_"))
          ? `${failing.filter((x) => x.provider.startsWith("hrms_")).length} connection failing — ${failing.find((x) => x.provider.startsWith("hrms_"))!.config?.lastError ?? "authentication error"}`
          : undefined,
      },
    ]

    const q = (id: string, name: string, base: number, rate: number, workers: number): QueueHealth => {
      const depth = Math.round(base * (0.4 + noise(`q:${id}`, bucket) * 1.2))
      const oldest = Math.round((depth / Math.max(1, rate)) * 60 * (0.6 + noise(`qo:${id}`, bucket) * 0.6))
      return { id, name, depth, processingPerMin: Math.round(rate * (0.85 + noise(`qr:${id}`, bucket) * 0.3)), oldestWaitSec: oldest, workers, status: oldest > 600 ? "degraded" : "operational" }
    }
    const queues = [
      q("push", "Push notifications", 140, 900, 4),
      q("email", "Emails", 36, 220, 2),
      q("sync", "Health-data sync", 820, 2400, 8),
      q("points", "Points & leaderboards", 210, 1500, 4),
      q("reports", "Reports & exports", 4, 6, 1),
      q("hrms", "HRMS imports", failing.length ? 18 : 2, 3, 1),
    ]

    const hrmsError = failing.find((x) => x.provider.startsWith("hrms_"))
    const errorList: RecentError[] = [
      ...(hrmsError
        ? [{ id: "err_hrms", message: `HRMS webhook rejected: ${hrmsError.config?.lastError ?? "401 Unauthorized"}`, service: "HRMS sync", level: "error" as const, count: 46 + Math.round(noise("err:hrms", bucket) * 6), usersAffected: 0, firstSeen: hrmsError.lastSyncAt ?? ago(4320), lastSeen: ago(3) }]
        : []),
      { id: "err_sync_ts", message: "TypeError: Cannot read properties of undefined (reading 'steps') in normalizeHealthConnectRecord", service: "Health-data sync", level: "error", count: 212 + Math.round(noise("err:sync", bucket) * 20), usersAffected: 38, firstSeen: ago(2880), lastSeen: ago(7) },
      { id: "err_apns", message: "APNs: BadDeviceToken — token no longer valid for topic life.healthx.app", service: "Push notifications", level: "warning", count: 1290, usersAffected: 611, firstSeen: ago(10080), lastSeen: ago(1) },
      { id: "err_smtp", message: "SMTP 421 4.7.0 Try again later (rate limited by recipient domain)", service: "Email", level: "warning", count: 23, usersAffected: 17, firstSeen: ago(720), lastSeen: ago(48) },
      { id: "err_redis", message: "Redis ECONNRESET during leaderboard refresh (retried successfully)", service: "Cache", level: "warning", count: 5, usersAffected: 0, firstSeen: ago(1440), lastSeen: ago(310) },
      { id: "err_report", message: "TimeoutError: analytics export exceeded 30s (company with 5,400 employees)", service: "API", level: "error", count: 3, usersAffected: 2, firstSeen: ago(2100), lastSeen: ago(640) },
      { id: "err_pdf", message: "UnhandledPromiseRejection: invoice PDF render failed (font not loaded)", service: "Job queues", level: "fatal", count: 1, usersAffected: 1, firstSeen: ago(1880), lastSeen: ago(1880) },
    ]
    const errors = errorList.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))

    const down = services.filter((s) => s.status === "outage")
    const degraded = services.filter((s) => s.status === "degraded")
    const overall = down.length ? "outage" : degraded.length ? "degraded" : "operational"
    const summary =
      overall === "operational"
        ? "All systems operational."
        : overall === "outage"
          ? `Outage: ${down.map((s) => s.name).join(", ")}. Employees may not be able to use these features.`
          : `Degraded performance: ${degraded.map((s) => s.name).join(", ")}. We're seeing slower responses than usual.`

    return {
      checkedAt: new Date(now).toISOString(),
      overall,
      summary,
      services,
      integrations,
      queues,
      errors,
      monitoring: [
        { label: "Sentry", url: "https://sentry.io/organizations/healthx/issues/" },
        { label: "CloudWatch", url: "https://console.aws.amazon.com/cloudwatch/home?region=ap-south-1" },
        { label: "Status page", url: "https://status.healthx.life" },
      ],
    }
  }),
}
