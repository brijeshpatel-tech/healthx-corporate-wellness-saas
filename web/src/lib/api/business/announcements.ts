/**
 * Business Portal — announcements (SCR-B-021 list, SCR-B-022 create / edit).
 *
 * Statuses follow the domain type: draft → scheduled → sent. "Cancel scheduled" moves an
 * announcement back to draft. Sending delivers an in-app notification to every employee in the
 * audience who uses the app (respecting their "announcements" preference) so it shows in the
 * Employee App's notification centre and announcements list.
 *
 * Reach figures are aggregated counts only (recipients / delivered / opened).
 */
import type { BusinessSession } from "@/lib/auth/session"
import type { Announcement, AnnouncementType, Channel } from "@/lib/types"
import { DAY_MS, noise } from "@/lib/mock/series"
import { audit, badRequest, endpoint, matchesSearch, newId, notFound } from "../core"
import { audienceMembers, audienceNames, describeAudience, notifyEmployees, validateAudience, type AudienceInput } from "./challenges"
import { ratio, requireRole, type BusinessCtx } from "./common"

// ─── Types ──────────────────────────────────────────────────────────────

export type AnnouncementStatus = Announcement["status"]
export type AnnouncementDelivery = "draft" | "now" | "schedule"

export const ANNOUNCEMENT_LIMITS = { title: 80, body: 1000, linkLabel: 30, linkHref: 300 } as const

export interface AnnouncementQuery {
  status?: AnnouncementStatus | "all"
  type?: AnnouncementType | "all"
  search?: string
}

export interface AnnouncementRow extends Announcement {
  audienceLabel: string
  /** opened ÷ delivered (sent only). */
  openRate: number | null
  /** delivered ÷ recipients (sent only). */
  deliveryRate: number | null
  updatedAt: string
  /** Set when a scheduled send was cancelled (the announcement is a draft again). */
  scheduleCancelledAt?: string
  canEdit: boolean
  canSend: boolean
  canCancel: boolean
  canDelete: boolean
}

export interface AnnouncementListResult {
  items: AnnouncementRow[]
  counts: Record<AnnouncementStatus | "all", number>
}

export interface AnnouncementDetail extends AnnouncementRow {
  audienceNames: string[]
  /** Current audience size (everyone / people who use the app). */
  audienceSize: { total: number; joined: number }
  /** Cumulative opens in the hours after sending (sent only). */
  opensTimeline: { label: string; hours: number; opened: number }[]
}

export interface AnnouncementInput extends AudienceInput {
  title: string
  body: string
  type: AnnouncementType
  channels: Channel[]
  link?: { label: string; href: string } | null
  pinned: boolean
  /** Save as draft, send straight away, or schedule for `scheduledAt`. */
  delivery: AnnouncementDelivery
  /** ISO date-time, required when delivery is "schedule". */
  scheduledAt?: string
}

// ─── Internals ──────────────────────────────────────────────────────────

const MANAGE_ROLES: BusinessSession["role"][] = ["company_owner", "hr_admin", "wellness_manager"]
const TYPES: AnnouncementType[] = ["general", "wellness_tip", "challenge", "reward", "event"]
const CHANNELS: Channel[] = ["push", "in_app", "email"]

interface AnnouncementMeta {
  updatedAt?: string
  scheduleCancelledAt?: string
  /** Sent from the portal in this demo — opens trickle in over time. */
  live?: boolean
}

const metaStore = (ctx: BusinessCtx) => ctx.extra<Record<string, AnnouncementMeta>>("biz-announcements", () => ({}))
const metaOf = (ctx: BusinessCtx, id: string) => {
  const store = metaStore(ctx)
  if (!store[id]) store[id] = {}
  return store[id]!
}

function findAnnouncement(ctx: BusinessCtx, id: string) {
  const a = ctx.db.announcements.find((x) => x.id === id && x.companyId === ctx.companyId())
  if (!a) throw notFound("Announcement")
  return a
}

const shorten = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

/** Simulates the backend delivery job for one announcement. */
function deliver(ctx: BusinessCtx, a: Announcement, at: Date) {
  const members = audienceMembers(ctx, a, true)
  const recipients = members.length
  // A few devices are always unreachable (uninstalled app, notifications blocked…).
  const undelivered = Math.min(recipients, Math.round(recipients * (0.008 + noise(a.id, 1) * 0.025)))
  a.status = "sent"
  a.sentAt = at.toISOString()
  a.stats = { recipients, delivered: recipients - undelivered, opened: 0 }
  if (a.channels.includes("push") || a.channels.includes("in_app")) {
    notifyEmployees(
      ctx,
      members.map((e) => e.id),
      { type: "announcement", title: a.title, body: shorten(a.body, 140), href: `/employee-app/announcements/${a.id}` },
      "announcements",
    )
  }
  const m = metaOf(ctx, a.id)
  m.live = true
  m.updatedAt = at.toISOString()
  delete m.scheduleCancelledAt
}

/** What the real scheduler does: deliver scheduled announcements whose time has come. */
function runScheduler(ctx: BusinessCtx) {
  const now = Date.now()
  let changed = false
  for (const a of ctx.db.announcements) {
    if (a.companyId !== ctx.companyId() || a.status !== "scheduled" || !a.scheduledAt) continue
    if (new Date(a.scheduledAt).getTime() > now) continue
    deliver(ctx, a, new Date(a.scheduledAt))
    audit(ctx, { action: `Delivered scheduled announcement to ${a.stats.recipients} employees`, entityType: "Announcement", entityName: a.title, companyId: a.companyId })
    changed = true
  }
  if (changed) ctx.save()
}

/** Opens = real reads in the Employee App, plus a gradual uptake for announcements sent in this demo. */
function refreshReach(ctx: BusinessCtx, list: Announcement[]) {
  const reads = new Map<string, number>()
  for (const p of Object.values(ctx.db.private)) for (const id of p?.readAnnouncementIds ?? []) reads.set(id, (reads.get(id) ?? 0) + 1)
  const store = metaStore(ctx)
  let changed = false
  for (const a of list) {
    if (a.status !== "sent") continue
    let opened = Math.max(a.stats.opened, reads.get(a.id) ?? 0)
    if (store[a.id]?.live && a.sentAt) opened = Math.max(opened, simulatedOpens(a, (Date.now() - new Date(a.sentAt).getTime()) / 3_600_000))
    opened = Math.min(a.stats.delivered, opened)
    if (opened !== a.stats.opened) {
      a.stats.opened = opened
      changed = true
    }
  }
  if (changed) ctx.save()
}

const finalOpenRate = (a: Announcement) => 0.38 + noise(a.id, 2) * 0.38
const simulatedOpens = (a: Announcement, hours: number) => Math.floor(a.stats.delivered * finalOpenRate(a) * (1 - Math.exp(-Math.max(0, hours) / 8)))

function toRow(ctx: BusinessCtx, a: Announcement): AnnouncementRow {
  const m = metaStore(ctx)[a.id]
  const sent = a.status === "sent"
  return {
    ...a,
    audienceLabel: describeAudience(ctx, a),
    openRate: sent ? ratio(a.stats.opened, a.stats.delivered) : null,
    deliveryRate: sent ? ratio(a.stats.delivered, a.stats.recipients) : null,
    updatedAt: m?.updatedAt ?? a.sentAt ?? a.createdAt,
    scheduleCancelledAt: a.status === "draft" ? m?.scheduleCancelledAt : undefined,
    canEdit: a.status !== "sent",
    canSend: a.status !== "sent",
    canCancel: a.status === "scheduled",
    canDelete: a.status === "draft",
  }
}

const TIMELINE_HOURS = [0, 1, 2, 4, 8, 12, 24, 48, 72]

function detailOf(ctx: BusinessCtx, a: Announcement): AnnouncementDetail {
  const members = audienceMembers(ctx, a)
  let opensTimeline: AnnouncementDetail["opensTimeline"] = []
  if (a.status === "sent" && a.sentAt) {
    const elapsed = (Date.now() - new Date(a.sentAt).getTime()) / 3_600_000
    const curve = (h: number) => 1 - Math.exp(-h / 8)
    const reference = curve(Math.min(elapsed, 72)) || 1
    opensTimeline = TIMELINE_HOURS.filter((h) => h <= elapsed).map((h) => ({
      label: h === 0 ? "Sent" : h < 24 ? `${h}h` : `${h / 24}d`,
      hours: h,
      opened: Math.min(a.stats.opened, Math.round((a.stats.opened * curve(h)) / reference)),
    }))
  }
  return {
    ...toRow(ctx, a),
    audienceNames: audienceNames(ctx, a),
    audienceSize: { total: members.length, joined: audienceMembers(ctx, a, true).length },
    opensTimeline,
  }
}

const isUrlOrPath = (href: string) => /^\/[^\s]*$/.test(href) || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(href)

function validateInput(ctx: BusinessCtx, input: AnnouncementInput) {
  const errors: Record<string, string> = {}
  const title = input.title?.trim() ?? ""
  const body = input.body?.trim() ?? ""
  if (!title) errors.title = "Enter a title"
  else if (title.length > ANNOUNCEMENT_LIMITS.title) errors.title = `Keep the title under ${ANNOUNCEMENT_LIMITS.title} characters`
  if (!body) errors.body = "Write a message"
  else if (body.length > ANNOUNCEMENT_LIMITS.body) errors.body = "Keep the message under 1,000 characters"
  if (!TYPES.includes(input.type)) errors.type = "Choose a type"
  const channels = (input.channels ?? []).filter((c) => CHANNELS.includes(c))
  if (channels.length === 0) errors.channels = "Choose at least one channel"
  const audienceError = validateAudience(ctx, input)
  if (audienceError) errors.audienceIds = audienceError
  const label = input.link?.label?.trim() ?? ""
  const href = input.link?.href?.trim() ?? ""
  if (label || href) {
    if (!label) errors["link.label"] = "Add a button label"
    else if (label.length > ANNOUNCEMENT_LIMITS.linkLabel) errors["link.label"] = `Keep the label under ${ANNOUNCEMENT_LIMITS.linkLabel} characters`
    if (!href) errors["link.href"] = "Add a link"
    else if (href.length > ANNOUNCEMENT_LIMITS.linkHref || !isUrlOrPath(href)) errors["link.href"] = "Use a web address (https://…) or an app path (/employee-app/…)"
  }
  if (input.delivery === "schedule") {
    const at = input.scheduledAt ? new Date(input.scheduledAt).getTime() : Number.NaN
    if (Number.isNaN(at)) errors.scheduledAt = "Choose a date and time"
    else if (at <= Date.now() + 60_000) errors.scheduledAt = "Choose a time in the future"
    else if (at > Date.now() + 365 * DAY_MS) errors.scheduledAt = "Schedule within the next 12 months"
  }
  if (input.delivery === "now" && !errors.audienceIds && audienceMembers(ctx, input, true).length === 0) errors.audienceIds = "No one in this audience uses the app yet"
  return errors
}

function applyInput(a: Announcement, input: AnnouncementInput) {
  a.title = input.title.trim()
  a.body = input.body.trim()
  a.type = input.type
  a.channels = CHANNELS.filter((c) => input.channels.includes(c))
  a.audienceType = input.audienceType
  a.audienceIds = input.audienceType === "all" ? [] : [...new Set(input.audienceIds)]
  a.pinned = !!input.pinned
  const label = input.link?.label?.trim()
  const href = input.link?.href?.trim()
  a.link = label && href ? { label, href } : undefined
}

/** Applies the chosen delivery option after the fields are saved. */
function applyDelivery(ctx: BusinessCtx, a: Announcement, input: AnnouncementInput) {
  const m = metaOf(ctx, a.id)
  m.updatedAt = new Date().toISOString()
  if (input.delivery === "now") {
    a.scheduledAt = undefined
    deliver(ctx, a, new Date())
  } else if (input.delivery === "schedule") {
    a.status = "scheduled"
    a.scheduledAt = new Date(input.scheduledAt!).toISOString()
    delete m.scheduleCancelledAt
  } else {
    a.status = "draft"
    a.scheduledAt = undefined
  }
}

const deliveryAction = (input: AnnouncementInput, created: boolean) =>
  input.delivery === "now"
    ? "Sent announcement"
    : input.delivery === "schedule"
      ? "Scheduled announcement"
      : created
        ? "Created announcement draft"
        : "Updated announcement draft"

const sortRows = (items: Announcement[]) => {
  const order: Record<AnnouncementStatus, number> = { scheduled: 0, draft: 1, sent: 2 }
  const when = (a: Announcement) => (a.status === "sent" ? a.sentAt : a.status === "scheduled" ? a.scheduledAt : a.createdAt) ?? a.createdAt
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
    // Scheduled: soonest first. Drafts and sent: newest first.
    return a.status === "scheduled" ? when(a).localeCompare(when(b)) : when(b).localeCompare(when(a))
  })
}

// ─── Endpoints ──────────────────────────────────────────────────────────

export const announcementsApi = {
  list: endpoint<AnnouncementQuery, AnnouncementListResult, "business">("business", "GET", "/organization/announcements", (q, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    runScheduler(ctx)
    const own = ctx.db.announcements.filter((a) => a.companyId === ctx.companyId())
    refreshReach(ctx, own)
    const base = own.filter((a) => (!q.type || q.type === "all" || a.type === q.type) && matchesSearch(q.search, a.title, a.body, a.author))
    const counts: AnnouncementListResult["counts"] = { all: base.length, draft: 0, scheduled: 0, sent: 0 }
    base.forEach((a) => counts[a.status]++)
    const items = sortRows(base.filter((a) => !q.status || q.status === "all" || a.status === q.status)).map((a) => toRow(ctx, a))
    return { items, counts }
  }),

  get: endpoint<{ id: string }, AnnouncementDetail, "business">("business", "GET", "/organization/announcements/:id", ({ id }, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    runScheduler(ctx)
    const a = findAnnouncement(ctx, id)
    refreshReach(ctx, [a])
    return detailOf(ctx, a)
  }),

  create: endpoint<AnnouncementInput, AnnouncementDetail, "business">("business", "POST", "/organization/announcements", (input, ctx) => {
    const session = requireRole(ctx, MANAGE_ROLES)
    const errors = validateInput(ctx, input)
    if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
    const a: Announcement = {
      id: newId("ann"),
      companyId: ctx.companyId(),
      title: "",
      body: "",
      type: input.type,
      audienceType: "all",
      audienceIds: [],
      channels: [],
      status: "draft",
      pinned: false,
      author: session.user.name,
      createdAt: new Date().toISOString(),
      stats: { recipients: 0, delivered: 0, opened: 0 },
    }
    applyInput(a, input)
    ctx.db.announcements.unshift(a)
    applyDelivery(ctx, a, input)
    audit(ctx, { action: deliveryAction(input, true), entityType: "Announcement", entityName: a.title, companyId: a.companyId })
    ctx.save()
    return detailOf(ctx, a)
  }),

  update: endpoint<AnnouncementInput & { id: string }, AnnouncementDetail, "business">("business", "PATCH", "/organization/announcements/:id", (input, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const a = findAnnouncement(ctx, input.id)
    if (a.status === "sent") throw badRequest("This announcement has already been sent and can't be edited. Duplicate it to send a new version.")
    const errors = validateInput(ctx, input)
    if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
    applyInput(a, input)
    applyDelivery(ctx, a, input)
    audit(ctx, { action: deliveryAction(input, false), entityType: "Announcement", entityName: a.title, companyId: a.companyId })
    ctx.save()
    return detailOf(ctx, a)
  }),

  /** Send a draft or scheduled announcement straight away. */
  send: endpoint<{ id: string }, AnnouncementDetail, "business">("business", "POST", "/organization/announcements/:id/send", ({ id }, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const a = findAnnouncement(ctx, id)
    if (a.status === "sent") throw badRequest("This announcement has already been sent.")
    const errors = validateInput(ctx, { ...a, link: a.link ?? null, delivery: "now" })
    if (Object.keys(errors).length) throw badRequest(`${Object.values(errors)[0]!}. Edit the announcement and try again.`, errors)
    a.scheduledAt = undefined
    deliver(ctx, a, new Date())
    audit(ctx, { action: `Sent announcement to ${a.stats.recipients} employees`, entityType: "Announcement", entityName: a.title, companyId: a.companyId })
    ctx.save()
    return detailOf(ctx, a)
  }),

  /** Cancel a scheduled send — the announcement goes back to draft. */
  cancel: endpoint<{ id: string }, AnnouncementDetail, "business">("business", "POST", "/organization/announcements/:id/cancel", ({ id }, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    runScheduler(ctx)
    const a = findAnnouncement(ctx, id)
    if (a.status !== "scheduled") throw badRequest(a.status === "sent" ? "This announcement has already been sent." : "Only scheduled announcements can be cancelled.")
    a.status = "draft"
    a.scheduledAt = undefined
    const m = metaOf(ctx, a.id)
    m.scheduleCancelledAt = new Date().toISOString()
    m.updatedAt = m.scheduleCancelledAt
    audit(ctx, { action: "Cancelled scheduled announcement", entityType: "Announcement", entityName: a.title, companyId: a.companyId, severity: "warning" })
    ctx.save()
    return detailOf(ctx, a)
  }),

  duplicate: endpoint<{ id: string }, AnnouncementDetail, "business">("business", "POST", "/organization/announcements/:id/duplicate", ({ id }, ctx) => {
    const session = requireRole(ctx, MANAGE_ROLES)
    const src = findAnnouncement(ctx, id)
    const suffix = " (copy)"
    const a: Announcement = {
      ...src,
      id: newId("ann"),
      title: `${src.title.slice(0, ANNOUNCEMENT_LIMITS.title - suffix.length).trimEnd()}${suffix}`,
      audienceIds: [...src.audienceIds],
      channels: [...src.channels],
      link: src.link ? { ...src.link } : undefined,
      status: "draft",
      scheduledAt: undefined,
      sentAt: undefined,
      pinned: false,
      author: session.user.name,
      createdAt: new Date().toISOString(),
      stats: { recipients: 0, delivered: 0, opened: 0 },
    }
    ctx.db.announcements.unshift(a)
    metaOf(ctx, a.id).updatedAt = a.createdAt
    audit(ctx, { action: "Duplicated announcement", entityType: "Announcement", entityName: src.title, companyId: a.companyId })
    ctx.save()
    return detailOf(ctx, a)
  }),

  setPinned: endpoint<{ id: string; pinned: boolean }, AnnouncementDetail, "business">("business", "PATCH", "/organization/announcements/:id/pin", ({ id, pinned }, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const a = findAnnouncement(ctx, id)
    a.pinned = !!pinned
    audit(ctx, { action: pinned ? "Pinned announcement" : "Unpinned announcement", entityType: "Announcement", entityName: a.title, companyId: a.companyId })
    ctx.save()
    return detailOf(ctx, a)
  }),

  remove: endpoint<{ id: string }, { ok: true }, "business">("business", "DELETE", "/organization/announcements/:id", ({ id }, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const a = findAnnouncement(ctx, id)
    if (a.status !== "draft") throw badRequest(a.status === "scheduled" ? "Cancel the scheduled send before deleting." : "Sent announcements can't be deleted.")
    ctx.db.announcements = ctx.db.announcements.filter((x) => x.id !== a.id)
    delete metaStore(ctx)[a.id]
    audit(ctx, { action: "Deleted announcement draft", entityType: "Announcement", entityName: a.title, companyId: a.companyId, severity: "warning" })
    ctx.save()
    return { ok: true }
  }),
}
