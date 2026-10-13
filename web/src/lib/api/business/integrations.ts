/**
 * Business Portal — integrations (Phase 2):
 * SCR-B-036 Integrations (Slack, Microsoft Teams, HRMS overview), SCR-B-037 HRMS integration setup.
 * Integrations never read employees' health data.
 */
import type { BusinessSession } from "@/lib/auth/session"
import type { Integration } from "@/lib/types"
import { noise } from "@/lib/mock/series"
import { audit, badRequest, endpoint, newId, notFound } from "../core"
import { companyEmployees, requireRole, type BusinessCtx } from "./common"

export type MessagingProvider = "slack" | "microsoft_teams"

export const MESSAGE_TYPES = [
  { value: "challenge_updates", label: "Challenge launches & results" },
  { value: "leaderboard_highlights", label: "Weekly leaderboard highlights" },
  { value: "announcements", label: "Company announcements" },
  { value: "milestones", label: "Team milestones (e.g. 1M steps)" },
] as const

export interface MessagingIntegration extends Integration {
  provider: MessagingProvider
  workspace?: string
  channel?: string
  messageTypes: string[]
  enabled: boolean
  lastMessageAt?: string
  lastError?: string
}

export type HrmsMethod = "api" | "csv" | "sftp" | "webhook"
export type HrmsStatus = "not_configured" | "draft" | "active" | "paused" | "error"

export const HRMS_SYSTEMS = ["Darwinbox", "Keka", "Zoho People", "greytHR", "BambooHR", "Workday", "SAP SuccessFactors", "Other"] as const
export const HRMS_FIELDS = ["employeeId", "email", "firstName", "lastName", "department", "team", "manager", "jobTitle", "status"] as const
export type HrmsField = (typeof HRMS_FIELDS)[number]
export const REQUIRED_HRMS_FIELDS: HrmsField[] = ["employeeId", "email"]

export interface HrmsConfig {
  system: string
  method: HrmsMethod
  status: HrmsStatus
  api: { baseUrl: string; clientId: string; clientSecretSet: boolean }
  sftp: { host: string; port: number; username: string; path: string; passwordSet: boolean }
  schedule: { frequency: "hourly" | "daily" | "weekly"; time: string; day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday" }
  webhook: { url: string; secretHint: string; rotatedAt?: string }
  mapping: Record<HrmsField, string>
  leaverHandling: "deactivate" | "deactivate_after_7_days" | "flag_only"
  syncDepartments: boolean
  lastTest?: { at: string; ok: boolean; message: string }
  lastSyncAt?: string
  nextSyncAt?: string
  updatedAt?: string
}

export interface HrmsRun {
  id: string
  startedAt: string
  finishedAt: string
  trigger: "manual" | "schedule" | "webhook"
  status: "success" | "partial" | "failed"
  added: number
  updated: number
  deactivated: number
  errors: { row?: number; message: string }[]
}

export interface HrmsSaveInput {
  system: string
  method: HrmsMethod
  api?: { baseUrl: string; clientId: string; clientSecret?: string }
  sftp?: { host: string; port: number; username: string; path: string; password?: string }
  schedule: HrmsConfig["schedule"]
  mapping: Record<HrmsField, string>
  leaverHandling: HrmsConfig["leaverHandling"]
  syncDepartments: boolean
}

export interface IntegrationsOverview {
  messaging: MessagingIntegration[]
  hrms: { config: HrmsConfig; lastRun?: HrmsRun }
  sso: Integration[]
}

interface MessagingExtra {
  workspace?: string
  channel?: string
  messageTypes: string[]
  enabled: boolean
  lastMessageAt?: string
}

const ROLES: BusinessSession["role"][] = ["company_owner", "hr_admin"]

const messagingStore = (ctx: BusinessCtx) =>
  ctx.extra<Record<string, MessagingExtra>>("biz-messaging", () => ({
    int_slack: { workspace: "nimbus-tech", channel: "#nimbus-wellness", messageTypes: ["challenge_updates", "leaderboard_highlights", "announcements"], enabled: true, lastMessageAt: new Date(Date.now() - 26 * 3_600_000).toISOString() },
  }))

const defaultMapping: Record<HrmsField, string> = {
  employeeId: "emp_code",
  email: "work_email",
  firstName: "first_name",
  lastName: "last_name",
  department: "department_name",
  team: "sub_department",
  manager: "reporting_manager_email",
  jobTitle: "designation",
  status: "employment_status",
}

function seedHrms(ctx: BusinessCtx): { config: HrmsConfig; runs: HrmsRun[] } {
  const companyId = ctx.companyId()
  const csv = ctx.db.integrations.find((i) => i.companyId === companyId && i.provider === "hrms_csv")
  const webhookUrl = `https://api.healthx.life/api/v1/webhooks/hrms/${companyId}`
  const config: HrmsConfig = {
    system: "Darwinbox",
    method: "csv",
    status: csv?.status === "connected" ? "active" : "not_configured",
    api: { baseUrl: "", clientId: "", clientSecretSet: false },
    sftp: { host: "", port: 22, username: "", path: "/exports/healthx/", passwordSet: false },
    schedule: { frequency: "weekly", time: "06:00", day: "monday" },
    webhook: { url: webhookUrl, secretHint: "whsec_••••3f9a", rotatedAt: new Date(Date.now() - 12 * 86_400_000).toISOString() },
    mapping: { ...defaultMapping },
    leaverHandling: "deactivate_after_7_days",
    syncDepartments: true,
    lastTest: csv ? { at: csv.connectedAt ?? new Date().toISOString(), ok: true, message: "Sample file read: 236 rows, all mandatory columns found." } : undefined,
    lastSyncAt: csv?.lastSyncAt,
    nextSyncAt: nextRun({ frequency: "weekly", time: "06:00", day: "monday" }),
  }
  const runs: HrmsRun[] = Array.from({ length: 6 }, (_, i) => {
    const started = new Date(Date.now() - (7 * i + 6) * 86_400_000)
    started.setHours(6, 0, 12, 0)
    const failed = i === 3
    const added = failed ? 0 : Math.round(noise("hrms-add", i) * 6)
    const updated = failed ? 0 : Math.round(4 + noise("hrms-upd", i) * 24)
    const deactivated = failed ? 0 : Math.round(noise("hrms-deact", i) * 3)
    const errs = failed ? [{ message: "File not found at scheduled time — no upload this week" }] : i === 1 ? [{ row: 88, message: "Unknown department 'R&D Labs' — row skipped" }] : []
    return {
      id: `hrun_${i + 1}`,
      startedAt: started.toISOString(),
      finishedAt: new Date(started.getTime() + (failed ? 4000 : 38_000 + noise("hrms-dur", i) * 40_000)).toISOString(),
      trigger: "schedule" as const,
      status: failed ? ("failed" as const) : errs.length ? ("partial" as const) : ("success" as const),
      added,
      updated,
      deactivated,
      errors: errs,
    }
  })
  if (runs[0]) config.lastSyncAt = runs[0].finishedAt
  return { config, runs }
}

const hrmsStore = (ctx: BusinessCtx) => {
  const store = ctx.extra<Record<string, { config: HrmsConfig; runs: HrmsRun[] }>>("biz-hrms", () => ({}))
  const id = ctx.companyId()
  store[id] ??= seedHrms(ctx)
  return store[id]!
}

const DAY_INDEX: Record<HrmsConfig["schedule"]["day"], number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }

function nextRun(schedule: HrmsConfig["schedule"]) {
  const [h, m] = schedule.time.split(":").map(Number) as [number, number]
  const d = new Date()
  if (schedule.frequency === "hourly") {
    d.setMinutes(0, 0, 0)
    d.setHours(d.getHours() + 1)
    return d.toISOString()
  }
  d.setHours(h, m, 0, 0)
  if (schedule.frequency === "daily") {
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1)
    return d.toISOString()
  }
  const diff = (DAY_INDEX[schedule.day] - d.getDay() + 7) % 7
  d.setDate(d.getDate() + diff)
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 7)
  return d.toISOString()
}

function messagingView(ctx: BusinessCtx, i: Integration): MessagingIntegration {
  const x = messagingStore(ctx)[i.id] ?? { messageTypes: [], enabled: false }
  return {
    ...i,
    provider: i.provider as MessagingProvider,
    workspace: x.workspace,
    channel: x.channel,
    messageTypes: x.messageTypes,
    enabled: i.status === "connected" && x.enabled,
    lastMessageAt: x.lastMessageAt,
    lastError: i.config?.lastError,
  }
}

function findIntegration(ctx: BusinessCtx, id: string) {
  const i = ctx.db.integrations.find((x) => x.id === id && x.companyId === ctx.companyId())
  if (!i) throw notFound("Integration")
  return i
}

function syncProviderRecords(ctx: BusinessCtx, config: HrmsConfig) {
  // Keep db.integrations (shown in the Platform Admin Portal) in step with the HRMS set-up.
  const providerFor: Record<HrmsMethod, Integration["provider"]> = { api: "hrms_api", csv: "hrms_csv", sftp: "hrms_sftp", webhook: "hrms_webhook" }
  for (const i of ctx.db.integrations.filter((x) => x.companyId === ctx.companyId() && x.provider.startsWith("hrms_"))) {
    if (i.provider === providerFor[config.method]) {
      i.status = config.status === "active" ? "connected" : config.status === "error" ? "error" : "disconnected"
      i.connectedAt = config.status === "active" ? i.connectedAt ?? new Date().toISOString() : i.connectedAt
      i.lastSyncAt = config.lastSyncAt
      i.config = { ...(i.config ?? {}), system: config.system }
      if (config.status !== "error" && i.config.lastError) delete i.config.lastError
    } else if (i.status === "connected" || i.status === "error") {
      i.status = "disconnected"
    }
  }
}

export const integrationsApi = {
  overview: endpoint<void, IntegrationsOverview, "business">("business", "GET", "/organization/integrations", (_i, ctx) => {
    requireRole(ctx, ROLES)
    const list = ctx.db.integrations.filter((i) => i.companyId === ctx.companyId())
    const hrms = hrmsStore(ctx)
    return {
      messaging: list.filter((i) => i.provider === "slack" || i.provider === "microsoft_teams").map((i) => messagingView(ctx, i)),
      hrms: { config: hrms.config, lastRun: hrms.runs[0] },
      sso: list.filter((i) => i.provider === "google_workspace" || i.provider === "microsoft_entra"),
    }
  }),

  /** Simulates the OAuth hand-off with Slack / Microsoft Teams. */
  connect: endpoint<{ provider: MessagingProvider }, MessagingIntegration, "business">("business", "POST", "/organization/integrations/:provider/connect", ({ provider }, ctx) => {
    requireRole(ctx, ROLES)
    const i = ctx.db.integrations.find((x) => x.companyId === ctx.companyId() && x.provider === provider)
    if (!i) throw notFound("Integration")
    i.status = "connected"
    i.connectedAt = new Date().toISOString()
    if (i.config?.lastError) delete i.config.lastError
    const store = messagingStore(ctx)
    store[i.id] = { ...(store[i.id] ?? { messageTypes: ["challenge_updates", "announcements"], enabled: false }), workspace: provider === "slack" ? "nimbus-tech" : "Nimbus Technologies" }
    audit(ctx, { action: `Connected ${i.name}`, entityType: "Integration", entityName: i.name, companyId: i.companyId })
    ctx.save()
    return messagingView(ctx, i)
  }),

  update: endpoint<{ id: string; channel?: string; messageTypes?: string[]; enabled?: boolean }, MessagingIntegration, "business">("business", "PATCH", "/organization/integrations/:id", (input, ctx) => {
    requireRole(ctx, ROLES)
    const i = findIntegration(ctx, input.id)
    if (i.status !== "connected") throw badRequest(`Connect ${i.name} first.`)
    const store = messagingStore(ctx)
    const x = (store[i.id] ??= { messageTypes: [], enabled: false })
    const channel = input.channel !== undefined ? input.channel.trim() : x.channel
    if (input.enabled && !channel) throw badRequest("Choose a channel before enabling.", { channel: "Channel required before enabling" })
    if (channel && !/^#?[a-z0-9][a-z0-9._-]{0,79}$/i.test(channel)) throw badRequest("Channel names use letters, numbers, dots, dashes or underscores.", { channel: "Invalid channel name" })
    if (input.enabled && input.messageTypes && input.messageTypes.length === 0) throw badRequest("Choose at least one message type.", { messageTypes: "Choose at least one" })
    x.channel = channel ? (channel.startsWith("#") || i.provider !== "slack" ? channel : `#${channel}`) : undefined
    if (input.messageTypes) x.messageTypes = input.messageTypes
    if (input.enabled !== undefined) x.enabled = input.enabled
    audit(ctx, { action: `Updated ${i.name} settings`, entityType: "Integration", entityName: i.name, companyId: i.companyId })
    ctx.save()
    return messagingView(ctx, i)
  }),

  sendTest: endpoint<{ id: string }, { message: string }, "business">("business", "POST", "/organization/integrations/:id/test", ({ id }, ctx) => {
    requireRole(ctx, ROLES)
    const i = findIntegration(ctx, id)
    const x = messagingStore(ctx)[i.id]
    if (i.status !== "connected") throw badRequest(`${i.name} connection expired – reconnect.`)
    if (!x?.channel) throw badRequest("Choose a channel first.", { channel: "Channel required" })
    x.lastMessageAt = new Date().toISOString()
    ctx.save()
    return { message: `Test message posted to ${x.channel}.` }
  }),

  disconnect: endpoint<{ id: string }, { ok: true }, "business">("business", "POST", "/organization/integrations/:id/disconnect", ({ id }, ctx) => {
    requireRole(ctx, ROLES)
    const i = findIntegration(ctx, id)
    i.status = "disconnected"
    const x = messagingStore(ctx)[i.id]
    if (x) x.enabled = false
    audit(ctx, { action: `Disconnected ${i.name}`, entityType: "Integration", entityName: i.name, companyId: i.companyId, severity: "warning" })
    ctx.save()
    return { ok: true }
  }),

  // ─── HRMS (SCR-B-037) ───────────────────────────────────────────────

  hrms: endpoint<void, { config: HrmsConfig; runs: HrmsRun[]; employeeCount: number }, "business">("business", "GET", "/organization/integrations/hrms", (_i, ctx) => {
    requireRole(ctx, ROLES)
    const s = hrmsStore(ctx)
    return { config: s.config, runs: s.runs, employeeCount: companyEmployees(ctx).length }
  }),

  saveHrms: endpoint<HrmsSaveInput, HrmsConfig, "business">("business", "POST", "/organization/integrations/hrms", (input, ctx) => {
    requireRole(ctx, ROLES)
    const s = hrmsStore(ctx)
    const errors: Record<string, string> = {}
    if (!input.system) errors.system = "Choose your HRMS"
    if (input.method === "api") {
      if (!/^https:\/\/\S+\.\S+/.test(input.api?.baseUrl ?? "")) errors["api.baseUrl"] = "Enter the HTTPS API address"
      if (!input.api?.clientId?.trim()) errors["api.clientId"] = "Enter the client ID"
      if (!input.api?.clientSecret && !s.config.api.clientSecretSet) errors["api.clientSecret"] = "Enter the client secret"
    }
    if (input.method === "sftp") {
      if (!input.sftp?.host?.trim()) errors["sftp.host"] = "Enter the SFTP host"
      if (!input.sftp?.username?.trim()) errors["sftp.username"] = "Enter the username"
      if (!input.sftp?.password && !s.config.sftp.passwordSet) errors["sftp.password"] = "Enter the password"
      if (!input.sftp?.path?.trim()) errors["sftp.path"] = "Enter the folder path"
    }
    for (const f of REQUIRED_HRMS_FIELDS) if (!input.mapping[f]?.trim()) errors[`mapping.${f}`] = "This mapping is mandatory"
    if (Object.keys(errors).length) throw badRequest("Please complete the required connection fields.", errors)
    const c = s.config
    const methodChanged = c.method !== input.method
    c.system = input.system
    c.method = input.method
    if (input.api) c.api = { baseUrl: input.api.baseUrl.trim(), clientId: input.api.clientId.trim(), clientSecretSet: c.api.clientSecretSet || !!input.api.clientSecret }
    if (input.sftp) c.sftp = { host: input.sftp.host.trim(), port: input.sftp.port || 22, username: input.sftp.username.trim(), path: input.sftp.path.trim(), passwordSet: c.sftp.passwordSet || !!input.sftp.password }
    c.schedule = input.schedule
    c.mapping = input.mapping
    c.leaverHandling = input.leaverHandling
    c.syncDepartments = input.syncDepartments
    c.updatedAt = new Date().toISOString()
    if (methodChanged || c.status === "not_configured") {
      c.status = "draft"
      c.lastTest = undefined
    }
    c.nextSyncAt = c.status === "active" && input.method !== "webhook" ? nextRun(c.schedule) : undefined
    syncProviderRecords(ctx, c)
    audit(ctx, { action: `Saved HRMS integration (${input.system}, ${input.method.toUpperCase()})`, entityType: "Integration", entityName: "HRMS", companyId: ctx.companyId() })
    ctx.save()
    return c
  }),

  testHrms: endpoint<void, { ok: boolean; message: string }, "business">("business", "POST", "/organization/integrations/hrms/test", (_i, ctx) => {
    requireRole(ctx, ROLES)
    const c = hrmsStore(ctx).config
    let ok = true
    let message = ""
    if (c.status === "not_configured") throw badRequest("Save the connection details first.")
    if (c.method === "api") {
      ok = c.api.clientSecretSet && !/fail|invalid/i.test(c.api.baseUrl)
      message = ok ? `Connected to ${c.system}. Found ${companyEmployees(ctx).length} employee records and all mandatory fields.` : "Connection failed: authentication error."
    } else if (c.method === "sftp") {
      ok = c.sftp.passwordSet && !/fail|invalid/i.test(c.sftp.host)
      message = ok ? `Signed in to ${c.sftp.host} and found 1 file in ${c.sftp.path}.` : "Connection failed: could not reach the SFTP server."
    } else if (c.method === "webhook") {
      message = "Test event received and signature verified."
    } else {
      message = "Sample file read: all mandatory columns found."
    }
    c.lastTest = { at: new Date().toISOString(), ok, message }
    if (!ok && c.status === "active") c.status = "error"
    syncProviderRecords(ctx, c)
    ctx.save()
    if (!ok) throw badRequest(message)
    return { ok, message }
  }),

  activateHrms: endpoint<void, HrmsConfig, "business">("business", "POST", "/organization/integrations/hrms/activate", (_i, ctx) => {
    requireRole(ctx, ROLES)
    const c = hrmsStore(ctx).config
    if (!c.lastTest?.ok) throw badRequest("Run a successful connection test before activating.")
    c.status = "active"
    c.nextSyncAt = c.method === "webhook" ? undefined : nextRun(c.schedule)
    syncProviderRecords(ctx, c)
    audit(ctx, { action: "Activated HRMS sync", entityType: "Integration", entityName: `HRMS (${c.system})`, companyId: ctx.companyId(), severity: "warning" })
    ctx.save()
    return c
  }),

  pauseHrms: endpoint<void, HrmsConfig, "business">("business", "POST", "/organization/integrations/hrms/pause", (_i, ctx) => {
    requireRole(ctx, ROLES)
    const c = hrmsStore(ctx).config
    c.status = "paused"
    c.nextSyncAt = undefined
    syncProviderRecords(ctx, c)
    audit(ctx, { action: "Paused HRMS sync", entityType: "Integration", entityName: `HRMS (${c.system})`, companyId: ctx.companyId(), severity: "warning" })
    ctx.save()
    return c
  }),

  syncHrms: endpoint<void, HrmsRun, "business">("business", "POST", "/organization/integrations/hrms/sync", (_i, ctx) => {
    requireRole(ctx, ROLES)
    const s = hrmsStore(ctx)
    const c = s.config
    if (c.status !== "active") throw badRequest("Activate the HRMS sync before running it.")
    const n = s.runs.length
    const started = new Date()
    const run: HrmsRun = {
      id: newId("hrun"),
      startedAt: started.toISOString(),
      finishedAt: new Date(started.getTime() + 41_000).toISOString(),
      trigger: "manual",
      status: "success",
      added: Math.round(noise("hrms-manual-add", n) * 14),
      updated: Math.round(10 + noise("hrms-manual-upd", n) * 30),
      deactivated: Math.round(noise("hrms-manual-deact", n) * 4),
      errors: [],
    }
    s.runs.unshift(run)
    c.lastSyncAt = run.finishedAt
    c.nextSyncAt = c.method === "webhook" ? undefined : nextRun(c.schedule)
    syncProviderRecords(ctx, c)
    audit(ctx, { action: `Ran HRMS sync: ${run.added} added, ${run.updated} updated, ${run.deactivated} deactivated`, entityType: "Integration", entityName: `HRMS (${c.system})`, companyId: ctx.companyId() })
    ctx.save()
    return run
  }),

  hrmsRuns: endpoint<void, HrmsRun[], "business">("business", "GET", "/organization/integrations/hrms/runs", (_i, ctx) => {
    requireRole(ctx, ROLES)
    return hrmsStore(ctx).runs
  }),

  /** Returns the new secret once; only a hint is stored. */
  rotateWebhookSecret: endpoint<void, { secret: string }, "business">("business", "POST", "/organization/integrations/hrms/webhook-secret", (_i, ctx) => {
    requireRole(ctx, ROLES)
    const c = hrmsStore(ctx).config
    const secret = `whsec_${Array.from({ length: 32 }, () => "abcdef0123456789"[Math.floor(Math.random() * 16)]).join("")}`
    c.webhook = { ...c.webhook, secretHint: `whsec_••••${secret.slice(-4)}`, rotatedAt: new Date().toISOString() }
    audit(ctx, { action: "Rotated HRMS webhook secret", entityType: "Integration", entityName: "HRMS webhook", companyId: ctx.companyId(), severity: "warning" })
    ctx.save()
    return { secret }
  }),
}
