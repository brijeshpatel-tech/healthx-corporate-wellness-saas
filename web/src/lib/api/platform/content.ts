/** Platform Admin — global wellness content library (SCR-P-031, Phase 2). Global items are shown to every company's feed. */
import type { ContentItem, ContentType } from "@/lib/types"
import { audit, badRequest, endpoint, matchesSearch, newId, notFound } from "../core"
import { requireAdmin, type AdminCtx } from "./common"

export type ContentCategory = ContentItem["category"]

export interface ContentQuery {
  search?: string
  type?: ContentType | "all"
  category?: ContentCategory | "all"
  status?: ContentItem["status"] | "all"
}

export interface ContentList {
  items: ContentItem[]
  total: number
  counts: { all: number; published: number; draft: number; archived: number }
}

export interface ContentInput {
  title: string
  summary: string
  body: string
  type: ContentType
  category: ContentCategory
  url?: string
  readMinutes: number
  tags: string[]
  coverEmoji: string
  coverColor: string
  author: string
  status: ContentItem["status"]
}

export type ContentPatch = { id: string } & Partial<ContentInput>

const isUrl = (value: string) => {
  try {
    const u = new URL(value)
    return u.protocol === "https:" || u.protocol === "http:"
  } catch {
    return false
  }
}

function validate(v: ContentInput) {
  const errors: Record<string, string> = {}
  const title = v.title?.trim() ?? ""
  if (!title) errors.title = "Enter a title"
  else if (title.length > 120) errors.title = "Keep the title under 120 characters"
  if (!v.summary?.trim()) errors.summary = "Enter a short summary"
  else if (v.summary.length > 200) errors.summary = "Keep the summary under 200 characters"
  if ((v.type === "article" || v.type === "tip") && !v.body?.trim()) errors.body = "Write the content body"
  if ((v.body ?? "").length > 10000) errors.body = "Keep the body under 10,000 characters"
  const url = v.url?.trim() ?? ""
  if ((v.type === "video" || v.type === "link") && !url) errors.url = v.type === "video" ? "Add the video URL" : "Add the link URL"
  else if (url && !isUrl(url)) errors.url = "Enter a valid URL starting with https://"
  if (!Number.isInteger(v.readMinutes) || v.readMinutes < 1 || v.readMinutes > 120) errors.readMinutes = "Enter 1–120 minutes"
  if (!v.author?.trim()) errors.author = "Enter the author"
  if (!v.coverEmoji?.trim()) errors.coverEmoji = "Choose a cover"
  if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
  return { title, url: url || undefined }
}

const findGlobal = (ctx: AdminCtx, id: string) => {
  const item = ctx.db.content.find((c) => c.id === id && c.companyId === null)
  if (!item) throw notFound("Content")
  return item
}

const tags = (values: string[] | undefined) => [...new Set((values ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))]

const ACTION: Record<ContentItem["status"], string> = { published: "Published content", draft: "Moved content to draft", archived: "Unpublished content" }

export const contentApi = {
  list: endpoint<ContentQuery, ContentList, "admin">("admin", "GET", "/platform/content", (q, ctx) => {
    requireAdmin(ctx)
    const all = ctx.db.content.filter((c) => c.companyId === null)
    const items = all
      .filter(
        (c) =>
          matchesSearch(q.search, c.title, c.summary, c.author, ...c.tags) &&
          (!q.type || q.type === "all" || c.type === q.type) &&
          (!q.category || q.category === "all" || c.category === q.category) &&
          (!q.status || q.status === "all" || c.status === q.status),
      )
      .sort((a, b) => (b.publishedAt ?? "9999").localeCompare(a.publishedAt ?? "9999"))
    return {
      items,
      total: items.length,
      counts: {
        all: all.length,
        published: all.filter((c) => c.status === "published").length,
        draft: all.filter((c) => c.status === "draft").length,
        archived: all.filter((c) => c.status === "archived").length,
      },
    }
  }),

  get: endpoint<{ id: string }, ContentItem, "admin">("admin", "GET", "/platform/content/:id", (input, ctx) => {
    requireAdmin(ctx)
    return findGlobal(ctx, input.id)
  }),

  create: endpoint<ContentInput, ContentItem, "admin">("admin", "POST", "/platform/content", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const { title, url } = validate(input)
    const published = input.status === "published"
    const item: ContentItem = {
      id: newId("cnt"),
      companyId: null,
      title,
      summary: input.summary.trim(),
      body: input.body.trim(),
      type: input.type,
      category: input.category,
      coverColor: input.coverColor,
      coverEmoji: input.coverEmoji,
      author: input.author.trim(),
      readMinutes: input.readMinutes,
      url,
      status: published ? "published" : "draft",
      publishedAt: published ? new Date().toISOString() : undefined,
      views: 0,
      tags: tags(input.tags),
    }
    ctx.db.content.unshift(item)
    audit(ctx, { action: published ? "Published content" : "Created content draft", entityType: "Content", entityName: item.title })
    ctx.save()
    return item
  }),

  /** PATCH — full edit, or a status change (publish / unpublish = archived). */
  update: endpoint<ContentPatch, ContentItem, "admin">("admin", "PATCH", "/platform/content/:id", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const { id, ...patch } = input
    const item = findGlobal(ctx, id)
    const merged: ContentInput = {
      title: item.title,
      summary: item.summary,
      body: item.body,
      type: item.type,
      category: item.category,
      url: item.url,
      readMinutes: item.readMinutes,
      tags: item.tags,
      coverEmoji: item.coverEmoji,
      coverColor: item.coverColor,
      author: item.author,
      status: item.status,
      ...patch,
    }
    const { title, url } = validate(merged)
    const previous = item.status
    Object.assign(item, {
      title,
      summary: merged.summary.trim(),
      body: merged.body.trim(),
      type: merged.type,
      category: merged.category,
      url,
      readMinutes: merged.readMinutes,
      tags: tags(merged.tags),
      coverEmoji: merged.coverEmoji,
      coverColor: merged.coverColor,
      author: merged.author.trim(),
      status: merged.status,
      publishedAt: merged.status === "published" && previous !== "published" ? new Date().toISOString() : item.publishedAt,
    })
    audit(ctx, { action: previous === item.status ? "Updated content" : ACTION[item.status], entityType: "Content", entityName: item.title })
    ctx.save()
    return item
  }),

  remove: endpoint<{ id: string }, { id: string; title: string }, "admin">("admin", "DELETE", "/platform/content/:id", (input, ctx) => {
    requireAdmin(ctx, "catalog.manage")
    const item = findGlobal(ctx, input.id)
    ctx.db.content.splice(ctx.db.content.indexOf(item), 1)
    audit(ctx, { action: "Deleted content", entityType: "Content", entityName: item.title, severity: "warning" })
    ctx.save()
    return { id: item.id, title: item.title }
  }),
}
