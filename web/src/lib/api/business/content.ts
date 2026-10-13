/**
 * Business Portal — content library (Phase 2): SCR-B-033 list, SCR-B-034 create / edit.
 *
 * Company content (`companyId` = the company) is fully managed here. HealthX content
 * (`companyId === null`) is read-only: companies can only view what's published.
 * Timestamps the domain type doesn't carry live in `extra["biz-content"]`.
 */
import type { BusinessSession } from "@/lib/auth/session"
import type { ContentItem, ContentType } from "@/lib/types"
import { DAY_MS, noise } from "@/lib/mock/series"
import { audit, badRequest, endpoint, forbidden, matchesSearch, newId, notFound } from "../core"
import { requireRole, type BusinessCtx } from "./common"

// ─── Types ──────────────────────────────────────────────────────────────

export type ContentStatus = ContentItem["status"]
export type ContentCategory = ContentItem["category"]
export type ContentSource = "company" | "healthx"

export const CONTENT_LIMITS = { title: 100, summary: 160, body: 4000, url: 500, tags: 6, tag: 24, readMinutes: 60 } as const

export interface ContentQuery {
  source?: ContentSource
  type?: ContentType | "all"
  status?: ContentStatus | "all"
  category?: ContentCategory | "all"
  search?: string
}

export interface ContentRow extends ContentItem {
  source: ContentSource
  createdAt: string
  updatedAt: string
  canEdit: boolean
  canPublish: boolean
  canArchive: boolean
  canUnarchive: boolean
  canDelete: boolean
}

export interface ContentListResult {
  items: ContentRow[]
  /** Status counts for the selected source (after type / category / search filters). */
  counts: Record<ContentStatus | "all", number>
  /** Items per tab (company: all statuses, HealthX: published only). */
  totals: Record<ContentSource, number>
}

export interface ContentInput {
  title: string
  summary: string
  body: string
  type: ContentType
  category: ContentCategory
  coverEmoji: string
  coverColor: string
  url?: string
  tags: string[]
  readMinutes: number
  /** Save as draft or publish now. */
  status: "draft" | "published"
}

// ─── Internals ──────────────────────────────────────────────────────────

const MANAGE_ROLES: BusinessSession["role"][] = ["company_owner", "wellness_manager"]
const TYPES: ContentType[] = ["article", "video", "tip", "link"]
const CATEGORIES: ContentCategory[] = ["movement", "nutrition", "sleep", "mindfulness", "hydration", "general"]

interface ContentMeta {
  createdAt: string
  updatedAt: string
  archivedAt?: string
}

const metaStore = (ctx: BusinessCtx) => ctx.extra<Record<string, ContentMeta>>("biz-content", () => ({}))

function metaOf(ctx: BusinessCtx, c: ContentItem): ContentMeta {
  const store = metaStore(ctx)
  const existing = store[c.id]
  if (existing) return existing
  // Sample items: derive stable timestamps from the publish date.
  const base = c.publishedAt ? new Date(c.publishedAt).getTime() : Date.now() - Math.round(2 + noise(c.id, 1) * 10) * DAY_MS
  const created = new Date(base - Math.round(1 + noise(c.id, 2) * 6) * DAY_MS).toISOString()
  const updated = new Date(c.publishedAt ? base + Math.round(noise(c.id, 3) * 2) * 3_600_000 : base).toISOString()
  store[c.id] = { createdAt: created, updatedAt: updated }
  return store[c.id]!
}

function writeMeta(ctx: BusinessCtx, c: ContentItem, patch: Partial<ContentMeta>) {
  const store = metaStore(ctx)
  store[c.id] = { ...metaOf(ctx, c), ...patch }
}

const isGlobalVisible = (c: ContentItem) => c.companyId === null && c.status === "published"

function findOwn(ctx: BusinessCtx, id: string) {
  const c = ctx.db.content.find((x) => x.id === id)
  if (!c || (c.companyId !== ctx.companyId() && !isGlobalVisible(c))) throw notFound("Content")
  if (c.companyId !== ctx.companyId()) throw forbidden("HealthX content is read-only.")
  return c
}

function toRow(ctx: BusinessCtx, c: ContentItem): ContentRow {
  const m = metaOf(ctx, c)
  const own = c.companyId === ctx.companyId()
  return {
    ...c,
    source: own ? "company" : "healthx",
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    canEdit: own && c.status !== "archived",
    canPublish: own && c.status === "draft",
    canArchive: own && c.status === "published",
    canUnarchive: own && c.status === "archived",
    canDelete: own && c.status === "draft",
  }
}

const VIDEO_URL = /^https:\/\/((www\.)?(youtube\.com|youtu\.be|vimeo\.com)\/\S+|\S+\.mp4(\?\S*)?)$/i
const WEB_URL = /^https?:\/\/[^\s/$.?#][^\s.]*\.[^\s]+$/i

function validateInput(input: ContentInput) {
  const errors: Record<string, string> = {}
  const title = input.title?.trim() ?? ""
  const summary = input.summary?.trim() ?? ""
  const body = input.body?.trim() ?? ""
  const url = input.url?.trim() ?? ""
  if (title.length < 3) errors.title = "Title must be at least 3 characters"
  else if (title.length > CONTENT_LIMITS.title) errors.title = `Keep the title under ${CONTENT_LIMITS.title} characters`
  if (!TYPES.includes(input.type)) errors.type = "Choose a content type"
  if (!CATEGORIES.includes(input.category)) errors.category = "Choose a category"
  if (!summary) errors.summary = "Write a short summary for the feed card"
  else if (summary.length > CONTENT_LIMITS.summary) errors.summary = `Keep the summary under ${CONTENT_LIMITS.summary} characters`
  if (input.type === "article" || input.type === "tip") {
    if (body.length < 20) errors.body = input.type === "tip" ? "Write the tip (at least 20 characters)" : "Write the article (at least 20 characters)"
  }
  if (body.length > CONTENT_LIMITS.body) errors.body = "Keep the body under 4,000 characters"
  if (input.type === "video") {
    if (!url) errors.url = "Add the video link"
    else if (!VIDEO_URL.test(url)) errors.url = "Use a YouTube or Vimeo link, or an https link to an MP4 file"
  } else if (input.type === "link") {
    if (!url) errors.url = "Add the link"
    else if (!WEB_URL.test(url)) errors.url = "Enter a valid web address starting with https://"
  } else if (url && !WEB_URL.test(url)) errors.url = "Enter a valid web address starting with https://"
  if (url.length > CONTENT_LIMITS.url) errors.url = "That link is too long"
  const tags = input.tags ?? []
  if (tags.length > CONTENT_LIMITS.tags) errors.tags = `Use up to ${CONTENT_LIMITS.tags} tags`
  else if (tags.some((t) => t.trim().length > CONTENT_LIMITS.tag)) errors.tags = `Keep each tag under ${CONTENT_LIMITS.tag} characters`
  if (!Number.isInteger(input.readMinutes) || input.readMinutes < 1 || input.readMinutes > CONTENT_LIMITS.readMinutes) errors.readMinutes = "Enter 1–60 minutes"
  if (input.status !== "draft" && input.status !== "published") errors.status = "Choose draft or published"
  return errors
}

function applyInput(c: ContentItem, input: ContentInput) {
  c.title = input.title.trim()
  c.summary = input.summary.trim()
  c.body = input.body.trim()
  c.type = input.type
  c.category = input.category
  c.coverEmoji = input.coverEmoji || "📰"
  c.coverColor = input.coverColor || "#10b981"
  c.url = input.url?.trim() || undefined
  c.tags = [...new Set(input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, CONTENT_LIMITS.tags)
  c.readMinutes = Math.round(input.readMinutes)
}

const typeLabel = (t: ContentType) => ({ article: "article", video: "video", tip: "tip", link: "link" })[t]

// ─── Endpoints ──────────────────────────────────────────────────────────

export const contentApi = {
  list: endpoint<ContentQuery, ContentListResult, "business">("business", "GET", "/organization/content", (q, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const companyId = ctx.companyId()
    const source: ContentSource = q.source ?? "company"
    const company = ctx.db.content.filter((c) => c.companyId === companyId)
    const global = ctx.db.content.filter(isGlobalVisible)
    const pool = source === "company" ? company : global
    const base = pool.filter(
      (c) =>
        (!q.type || q.type === "all" || c.type === q.type) &&
        (!q.category || q.category === "all" || c.category === q.category) &&
        matchesSearch(q.search, c.title, c.summary, c.author, ...c.tags),
    )
    const counts: ContentListResult["counts"] = { all: base.length, draft: 0, published: 0, archived: 0 }
    base.forEach((c) => counts[c.status]++)
    const items = base
      .filter((c) => !q.status || q.status === "all" || c.status === q.status)
      .map((c) => toRow(ctx, c))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return { items, counts, totals: { company: company.length, healthx: global.length } }
  }),

  get: endpoint<{ id: string }, ContentRow, "business">("business", "GET", "/organization/content/:id", ({ id }, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const c = ctx.db.content.find((x) => x.id === id && (x.companyId === ctx.companyId() || isGlobalVisible(x)))
    if (!c) throw notFound("Content")
    return toRow(ctx, c)
  }),

  create: endpoint<ContentInput, ContentRow, "business">("business", "POST", "/organization/content", (input, ctx) => {
    const session = requireRole(ctx, MANAGE_ROLES)
    const errors = validateInput(input)
    if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
    const now = new Date().toISOString()
    const c: ContentItem = {
      id: newId("cnt"),
      companyId: ctx.companyId(),
      title: "",
      summary: "",
      body: "",
      type: input.type,
      category: input.category,
      coverColor: "#10b981",
      coverEmoji: "📰",
      author: session.user.name,
      readMinutes: 1,
      status: input.status,
      publishedAt: input.status === "published" ? now : undefined,
      views: 0,
      tags: [],
    }
    applyInput(c, input)
    ctx.db.content.unshift(c)
    writeMeta(ctx, c, { createdAt: now, updatedAt: now })
    audit(ctx, { action: input.status === "published" ? `Published ${typeLabel(c.type)}` : `Created ${typeLabel(c.type)} draft`, entityType: "Content", entityName: c.title, companyId: c.companyId })
    ctx.save()
    return toRow(ctx, c)
  }),

  update: endpoint<ContentInput & { id: string }, ContentRow, "business">("business", "PATCH", "/organization/content/:id", (input, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const c = findOwn(ctx, input.id)
    if (c.status === "archived") throw badRequest("Unarchive this content before editing it.")
    const errors = validateInput(input)
    if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
    const wasPublished = c.status === "published"
    applyInput(c, input)
    c.status = input.status
    if (input.status === "published" && !c.publishedAt) c.publishedAt = new Date().toISOString()
    if (input.status === "draft") c.publishedAt = undefined
    writeMeta(ctx, c, { updatedAt: new Date().toISOString() })
    const action = input.status === "published" ? (wasPublished ? "Updated published content" : "Published content") : wasPublished ? "Unpublished content (moved to draft)" : "Updated content draft"
    audit(ctx, { action, entityType: "Content", entityName: c.title, companyId: c.companyId })
    ctx.save()
    return toRow(ctx, c)
  }),

  publish: endpoint<{ id: string }, ContentRow, "business">("business", "POST", "/organization/content/:id/publish", ({ id }, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const c = findOwn(ctx, id)
    if (c.status !== "draft") throw badRequest("Only drafts can be published.")
    const errors = validateInput({ ...c, url: c.url, status: "published" })
    if (Object.keys(errors).length) throw badRequest(`${Object.values(errors)[0]!}. Edit the content and try again.`, errors)
    c.status = "published"
    c.publishedAt = new Date().toISOString()
    writeMeta(ctx, c, { updatedAt: c.publishedAt })
    audit(ctx, { action: "Published content", entityType: "Content", entityName: c.title, companyId: c.companyId })
    ctx.save()
    return toRow(ctx, c)
  }),

  archive: endpoint<{ id: string }, ContentRow, "business">("business", "POST", "/organization/content/:id/archive", ({ id }, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const c = findOwn(ctx, id)
    if (c.status !== "published") throw badRequest("Only published content can be archived.")
    c.status = "archived"
    const now = new Date().toISOString()
    writeMeta(ctx, c, { updatedAt: now, archivedAt: now })
    audit(ctx, { action: "Archived content", entityType: "Content", entityName: c.title, companyId: c.companyId })
    ctx.save()
    return toRow(ctx, c)
  }),

  /** Archived content comes back as published (it was published before). */
  unarchive: endpoint<{ id: string }, ContentRow, "business">("business", "POST", "/organization/content/:id/unarchive", ({ id }, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const c = findOwn(ctx, id)
    if (c.status !== "archived") throw badRequest("Only archived content can be restored.")
    c.status = "published"
    c.publishedAt = c.publishedAt ?? new Date().toISOString()
    writeMeta(ctx, c, { updatedAt: new Date().toISOString(), archivedAt: undefined })
    audit(ctx, { action: "Unarchived content", entityType: "Content", entityName: c.title, companyId: c.companyId })
    ctx.save()
    return toRow(ctx, c)
  }),

  remove: endpoint<{ id: string }, { ok: true }, "business">("business", "DELETE", "/organization/content/:id", ({ id }, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const c = findOwn(ctx, id)
    if (c.status !== "draft") throw badRequest("Only drafts can be deleted. Archive published content instead.")
    ctx.db.content = ctx.db.content.filter((x) => x.id !== c.id)
    delete metaStore(ctx)[c.id]
    audit(ctx, { action: "Deleted content draft", entityType: "Content", entityName: c.title, companyId: c.companyId, severity: "warning" })
    ctx.save()
    return { ok: true }
  }),
}
